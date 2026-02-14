import { z } from "zod";

export const createInvestigationSchema = z.object({
  requirement: z
    .string()
    .min(6, "Requirement should be at least 6 characters long.")
    .max(2000, "Requirement is too long."),
  contacts: z
    .array(
      z.object({
        name: z.string().min(1, "Contact name is required.").max(100),
        phone: z.string().min(7, "Phone number is too short.").max(25),
        language: z.enum(["kannada", "tamil", "hindi", "english"]),
      }),
    )
    .min(1, "Add at least one contact.")
    .max(100, "Too many contacts in one batch."),
});

export type CreateInvestigationInput = z.infer<typeof createInvestigationSchema>;
