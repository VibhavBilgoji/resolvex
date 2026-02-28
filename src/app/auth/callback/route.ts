import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request): Promise<NextResponse> {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  // `redirect` is set by the login page for explicit redirects (e.g. middleware
  // bounced the user to login from a protected page).
  // `next` is the legacy param used by Supabase magic-link / password-reset flows.
  const explicitRedirect = searchParams.get("redirect");
  const next = searchParams.get("next");

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      // Determine where to send the user.
      let destination = "/dashboard"; // safe fallback

      if (explicitRedirect) {
        // An explicit destination was requested (e.g. middleware redirect).
        destination = explicitRedirect;
      } else if (next) {
        // Legacy next param (password reset, magic link, etc.).
        destination = next;
      } else {
        // No explicit destination — look up the user's role and route accordingly.
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (user) {
          const { data: profile } = await supabase
            .from("users")
            .select("role")
            .eq("id", user.id)
            .single();

          const role = (profile as { role: string } | null)?.role;

          if (role === "system_super_admin") destination = "/super-admin";
          else if (role === "department_admin") destination = "/admin";
          else destination = "/dashboard";
        }
      }

      const forwardedHost = request.headers.get("x-forwarded-host");
      const isLocalEnv = process.env.NODE_ENV === "development";

      if (isLocalEnv) {
        return NextResponse.redirect(`${origin}${destination}`);
      } else if (forwardedHost) {
        return NextResponse.redirect(`https://${forwardedHost}${destination}`);
      } else {
        return NextResponse.redirect(`${origin}${destination}`);
      }
    }
  }

  return NextResponse.redirect(
    `${origin}/auth/error?error=auth_callback_error`,
  );
}