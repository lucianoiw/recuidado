import { NextResponse, type NextRequest } from "next/server";

// Product site (recuidado.com.br and www). Until the site is ready, every path goes to the
// app, keeping the path: old links (/patient?f=..., /family, /comecar) keep working.
const APP_URL = process.env.APP_URL || "https://app.recuidado.com.br";

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  return NextResponse.redirect(new URL(`${pathname}${search}`, APP_URL), 307);
}

export const config = {
  matcher: "/:path*",
};
