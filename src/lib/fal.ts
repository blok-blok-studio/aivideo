import { fal } from "@fal-ai/client";

fal.config({
  credentials: process.env.FAL_API_KEY,
});

// Vercel Hobby has a 10s function timeout. Keep individual HTTP calls under 8s
// so the whole request (DB + status + result) fits in ~10s.
const FAL_TIMEOUT_MS = 8_000;

/**
 * Submit a job to fal.ai queue and return both request_id and response_url.
 */
export async function submitFalJob(modelId: string, input: Record<string, unknown>) {
  const result = await fal.queue.submit(modelId, { input });
  const request_id = result.request_id;
  const response_url = (result as unknown as Record<string, unknown>).response_url as string | undefined;

  console.log(`[submitFalJob] model=${modelId} request_id=${request_id} response_url=${response_url?.slice(0, 100)}`);

  return { request_id, response_url };
}

/**
 * Check fal.ai queue status using direct HTTP (with timeout).
 * The SDK's queue.status() doesn't support timeouts, which can hang
 * on Vercel's 10-second function limit.
 */
export async function getFalStatus(modelId: string, requestId: string) {
  const apiKey = process.env.FAL_API_KEY;

  // parseEndpointId logic: extract owner/alias (strip sub-path)
  const parts = modelId.split("/");
  const owner = parts[0];
  const alias = parts[1];
  const shortId = `${owner}/${alias}`;

  const url = `https://queue.fal.run/${shortId}/requests/${requestId}/status?logs=1`;

  const response = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Key ${apiKey}`,
      Accept: "application/json",
    },
    signal: AbortSignal.timeout(FAL_TIMEOUT_MS),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Status check failed: HTTP ${response.status} ${text.slice(0, 200)}`);
  }

  return response.json();
}

/**
 * Fetch the result of a completed fal.ai job.
 * Tries response_url first (most reliable), then SDK, then direct fetch.
 */
export async function getFalResult(
  modelId: string,
  requestId: string,
  responseUrl?: string | null
) {
  const apiKey = process.env.FAL_API_KEY;

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
      console.warn(`[getFalResult] Strategy 1 failed: HTTP ${response.status}: ${text.slice(0, 200)}`);
    } catch (err) {
      console.warn(`[getFalResult] Strategy 1 error:`, err instanceof Error ? err.message : err);
    }
  }

  // Strategy 2: Use SDK's queue.result()
  console.log(`[getFalResult] Strategy 2: SDK queue.result() for ${modelId}`);
  try {
    const result = await fal.queue.result(modelId, { requestId });
    const data = (result as unknown as Record<string, unknown>).data ?? result;
    console.log(`[getFalResult] Strategy 2 succeeded`);
    return { data, requestId };
  } catch (err) {
    console.warn(`[getFalResult] Strategy 2 error:`, err instanceof Error ? err.message : err);
  }

  // Strategy 3: Direct fetch with full model path
  const url = `https://queue.fal.run/${modelId}/requests/${requestId}`;
  console.log(`[getFalResult] Strategy 3: ${url.slice(0, 100)}`);
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
      console.log(`[getFalResult] Strategy 3 succeeded`);
      return { data, requestId };
    }

    const text = await response.text().catch(() => "");
    console.warn(`[getFalResult] Strategy 3 failed: HTTP ${response.status}: ${text.slice(0, 200)}`);
  } catch (err) {
    console.warn(`[getFalResult] Strategy 3 error:`, err instanceof Error ? err.message : err);
  }

  throw new Error(`All strategies failed to fetch result for request ${requestId}`);
}

export { fal };
