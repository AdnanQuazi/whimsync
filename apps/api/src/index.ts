import { Hono } from "hono";
import { cors } from "hono/cors";
import { requestId } from "hono/request-id";
import { allowedOrigins } from "./config/cors";
import { errorHandler } from "./middleware/errorHandler";
import { orgRoutes } from "./routes/orgRoutes";
import { userRoutes } from "./routes/userRoutes";
import type { AppVariables } from "./types";

const app = new Hono<{ Variables: AppVariables }>();

// Attach unique request correlation ID
app.use("*", requestId());

// Global CORS configuration for Next.js dashboard / local development
app.use(
  "*",
  cors({
    origin: allowedOrigins,
    credentials: true,
  }),
);

app.route("/v1/users", userRoutes);
app.route("/v1/orgs", orgRoutes);

// Global Error Handler
app.onError(errorHandler);

export { app };

export default {
  port: Number(process.env.PORT) || 3001,
  fetch: app.fetch,
};
