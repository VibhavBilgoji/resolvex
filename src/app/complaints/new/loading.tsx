import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";

export default function NewComplaintLoading() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card border-b border-border">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Skeleton className="h-9 w-20 rounded-md" />
              <div className="space-y-1">
                <Skeleton className="h-5 w-44" />
                <Skeleton className="h-4 w-72" />
              </div>
            </div>
            <Skeleton className="h-9 w-9 rounded-md" />
          </div>
        </div>
      </header>

      {/* Form skeleton */}
      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-card rounded-xl border border-border shadow-sm p-6 sm:p-8 space-y-8">

          {/* Section 1: Complaint Details */}
          <div className="space-y-5">
            <Skeleton className="h-5 w-36" />

            {/* Title field */}
            <div className="space-y-1.5">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-10 w-full rounded-md" />
            </div>

            {/* Description field */}
            <div className="space-y-1.5">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-3 w-80 mb-1" />
              <Skeleton className="h-28 w-full rounded-md" />
            </div>
          </div>

          {/* Section 2: Location */}
          <div className="space-y-5">
            <div className="space-y-1">
              <Skeleton className="h-5 w-20" />
              <Skeleton className="h-3 w-96" />
            </div>

            {/* GPS card */}
            <Card className="border-dashed">
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center justify-between gap-3">
                  <Skeleton className="h-4 w-64" />
                  <Skeleton className="h-9 w-28 rounded-md shrink-0" />
                </div>
              </CardContent>
            </Card>

            {/* Address + Pincode */}
            <div className="space-y-1.5">
              <Skeleton className="h-4 w-36" />
              <Skeleton className="h-10 w-full rounded-md" />
            </div>
            <div className="space-y-1.5">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-10 w-48 rounded-md" />
            </div>
          </div>

          {/* Section 3: Image Upload */}
          <div className="space-y-3">
            <div className="space-y-1">
              <Skeleton className="h-5 w-44" />
              <Skeleton className="h-3 w-60" />
            </div>
            <Skeleton className="h-36 w-full rounded-lg" />
          </div>

          {/* Submit row */}
          <div className="flex items-center justify-end gap-3 pt-2 border-t border-border">
            <Skeleton className="h-3 w-24 mr-auto" />
            <Skeleton className="h-11 w-40 rounded-md" />
          </div>
        </div>

        <Skeleton className="h-3 w-96 mx-auto mt-6" />
      </main>
    </div>
  );
}