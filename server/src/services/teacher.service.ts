import { Types } from 'mongoose';
import { User } from '../models/user.model';
import { Standard } from '../models/standard.model';
import { UserRole } from '../constants/roles';
import { ConflictError, ForbiddenError, NotFoundError } from '../errors/AppError';
import { hashPassword } from '../utils/password';
import { AuthUserPayload } from '../types/express';

export class TeacherService {
  static async createStudent(params: {
    email: string;
    password: string;
    standardId: string;
    teacher: AuthUserPayload;
  }) {
    const { email, password, standardId, teacher } = params;

    // Strict validation: teacher must be assigned to that standardId
    if (!teacher.standardId || teacher.standardId.toString() !== standardId.toString()) {
      throw new ForbiddenError(
        `Teachers can only create students for their assigned standard. Your assigned standard is '${teacher.standardId || 'none'}', but requested standard is '${standardId}'.`
      );
    }

    // Verify standard exists
    const standard = await Standard.findById(standardId);
    if (!standard) {
      throw new NotFoundError(`Standard with ID '${standardId}' does not exist`);
    }

    // Check if student email already exists
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      throw new ConflictError(`User with email '${email}' already exists`);
    }

    const passwordHash = await hashPassword(password);

    const student = await User.create({
      email: email.toLowerCase(),
      passwordHash,
      role: UserRole.STUDENT,
      standardId: new Types.ObjectId(standardId),
      createdBy: new Types.ObjectId(teacher.userId)
    });

    return {
      id: student._id,
      email: student.email,
      role: student.role,
      standardId: student.standardId,
      createdBy: student.createdBy,
      createdAt: student.createdAt
    };
  }

  static async getStudents(teacher: AuthUserPayload) {
    const query: Record<string, unknown> = { role: UserRole.STUDENT };
    if (teacher.standardId) {
      query.standardId = teacher.standardId;
    }
    const students = await User.find(query).sort({ createdAt: -1 });

    return students.map((student) => ({
      id: student._id.toString(),
      email: student.email,
      role: student.role,
      standardId: student.standardId,
      createdAt: student.createdAt
    }));
  }
}
