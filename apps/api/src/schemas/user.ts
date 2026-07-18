import { z } from "zod";

export const UserProfileSchema = z.object({
  id: z.string(),
  name: z.string().nullable(),
  email: z.string(),
  image: z.string().nullable(),
});

export type UserProfile = z.infer<typeof UserProfileSchema>;
