import { NextResponse, type NextRequest } from "next/server";

// Product site (recuidado.com.br and www). The home page and /validacao are the site; any other path goes to
// the app keeping the path, so old links (/patient?f=..., /family, /comecar) keep working.
const APP_URL = process.env.APP_URL || "https://app.recuidado.com.br";

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  return NextResponse.redirect(new URL(`${pathname}${search}`, APP_URL), 307);
}

export const config = {
  // Everything except the home page, /validacao, Next assets and files in /public.
  matcher: ["/((?!_next/|validacao|fotos/|logos/|logo-recuidado-texto\\.svg$|icon\\.svg$|favicon\\.ico$|robots\\.txt$|sitemap\\.xml$).+)"],
};
