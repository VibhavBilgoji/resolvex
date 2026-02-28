import { redirect } from "next/navigation";
import Link from "next/link";
import { getUser } from "@/lib/auth/utils";
import { createClient } from "@/lib/supabase/server";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { ThemeToggle } from "@/components/ui/theme-toggle";

interface ComplaintRow {
  id: string;
  title: string;
  status: string;
  priority: string | null;
  category: string | null;
  created_at: string;
  department_id: string | null;
}

export default async function DashboardPage() {
  const user = await getUser();

  if (!user) {
    redirect("/auth/login");
  }

  const supabase = await createClient();

  // Fetch user's complaints
  const { data: complaintsData } = await supabase
    .from("complaints")
    .select(
      `
      id,
      title,
      status,
      priority,
      category,
      created_at,
      department_id
    `,
    )
    .eq("citizen_id", user.id)
    .order("created_at", { ascending: false })
    .limit(10);

  const complaints = complaintsData as ComplaintRow[] | null;

  // Fetch department names for complaints
  const departmentIds = complaints
    ?.map((c) => c.department_id)
    .filter((id): id is string => id !== null);

  let departmentMap: Record<string, string> = {};
  if (departmentIds && departmentIds.length > 0) {
    const { data: deptData } = await supabase
      .from("departments")
      .select("id, name")
      .in("id", departmentIds);

    if (deptData) {
      departmentMap = deptData.reduce(
        (acc: Record<string, string>, dept: { id: string; name: string }) => {
          acc[dept.id] = dept.name;
          return acc;
        },
        {},
      );
    }
  }

  // Get complaint statistics
  const { count: totalComplaints } = await supabase
    .from("complaints")
    .select("*", { count: "exact", head: true })
    .eq("citizen_id", user.id);

  const { count: openComplaints } = await supabase
    .from("complaints")
    .select("*", { count: "exact", head: true })
    .eq("citizen_id", user.id)
    .eq("status", "open");

  const { count: resolvedComplaints } = await supabase
    .from("complaints")
    .select("*", { count: "exact", head: true })
    .eq("citizen_id", user.id)
    .eq("status", "resolved");

  const getStatusColor = (status: string): string => {
    switch (status) {
      case "open":
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200";
      case "in_progress":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200";
      case "resolved":
        return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
      case "rejected":
        return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200";
    }
  };

  const getPriorityColor = (priority: string | null): string => {
    switch (priority) {
      case "critical":
        return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200";
      case "high":
        return "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200";
      case "medium":
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200";
      case "low":
        return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200";
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-foreground">
                Welcome, {user.name}
              </h1>
              <p className="text-sm text-muted-foreground">
                Citizen Dashboard
              </p>
            </div>
            <div className="flex items-center gap-4">
              <ThemeToggle />
              <Link href="/complaints/new">
                <Button>File New Complaint</Button>
              </Link>
              <SignOutButton />
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total Complaints</CardDescription>
              <CardTitle className="text-4xl">{totalComplaints ?? 0}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">
                All complaints you have filed
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Open / In Progress</CardDescription>
              <CardTitle className="text-4xl text-yellow-600">
                {openComplaints ?? 0}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">
                Awaiting resolution
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Resolved</CardDescription>
              <CardTitle className="text-4xl text-green-600">
                {resolvedComplaints ?? 0}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">
                Successfully resolved
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Recent Complaints */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Recent Complaints</CardTitle>
                <CardDescription>
                  Your most recent complaint submissions
                </CardDescription>
              </div>
              <Link href="/complaints">
                <Button variant="outline" size="sm">
                  View All
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {complaints && complaints.length > 0 ? (
              <div className="space-y-4">
                {complaints.map((complaint) => (
                  <Link
                    key={complaint.id}
                    href={`/complaints/${complaint.id}`}
                    className="flex items-center justify-between p-4 border border-border rounded-lg hover:bg-muted/50 transition-colors group"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate group-hover:text-primary transition-colors">
                        {complaint.title}
                      </p>
                      <div className="flex items-center gap-1.5 mt-0.5 text-xs text-muted-foreground">
                        {complaint.category && (
                          <span>{complaint.category}</span>
                        )}
                        {complaint.department_id &&
                          departmentMap[complaint.department_id] && (
                            <>
                              <span>•</span>
                              <span>{departmentMap[complaint.department_id]}</span>
                            </>
                          )}
                        <span>•</span>
                        <span>
                          {new Date(complaint.created_at).toLocaleDateString("en-IN", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0 ml-4">
                      {complaint.priority && (
                        <Badge className={getPriorityColor(complaint.priority)}>
                          {complaint.priority}
                        </Badge>
                      )}
                      <Badge className={getStatusColor(complaint.status)}>
                        {complaint.status.replace("_", " ")}
                      </Badge>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <p className="text-muted-foreground mb-4">
                  You haven&apos;t filed any complaints yet.
                </p>
                <Link href="/complaints/new">
                  <Button>File Your First Complaint</Button>
                </Link>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
