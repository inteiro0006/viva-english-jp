// Server-only helpers for Cloudflare Stream. Never import from client code.
import { SignJWT, importPKCS8 } from "jose";

export type CFEnv = {
  accountId: string;
  apiToken: string;
  webhookSecret: string;
  signingKeyId?: string;
  signingKeyPem?: string;
};

export class CloudflareStreamApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly errors: unknown,
  ) {
    super(message);
    this.name = "CloudflareStreamApiError";
  }
}

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
    throw new CloudflareStreamApiError(
      `Cloudflare Stream API error: ${JSON.stringify(json.errors ?? res.statusText)}`,
      res.status,
      json.errors ?? res.statusText,
    );
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

/** Lists every video in the Stream account (paginated by upload date). */
export async function listAllStreamVideos(): Promise<StreamVideoInfo[]> {
  const out: StreamVideoInfo[] = [];
  let before: string | undefined;
  for (let page = 0; page < 20; page++) {
    const qs = new URLSearchParams({ limit: "1000" });
    if (before) qs.set("before", before);
    const batch = await cfFetch<(StreamVideoInfo & { created?: string })[]>(
      `/stream?${qs.toString()}`,
    );
    if (!batch?.length) break;
    out.push(...batch);
    if (batch.length < 1000) break;
    before = batch[batch.length - 1]?.created;
    if (!before) break;
  }
  return out;
}

/** Forces a video to require signed URLs (private playback). */
export async function enforceSignedUrls(uid: string): Promise<void> {
  await cfFetch(`/stream/${uid}`, {
    method: "POST",
    body: JSON.stringify({ requireSignedURLs: true }),
  });
}

export async function deleteStreamVideo(uid: string): Promise<void> {
  const env = readCloudflareEnv();
  const res = await fetch(`${CF_BASE}/accounts/${env.accountId}/stream/${uid}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${env.apiToken}` },
  });
  if (res.status === 404) return; // already gone on Cloudflare
  if (!res.ok) {
    let errors: unknown = res.statusText;
    try {
      const json = (await res.json()) as { errors?: unknown };
      errors = json.errors ?? res.statusText;
    } catch {
      /* ignore */
    }
    throw new CloudflareStreamApiError(
      `Cloudflare Stream API error: ${JSON.stringify(errors)}`,
      res.status,
      errors,
    );
  }
}

/**
 * Asks Cloudflare to mint a signed playback token for a video.
 * Works with just the Stream API token (no local signing key needed).
 */
async function requestPlaybackTokenFromCloudflare(params: {
  videoUid: string;
  expiresInSeconds: number;
}): Promise<string> {
  const exp = Math.floor(Date.now() / 1000) + params.expiresInSeconds;
  const result = await cfFetch<{ token: string }>(`/stream/${params.videoUid}/token`, {
    method: "POST",
    body: JSON.stringify({ exp }),
  });
  if (!result?.token) throw new Error("Cloudflare did not return a playback token");
  return result.token;
}

/**
 * Signs a short-lived JWT that Cloudflare Stream accepts as a playback token.
 * Prefers the local Stream signing key (RS256, PKCS8 PEM); when that key is
 * missing or malformed, falls back to Cloudflare's token endpoint.
 */
export async function signPlaybackToken(params: {
  videoUid: string;
  expiresInSeconds?: number;
}): Promise<string> {
  const env = readCloudflareEnv();
  const ttl = params.expiresInSeconds ?? 60 * 60; // 1h default
  const hasLocalKey =
    !!env.signingKeyId &&
    !!env.signingKeyPem &&
    env.signingKeyPem.includes("BEGIN") &&
    env.signingKeyPem.includes("PRIVATE KEY");

  if (hasLocalKey) {
    try {
      const key = await importPKCS8(env.signingKeyPem!, "RS256");
      const now = Math.floor(Date.now() / 1000);
      return await new SignJWT({})
        .setProtectedHeader({ alg: "RS256", kid: env.signingKeyId })
        .setIssuedAt(now)
        .setNotBefore(now - 60)
        .setExpirationTime(now + ttl)
        .setSubject(params.videoUid)
        .sign(key);
    } catch {
      // Fall through to the Cloudflare-hosted signing endpoint.
    }
  }

  return requestPlaybackTokenFromCloudflare({
    videoUid: params.videoUid,
    expiresInSeconds: ttl,
  });
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
