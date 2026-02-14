import { z } from "zod";

export const structuredContactSchema = z.object({
  name: z.string().min(1, "Contact name is required.").max(100),
  phone: z.string().min(7, "Phone number is too short.").max(25),
  language: z.enum(["kannada", "tamil", "hindi", "english"]),
});

export const createInvestigationStructuredSchema = z.object({
  requirement: z
    .string()
    .min(6, "Requirement should be at least 6 characters long.")
    .max(2000, "Requirement is too long."),
  contacts: z.array(structuredContactSchema).min(1, "Add at least one contact.").max(100, "Too many contacts in one batch."),
});

export const createInvestigationFreeformSchema = z.object({
  inputText: z
    .string()
    .min(12, "Please provide requirement, contacts, and any specific questions.")
    .max(10000, "Input is too long."),
});

export const createInvestigationSchema = z.union([
  createInvestigationStructuredSchema,
  createInvestigationFreeformSchema,
]);

export type CreateInvestigationStructuredInput = z.infer<typeof createInvestigationStructuredSchema>;
export type CreateInvestigationFreeformInput = z.infer<typeof createInvestigationFreeformSchema>;
export type CreateInvestigationInput = z.infer<typeof createInvestigationSchema>;
