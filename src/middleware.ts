import { NextRequest, NextResponse } from "next/server";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

// ── Redis + rate limiters (Edge-compatible, instantiated directly) ──
const redis = Redis.fromEnv();

const generationLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(5, "1 m"),
  prefix: "rl:gen",
});

const computeLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(10, "1 m"),
  prefix: "rl:compute",
});

const readLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(60, "1 m"),
  prefix: "rl:read",
});

const sensitiveLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(10, "1 m"),
  prefix: "rl:sensitive",
});

const dailyGenerationLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(100, "1 d"),
  prefix: "rl:daily-gen",
});

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

// ── Route → rate limit tier mapping ──
function getLimiter(
  pathname: string,
  method: string
): Ratelimit | null {
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
  if (
    origin &&
    ALLOWED_ORIGINS.length > 0 &&
    !ALLOWED_ORIGINS.includes(origin)
  ) {
    return applyHeaders(
      NextResponse.json({ error: "Forbidden origin" }, { status: 403 })
    );
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
  const serverApiKey = process.env.SERVER_API_KEY;
  if (serverApiKey) {
    const authHeader = request.headers.get("authorization");
    const providedKey = authHeader?.replace("Bearer ", "");
    if (providedKey !== serverApiKey) {
      return applyHeaders(
        NextResponse.json({ error: "Unauthorized" }, { status: 401 })
      );
    }
  }

  // ── Rate limiting ──
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
      if (needsDailyLimit(pathname, method)) {
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
