// middleware.ts
import { NextResponse, type NextRequest } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  let response = NextResponse.next({
    request: { headers: request.headers },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          request.cookies.set({ name, value, ...options });
          response = NextResponse.next({ request: { headers: request.headers } });
          response.cookies.set({ name, value, ...options });
        },
        remove(name: string, options: CookieOptions) {
          request.cookies.set({ name, value: "", ...options });
          response = NextResponse.next({ request: { headers: request.headers } });
          response.cookies.set({ name, value: "", ...options });
        },
      },
    }
  );

  const { data: { session } } = await supabase.auth.getSession();

  // Protect /exam routes — must be authenticated
  if (pathname.startsWith("/exam")) {
    if (!session) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
  }

  // Protect /admin/* routes (except /admin login page itself)
  if (pathname.startsWith("/admin/")) {
    if (!session) {
      return NextResponse.redirect(new URL("/admin", request.url));
    }

    // Verify admin role
    const { data: admin } = await supabase
      .from("admins")
      .select("id, role")
      .eq("id", session.user.id)
      .eq("is_active", true)
      .single();

    if (!admin) {
      await supabase.auth.signOut();
      return NextResponse.redirect(new URL("/admin", request.url));
    }
  }

  // Redirect authenticated users away from login pages
  if (session && pathname === "/login") {
    return NextResponse.redirect(new URL("/exam", request.url));
  }

  if (session && pathname === "/admin") {
    // Check if admin
    const { data: admin } = await supabase
      .from("admins")
      .select("id")
      .eq("id", session.user.id)
      .single();
    if (admin) {
      return NextResponse.redirect(new URL("/admin/dashboard", request.url));
    }
  }

  return response;
}

export const config = {
  matcher: [
    "/exam/:path*",
    "/admin/:path*",
    "/login",
    "/admin",
  ],
};
