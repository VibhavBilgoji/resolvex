"use client";

import { ErrorPage } from "@/components/ui/error-page";

export default function AdminError({
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
      title="Admin dashboard failed to load"
      description="We couldn't load the admin dashboard. This is usually a temporary issue — please try again."
      backHref="/admin"
      backLabel="Retry Dashboard"
    />
  );
}