import { redirect } from "next/navigation";
import Link from "next/link";
import { getUser } from "@/lib/auth/utils";
import { ComplaintForm } from "@/components/complaints/complaint-form";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export const metadata = {
  title: "File a Complaint — ResolveX",
  description: "Submit a new civic complaint for AI-powered routing and resolution.",
};

export default async function NewComplaintPage() {
  const user = await getUser();

  if (!user) {
    redirect("/auth/login?redirect=/complaints/new");
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center gap-4">
            <Link href="/dashboard">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="size-4" />
                Back
              </Button>
            </Link>
            <div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">
                File a New Complaint
              </h1>
              <p className="text-sm text-muted-foreground">
                Your complaint will be automatically routed to the right department using AI.
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Form */}
      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-6 sm:p-8">
          <ComplaintForm />
        </div>

        <p className="text-center text-xs text-muted-foreground mt-6">
          Complaints are processed securely. Your personal information is protected under our privacy policy.
        </p>
      </main>
    </div>
  );
}