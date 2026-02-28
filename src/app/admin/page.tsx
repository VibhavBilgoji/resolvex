import { redirect } from "next/navigation";
import Link from "next/link";
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
import type { User, Department, Complaint } from "@/types/database";

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
  let complaints: Complaint[] = [];
  let totalComplaints = 0;
  let openComplaints = 0;
  let inProgressComplaints = 0;
  let resolvedComplaints = 0;

  // Only query complaints if department_id exists
  if (profile.department_id) {
    // Get complaints for this department
    const { data: complaintsData } = await supabase
      .from("complaints")
      .select("*")
      .eq("department_id", profile.department_id)
      .order("created_at", { ascending: false })
      .limit(10);

    complaints = (complaintsData as Complaint[]) ?? [];

    // Get complaint stats
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

  const getStatusColor = (status: string): string => {
    switch (status) {
      case "open":
        return "bg-yellow-100 text-yellow-800";
      case "in_progress":
        return "bg-blue-100 text-blue-800";
      case "resolved":
        return "bg-green-100 text-green-800";
      case "rejected":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getPriorityColor = (priority: string | null): string => {
    switch (priority) {
      case "critical":
        return "bg-red-100 text-red-800";
      case "high":
        return "bg-orange-100 text-orange-800";
      case "medium":
        return "bg-yellow-100 text-yellow-800";
      case "low":
        return "bg-green-100 text-green-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card border-b border-border shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-foreground">
                Department Admin Dashboard
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                {department?.name ?? "Department"} • Welcome, {profile.name}
              </p>
            </div>
            <div className="flex items-center gap-4">
              <Badge variant="outline">{profile.role.replace("_", " ")}</Badge>
              <ThemeToggle />
              <SignOutButton />
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {!profile.department_id && (
          <Card className="mb-8">
            <CardContent className="pt-6">
              <p className="text-center text-muted-foreground">
                You are not assigned to any department yet. Please contact a
                super admin to assign you to a department.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total Complaints</CardDescription>
              <CardTitle className="text-3xl">{totalComplaints}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Open</CardDescription>
              <CardTitle className="text-3xl text-yellow-600">
                {openComplaints}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>In Progress</CardDescription>
              <CardTitle className="text-3xl text-blue-600">
                {inProgressComplaints}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Resolved</CardDescription>
              <CardTitle className="text-3xl text-green-600">
                {resolvedComplaints}
              </CardTitle>
            </CardHeader>
          </Card>
        </div>

        {/* Recent Complaints */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Recent Complaints</CardTitle>
                <CardDescription>
                  Complaints assigned to your department
                </CardDescription>
              </div>
              <Link href="/admin/complaints">
                <Button variant="outline" size="sm">
                  View All
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {complaints.length > 0 ? (
              <div className="space-y-4">
                {complaints.map((complaint) => (
                  <Link
                    key={complaint.id}
                    href={`/admin/complaints/${complaint.id}`}
                    className="flex items-center justify-between p-4 border border-border rounded-lg hover:bg-muted/50 transition-colors group"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate group-hover:text-primary transition-colors">
                        {complaint.title}
                      </p>
                      <p className="text-sm text-muted-foreground mt-0.5 line-clamp-1">
                        {complaint.translated_text || complaint.original_text}
                      </p>
                      <div className="flex items-center gap-2 mt-1.5 text-xs text-muted-foreground">
                        {complaint.category && <span>{complaint.category}</span>}
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
              <p className="text-center text-muted-foreground py-8">
                No complaints assigned to your department yet.
              </p>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
