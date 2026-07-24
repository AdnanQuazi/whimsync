CREATE UNIQUE INDEX "entities_canonical_name_unique_idx" ON "entities" USING btree ("tenant_id","namespace","canonical_name");
