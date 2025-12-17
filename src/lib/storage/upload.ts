import { PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import { s3Client, BUCKET_NAME } from "./s3-client";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

/**
 * Upload a file to S3/MinIO
 * @param buffer File buffer to upload
 * @param key Unique file key (path in bucket)
 * @param contentType MIME type of the file
 * @param originalFilename Original filename for Content-Disposition header
 * @returns Public URL of the uploaded file
 */
export async function uploadFile(
  buffer: Buffer,
  key: string,
  contentType: string,
  originalFilename?: string,
): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
    Body: buffer,
    ContentType: contentType,
    // Set Content-Disposition so browser uses original filename when downloading
    ...(originalFilename && {
      ContentDisposition: `attachment; filename="${encodeURIComponent(originalFilename)}"`,
    }),
  });

  await s3Client.send(command);

  // Return public URL (MinIO bucket is set to public download in compose.yaml)
  const endpoint = process.env.S3_ENDPOINT || "";
  return `${endpoint}/${BUCKET_NAME}/${key}`;
}

/**
 * Upload a large file using multipart upload (for files > 5MB)
 * @param buffer File buffer to upload
 * @param key Unique file key (path in bucket)
 * @param contentType MIME type of the file
 * @param originalFilename Original filename for Content-Disposition header
 * @returns Public URL of the uploaded file
 */
export async function uploadLargeFile(
  buffer: Buffer,
  key: string,
  contentType: string,
  originalFilename?: string,
): Promise<string> {
  const upload = new Upload({
    client: s3Client,
    params: {
      Bucket: BUCKET_NAME,
      Key: key,
      Body: buffer,
      ContentType: contentType,
      // Set Content-Disposition so browser uses original filename when downloading
      ...(originalFilename && {
        ContentDisposition: `attachment; filename="${encodeURIComponent(originalFilename)}"`,
      }),
    },
    // Multipart upload configuration
    queueSize: 4, // concurrent uploads
    partSize: 5 * 1024 * 1024, // 5MB parts
  });

  await upload.done();

  const endpoint = process.env.S3_ENDPOINT || "";
  return `${endpoint}/${BUCKET_NAME}/${key}`;
}

/**
 * Get file buffer from S3/MinIO
 * @param key File key in bucket
 * @returns File buffer
 */
export async function getFile(key: string): Promise<Buffer> {
  const command = new GetObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
  });

  const response = await s3Client.send(command);

  if (!response.Body) {
    throw new Error("File not found");
  }

  // Convert stream to buffer
  const chunks: Uint8Array[] = [];
  for await (const chunk of response.Body as AsyncIterable<Uint8Array>) {
    chunks.push(chunk);
  }

  return Buffer.concat(chunks);
}

/**
 * Generate a presigned URL for private file access
 * @param key File key in bucket
 * @param expiresIn Expiration time in seconds (default: 1 hour)
 * @returns Presigned URL
 */
export async function getPresignedUrl(key: string, expiresIn = 3600): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
  });

  return await getSignedUrl(s3Client, command, { expiresIn });
}
