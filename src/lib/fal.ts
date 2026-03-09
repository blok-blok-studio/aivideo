import { fal } from "@fal-ai/client";

fal.config({
  credentials: process.env.FAL_API_KEY,
});

/**
 * Submit a job to fal.ai queue and return both request_id and response_url.
 * The response_url is the correct URL to fetch results from once the job completes.
 */
export async function submitFalJob(modelId: string, input: Record<string, unknown>) {
  const result = await fal.queue.submit(modelId, { input });
  const request_id = result.request_id;
  // The submit response includes response_url with the full model path
  const response_url = (result as unknown as Record<string, unknown>).response_url as string | undefined;

  console.log(`[submitFalJob] model=${modelId} request_id=${request_id} response_url=${response_url?.slice(0, 100)}`);

  return { request_id, response_url };
}

/**
 * Fetch the result of a completed fal.ai job.
 * Tries multiple strategies:
 * 1. Use responseUrl (from submit or status response) — most reliable
 * 2. Fall back to SDK's queue.result()
 * 3. Fall back to direct fetch with shortened path
 */
export async function getFalResult(
  modelId: string,
  requestId: string,
  responseUrl?: string | null
) {
  const apiKey = process.env.FAL_API_KEY;

  // Strategy 1: Use response_url if available (most reliable — includes full model path)
  if (responseUrl) {
    console.log(`[getFalResult] Strategy 1: Using response_url: ${responseUrl.slice(0, 100)}`);
    try {
      const response = await fetch(responseUrl, {
        method: "GET",
        headers: {
          Authorization: `Key ${apiKey}`,
          Accept: "application/json",
        },
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

  // Strategy 2: Use SDK's queue.result() — strips path but should work for most models
  console.log(`[getFalResult] Strategy 2: Using SDK queue.result() for ${modelId}`);
  try {
    const result = await fal.queue.result(modelId, { requestId });
    const data = (result as unknown as Record<string, unknown>).data ?? result;
    console.log(`[getFalResult] Strategy 2 succeeded, keys: ${Object.keys(data as Record<string, unknown>).join(", ")}`);
    return { data, requestId };
  } catch (err) {
    console.warn(`[getFalResult] Strategy 2 error:`, err instanceof Error ? err.message : err);
  }

  // Strategy 3: Direct fetch with full model path (different URL patterns)
  const urls = [
    `https://queue.fal.run/${modelId}/requests/${requestId}`,
    `https://fal.run/${modelId}/requests/${requestId}`,
  ];

  for (const url of urls) {
    console.log(`[getFalResult] Strategy 3: Direct fetch: ${url.slice(0, 100)}`);
    try {
      const response = await fetch(url, {
        method: "GET",
        headers: {
          Authorization: `Key ${apiKey}`,
          Accept: "application/json",
        },
      });

      if (response.ok) {
        const data = await response.json();
        console.log(`[getFalResult] Strategy 3 succeeded for ${url.slice(0, 60)}, keys: ${Object.keys(data).join(", ")}`);
        return { data, requestId };
      }

      const text = await response.text().catch(() => "");
      console.warn(`[getFalResult] Strategy 3 failed for ${url.slice(0, 60)}: HTTP ${response.status}: ${text.slice(0, 200)}`);
    } catch (err) {
      console.warn(`[getFalResult] Strategy 3 error for ${url.slice(0, 60)}:`, err instanceof Error ? err.message : err);
    }
  }

  throw new Error(`All strategies failed to fetch result for request ${requestId}`);
}

export async function getFalStatus(modelId: string, requestId: string) {
  const status = await fal.queue.status(modelId, { requestId, logs: true });
  return status;
}

export { fal };
