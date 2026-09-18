export const CHUNK_SIZE = 600;

export interface ChunkItem {
  text: string;
  headingPath?: string | null;
  chunkStartOffset?: number | null;
  chunkEndOffset?: number | null;
}

export interface HeaderSplitSection {
  content: string;
  headingPath: string | null;
}

export interface IngestionJobMetadata {
  ingestionId: string;
  userId: string;
  sessionId?: string | null;
}

export interface InsertedEpisodeRecord {
  id: string;
  rawText: string;
  userId: string;
  sessionId: string | null;
  sourceIngestionId: string;
  chunkIndex: number;
  chunkStartOffset: number | null;
  chunkEndOffset: number | null;
  headingPath: string | null;
  status: "pending";
}
