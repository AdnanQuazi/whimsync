export interface DocumentParsingJobData {
  ingestionId: string;
  storageKey: string;
  fileName: string;
  fileExtension: string;
  tenantId: string;
  namespace: string;
  userId: string;
  entityKey?: string | null;
  sessionId?: string | null;
  tier?: "fast" | "smart" | "max" | null;
}

export interface ChunkingJobData {
  ingestionId: string;
  sourceType: "text_file" | "inline_text";
  storageKey?: string;
  pdfStorageKey?: string;
  rawTextInline?: string;
  fileName?: string;
  fileExtension?: string;
  tenantId: string;
  namespace: string;
  userId: string;
  entityKey?: string | null;
  sessionId?: string | null;
}

export interface CitationBBoxJobData {
  ingestionId: string;
  pdfStorageKey: string;
  tenantId: string;
  namespace: string;
}

export interface EpisodeExtractionJobData {
  episodeId: string;
  ingestionId?: string | null;
  tenantId: string;
  namespace: string;
  userId: string;
  entityKey: string | null;
  sessionId: string | null;
  rawText: string;

  // Chunking fields
  chunkIndex: number;
  chunkStartOffset: number;
  chunkEndOffset: number;
  headingPath?: string | null;
  documentSummary?: string | null;
  contextPrefix?: string | null;
}
