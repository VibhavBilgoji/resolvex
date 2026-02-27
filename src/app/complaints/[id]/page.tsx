import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getUser } from "@/lib/auth/utils";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
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
} from "lucide-react";
import type { Complaint, Department, Resolution } from "@/types/database";

export const dynamic = "force-dynamic";

interface ComplaintDetailPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ submitted?: string }>;
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
        <div className="text-sm font-medium text-gray-900 dark:text-white break-words">
          {value}
        </div>
      </div>
    </div>
  );
}

export default async function ComplaintDetailPage({
  params,
  searchParams,
}: ComplaintDetailPageProps) {
  const { id } = await params;
  const { submitted } = await searchParams;

  const user = await getUser();
  if (!user) {
    redirect(`/auth/login?redirect=/complaints/${id}`);
  }

  const supabase = await createClient();

  const { data: complaintData, error } = await supabase
    .from("complaints")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !complaintData) {
    notFound();
  }

  const complaint = complaintData as Complaint;

  // Citizens can only view their own complaints
  if (
    user.role === "citizen" &&
    complaint.citizen_id !== user.id
  ) {
    notFound();
  }

  // Fetch department name if assigned
  let department: Pick<Department, "id" | "name"> | null = null;
  if (complaint.department_id) {
    const { data: deptData } = await supabase
      .from("departments")
      .select("id, name")
      .eq("id", complaint.department_id)
      .single();
    if (deptData) department = deptData as Pick<Department, "id" | "name">;
  }

  // Fetch resolution if resolved
  let resolution: Resolution | null = null;
  if (complaint.status === "resolved") {
    const { data: resData } = await supabase
      .from("resolutions")
      .select("id, complaint_id, resolved_by, resolution_text, resolved_at")
      .eq("complaint_id", id)
      .order("resolved_at", { ascending: false })
      .limit(1)
      .single();
    if (resData) resolution = resData as Resolution;
  }

  const isAiProcessed =
    complaint.category ||
    complaint.priority ||
    complaint.department_id ||
    complaint.municipal_ward ||
    complaint.translated_text;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-start gap-4">
            <Link href="/complaints">
              <Button variant="ghost" size="sm" className="mt-0.5">
                <ArrowLeft className="size-4" />
                My Complaints
              </Button>
            </Link>
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <h1 className="text-xl font-bold text-gray-900 dark:text-white truncate">
                  {complaint.title}
                </h1>
                <div className="flex items-center gap-1.5">
                  <StatusIcon status={complaint.status} />
                  <Badge className={statusBadgeClass(complaint.status)}>
                    {complaint.status.replace("_", " ")}
                  </Badge>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Complaint ID:{" "}
                <span className="font-mono text-gray-600 dark:text-gray-400 select-all">
                  {complaint.id}
                </span>
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Submission success banner */}
        {submitted === "true" && (
          <div className="flex items-start gap-3 p-4 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
            <CheckCircle2 className="size-5 text-green-600 dark:text-green-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-green-800 dark:text-green-300">
                Complaint submitted and routed successfully!
              </p>
              <p className="text-xs text-green-700 dark:text-green-400 mt-0.5">
                Our AI has analysed your complaint and assigned it to the right department. You can see the routing details below.
              </p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left column — main content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Description */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Complaint Description</CardTitle>
                <CardDescription>
                  Original text as submitted (may be in any language)
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm leading-relaxed whitespace-pre-wrap text-gray-800 dark:text-gray-200">
                  {complaint.original_text}
                </p>

                {complaint.translated_text &&
                  complaint.translated_text !== complaint.original_text && (
                    <>
                      <Separator className="my-4" />
                      <div>
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                          AI Translation (English)
                        </p>
                        <p className="text-sm leading-relaxed text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                          {complaint.translated_text}
                        </p>
                      </div>
                    </>
                  )}
              </CardContent>
            </Card>

            {/* Image evidence */}
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
                    className="w-full max-h-80 object-contain rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800"
                  />
                </CardContent>
              </Card>
            )}

            {/* Resolution note */}
            {resolution && (
              <Card className="border-green-200 dark:border-green-800">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2 text-green-700 dark:text-green-400">
                    <CheckCircle2 className="size-4" />
                    Resolution Note
                  </CardTitle>
                  <CardDescription>
                    Resolved on{" "}
                    {new Date(resolution.resolved_at).toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm leading-relaxed text-gray-800 dark:text-gray-200 whitespace-pre-wrap">
                    {resolution.resolution_text}
                  </p>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Right column — metadata */}
          <div className="space-y-4">
            {/* Status & dates */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Status & Dates</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <InfoRow
                  icon={<StatusIcon status={complaint.status} />}
                  label="Current Status"
                  value={
                    <Badge className={statusBadgeClass(complaint.status)}>
                      {complaint.status.replace("_", " ")}
                    </Badge>
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
              <CardContent className="space-y-4">
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
                {complaint.latitude !== null && complaint.longitude !== null && (
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
                    Routing unavailable
                  </CardDescription>
                )}
              </CardHeader>
              <CardContent className="space-y-4">
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
                    AI routing could not be completed for this complaint.
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