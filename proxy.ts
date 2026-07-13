import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Cheap gate only: presence of the session cookie. The real check (a valid,
// unexpired session) happens in the /admin server components and actions —
// never trust this alone.
const SESSION_COOKIE = "better-auth.session_token";

export function proxy(request: NextRequest) {
  const hasSession =
    request.cookies.has(SESSION_COOKIE) ||
    request.cookies.has(`__Secure-${SESSION_COOKIE}`);

  if (!hasSession) {
    const loginUrl = new URL("/admin/login", request.url);
    loginUrl.searchParams.set("redirect", request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  // /admin/login is public — everything else under /admin needs a session.
  matcher: ["/admin", "/admin/((?!login).*)"],
};
