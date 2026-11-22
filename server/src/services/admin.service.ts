import { Types } from 'mongoose';
import { User } from '../models/user.model';
import { Standard } from '../models/standard.model';
import { UserRole } from '../constants/roles';
import { ConflictError, NotFoundError } from '../errors/AppError';
import { hashPassword } from '../utils/password';

export class AdminService {
  static async createTeacher(params: {
    email: string;
    password: string;
    standardId: string;
    createdBy: string;
  }) {
    const { email, password, standardId, createdBy } = params;

    // Check if standard exists
    const standard = await Standard.findById(standardId);
    if (!standard) {
      throw new NotFoundError(`Standard with ID '${standardId}' does not exist`);
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      throw new ConflictError(`User with email '${email}' already exists`);
    }

    const passwordHash = await hashPassword(password);

    const teacher = await User.create({
      email: email.toLowerCase(),
      passwordHash,
      role: UserRole.TEACHER,
      standardId: new Types.ObjectId(standardId),
      createdBy: new Types.ObjectId(createdBy)
    });

    return {
      id: teacher._id,
      email: teacher.email,
      role: teacher.role,
      standardId: teacher.standardId,
      createdBy: teacher.createdBy,
      createdAt: teacher.createdAt
    };
  }

  static async getTeachers() {
    const teachers = await User.find({ role: UserRole.TEACHER })
      .populate('standardId', 'name')
      .sort({ createdAt: -1 });

    return teachers.map((teacher) => ({
      id: teacher._id.toString(),
      email: teacher.email,
      role: teacher.role,
      standardId: teacher.standardId,
      createdAt: teacher.createdAt
    }));
  }

  static async createStandard(params: {
    name: string;
    subjects?: Array<{ name: string; code: string }>;
  }) {
    const { name, subjects = [] } = params;

    const existingStandard = await Standard.findOne({
      name: { $regex: new RegExp(`^${name.trim()}$`, 'i') }
    });
    if (existingStandard) {
      throw new ConflictError(`Standard with name '${name}' already exists`);
    }

    const standard = await Standard.create({
      name: name.trim(),
      subjects: subjects.map((s) => ({
        name: s.name.trim(),
        code: s.code.trim().toUpperCase()
      }))
    });

    return standard;
  }

  static async addSubjectToStandard(params: {
    standardId: string;
    name: string;
    code: string;
  }) {
    const { standardId, name, code } = params;

    const standard = await Standard.findById(standardId);
    if (!standard) {
      throw new NotFoundError(`Standard with ID '${standardId}' does not exist`);
    }

    const formattedCode = code.trim().toUpperCase();
    const formattedName = name.trim();

    // Check for duplicate subject code or name within this standard
    const duplicateCode = standard.subjects.find(
      (s) => s.code.toUpperCase() === formattedCode
    );
    if (duplicateCode) {
      throw new ConflictError(`Subject with code '${formattedCode}' already exists in standard '${standard.name}'`);
    }

    const duplicateName = standard.subjects.find(
      (s) => s.name.toLowerCase() === formattedName.toLowerCase()
    );
    if (duplicateName) {
      throw new ConflictError(`Subject with name '${formattedName}' already exists in standard '${standard.name}'`);
    }

    standard.subjects.push({
      name: formattedName,
      code: formattedCode
    });

    await standard.save();
    return standard;
  }
}
