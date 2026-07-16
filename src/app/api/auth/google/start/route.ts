import { randomBytes } from "crypto";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getSession } from "@/lib/session";
import { getGoogleAuthUrl } from "@/lib/google-oauth";

const STATE_COOKIE_NAME = "google_oauth_state";

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const state = randomBytes(16).toString("hex");
  const cookieStore = await cookies();
  cookieStore.set(STATE_COOKIE_NAME, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 5 * 60,
  });

  try {
    return NextResponse.redirect(getGoogleAuthUrl(state));
  } catch {
    return NextResponse.redirect(new URL("/sozlamalar?google=error", request.url));
  }
}
