import { NextResponse } from "next/server";
import { safeError } from "@/lib/api-helpers";

export async function GET() {
  try {
    const res = await fetch("https://rest.fal.ai/billing/balance", {
      headers: {
        Authorization: `Key ${process.env.FAL_API_KEY}`,
      },
    });

    if (!res.ok) {
      return NextResponse.json({ balance: null });
    }

    const data = await res.json();
    return NextResponse.json({ balance: data.balance || 0 });
  } catch (err) {
    return safeError(err, "Balance fetch error");
  }
}
