import app from '../server/src/app.js';
import { connectDB } from '../server/src/config/db.js';

let isConnected = false;

export default async function handler(req, res) {
  if (!isConnected && process.env.MONGODB_URI) {
    try {
      await connectDB();
      isConnected = true;
    } catch (err) {
      console.error('[Vercel Serverless] MongoDB connection error:', err.message);
    }
  }
  return app(req, res);
}
