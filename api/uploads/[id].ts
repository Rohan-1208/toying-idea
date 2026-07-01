import type { VercelRequest, VercelResponse } from "@vercel/node";
import mongoose from "mongoose";
import { GridFSBucket, ObjectId } from "mongodb";
import { withApi } from "../_lib/http.js";
import { connectDB } from "../_lib/db.js";

function getMimeType(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "png":
      return "image/png";
    case "gif":
      return "image/gif";
    case "webp":
      return "image/webp";
    case "svg":
      return "image/svg+xml";
    default:
      return "application/octet-stream";
  }
}

export default withApi(async (req: VercelRequest, res: VercelResponse) => {
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.setHeader("Allow", ["GET", "HEAD"]);
    res.status(405).json({ error: "Method Not Allowed" });
    return;
  }

  await connectDB();
  const id = req.query.id as string;
  if (!id) {
    res.status(400).json({ error: "File ID is required" });
    return;
  }

  if (!ObjectId.isValid(id)) {
    res.status(400).json({ error: "Invalid File ID" });
    return;
  }

  const db = mongoose.connection.db;
  if (!db) {
    res.status(500).json({ error: "Database not connected" });
    return;
  }

  const bucket = new GridFSBucket(db, { bucketName: "fs" });
  const objectId = new ObjectId(id);

  // 1. Check if the file exists in GridFS
  const files = await db.collection("fs.files").find({ _id: objectId }).toArray();
  if (files.length === 0) {
    res.status(404).json({ error: "File not found" });
    return;
  }

  const file = files[0];
  const contentType = file.contentType || (file.filename ? getMimeType(file.filename) : "application/octet-stream");

  res.setHeader("Content-Type", contentType);
  // Cache for 1 year since GridFS files are immutable in practice here
  res.setHeader("Cache-Control", "public, max-age=31536000, immutable");

  if (req.method === "HEAD") {
    res.end();
    return;
  }

  // 2. Stream the file content to response
  const downloadStream = bucket.openDownloadStream(objectId);

  return new Promise<void>((resolve, reject) => {
    downloadStream.on("data", (chunk) => {
      res.write(chunk);
    });
    downloadStream.on("error", (err) => {
      console.error("GridFS download error:", err);
      if (!res.headersSent) {
        res.status(500).json({ error: "Failed to stream file" });
      }
      reject(err);
    });
    downloadStream.on("end", () => {
      res.end();
      resolve();
    });
  });
});
