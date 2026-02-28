"use client";

import { ErrorPage } from "@/components/ui/error-page";

export default function AdminComplaintDetailError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <ErrorPage
      error={error}
      reset={reset}
      title="Couldn't load complaint details"
      description="We had trouble loading this complaint. It may have been removed or you may not have permission to view it."
      backHref="/admin/complaints"
      backLabel="Back to Complaints List"
    />
  );
}