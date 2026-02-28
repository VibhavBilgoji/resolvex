import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { Separator } from "@/components/ui/separator";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ArrowLeft,
  MapPin,
  CalendarDays,
  Building2,
  Tag,
  ShieldAlert,
  CheckCircle2,
  Clock,
  XCircle,
  AlertTriangle,
  ImageIcon,
  User2,
} from "lucide-react";
import { AdminResolutionForm } from "@/components/admin/resolution-form";
import { AISummaryCard } from "@/components/admin/AISummaryCard";
import { ResolutionPlanCard } from "@/components/admin/ResolutionPlanCard";
import type { Complaint, Department, Resolution, User } from "@/types/database";

export const dynamic = "force-dynamic";

interface AdminComplaintDetailPageProps {
  params: Promise<{ id: string }>;
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
      return <Clock className="size-4 text-yellow-600" />;
    case "in_progress":
      return <AlertTriangle className="size-4 text-blue-600" />;
    case "resolved":
      return <CheckCircle2 className="size-4 text-green-600" />;
    case "rejected":
      return <XCircle className="size-4 text-red-600" />;
    default:
      return null;
  }
}

function InfoRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="mt-0.5 text-muted-foreground shrink-0">{icon}</span>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <div className="text-sm font-medium text-foreground wrap-break-word">
          {value}
        </div>
      </div>
    </div>
  );
}

export default async function AdminComplaintDetailPage({
  params,
}: AdminComplaintDetailPageProps) {
  const { id } = await params;

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

  // ── Fetch complaint (via admin client to bypass RLS) ───────────────────────
  const adminClient = createAdminClient();

  const { data: complaintData, error: complaintErr } = await adminClient
    .from("complaints")
    .select("*")
    .eq("id", id)
    .single();

  if (complaintErr || !complaintData) notFound();
  const complaint = complaintData as Complaint;

  // Department admins can only see complaints in their own department
  if (
    profile.role === "department_admin" &&
    complaint.department_id !== profile.department_id
  ) {
    notFound();
  }

  // ── Fetch related data ─────────────────────────────────────────────────────
  // All departments (for routing correction selector)
  const { data: allDeptsRaw } = await adminClient
    .from("departments")
    .select("id, name")
    .order("name");
  const allDepartments = (allDeptsRaw ?? []) as Pick<
    Department,
    "id" | "name"
  >[];

  // Department name
  let department: Pick<Department, "id" | "name"> | null = null;
  if (complaint.department_id) {
    department =
      allDepartments.find((d) => d.id === complaint.department_id) ?? null;
  }

  // Citizen name
  let citizen: Pick<User, "id" | "name" | "email"> | null = null;
  if (complaint.citizen_id) {
    const { data: citizenData } = await adminClient
      .from("users")
      .select("id, name, email")
      .eq("id", complaint.citizen_id)
      .single();
    if (citizenData)
      citizen = citizenData as Pick<User, "id" | "name" | "email">;
  }

  // Existing resolution (if any)
  const { data: resolutionData } = await adminClient
    .from("resolutions")
    .select("id, complaint_id, resolved_by, resolution_text, resolved_at")
    .eq("complaint_id", id)
    .order("resolved_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const resolution = resolutionData as Resolution | null;

  // Resolver name
  let resolverName: string | null = null;
  if (resolution?.resolved_by) {
    const { data: resolverData } = await adminClient
      .from("users")
      .select("name")
      .eq("id", resolution.resolved_by)
      .single();
    resolverName = (resolverData as { name: string } | null)?.name ?? null;
  }

  const isResolved = complaint.status === "resolved";
  const isAiProcessed =
    complaint.category ||
    complaint.priority ||
    complaint.department_id ||
    complaint.municipal_ward;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card border-b border-border shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-4 min-w-0">
              <Link href="/admin/complaints">
                <Button variant="ghost" size="sm" className="mt-0.5 shrink-0">
                  <ArrowLeft className="size-4" />
                  All Complaints
                </Button>
              </Link>
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <h1 className="text-xl font-bold text-foreground truncate">
                    {complaint.title}
                  </h1>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <StatusIcon status={complaint.status} />
                    <Badge className={statusBadgeClass(complaint.status)}>
                      {complaint.status.replace("_", " ")}
                    </Badge>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground font-mono select-all">
                  {complaint.id}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <ThemeToggle />
              <SignOutButton />
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* ── Left column: complaint content ────────────────────────────── */}
          <div className="lg:col-span-2 space-y-6">
            {/* AI Summary (if available) */}
            {complaint.ai_summary && (
              <AISummaryCard summary={complaint.ai_summary} />
            )}

            {/* AI Resolution Plan (admin-only, on-demand) */}
            {!isResolved && complaint.status !== "rejected" && (
              <ResolutionPlanCard complaintId={complaint.id} />
            )}
            {/* Description */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  Complaint Description
                </CardTitle>
                <CardDescription>
                  Original text as submitted by the citizen
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm leading-relaxed whitespace-pre-wrap text-foreground">
                  {complaint.original_text}
                </p>

                {complaint.translated_text &&
                  complaint.translated_text !== complaint.original_text && (
                    <>
                      <Separator />
                      <div>
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                          AI Translation (English)
                        </p>
                        <p className="text-sm leading-relaxed text-foreground/90 whitespace-pre-wrap">
                          {complaint.translated_text}
                        </p>
                      </div>
                    </>
                  )}
              </CardContent>
            </Card>

            {/* Photo evidence */}
            {complaint.image_url && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <ImageIcon className="size-4" />
                    Photo Evidence
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={complaint.image_url}
                    alt="Complaint evidence"
                    className="w-full max-h-80 object-contain rounded-lg border border-border bg-muted"
                  />
                </CardContent>
              </Card>
            )}

            {/* Existing resolution */}
            {isResolved && resolution && (
              <Card className="border-green-200 dark:border-green-800">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2 text-green-700 dark:text-green-400">
                    <CheckCircle2 className="size-4" />
                    Resolution Note
                  </CardTitle>
                  <CardDescription>
                    Resolved on{" "}
                    {new Date(resolution.resolved_at).toLocaleDateString(
                      "en-IN",
                      { day: "numeric", month: "long", year: "numeric" },
                    )}
                    {resolverName ? ` by ${resolverName}` : ""}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm leading-relaxed whitespace-pre-wrap text-foreground">
                    {resolution.resolution_text}
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Admin action form — only shown when complaint is not yet resolved/rejected */}
            {!isResolved && complaint.status !== "rejected" && (
              <AdminResolutionForm
                complaintId={complaint.id}
                currentStatus={complaint.status}
                departments={allDepartments}
                currentDepartmentId={complaint.department_id}
              />
            )}

            {/* Re-open or reject actions for super admin on resolved complaints */}
            {(isResolved || complaint.status === "rejected") &&
              profile.role === "system_super_admin" && (
                <AdminResolutionForm
                  complaintId={complaint.id}
                  currentStatus={complaint.status}
                  allowReopen
                />
              )}
          </div>

          {/* ── Right column: metadata ─────────────────────────────────────── */}
          <div className="space-y-4">
            {/* Citizen info */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <User2 className="size-4" />
                  Filed By
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <InfoRow
                  icon={<User2 className="size-4" />}
                  label="Name"
                  value={citizen?.name ?? "Unknown"}
                />
                <InfoRow
                  icon={<User2 className="size-4" />}
                  label="Email"
                  value={
                    <span className="font-mono text-xs">
                      {citizen?.email ?? "—"}
                    </span>
                  }
                />
                <InfoRow
                  icon={<CalendarDays className="size-4" />}
                  label="Filed On"
                  value={new Date(complaint.created_at).toLocaleDateString(
                    "en-IN",
                    { day: "numeric", month: "long", year: "numeric" },
                  )}
                />
                {complaint.updated_at !== complaint.created_at && (
                  <InfoRow
                    icon={<CalendarDays className="size-4" />}
                    label="Last Updated"
                    value={new Date(complaint.updated_at).toLocaleDateString(
                      "en-IN",
                      { day: "numeric", month: "long", year: "numeric" },
                    )}
                  />
                )}
              </CardContent>
            </Card>

            {/* Location */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <MapPin className="size-4" />
                  Location
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <InfoRow
                  icon={<MapPin className="size-4" />}
                  label="Landmark / Address"
                  value={complaint.address_landmark}
                />
                <InfoRow
                  icon={<MapPin className="size-4" />}
                  label="Pincode"
                  value={complaint.pincode}
                />
                {complaint.municipal_ward && (
                  <InfoRow
                    icon={<MapPin className="size-4" />}
                    label="Municipal Ward (AI)"
                    value={complaint.municipal_ward}
                  />
                )}
                {complaint.latitude !== null &&
                  complaint.longitude !== null && (
                    <InfoRow
                      icon={<MapPin className="size-4" />}
                      label="GPS Co-ordinates"
                      value={
                        <span className="font-mono text-xs">
                          {complaint.latitude?.toFixed(5)},{" "}
                          {complaint.longitude?.toFixed(5)}
                        </span>
                      }
                    />
                  )}
              </CardContent>
            </Card>

            {/* AI Routing */}
            <Card
              className={
                isAiProcessed
                  ? "border-blue-200 dark:border-blue-800"
                  : "border-dashed"
              }
            >
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <ShieldAlert className="size-4" />
                  AI Routing
                </CardTitle>
                {!isAiProcessed && (
                  <CardDescription className="flex items-center gap-1.5">
                    <Clock className="size-3" />
                    Not yet processed
                  </CardDescription>
                )}
              </CardHeader>
              <CardContent className="space-y-3">
                {department && (
                  <InfoRow
                    icon={<Building2 className="size-4" />}
                    label="Assigned Department"
                    value={department.name}
                  />
                )}
                {complaint.category && (
                  <InfoRow
                    icon={<Tag className="size-4" />}
                    label="Category"
                    value={complaint.category}
                  />
                )}
                {complaint.priority && (
                  <InfoRow
                    icon={<ShieldAlert className="size-4" />}
                    label="Priority"
                    value={
                      <Badge className={priorityBadgeClass(complaint.priority)}>
                        {complaint.priority}
                      </Badge>
                    }
                  />
                )}
                {complaint.ai_confidence_score !== null &&
                  complaint.ai_confidence_score !== undefined && (
                    <InfoRow
                      icon={<ShieldAlert className="size-4" />}
                      label="AI Confidence"
                      value={`${Math.round((complaint.ai_confidence_score ?? 0) * 100)}%`}
                    />
                  )}
                {!isAiProcessed && (
                  <p className="text-xs text-muted-foreground">
                    AI routing fields are empty. The pipeline may not have run
                    yet.
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
