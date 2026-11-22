import express, { Application, Request, Response } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import mongoSanitize from 'express-mongo-sanitize';
import apiRoutes from './routes';
import { errorHandler, notFoundHandler } from './middlewares/error.middleware';
import { env } from './config/env';

export const createApp = (): Application => {
  const app = express();

  // 1. Security Headers via Helmet
  app.use(helmet());

  // 2. Strict CORS policy
  app.use(
    cors({
      origin: env.CLIENT_URL,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'Accept']
    })
  );

  // 3. Body parsers with payload limit (50kb) to prevent Denial-of-Service
  app.use(express.json({ limit: '50kb' }));
  app.use(express.urlencoded({ extended: true, limit: '50kb' }));

  // 4. Data sanitization against NoSQL query injection
  app.use(mongoSanitize());

  // Health check endpoint
  app.get('/health', (_req: Request, res: Response) => {
    res.status(200).json({
      status: 'OK',
      timestamp: new Date().toISOString(),
      service: 'School RAG Backend API'
    });
  });

  // API Routes
  app.use('/api', apiRoutes);

  // 404 handler
  app.use(notFoundHandler);

  // Centralized Error Handler (guaranteed no stack leak in production)
  app.use(errorHandler);

  return app;
};
