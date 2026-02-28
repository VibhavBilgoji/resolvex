"use client";

import Link from "next/link";
import { AlertTriangle, RefreshCw, Home, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface ErrorPageProps {
  /** The error object passed from the Next.js error boundary */
  error: Error & { digest?: string };
  /** The reset function provided by Next.js to retry rendering */
  reset: () => void;
  /** Optional override for the heading */
  title?: string;
  /** Optional override for the supporting description */
  description?: string;
  /** Where the "Go back" button should navigate. Defaults to "/" */
  backHref?: string;
  /** Label for the back button. Defaults to "Go to Homepage" */
  backLabel?: string;
}

/**
 * Reusable full-page error component designed to be used inside Next.js
 * `error.tsx` Client Component boundaries.
 *
 * Usage:
 * ```
 * // src/app/some-route/error.tsx
 * "use client";
 * import { ErrorPage } from "@/components/ui/error-page";
 * export default function SomeRouteError({ error, reset }: { error: Error; reset: () => void }) {
 *   return <ErrorPage error={error} reset={reset} backHref="/dashboard" backLabel="Back to Dashboard" />;
 * }
 * ```
 */
export function ErrorPage({
  error,
  reset,
  title = "Something went wrong",
  description = "An unexpected error occurred while loading this page. You can try again or navigate back to safety.",
  backHref = "/",
  backLabel = "Go to Homepage",
}: ErrorPageProps) {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4 py-16">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center pb-4">
          {/* Icon */}
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
            <AlertTriangle className="h-7 w-7 text-red-600 dark:text-red-400" />
          </div>

          <CardTitle className="text-xl font-semibold">{title}</CardTitle>
          <CardDescription className="mt-2 leading-relaxed">
            {description}
          </CardDescription>
        </CardHeader>

        {/* Error digest for support reference — shown only when present */}
        {error.digest && (
          <CardContent className="py-0">
            <div className="rounded-md bg-muted px-4 py-3 text-center">
              <p className="text-xs text-muted-foreground">
                Error reference:{" "}
                <span className="font-mono font-medium text-foreground select-all">
                  {error.digest}
                </span>
              </p>
            </div>
          </CardContent>
        )}

        <CardFooter className="flex flex-col gap-3 pt-6">
          {/* Primary: retry */}
          <Button className="w-full" onClick={reset}>
            <RefreshCw className="size-4" />
            Try Again
          </Button>

          {/* Secondary: navigate back */}
          <Button variant="outline" className="w-full" asChild>
            <Link href={backHref}>
              {backHref === "/" ? (
                <Home className="size-4" />
              ) : (
                <ArrowLeft className="size-4" />
              )}
              {backLabel}
            </Link>
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}