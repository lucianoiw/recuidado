import { AwsClient } from 'aws4fetch';

export interface R2Config {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
}

/** Cloudflare R2 through its S3 API: put an object and hand out a short-lived link to it. */
export class R2Bucket {
  private readonly client: AwsClient;
  private readonly base: string;

  constructor(config: R2Config) {
    this.client = new AwsClient({
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
      service: 's3',
      region: 'auto',
    });
    this.base = `https://${config.accountId}.r2.cloudflarestorage.com/${config.bucket}`;
  }

  async put(key: string, body: Buffer, contentType: string): Promise<void> {
    const res = await this.client.fetch(`${this.base}/${key}`, {
      method: 'PUT',
      body: new Uint8Array(body),
      headers: { 'Content-Type': contentType },
    });
    if (!res.ok) throw new Error(`R2 PUT ${key} answered ${res.status}: ${await res.text()}`);
  }

  /** A signed GET link, valid for `seconds`. */
  async signedUrl(key: string, seconds = 3600): Promise<string> {
    const url = new URL(`${this.base}/${key}`);
    url.searchParams.set('X-Amz-Expires', String(seconds));
    const signed = await this.client.sign(url.toString(), { method: 'GET', aws: { signQuery: true } });
    return signed.url;
  }
}
