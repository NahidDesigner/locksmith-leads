import { NextRequest, NextResponse } from "next/server";

// Gate /dashboard/* at the edge — full session verification happens in layout.
export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (pathname.startsWith("/dashboard")) {
    const cookie = req.cookies.get("ls_session")?.value;
    if (!cookie) {
      const url = req.nextUrl.clone();
      url.pathname = "/login";
      return NextResponse.redirect(url);
    }
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*"],
};
