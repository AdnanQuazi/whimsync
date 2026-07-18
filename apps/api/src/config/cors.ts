const allowedOrigins = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(",")
      .map((o) => o.trim())
      .filter(Boolean)
  : ["http://localhost:3000"];

if (process.env.NODE_ENV === "production" && !process.env.CORS_ORIGINS) {
  throw new Error("CORS_ORIGINS must be set in production");
}

export { allowedOrigins };
