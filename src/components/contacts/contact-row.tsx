"use client";

import { Trash2 } from "lucide-react";

import type { ContactInput } from "@/lib/domain";
import { PREFERRED_LANGUAGES } from "@/lib/domain";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type ContactRowProps = {
  contact: ContactInput;
  canDelete: boolean;
  onChange: (next: ContactInput) => void;
  onDelete: () => void;
};

export function ContactRow({ contact, canDelete, onChange, onDelete }: ContactRowProps) {
  return (
    <div className="grid gap-3 rounded-lg border border-border p-3 md:grid-cols-[1.2fr_1fr_0.9fr_auto]">
      <Input
        placeholder="Contact name"
        value={contact.name}
        onChange={(event) => onChange({ ...contact, name: event.target.value })}
      />
      <Input
        placeholder="+91XXXXXXXXXX"
        value={contact.phone}
        onChange={(event) => onChange({ ...contact, phone: event.target.value })}
      />
      <Select
        value={contact.language}
        onValueChange={(value) =>
          onChange({
            ...contact,
            language: value as ContactInput["language"],
          })
        }
      >
        <SelectTrigger className="w-full">
          <SelectValue placeholder="Language" />
        </SelectTrigger>
        <SelectContent>
          {PREFERRED_LANGUAGES.map((language) => (
            <SelectItem key={language.value} value={language.value}>
              {language.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button type="button" variant="outline" size="icon" onClick={onDelete} disabled={!canDelete}>
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
}
