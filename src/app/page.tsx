"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { ParsedIntakePreview } from "@/lib/domain";

export default function Home() {
  const router = useRouter();
  const [inputText, setInputText] = useState("");
  const [preview, setPreview] = useState<ParsedIntakePreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [parsing, setParsing] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const canSubmit = inputText.trim().length > 12;

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
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-6 px-6 py-10">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">CallAgent</h1>
        <p className="text-sm text-muted-foreground">
          Share everything in one text box: your requirement, contact details, and questions you want
          answered. CallAgent will extract contacts and run live calls automatically.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>1. Investigation Input</CardTitle>
          <CardDescription>
            Screen 1 - provide requirement + contacts + optional specific questions in one input, then
            review extracted details before calling.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-6" onSubmit={extractPreview}>
            <div className="space-y-2">
              <Label htmlFor="inputText">Single Input</Label>
              <Textarea
                id="inputText"
                placeholder={[
                  "Example:",
                  "Need a PG in Pondicherry under 15k with food.",
                  "Contacts:",
                  "Asha PG, +919900001111, Tamil, ask about deposit and curfew",
                  "City Stay manager Rahul +919900002222 (Hindi)",
                  "Questions: Is single room available? What is move-in date and advance?",
                ].join("\n")}
                value={inputText}
                onChange={(event) => {
                  setInputText(event.target.value);
                  setPreview(null);
                }}
                rows={10}
              />
              <p className="text-xs text-muted-foreground">
                Include at least one contact phone number. Language is optional; CallAgent will infer
                it when possible.
              </p>
            </div>

            {preview ? (
              <div className="space-y-3 rounded-lg border border-border p-4">
                <div>
                  <p className="text-sm font-medium">Extracted Requirement</p>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">
                    {preview.requirement}
                  </p>
                </div>

                <div className="space-y-2">
                  <p className="text-sm font-medium">Extracted Contacts ({preview.contacts.length})</p>
                  <div className="space-y-2">
                    {preview.contacts.map((contact, index) => (
                      <div
                        key={`${contact.phone}-${index}`}
                        className="flex flex-wrap items-center gap-2 rounded-md bg-muted/40 px-3 py-2 text-sm"
                      >
                        <span className="font-medium">{contact.name}</span>
                        <span className="text-muted-foreground">{contact.phone}</span>
                        <Badge variant="secondary" className="capitalize">
                          {contact.language}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>

                {preview.questionHints.length > 0 ? (
                  <div>
                    <p className="text-sm font-medium">Extracted Question Hints</p>
                    <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                      {preview.questionHints.map((question, index) => (
                        <li key={`${index}-${question}`}>{question}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            ) : null}

            {error ? <p className="text-sm text-destructive">{error}</p> : null}

            <div className="flex flex-wrap items-center gap-3">
              <Button type="submit" variant="outline" disabled={!canSubmit || parsing || submitting}>
                {parsing ? "Extracting..." : "Extract Details"}
              </Button>
              <Button
                type="button"
                disabled={!preview || parsing || submitting}
                onClick={() => {
                  void startInvestigation();
                }}
              >
                {submitting ? "Starting investigation..." : "Proceed with AI Calls"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
