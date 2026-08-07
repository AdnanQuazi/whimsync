import { Client } from "minio";

export class StorageService {
  private client: Client;
  private bucket: string;

  constructor() {
    const bucket = process.env.MINIO_BUCKET;
    const endPoint = process.env.MINIO_ENDPOINT;
    const port = process.env.MINIO_PORT;
    const accessKey = process.env.MINIO_ACCESS_KEY;
    const secretKey = process.env.MINIO_SECRET_KEY;

    if (!bucket || !endPoint || !port || !accessKey || !secretKey) {
      throw new Error("Missing required MinIO environment variables");
    }

    this.bucket = bucket;
    this.client = new Client({
      endPoint,
      port: Number(port),
      useSSL: process.env.MINIO_USE_SSL === "true",
      accessKey,
      secretKey,
    });
  }

  /**
   * Uploads file buffer to MinIO / S3 and returns the object key.
   */
  async uploadFile(
    buffer: Buffer | ArrayBuffer,
    originalName: string,
  ): Promise<string> {
    const ext = originalName.split(".").pop() || "bin";
    const storageKey = `uploads/${crypto.randomUUID()}.${ext}`;

    const fileBuffer = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);

    await this.client.putObject(this.bucket, storageKey, fileBuffer);

    return storageKey;
  }
}

export const storageService = new StorageService();
