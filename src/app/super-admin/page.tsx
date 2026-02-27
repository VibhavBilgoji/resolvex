import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth/utils";
import { createClient } from "@/lib/supabase/server";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SignOutButton } from "@/components/auth/sign-out-button";

interface ComplaintRow {
  id: string;
  title: string;
  status: string;
  priority: string | null;
  category: string | null;
  created_at: string;
  ai_confidence_score: number | null;
}

interface DepartmentRow {
  id: string;
  name: string;
}

export default async function SuperAdminDashboard() {
  const user = await getUser();

  if (!user) {
    redirect("/auth/login");
  }

  if (user.role !== "system_super_admin") {
    redirect("/dashboard");
  }

  const supabase = await createClient();

  // Fetch dashboard metrics
  const [
    { count: totalComplaints },
    { count: openComplaints },
    { count: resolvedComplaints },
    { count: totalUsers },
    { data: departmentsData },
  ] = await Promise.all([
    supabase.from("complaints").select("*", { count: "exact", head: true }),
    supabase
      .from("complaints")
      .select("*", { count: "exact", head: true })
      .eq("status", "open"),
    supabase
      .from("complaints")
      .select("*", { count: "exact", head: true })
      .eq("status", "resolved"),
    supabase.from("users").select("*", { count: "exact", head: true }),
    supabase.from("departments").select("id, name"),
  ]);

  const departments = departmentsData as DepartmentRow[] | null;

  // Fetch recent complaints
  const { data: recentComplaintsData } = await supabase
    .from("complaints")
    .select(
      "id, title, status, priority, category, created_at, ai_confidence_score",
    )
    .order("created_at", { ascending: false })
    .limit(10);

  const recentComplaints = recentComplaintsData as ComplaintRow[] | null;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                Super Admin Dashboard
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Welcome back, {user.name}
              </p>
            </div>
            <div className="flex items-center gap-4">
              <Badge
                variant="secondary"
                className="bg-purple-100 text-purple-800"
              >
                Super Admin
              </Badge>
              <SignOutButton />
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Metrics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total Complaints</CardDescription>
              <CardTitle className="text-3xl">{totalComplaints ?? 0}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">All time</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Open Complaints</CardDescription>
              <CardTitle className="text-3xl text-yellow-600">
                {openComplaints ?? 0}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">Awaiting action</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Resolved</CardDescription>
              <CardTitle className="text-3xl text-green-600">
                {resolvedComplaints ?? 0}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">
                Successfully closed
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total Users</CardDescription>
              <CardTitle className="text-3xl">{totalUsers ?? 0}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">Registered users</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Recent Complaints */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle>Recent Complaints</CardTitle>
                <CardDescription>
                  Latest complaints across all departments
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {recentComplaints && recentComplaints.length > 0 ? (
                    recentComplaints.map((complaint) => (
                      <div
                        key={complaint.id}
                        className="flex items-center justify-between p-4 border rounded-lg"
                      >
                        <div className="space-y-1">
                          <p className="font-medium text-sm">
                            {complaint.title}
                          </p>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-xs">
                              {complaint.category || "Uncategorized"}
                            </Badge>
                            <Badge
                              variant={
                                complaint.status === "resolved"
                                  ? "default"
                                  : complaint.status === "open"
                                    ? "secondary"
                                    : "outline"
                              }
                              className="text-xs"
                            >
                              {complaint.status}
                            </Badge>
                            {complaint.ai_confidence_score && (
                              <span className="text-xs text-muted-foreground">
                                AI:{" "}
                                {Math.round(
                                  complaint.ai_confidence_score * 100,
                                )}
                                %
                              </span>
                            )}
                          </div>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {new Date(complaint.created_at).toLocaleDateString()}
                        </span>
                      </div>
                    ))
                  ) : (
                    <p className="text-center text-muted-foreground py-8">
                      No complaints yet
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Departments */}
          <div>
            <Card>
              <CardHeader>
                <CardTitle>Departments</CardTitle>
                <CardDescription>Registered departments</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {departments && departments.length > 0 ? (
                    departments.map((dept) => (
                      <div
                        key={dept.id}
                        className="p-3 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                      >
                        <p className="text-sm font-medium">{dept.name}</p>
                      </div>
                    ))
                  ) : (
                    <p className="text-center text-muted-foreground py-4">
                      No departments configured
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
