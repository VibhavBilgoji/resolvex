"use client";

import { ErrorPage } from "@/components/ui/error-page";

export default function AdminComplaintsError({
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
      title="Couldn't load complaints list"
      description="We had trouble fetching the complaints for your department. Please try again or return to the admin dashboard."
      backHref="/admin"
      backLabel="Back to Admin Dashboard"
    />
  );
}