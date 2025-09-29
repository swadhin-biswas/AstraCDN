import dotenv from "dotenv";
import mongoose from "mongoose";
dotenv.config();

export async function connectToDb() {
  if (mongoose.connection.readyState !== 1) {
    await mongoose.connect(process.env.MONGO_URI!, {
      dbName: process.env.DB_NAME,
    });
  }
}
