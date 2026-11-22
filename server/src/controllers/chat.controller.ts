import { Request, Response, NextFunction } from 'express';
import { ChatService } from '../services/chat.service';

export class ChatController {
  static chat = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const { subjectName, question, sessionId, standardId } = req.body;

    // Set Server-Sent Events (SSE) headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders?.();

    try {
      const result = await ChatService.handleChatStream({
        question,
        subjectName,
        sessionId,
        standardId,
        user: req.user!,
        onToken: (token: string) => {
          res.write(`data: ${JSON.stringify({ type: 'token', content: token })}\n\n`);
        }
      });

      // Send citations metadata
      res.write(
        `data: ${JSON.stringify({
          type: 'citations',
          citations: result.citations,
          sessionId: result.sessionId
        })}\n\n`
      );

      // Send completion signal
      res.write(`data: ${JSON.stringify({ type: 'done', sessionId: result.sessionId })}\n\n`);
      res.write('data: [DONE]\n\n');
      res.end();
    } catch (error: any) {
      if (res.headersSent) {
        res.write(
          `data: ${JSON.stringify({
            type: 'error',
            message: error.message || 'An error occurred during chat streaming'
          })}\n\n`
        );
        res.end();
      } else {
        next(error);
      }
    }
  };
}
