import { Request, Response, NextFunction } from 'express';
import { UserRole } from '../constants/roles';
import { ForbiddenError, UnauthorizedError } from '../errors/AppError';

export const requireRoles = (...allowedRoles: UserRole[]) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(new UnauthorizedError('Authentication required before checking permissions'));
    }

    if (!allowedRoles.includes(req.user.role)) {
      return next(
        new ForbiddenError(
          `Access denied. Role '${req.user.role}' is not authorized to access this resource. Allowed roles: ${allowedRoles.join(', ')}`
        )
      );
    }

    next();
  };
};
