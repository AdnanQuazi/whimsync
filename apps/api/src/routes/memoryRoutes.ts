import { MAX_TOTAL_BYTES } from "@whimsync/core/queue";
import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { memoryController } from "../controllers/memoryController";
import { validate } from "../lib/validate";
import {
  authGuard,
  namespaceAuthGuard,
  tenantGuard,
} from "../middleware/authMiddleware";
import { clerkAuth } from "../middleware/clerkAuth";
import { CreateMemorySchema, UploadMemorySchema } from "../schemas/memory";
import type { AppVariables } from "../types";

const router = new Hono<{ Variables: AppVariables }>();

router.use("*", clerkAuth, authGuard(), tenantGuard());

router.post(
  "/",
  namespaceAuthGuard("write"),
  validate("json", CreateMemorySchema),
  (c) => memoryController.ingestText(c),
);

router.post(
  "/upload",
  namespaceAuthGuard("write"),
  bodyLimit({ maxSize: MAX_TOTAL_BYTES }),
  validate("form", UploadMemorySchema),
  (c) => memoryController.ingestFiles(c),
);

export const memoryRoutes = router;
