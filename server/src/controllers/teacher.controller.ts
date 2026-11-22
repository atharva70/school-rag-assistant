import { Request, Response } from 'express';
import { TeacherService } from '../services/teacher.service';
import { asyncHandler } from '../utils/asyncHandler';

export class TeacherController {
  static createStudent = asyncHandler(async (req: Request, res: Response) => {
    const { email, password, standardId } = req.body;
    const student = await TeacherService.createStudent({
      email,
      password,
      standardId,
      teacher: req.user!
    });

    res.status(201).json({
      success: true,
      message: 'Student created successfully',
      data: student
    });
  });

  static getStudents = asyncHandler(async (req: Request, res: Response) => {
    const students = await TeacherService.getStudents(req.user!);

    res.status(200).json({
      success: true,
      data: students
    });
  });
}
