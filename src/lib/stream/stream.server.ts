// Server-only helpers for Cloudflare Stream. Never import from client code.
import { SignJWT, importPKCS8 } from "jose";

export type CFEnv = {
  accountId: string;
  apiToken: string;
  webhookSecret: string;
  signingKeyId?: string;
  signingKeyPem?: string;
};

export function readCloudflareEnv(): CFEnv {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const apiToken = process.env.CLOUDFLARE_STREAM_API_TOKEN;
  const webhookSecret = process.env.CLOUDFLARE_STREAM_WEBHOOK_SECRET;
  if (!accountId || !apiToken || !webhookSecret) {
    throw new Error("Cloudflare Stream env vars missing");
  }
  return {
    accountId,
    apiToken,
    webhookSecret,
    signingKeyId: process.env.CLOUDFLARE_STREAM_SIGNING_KEY_ID,
    signingKeyPem: process.env.CLOUDFLARE_STREAM_SIGNING_KEY_PEM?.replace(/\\n/g, "\n"),
  };
}

const CF_BASE = "https://api.cloudflare.com/client/v4";

async function cfFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const env = readCloudflareEnv();
  const res = await fetch(`${CF_BASE}/accounts/${env.accountId}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${env.apiToken}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  const json = (await res.json()) as { success: boolean; result: T; errors?: unknown };
  if (!res.ok || !json.success) {
    throw new Error(`Cloudflare Stream API error: ${JSON.stringify(json.errors ?? res.statusText)}`);
  }
  return json.result;
}

export type DirectUploadResult = {
  uid: string;
  uploadURL: string;
};

export async function createDirectUpload(params: {
  maxDurationSeconds?: number;
  requireSignedURLs?: boolean;
  meta?: Record<string, string>;
}): Promise<DirectUploadResult> {
  const body = {
    maxDurationSeconds: params.maxDurationSeconds ?? 60 * 60 * 3,
    requireSignedURLs: params.requireSignedURLs ?? true,
    meta: params.meta ?? {},
  };
  return cfFetch<DirectUploadResult>("/stream/direct_upload", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export type StreamVideoInfo = {
  uid: string;
  status: { state: string };
  duration: number;
  thumbnail: string;
  preview: string;
  readyToStream: boolean;
  requireSignedURLs: boolean;
  meta?: Record<string, string>;
};

export async function getVideoInfo(uid: string): Promise<StreamVideoInfo> {
  return cfFetch<StreamVideoInfo>(`/stream/${uid}`);
}

/**
 * Signs a short-lived JWT that Cloudflare Stream accepts as a playback token.
 * Uses the Stream signing key (RS256, PKCS8 PEM).
 */
export async function signPlaybackToken(params: {
  videoUid: string;
  expiresInSeconds?: number;
}): Promise<string> {
  const env = readCloudflareEnv();
  if (!env.signingKeyId || !env.signingKeyPem) {
    throw new Error("Signing key not configured");
  }
  const ttl = params.expiresInSeconds ?? 60 * 60; // 1h default
  const key = await importPKCS8(env.signingKeyPem, "RS256");
  const now = Math.floor(Date.now() / 1000);
  const jwt = await new SignJWT({})
    .setProtectedHeader({ alg: "RS256", kid: env.signingKeyId })
    .setIssuedAt(now)
    .setNotBefore(now - 60)
    .setExpirationTime(now + ttl)
    .setSubject(params.videoUid)
    .sign(key);
  return jwt;
}

/**
 * Verify a Cloudflare Stream webhook signature.
 * Header format: "time=<unix>,sig1=<hex-hmac-sha256>"
 * Signed payload: `${time}.${rawBody}`
 */
export async function verifyStreamWebhook(rawBody: string, header: string): Promise<boolean> {
  if (!header) return false;
  const parts = Object.fromEntries(
    header.split(",").map((p) => {
      const [k, v] = p.split("=");
      return [k?.trim(), v?.trim()];
    }),
  );
  const time = parts.time;
  const sig = parts.sig1;
  if (!time || !sig) return false;

  // 5-minute freshness window
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - Number(time)) > 300) return false;

  const env = readCloudflareEnv();
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(env.webhookSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, enc.encode(`${time}.${rawBody}`));
  const expected = Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  // Constant-time-ish compare
  if (expected.length !== sig.length) return false;
  let mismatch = 0;
  for (let i = 0; i < expected.length; i++) {
    mismatch |= expected.charCodeAt(i) ^ sig.charCodeAt(i);
  }
  return mismatch === 0;
}
