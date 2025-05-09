import mongoose, { Document, Schema } from 'mongoose';

export interface IGroup extends Document {
  _id: string;
  name: string;
  createdBy: string;
  createdAt: number;
}

const GroupSchema: Schema = new Schema({
  _id: { type: String, required: true },
  name: { type: String, required: true },
  createdBy: { type: String, required: true },
  createdAt: { type: Number, required: true }
});

export default mongoose.model<IGroup>('Group', GroupSchema); 