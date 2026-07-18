export const PG_UNIQUE_VIOLATION = "23505";
export const PG_CHECK_VIOLATION = "23514";
export const PG_FOREIGN_KEY_VIOLATION = "23503";

export const pgErrorMap: Record<
  string,
  { status: number; code: string; message: string }
> = {
  [PG_UNIQUE_VIOLATION]: {
    status: 409,
    code: "CONFLICT",
    message: "Resource already exists.",
  },
  [PG_CHECK_VIOLATION]: {
    status: 400,
    code: "VALIDATION_ERROR",
    message: "Data constraint violated.",
  },
  [PG_FOREIGN_KEY_VIOLATION]: {
    status: 400,
    code: "VALIDATION_ERROR",
    message: "Invalid reference.",
  },
};
