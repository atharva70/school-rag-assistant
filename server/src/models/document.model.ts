import mongoose, { Document as MongooseDoc, Schema, Types } from 'mongoose';
import { DocumentStatus } from '../constants/roles';

export interface IDocument extends MongooseDoc {
  title: string;
  fileName: string;
  standardId: Types.ObjectId;
  subjectName: string;
  uploadedBy: Types.ObjectId;
  status: DocumentStatus;
  createdAt: Date;
}

const documentSchema = new Schema<IDocument>(
  {
    title: {
      type: String,
      required: true,
      trim: true
    },
    fileName: {
      type: String,
      required: true,
      trim: true
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
    uploadedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    status: {
      type: String,
      enum: Object.values(DocumentStatus),
      default: DocumentStatus.PROCESSING,
      required: true
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  },
  {
    timestamps: false
  }
);

export const Document = mongoose.model<IDocument>('Document', documentSchema);
