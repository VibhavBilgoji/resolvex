"use client";

import { ErrorPage } from "@/components/ui/error-page";

export default function DashboardError({
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
      title="Dashboard failed to load"
      description="We couldn't load your dashboard. This is usually a temporary issue — please try again."
      backHref="/"
      backLabel="Go to Homepage"
    />
  );
}