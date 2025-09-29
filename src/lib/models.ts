import mongoose from 'mongoose';
import { connectToDb } from './db';

await connectToDb();

const ImageSchema = new mongoose.Schema({
  fileId: { type: String, required: true },
  channelId: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
});

export const ImageModel = mongoose.models.Image || mongoose.model('Image', ImageSchema);
