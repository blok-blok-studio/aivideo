import { NextRequest, NextResponse } from "next/server";
import { submitFalJob } from "@/lib/fal";
import { prisma } from "@/lib/db";
import { validateBody, safeError } from "@/lib/api-helpers";
import { motionDesignSchema } from "@/lib/validation";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const result = validateBody(motionDesignSchema, body);
    if (!result.success) return result.response;

    const {
      model_id, mode, prompt, image_url, video_url,
      aspect_ratio, duration, resolution, audio,
      negative_prompt, cfg_scale, seed,
    } = result.data;

    const job = await prisma.job.create({
      data: {
        section: "motion-design",
        modelId: model_id,
        modelName: model_id.split("/").pop() || model_id,
        status: "queued",
        inputParams: {
          mode, prompt, image_url, video_url,
          aspect_ratio, duration, resolution, audio,
          negative_prompt, cfg_scale, seed,
        },
      },
    });

    try {
      const input: Record<string, unknown> = { prompt };
      if (image_url) input.image_url = image_url;
      if (video_url) input.video_url = video_url;
      if (aspect_ratio) input.aspect_ratio = aspect_ratio;
      if (duration) input.duration = duration;
      if (negative_prompt) input.negative_prompt = negative_prompt;
      if (cfg_scale !== undefined) input.cfg_scale = cfg_scale;
      if (seed !== undefined) input.seed = seed;

      const { request_id, response_url } = await submitFalJob(model_id, input);

      await prisma.job.update({
        where: { id: job.id },
        data: {
          status: "processing",
          falRequestId: request_id,
          falResponseUrl: response_url || null,
        },
      });
    } catch (falErr) {
      await prisma.job.update({
        where: { id: job.id },
        data: {
          status: "failed",
          errorMsg: falErr instanceof Error ? falErr.message : "fal.ai submission failed",
        },
      });
    }

    return NextResponse.json({ jobId: job.id });
  } catch (err) {
    return safeError(err, "Motion design error");
  }
}
