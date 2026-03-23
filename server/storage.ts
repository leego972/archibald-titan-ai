// Storage helpers — supports AWS S3 and Cloudflare R2 fallback
import { ENV } from './_core/env';

function isS3Mode(): boolean {
  return !!process.env.AWS_S3_BUCKET;
}

// ---- AWS S3 Direct Mode ----
async function s3Put(
  relKey: string,
  data: Buffer | Uint8Array | string,
  contentType: string,
  originalFileName?: string
): Promise<{ key: string; url: string }> {
  const { S3Client, PutObjectCommand } = await import("@aws-sdk/client-s3");
  
  const bucket = process.env.AWS_S3_BUCKET!;
  const region = process.env.AWS_S3_REGION || "us-east-1";
  
  const client = new S3Client({
    region,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
    },
  });
  const key = relKey.replace(/^\/+/, "");
  const body = typeof data === "string" ? Buffer.from(data) : data;
  // Derive filename for Content-Disposition from the original filename or the S3 key
  const dispositionName = originalFileName || key.split("/").pop() || "file";
  await client.send(new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: body,
    ContentType: contentType,
    ContentDisposition: `attachment; filename="${dispositionName}"`,
    ACL: "public-read",
  }));
  const url = `https://${bucket}.s3.${region}.amazonaws.com/${key}`;
  return { key, url };
}

async function s3Get(relKey: string): Promise<{ key: string; url: string }> {
  const bucket = process.env.AWS_S3_BUCKET!;
  const region = process.env.AWS_S3_REGION || "us-east-1";
  const key = relKey.replace(/^\/+/, "");
  const url = `https://${bucket}.s3.${region}.amazonaws.com/${key}`;
  return { key, url };
}

// ---- Cloudflare R2 Fallback Mode ----
async function r2Put(
  relKey: string,
  data: Buffer | Uint8Array | string,
  contentType: string,
  originalFileName?: string
): Promise<{ key: string; url: string }> {
  const { S3Client, PutObjectCommand } = await import("@aws-sdk/client-s3");
  
  // R2 requires account ID in the endpoint
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID || "50a0dac68f7662315e516bd67d975c70";
  const bucket = process.env.CLOUDFLARE_R2_BUCKET || "titan-storage";
  
  const client = new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID || "",
      secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY || "",
    },
  });
  
  const key = relKey.replace(/^\/+/, "");
  const body = typeof data === "string" ? Buffer.from(data) : data;
  const dispositionName = originalFileName || key.split("/").pop() || "file";
  
  await client.send(new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: body,
    ContentType: contentType,
    ContentDisposition: `attachment; filename="${dispositionName}"`,
  }));
  
  // R2 public bucket URL (requires custom domain or public bucket routing)
  const publicDomain = process.env.CLOUDFLARE_R2_PUBLIC_DOMAIN || `pub-${accountId}.r2.dev`;
  const url = `https://${publicDomain}/${key}`;
  return { key, url };
}

async function r2Get(relKey: string): Promise<{ key: string; url: string }> {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID || "50a0dac68f7662315e516bd67d975c70";
  const key = relKey.replace(/^\/+/, "");
  const publicDomain = process.env.CLOUDFLARE_R2_PUBLIC_DOMAIN || `pub-${accountId}.r2.dev`;
  const url = `https://${publicDomain}/${key}`;
  return { key, url };
}

// ---- Public API ----
export async function storagePut(
  relKey: string,
  data: Buffer | Uint8Array | string,
  contentType = "application/octet-stream",
  originalFileName?: string
): Promise<{ key: string; url: string }> {
  if (isS3Mode()) {
    return s3Put(relKey, data, contentType, originalFileName);
  }
  return r2Put(relKey, data, contentType, originalFileName);
}

export async function storageGet(relKey: string): Promise<{ key: string; url: string; }> {
  if (isS3Mode()) {
    return s3Get(relKey);
  }
  return r2Get(relKey);
}

export async function storageDelete(relKey: string): Promise<void> {
  const { S3Client, DeleteObjectCommand } = await import("@aws-sdk/client-s3");
  
  if (isS3Mode()) {
    const bucket = process.env.AWS_S3_BUCKET!;
    const region = process.env.AWS_S3_REGION || "us-east-1";
    const client = new S3Client({
      region,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
      },
    });
    const key = relKey.replace(/^\/+/, "");
    await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
    return;
  }
  
  // R2 Fallback Mode
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID || "50a0dac68f7662315e516bd67d975c70";
  const bucket = process.env.CLOUDFLARE_R2_BUCKET || "titan-storage";
  
  const client = new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID || "",
      secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY || "",
    },
  });
  
  const key = relKey.replace(/^\/+/, "");
  await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
}
