import { FILE_UPLOAD_LIMITS } from "./validation";

export interface FileValidationResult {
  valid: boolean;
  error?: string;
}

export async function validateAudioUpload(
  file: File
): Promise<FileValidationResult> {
  // 1. Check file exists and is non-empty
  if (file.size === 0) {
    return { valid: false, error: "File is empty" };
  }

  // 2. Check file size
  if (file.size > FILE_UPLOAD_LIMITS.MAX_AUDIO_SIZE) {
    const maxMB = FILE_UPLOAD_LIMITS.MAX_AUDIO_SIZE / (1024 * 1024);
    return { valid: false, error: `File too large. Maximum size is ${maxMB}MB` };
  }

  // 3. Check MIME type
  if (
    file.type &&
    !(FILE_UPLOAD_LIMITS.ALLOWED_AUDIO_TYPES as readonly string[]).includes(file.type)
  ) {
    return {
      valid: false,
      error: `Invalid file type: ${file.type}. Allowed: ${FILE_UPLOAD_LIMITS.ALLOWED_AUDIO_TYPES.join(", ")}`,
    };
  }

  // 4. Check file extension
  const ext = "." + (file.name.split(".").pop()?.toLowerCase() ?? "");
  if (!(FILE_UPLOAD_LIMITS.ALLOWED_AUDIO_EXTENSIONS as readonly string[]).includes(ext)) {
    return { valid: false, error: `Invalid file extension: ${ext}` };
  }

  // 5. Validate magic bytes (prevents MIME spoofing — renaming .exe to .mp3)
  const buffer = await file.slice(0, 12).arrayBuffer();
  const bytes = new Uint8Array(buffer);

  const isValidMagic =
    // MP3 frame sync (0xFF 0xFB/F3/F2/E0+)
    (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0) ||
    // ID3 tag (MP3 with metadata)
    (bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33) ||
    // WAV (RIFF header)
    (bytes[0] === 0x52 &&
      bytes[1] === 0x49 &&
      bytes[2] === 0x46 &&
      bytes[3] === 0x46) ||
    // OGG (OggS)
    (bytes[0] === 0x4f &&
      bytes[1] === 0x67 &&
      bytes[2] === 0x67 &&
      bytes[3] === 0x53) ||
    // FLAC
    (bytes[0] === 0x66 &&
      bytes[1] === 0x4c &&
      bytes[2] === 0x61 &&
      bytes[3] === 0x43) ||
    // M4A/MP4 (ftyp at offset 4)
    (bytes[4] === 0x66 &&
      bytes[5] === 0x74 &&
      bytes[6] === 0x79 &&
      bytes[7] === 0x70) ||
    // WebM (EBML header 0x1A45DFA3)
    (bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3);

  if (!isValidMagic) {
    return {
      valid: false,
      error:
        "File content does not match expected audio format (magic bytes mismatch)",
    };
  }

  return { valid: true };
}
