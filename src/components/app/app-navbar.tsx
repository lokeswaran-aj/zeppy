"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { AnimatedGradientText } from "@/components/ui/animated-gradient-text";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function AppNavbar() {
  const pathname = usePathname();
  const router = useRouter();
  const backHref = getBackHref(pathname);
  const canGoBack = pathname !== "/";

  return (
    <nav className="sticky top-0 z-50 border-b border-border/60 bg-background/80 backdrop-blur-xl supports-backdrop-filter:bg-background/70">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-6">
        <div className="flex items-center gap-2">
          {canGoBack ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                if (typeof window !== "undefined" && window.history.length > 1) {
                  router.back();
                  return;
                }
                router.push(backHref);
              }}
              className="rounded-full"
            >
              <ArrowLeft className="size-4" />
              Back
            </Button>
          ) : null}
          <Link href="/" className="inline-flex items-center gap-2">
            <span className="size-2 rounded-full bg-primary shadow-[0_0_12px_rgba(22,163,74,0.65)]" />
            <AnimatedGradientText className="text-base font-semibold tracking-tight" speed={1.1}>
              Zeppy
            </AnimatedGradientText>
          </Link>
        </div>

        <div className="flex items-center gap-1">
          <Link
            href="/"
            className={cn(
              "rounded-full px-4 py-2 text-sm font-medium text-muted-foreground transition-all hover:bg-accent/70 hover:text-foreground",
              isHomePath(pathname) && "bg-primary/10 text-foreground ring-1 ring-primary/30 shadow-sm",
            )}
          >
            New Investigation
          </Link>
          <Link
            href="/investigations"
            className={cn(
              "rounded-full px-4 py-2 text-sm font-medium text-muted-foreground transition-all hover:bg-accent/70 hover:text-foreground",
              isInvestigationsPath(pathname) && "bg-primary/10 text-foreground ring-1 ring-primary/30 shadow-sm",
            )}
          >
            Investigations
          </Link>
        </div>
      </div>
    </nav>
  );
}

function getBackHref(pathname: string) {
  if (pathname === "/" || pathname === "/investigations") {
    return "/";
  }

  const parts = pathname.split("/").filter(Boolean);
  if (parts[0] === "investigations" && parts[2] === "results" && parts[1]) {
    return `/investigations/${parts[1]}/live`;
  }

  if (parts[0] === "investigations") {
    return "/investigations";
  }

  return "/";
}

function isHomePath(pathname: string) {
  return pathname === "/";
}

function isInvestigationsPath(pathname: string) {
  return pathname === "/investigations" || pathname.startsWith("/investigations/");
}
