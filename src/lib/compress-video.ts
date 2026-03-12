"use client";

/**
 * Compress a video file using browser-native Canvas + MediaRecorder.
 * Downscales resolution and re-encodes at a target bitrate to reduce file size.
 * Falls back to the original file if compression fails or isn't needed.
 */

const TARGET_MAX_SIZE = 45 * 1024 * 1024; // 45MB (under Pixverse's 50MB limit)
const MAX_HEIGHT = 720; // Downscale to 720p max — AI models don't need higher
const TARGET_FPS = 24;

export interface CompressProgress {
  phase: "analyzing" | "compressing" | "finalizing";
  percent: number;
}

export async function compressVideo(
  file: File,
  options: {
    maxSizeBytes?: number;
    maxHeight?: number;
    onProgress?: (progress: CompressProgress) => void;
  } = {}
): Promise<File> {
  const {
    maxSizeBytes = TARGET_MAX_SIZE,
    maxHeight = MAX_HEIGHT,
    onProgress,
  } = options;

  // Skip if already under limit
  if (file.size <= maxSizeBytes) {
    return file;
  }

  onProgress?.({ phase: "analyzing", percent: 0 });

  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.preload = "auto";

    const url = URL.createObjectURL(file);

    video.onloadedmetadata = async () => {
      try {
        const { videoWidth, videoHeight, duration } = video;

        // Calculate target dimensions (downscale to maxHeight, preserve aspect ratio)
        let targetWidth = videoWidth;
        let targetHeight = videoHeight;
        if (targetHeight > maxHeight) {
          const ratio = maxHeight / targetHeight;
          targetWidth = Math.round(videoWidth * ratio);
          targetHeight = maxHeight;
        }
        // Ensure even dimensions (required by some codecs)
        targetWidth = targetWidth - (targetWidth % 2);
        targetHeight = targetHeight - (targetHeight % 2);

        // Calculate target bitrate to hit file size limit
        // bitrate (bps) = targetSize (bits) / duration (s) — with 20% safety margin
        const targetBitrate = Math.min(
          Math.floor((maxSizeBytes * 8 * 0.8) / duration),
          5_000_000 // Cap at 5Mbps — plenty for AI processing
        );

        console.log(
          `[compressVideo] ${file.name}: ${videoWidth}x${videoHeight} ${duration.toFixed(1)}s ${(file.size / 1024 / 1024).toFixed(1)}MB → target ${targetWidth}x${targetHeight} @ ${(targetBitrate / 1_000_000).toFixed(1)}Mbps`
        );

        onProgress?.({ phase: "compressing", percent: 5 });

        // Set up canvas for rendering frames
        const canvas = document.createElement("canvas");
        canvas.width = targetWidth;
        canvas.height = targetHeight;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(file); // fallback
          return;
        }

        // Check MediaRecorder support
        const mimeTypes = [
          "video/webm;codecs=vp9",
          "video/webm;codecs=vp8",
          "video/webm",
        ];
        const mimeType = mimeTypes.find((m) => MediaRecorder.isTypeSupported(m));
        if (!mimeType) {
          console.warn("[compressVideo] No supported video codec, using original");
          resolve(file);
          return;
        }

        // Capture the canvas as a stream
        const stream = canvas.captureStream(TARGET_FPS);
        const recorder = new MediaRecorder(stream, {
          mimeType,
          videoBitsPerSecond: targetBitrate,
        });

        const chunks: Blob[] = [];
        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) chunks.push(e.data);
        };

        recorder.onstop = () => {
          URL.revokeObjectURL(url);
          const blob = new Blob(chunks, { type: mimeType.split(";")[0] });

          if (blob.size >= file.size) {
            console.log(`[compressVideo] Compressed larger than original, using original`);
            resolve(file);
            return;
          }

          const ext = mimeType.includes("webm") ? ".webm" : ".mp4";
          const compressed = new File(
            [blob],
            file.name.replace(/\.\w+$/, ext),
            { type: mimeType.split(";")[0], lastModified: Date.now() }
          );

          console.log(
            `[compressVideo] ${(file.size / 1024 / 1024).toFixed(1)}MB → ${(compressed.size / 1024 / 1024).toFixed(1)}MB (${((1 - compressed.size / file.size) * 100).toFixed(0)}% reduction)`
          );

          onProgress?.({ phase: "finalizing", percent: 100 });
          resolve(compressed);
        };

        recorder.onerror = () => {
          URL.revokeObjectURL(url);
          resolve(file); // fallback on error
        };

        // Play video and draw frames to canvas
        recorder.start(100); // collect data every 100ms
        video.currentTime = 0;

        const drawFrame = () => {
          if (video.ended || video.paused) {
            recorder.stop();
            return;
          }

          ctx.drawImage(video, 0, 0, targetWidth, targetHeight);

          const pct = Math.min(95, Math.round((video.currentTime / duration) * 90) + 5);
          onProgress?.({ phase: "compressing", percent: pct });

          requestAnimationFrame(drawFrame);
        };

        video.onended = () => {
          // Draw last frame and stop
          ctx.drawImage(video, 0, 0, targetWidth, targetHeight);
          setTimeout(() => recorder.stop(), 200);
        };

        video.onplay = () => drawFrame();

        // Set playback rate to max for faster processing
        video.playbackRate = 16;
        video.play().catch(() => {
          URL.revokeObjectURL(url);
          resolve(file); // fallback
        });
      } catch (err) {
        URL.revokeObjectURL(url);
        console.error("[compressVideo] Error:", err);
        resolve(file); // fallback
      }
    };

    video.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(file); // fallback
    };

    video.src = url;
  });
}
