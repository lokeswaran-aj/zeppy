"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { ContactRow } from "@/components/contacts/contact-row";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { ContactInput } from "@/lib/domain";

const EMPTY_CONTACT: ContactInput = {
  name: "",
  phone: "",
  language: "english",
};

export default function Home() {
  const router = useRouter();
  const [requirement, setRequirement] = useState("");
  const [contacts, setContacts] = useState<ContactInput[]>([{ ...EMPTY_CONTACT }]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const canSubmit = useMemo(() => {
    const validContacts = contacts.filter((contact) => contact.name && contact.phone);
    return requirement.trim().length > 5 && validContacts.length > 0;
  }, [contacts, requirement]);

  const updateContact = (index: number, next: ContactInput) => {
    setContacts((current) => current.map((row, rowIndex) => (rowIndex === index ? next : row)));
  };

  const addContact = () => {
    setContacts((current) => [...current, { ...EMPTY_CONTACT }]);
  };

  const removeContact = (index: number) => {
    setContacts((current) => {
      if (current.length <= 1) {
        return current;
      }
      return current.filter((_, rowIndex) => rowIndex !== index);
    });
  };

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const createResponse = await fetch("/api/investigations", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          requirement,
          contacts: contacts.filter((contact) => contact.name.trim() && contact.phone.trim()),
        }),
      });

      if (!createResponse.ok) {
        throw new Error("Could not create investigation.");
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
      setSubmitting(false);
    }
  };

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-6 px-6 py-10">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">CallAgent</h1>
        <p className="text-sm text-muted-foreground">
          Enter what you need and the contacts to call. CallAgent will investigate in their preferred
          language and return ranked recommendations.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>1. Requirement and Contacts</CardTitle>
          <CardDescription>Screen 1 - define your requirement and add phone contacts.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-6" onSubmit={onSubmit}>
            <div className="space-y-2">
              <Label htmlFor="requirement">Requirement</Label>
              <Textarea
                id="requirement"
                placeholder="Example: I need a PG near Koramangala under 15k with food."
                value={requirement}
                onChange={(event) => setRequirement(event.target.value)}
                rows={4}
              />
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Contacts</Label>
                <Button type="button" variant="outline" onClick={addContact}>
                  Add Contact
                </Button>
              </div>
              <div className="space-y-2">
                {contacts.map((contact, index) => (
                  <ContactRow
                    key={`${contact.phone}-${index}`}
                    contact={contact}
                    canDelete={contacts.length > 1}
                    onChange={(next) => updateContact(index, next)}
                    onDelete={() => removeContact(index)}
                  />
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                Use E.164 phone format when possible (example: +919900001111).
              </p>
            </div>

            {error ? <p className="text-sm text-destructive">{error}</p> : null}

            <Button type="submit" disabled={!canSubmit || submitting}>
              {submitting ? "Starting investigation..." : "Start Investigation"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
