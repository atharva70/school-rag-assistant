import multer, { FileFilterCallback } from 'multer';
import { Request, Response, NextFunction } from 'express';
import path from 'path';
import { BadRequestError } from '../errors/AppError';

// 15 MB max file size
const MAX_FILE_SIZE = 15 * 1024 * 1024;

const storage = multer.memoryStorage();

const fileFilter = (
  _req: Request,
  file: Express.Multer.File,
  cb: FileFilterCallback
): void => {
  const ext = path.extname(file.originalname).toLowerCase();
  const isPdfMime = file.mimetype === 'application/pdf';
  const isPdfExt = ext === '.pdf';

  if (isPdfMime || isPdfExt) {
    cb(null, true);
  } else {
    cb(new BadRequestError('Only PDF files are allowed (.pdf)'));
  }
};

export const uploadPdf = multer({
  storage,
  limits: {
    fileSize: MAX_FILE_SIZE
  },
  fileFilter
});

/**
 * Validates that the uploaded memory buffer starts with '%PDF-' magic bytes
 */
export const verifyPdfMagicBytes = (
  req: Request,
  _res: Response,
  next: NextFunction
): void => {
  if (req.file) {
    if (!req.file.buffer || req.file.buffer.length < 5) {
      return next(new BadRequestError('Uploaded file is empty or corrupted'));
    }

    const header = req.file.buffer.subarray(0, 5).toString();
    if (header !== '%PDF-') {
      return next(
        new BadRequestError(
          "Invalid file format: File header does not match a valid PDF document (missing '%PDF-' magic bytes)"
        )
      );
    }
  }
  next();
};
