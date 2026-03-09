import { NextResponse } from "next/server";
import { DEFAULT_VOICES } from "@/lib/types";

export async function GET() {
  return NextResponse.json({ voices: DEFAULT_VOICES });
}
