import { db } from "@whimsync/db";

console.log("Whimsync BullMQ Worker initialized with shared DB client:", !!db);
