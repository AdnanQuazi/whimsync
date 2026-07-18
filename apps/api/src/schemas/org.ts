import { z } from "zod";

export const CreateOrgSchema = z.object({
  name: z.string().min(1, "Organization name cannot be empty"),
});

export const OrgSummarySchema = z.object({
  id: z.string(),
  name: z.string(),
  role: z.string(),
  createdAt: z.union([z.string(), z.date()]),
  joinedAt: z.union([z.string(), z.date()]),
});

export type CreateOrgInput = z.infer<typeof CreateOrgSchema>;
export type OrgSummary = z.infer<typeof OrgSummarySchema>;
