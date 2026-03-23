import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PATHS = [
  "/",
  "/login",
  "/signup",
  "/auth/callback",
  "/auth/confirm",
  "/auth/auth-code-error",
  // Explicitly allow the auth API we need during signup
  "/api/auth/signup",
  // Client-facing public routes (no auth required)
  "/client",      // /client/[token] portal + /client/hub/[hubToken]
  "/products",    // legacy /products/* redirects
  "/p",           // /p/[slug] landing, run, results
  "/invite",      // /invite/[token] team invite
];

export async function updateSession(request: NextRequest) {
  // Allow preflight and API routes to pass through
  if (request.method === "OPTIONS") {
    return NextResponse.next({ request });
  }
  const pathname = request.nextUrl.pathname;
  if (pathname.startsWith("/api/")) {
    return NextResponse.next({ request });
  }

  // Custom domain requests are always public — skip auth entirely.
  // The parent middleware (src/middleware.ts) already resolved the tenant
  // and set x-custom-domain header. We just pass through.
  if (request.headers.get('x-custom-domain')) {
    return NextResponse.next({ request });
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isPublic = PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"));

  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  return response;
}
