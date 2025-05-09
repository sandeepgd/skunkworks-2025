import mongoose, { Document, Schema } from 'mongoose';

export interface IChat extends Document {
  fromId: string;
  toId: string;
  message: string;
  generatedByAI: boolean;
  sentAt: number;
}

const ChatSchema: Schema = new Schema({
  fromId: { type: String, required: true },
  toId: { type: String, required: true },
  message: { type: String, required: true },
  generatedByAI: { type: Boolean, required: true, default: false },
  sentAt: { type: Number, required: true }
});

export default mongoose.model<IChat>('Chat', ChatSchema); 