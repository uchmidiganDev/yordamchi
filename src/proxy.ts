import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

const SESSION_COOKIE_NAME = "yordamchi_session";

const PUBLIC_PATHS = [
  "/login",
  "/api/telegram/webhook",
  "/api/telegram/bots",
  "/api/auth/telegram/start",
  "/api/auth/telegram/status",
  "/api/auth/telegram/webapp",
];

function isPublicPath(pathname: string) {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

async function hasValidSession(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return false;
  try {
    const secret = new TextEncoder().encode(process.env.SESSION_SECRET);
    await jwtVerify(token, secret);
    return true;
  } catch {
    return false;
  }
}

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const authenticated = await hasValidSession(req);

  if (pathname === "/login" && authenticated) {
    return NextResponse.redirect(new URL("/", req.url));
  }

  if (!isPublicPath(pathname) && !authenticated) {
    const loginUrl = new URL("/login", req.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
