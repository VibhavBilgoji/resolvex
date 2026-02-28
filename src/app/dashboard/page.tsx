import { redirect } from "next/navigation";
import Link from "next/link";
import { getUser } from "@/lib/auth/utils";
import CitizenMapSection from "@/components/map/CitizenMapSection";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import SlidingSidebar from "@/components/dashboard/SlidingSidebar";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await getUser();

  if (!user) {
    redirect("/auth/login");
  }

  const supabase = await createClient();

  // Get complaint statistics
  const { count: totalComplaints } = await supabase
    .from("complaints")
    .select("*", { count: "exact", head: true })
    .eq("citizen_id", user.id);

  const { count: openComplaints } = await supabase
    .from("complaints")
    .select("*", { count: "exact", head: true })
    .eq("citizen_id", user.id)
    .in("status", ["open", "in_progress"]);

  const { count: resolvedComplaints } = await supabase
    .from("complaints")
    .select("*", { count: "exact", head: true })
    .eq("citizen_id", user.id)
    .eq("status", "resolved");

  return (
    <div className="fixed inset-0 overflow-hidden">
      {/* ── Full-screen map background ──────────────────────────────────── */}
      <div className="absolute inset-0">
        <CitizenMapSection />
      </div>

      {/* ── Floating header ─────────────────────────────────────────────── */}
      <header className="absolute top-0 left-0 right-0 z-40 bg-background/80 backdrop-blur-md border-b border-border/60 shadow-sm pointer-events-auto">
        <div className="px-4 sm:px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-sm font-semibold text-foreground truncate">
              Resolvex
            </span>
            <span className="text-border/60 select-none">·</span>
            <span className="text-sm text-muted-foreground truncate">
              Welcome, {user.name}
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <ThemeToggle />
            <Link href="/complaints/new">
              <Button size="sm">File Complaint</Button>
            </Link>
            <SignOutButton />
          </div>
        </div>
      </header>

      {/* ── Slide-out stats sidebar ──────────────────────────────────────── */}
      <SlidingSidebar>
        {/* User greeting */}
        <div className="pb-2 border-b border-border">
          <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium mb-0.5">
            Citizen Dashboard
          </p>
          <p className="text-sm font-semibold text-foreground truncate">
            {user.name}
          </p>
          <p className="text-xs text-muted-foreground truncate">{user.email}</p>
        </div>

        {/* Stats */}
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">
            Your Complaints
          </p>

          <div className="rounded-lg border border-border bg-card/80 px-4 py-3">
            <p className="text-xs text-muted-foreground">Total Filed</p>
            <p className="text-2xl font-bold text-foreground">
              {totalComplaints ?? 0}
            </p>
          </div>

          <div className="rounded-lg border border-border bg-card/80 px-4 py-3">
            <p className="text-xs text-muted-foreground">Open / In Progress</p>
            <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
              {openComplaints ?? 0}
            </p>
          </div>

          <div className="rounded-lg border border-border bg-card/80 px-4 py-3">
            <p className="text-xs text-muted-foreground">Resolved</p>
            <p className="text-2xl font-bold text-green-600 dark:text-green-400">
              {resolvedComplaints ?? 0}
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="space-y-2 pt-2 border-t border-border">
          <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">
            Quick Actions
          </p>
          <Link href="/complaints/new" className="block">
            <Button size="sm" className="w-full">
              File New Complaint
            </Button>
          </Link>
          <Link href="/complaints" className="block">
            <Button variant="outline" size="sm" className="w-full">
              View All Complaints
            </Button>
          </Link>
        </div>

        {/* Map legend note */}
        <div className="rounded-lg border border-border bg-muted/50 px-3 py-2.5 text-xs text-muted-foreground">
          <p className="font-medium text-foreground mb-1">
            Map — Nearby Issues
          </p>
          <p>
            Showing civic complaints within 500 m of your location. Hover a pin
            to see details.
          </p>
        </div>
      </SlidingSidebar>
    </div>
  );
}
