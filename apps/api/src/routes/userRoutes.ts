import { Hono } from "hono";
import { userController } from "../controllers/userController";
import { authGuard } from "../middleware/authMiddleware";
import { clerkAuth } from "../middleware/clerkAuth";
import type { AppVariables } from "../types";

const router = new Hono<{ Variables: AppVariables }>();

router.use("*", clerkAuth, authGuard());

router.get("/me", (c) => userController.getMe(c));

export const userRoutes = router;
