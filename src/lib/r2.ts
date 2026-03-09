import { v4 as uuidv4 } from "uuid";

const R2_ENDPOINT = process.env.CLOUDFLARE_R2_ENDPOINT || "";
const R2_BUCKET = process.env.CLOUDFLARE_R2_BUCKET || "";
const R2_ACCESS_KEY = process.env.CLOUDFLARE_R2_ACCESS_KEY || "";
const R2_SECRET_KEY = process.env.CLOUDFLARE_R2_SECRET_KEY || "";

export async function uploadToR2(
  buffer: ArrayBuffer | Uint8Array,
  filename: string,
  contentType: string
): Promise<string> {
  const key = `${uuidv4()}-${filename}`;

  // Using S3-compatible API with fetch
  const url = `${R2_ENDPOINT}/${R2_BUCKET}/${key}`;

  // For production, use AWS SDK v3 with S3Client
  // This is a simplified version — in production use @aws-sdk/client-s3
  const res = await fetch(url, {
    method: "PUT",
    headers: {
      "Content-Type": contentType,
      Authorization: `Basic ${Buffer.from(`${R2_ACCESS_KEY}:${R2_SECRET_KEY}`).toString("base64")}`,
    },
    body: (buffer instanceof ArrayBuffer ? new Uint8Array(buffer) : buffer) as BodyInit,
  });

  if (!res.ok) {
    throw new Error(`R2 upload failed: ${res.status}`);
  }

  // Return public URL
  return `${R2_ENDPOINT}/${R2_BUCKET}/${key}`;
}

export function getPublicUrl(key: string): string {
  return `${R2_ENDPOINT}/${R2_BUCKET}/${key}`;
}
