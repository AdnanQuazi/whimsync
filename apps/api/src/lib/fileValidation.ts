import { fileTypeFromStream } from "file-type";

export function getExtension(filename: string): string {
  const idx = filename.lastIndexOf(".");
  return idx === -1 ? "" : filename.slice(idx).toLowerCase();
}

export async function isTextLike(file: File): Promise<boolean> {
  try {
    const reader = file.stream().getReader();
    const { value } = await reader.read();

    if (!value) return true;

    if (value.includes(0)) return false;

    const decoder = new TextDecoder("utf-8", { fatal: true });
    decoder.decode(value, { stream: true });

    return true;
  } catch {
    return false;
  }
}

export async function matchesMagicBytes(
  file: File,
  expectedMimes: string[],
): Promise<boolean> {
  const detected = await fileTypeFromStream(file.stream() as any);
  return !!detected && expectedMimes.includes(detected.mime);
}
