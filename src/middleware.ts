import { NextRequest, NextResponse } from "next/server";

// ── Security headers ──
const SECURITY_HEADERS: Record<string, string> = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "X-XSS-Protection": "1; mode=block",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy":
    "camera=(), microphone=(), geolocation=(), interest-cohort=()",
  "Strict-Transport-Security":
    "max-age=63072000; includeSubDomains; preload",
  "X-DNS-Prefetch-Control": "off",
};

// ── Lazy-loaded Redis + rate limiters ──
// Only initialized when Upstash env vars are present.
// If not configured, rate limiting is skipped (requests still go through).
let rateLimitersInitialized = false;
let generationLimiter: import("@upstash/ratelimit").Ratelimit | null = null;
let computeLimiter: import("@upstash/ratelimit").Ratelimit | null = null;
let readLimiter: import("@upstash/ratelimit").Ratelimit | null = null;
let sensitiveLimiter: import("@upstash/ratelimit").Ratelimit | null = null;
let dailyGenerationLimiter: import("@upstash/ratelimit").Ratelimit | null = null;

function initRateLimiters() {
  if (rateLimitersInitialized) return;
  rateLimitersInitialized = true;

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    console.warn("Upstash Redis not configured — rate limiting disabled");
    return;
  }

  try {
    const { Redis } = require("@upstash/redis") as typeof import("@upstash/redis");
    const { Ratelimit } = require("@upstash/ratelimit") as typeof import("@upstash/ratelimit");

    const redis = new Redis({ url, token });

    generationLimiter = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(5, "1 m"),
      prefix: "rl:gen",
    });
    computeLimiter = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(10, "1 m"),
      prefix: "rl:compute",
    });
    readLimiter = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(60, "1 m"),
      prefix: "rl:read",
    });
    sensitiveLimiter = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(10, "1 m"),
      prefix: "rl:sensitive",
    });
    dailyGenerationLimiter = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(100, "1 d"),
      prefix: "rl:daily-gen",
    });
  } catch (err) {
    console.error("Failed to initialize rate limiters:", err);
  }
}

// ── Route → rate limit tier mapping ──
function getLimiter(pathname: string, method: string) {
  if (
    (pathname.startsWith("/api/generate/") && method === "POST") ||
    (pathname === "/api/voiceover/generate" && method === "POST")
  ) {
    return generationLimiter;
  }
  if (
    pathname === "/api/voiceover/clone" ||
    pathname === "/api/voiceover/merge" ||
    pathname === "/api/voiceover/match" ||
    (pathname.match(/^\/api\/voices\/custom\/[^/]+$/) && method === "DELETE")
  ) {
    return computeLimiter;
  }
  if (pathname === "/api/balance") return sensitiveLimiter;
  if (pathname.startsWith("/api/")) return readLimiter;
  return null;
}

function needsDailyLimit(pathname: string, method: string): boolean {
  return (
    (pathname.startsWith("/api/generate/") && method === "POST") ||
    (pathname === "/api/voiceover/generate" && method === "POST") ||
    (pathname === "/api/voiceover/clone" && method === "POST")
  );
}

function getClientIP(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown"
  );
}

function applyHeaders(
  response: NextResponse,
  extra?: Record<string, string>
): NextResponse {
  for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
    response.headers.set(key, value);
  }
  if (extra) {
    for (const [key, value] of Object.entries(extra)) {
      response.headers.set(key, value);
    }
  }
  return response;
}

// ── CORS ──
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || "")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const method = request.method;

  // Non-API routes: just apply security headers
  if (!pathname.startsWith("/api/")) {
    return applyHeaders(NextResponse.next());
  }

  // ── CORS enforcement ──
  const origin = request.headers.get("origin");
  if (origin) {
    // Allow same-origin requests (the app's own browser requests)
    const requestHost = request.headers.get("host") || request.nextUrl.host;
    const isSameOrigin =
      origin === `https://${requestHost}` || origin === `http://${requestHost}`;

    if (!isSameOrigin) {
      // If ALLOWED_ORIGINS is configured, check against it
      if (ALLOWED_ORIGINS.length > 0 && !ALLOWED_ORIGINS.includes(origin)) {
        return applyHeaders(
          NextResponse.json({ error: "Forbidden origin" }, { status: 403 })
        );
      }
      // If ALLOWED_ORIGINS is not configured, deny unknown cross-origin requests in production
      if (ALLOWED_ORIGINS.length === 0 && process.env.NODE_ENV === "production") {
        return applyHeaders(
          NextResponse.json({ error: "Forbidden origin" }, { status: 403 })
        );
      }
    }
  }

  // Preflight
  if (method === "OPTIONS") {
    const res = new NextResponse(null, { status: 204 });
    if (origin) {
      res.headers.set("Access-Control-Allow-Origin", origin);
      res.headers.set(
        "Access-Control-Allow-Methods",
        "GET, POST, DELETE, OPTIONS"
      );
      res.headers.set(
        "Access-Control-Allow-Headers",
        "Content-Type, Authorization"
      );
      res.headers.set("Access-Control-Max-Age", "86400");
    }
    return applyHeaders(res);
  }

  // ── Authentication (Bearer token) ──
  // Skip auth for the fal proxy route (called from browser, handles its own auth)
  const skipAuth = pathname.startsWith("/api/fal/proxy");
  if (!skipAuth) {
    const serverApiKey = process.env.SERVER_API_KEY;
    if (!serverApiKey) {
      // In production, require SERVER_API_KEY to be set
      if (process.env.NODE_ENV === "production") {
        return applyHeaders(
          NextResponse.json(
            { error: "Server misconfigured" },
            { status: 503 }
          )
        );
      }
      // In development, warn but allow through
      console.warn("SERVER_API_KEY not set — API routes are unprotected");
    } else {
      const authHeader = request.headers.get("authorization");
      const providedKey = authHeader?.replace("Bearer ", "");
      if (providedKey !== serverApiKey) {
        return applyHeaders(
          NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        );
      }
    }
  }

  // ── Rate limiting (lazy init — skipped if Upstash not configured) ──
  initRateLimiters();
  const clientIP = getClientIP(request);
  const limiter = getLimiter(pathname, method);

  if (limiter) {
    try {
      const result = await limiter.limit(clientIP);
      if (!result.success) {
        const retryAfter = Math.ceil((result.reset - Date.now()) / 1000);
        return applyHeaders(
          NextResponse.json(
            { error: "Rate limit exceeded. Please try again later." },
            { status: 429 }
          ),
          {
            "X-RateLimit-Limit": result.limit.toString(),
            "X-RateLimit-Remaining": "0",
            "X-RateLimit-Reset": result.reset.toString(),
            "Retry-After": Math.max(retryAfter, 1).toString(),
          }
        );
      }

      // Daily cap for generation routes
      if (needsDailyLimit(pathname, method) && dailyGenerationLimiter) {
        const dailyResult = await dailyGenerationLimiter.limit(clientIP);
        if (!dailyResult.success) {
          return applyHeaders(
            NextResponse.json(
              {
                error:
                  "Daily generation limit exceeded. Maximum 100 generations per day.",
              },
              { status: 429 }
            ),
            {
              "X-RateLimit-Limit": dailyResult.limit.toString(),
              "X-RateLimit-Remaining": "0",
              "Retry-After": Math.ceil(
                (dailyResult.reset - Date.now()) / 1000
              ).toString(),
            }
          );
        }
      }

      // Attach rate limit info to successful response
      const response = NextResponse.next();
      response.headers.set("X-RateLimit-Limit", result.limit.toString());
      response.headers.set(
        "X-RateLimit-Remaining",
        result.remaining.toString()
      );
      response.headers.set("X-RateLimit-Reset", result.reset.toString());

      if (origin) {
        response.headers.set("Access-Control-Allow-Origin", origin);
      }

      return applyHeaders(response);
    } catch {
      // If Redis is down, fail open (allow request but log)
      console.error("Rate limiter unavailable — allowing request");
    }
  }

  const response = NextResponse.next();
  if (origin) {
    response.headers.set("Access-Control-Allow-Origin", origin);
  }
  return applyHeaders(response);
}

export const config = {
  matcher: [
    "/api/:path*",
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
