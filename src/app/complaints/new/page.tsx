import { redirect } from "next/navigation";
import Link from "next/link";
import { getUser } from "@/lib/auth/utils";
import { ComplaintForm } from "@/components/complaints/complaint-form";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { ArrowLeft } from "lucide-react";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "File a Complaint — ResolveX",
  description: "Submit a new civic complaint for AI-powered routing and resolution.",
};

export default async function NewComplaintPage() {
  const user = await getUser();

  if (!user) {
    redirect("/auth/login?redirect=/complaints/new");
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card border-b border-border">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/dashboard">
                <Button variant="ghost" size="sm">
                  <ArrowLeft className="size-4" />
                  Back
                </Button>
              </Link>
              <div>
                <h1 className="text-xl font-bold text-foreground">
                  File a New Complaint
                </h1>
                <p className="text-sm text-muted-foreground">
                  Your complaint will be automatically routed to the right department using AI.
                </p>
              </div>
            </div>
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* Form */}
      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-card rounded-xl border border-border shadow-sm p-6 sm:p-8">
          <ComplaintForm />
        </div>

        <p className="text-center text-xs text-muted-foreground mt-6">
          Complaints are processed securely. Your personal information is protected under our privacy policy.
        </p>
      </main>
    </div>
  );
}
