import { z } from "zod";

export const CreateMemorySchema = z.object({
  text: z.string().min(1, "Memory text cannot be empty"),
  namespace: z.string().default("default"),
  entityKey: z.string().nullable().optional(),
  sessionId: z.string().nullable().optional(),
});

export type CreateMemoryInput = z.infer<typeof CreateMemorySchema>;
