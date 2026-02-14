import { z } from "zod";

export const investigationParamsSchema = z.object({
  id: z.string().cuid(),
});
