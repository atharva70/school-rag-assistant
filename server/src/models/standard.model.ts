import mongoose, { Document as MongooseDoc, Schema, Types } from 'mongoose';

export interface ISubject {
  _id?: Types.ObjectId;
  name: string;
  code: string;
}

export interface IStandard extends MongooseDoc {
  name: string;
  subjects: ISubject[];
}

const subjectSchema = new Schema<ISubject>(
  {
    name: { type: String, required: true, trim: true },
    code: { type: String, required: true, trim: true, uppercase: true }
  },
  { _id: true }
);

const standardSchema = new Schema<IStandard>(
  {
    name: { type: String, required: true, trim: true, unique: true },
    subjects: { type: [subjectSchema], default: [] }
  },
  {
    timestamps: true
  }
);

export const Standard = mongoose.model<IStandard>('Standard', standardSchema);
