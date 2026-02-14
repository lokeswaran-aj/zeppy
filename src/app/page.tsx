"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CircleCheckBig, ListChecks, PhoneCall, Sparkles } from "lucide-react";

import { AnimatedGradientText } from "@/components/ui/animated-gradient-text";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { GridPattern } from "@/components/ui/grid-pattern";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ShineBorder } from "@/components/ui/shine-border";
import { ShimmerButton } from "@/components/ui/shimmer-button";
import { Textarea } from "@/components/ui/textarea";
import type { ParsedIntakePreview } from "@/lib/domain";

export default function Home() {
  const router = useRouter();
  const [inputText, setInputText] = useState("");
  const [voiceAgentName, setVoiceAgentName] = useState("");
  const [preview, setPreview] = useState<ParsedIntakePreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [parsing, setParsing] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const canSubmit = inputText.trim().length > 12;
  const effectiveVoiceAgentName = voiceAgentName.trim() || "assistant";

  const extractPreview = async (event?: React.FormEvent<HTMLFormElement>) => {
    event?.preventDefault();
    if (!canSubmit) {
      return;
    }
    setParsing(true);
    setError(null);
    setPreview(null);

    try {
      const parseResponse = await fetch("/api/intake/parse", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          inputText,
        }),
      });

      const payload = (await parseResponse.json().catch(() => null)) as
        | (ParsedIntakePreview & { error?: string })
        | null;
      if (!parseResponse.ok) {
        throw new Error(payload?.error ?? "Could not extract details from input.");
      }
      if (!payload) {
        throw new Error("Parser did not return extracted details.");
      }

      setPreview({
        requirement: payload.requirement,
        contacts: payload.contacts,
        questionHints: payload.questionHints ?? [],
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not extract details.");
    } finally {
      setParsing(false);
    }
  };

  const startInvestigation = async () => {
    if (!preview) {
      setError("Extract and review details first.");
      return;
    }
    if (!voiceAgentName.trim()) {
      setError("Enter a Voice Agent Name so the AI introduces itself with your name.");
      return;
    }
    setSubmitting(true);
    setError(null);

    try {
      const createResponse = await fetch("/api/investigations", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          requirement: preview.requirement,
          contacts: preview.contacts,
          questionHints: preview.questionHints,
        }),
      });

      if (!createResponse.ok) {
        const payload = (await createResponse.json().catch(() => null)) as
          | { error?: string }
          | null;
        throw new Error(payload?.error ?? "Could not create investigation.");
      }

      const createPayload = (await createResponse.json()) as { investigationId: string };
      const investigationId = createPayload.investigationId;

      const startResponse = await fetch(`/api/investigations/${investigationId}/start`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          agentName: effectiveVoiceAgentName,
        }),
      });

      if (!startResponse.ok) {
        throw new Error("Investigation was created but could not start.");
      }

      router.push(`/investigations/${investigationId}/live`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to start investigation.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="relative mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-6xl flex-col gap-8 px-6 py-10">
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <GridPattern
          width={36}
          height={36}
          x={-1}
          y={-1}
          className="text-primary/10 mask-[radial-gradient(circle_at_center,white,transparent_80%)]"
        />
        <div className="absolute inset-x-0 top-0 h-56 bg-linear-to-b from-primary/15 to-transparent" />
      </div>

      <header className="space-y-4">
        <Badge
          variant="secondary"
          className="w-fit gap-1.5 rounded-full border border-border/60 bg-background/70 px-3 py-1 text-xs"
        >
          <Sparkles className="size-3.5" />
          AI-powered outbound investigations
        </Badge>
        <h1 className="max-w-3xl text-3xl font-semibold tracking-tight sm:text-4xl">
          Create an <AnimatedGradientText speed={1.1}>investigation brief</AnimatedGradientText> and launch
          multilingual calls in minutes.
        </h1>
        <p className="max-w-2xl text-sm text-muted-foreground sm:text-base">
          Paste your requirement, contacts, and optional questions. We extract structure first so you can review
          details before any call starts.
        </p>
        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
          <div className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-background/70 px-3 py-1">
            <PhoneCall className="size-3.5" />
            multilingual calls
          </div>
          <div className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-background/70 px-3 py-1">
            <ListChecks className="size-3.5" />
            structured extraction
          </div>
          <div className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-background/70 px-3 py-1">
            <CircleCheckBig className="size-3.5" />
            review before launch
          </div>
        </div>
      </header>

      <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <Card className="relative overflow-hidden border-border/70 bg-card/75 shadow-xl backdrop-blur-sm">
          <ShineBorder borderWidth={1} duration={12} shineColor={["#16a34a", "#84cc16"]} />
          <CardHeader className="space-y-2">
            <CardTitle className="text-xl">Create Investigation</CardTitle>
            <CardDescription>Share your complete brief and generate a structured preview.</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-6" onSubmit={extractPreview}>
              <div className="space-y-2">
                <Label htmlFor="voiceAgentName">Voice Agent Name</Label>
                <Input
                  id="voiceAgentName"
                  value={voiceAgentName}
                  onChange={(event) => setVoiceAgentName(event.target.value)}
                  placeholder="Enter the name agent should use (e.g., Loki)"
                  className="border-border/70 bg-background/70 shadow-sm"
                />
                <p className="text-xs text-muted-foreground">
                  This is used only for this launch and is not saved in the database.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="inputText">Briefing</Label>
                <Textarea
                  id="inputText"
                  className="min-h-56 resize-y border-border/70 bg-background/70 shadow-sm"
                  placeholder={[
                    "Example",
                    "Need a PG in Koramangala under 15k with food.",
                    "Contacts:",
                    "Asha PG, +919900001111, Tamil",
                    "Rahul (City Stay), +919900002222",
                    "Questions: deposit, curfew, move-in date",
                  ].join("\n")}
                  value={inputText}
                  onChange={(event) => {
                    setInputText(event.target.value);
                    setPreview(null);
                    setError(null);
                  }}
                  rows={11}
                />
                <p className="text-xs text-muted-foreground">
                  Include at least one phone number. Language is optional.
                </p>
              </div>

              {!preview && error ? <p className="text-sm text-destructive">{error}</p> : null}

              <div className="flex flex-wrap items-center gap-3">
                <ShimmerButton
                  type="submit"
                  disabled={!canSubmit || parsing || submitting}
                  className="h-10 px-5 text-sm"
                >
                  {parsing ? "Parsing..." : "Preview Extraction"}
                </ShimmerButton>
                {preview ? (
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      setPreview(null);
                      setError(null);
                    }}
                  >
                    Reset Preview
                  </Button>
                ) : null}
              </div>
            </form>
          </CardContent>
        </Card>

        {preview ? (
          <Card className="relative overflow-hidden border-border/70 bg-card/80 shadow-xl backdrop-blur-sm">
            <ShineBorder borderWidth={1} duration={10} shineColor={["#84cc16", "#16a34a"]} />
            <CardHeader>
              <CardTitle>Parsed Investigation Preview</CardTitle>
              <CardDescription>Review the extracted details, then launch AI calls.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4 rounded-2xl border border-border/70 bg-background/70 p-4">
                <div>
                  <p className="text-sm font-medium">Parsed Requirement</p>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{preview.requirement}</p>
                </div>
                <div>
                  <p className="text-sm font-medium">Voice Agent Name</p>
                  <p className="mt-1 text-sm text-muted-foreground">{effectiveVoiceAgentName}</p>
                </div>

                <div className="space-y-2">
                  <p className="text-sm font-medium">Parsed Contacts ({preview.contacts.length})</p>
                  <div className="space-y-2">
                    {preview.contacts.map((contact, index) => (
                      <div
                        key={`${contact.phone}-${index}`}
                        className="space-y-2 rounded-xl border border-border/70 bg-card px-3 py-2 text-sm"
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium">{contact.name}</span>
                          <span className="text-muted-foreground">{contact.phone}</span>
                          <Badge variant="secondary" className="capitalize">
                            {contact.language}
                          </Badge>
                        </div>
                        {contact.locationHint ? (
                          <p className="text-xs text-muted-foreground">Location hint: {contact.locationHint}</p>
                        ) : null}
                        {contact.languageReason ? (
                          <p className="text-xs text-muted-foreground">
                            Language guess reason: {contact.languageReason}
                          </p>
                        ) : null}
                        {contact.notes ? (
                          <p className="text-xs text-muted-foreground">Notes: {contact.notes}</p>
                        ) : null}
                        {contact.questions && contact.questions.length > 0 ? (
                          <div>
                            <p className="text-xs font-medium">Contact-specific questions</p>
                            <ul className="mt-1 list-disc space-y-1 pl-5 text-xs text-muted-foreground">
                              {contact.questions.map((question, questionIndex) => (
                                <li key={`${index}-${questionIndex}-${question}`}>{question}</li>
                              ))}
                            </ul>
                          </div>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </div>

                {preview.questionHints.length > 0 ? (
                  <div>
                    <p className="text-sm font-medium">Question Hints</p>
                    <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                      {preview.questionHints.map((question, index) => (
                        <li key={`${index}-${question}`}>{question}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>

              {error ? <p className="text-sm text-destructive">{error}</p> : null}

              <ShimmerButton
                type="button"
                disabled={parsing || submitting}
                className="h-10 px-5 text-sm"
                onClick={() => {
                  void startInvestigation();
                }}
              >
                {submitting ? "Launching calls..." : "Launch AI Calls"}
              </ShimmerButton>
            </CardContent>
          </Card>
        ) : (
          <Card className="relative overflow-hidden border-border/70 bg-card/60 shadow-lg">
            <ShineBorder borderWidth={1} duration={14} shineColor={["#166534", "#65a30d"]} />
            <CardHeader>
              <CardTitle>What happens next</CardTitle>
              <CardDescription>Extraction adds guardrails before your AI agent calls anyone.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <div className="rounded-xl border border-border/70 bg-background/70 p-3">
                We parse your freeform brief into a structured requirement and contact list.
              </div>
              <div className="rounded-xl border border-border/70 bg-background/70 p-3">
                You review contacts, language, and question hints before launch.
              </div>
              <div className="rounded-xl border border-border/70 bg-background/70 p-3">
                Once approved, your named voice agent starts live calls and tracks progress in real time.
              </div>
            </CardContent>
          </Card>
        )}
      </section>
    </main>
  );
}
