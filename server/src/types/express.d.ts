import { UserRole } from '../constants/roles';

export interface AuthUserPayload {
  userId: string;
  id: string;
  email: string;
  role: UserRole;
  standardId?: string | null;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUserPayload;
    }
  }
}
