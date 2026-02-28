import Link from "next/link";
import { FileQuestion, Home, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4 py-16">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center pb-4">
          {/* Icon */}
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-muted">
            <FileQuestion className="h-7 w-7 text-muted-foreground" />
          </div>

          {/* 404 accent */}
          <p className="text-5xl font-bold text-muted-foreground/30 mb-2 leading-none">
            404
          </p>

          <CardTitle className="text-xl font-semibold">
            Page not found
          </CardTitle>
          <CardDescription className="mt-2 leading-relaxed">
            The page you&apos;re looking for doesn&apos;t exist or has been
            moved. Double-check the URL or navigate back to safety.
          </CardDescription>
        </CardHeader>

        <CardContent className="py-0">
          <div className="rounded-md bg-muted px-4 py-3 text-center">
            <p className="text-xs text-muted-foreground">
              If you followed a link inside ResolveX, please{" "}
              <Link
                href="mailto:support@resolvex.in"
                className="underline underline-offset-2 hover:text-foreground transition-colors"
              >
                report it
              </Link>{" "}
              so we can fix it.
            </p>
          </div>
        </CardContent>

        <CardFooter className="flex flex-col gap-3 pt-6">
          <Button className="w-full" asChild>
            <Link href="/">
              <Home className="size-4" />
              Go to Homepage
            </Link>
          </Button>

          <Button variant="outline" className="w-full" asChild>
            <Link href="/dashboard">
              <ArrowLeft className="size-4" />
              Back to Dashboard
            </Link>
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}