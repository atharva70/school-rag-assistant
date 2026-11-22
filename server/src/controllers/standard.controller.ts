import { Request, Response } from 'express';
import { StandardService } from '../services/standard.service';
import { asyncHandler } from '../utils/asyncHandler';

export class StandardController {
  static getAllStandards = asyncHandler(async (_req: Request, res: Response) => {
    const standards = await StandardService.getAllStandards();

    res.status(200).json({
      success: true,
      data: standards
    });
  });

  static getStandardById = asyncHandler(async (req: Request, res: Response) => {
    const standard = await StandardService.getStandardById(req.params.id);

    res.status(200).json({
      success: true,
      data: standard
    });
  });
}
