import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { v4 as uuidv4 } from "uuid";

const R2_ENDPOINT = process.env.CLOUDFLARE_R2_ENDPOINT || "";
const R2_BUCKET = process.env.CLOUDFLARE_R2_BUCKET || "";
const R2_ACCESS_KEY = process.env.CLOUDFLARE_R2_ACCESS_KEY || "";
const R2_SECRET_KEY = process.env.CLOUDFLARE_R2_SECRET_KEY || "";
const R2_PUBLIC_URL = process.env.CLOUDFLARE_R2_PUBLIC_URL || "";

let s3Client: S3Client | null = null;

function getS3Client(): S3Client {
  if (!s3Client) {
    if (!R2_ENDPOINT || !R2_ACCESS_KEY || !R2_SECRET_KEY) {
      throw new Error("Cloudflare R2 not configured — set CLOUDFLARE_R2_ENDPOINT, CLOUDFLARE_R2_ACCESS_KEY, CLOUDFLARE_R2_SECRET_KEY");
    }
    s3Client = new S3Client({
      region: "auto",
      endpoint: R2_ENDPOINT,
      credentials: {
        accessKeyId: R2_ACCESS_KEY,
        secretAccessKey: R2_SECRET_KEY,
      },
    });
  }
  return s3Client;
}

/**
 * Check whether R2 is configured and available for uploads.
 */
export function isR2Configured(): boolean {
  return Boolean(R2_ENDPOINT && R2_BUCKET && R2_ACCESS_KEY && R2_SECRET_KEY);
}

/**
 * Upload a buffer to Cloudflare R2 and return the public URL.
 */
export async function uploadToR2(
  buffer: ArrayBuffer | Uint8Array | Buffer,
  filename: string,
  contentType: string
): Promise<string> {
  const client = getS3Client();
  const key = `${uuidv4()}-${filename}`;
  const body = buffer instanceof ArrayBuffer ? new Uint8Array(buffer) : buffer;

  await client.send(
    new PutObjectCommand({
      Bucket: R2_BUCKET,
      Key: key,
      Body: body,
      ContentType: contentType,
    })
  );

  return getPublicUrl(key);
}

export function getPublicUrl(key: string): string {
  // Use custom public domain if configured, otherwise construct from endpoint
  if (R2_PUBLIC_URL) {
    return `${R2_PUBLIC_URL}/${key}`;
  }
  return `${R2_ENDPOINT}/${R2_BUCKET}/${key}`;
}
