import { NextResponse } from "next/server";
import { getUsers } from "@/lib/db/Users";
import { requireAdmin } from "@/lib/auth/requireAdmin";

export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json(
      { error: auth.error },
      { status: auth.status }
    );
  }

  try {
    const payload = await getUsers();
    return NextResponse.json(payload);
  } catch {
    return NextResponse.json(
      { error: "User service is unavailable" },
      { status: 502 }
    );
  }
}
