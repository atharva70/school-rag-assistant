import { User } from '../models/user.model';
import { comparePassword } from '../utils/password';
import { generateToken } from '../utils/jwt';
import { UnauthorizedError, NotFoundError } from '../errors/AppError';
import { AuthUserPayload } from '../types/express';

export class AuthService {
  static async login(email: string, password: string) {
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      throw new UnauthorizedError('Invalid email or password');
    }

    const isMatch = await comparePassword(password, user.passwordHash);
    if (!isMatch) {
      throw new UnauthorizedError('Invalid email or password');
    }

    const payload: AuthUserPayload = {
      userId: user._id.toString(),
      email: user.email,
      role: user.role,
      standardId: user.standardId ? user.standardId.toString() : null
    };

    const token = generateToken(payload);

    return {
      token,
      user: {
        id: user._id,
        email: user.email,
        role: user.role,
        standardId: user.standardId
      }
    };
  }

  static async getCurrentUser(userId: string) {
    const user = await User.findById(userId)
      .select('-passwordHash')
      .populate('standardId', 'name subjects')
      .populate('createdBy', 'email role');

    if (!user) {
      throw new NotFoundError('User not found');
    }

    return user;
  }
}
