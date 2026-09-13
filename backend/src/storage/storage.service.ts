import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { mkdir, unlink, writeFile } from 'fs/promises';
import { existsSync, createReadStream } from 'fs';
import { dirname, join } from 'path';
import { randomUUID } from 'crypto';
import { Readable } from 'stream';

const S3_PREFIX = 's3:';

@Injectable()
export class StorageService {
  private readonly log = new Logger(StorageService.name);
  private readonly client: S3Client | null;
  private readonly bucket: string | null;

  constructor(private config: ConfigService) {
    const endpoint = this.config.get<string>('S3_ENDPOINT');
    const bucket = this.config.get<string>('S3_BUCKET');
    const accessKeyId = this.config.get<string>('S3_ACCESS_KEY_ID');
    const secretAccessKey = this.config.get<string>('S3_SECRET_ACCESS_KEY');
    const region = this.config.get<string>('S3_REGION') || 'auto';

    if (endpoint && bucket && accessKeyId && secretAccessKey) {
      this.bucket = bucket;
      this.client = new S3Client({
        endpoint,
        region,
        credentials: { accessKeyId, secretAccessKey },
        forcePathStyle: true,
      });
      this.log.log(`S3 storage enabled → ${bucket} @ ${endpoint}`);
    } else {
      this.bucket = null;
      this.client = null;
      this.log.warn('S3 non configuré — fallback disque local (GED_STORAGE_PATH)');
    }
  }

  enabled() {
    return Boolean(this.client && this.bucket);
  }

  private root() {
    return this.config.get('GED_STORAGE_PATH', './uploads');
  }

  isS3Ref(ref: string) {
    return ref.startsWith(S3_PREFIX);
  }

  keyFromRef(ref: string) {
    return ref.slice(S3_PREFIX.length);
  }

  /** Stocke un fichier ; retourne la référence à persister en base. */
  async put(
    folder: string,
    originalName: string,
    buffer: Buffer,
    contentType: string,
  ): Promise<string> {
    const safe = originalName.replace(/[^a-zA-Z0-9._-]/g, '_') || 'file';
    const filename = `${randomUUID()}-${safe}`;
    const key = `${folder.replace(/\/+$/, '')}/${filename}`;

    if (this.client && this.bucket) {
      await this.client.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: key,
          Body: buffer,
          ContentType: contentType,
        }),
      );
      return `${S3_PREFIX}${key}`;
    }

    const path = join(this.root(), folder, filename);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, buffer);
    return path;
  }

  async open(
    ref: string,
  ): Promise<{ stream: Readable; contentType?: string } | null> {
    if (!ref) return null;

    if (this.isS3Ref(ref)) {
      if (!this.client || !this.bucket) return null;
      const out = await this.client.send(
        new GetObjectCommand({
          Bucket: this.bucket,
          Key: this.keyFromRef(ref),
        }),
      );
      if (!out.Body) return null;
      const stream = out.Body as Readable;
      return { stream, contentType: out.ContentType };
    }

    if (!existsSync(ref)) return null;
    return { stream: createReadStream(ref) };
  }

  async remove(ref: string) {
    if (!ref) return;
    try {
      if (this.isS3Ref(ref)) {
        if (!this.client || !this.bucket) return;
        await this.client.send(
          new DeleteObjectCommand({
            Bucket: this.bucket,
            Key: this.keyFromRef(ref),
          }),
        );
        return;
      }
      if (existsSync(ref)) await unlink(ref);
    } catch (err) {
      this.log.warn(`Impossible de supprimer ${ref}: ${String(err)}`);
    }
  }
}
