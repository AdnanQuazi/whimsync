export interface EpisodeExtractionJobData {
  episodeId: string;
  tenantId: string;
  namespace: string;
  userId: string;
  entityKey: string | null;
  sessionId: string | null;
  rawText: string;
}
