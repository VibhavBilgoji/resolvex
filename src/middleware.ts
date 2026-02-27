import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { CookieOptions } from "@supabase/ssr";

// Define route access rules
const routeConfig = {
  // Public routes - accessible to everyone
  public: ["/", "/auth/login", "/auth/signup", "/auth/callback", "/auth/error"],

  // Citizen routes - accessible to authenticated users (all roles)
  citizen: ["/dashboard", "/complaints", "/complaints/new", "/profile"],

  // Department admin routes
  departmentAdmin: ["/admin", "/admin/complaints", "/admin/resolutions"],

  // Super admin routes
  superAdmin: [
    "/super-admin",
    "/super-admin/users",
    "/super-admin/departments",
    "/super-admin/metrics",
  ],
};

// Role hierarchy for access control
const roleHierarchy: Record<string, number> = {
  citizen: 1,
  department_admin: 2,
  system_super_admin: 3,
};

function getRequiredRole(pathname: string): string | null {
  // Check if it's a public route
  if (
    routeConfig.public.some(
      (route) => pathname === route || pathname.startsWith(route + "/"),
    )
  ) {
    return null; // No authentication required
  }

  // Check super admin routes first (most restrictive)
  if (
    routeConfig.superAdmin.some(
      (route) => pathname === route || pathname.startsWith(route + "/"),
    )
  ) {
    return "system_super_admin";
  }

  // Check department admin routes
  if (
    routeConfig.departmentAdmin.some(
      (route) => pathname === route || pathname.startsWith(route + "/"),
    )
  ) {
    return "department_admin";
  }

  // Check citizen routes (any authenticated user)
  if (
    routeConfig.citizen.some(
      (route) => pathname === route || pathname.startsWith(route + "/"),
    )
  ) {
    return "citizen";
  }

  // Default: require authentication for any unmatched route
  return "citizen";
}

function hasAccess(userRole: string, requiredRole: string): boolean {
  const userLevel = roleHierarchy[userRole] ?? 0;
  const requiredLevel = roleHierarchy[requiredRole] ?? 0;
  return userLevel >= requiredLevel;
}

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(
          cookiesToSet: Array<{
            name: string;
            value: string;
            options: CookieOptions;
          }>,
        ) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Refresh session if expired
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;
  const requiredRole = getRequiredRole(pathname);

  // If the route is public, allow access
  if (requiredRole === null) {
    // If user is logged in and trying to access auth pages, redirect to dashboard
    if (user && (pathname === "/auth/login" || pathname === "/auth/signup")) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
    return response;
  }

  // Protected route - user must be authenticated
  if (!user) {
    const redirectUrl = new URL("/auth/login", request.url);
    redirectUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(redirectUrl);
  }

  // Fetch user's role from the users table
  const { data: userData } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .single();

  const userRole = (userData?.role as string) ?? "citizen";

  // Check if user has sufficient permissions
  if (!hasAccess(userRole, requiredRole)) {
    // Redirect to appropriate dashboard based on role
    let redirectPath = "/dashboard";
    if (userRole === "department_admin") {
      redirectPath = "/admin";
    } else if (userRole === "system_super_admin") {
      redirectPath = "/super-admin";
    }

    const redirectUrl = new URL(redirectPath, request.url);
    redirectUrl.searchParams.set("error", "insufficient_permissions");
    return NextResponse.redirect(redirectUrl);
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     * - api routes (handled separately)
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
