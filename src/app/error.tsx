"use client";

import { ErrorPage } from "@/components/ui/error-page";

export default function GlobalError({
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
      title="Something went wrong"
      description="An unexpected error occurred. Please try again or return to the homepage."
      backHref="/"
      backLabel="Go to Homepage"
    />
  );
}