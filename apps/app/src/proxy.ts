import { NextResponse, type NextRequest } from "next/server";

// painel.recuidado.com.br serves the two phones page (/painel) from this same app. Its own
// origin keeps the page apart from the two apps it frames (app.recuidado.com.br).
export function proxy(request: NextRequest) {
  const host = request.headers.get("host") ?? "";
  if (host.startsWith("painel.") && request.nextUrl.pathname === "/") {
    return NextResponse.rewrite(new URL("/painel", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: "/",
};
