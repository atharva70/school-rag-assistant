import mongoose, { Document as MongooseDoc, Schema, Types } from 'mongoose';
import { MessageRole } from '../constants/roles';

export interface ICitation {
  documentTitle: string;
  pageNumber: number;
  snippet: string;
}

export interface IChatMessage {
  role: MessageRole;
  content: string;
  citations: ICitation[];
  timestamp: Date;
}

export interface IChatSession extends MongooseDoc {
  studentId: Types.ObjectId;
  standardId: Types.ObjectId;
  subjectName: string;
  messages: IChatMessage[];
  createdAt: Date;
  updatedAt: Date;
}

const citationSchema = new Schema<ICitation>(
  {
    documentTitle: { type: String, required: true },
    pageNumber: { type: Number, required: true },
    snippet: { type: String, required: true }
  },
  { _id: false }
);

const chatMessageSchema = new Schema<IChatMessage>(
  {
    role: {
      type: String,
      enum: Object.values(MessageRole),
      required: true
    },
    content: {
      type: String,
      required: true
    },
    citations: {
      type: [citationSchema],
      default: []
    },
    timestamp: {
      type: Date,
      default: Date.now
    }
  },
  { _id: true }
);

const chatSessionSchema = new Schema<IChatSession>(
  {
    studentId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    standardId: {
      type: Schema.Types.ObjectId,
      ref: 'Standard',
      required: true
    },
    subjectName: {
      type: String,
      required: true,
      trim: true
    },
    messages: {
      type: [chatMessageSchema],
      default: []
    }
  },
  {
    timestamps: true
  }
);

chatSessionSchema.index({ studentId: 1, standardId: 1, subjectName: 1 });

export const ChatSession = mongoose.model<IChatSession>('ChatSession', chatSessionSchema);
