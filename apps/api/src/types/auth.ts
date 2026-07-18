import type { schema } from "@whimsync/db";

export type User = typeof schema.users.$inferSelect;

export interface ClerkUserIdentity {
  id: string;
  email?: string;
  name?: string;
  image?: string;
}

export interface ClerkSessionClaims {
  email?: string;
  email_address?: string;
  name?: string;
  image?: string;
  picture?: string;
  image_url?: string;
  [key: string]: unknown;
}

export interface OrgMembershipSummary {
  orgId: string;
  userId: string;
  role: string;
  joinedAt: Date;
}

export interface ActiveTenantContext {
  activeTenantId: string | null;
  activeRole: string | null;
  memberships: OrgMembershipSummary[];
}

export interface OrgWithRole {
  id: string;
  name: string;
  role: string;
  createdAt: Date;
  joinedAt: Date;
}

export interface AppVariables {
  user: User;
  tenantId: string | null;
  orgRole: string | null;
  orgMemberships: OrgMembershipSummary[];
  requestId?: string;
}
