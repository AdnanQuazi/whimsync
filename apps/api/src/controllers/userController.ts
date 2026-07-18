import type { Context } from "hono";
import { UnauthorizedError } from "../lib/errors";
import type { AppVariables } from "../types";

export class UserController {
  /**
   * Returns the authenticated user's pure identity (`/v1/users/me`).
   */
  async getMe(c: Context<{ Variables: AppVariables }>) {
    const user = c.get("user");
    if (!user) {
      throw new UnauthorizedError();
    }
    return c.json(user, 200);
  }
}

export const userController = new UserController();
