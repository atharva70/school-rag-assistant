import mongoose, { Document as MongooseDoc, Schema, Types } from 'mongoose';

export interface IDocumentChunk extends MongooseDoc {
  documentId: Types.ObjectId;
  standardId: Types.ObjectId;
  subjectName: string;
  chunkText: string;
  pageNumber: number;
  embedding: number[];
}

const documentChunkSchema = new Schema<IDocumentChunk>(
  {
    documentId: {
      type: Schema.Types.ObjectId,
      ref: 'Document',
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
    chunkText: {
      type: String,
      required: true
    },
    pageNumber: {
      type: Number,
      required: true
    },
    embedding: {
      type: [Number],
      required: true,
      default: []
    }
  },
  {
    timestamps: true
  }
);

// Helpful index for chunk queries by standard and subject
documentChunkSchema.index({ standardId: 1, subjectName: 1 });
documentChunkSchema.index({ documentId: 1 });

export const DocumentChunk = mongoose.model<IDocumentChunk>('DocumentChunk', documentChunkSchema);
