import { NextResponse } from "next/server";
import { safeError } from "@/lib/api-helpers";
import { cacheGet, cacheSet } from "@/lib/redis";

const BALANCE_CACHE_KEY = "cache:fal:balance";
const BALANCE_CACHE_TTL = 60; // 60 seconds

export async function GET() {
  try {
    // Check cache first
    const cached = await cacheGet<number>(BALANCE_CACHE_KEY);
    if (cached !== null) {
      return NextResponse.json({ balance: cached });
    }

    const res = await fetch("https://rest.fal.ai/billing/balance", {
      headers: {
        Authorization: `Key ${process.env.FAL_API_KEY}`,
      },
      signal: AbortSignal.timeout(15_000),
    });

    if (!res.ok) {
      return NextResponse.json({ balance: null });
    }

    const data = await res.json();
    const balance = data.balance || 0;

    // Cache the balance
    await cacheSet(BALANCE_CACHE_KEY, balance, BALANCE_CACHE_TTL);

    return NextResponse.json({ balance });
  } catch (err) {
    return safeError(err, "Balance fetch error");
  }
}
