import mongoose, { Document as MongooseDoc, Schema, Types } from 'mongoose';
import { UserRole } from '../constants/roles';

export interface IUser extends MongooseDoc {
  email: string;
  passwordHash: string;
  role: UserRole;
  standardId: Types.ObjectId | null;
  createdBy: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<IUser>(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true
    },
    passwordHash: {
      type: String,
      required: true
    },
    role: {
      type: String,
      enum: Object.values(UserRole),
      required: true
    },
    standardId: {
      type: Schema.Types.ObjectId,
      ref: 'Standard',
      default: null
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null
    }
  },
  {
    timestamps: true
  }
);

// Strip passwordHash from all JSON and Object representations
userSchema.set('toJSON', {
  transform: function (_doc, ret: any) {
    delete ret.passwordHash;
    return ret;
  }
});

userSchema.set('toObject', {
  transform: function (_doc, ret: any) {
    delete ret.passwordHash;
    return ret;
  }
});

export const User = mongoose.model<IUser>('User', userSchema);
