import mongoose, { Schema, Document } from 'mongoose';

export interface IHighlight extends Document {
  userId: string;
  toId: string; 
  message: string;
  sentAt: number;  // unix seconds
}

const HighlightSchema = new Schema({
  userId: {
    type: String,
    required: true,
    ref: 'User'
  },
  toId: {
    type: String,
    required: false,
    ref: 'Group'
  },
  message: {
    type: String,
    required: true
  },
  sentAt: {
    type: Number,
    required: true
  }
}, { versionKey: false });

export default mongoose.model<IHighlight>('Highlight', HighlightSchema); 