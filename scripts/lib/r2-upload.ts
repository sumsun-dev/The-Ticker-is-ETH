import { S3Client, PutObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';

/**
 * Cloudflare R2 uploader for Telegram media.
 *
 * Binaries live in R2 (egress-free public hosting); the repo only stores the
 * resulting public URLs. If R2 env vars are absent the uploader becomes a
 * graceful no-op so local runs and un-provisioned CI keep working.
 *
 * Required env vars (all or nothing):
 *   R2_ACCOUNT_ID        - Cloudflare account id (endpoint host)
 *   R2_ACCESS_KEY_ID     - R2 API token access key
 *   R2_SECRET_ACCESS_KEY - R2 API token secret
 *   R2_BUCKET            - target bucket name
 *   R2_PUBLIC_BASE_URL   - public URL prefix, e.g. https://media.ethcollective.xyz
 *                          (custom domain or the bucket's *.r2.dev URL), no trailing slash
 */

const {
  R2_ACCOUNT_ID,
  R2_ACCESS_KEY_ID,
  R2_SECRET_ACCESS_KEY,
  R2_BUCKET,
  R2_PUBLIC_BASE_URL,
} = process.env;

const isConfigured = Boolean(
  R2_ACCOUNT_ID &&
    R2_ACCESS_KEY_ID &&
    R2_SECRET_ACCESS_KEY &&
    R2_BUCKET &&
    R2_PUBLIC_BASE_URL,
);

let client: S3Client | null = null;

function getClient(): S3Client {
  if (!client) {
    client = new S3Client({
      region: 'auto',
      endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: R2_ACCESS_KEY_ID!,
        secretAccessKey: R2_SECRET_ACCESS_KEY!,
      },
    });
  }
  return client;
}

export function isR2Configured(): boolean {
  return isConfigured;
}

function publicUrl(key: string): string {
  return `${R2_PUBLIC_BASE_URL!.replace(/\/$/, '')}/${key}`;
}

async function objectExists(key: string): Promise<boolean> {
  try {
    await getClient().send(new HeadObjectCommand({ Bucket: R2_BUCKET!, Key: key }));
    return true;
  } catch {
    return false;
  }
}

/**
 * Upload a media buffer under a deterministic key. Idempotent: if the object
 * already exists it is not re-uploaded (keeps daily syncs cheap). Returns the
 * public URL, or null when R2 is not configured.
 */
export async function uploadMedia(
  key: string,
  body: Buffer,
  contentType: string,
): Promise<string | null> {
  if (!isConfigured) return null;

  if (await objectExists(key)) return publicUrl(key);

  await getClient().send(
    new PutObjectCommand({
      Bucket: R2_BUCKET!,
      Key: key,
      Body: body,
      ContentType: contentType,
      CacheControl: 'public, max-age=31536000, immutable',
    }),
  );

  return publicUrl(key);
}
