import { NextRequest, NextResponse } from "next/server";

/**
 * Proxy route for client-side fal.ai SDK requests.
 *
 * The fal client sends requests here with an `x-fal-target-url` header
 * containing the actual fal.ai API URL. We forward the request with
 * the server-side API key attached, keeping it secret from the browser.
 *
 * Only small JSON requests come through here (e.g. storage upload
 * initiation). The actual file upload uses a presigned URL and goes
 * directly from the browser to fal.ai's CDN.
 */

const ALLOWED_HOSTS = [
  "fal.ai",
  "rest.fal.ai",
  "queue.fal.run",
  "fal.run",
];

function isAllowedTarget(url: string): boolean {
  try {
    const parsed = new URL(url);
    return ALLOWED_HOSTS.some(
      (host) =>
        parsed.hostname === host || parsed.hostname.endsWith(`.${host}`)
    );
  } catch {
    return false;
  }
}

async function handler(req: NextRequest) {
  const targetUrl = req.headers.get("x-fal-target-url");

  if (!targetUrl) {
    return NextResponse.json(
      { error: "Missing x-fal-target-url header" },
      { status: 400 }
    );
  }

  if (!isAllowedTarget(targetUrl)) {
    return NextResponse.json(
      { error: "Target URL not allowed" },
      { status: 403 }
    );
  }

  const apiKey = process.env.FAL_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "FAL_API_KEY not configured" },
      { status: 500 }
    );
  }

  // Forward headers (exclude host/connection-level headers)
  const headers = new Headers();
  headers.set("Authorization", `Key ${apiKey}`);
  headers.set("Content-Type", req.headers.get("content-type") || "application/json");
  headers.set("Accept", "application/json");

  // Forward fal-specific headers
  const falHeaders = [
    "x-fal-object-lifecycle",
    "x-fal-object-lifecycle-preference",
    "user-agent",
  ];
  for (const h of falHeaders) {
    const val = req.headers.get(h);
    if (val) headers.set(h, val);
  }

  try {
    const body = req.method !== "GET" ? await req.text() : undefined;

    const response = await fetch(targetUrl, {
      method: req.method,
      headers,
      body,
    });

    const responseBody = await response.text();
    const contentType = response.headers.get("content-type") || "application/json";

    // If the upstream returned an error with JSON body, ensure it has a
    // `message` field so the fal SDK can extract a meaningful error.
    if (!response.ok && contentType.includes("application/json")) {
      try {
        const parsed = JSON.parse(responseBody);
        if (!parsed.message) {
          parsed.message =
            parsed.detail || parsed.error || `HTTP ${response.status}: ${response.statusText}`;
          return new NextResponse(JSON.stringify(parsed), {
            status: response.status,
            statusText: response.statusText,
            headers: { "Content-Type": "application/json" },
          });
        }
      } catch {
        // not valid JSON, pass through
      }
    }

    return new NextResponse(responseBody, {
      status: response.status,
      statusText: response.statusText,
      headers: { "Content-Type": contentType },
    });
  } catch (err) {
    console.error("Fal proxy error:", err);
    return NextResponse.json(
      { error: "Proxy request failed" },
      { status: 502 }
    );
  }
}

export const GET = handler;
export const POST = handler;
export const PUT = handler;
