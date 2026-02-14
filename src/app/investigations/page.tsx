import Link from "next/link";
import { connection } from "next/server";

import { AnimatedGradientText } from "@/components/ui/animated-gradient-text";
import type { InvestigationStatus } from "@/lib/domain";
import { db } from "@/lib/db";
import { fromDbInvestigationStatus } from "@/lib/mappers";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { GridPattern } from "@/components/ui/grid-pattern";
import { ShineBorder } from "@/components/ui/shine-border";

const STATUS_VARIANT: Record<InvestigationStatus, "default" | "secondary" | "destructive" | "outline"> = {
  draft: "outline",
  running: "secondary",
  completed: "default",
  failed: "destructive",
};

export default async function InvestigationsPage() {
  await connection();

  const investigations = await db.investigation
    .findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
      select: {
        id: true,
        requirement: true,
        status: true,
        createdAt: true,
        completedAt: true,
        _count: {
          select: { calls: true },
        },
      },
    })
    .catch(() => null);

  return (
    <main className="relative mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-6xl flex-col gap-6 px-6 py-10">
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <GridPattern
          width={40}
          height={40}
          x={-1}
          y={-1}
          className="text-primary/10 mask-[radial-gradient(circle_at_center,white,transparent_82%)]"
        />
      </div>

      <header className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          Investigation <AnimatedGradientText speed={1.1}>History</AnimatedGradientText>
        </h1>
        <p className="text-sm text-muted-foreground sm:text-base">
          Browse recent investigations, check status, and jump into live progress or final results.
        </p>
      </header>

      {investigations === null ? (
        <Card className="relative overflow-hidden border-border/70 bg-card/75 shadow-lg backdrop-blur-sm">
          <ShineBorder borderWidth={1} duration={12} shineColor={["#16a34a", "#84cc16"]} />
          <CardContent className="py-6">
            <p className="text-sm text-muted-foreground">
              Could not load investigations. Ensure Postgres is running and try again.
            </p>
          </CardContent>
        </Card>
      ) : null}

      {investigations?.length === 0 ? (
        <Card className="relative overflow-hidden border-border/70 bg-card/75 shadow-lg backdrop-blur-sm">
          <ShineBorder borderWidth={1} duration={12} shineColor={["#16a34a", "#84cc16"]} />
          <CardHeader>
            <CardTitle>No investigations yet</CardTitle>
            <CardDescription>Create your first investigation to start making calls.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link href="/">Create Investigation</Link>
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {investigations && investigations.length > 0 ? (
        <Card className="relative overflow-hidden border-border/70 bg-card/75 shadow-xl backdrop-blur-sm">
          <ShineBorder borderWidth={1} duration={10} shineColor={["#84cc16", "#16a34a"]} />
          <CardHeader>
            <CardTitle>History</CardTitle>
            <CardDescription>Latest 100 investigations.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {investigations.map((investigation) => {
              const status = fromDbInvestigationStatus(investigation.status);
              const requirementPreview = compactRequirement(investigation.requirement);
              const createdAt = formatDate(investigation.createdAt);
              const completedAt = investigation.completedAt ? formatDate(investigation.completedAt) : null;

              return (
                <div
                  key={investigation.id}
                  className="group flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/70 bg-background/70 p-4 transition-all hover:-translate-y-0.5 hover:border-primary/35 hover:shadow-md"
                >
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={STATUS_VARIANT[status]} className="capitalize">
                        {status}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {investigation._count.calls} calls
                      </span>
                    </div>
                    <p className="truncate text-sm font-medium text-foreground">
                      {requirementPreview || "Untitled requirement"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Created {createdAt}
                      {completedAt ? ` • Completed ${completedAt}` : ""}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button asChild variant="outline">
                      <Link href={`/investigations/${investigation.id}/live`}>Open Live</Link>
                    </Button>
                    {status === "completed" ? (
                      <Button asChild>
                        <Link href={`/investigations/${investigation.id}/results`}>View Results</Link>
                      </Button>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      ) : null}
    </main>
  );
}

function compactRequirement(value: string) {
  const firstLine = value.split(/\r?\n/)[0]?.trim() ?? "";
  if (firstLine.length <= 160) {
    return firstLine;
  }
  return `${firstLine.slice(0, 157)}...`;
}

function formatDate(value: Date) {
  return value.toLocaleString([], {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
