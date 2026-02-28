"use client";

import { ErrorPage } from "@/components/ui/error-page";

export default function ComplaintsError({
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
      title="Couldn't load complaints"
      description="We had trouble fetching your complaints. Please try again or go back to your dashboard."
      backHref="/dashboard"
      backLabel="Back to Dashboard"
    />
  );
}