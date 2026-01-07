import { NextResponse } from "next/server";
import { getUsers } from "@/lib/usersDb";

export async function GET() {
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

