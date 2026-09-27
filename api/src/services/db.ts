import mongoose from "mongoose";

export class Database {
  constructor(readonly mongodbUri: string) {}

  public async connect() {
    // Fail fast instead of hanging queries forever while disconnected.
    mongoose.set("bufferCommands", false);
    // Unlike a demo backend, money moves here: no "run without a database" fallback.
    await mongoose.connect(this.mongodbUri, { serverSelectionTimeoutMS: 10_000 });
    console.log("Connected to DB successfully");
  }

  public async disconnect() {
    await mongoose.disconnect();
  }

  public isConnected() {
    return mongoose.connection.readyState === 1;
  }
}
