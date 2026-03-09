import { fal } from "@fal-ai/client";

fal.config({
  credentials: process.env.FAL_API_KEY,
});

export async function submitFalJob(modelId: string, input: Record<string, unknown>) {
  const { request_id } = await fal.queue.submit(modelId, { input });
  return request_id;
}

export async function getFalResult(modelId: string, requestId: string) {
  const result = await fal.queue.result(modelId, { requestId });
  return result;
}

export async function getFalStatus(modelId: string, requestId: string) {
  const status = await fal.queue.status(modelId, { requestId, logs: true });
  return status;
}

export { fal };
