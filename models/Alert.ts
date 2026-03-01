import mongoose, { Schema, Document } from 'mongoose';

export interface IAlert extends Document {
    id: string;
    cities: string[];
    title: string;
    timestamp: string;
}

const AlertSchema: Schema = new Schema({
    id: { type: String, required: true, unique: true },
    cities: { type: [String], required: true },
    title: { type: String, required: true },
    timestamp: { type: String, required: true, default: () => new Date().toISOString() },
});

// Since Next.js is hot-reloaded, we must ensure we don't compile the model twice.
export default mongoose.models.Alert || mongoose.model<IAlert>('Alert', AlertSchema);
