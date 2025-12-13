import { NextResponse } from "next/server";
import { lambdaGetUsers } from "@/lib/usersLambda";

export async function GET() {
  try {
    const payload = await lambdaGetUsers();
    return NextResponse.json(payload);
  } catch {
    return NextResponse.json(
      { error: "User service is unavailable" },
      { status: 502 }
    );
  }
}

