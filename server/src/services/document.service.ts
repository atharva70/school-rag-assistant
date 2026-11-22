import { Types } from 'mongoose';
import { Document } from '../models/document.model';
import { DocumentChunk } from '../models/documentChunk.model';
import { Standard } from '../models/standard.model';
import { DocumentStatus, UserRole } from '../constants/roles';
import { BadRequestError, ForbiddenError, NotFoundError } from '../errors/AppError';
import { RagService } from './rag.service';
import { AiService } from './ai.service';
import { AuthUserPayload } from '../types/express';

export class DocumentService {
  /**
   * Ingests an uploaded PDF document:
   * 1. Validates file buffer magic bytes (%PDF-).
   * 2. Zero-Trust check: Teacher must be assigned to standardId.
   * 3. Validates standard and subject.
   * 4. Creates Document in PROCESSING state.
   * 5. Extracts text page-by-page with pdf-parse.
   * 6. Splits text with RecursiveCharacterTextSplitter.
   * 7. Generates embeddings and bulk inserts into DocumentChunk.
   * 8. Updates Document status to READY.
   */
  static async uploadAndIngest(params: {
    file: Express.Multer.File;
    standardId: string;
    subjectName: string;
    title?: string;
    user: AuthUserPayload;
  }) {
    const { file, standardId, subjectName, title, user } = params;

    if (!file || !file.buffer) {
      throw new BadRequestError('No PDF file uploaded');
    }

    // Guardrail: Verify %PDF- magic bytes in buffer header
    if (file.buffer.length < 5 || file.buffer.subarray(0, 5).toString() !== '%PDF-') {
      throw new BadRequestError(
        "Invalid file format: File header does not match a valid PDF document (missing '%PDF-' magic bytes)"
      );
    }

    // Zero-Trust Check: Teachers can only upload to their assigned standard
    if (user.role === UserRole.TEACHER) {
      if (!user.standardId || user.standardId.toString() !== standardId.toString()) {
        throw new ForbiddenError(
          `Forbidden: Teachers are only authorized to upload materials for their assigned standard (${user.standardId || 'none'}). Requested standard: '${standardId}'.`
        );
      }
    }

    // Verify standard exists
    const standard = await Standard.findById(standardId);
    if (!standard) {
      throw new NotFoundError(`Standard with ID '${standardId}' does not exist`);
    }

    // Validate subject exists in the standard
    const subjectExists = standard.subjects.some(
      (s) => s.name.toLowerCase() === subjectName.trim().toLowerCase()
    );
    if (!subjectExists) {
      throw new BadRequestError(
        `Subject '${subjectName}' is not part of standard '${standard.name}'`
      );
    }

    const documentTitle = title?.trim() || file.originalname.replace(/\.[^/.]+$/, '');

    // Create initial Document in PROCESSING state
    const doc = await Document.create({
      title: documentTitle,
      fileName: file.originalname,
      standardId: new Types.ObjectId(standardId),
      subjectName: subjectName.trim(),
      uploadedBy: new Types.ObjectId(user.userId),
      status: DocumentStatus.PROCESSING,
      createdAt: new Date()
    });

    try {
      // 1. Extract text page-by-page using pdf-parse
      const pages = await RagService.extractPagesFromPdf(file.buffer);

      // 2. Split text into chunks using LangChain RecursiveCharacterTextSplitter
      const chunks = await RagService.splitIntoChunks(pages);

      if (chunks.length === 0) {
        throw new BadRequestError('No valid text chunks could be extracted from this PDF');
      }

      // 3. Generate embeddings
      const chunkTexts = chunks.map((c) => c.chunkText);
      const embeddings = await AiService.generateBatchEmbeddings(chunkTexts);

      // 4. Prepare DocumentChunk records
      const chunkRecords = chunks.map((chunk, index) => ({
        documentId: doc._id,
        standardId: doc.standardId,
        subjectName: doc.subjectName,
        chunkText: chunk.chunkText,
        pageNumber: chunk.pageNumber,
        embedding: embeddings[index]
      }));

      // 5. Bulk-insert into DocumentChunk collection
      await DocumentChunk.insertMany(chunkRecords);

      // 6. Mark Document status as READY
      doc.status = DocumentStatus.READY;
      await doc.save();

      return {
        id: doc._id,
        title: doc.title,
        fileName: doc.fileName,
        standardId: doc.standardId,
        subjectName: doc.subjectName,
        status: doc.status,
        totalChunks: chunkRecords.length,
        totalPages: pages.length,
        createdAt: doc.createdAt
      };
    } catch (error: any) {
      doc.status = DocumentStatus.FAILED;
      await doc.save();
      throw error;
    }
  }

  /**
   * Deletes a Document and all associated DocumentChunk documents.
   * Zero-Trust check: Verifies that the TEACHER's req.user.standardId matches the target document's standardId.
   */
  static async deleteDocument(documentId: string, user: AuthUserPayload) {
    const doc = await Document.findById(documentId);
    if (!doc) {
      throw new NotFoundError(`Document with ID '${documentId}' not found`);
    }

    // Zero-Trust Check: Teachers can only delete documents belonging to their assigned standard
    if (user.role === UserRole.TEACHER) {
      if (!user.standardId || user.standardId.toString() !== doc.standardId.toString()) {
        throw new ForbiddenError(
          'Forbidden: You are only authorized to delete documents for your assigned standard'
        );
      }
    }

    // Delete associated DocumentChunks
    const deleteChunksResult = await DocumentChunk.deleteMany({ documentId: doc._id });

    // Delete Document record
    await Document.findByIdAndDelete(doc._id);

    return {
      deletedDocumentId: doc._id,
      deletedChunksCount: deleteChunksResult.deletedCount
    };
  }

  /**
   * Retrieves documents filtered by standardId.
   * Zero-Trust Check: For STUDENT, strictly enforce req.user.standardId and ignore any standardId from the client.
   */
  static async getDocuments(params: {
    standardId?: string;
    subjectName?: string;
    user: AuthUserPayload;
  }) {
    const { user, subjectName } = params;
    let targetStandardId: string | undefined;

    if (user.role === UserRole.STUDENT) {
      // Zero-Trust: Ignore any client-provided standardId, strictly use token's standardId
      if (!user.standardId) {
        throw new ForbiddenError('Forbidden: Student has no assigned standard');
      }
      targetStandardId = user.standardId;
    } else if (user.role === UserRole.TEACHER) {
      // Teachers default to their assigned standard
      targetStandardId = params.standardId || user.standardId || undefined;
    } else {
      // Super Admin can filter or view all
      targetStandardId = params.standardId;
    }

    const query: any = {};
    if (targetStandardId) {
      query.standardId = new Types.ObjectId(targetStandardId);
    }
    if (subjectName) {
      query.subjectName = subjectName.trim();
    }

    const documents = await Document.find(query)
      .populate('standardId', 'name')
      .populate('uploadedBy', 'email')
      .sort({ createdAt: -1 });

    return documents;
  }
}
