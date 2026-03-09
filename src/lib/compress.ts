"use client";

/**
 * Compress an image file using canvas before uploading.
 * Resizes to maxDimension (preserving aspect ratio) and converts to JPEG.
 * Returns the original file unchanged if it's already small enough.
 */
export async function compressImage(
  file: File,
  options: {
    maxDimension?: number;
    quality?: number;
    skipIfUnder?: number; // bytes — skip compression if file is already smaller
  } = {}
): Promise<File> {
  const {
    maxDimension = 2048,
    quality = 0.88,
    skipIfUnder = 500 * 1024, // 500KB
  } = options;

  // Skip if already small
  if (file.size < skipIfUnder) {
    return file;
  }

  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);

      let { width, height } = img;

      // Skip resize if already within bounds
      if (width <= maxDimension && height <= maxDimension && file.size < skipIfUnder) {
        resolve(file);
        return;
      }

      // Calculate new dimensions preserving aspect ratio
      if (width > maxDimension || height > maxDimension) {
        const ratio = Math.min(maxDimension / width, maxDimension / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext("2d");
      if (!ctx) {
        resolve(file); // fallback to original
        return;
      }

      // Use high-quality downscaling
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          if (!blob || blob.size >= file.size) {
            // Compressed version is larger — use original
            resolve(file);
            return;
          }

          const compressed = new File([blob], file.name.replace(/\.\w+$/, ".jpg"), {
            type: "image/jpeg",
            lastModified: Date.now(),
          });

          console.log(
            `[compress] ${file.name}: ${(file.size / 1024).toFixed(0)}KB → ${(compressed.size / 1024).toFixed(0)}KB (${width}x${height}, q=${quality})`
          );

          resolve(compressed);
        },
        "image/jpeg",
        quality
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(file); // fallback to original on error
    };

    img.src = url;
  });
}
