"use client";

import { ErrorPage } from "@/components/ui/error-page";

export default function ComplaintDetailError({
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
      title="Couldn't load complaint"
      description="We had trouble loading this complaint. It may have been removed or you may not have permission to view it."
      backHref="/complaints"
      backLabel="Back to My Complaints"
    />
  );
}