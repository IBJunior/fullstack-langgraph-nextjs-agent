import { S3Client } from "@aws-sdk/client-s3";

/**
 * S3 client configured for MinIO (development) or AWS S3/Cloudflare R2 (production).
 * Configuration automatically switches based on environment variables.
 */
export const s3Client = new S3Client({
  endpoint: process.env.S3_ENDPOINT,
  region: process.env.S3_REGION || "us-east-1",
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID!,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
  },
  // CRITICAL: forcePathStyle must be true for MinIO, false for AWS S3
  forcePathStyle: process.env.S3_FORCE_PATH_STYLE === "true",
});

export const BUCKET_NAME = process.env.S3_BUCKET_NAME || "uploads";
