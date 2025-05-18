import mongoose, { Document, Schema } from 'mongoose';

interface IGroup {
  name: string;
  id: string;
}

export interface IUser extends Document {
  _id: string;
  firstName: string;
  lastName: string;
  phoneNumber: string;
  createdAt: number;
  modifiedAt: number;
  groups: IGroup[];
  refreshToken?: {
    token: string;
    expiresAt: number;
  };
}

const UserSchema: Schema = new Schema({
  _id: { type: String, required: true },
  firstName: { type: String, required: true },
  lastName: { type: String, required: true },
  phoneNumber: { type: String, required: true, unique: true },
  createdAt: { type: Number, required: true },
  modifiedAt: { type: Number, required: true },
  refreshToken: {
    token: { type: String },
    expiresAt: { type: Number }
  },
  groups: [
    {
      name: { type: String, required: true },
      id: { type: String, required: true },
      _id: false  // Disable _id for group subdocuments
    }
  ]
}, { versionKey: false });

export default mongoose.model<IUser>('User', UserSchema); 