/**
 * File validation utilities for upload endpoint
 */

// Allowed file extensions for application/octet-stream
// (browsers often send text files with this generic MIME type)
const OCTET_STREAM_ALLOWED_EXTENSIONS = ["md", "markdown", "txt"];
const MAX_OCTET_STREAM_SIZE = 2 * 1024 * 1024; // 2MB

// Maximum number of attachments allowed per message
export const MAX_ATTACHMENTS = 3;

export const ALLOWED_MIME_TYPES = {
  // Images
  "image/png": { ext: "png", maxSize: 5 * 1024 * 1024 }, // 5MB
  "image/jpeg": { ext: "jpg", maxSize: 5 * 1024 * 1024 }, // 5MB
  "image/jpg": { ext: "jpg", maxSize: 5 * 1024 * 1024 }, // 5MB
  // Documents
  "application/pdf": { ext: "pdf", maxSize: 10 * 1024 * 1024 }, // 10MB
  // Text
  "text/markdown": { ext: "md", maxSize: 2 * 1024 * 1024 }, // 2MB
  "text/plain": { ext: "txt", maxSize: 2 * 1024 * 1024 }, // 2MB
} as const;

export interface ValidationError {
  field: string;
  message: string;
}

export function validateFile(file: File): ValidationError | null {
  // Special handling for application/octet-stream
  // (browsers often use this for text files with unrecognized extensions)
  if (file.type === "application/octet-stream") {
    const extension = file.name.split(".").pop()?.toLowerCase() || "";

    // Only allow specific text file extensions for octet-stream
    if (!OCTET_STREAM_ALLOWED_EXTENSIONS.includes(extension)) {
      return {
        field: "type",
        message: `Files with type application/octet-stream must have extension: ${OCTET_STREAM_ALLOWED_EXTENSIONS.join(", ")}. Got: .${extension}`,
      };
    }

    // Apply size limit for text files under octet-stream
    if (file.size > MAX_OCTET_STREAM_SIZE) {
      return {
        field: "size",
        message: `File size exceeds maximum allowed size of ${MAX_OCTET_STREAM_SIZE / (1024 * 1024)}MB for text files`,
      };
    }

    return null;
  }

  // Check if file type is allowed
  if (!(file.type in ALLOWED_MIME_TYPES)) {
    return {
      field: "type",
      message: `File type ${file.type} is not allowed. Allowed types: ${Object.keys(ALLOWED_MIME_TYPES).join(", ")}`,
    };
  }

  // Check file size
  const { maxSize } = ALLOWED_MIME_TYPES[file.type as keyof typeof ALLOWED_MIME_TYPES];
  if (file.size > maxSize) {
    const maxSizeMB = (maxSize / (1024 * 1024)).toFixed(0);
    return {
      field: "size",
      message: `File size exceeds maximum allowed size of ${maxSizeMB}MB`,
    };
  }

  return null;
}

export function getFileExtension(mimeType: string): string {
  if (mimeType in ALLOWED_MIME_TYPES) {
    return ALLOWED_MIME_TYPES[mimeType as keyof typeof ALLOWED_MIME_TYPES].ext;
  }
  // Fallback: extract from mime type
  return mimeType.split("/")[1] || "bin";
}

/**
 * Validate that a buffer contains valid text content (not binary)
 * Currently a placeholder that returns true - can be enhanced later for security
 *
 * @param buffer File buffer to validate
 * @returns true if valid text, false if binary or invalid
 *
 * TODO: Future enhancements for production security:
 * - Check for null bytes (\0) which indicate binary content
 * - Verify UTF-8 encoding validity
 * - Calculate printable character ratio (should be >95% for text)
 * - Detect suspicious patterns or embedded code
 *
 * Example implementation:
 * ```typescript
 * const content = buffer.toString('utf-8');
 * if (content.includes('\0')) return false; // Binary file
 * const printable = content.split('').filter(c => {
 *   const code = c.charCodeAt(0);
 *   return (code >= 32 && code <= 126) || code === 9 || code === 10 || code === 13;
 * }).length;
 * return printable / content.length > 0.95; // 95% printable threshold
 * ```
 */
export function isValidTextContent(buffer: Buffer): boolean {
  // For now, accept all content - validation can be added later
  return true;
}
