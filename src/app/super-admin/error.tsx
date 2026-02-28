"use client";

import { ErrorPage } from "@/components/ui/error-page";

export default function SuperAdminError({
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
      title="Super Admin dashboard failed to load"
      description="We couldn't load the super admin dashboard. This is usually a temporary issue — please try again."
      backHref="/super-admin"
      backLabel="Retry Dashboard"
    />
  );
}