import { Request, Response } from 'express';
import { AdminService } from '../services/admin.service';
import { asyncHandler } from '../utils/asyncHandler';

export class AdminController {
  static createTeacher = asyncHandler(async (req: Request, res: Response) => {
    const { email, password, standardId } = req.body;
    const teacher = await AdminService.createTeacher({
      email,
      password,
      standardId,
      createdBy: req.user!.userId
    });

    res.status(201).json({
      success: true,
      message: 'Teacher created successfully',
      data: teacher
    });
  });

  static getTeachers = asyncHandler(async (_req: Request, res: Response) => {
    const teachers = await AdminService.getTeachers();

    res.status(200).json({
      success: true,
      data: teachers
    });
  });

  static createStandard = asyncHandler(async (req: Request, res: Response) => {
    const { name, subjects } = req.body;
    const standard = await AdminService.createStandard({ name, subjects });

    res.status(201).json({
      success: true,
      message: 'Standard created successfully',
      data: standard
    });
  });

  static addSubjectToStandard = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const { name, code } = req.body;

    const standard = await AdminService.addSubjectToStandard({
      standardId: id,
      name,
      code
    });

    res.status(200).json({
      success: true,
      message: 'Subject added to standard successfully',
      data: standard
    });
  });
}
