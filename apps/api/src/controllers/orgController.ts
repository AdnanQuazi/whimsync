import type { Context } from "hono";
import {
  NotFoundError,
  UnauthorizedError,
  ValidationError,
} from "../lib/errors";
import { tenantService } from "../services/tenantService";
import type { AppVariables } from "../types";

export class OrgController {
  /**
   * Returns all organizations the authenticated user belongs to (`GET /v1/orgs`).
   */
  async getOrgs(c: Context<{ Variables: AppVariables }>) {
    const user = c.get("user");
    if (!user) {
      throw new UnauthorizedError();
    }
    const orgs = await tenantService.getUserOrgs(user.id);
    return c.json(orgs, 200);
  }

  /**
   * Creates a new team organization and assigns the user as `owner` (`POST /v1/orgs`).
   */
  async createOrg(c: Context<{ Variables: AppVariables }>) {
    const user = c.get("user");
    if (!user) {
      throw new UnauthorizedError();
    }
    const body = await c.req.json().catch(() => ({}));
    const name = body?.name?.trim();
    if (!name) {
      throw new ValidationError("Organization name is required");
    }
    const org = await tenantService.createOrg(user.id, name);
    return c.json(org, 201);
  }

  /**
   * Retrieves a specific organization by ID (`GET /v1/orgs/:id`).
   */
  async getOrgById(c: Context<{ Variables: AppVariables }>) {
    const user = c.get("user");
    if (!user) {
      throw new UnauthorizedError();
    }
    const id = c.req.param("id");
    if (!id) {
      throw new ValidationError("Organization ID is required");
    }
    const org = await tenantService.getOrgById(user.id, id);
    if (!org) {
      throw new NotFoundError("Organization not found or access denied");
    }
    return c.json(org, 200);
  }
}

export const orgController = new OrgController();
