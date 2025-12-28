import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

export interface StorageConfig {
  bucket: string;
  region?: string;
  endpoint?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
}

export class StorageService {
  private client: S3Client;
  private bucket: string;

  constructor(config?: StorageConfig) {
    this.bucket = config?.bucket || process.env.S3_BUCKET || 'foundation-uploads';

    const endpoint = config?.endpoint || process.env.S3_ENDPOINT;
    const region = config?.region || process.env.S3_REGION || 'us-east-1';

    this.client = new S3Client({
      region,
      endpoint,
      forcePathStyle: !!endpoint, // Required for MinIO
      credentials: config?.accessKeyId
        ? {
            accessKeyId: config.accessKeyId,
            secretAccessKey: config.secretAccessKey || '',
          }
        : undefined,
    });
  }

  async upload(
    key: string,
    body: Buffer | Uint8Array,
    options?: {
      contentType?: string;
      metadata?: Record<string, string>;
    }
  ): Promise<{ key: string; url: string }> {
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      Body: body,
      ContentType: options?.contentType,
      Metadata: options?.metadata,
    });

    await this.client.send(command);

    return {
      key,
      url: await this.getSignedUrl(key),
    };
  }

  async getSignedUrl(key: string, expiresIn = 3600): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });

    return getSignedUrl(this.client, command, { expiresIn });
  }

  async getUploadUrl(
    key: string,
    contentType: string,
    expiresIn = 3600
  ): Promise<string> {
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: contentType,
    });

    return getSignedUrl(this.client, command, { expiresIn });
  }

  async delete(key: string): Promise<void> {
    const command = new DeleteObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });

    await this.client.send(command);
  }
}

// Default instance
let defaultStorage: StorageService | null = null;

export function getStorage(): StorageService {
  if (!defaultStorage) {
    defaultStorage = new StorageService();
  }
  return defaultStorage;
}
