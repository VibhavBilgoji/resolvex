"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";

function ErrorContent() {
  const searchParams = useSearchParams();
  const error = searchParams.get("error");

  const getErrorMessage = (errorCode: string | null) => {
    switch (errorCode) {
      case "auth_callback_error":
        return {
          title: "Authentication Failed",
          description: "There was a problem signing you in. Please try again.",
        };
      case "insufficient_permissions":
        return {
          title: "Access Denied",
          description: "You don't have permission to access this page.",
        };
      case "session_expired":
        return {
          title: "Session Expired",
          description: "Your session has expired. Please sign in again.",
        };
      case "invalid_token":
        return {
          title: "Invalid Token",
          description: "The authentication token is invalid or has expired.",
        };
      default:
        return {
          title: "Something went wrong",
          description: "An unexpected error occurred. Please try again.",
        };
    }
  };

  const { title, description } = getErrorMessage(error);

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100 dark:bg-red-900">
          <svg
            className="h-6 w-6 text-red-600 dark:text-red-400"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth="1.5"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
            />
          </svg>
        </div>
        <CardTitle className="text-xl font-semibold">{title}</CardTitle>
        <CardDescription className="mt-2">{description}</CardDescription>
      </CardHeader>
      <CardContent>
        {error && (
          <div className="rounded-md bg-muted p-3 text-center">
            <code className="text-sm text-muted-foreground">
              Error code: {error}
            </code>
          </div>
        )}
      </CardContent>
      <CardFooter className="flex flex-col gap-3">
        <Link href="/auth/login" className="w-full">
          <Button className="w-full">Try Again</Button>
        </Link>
        <Link href="/" className="w-full">
          <Button variant="outline" className="w-full">
            Go to Homepage
          </Button>
        </Link>
      </CardFooter>
    </Card>
  );
}

function ErrorContentFallback() {
  return (
    <Card className="w-full max-w-md">
      <CardHeader className="text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
          <div className="animate-spin h-6 w-6 border-2 border-muted-foreground border-t-transparent rounded-full" />
        </div>
        <CardTitle className="text-xl font-semibold">Loading...</CardTitle>
      </CardHeader>
    </Card>
  );
}

export default function AuthErrorPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <React.Suspense fallback={<ErrorContentFallback />}>
        <ErrorContent />
      </React.Suspense>
    </div>
  );
}
