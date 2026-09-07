import { NextRequest, NextResponse } from "next/server";

// Simple shared-password gate. Set APP_PASSWORD in the environment to turn it on;
// leave it unset and the app is open (local dev convenience).
//
// The gate cookie holds sha256("fc-gate:" + APP_PASSWORD), so it can't be forged
// without knowing the password, and the password itself never sits in a cookie.

const COOKIE = "fc_gate";
const OPEN_PATHS = ["/gate", "/api/gate"];

async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function middleware(req: NextRequest) {
  const password = process.env.APP_PASSWORD;
  if (!password) return NextResponse.next();

  const { pathname } = req.nextUrl;
  if (OPEN_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    return NextResponse.next();
  }

  const token = req.cookies.get(COOKIE)?.value;
  if (token && token === (await sha256Hex(`fc-gate:${password}`))) {
    return NextResponse.next();
  }

  const url = req.nextUrl.clone();
  url.pathname = "/gate";
  url.search = "";
  if (pathname !== "/") url.searchParams.set("next", pathname + req.nextUrl.search);
  return NextResponse.redirect(url);
}

export const config = {
  // everything except Next internals and common static files
  matcher: ["/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)"],
};
