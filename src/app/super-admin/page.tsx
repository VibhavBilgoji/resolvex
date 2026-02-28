import { redirect } from "next/navigation";
import Link from "next/link";
import { getUser } from "@/lib/auth/utils";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

import { SignOutButton } from "@/components/auth/sign-out-button";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { Separator } from "@/components/ui/separator";
import {
  BarChart3,
  Users,
  Building2,
  CheckCircle2,
  Clock,
  AlertTriangle,
  XCircle,
  ShieldAlert,
  TrendingUp,
  Brain,
  Activity,
  ThumbsUp,
  ThumbsDown,
  ArrowRight,
  Target,
} from "lucide-react";
import type { Department } from "@/types/database";

// ─── Routing accuracy types ───────────────────────────────────────────────────

interface RoutingAccuracyRow {
  resolution_id: string;
  complaint_id: string;
  routing_was_correct: boolean;
  admin_corrected_department_id: string | null;
  resolved_at: string;
  category: string | null;
  priority: string | null;
  ai_confidence_score: number | null;
  ai_assigned_department: string | null;
  corrected_department: string | null;
}

export const dynamic = "force-dynamic";

interface DepartmentStat {
  id: string;
  name: string;
  total: number;
  open: number;
  in_progress: number;
  resolved: number;
  rejected: number;
  avg_confidence: number | null;
}

interface ComplaintRow {
  id: string;
  title: string;
  status: string;
  priority: string | null;
  category: string | null;
  created_at: string;
  ai_confidence_score: number | null;
  department_id: string | null;
}

interface UserRow {
  id: string;
  name: string;
  email: string;
  role: string;
  department_id: string | null;
  created_at: string;
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

function roleBadgeClass(role: string): string {
  switch (role) {
    case "system_super_admin":
      return "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300";
    case "department_admin":
      return "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300";
    default:
      return "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300";
  }
}

function ConfidenceBar({ value }: { value: number | null }) {
  const pct = value !== null ? Math.round(value * 100) : null;
  const color =
    pct === null
      ? "bg-muted"
      : pct >= 80
        ? "bg-green-500"
        : pct >= 60
          ? "bg-yellow-500"
          : "bg-red-500";

  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${color}`}
          style={{ width: pct !== null ? `${pct}%` : "0%" }}
        />
      </div>
      <span className="text-xs tabular-nums text-muted-foreground w-8 text-right">
        {pct !== null ? `${pct}%` : "—"}
      </span>
    </div>
  );
}

/**
 * Thin horizontal bar showing a 0–100 accuracy percentage.
 * Colour: green ≥ 80, yellow ≥ 60, red below 60.
 */
function AccuracyBar({ pct }: { pct: number }) {
  const color =
    pct >= 80 ? "bg-green-500" : pct >= 60 ? "bg-yellow-500" : "bg-red-500";
  return (
    <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
      <div
        className={`h-full rounded-full transition-all ${color}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

/**
 * Large ring / percentage display for the overall routing accuracy KPI card.
 */
function AccuracyRing({ pct }: { pct: number }) {
  const textColor =
    pct >= 80
      ? "text-green-600 dark:text-green-400"
      : pct >= 60
        ? "text-yellow-600 dark:text-yellow-400"
        : "text-red-600 dark:text-red-400";
  return (
    <span className={`text-4xl font-bold tabular-nums ${textColor}`}>
      {pct}%
    </span>
  );
}

export default async function SuperAdminDashboard() {
  const user = await getUser();

  if (!user) redirect("/auth/login");
  if (user.role !== "system_super_admin") redirect("/dashboard");

  const adminClient = createAdminClient();

  // ── Fetch all data in parallel ─────────────────────────────────────────────
  const [
    { count: totalComplaints },
    { count: openComplaints },
    { count: inProgressComplaints },
    { count: resolvedComplaints },
    { count: rejectedComplaints },
    { count: totalUsers },
    { count: totalResolutions },
    { data: departmentsData },
    { data: recentComplaintsData },
    { data: usersData },
    { data: aiComplaintsData },
    { data: allComplaintsForDeptData },
    { data: routingAccuracyData },
  ] = await Promise.all([
    adminClient.from("complaints").select("*", { count: "exact", head: true }),
    adminClient
      .from("complaints")
      .select("*", { count: "exact", head: true })
      .eq("status", "open"),
    adminClient
      .from("complaints")
      .select("*", { count: "exact", head: true })
      .eq("status", "in_progress"),
    adminClient
      .from("complaints")
      .select("*", { count: "exact", head: true })
      .eq("status", "resolved"),
    adminClient
      .from("complaints")
      .select("*", { count: "exact", head: true })
      .eq("status", "rejected"),
    adminClient.from("users").select("*", { count: "exact", head: true }),
    adminClient.from("resolutions").select("*", { count: "exact", head: true }),
    adminClient.from("departments").select("id, name, description"),
    adminClient
      .from("complaints")
      .select(
        "id, title, status, priority, category, created_at, ai_confidence_score, department_id",
      )
      .order("created_at", { ascending: false })
      .limit(10),
    adminClient
      .from("users")
      .select("id, name, email, role, department_id, created_at")
      .order("created_at", { ascending: false })
      .limit(20),
    // For AI confidence metrics — only complaints that have been AI-processed
    adminClient
      .from("complaints")
      .select("ai_confidence_score")
      .not("ai_confidence_score", "is", null),
    // For per-department breakdown
    adminClient
      .from("complaints")
      .select("department_id, status, ai_confidence_score"),
    // Routing accuracy — from the view created by ai_enhancements_migration.sql
    adminClient
      .from("routing_accuracy_summary")
      .select("*")
      .order("resolved_at", { ascending: false }),
  ]);

  const departments = (departmentsData ?? []) as Department[];
  const recentComplaints = (recentComplaintsData ?? []) as ComplaintRow[];
  const users = (usersData ?? []) as UserRow[];
  const routingAccuracyRows = (routingAccuracyData ??
    []) as RoutingAccuracyRow[];

  // ── Routing accuracy metrics ───────────────────────────────────────────────
  const totalWithFeedback = routingAccuracyRows.length;
  const routingCorrectCount = routingAccuracyRows.filter(
    (r) => r.routing_was_correct,
  ).length;
  const routingIncorrectCount = totalWithFeedback - routingCorrectCount;
  const routingAccuracyPct =
    totalWithFeedback > 0
      ? Math.round((routingCorrectCount / totalWithFeedback) * 100)
      : null;

  // Top correction patterns: AI routed to X, admin corrected to Y
  const correctionsTally: Record<string, number> = {};
  for (const row of routingAccuracyRows.filter(
    (r) => !r.routing_was_correct && r.corrected_department,
  )) {
    const from = row.ai_assigned_department ?? "Unknown";
    const to = row.corrected_department ?? "Unknown";
    const key = `${from}|||${to}`;
    correctionsTally[key] = (correctionsTally[key] ?? 0) + 1;
  }
  const topCorrections = Object.entries(correctionsTally)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([key, count]) => {
      const [from_department, to_department] = key.split("|||");
      return { from_department, to_department, count };
    });

  // Per-category accuracy
  const categoryAccMap: Record<string, { total: number; correct: number }> = {};
  for (const row of routingAccuracyRows) {
    const cat = row.category ?? "Uncategorised";
    if (!categoryAccMap[cat]) categoryAccMap[cat] = { total: 0, correct: 0 };
    categoryAccMap[cat].total += 1;
    if (row.routing_was_correct) categoryAccMap[cat].correct += 1;
  }
  const categoryAccuracy = Object.entries(categoryAccMap)
    .sort((a, b) => b[1].total - a[1].total)
    .slice(0, 8)
    .map(([category, stats]) => ({
      category,
      total: stats.total,
      correct: stats.correct,
      pct:
        stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0,
    }));

  // ── AI confidence metrics ──────────────────────────────────────────────────
  const aiScores = (
    (aiComplaintsData ?? []) as { ai_confidence_score: number }[]
  ).map((r) => r.ai_confidence_score);

  const avgAiConfidence =
    aiScores.length > 0
      ? aiScores.reduce((sum, s) => sum + s, 0) / aiScores.length
      : null;

  const highConfidenceCount = aiScores.filter((s) => s >= 0.8).length;
  const lowConfidenceCount = aiScores.filter((s) => s < 0.5).length;
  const aiProcessedCount = aiScores.length;
  const aiCoverage =
    totalComplaints && totalComplaints > 0
      ? (aiProcessedCount / totalComplaints) * 100
      : 0;

  // ── Per-department stats ───────────────────────────────────────────────────
  const allComplaintsForDept = (allComplaintsForDeptData ?? []) as {
    department_id: string | null;
    status: string;
    ai_confidence_score: number | null;
  }[];

  const deptStatsMap = new Map<string, DepartmentStat>();

  for (const dept of departments) {
    deptStatsMap.set(dept.id, {
      id: dept.id,
      name: dept.name,
      total: 0,
      open: 0,
      in_progress: 0,
      resolved: 0,
      rejected: 0,
      avg_confidence: null,
    });
  }

  const deptConfidenceAccum = new Map<string, number[]>();

  for (const c of allComplaintsForDept) {
    if (!c.department_id) continue;
    const stat = deptStatsMap.get(c.department_id);
    if (!stat) continue;

    stat.total += 1;
    if (c.status === "open") stat.open += 1;
    else if (c.status === "in_progress") stat.in_progress += 1;
    else if (c.status === "resolved") stat.resolved += 1;
    else if (c.status === "rejected") stat.rejected += 1;

    if (c.ai_confidence_score !== null) {
      const arr = deptConfidenceAccum.get(c.department_id) ?? [];
      arr.push(c.ai_confidence_score);
      deptConfidenceAccum.set(c.department_id, arr);
    }
  }

  for (const [deptId, scores] of deptConfidenceAccum) {
    const stat = deptStatsMap.get(deptId);
    if (stat && scores.length > 0) {
      stat.avg_confidence =
        scores.reduce((sum, s) => sum + s, 0) / scores.length;
    }
  }

  const deptStats = [...deptStatsMap.values()]
    .filter((d) => d.total > 0)
    .sort((a, b) => b.total - a.total);

  // Department lookup map for user table
  const deptNameMap = departments.reduce(
    (acc, d) => {
      acc[d.id] = d.name;
      return acc;
    },
    {} as Record<string, string>,
  );

  // ── Resolution rate ────────────────────────────────────────────────────────
  const resolutionRate =
    totalComplaints && totalComplaints > 0
      ? ((resolvedComplaints ?? 0) / totalComplaints) * 100
      : 0;

  return (
    <div className="min-h-screen bg-background">
      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <header className="bg-card border-b border-border shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-foreground">
                Super Admin Dashboard
              </h1>
              <p className="text-sm text-muted-foreground">
                System-wide overview — Welcome, {user.name}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Badge className="bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300">
                Super Admin
              </Badge>
              <ThemeToggle />
              <SignOutButton />
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* ── Section 1: Top-level KPIs ──────────────────────────────────── */}
        <section>
          <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
            <Activity className="size-5 text-muted-foreground" />
            System Overview
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <Card>
              <CardHeader className="pb-1 pt-4 px-4">
                <CardDescription className="text-xs">Total</CardDescription>
                <CardTitle className="text-2xl">
                  {totalComplaints ?? 0}
                </CardTitle>
              </CardHeader>
              <CardContent className="pb-4 px-4">
                <p className="text-xs text-muted-foreground">complaints</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-1 pt-4 px-4">
                <CardDescription className="text-xs">Open</CardDescription>
                <CardTitle className="text-2xl text-yellow-600">
                  {openComplaints ?? 0}
                </CardTitle>
              </CardHeader>
              <CardContent className="pb-4 px-4">
                <p className="text-xs text-muted-foreground">awaiting action</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-1 pt-4 px-4">
                <CardDescription className="text-xs">
                  In Progress
                </CardDescription>
                <CardTitle className="text-2xl text-blue-600">
                  {inProgressComplaints ?? 0}
                </CardTitle>
              </CardHeader>
              <CardContent className="pb-4 px-4">
                <p className="text-xs text-muted-foreground">being worked on</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-1 pt-4 px-4">
                <CardDescription className="text-xs">Resolved</CardDescription>
                <CardTitle className="text-2xl text-green-600">
                  {resolvedComplaints ?? 0}
                </CardTitle>
              </CardHeader>
              <CardContent className="pb-4 px-4">
                <p className="text-xs text-muted-foreground">
                  {resolutionRate.toFixed(1)}% rate
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-1 pt-4 px-4">
                <CardDescription className="text-xs">Rejected</CardDescription>
                <CardTitle className="text-2xl text-red-600">
                  {rejectedComplaints ?? 0}
                </CardTitle>
              </CardHeader>
              <CardContent className="pb-4 px-4">
                <p className="text-xs text-muted-foreground">closed invalid</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-1 pt-4 px-4">
                <CardDescription className="text-xs">
                  Total Users
                </CardDescription>
                <CardTitle className="text-2xl">{totalUsers ?? 0}</CardTitle>
              </CardHeader>
              <CardContent className="pb-4 px-4">
                <p className="text-xs text-muted-foreground">registered</p>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* ── Section 2: AI Performance metrics ─────────────────────────── */}
        <section>
          <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
            <Brain className="size-5 text-muted-foreground" />
            AI Routing Performance
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Avg. AI Confidence</CardDescription>
                <CardTitle className="text-3xl">
                  {avgAiConfidence !== null
                    ? `${Math.round(avgAiConfidence * 100)}%`
                    : "—"}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ConfidenceBar value={avgAiConfidence} />
                <p className="text-xs text-muted-foreground mt-2">
                  across {aiProcessedCount} processed complaints
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardDescription>AI Coverage</CardDescription>
                <CardTitle className="text-3xl">
                  {aiCoverage.toFixed(1)}%
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full bg-blue-500"
                    style={{ width: `${aiCoverage}%` }}
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  {aiProcessedCount} of {totalComplaints ?? 0} complaints
                  processed
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardDescription>High Confidence</CardDescription>
                <CardTitle className="text-3xl text-green-600">
                  {highConfidenceCount}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">
                  ≥ 80% confidence score
                </p>
                {aiProcessedCount > 0 && (
                  <p className="text-xs text-muted-foreground">
                    {((highConfidenceCount / aiProcessedCount) * 100).toFixed(
                      1,
                    )}
                    % of AI-processed
                  </p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Low Confidence</CardDescription>
                <CardTitle className="text-3xl text-red-600">
                  {lowConfidenceCount}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">
                  &lt; 50% confidence — may need review
                </p>
                <p className="text-xs text-muted-foreground">
                  RAG knowledge base:{" "}
                  <span className="font-semibold text-foreground">
                    {totalResolutions ?? 0}
                  </span>{" "}
                  resolutions indexed
                </p>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* ── Section 3: Routing Accuracy (Feedback Loop) ──────────────── */}
        <section>
          <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
            <Target className="size-5 text-muted-foreground" />
            AI Routing Accuracy{" "}
            <span className="text-sm font-normal text-muted-foreground">
              — based on admin feedback
            </span>
          </h2>

          {totalWithFeedback === 0 ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-10 gap-2 text-center">
                <Target className="size-8 text-muted-foreground/40" />
                <p className="text-sm font-medium text-muted-foreground">
                  No routing feedback yet
                </p>
                <p className="text-xs text-muted-foreground max-w-sm">
                  When admins resolve complaints and confirm whether the AI
                  routed them correctly, accuracy data will appear here.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left: KPI cards */}
              <div className="space-y-4">
                {/* Overall accuracy */}
                <Card
                  className={
                    routingAccuracyPct !== null && routingAccuracyPct >= 80
                      ? "border-green-200 dark:border-green-800"
                      : routingAccuracyPct !== null && routingAccuracyPct >= 60
                        ? "border-yellow-200 dark:border-yellow-800"
                        : "border-red-200 dark:border-red-800"
                  }
                >
                  <CardHeader className="pb-2">
                    <CardDescription>Overall Routing Accuracy</CardDescription>
                    <CardTitle className="flex items-baseline gap-2">
                      {routingAccuracyPct !== null ? (
                        <AccuracyRing pct={routingAccuracyPct} />
                      ) : (
                        <span className="text-3xl font-bold text-muted-foreground">
                          —
                        </span>
                      )}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {routingAccuracyPct !== null && (
                      <AccuracyBar pct={routingAccuracyPct} />
                    )}
                    <p className="text-xs text-muted-foreground">
                      from {totalWithFeedback} admin-reviewed resolution
                      {totalWithFeedback !== 1 ? "s" : ""}
                    </p>
                  </CardContent>
                </Card>

                {/* Correct / Incorrect split */}
                <div className="grid grid-cols-2 gap-3">
                  <Card>
                    <CardHeader className="pb-1 pt-4 px-4">
                      <CardDescription className="text-xs flex items-center gap-1">
                        <ThumbsUp className="size-3 text-green-600" />
                        Correct
                      </CardDescription>
                      <CardTitle className="text-2xl text-green-600">
                        {routingCorrectCount}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pb-4 px-4">
                      <p className="text-xs text-muted-foreground">
                        routings confirmed
                      </p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-1 pt-4 px-4">
                      <CardDescription className="text-xs flex items-center gap-1">
                        <ThumbsDown className="size-3 text-red-600" />
                        Wrong
                      </CardDescription>
                      <CardTitle className="text-2xl text-red-600">
                        {routingIncorrectCount}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pb-4 px-4">
                      <p className="text-xs text-muted-foreground">
                        mis-routings found
                      </p>
                    </CardContent>
                  </Card>
                </div>
              </div>

              {/* Middle: Top corrections */}
              <div>
                <Card className="h-full">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <ArrowRight className="size-4 text-muted-foreground" />
                      Top Mis-routing Patterns
                    </CardTitle>
                    <CardDescription>
                      Complaints the AI sent to the wrong department
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {topCorrections.length === 0 ? (
                      <p className="text-xs text-muted-foreground py-4 text-center">
                        No mis-routings with corrections recorded yet.
                      </p>
                    ) : (
                      <div className="space-y-3">
                        {topCorrections.map((c, i) => (
                          <div
                            key={i}
                            className="flex items-start gap-2 text-xs"
                          >
                            <span className="shrink-0 mt-0.5 size-4 rounded-full bg-muted text-muted-foreground flex items-center justify-center font-bold text-[10px]">
                              {c.count}
                            </span>
                            <div className="flex-1 flex items-center gap-1.5 flex-wrap">
                              <span className="font-medium text-foreground truncate max-w-30">
                                {c.from_department}
                              </span>
                              <ArrowRight className="size-3 text-muted-foreground shrink-0" />
                              <span className="font-medium text-primary truncate max-w-30">
                                {c.to_department}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Right: Per-category accuracy */}
              <div>
                <Card className="h-full">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <BarChart3 className="size-4 text-muted-foreground" />
                      Accuracy by Category
                    </CardTitle>
                    <CardDescription>
                      How accurately each complaint type is routed
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {categoryAccuracy.length === 0 ? (
                      <p className="text-xs text-muted-foreground py-4 text-center">
                        No category data yet.
                      </p>
                    ) : (
                      <div className="space-y-3">
                        {categoryAccuracy.map((cat) => (
                          <div key={cat.category} className="space-y-1">
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-xs font-medium text-foreground truncate">
                                {cat.category}
                              </p>
                              <span
                                className={`text-xs font-semibold tabular-nums shrink-0 ${
                                  cat.pct >= 80
                                    ? "text-green-600"
                                    : cat.pct >= 60
                                      ? "text-yellow-600"
                                      : "text-red-600"
                                }`}
                              >
                                {cat.pct}%
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <AccuracyBar pct={cat.pct} />
                              <span className="text-[10px] text-muted-foreground shrink-0">
                                {cat.correct}/{cat.total}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          )}
        </section>

        {/* ── Section 4: Per-department breakdown + Recent Complaints ───── */}
        <section className="grid grid-cols-1 lg:grid-cols-5 gap-8">
          {/* Department performance table */}
          <div className="lg:col-span-3">
            <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
              <BarChart3 className="size-5 text-muted-foreground" />
              Department Performance
            </h2>
            <Card>
              <CardContent className="p-0">
                {deptStats.length === 0 ? (
                  <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">
                    No complaints assigned to departments yet.
                  </div>
                ) : (
                  <div className="divide-y divide-border">
                    {/* Header row */}
                    <div className="grid grid-cols-12 gap-2 px-4 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide bg-muted/30">
                      <div className="col-span-4">Department</div>
                      <div className="col-span-1 text-right">Total</div>
                      <div className="col-span-1 text-right">Open</div>
                      <div className="col-span-1 text-right">
                        <span className="hidden sm:inline">In Prog.</span>
                        <span className="sm:hidden">IP</span>
                      </div>
                      <div className="col-span-1 text-right">Res.</div>
                      <div className="col-span-4">Avg. AI Conf.</div>
                    </div>

                    {deptStats.map((dept) => (
                      <div
                        key={dept.id}
                        className="grid grid-cols-12 gap-2 items-center px-4 py-3 hover:bg-muted/30 transition-colors"
                      >
                        <div className="col-span-4 min-w-0">
                          <p className="text-sm font-medium truncate">
                            {dept.name}
                          </p>
                        </div>
                        <div className="col-span-1 text-right text-sm tabular-nums">
                          {dept.total}
                        </div>
                        <div className="col-span-1 text-right text-sm tabular-nums text-yellow-600">
                          {dept.open}
                        </div>
                        <div className="col-span-1 text-right text-sm tabular-nums text-blue-600">
                          {dept.in_progress}
                        </div>
                        <div className="col-span-1 text-right text-sm tabular-nums text-green-600">
                          {dept.resolved}
                        </div>
                        <div className="col-span-4">
                          <ConfidenceBar value={dept.avg_confidence} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Recent complaints */}
          <div className="lg:col-span-2">
            <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
              <TrendingUp className="size-5 text-muted-foreground" />
              Recent Activity
            </h2>
            <Card className="h-fit">
              <CardContent className="p-0">
                {recentComplaints.length === 0 ? (
                  <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">
                    No complaints yet.
                  </div>
                ) : (
                  <div className="divide-y divide-border">
                    {recentComplaints.map((complaint) => (
                      <Link
                        key={complaint.id}
                        href={`/admin/complaints/${complaint.id}`}
                        className="block p-4 space-y-1.5 hover:bg-muted/50 transition-colors group"
                      >
                        <div className="flex items-start gap-2">
                          <p className="text-sm font-medium line-clamp-1 flex-1 group-hover:text-primary transition-colors">
                            {complaint.title}
                          </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5">
                          <Badge
                            className={`${statusBadgeClass(complaint.status)} text-xs`}
                          >
                            {complaint.status.replace("_", " ")}
                          </Badge>
                          {complaint.priority && (
                            <Badge
                              className={`${priorityBadgeClass(complaint.priority)} text-xs`}
                            >
                              {complaint.priority}
                            </Badge>
                          )}
                          {complaint.ai_confidence_score !== null &&
                            complaint.ai_confidence_score !== undefined && (
                              <span className="text-xs text-muted-foreground">
                                AI:{" "}
                                {Math.round(
                                  complaint.ai_confidence_score * 100,
                                )}
                                %
                              </span>
                            )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {complaint.category && (
                            <span className="mr-2">{complaint.category}</span>
                          )}
                          {new Date(complaint.created_at).toLocaleDateString(
                            "en-IN",
                            {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            },
                          )}
                        </p>
                      </Link>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </section>

        {/* ── Section 5: User Management ──────────────────────────────────── */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
              <Users className="size-5 text-muted-foreground" />
              User Management
            </h2>
            <p className="text-sm text-muted-foreground">
              Showing {users.length} most recent users
            </p>
          </div>
          <Card>
            <CardContent className="p-0">
              {users.length === 0 ? (
                <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">
                  No users registered yet.
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {/* Header */}
                  <div className="hidden md:grid grid-cols-12 gap-3 px-4 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide bg-muted/30">
                    <div className="col-span-3">Name</div>
                    <div className="col-span-3">Email</div>
                    <div className="col-span-2">Role</div>
                    <div className="col-span-3">Department</div>
                    <div className="col-span-1">Joined</div>
                  </div>

                  {users.map((u) => (
                    <div
                      key={u.id}
                      className="flex flex-col gap-1 p-4 md:grid md:grid-cols-12 md:gap-3 md:items-center hover:bg-muted/30 transition-colors"
                    >
                      <div className="md:col-span-3 flex items-center gap-2">
                        <div className="size-7 rounded-full bg-muted flex items-center justify-center shrink-0 text-xs font-semibold text-muted-foreground uppercase">
                          {u.name?.charAt(0) ?? "?"}
                        </div>
                        <p className="text-sm font-medium truncate">{u.name}</p>
                      </div>
                      <div className="md:col-span-3">
                        <p className="text-xs text-muted-foreground font-mono truncate">
                          {u.email}
                        </p>
                      </div>
                      <div className="md:col-span-2">
                        <Badge className={`${roleBadgeClass(u.role)} text-xs`}>
                          {u.role === "system_super_admin"
                            ? "Super Admin"
                            : u.role === "department_admin"
                              ? "Dept. Admin"
                              : "Citizen"}
                        </Badge>
                      </div>
                      <div className="md:col-span-3">
                        {u.department_id && deptNameMap[u.department_id] ? (
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Building2 className="size-3 shrink-0" />
                            {deptNameMap[u.department_id]}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            —
                          </span>
                        )}
                      </div>
                      <div className="md:col-span-1">
                        <p className="text-xs text-muted-foreground whitespace-nowrap">
                          {new Date(u.created_at).toLocaleDateString("en-IN", {
                            day: "numeric",
                            month: "short",
                          })}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </section>

        {/* ── Section 6: Quick links ─────────────────────────────────────── */}
        <section>
          <Separator className="mb-6" />
          <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
            <ShieldAlert className="size-5 text-muted-foreground" />
            Quick Links
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-stretch">
            <Link href="/admin/complaints" className="flex">
              <Card className="hover:shadow-md transition-shadow cursor-pointer group flex flex-col w-full">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2 group-hover:text-primary transition-colors">
                    <AlertTriangle className="size-4" />
                    All Complaints
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0 mt-auto">
                  <p className="text-xs text-muted-foreground">
                    View and manage every complaint across all departments
                  </p>
                </CardContent>
              </Card>
            </Link>

            <Link href="/admin/complaints?status=open" className="flex">
              <Card className="hover:shadow-md transition-shadow cursor-pointer group flex flex-col w-full">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2 group-hover:text-primary transition-colors">
                    <Clock className="size-4 text-yellow-600" />
                    Open Complaints
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0 mt-auto">
                  <p className="text-xs text-muted-foreground">
                    {openComplaints ?? 0} complaints awaiting department action
                  </p>
                </CardContent>
              </Card>
            </Link>

            <Link href="/admin/complaints?status=resolved" className="flex">
              <Card className="hover:shadow-md transition-shadow cursor-pointer group flex flex-col w-full">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2 group-hover:text-primary transition-colors">
                    <CheckCircle2 className="size-4 text-green-600" />
                    Resolved Complaints
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0 mt-auto">
                  <p className="text-xs text-muted-foreground">
                    {resolvedComplaints ?? 0} resolutions indexed in RAG
                  </p>
                </CardContent>
              </Card>
            </Link>

            <Link href="/admin/complaints?status=rejected" className="flex">
              <Card className="hover:shadow-md transition-shadow cursor-pointer group flex flex-col w-full opacity-60">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2 group-hover:text-primary transition-colors">
                    <XCircle className="size-4 text-red-600" />
                    Rejected Complaints
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0 mt-auto">
                  <p className="text-xs text-muted-foreground">
                    {rejectedComplaints ?? 0} complaints rejected by admins
                  </p>
                </CardContent>
              </Card>
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}
