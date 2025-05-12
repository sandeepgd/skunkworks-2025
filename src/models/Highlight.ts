import mongoose, { Schema, Document } from 'mongoose';

export interface IHighlight extends Document {
  userId: mongoose.Types.ObjectId;
  toId?: mongoose.Types.ObjectId;  // optional, used for group chat
  message: string;
  sharedAt: number;  // unix seconds
}

const HighlightSchema = new Schema({
  userId: {
    type: Schema.Types.ObjectId,
    required: true,
    ref: 'User'
  },
  toId: {
    type: Schema.Types.ObjectId,
    required: false,
    ref: 'Group'
  },
  message: {
    type: String,
    required: true
  },
  sharedAt: {
    type: Number,
    required: true
  }
});

export default mongoose.model<IHighlight>('Highlight', HighlightSchema); 