import { NextRequest, NextResponse } from "next/server";
import { fal } from "@/lib/fal";
import { safeError } from "@/lib/api-helpers";

const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB
const ALLOWED_TYPES = [
  // Video
  "video/mp4",
  "video/quicktime",
  "video/webm",
  // Image
  "image/jpeg",
  "image/png",
  "image/webp",
  // Audio
  "audio/mpeg",
  "audio/wav",
  "audio/x-wav",
  "audio/ogg",
  "audio/mp4",
  "audio/x-m4a",
  "audio/flac",
  "audio/webm",
];

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `File too large. Maximum size is ${MAX_FILE_SIZE / (1024 * 1024)}MB` },
        { status: 400 }
      );
    }

    // Validate file type
    if (file.type && !ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: `File type not allowed: ${file.type}` },
        { status: 400 }
      );
    }

    // Upload to fal.ai storage — returns a CDN URL
    const url = await fal.storage.upload(file);

    return NextResponse.json({ url });
  } catch (err) {
    return safeError(err, "File upload error");
  }
}
