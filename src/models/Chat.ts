import mongoose, { Document, Schema } from 'mongoose';

export interface IChat extends Document {
  userId: string;
  participantId: string;
  message: string;
  isFromUser: boolean;
  sentAt: number;
}

const ChatSchema: Schema = new Schema({
  userId: { type: String, required: true },
  participantId: { type: String, required: true },
  message: { type: String, required: true },
  isFromUser: { type: Boolean, required: true, default: false },
  sentAt: { type: Number, required: true }
}, { versionKey: false });

export default mongoose.model<IChat>('Chat', ChatSchema); 