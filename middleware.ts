export const runtime = "nodejs";

import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const routeConfig = {
  public: ["/", "/auth/login", "/auth/signup", "/auth/callback", "/auth/error"],
  citizen: ["/dashboard", "/complaints", "/complaints/new", "/profile"],
  departmentAdmin: ["/admin", "/admin/complaints", "/admin/resolutions"],
  superAdmin: [
    "/super-admin",
    "/super-admin/users",
    "/super-admin/departments",
    "/super-admin/metrics",
  ],
};

const roleHierarchy: Record<string, number> = {
  citizen: 1,
  department_admin: 2,
  system_super_admin: 3,
};

function getRequiredRole(pathname: string): string | null {
  if (
    routeConfig.public.some(
      (route) => pathname === route || pathname.startsWith(route + "/"),
    )
  ) {
    return null;
  }

  if (
    routeConfig.superAdmin.some(
      (route) => pathname === route || pathname.startsWith(route + "/"),
    )
  ) {
    return "system_super_admin";
  }

  if (
    routeConfig.departmentAdmin.some(
      (route) => pathname === route || pathname.startsWith(route + "/"),
    )
  ) {
    return "department_admin";
  }

  if (
    routeConfig.citizen.some(
      (route) => pathname === route || pathname.startsWith(route + "/"),
    )
  ) {
    return "citizen";
  }

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
            options: object;
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

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;
  const requiredRole = getRequiredRole(pathname);

  if (requiredRole === null) {
    if (user && (pathname === "/auth/login" || pathname === "/auth/signup")) {
      const { data: userData } = await supabase
        .from("users")
        .select("role")
        .eq("id", user.id)
        .single();

      const userRole = (userData?.role as string) ?? "citizen";
      let dashboardPath = "/dashboard";
      if (userRole === "system_super_admin") dashboardPath = "/super-admin";
      else if (userRole === "department_admin") dashboardPath = "/admin";

      return NextResponse.redirect(new URL(dashboardPath, request.url));
    }
    return response;
  }

  if (!user) {
    const redirectUrl = new URL("/auth/login", request.url);
    redirectUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(redirectUrl);
  }

  const { data: userData } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .single();

  const userRole = (userData?.role as string) ?? "citizen";

  if (!hasAccess(userRole, requiredRole)) {
    let redirectPath = "/dashboard";
    if (userRole === "department_admin") redirectPath = "/admin";
    else if (userRole === "system_super_admin") redirectPath = "/super-admin";

    const redirectUrl = new URL(redirectPath, request.url);
    redirectUrl.searchParams.set("error", "insufficient_permissions");
    return NextResponse.redirect(redirectUrl);
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};