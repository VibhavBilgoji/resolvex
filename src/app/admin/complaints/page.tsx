import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { SignOutButton } from "@/components/auth/sign-out-button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  ArrowLeft,
  Clock,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  MapPin,
  CalendarDays,
  Tag,
  Filter,
} from "lucide-react";
import type { Complaint, User, Department } from "@/types/database";

export const dynamic = "force-dynamic";

type FilterStatus = "all" | "open" | "in_progress" | "resolved" | "rejected";

interface AdminComplaintsPageProps {
  searchParams: Promise<{ status?: string; ward?: string }>;
}

function statusBadgeClass(status: string): string {
  switch (status) {
    case "open":
      return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300";
    case "in_progress":
      return "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300";
    case "resolved":
      return "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300";
    case "rejected":
      return "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300";
    default:
      return "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300";
  }
}

function priorityBadgeClass(priority: string | null): string {
  switch (priority) {
    case "critical":
      return "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300";
    case "high":
      return "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300";
    case "medium":
      return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300";
    case "low":
      return "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300";
    default:
      return "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300";
  }
}

function StatusIcon({ status }: { status: string }) {
  switch (status) {
    case "open":
      return <Clock className="size-3.5 text-yellow-600 shrink-0" />;
    case "in_progress":
      return <AlertTriangle className="size-3.5 text-blue-600 shrink-0" />;
    case "resolved":
      return <CheckCircle2 className="size-3.5 text-green-600 shrink-0" />;
    case "rejected":
      return <XCircle className="size-3.5 text-red-600 shrink-0" />;
    default:
      return null;
  }
}

const STATUS_TABS: { label: string; value: FilterStatus }[] = [
  { label: "All", value: "all" },
  { label: "Open", value: "open" },
  { label: "In Progress", value: "in_progress" },
  { label: "Resolved", value: "resolved" },
  { label: "Rejected", value: "rejected" },
];

export default async function AdminComplaintsPage({
  searchParams,
}: AdminComplaintsPageProps) {
  const { status: statusParam, ward: wardParam } = await searchParams;

  // ── Auth & role check ──────────────────────────────────────────────────────
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) redirect("/auth/login");

  const { data: profileData } = await supabase
    .from("users")
    .select("*")
    .eq("id", authUser.id)
    .single();

  if (!profileData) redirect("/auth/login");
  const profile = profileData as User;

  if (
    profile.role !== "department_admin" &&
    profile.role !== "system_super_admin"
  ) {
    redirect("/dashboard");
  }

  if (profile.role === "department_admin" && !profile.department_id) {
    redirect("/admin");
  }

  // ── Fetch department info ──────────────────────────────────────────────────
  let department: Department | null = null;
  if (profile.department_id) {
    const { data: deptData } = await supabase
      .from("departments")
      .select("*")
      .eq("id", profile.department_id)
      .single();
    department = deptData as Department | null;
  }

  // ── Build query via admin client (bypasses RLS for dept admin flexibility) ─
  const adminClient = createAdminClient();

  const activeStatus: FilterStatus =
    statusParam &&
    ["open", "in_progress", "resolved", "rejected"].includes(statusParam)
      ? (statusParam as FilterStatus)
      : "all";

  const activeWard = wardParam?.trim() ?? "";

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (adminClient as any)
    .from("complaints")
    .select("*")
    .order("created_at", { ascending: false });

  // Scope to department unless super admin
  if (profile.role === "department_admin" && profile.department_id) {
    query = query.eq("department_id", profile.department_id);
  }

  if (activeStatus !== "all") {
    query = query.eq("status", activeStatus);
  }

  if (activeWard) {
    query = query.ilike("municipal_ward", `%${activeWard}%`);
  }

  const { data: complaintsData } = await query;
  const complaints = (complaintsData ?? []) as Complaint[];

  // ── Count per status for tab badges ───────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let countQuery = (adminClient as any)
    .from("complaints")
    .select("status");

  if (profile.role === "department_admin" && profile.department_id) {
    countQuery = countQuery.eq("department_id", profile.department_id);
  }

  if (activeWard) {
    countQuery = countQuery.ilike("municipal_ward", `%${activeWard}%`);
  }

  const { data: allStatusData } = await countQuery;
  const countByStatus = ((allStatusData ?? []) as { status: string }[]).reduce(
    (acc: Record<string, number>, c) => {
      acc[c.status] = (acc[c.status] ?? 0) + 1;
      return acc;
    },
    {},
  );
  const totalCount = (allStatusData ?? []).length;

  // ── Distinct wards for the ward filter dropdown ────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let wardQuery = (adminClient as any)
    .from("complaints")
    .select("municipal_ward")
    .not("municipal_ward", "is", null);

  if (profile.role === "department_admin" && profile.department_id) {
    wardQuery = wardQuery.eq("department_id", profile.department_id);
  }

  const { data: wardData } = await wardQuery;
  const distinctWards: string[] = [
    ...new Set(
      ((wardData ?? []) as { municipal_ward: string | null }[])
        .map((w) => w.municipal_ward)
        .filter((w): w is string => Boolean(w)),
    ),
  ].sort();

  // ── Build filter href helpers ──────────────────────────────────────────────
  function buildHref(newStatus: FilterStatus, newWard?: string): string {
    const params = new URLSearchParams();
    if (newStatus !== "all") params.set("status", newStatus);
    const ward = newWard !== undefined ? newWard : activeWard;
    if (ward) params.set("ward", ward);
    const qs = params.toString();
    return `/admin/complaints${qs ? `?${qs}` : ""}`;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card border-b border-border shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <Link href="/admin">
                <Button variant="ghost" size="sm">
                  <ArrowLeft className="size-4" />
                  Dashboard
                </Button>
              </Link>
              <div>
                <h1 className="text-xl font-bold text-foreground">
                  {department?.name ?? "Department"} — Complaints
                </h1>
                <p className="text-sm text-muted-foreground">
                  {totalCount} complaint{totalCount !== 1 ? "s" : ""}
                  {activeWard ? ` in "${activeWard}"` : ""}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <ThemeToggle />
              <SignOutButton />
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* ── Filters row ─────────────────────────────────────────────────── */}
        <div className="flex flex-wrap items-start gap-4">
          {/* Status tabs */}
          <div className="flex gap-1.5 flex-wrap">
            {STATUS_TABS.map((tab) => {
              const count =
                tab.value === "all"
                  ? totalCount
                  : (countByStatus[tab.value] ?? 0);
              const isActive = activeStatus === tab.value;
              return (
                <Link key={tab.value} href={buildHref(tab.value)}>
                  <button
                    className={`
                      inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors
                      ${
                        isActive
                          ? "bg-foreground text-background"
                          : "bg-card text-muted-foreground border border-border hover:bg-muted/50"
                      }
                    `}
                  >
                    {tab.label}
                    {count > 0 && (
                      <span
                        className={`
                          text-xs px-1.5 py-0.5 rounded-full font-semibold
                          ${
                            isActive
                              ? "bg-background/20 text-background"
                              : "bg-muted text-muted-foreground"
                          }
                        `}
                      >
                        {count}
                      </span>
                    )}
                  </button>
                </Link>
              );
            })}
          </div>

          {/* Ward filter */}
          {distinctWards.length > 0 && (
            <div className="flex items-center gap-2 ml-auto">
              <Filter className="size-4 text-muted-foreground shrink-0" />
              <form method="get" action="/admin/complaints" className="flex gap-2 items-center">
                {activeStatus !== "all" && (
                  <input type="hidden" name="status" value={activeStatus} />
                )}
                <select
                  name="ward"
                  defaultValue={activeWard}
                  className="text-sm border border-border rounded-md px-3 py-1.5 bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  aria-label="Filter by Municipal Ward"
                >
                  <option value="">All Wards</option>
                  {distinctWards.map((ward) => (
                    <option key={ward} value={ward}>
                      {ward}
                    </option>
                  ))}
                </select>
                <Button type="submit" variant="outline" size="sm">
                  Apply
                </Button>
                {activeWard && (
                  <Link href={buildHref(activeStatus, "")}>
                    <Button variant="ghost" size="sm">
                      Clear
                    </Button>
                  </Link>
                )}
              </form>
            </div>
          )}
        </div>

        {/* ── Complaints list ──────────────────────────────────────────────── */}
        {complaints.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16 gap-3">
              <CheckCircle2 className="size-10 text-muted-foreground" />
              <div className="text-center">
                <p className="font-semibold text-foreground">
                  {activeStatus === "all"
                    ? "No complaints assigned yet"
                    : `No ${activeStatus.replace("_", " ")} complaints`}
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  {activeStatus !== "all"
                    ? "Try a different filter."
                    : "Complaints routed to your department will appear here."}
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {complaints.map((complaint) => (
              <Link
                key={complaint.id}
                href={`/admin/complaints/${complaint.id}`}
                className="block group"
              >
                <Card className="hover:shadow-md transition-shadow group-hover:border-border/80">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <CardTitle className="text-base truncate group-hover:text-primary transition-colors">
                          {complaint.title}
                        </CardTitle>
                        <CardDescription className="mt-1 line-clamp-1 text-sm">
                          {complaint.translated_text ?? complaint.original_text}
                        </CardDescription>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <StatusIcon status={complaint.status} />
                        <Badge className={statusBadgeClass(complaint.status)}>
                          {complaint.status.replace("_", " ")}
                        </Badge>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
                      {complaint.municipal_ward && (
                        <span className="flex items-center gap-1.5">
                          <MapPin className="size-3.5 shrink-0" />
                          {complaint.municipal_ward}
                        </span>
                      )}
                      {complaint.pincode && !complaint.municipal_ward && (
                        <span className="flex items-center gap-1.5">
                          <MapPin className="size-3.5 shrink-0" />
                          Pincode {complaint.pincode}
                        </span>
                      )}
                      {complaint.category && (
                        <span className="flex items-center gap-1.5">
                          <Tag className="size-3.5 shrink-0" />
                          {complaint.category}
                        </span>
                      )}
                      <span className="flex items-center gap-1.5 ml-auto">
                        <CalendarDays className="size-3.5 shrink-0" />
                        {new Date(complaint.created_at).toLocaleDateString(
                          "en-IN",
                          { day: "numeric", month: "short", year: "numeric" },
                        )}
                      </span>
                    </div>

                    {(complaint.priority || complaint.ai_confidence_score !== null) && (
                      <div className="mt-3 flex items-center gap-2">
                        {complaint.priority && (
                          <Badge className={priorityBadgeClass(complaint.priority)}>
                            {complaint.priority} priority
                          </Badge>
                        )}
                        {complaint.ai_confidence_score !== null &&
                          complaint.ai_confidence_score !== undefined && (
                            <span className="text-xs text-muted-foreground">
                              AI confidence:{" "}
                              {Math.round(
                                (complaint.ai_confidence_score ?? 0) * 100,
                              )}
                              %
                            </span>
                          )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}