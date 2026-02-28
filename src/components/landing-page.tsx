"use client";

import Link from "next/link";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";

import { DotGrid } from "@/components/ui/dot-grid";

const features = [
  {
    icon: "🌐",
    title: "Multilingual Support",
    description:
      "File complaints in Hindi, Tamil, Bengali, Telugu, or any Indian language. Gemini AI translates automatically.",
  },
  {
    icon: "🤖",
    title: "AI-Powered Routing",
    description:
      "Complaints are automatically categorized, prioritized, and routed to the right department using LangChain + Gemini.",
  },
  {
    icon: "📍",
    title: "Smart Location Detection",
    description:
      "Use GPS or enter your address/pincode. AI extracts your Municipal Ward automatically.",
  },
  {
    icon: "🔁",
    title: "Self-Learning RAG Pipeline",
    description:
      "Past resolutions are vectorized into pgvector. Every resolved complaint improves future routing accuracy.",
  },
  {
    icon: "🏛️",
    title: "Department Dashboards",
    description:
      "Dedicated dashboards for Water, PWD, Electricity, and 7 more departments with ward-level filtering.",
  },
  {
    icon: "📊",
    title: "Super Admin Analytics",
    description:
      "System-wide metrics on complaint volumes, AI confidence scores, and department performance.",
  },
];

const steps = [
  {
    step: "01",
    title: "File a Complaint",
    description:
      "Describe your issue in any language with an optional photo and your location.",
  },
  {
    step: "02",
    title: "AI Routes It",
    description:
      "Gemini translates, extracts your ward, and assigns category, priority, and department.",
  },
  {
    step: "03",
    title: "Track Progress",
    description:
      "Get real-time status updates as your complaint moves from Open → In Progress → Resolved.",
  },
  {
    step: "04",
    title: "Resolution Logged",
    description:
      "The resolution is embedded into the AI's memory to help future citizens faster.",
  },
];

export default function LandingPage() {
  return (
    <div className="relative min-h-screen bg-background text-foreground">

      {/* ── DotGrid fixed full-page background ── */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <DotGrid
          dotSize={4}
          gap={28}
          useThemeColors
          proximity={120}
          speedTrigger={80}
          shockRadius={220}
          shockStrength={4}
          resistance={750}
          returnDuration={1.5}
        />
      </div>

      {/* ── All content sits above the canvas ── */}
      <div className="relative z-10">

        {/* ━━━━━ NAV ━━━━━ */}
        <header className="border-b border-border bg-card sticky top-0 z-50">
          <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xl font-bold tracking-tight">ResolveX</span>
              <Badge variant="secondary">Beta</Badge>
            </div>
            <nav className="hidden md:flex items-center gap-6 text-sm text-muted-foreground">
              <Link
                href="#features"
                className="hover:text-foreground transition-colors"
              >
                Features
              </Link>
              <Link
                href="#how-it-works"
                className="hover:text-foreground transition-colors"
              >
                How it works
              </Link>
            </nav>
            <div className="flex items-center gap-2">
              <ThemeToggle />
              <Button variant="ghost" size="sm" asChild>
                <Link href="/auth/login">Sign In</Link>
              </Button>
              <Button size="sm" asChild>
                <Link href="/auth/signup">Get Started</Link>
              </Button>
            </div>
          </div>
        </header>

        {/* ━━━━━ HERO ━━━━━ */}
        <section className="max-w-6xl mx-auto px-6 py-24 text-center">
          <Badge variant="outline" className="mb-6">
            🇮🇳 Built for Indian citizens
          </Badge>
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight leading-tight mb-6">
            Your Civic Complaint,{" "}
            <span className="text-primary">Resolved Intelligently</span>
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-10">
            ResolveX uses AI to translate your complaint from any Indian
            language, find the right government department, and learn from every
            resolution — making civic redressal faster and smarter.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button size="lg" asChild>
              <Link href="/auth/signup">File a Complaint</Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link href="/auth/login">Track Your Complaint</Link>
            </Button>
          </div>
        </section>

        {/* ━━━━━ FEATURES ━━━━━ */}
        <section id="features" className="max-w-6xl mx-auto px-6 py-24">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-bold tracking-tight mb-3">
              Everything you need
            </h2>
            <p className="text-muted-foreground text-lg max-w-xl mx-auto">
              From multilingual input to AI-driven routing, ResolveX handles the
              complexity so citizens and officials don&apos;t have to.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((f) => (
              <Card
                key={f.title}
                className="bg-background/70 backdrop-blur-sm border-border/60"
              >
                <CardHeader>
                  <div className="text-3xl mb-2">{f.icon}</div>
                  <CardTitle className="text-base">{f.title}</CardTitle>
                  <CardDescription>{f.description}</CardDescription>
                </CardHeader>
              </Card>
            ))}
          </div>
        </section>

        {/* ━━━━━ HOW IT WORKS ━━━━━ */}
        <section id="how-it-works" className="max-w-6xl mx-auto px-6 py-24">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-bold tracking-tight mb-3">
              How it works
            </h2>
            <p className="text-muted-foreground text-lg max-w-xl mx-auto">
              Four simple steps from complaint to resolution.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {steps.map((s) => (
              <Card
                key={s.step}
                className="relative bg-background/70 backdrop-blur-sm border-border/60"
              >
                <CardHeader>
                  <span className="text-4xl font-bold text-muted-foreground/30">
                    {s.step}
                  </span>
                  <CardTitle className="text-base mt-2">{s.title}</CardTitle>
                  <CardDescription>{s.description}</CardDescription>
                </CardHeader>
              </Card>
            ))}
          </div>
        </section>

        {/* ━━━━━ TECH STACK ━━━━━ */}
        <section className="max-w-6xl mx-auto px-6 py-16">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold tracking-tight mb-2">
              Powered by
            </h2>
            <p className="text-muted-foreground">
              Modern, production-grade infrastructure
            </p>
          </div>
          <div className="flex flex-wrap justify-center gap-3">
            {[
              "Next.js 16",
              "TypeScript",
              "Bun",
              "Supabase",
              "pgvector",
              "Gemini AI",
              "LangChain",
              "Tailwind CSS",
              "shadcn/ui",
            ].map((tech) => (
              <Badge key={tech} variant="secondary" className="text-sm px-3 py-1">
                {tech}
              </Badge>
            ))}
          </div>
        </section>

        {/* ━━━━━ CTA ━━━━━ */}
        <section className="max-w-6xl mx-auto px-6 py-24 text-center">
          <Card className="max-w-2xl mx-auto bg-background/70 backdrop-blur-sm border-border/60">
            <CardContent className="pt-10 pb-10">
              <h2 className="text-3xl font-bold tracking-tight mb-4">
                Ready to file your complaint?
              </h2>
              <p className="text-muted-foreground mb-8">
                Join citizens across India using ResolveX to get their civic
                issues resolved faster with the power of AI.
              </p>
              <Button size="lg" asChild>
                <Link href="/auth/signup">Get Started — it&apos;s free</Link>
              </Button>
            </CardContent>
          </Card>
        </section>

        {/* ━━━━━ FOOTER ━━━━━ */}
        <footer className="border-t border-border/60">
          <div className="max-w-6xl mx-auto px-6 py-8 flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
            <span>
              © {new Date().getFullYear()} ResolveX. Smart Citizen Grievance
              Redressal System.
            </span>
            <div className="flex gap-4">
              <Link
                href="/auth/login"
                className="hover:text-foreground transition-colors"
              >
                Sign In
              </Link>
              <Link
                href="/auth/signup"
                className="hover:text-foreground transition-colors"
              >
                Register
              </Link>
            </div>
          </div>
        </footer>

      </div>
    </div>
  );
}