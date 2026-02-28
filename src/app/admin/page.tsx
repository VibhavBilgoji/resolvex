import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import AdminMapSection from "@/components/map/AdminMapSection";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import SlidingSidebar from "@/components/dashboard/SlidingSidebar";
import type { User, Department } from "@/types/database";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  const supabase = await createClient();

  // Get current user
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  // Get user profile with department info
  const { data: profileData, error: profileError } = await supabase
    .from("users")
    .select("*")
    .eq("id", user.id)
    .single();

  if (profileError || !profileData) {
    redirect("/auth/login");
  }

  const profile = profileData as User;

  if (
    profile.role !== "department_admin" &&
    profile.role !== "system_super_admin"
  ) {
    redirect("/dashboard");
  }

  // Get department info
  let department: Department | null = null;
  if (profile.department_id) {
    const { data: deptData } = await supabase
      .from("departments")
      .select("*")
      .eq("id", profile.department_id)
      .single();
    department = deptData as Department | null;
  }

  // Initialize counts
  let totalComplaints = 0;
  let openComplaints = 0;
  let inProgressComplaints = 0;
  let resolvedComplaints = 0;

  // Only query complaints if department_id exists
  if (profile.department_id) {
    const { count: total } = await supabase
      .from("complaints")
      .select("*", { count: "exact", head: true })
      .eq("department_id", profile.department_id);

    const { count: open } = await supabase
      .from("complaints")
      .select("*", { count: "exact", head: true })
      .eq("department_id", profile.department_id)
      .eq("status", "open");

    const { count: inProgress } = await supabase
      .from("complaints")
      .select("*", { count: "exact", head: true })
      .eq("department_id", profile.department_id)
      .eq("status", "in_progress");

    const { count: resolved } = await supabase
      .from("complaints")
      .select("*", { count: "exact", head: true })
      .eq("department_id", profile.department_id)
      .eq("status", "resolved");

    totalComplaints = total ?? 0;
    openComplaints = open ?? 0;
    inProgressComplaints = inProgress ?? 0;
    resolvedComplaints = resolved ?? 0;
  }

  return (
    <div className="fixed inset-0 overflow-hidden">
      {/* ── Full-screen map background ──────────────────────────────────── */}
      <div className="absolute inset-0">
        {profile.department_id ? (
          <AdminMapSection departmentId={profile.department_id} />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-muted">
            <p className="text-muted-foreground text-sm">
              No department assigned — map unavailable.
            </p>
          </div>
        )}
      </div>

      {/* ── Floating header ─────────────────────────────────────────────── */}
      <header className="absolute top-0 left-0 right-0 z-40 bg-background/80 backdrop-blur-md border-b border-border/60 shadow-sm pointer-events-auto">
        <div className="px-4 sm:px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-sm font-semibold text-foreground truncate">
              ResolveX
            </span>
            <span className="text-border/60 select-none">·</span>
            <span className="text-sm text-muted-foreground truncate">
              {department?.name ?? "Admin"} Dashboard
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Badge variant="outline" className="text-xs hidden sm:inline-flex">
              {profile.role.replace(/_/g, " ")}
            </Badge>
            <ThemeToggle />
            <SignOutButton />
          </div>
        </div>
      </header>

      {/* ── Slide-out stats sidebar ──────────────────────────────────────── */}
      <SlidingSidebar>
        {/* Admin identity */}
        <div className="pb-2 border-b border-border">
          <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium mb-0.5">
            Admin Dashboard
          </p>
          <p className="text-sm font-semibold text-foreground truncate">
            {profile.name}
          </p>
          <p className="text-xs text-muted-foreground truncate">
            {department?.name ?? "No department assigned"}
          </p>
        </div>

        {/* No-department warning */}
        {!profile.department_id && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/40 px-3 py-2.5 text-xs text-amber-800 dark:text-amber-200">
            You are not assigned to any department. Contact a super admin to
            assign you.
          </div>
        )}

        {/* Stats */}
        {profile.department_id && (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">
              Department Stats
            </p>

            <div className="rounded-lg border border-border bg-card/80 px-4 py-3">
              <p className="text-xs text-muted-foreground">Total Complaints</p>
              <p className="text-2xl font-bold text-foreground">
                {totalComplaints}
              </p>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-lg border border-border bg-card/80 px-3 py-2.5 text-center">
                <p className="text-[10px] text-muted-foreground leading-tight">
                  Open
                </p>
                <p className="text-xl font-bold text-yellow-600 dark:text-yellow-400">
                  {openComplaints}
                </p>
              </div>
              <div className="rounded-lg border border-border bg-card/80 px-3 py-2.5 text-center">
                <p className="text-[10px] text-muted-foreground leading-tight">
                  In Progress
                </p>
                <p className="text-xl font-bold text-blue-600 dark:text-blue-400">
                  {inProgressComplaints}
                </p>
              </div>
              <div className="rounded-lg border border-border bg-card/80 px-3 py-2.5 text-center">
                <p className="text-[10px] text-muted-foreground leading-tight">
                  Resolved
                </p>
                <p className="text-xl font-bold text-green-600 dark:text-green-400">
                  {resolvedComplaints}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="space-y-2 pt-2 border-t border-border">
          <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">
            Quick Actions
          </p>
          <Link href="/admin/complaints" className="block">
            <Button variant="outline" size="sm" className="w-full">
              View All Complaints
            </Button>
          </Link>
        </div>

        {/* Map legend note */}
        <div className="rounded-lg border border-border bg-muted/50 px-3 py-2.5 text-xs text-muted-foreground">
          <p className="font-medium text-foreground mb-1">
            Map — {department?.name ?? "Department"} Issues
          </p>
          <p>
            All complaints assigned to your department, updating in real-time.
            Hover a pin to see details.
          </p>
        </div>
      </SlidingSidebar>
    </div>
  );
}
