import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

export const env = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: parseInt(process.env.PORT || '5000', 10),
  MONGO_URI: process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/school_rag',
  JWT_SECRET: process.env.JWT_SECRET || 'super_secret_school_rag_key_2026',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',
  SUPERADMIN_EMAIL: process.env.SUPERADMIN_EMAIL || 'admin@schoolrag.com',
  SUPERADMIN_PASSWORD: process.env.SUPERADMIN_PASSWORD || 'Admin@123456',
  GEMINI_API_KEY: process.env.GEMINI_API_KEY || '',
  OPENAI_API_KEY: process.env.OPENAI_API_KEY || '',
  ATLAS_VECTOR_INDEX_NAME: process.env.ATLAS_VECTOR_INDEX_NAME || 'vector_index',
  CLIENT_URL: process.env.CLIENT_URL || 'http://localhost:5173'
};
