import { Hono } from "hono";
import { memoryController } from "../controllers/memoryController";
import { validate } from "../lib/validate";
import {
  authGuard,
  namespaceAuthGuard,
  tenantGuard,
} from "../middleware/authMiddleware";
import { clerkAuth } from "../middleware/clerkAuth";
import { CreateMemorySchema } from "../schemas/memory";
import type { AppVariables } from "../types";

const router = new Hono<{ Variables: AppVariables }>();

router.use("*", clerkAuth, authGuard(), tenantGuard());

router.post(
  "/",
  namespaceAuthGuard("write"),
  validate("json", CreateMemorySchema),
  (c) => memoryController.ingestMemory(c),
);

export const memoryRoutes = router;
