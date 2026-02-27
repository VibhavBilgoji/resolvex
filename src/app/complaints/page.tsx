import { redirect } from "next/navigation";
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
import {
  ArrowLeft,
  Plus,
  Clock,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  MapPin,
  CalendarDays,
  Tag,
  Building2,
  FileX,
} from "lucide-react";
import type { Complaint, Department } from "@/types/database";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "My Complaints — ResolveX",
  description: "View and track all your submitted civic complaints.",
};

type FilterStatus = "all" | "open" | "in_progress" | "resolved" | "rejected";

interface ComplaintsPageProps {
  searchParams: Promise<{ status?: string }>;
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
      return "";
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

const FILTER_TABS: { label: string; value: FilterStatus }[] = [
  { label: "All", value: "all" },
  { label: "Open", value: "open" },
  { label: "In Progress", value: "in_progress" },
  { label: "Resolved", value: "resolved" },
  { label: "Rejected", value: "rejected" },
];

export default async function ComplaintsPage({
  searchParams,
}: ComplaintsPageProps) {
  const { status: statusParam } = await searchParams;

  const user = await getUser();
  if (!user) {
    redirect("/auth/login?redirect=/complaints");
  }

  const activeFilter: FilterStatus =
    statusParam &&
    ["open", "in_progress", "resolved", "rejected"].includes(statusParam)
      ? (statusParam as FilterStatus)
      : "all";

  const supabase = await createClient();

  // Build query with optional status filter
  let query = supabase
    .from("complaints")
    .select("*")
    .eq("citizen_id", user.id)
    .order("created_at", { ascending: false });

  if (activeFilter !== "all") {
    query = query.eq("status", activeFilter);
  }

  const { data: complaintsData } = await query;
  const complaints = (complaintsData ?? []) as Complaint[];

  // Fetch department names for complaints that have a department
  const departmentIds = [
    ...new Set(
      complaints
        .map((c) => c.department_id)
        .filter((id): id is string => id !== null),
    ),
  ];

  let departmentMap: Record<string, string> = {};
  if (departmentIds.length > 0) {
    const { data: deptData } = await supabase
      .from("departments")
      .select("id, name")
      .in("id", departmentIds);

    if (deptData) {
      departmentMap = (deptData as Pick<Department, "id" | "name">[]).reduce(
        (acc, dept) => {
          acc[dept.id] = dept.name;
          return acc;
        },
        {} as Record<string, string>,
      );
    }
  }

  // Counts per status for tab badges
  const { data: allComplaints } = await supabase
    .from("complaints")
    .select("status")
    .eq("citizen_id", user.id);

  const countByStatus = (allComplaints ?? []).reduce(
    (acc: Record<string, number>, c: { status: string }) => {
      acc[c.status] = (acc[c.status] ?? 0) + 1;
      return acc;
    },
    {},
  );

  const totalCount = allComplaints?.length ?? 0;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <Link href="/dashboard">
                <Button variant="ghost" size="sm">
                  <ArrowLeft className="size-4" />
                  Dashboard
                </Button>
              </Link>
              <div>
                <h1 className="text-xl font-bold text-gray-900 dark:text-white">
                  My Complaints
                </h1>
                <p className="text-sm text-muted-foreground">
                  {totalCount} complaint{totalCount !== 1 ? "s" : ""} filed
                </p>
              </div>
            </div>
            <Link href="/complaints/new">
              <Button size="sm">
                <Plus className="size-4" />
                New Complaint
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Filter tabs */}
        <div className="flex gap-1.5 flex-wrap">
          {FILTER_TABS.map((tab) => {
            const count =
              tab.value === "all" ? totalCount : (countByStatus[tab.value] ?? 0);
            const isActive = activeFilter === tab.value;
            return (
              <Link
                key={tab.value}
                href={
                  tab.value === "all"
                    ? "/complaints"
                    : `/complaints?status=${tab.value}`
                }
              >
                <button
                  className={`
                    inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors
                    ${
                      isActive
                        ? "bg-gray-900 text-white dark:bg-white dark:text-gray-900"
                        : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700"
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
                            ? "bg-white/20 text-white dark:bg-black/20 dark:text-gray-900"
                            : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400"
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

        {/* Complaints list */}
        {complaints.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16 gap-4">
              <div className="p-4 rounded-full bg-gray-100 dark:bg-gray-800">
                <FileX className="size-8 text-muted-foreground" />
              </div>
              <div className="text-center">
                <p className="font-semibold text-gray-900 dark:text-white">
                  {activeFilter === "all"
                    ? "No complaints yet"
                    : `No ${activeFilter.replace("_", " ")} complaints`}
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  {activeFilter === "all"
                    ? "You haven't filed any complaints yet. Get started below."
                    : "Try a different filter to see other complaints."}
                </p>
              </div>
              {activeFilter === "all" && (
                <Link href="/complaints/new">
                  <Button>
                    <Plus className="size-4" />
                    File Your First Complaint
                  </Button>
                </Link>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {complaints.map((complaint) => (
              <Link key={complaint.id} href={`/complaints/${complaint.id}`}>
                <Card className="hover:shadow-md transition-shadow cursor-pointer group">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <CardTitle className="text-base group-hover:text-primary transition-colors truncate">
                          {complaint.title}
                        </CardTitle>
                        <CardDescription className="mt-1 line-clamp-2 text-sm">
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
                      {/* Location */}
                      <span className="flex items-center gap-1.5">
                        <MapPin className="size-3.5 shrink-0" />
                        <span className="truncate max-w-[200px]">
                          {complaint.municipal_ward
                            ? `${complaint.municipal_ward}, `
                            : ""}
                          {complaint.pincode}
                        </span>
                      </span>

                      {/* Department */}
                      {complaint.department_id &&
                        departmentMap[complaint.department_id] && (
                          <span className="flex items-center gap-1.5">
                            <Building2 className="size-3.5 shrink-0" />
                            {departmentMap[complaint.department_id]}
                          </span>
                        )}

                      {/* Category */}
                      {complaint.category && (
                        <span className="flex items-center gap-1.5">
                          <Tag className="size-3.5 shrink-0" />
                          {complaint.category}
                        </span>
                      )}

                      {/* Filed date */}
                      <span className="flex items-center gap-1.5 ml-auto">
                        <CalendarDays className="size-3.5 shrink-0" />
                        {new Date(complaint.created_at).toLocaleDateString(
                          "en-IN",
                          {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          },
                        )}
                      </span>
                    </div>

                    {/* Priority badge row */}
                    {complaint.priority && (
                      <div className="mt-3 flex items-center gap-2">
                        <Badge
                          className={priorityBadgeClass(complaint.priority)}
                        >
                          {complaint.priority} priority
                        </Badge>
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