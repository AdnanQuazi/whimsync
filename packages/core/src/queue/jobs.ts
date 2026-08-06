export interface DocumentPreprocessJobData {
  ingestionId: string;
  storageKey?: string;
  sourceType: "text_full" | "file";
  tenantId: string;
  namespace: string;
  userId: string;
}

export interface ChunkPayload {
  text: string;
  type: "binary_chunk" | "text_chunk";
  selfRef: string;
  startOffset: number;
  endOffset: number;
  chunkIndex: number;
  contextPrefix: string | null;
  headingPath?: string;
  page?: number;
  bboxes?: { l: number; t: number; r: number; b: number; page: number }[];
}

export interface PreprocessResultJobData {
  ingestionId: string;
  chunksStorageKey: string;
  documentSummary: string;
  totalChunks: number;
}

export interface EpisodeExtractionJobData {
  episodeId: string;
  tenantId: string;
  namespace: string;
  userId: string;
  entityKey: string | null;
  sessionId: string | null;
  rawText: string;

  // Chunking fields
  documentSummary?: string | null;
  contextPrefix?: string | null;
  headingPath?: string | null;
  chunkStartOffset: number;
  chunkEndOffset: number;
}
