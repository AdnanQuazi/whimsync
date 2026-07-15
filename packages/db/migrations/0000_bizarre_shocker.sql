CREATE TABLE "entities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"canonical_name" text NOT NULL,
	"type" text NOT NULL,
	"aliases" text[],
	"user_id" text NOT NULL,
	"tenant_id" text NOT NULL,
	"namespace" text DEFAULT 'default' NOT NULL,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "entity_relationships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"subject_entity_id" uuid NOT NULL,
	"predicate" text NOT NULL,
	"object_entity_id" uuid,
	"object_literal" text,
	"scope" text,
	"rationale" text,
	"source_claim_id" uuid NOT NULL,
	"confidence" real DEFAULT 1 NOT NULL,
	"valid_at" timestamp with time zone,
	"invalid_at" timestamp with time zone,
	"tx_created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"tx_expired_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "namespace_permissions" (
	"org_id" uuid NOT NULL,
	"namespace" text NOT NULL,
	"user_id" text NOT NULL,
	"can_read" boolean DEFAULT false NOT NULL,
	"can_write" boolean DEFAULT false NOT NULL,
	CONSTRAINT "namespace_permissions_org_id_namespace_user_id_pk" PRIMARY KEY("org_id","namespace","user_id")
);
--> statement-breakpoint
CREATE TABLE "namespaces" (
	"org_id" uuid NOT NULL,
	"name" text DEFAULT 'default' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "namespaces_org_id_name_pk" PRIMARY KEY("org_id","name")
);
--> statement-breakpoint
CREATE TABLE "org_memberships" (
	"org_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"role" text DEFAULT 'member' NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "org_memberships_org_id_user_id_pk" PRIMARY KEY("org_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "orgs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "episodes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"raw_text" text NOT NULL,
	"user_id" text NOT NULL,
	"session_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "evidence" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"claim_id" uuid NOT NULL,
	"episode_id" uuid NOT NULL,
	"start_offset" integer NOT NULL,
	"end_offset" integer NOT NULL,
	"excerpt" text,
	"confidence" real DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "memory_claims" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text NOT NULL,
	"namespace" text DEFAULT 'default' NOT NULL,
	"user_id" text NOT NULL,
	"entity_key" text,
	"session_id" text,
	"content" text NOT NULL,
	"kind" text NOT NULL,
	"status" text DEFAULT 'pending_review' NOT NULL,
	"confidence" real DEFAULT 1 NOT NULL,
	"categories" text[],
	"content_hash" text NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"occurred_at" timestamp with time zone,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "memory_relationships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_claim_id" uuid NOT NULL,
	"target_claim_id" uuid NOT NULL,
	"relation" text NOT NULL,
	"confidence" real DEFAULT 1 NOT NULL,
	"reason" text,
	"tenant_id" text NOT NULL,
	"namespace" text DEFAULT 'default' NOT NULL,
	"valid_at" timestamp with time zone,
	"invalid_at" timestamp with time zone,
	"tx_created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"tx_expired_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "vectors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" uuid NOT NULL,
	"embedding" vector(768) NOT NULL
);
--> statement-breakpoint
ALTER TABLE "entity_relationships" ADD CONSTRAINT "entity_relationships_subject_entity_id_entities_id_fk" FOREIGN KEY ("subject_entity_id") REFERENCES "public"."entities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entity_relationships" ADD CONSTRAINT "entity_relationships_object_entity_id_entities_id_fk" FOREIGN KEY ("object_entity_id") REFERENCES "public"."entities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entity_relationships" ADD CONSTRAINT "entity_relationships_source_claim_id_memory_claims_id_fk" FOREIGN KEY ("source_claim_id") REFERENCES "public"."memory_claims"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "namespace_permissions" ADD CONSTRAINT "namespace_permissions_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "namespaces" ADD CONSTRAINT "namespaces_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org_memberships" ADD CONSTRAINT "org_memberships_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidence" ADD CONSTRAINT "evidence_claim_id_memory_claims_id_fk" FOREIGN KEY ("claim_id") REFERENCES "public"."memory_claims"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidence" ADD CONSTRAINT "evidence_episode_id_episodes_id_fk" FOREIGN KEY ("episode_id") REFERENCES "public"."episodes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memory_relationships" ADD CONSTRAINT "memory_relationships_source_claim_id_memory_claims_id_fk" FOREIGN KEY ("source_claim_id") REFERENCES "public"."memory_claims"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memory_relationships" ADD CONSTRAINT "memory_relationships_target_claim_id_memory_claims_id_fk" FOREIGN KEY ("target_claim_id") REFERENCES "public"."memory_claims"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "entities_tenant_ns_idx" ON "entities" USING btree ("tenant_id","namespace");--> statement-breakpoint
CREATE INDEX "entities_canonical_name_idx" ON "entities" USING btree ("canonical_name");--> statement-breakpoint
CREATE INDEX "entities_type_idx" ON "entities" USING btree ("type");--> statement-breakpoint
CREATE INDEX "entities_user_id_idx" ON "entities" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "entity_rel_subject_idx" ON "entity_relationships" USING btree ("subject_entity_id");--> statement-breakpoint
CREATE INDEX "entity_rel_object_idx" ON "entity_relationships" USING btree ("object_entity_id");--> statement-breakpoint
CREATE INDEX "entity_rel_source_claim_idx" ON "entity_relationships" USING btree ("source_claim_id");--> statement-breakpoint
CREATE INDEX "namespace_permissions_user_id_idx" ON "namespace_permissions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "namespace_permissions_org_ns_idx" ON "namespace_permissions" USING btree ("org_id","namespace");--> statement-breakpoint
CREATE INDEX "namespaces_org_id_idx" ON "namespaces" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "org_memberships_user_id_idx" ON "org_memberships" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "episodes_user_id_idx" ON "episodes" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "episodes_session_id_idx" ON "episodes" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "evidence_claim_id_idx" ON "evidence" USING btree ("claim_id");--> statement-breakpoint
CREATE INDEX "evidence_episode_id_idx" ON "evidence" USING btree ("episode_id");--> statement-breakpoint
CREATE INDEX "memory_claims_tenant_ns_status_idx" ON "memory_claims" USING btree ("tenant_id","namespace","status");--> statement-breakpoint
CREATE INDEX "memory_claims_tenant_id_idx" ON "memory_claims" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "memory_claims_namespace_idx" ON "memory_claims" USING btree ("namespace");--> statement-breakpoint
CREATE INDEX "memory_claims_user_id_idx" ON "memory_claims" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "memory_claims_entity_key_idx" ON "memory_claims" USING btree ("entity_key");--> statement-breakpoint
CREATE INDEX "memory_claims_session_id_idx" ON "memory_claims" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "memory_claims_status_idx" ON "memory_claims" USING btree ("status");--> statement-breakpoint
CREATE INDEX "memory_claims_content_hash_idx" ON "memory_claims" USING btree ("content_hash");--> statement-breakpoint
CREATE INDEX "memory_rel_source_idx" ON "memory_relationships" USING btree ("source_claim_id");--> statement-breakpoint
CREATE INDEX "memory_rel_target_idx" ON "memory_relationships" USING btree ("target_claim_id");--> statement-breakpoint
CREATE INDEX "memory_rel_tenant_ns_idx" ON "memory_relationships" USING btree ("tenant_id","namespace");--> statement-breakpoint
CREATE INDEX "vectors_entity_idx" ON "vectors" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "vector_hnsw_idx" ON "vectors" USING hnsw ("embedding" vector_cosine_ops);
