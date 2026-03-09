"use client";

import { createFalClient } from "@fal-ai/client";

/**
 * Client-side fal.ai instance.
 *
 * Uses proxyUrl so all authenticated requests (like storage initiation)
 * go through /api/fal/proxy where the API key is added server-side.
 *
 * File uploads use presigned URLs and go directly from the browser
 * to fal.ai's CDN — they never pass through our server, so there's
 * no Vercel body size limit issue.
 */
export const falClient = createFalClient({
  proxyUrl: "/api/fal/proxy",
});
