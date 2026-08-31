import mongoose from 'mongoose';
import { config } from './env.js';

export async function connectDB(uri = config.mongodbUri) {
  try {
    const conn = await mongoose.connect(uri);
    console.log(`[MongoDB] Connected: ${conn.connection.host}`);
    return conn;
  } catch (error) {
    console.error(`[MongoDB] Connection error: ${error.message}`);
    if (config.isProduction) {
      process.exit(1);
    }
    throw error;
  }
}

export async function disconnectDB() {
  try {
    await mongoose.disconnect();
    console.log('[MongoDB] Disconnected');
  } catch (error) {
    console.error(`[MongoDB] Disconnect error: ${error.message}`);
  }
}
