import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { requireAuth } from "@/lib/auth/requireAuth";

export async function POST(req: NextRequest) {
    const auth = await requireAuth();
    if (!auth.ok) {
        return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const cookieStore = await cookies();
    cookieStore.delete("session");

    return NextResponse.json({ success: true });
}
