import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { getSession } from "@/lib/session";
import { exchangeGoogleCode } from "@/lib/google-oauth";

const STATE_COOKIE_NAME = "google_oauth_state";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  const cookieStore = await cookies();
  const expectedState = cookieStore.get(STATE_COOKIE_NAME)?.value;
  cookieStore.delete(STATE_COOKIE_NAME);

  if (error || !code || !state || !expectedState || state !== expectedState) {
    return NextResponse.redirect(new URL("/sozlamalar?google=error", request.url));
  }

  const session = await getSession();
  if (!session) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  try {
    const tokens = await exchangeGoogleCode(code);

    if (!tokens.refresh_token) {
      return NextResponse.redirect(new URL("/sozlamalar?google=error", request.url));
    }

    await db
      .update(users)
      .set({ googleRefreshToken: tokens.refresh_token })
      .where(eq(users.id, session.userId));

    return NextResponse.redirect(new URL("/sozlamalar?google=connected", request.url));
  } catch {
    return NextResponse.redirect(new URL("/sozlamalar?google=error", request.url));
  }
}
