import { Request, Response } from 'express';
import { DocumentService } from '../services/document.service';
import { asyncHandler } from '../utils/asyncHandler';
import { BadRequestError } from '../errors/AppError';

export class DocumentController {
  static uploadDocument = asyncHandler(async (req: Request, res: Response) => {
    if (!req.file) {
      throw new BadRequestError('No PDF file provided. Please attach a file under the "file" field.');
    }

    const { standardId, subjectName, title } = req.body;

    const result = await DocumentService.uploadAndIngest({
      file: req.file,
      standardId,
      subjectName,
      title,
      user: req.user!
    });

    res.status(201).json({
      success: true,
      message: 'PDF document uploaded and indexed into chunks successfully',
      data: result
    });
  });

  static deleteDocument = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const result = await DocumentService.deleteDocument(id, req.user!);

    res.status(200).json({
      success: true,
      message: 'Document and all associated chunks deleted successfully',
      data: result
    });
  });

  static getDocuments = asyncHandler(async (req: Request, res: Response) => {
    const { standardId, subjectName } = req.query;

    const documents = await DocumentService.getDocuments({
      standardId: standardId as string | undefined,
      subjectName: subjectName as string | undefined,
      user: req.user!
    });

    res.status(200).json({
      success: true,
      count: documents.length,
      data: documents
    });
  });
}
