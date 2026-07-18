import { Hono } from "hono";
import { orgController } from "../controllers/orgController";
import { validate } from "../lib/validate";
import { authGuard } from "../middleware/authMiddleware";
import { clerkAuth } from "../middleware/clerkAuth";
import { CreateOrgSchema } from "../schemas/org";
import type { AppVariables } from "../types";

const router = new Hono<{ Variables: AppVariables }>();

router.use("*", clerkAuth, authGuard());

router.get("/", (c) => orgController.getOrgs(c));

router.post("/", validate("json", CreateOrgSchema), (c) =>
  orgController.createOrg(c),
);

router.get("/:id", (c) => orgController.getOrgById(c));

export const orgRoutes = router;
