export const DOCUMENT_PARSING_QUEUE = "document-parsing";
export const CHUNKING_QUEUE = "chunking";
export const EPISODE_EXTRACTION_QUEUE = "episode-extraction";
export const CITATION_BBOX_QUEUE = "citation-bbox";

export const MAX_FILE_SIZE_BYTES = 15 * 1024 * 1024; // 15 MB
export const MAX_FILES_PER_REQUEST = 10;
export const MAX_TOTAL_BYTES = MAX_FILES_PER_REQUEST * MAX_FILE_SIZE_BYTES; // 150 MB
export const BINARY_EXTENSIONS: Record<string, string[]> = {
  ".pdf": ["application/pdf"],
  ".docx": [
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ],
  ".pptx": [
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ],
};

export const BLOCKED_EXTENSIONS = new Set([
  ".exe",
  ".dll",
  ".so",
  ".bin",
  ".dmg",
  ".app",
  ".msi",
  ".zip",
  ".tar",
  ".gz",
  ".rar",
  ".7z",
  ".mp4",
  ".mov",
  ".mp3",
  ".wav",
]);
