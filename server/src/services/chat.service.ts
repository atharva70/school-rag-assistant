import { Types } from 'mongoose';
import { DocumentChunk } from '../models/documentChunk.model';
import { Document } from '../models/document.model';
import { ChatSession } from '../models/chatSession.model';
import { UserRole, MessageRole } from '../constants/roles';
import { BadRequestError, ForbiddenError } from '../errors/AppError';
import { AiService, RetrievedChunk } from './ai.service';
import { env } from '../config/env';
import { AuthUserPayload } from '../types/express';

export class ChatService {
  /**
   * Retrieves top 4 relevant chunks using MongoDB $vectorSearch pre-filtered by standardId and subjectName.
   * Includes fallback to cosine similarity if the Atlas Search index is not yet built.
   */
  static async retrieveTopChunks(params: {
    standardId: string;
    subjectName: string;
    queryEmbedding: number[];
  }): Promise<RetrievedChunk[]> {
    const { standardId, subjectName, queryEmbedding } = params;
    const stdId = new Types.ObjectId(standardId);

    // 1. Attempt Atlas $vectorSearch aggregation
    try {
      const vectorResults = await DocumentChunk.aggregate([
        {
          $vectorSearch: {
            index: env.ATLAS_VECTOR_INDEX_NAME || 'vector_index',
            path: 'embedding',
            queryVector: queryEmbedding,
            numCandidates: 20,
            limit: 4,
            filter: {
              standardId: stdId,
              subjectName: subjectName.trim()
            }
          }
        },
        {
          $lookup: {
            from: 'documents',
            localField: 'documentId',
            foreignField: '_id',
            as: 'documentInfo'
          }
        },
        {
          $project: {
            chunkText: 1,
            pageNumber: 1,
            score: { $meta: 'vectorSearchScore' },
            documentTitle: { $arrayElemAt: ['$documentInfo.title', 0] }
          }
        }
      ]);

      if (vectorResults && vectorResults.length > 0) {
        return vectorResults.map((r) => ({
          documentTitle: r.documentTitle || 'Document',
          pageNumber: r.pageNumber,
          chunkText: r.chunkText,
          score: r.score
        }));
      }
    } catch (err: any) {
      console.warn(
        `[VectorSearch] Atlas $vectorSearch stage not available or index not ready (${err.message}). Using fallback in-memory ranking.`
      );
    }

    // 2. Fallback: Fetch matching chunks and rank by cosine similarity in memory
    const chunks = await DocumentChunk.find({
      standardId: stdId,
      subjectName: subjectName.trim()
    })
      .populate('documentId', 'title')
      .limit(50);

    if (chunks.length === 0) {
      return [];
    }

    const scored = chunks.map((chunk) => {
      const sim = this.cosineSimilarity(queryEmbedding, chunk.embedding || []);
      const doc = chunk.documentId as any;
      return {
        documentTitle: doc?.title || 'Course Material',
        pageNumber: chunk.pageNumber,
        chunkText: chunk.chunkText,
        score: sim
      };
    });

    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, 4);
  }

  /**
   * Cosine similarity between two vectors.
   */
  private static cosineSimilarity(vecA: number[], vecB: number[]): number {
    if (!vecA || !vecB || vecA.length === 0 || vecB.length === 0) return 0;
    const len = Math.min(vecA.length, vecB.length);
    let dot = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < len; i++) {
      dot += vecA[i] * vecB[i];
      normA += vecA[i] * vecA[i];
      normB += vecB[i] * vecB[i];
    }

    if (normA === 0 || normB === 0) return 0;
    return dot / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  /**
   * Coordinates the chat pipeline:
   * 1. Validates question length (max 600 chars).
   * 2. Zero-Trust Check: If STUDENT, strictly enforce req.user.standardId from JWT.
   * 3. Generates embedding for the question.
   * 4. Runs $vectorSearch pre-filtered by standardId & subjectName to retrieve top 4 chunks.
   * 5. Streams the LLM completion via onToken callback.
   * 6. Saves the conversation turn to ChatSession.
   */
  static async handleChatStream(params: {
    question: string;
    subjectName: string;
    sessionId?: string;
    standardId?: string;
    user: AuthUserPayload;
    onToken: (token: string) => void;
  }): Promise<{
    sessionId: string;
    citations: Array<{ documentTitle: string; pageNumber: number; snippet: string }>;
    fullResponse: string;
  }> {
    const { question, subjectName, sessionId, user, onToken } = params;

    // Guardrail: Validate question length
    if (!question || question.trim().length === 0) {
      throw new BadRequestError('Question cannot be empty');
    }
    if (question.length > 600) {
      throw new BadRequestError('Question must not exceed 600 characters');
    }

    // Zero-Trust Check: For STUDENT, strictly use req.user.standardId from JWT and ignore any client-passed standardId
    let targetStandardId: string | null = null;
    if (user.role === UserRole.STUDENT) {
      if (!user.standardId) {
        throw new ForbiddenError('Student has no assigned standard');
      }
      targetStandardId = user.standardId;
    } else {
      targetStandardId = params.standardId || user.standardId || null;
      if (!targetStandardId) {
        throw new BadRequestError('User must have an assigned standard or standardId must be specified');
      }
    }

    // 1. Generate query embedding
    const queryEmbedding = await AiService.generateEmbedding(question);

    // 2. Retrieve top 4 chunks via $vectorSearch
    const topChunks = await this.retrieveTopChunks({
      standardId: targetStandardId,
      subjectName,
      queryEmbedding
    });

    const citations = topChunks.map((chunk) => ({
      documentTitle: chunk.documentTitle,
      pageNumber: chunk.pageNumber,
      snippet: chunk.chunkText.trim()
    }));

    // 3. Retrieve or initialize chat session
    let chatSession: any;
    if (sessionId && Types.ObjectId.isValid(sessionId)) {
      chatSession = await ChatSession.findById(sessionId);
    }

    if (!chatSession) {
      chatSession = await ChatSession.create({
        studentId: new Types.ObjectId(user.userId),
        standardId: new Types.ObjectId(targetStandardId),
        subjectName: subjectName.trim(),
        messages: []
      });
    }

    const previousHistory = chatSession.messages.map((m: any) => ({
      role: m.role,
      content: m.content
    }));

    // 4. Stream LLM response
    const fullResponse = await AiService.streamChatResponse(
      {
        question,
        contextChunks: topChunks,
        subjectName,
        history: previousHistory
      },
      onToken
    );

    // 5. Append user and assistant messages to ChatSession
    chatSession.messages.push({
      role: MessageRole.USER,
      content: question,
      citations: [],
      timestamp: new Date()
    });

    chatSession.messages.push({
      role: MessageRole.ASSISTANT,
      content: fullResponse,
      citations,
      timestamp: new Date()
    });

    await chatSession.save();

    return {
      sessionId: chatSession._id.toString(),
      citations,
      fullResponse
    };
  }
}
