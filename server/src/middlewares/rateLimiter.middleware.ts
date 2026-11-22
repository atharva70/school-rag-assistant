import rateLimit from 'express-rate-limit';
import { Request, Response } from 'express';

// Strict limiter on login: max 10 attempts per 15 minutes per IP
export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many login attempts from this IP. Please try again after 15 minutes.'
  }
});

// AI quota limiter on chat: max 20 requests per 15 minutes per authenticated user ID
export const chatLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  validate: {
    keyGeneratorIpFallback: false,
    xForwardedForHeader: false
  },
  keyGenerator: (req: Request): string => {
    // Authenticated user ID (or fallback identifier)
    return req.user?.id || req.user?.userId || 'anonymous';
  },
  handler: (_req: Request, res: Response) => {
    res.status(429).json({
      success: false,
      message: 'AI chat quota exceeded (max 20 requests per 15 minutes). Please try again later.'
    });
  }
});
