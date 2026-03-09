import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/auth";
import { z } from "zod";
import { validateBody, safeError } from "@/lib/api-helpers";

const registerSchema = z.object({
  email: z.string().email("Invalid email"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  name: z.string().min(1).max(100).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const result = validateBody(registerSchema, body);
    if (!result.success) return result.response;

    const { email, password, name } = result.data;

    // Check if user exists
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json(
        { error: "Email already registered" },
        { status: 409 }
      );
    }

    const passwordHash = await hashPassword(password);

    // First user gets "owner" role
    const userCount = await prisma.user.count();
    const role = userCount === 0 ? "owner" : "member";

    const user = await prisma.user.create({
      data: { email, passwordHash, name, role },
      select: { id: true, email: true, name: true, role: true },
    });

    return NextResponse.json({ user }, { status: 201 });
  } catch (err) {
    return safeError(err, "Registration error");
  }
}
