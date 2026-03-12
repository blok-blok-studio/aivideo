import { fal } from "@fal-ai/client";

fal.config({
  credentials: process.env.FAL_API_KEY,
});

// Vercel Hobby has a 10s function timeout. Keep individual HTTP calls under 8s
// so the whole request (DB + status + result) fits in ~10s.
const FAL_TIMEOUT_MS = 8_000;

/**
 * Try to extract a human-readable error from a fal.ai error response body.
 */
function parseFalError(body: string): string {
  try {
    const parsed = JSON.parse(body);
    // fal.ai validation errors: { detail: [{ msg: "..." }] }
    if (Array.isArray(parsed.detail)) {
      return parsed.detail.map((d: { msg?: string }) => d.msg || "").filter(Boolean).join("; ");
    }
    // fal.ai simple errors: { detail: "..." }
    if (typeof parsed.detail === "string") return parsed.detail;
    // Other shapes
    if (parsed.message) return parsed.message;
    if (parsed.error) return parsed.error;
  } catch {
    // not JSON
  }
  return body.slice(0, 200);
}

/**
 * For nested model paths like "fal-ai/pixverse/swap", fal.ai queues under
 * the parent path "fal-ai/pixverse". This strips trailing sub-endpoints
 * to get the correct queue base path for fallback URL construction.
 *
 * Known nested models: fal-ai/pixverse/swap, fal-ai/pixverse/v4/...
 */
function getQueueModelId(modelId: string): string {
  const parts = modelId.split("/");
  // "fal-ai/pixverse/swap" → 3 parts → use "fal-ai/pixverse"
  // "fal-ai/kling-video/..." → 3 parts → use "fal-ai/kling-video"
  // "fal-ai/pixverse" → 2 parts → use as-is
  if (parts.length > 2) {
    return parts.slice(0, 2).join("/");
  }
  return modelId;
}

/**
 * Submit a job to fal.ai queue and return request_id, response_url, and status_url.
 *
 * IMPORTANT: fal.ai may return status/response URLs with a different base path than
 * the submission endpoint. For example, submitting to "fal-ai/pixverse/swap" returns
 * status URLs under "fal-ai/pixverse" (without /swap). Always use the returned URLs
 * rather than constructing them from the model ID.
 */
export async function submitFalJob(modelId: string, input: Record<string, unknown>) {
  const result = await fal.queue.submit(modelId, { input });

  // The SDK types guarantee these fields exist on InQueueQueueStatus.
  // Access them directly — no need to cast through unknown.
  const request_id = result.request_id;
  const response_url = result.response_url;
  const status_url = result.status_url;

  console.log(`[submitFalJob] model=${modelId} request_id=${request_id}`);
  console.log(`[submitFalJob] response_url=${response_url || "MISSING"}`);
  console.log(`[submitFalJob] status_url=${status_url || "MISSING"}`);
  console.log(`[submitFalJob] full result keys=${Object.keys(result).join(",")}`);

  return { request_id, response_url, status_url };
}

/**
 * Check fal.ai queue status using direct HTTP (with timeout).
 * Prefers the status_url returned by fal.ai at submission time, since the
 * queue base path can differ from the submission endpoint (e.g. pixverse/swap
 * submits to fal-ai/pixverse/swap but queues under fal-ai/pixverse).
 */
export async function getFalStatus(modelId: string, requestId: string, statusUrl?: string | null) {
  const apiKey = process.env.FAL_API_KEY;

  // Use saved status_url first; fallback uses the queue model ID (parent path)
  const queueModelId = getQueueModelId(modelId);
  const url = statusUrl
    ? `${statusUrl}${statusUrl.includes("?") ? "&" : "?"}logs=1`
    : `https://queue.fal.run/${queueModelId}/requests/${requestId}/status?logs=1`;

  console.log(`[getFalStatus] url=${url}`);
  console.log(`[getFalStatus] statusUrl=${statusUrl ? "PROVIDED" : "NOT PROVIDED"}, queueModelId=${queueModelId} (original: ${modelId})`);

  const response = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Key ${apiKey}`,
      Accept: "application/json",
    },
    signal: AbortSignal.timeout(FAL_TIMEOUT_MS),
  });

  console.log(`[getFalStatus] response: HTTP ${response.status}`);

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    console.error(`[getFalStatus] FAILED: HTTP ${response.status} body=${text.slice(0, 300)}`);
    throw new Error(`Status check failed: HTTP ${response.status} ${parseFalError(text)}`);
  }

  const data = await response.json();
  console.log(`[getFalStatus] SUCCESS: status=${data.status} keys=${Object.keys(data).join(",")}`);
  return data;
}

/**
 * Fetch the result of a completed fal.ai job.
 * Tries response_url first (most reliable), then SDK, then direct fetch.
 * Surfaces the actual fal.ai error message on failure (not just "strategies failed").
 */
export async function getFalResult(
  modelId: string,
  requestId: string,
  responseUrl?: string | null
) {
  const apiKey = process.env.FAL_API_KEY;
  let lastError = "";

  // Strategy 1: Use response_url if available
  if (responseUrl) {
    console.log(`[getFalResult] Strategy 1: response_url: ${responseUrl.slice(0, 100)}`);
    try {
      const response = await fetch(responseUrl, {
        method: "GET",
        headers: {
          Authorization: `Key ${apiKey}`,
          Accept: "application/json",
        },
        signal: AbortSignal.timeout(FAL_TIMEOUT_MS),
      });

      if (response.ok) {
        const data = await response.json();
        console.log(`[getFalResult] Strategy 1 succeeded, keys: ${Object.keys(data).join(", ")}`);
        return { data, requestId };
      }

      const text = await response.text().catch(() => "");
      lastError = parseFalError(text);
      console.warn(`[getFalResult] Strategy 1 failed: HTTP ${response.status}: ${lastError}`);

      // If fal.ai returned a clear error (422, 400), don't bother with other strategies
      if (response.status === 422 || response.status === 400) {
        throw new Error(lastError || `HTTP ${response.status}`);
      }
    } catch (err) {
      if (err instanceof Error && !err.message.includes("strategies failed")) {
        // Rethrow clear fal.ai errors (like file size limits)
        if (lastError) throw err;
      }
      console.warn(`[getFalResult] Strategy 1 error:`, err instanceof Error ? err.message : err);
    }
  }

  // Strategy 2: Direct fetch with corrected queue path
  const queueModelId = getQueueModelId(modelId);
  const url = `https://queue.fal.run/${queueModelId}/requests/${requestId}`;
  console.log(`[getFalResult] Strategy 2: ${url}`);
  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Key ${apiKey}`,
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(FAL_TIMEOUT_MS),
    });

    if (response.ok) {
      const data = await response.json();
      console.log(`[getFalResult] Strategy 2 succeeded`);
      return { data, requestId };
    }

    const text = await response.text().catch(() => "");
    const parsed = parseFalError(text);
    if (!lastError) lastError = parsed;
    console.warn(`[getFalResult] Strategy 2 failed: HTTP ${response.status}: ${parsed}`);
  } catch (err) {
    console.warn(`[getFalResult] Strategy 2 error:`, err instanceof Error ? err.message : err);
  }

  // Strategy 3: Use SDK's queue.result() as last resort
  console.log(`[getFalResult] Strategy 3: SDK queue.result() for ${modelId}`);
  try {
    const result = await fal.queue.result(modelId, { requestId });
    const data = (result as unknown as Record<string, unknown>).data ?? result;
    console.log(`[getFalResult] Strategy 3 succeeded`);
    return { data, requestId };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[getFalResult] Strategy 3 error:`, msg);
    if (!lastError) lastError = msg;
  }

  // Use the actual fal.ai error message instead of generic "all strategies failed"
  throw new Error(lastError || `Failed to fetch result for request ${requestId}`);
}

export { fal };
