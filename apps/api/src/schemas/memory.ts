import {
  BINARY_EXTENSIONS,
  BLOCKED_EXTENSIONS,
  MAX_FILE_SIZE_BYTES,
  MAX_FILES_PER_REQUEST,
  MAX_TOTAL_BYTES,
} from "@whimsync/core/queue";
import { z } from "zod";
import {
  getExtension,
  isTextLike,
  matchesMagicBytes,
} from "../lib/fileValidation";

export const CreateMemorySchema = z.object({
  text: z.string().min(1, "Memory text cannot be empty"),
  namespace: z.string().default("default"),
  entityKey: z.string().nullable().optional(),
  sessionId: z.string().nullable().optional(),
});

export type CreateMemoryInput = z.infer<typeof CreateMemorySchema>;

const SingleFileSchema = z
  .instanceof(File, { message: "Must be a valid file" })
  .refine((file) => file.size > 0, { message: "File is empty" })
  .refine((file) => file.size <= MAX_FILE_SIZE_BYTES, {
    message: `Each file must be under ${MAX_FILE_SIZE_BYTES / (1024 * 1024)}MB`,
  })
  .refine(
    (file) => {
      const ext = getExtension(file.name);
      if (ext in BINARY_EXTENSIONS) return true;
      return !BLOCKED_EXTENSIONS.has(ext);
    },
    { message: "File type is not supported" },
  )
  .refine(
    async (file) => {
      const ext = getExtension(file.name);
      const expectedMimes = BINARY_EXTENSIONS[ext];
      if (!expectedMimes) return true;
      return matchesMagicBytes(file, expectedMimes);
    },
    { message: "File content does not match its extension" },
  )
  .refine(
    async (file) => {
      const ext = getExtension(file.name);
      if (ext in BINARY_EXTENSIONS) return true;
      return isTextLike(file);
    },
    { message: "File claims to be text but is not valid UTF-8" },
  );

export const UploadMemorySchema = z.object({
  file: z
    .union([SingleFileSchema, z.array(SingleFileSchema)])
    .transform((f) => (Array.isArray(f) ? f : [f]))
    .refine((files) => files.length > 0, {
      message: "At least one file is required",
    })
    .refine((files) => files.length <= MAX_FILES_PER_REQUEST, {
      message: `Cannot upload more than ${MAX_FILES_PER_REQUEST} files at once`,
    })
    .refine(
      (files) => files.reduce((sum, f) => sum + f.size, 0) <= MAX_TOTAL_BYTES,
      {
        message: `Combined upload size exceeds ${MAX_TOTAL_BYTES / (1024 * 1024)}MB`,
      },
    ),
  namespace: z.string().default("default"),
  entityKey: z.string().nullable().optional(),
  sessionId: z.string().nullable().optional(),
});

export type UploadMemoryInput = z.infer<typeof UploadMemorySchema>;
