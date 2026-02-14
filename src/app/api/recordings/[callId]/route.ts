import { Storage } from "@google-cloud/storage";
import { NextResponse } from "next/server";
import { z } from "zod";

import { getCallRecordingMetadata } from "@/lib/calls/recording-store";
import { getRecordingConfig } from "@/lib/env";

export const runtime = "nodejs";

const paramsSchema = z.object({
  callId: z.string().cuid(),
});

type RouteContext = {
  params: Promise<{ callId: string }>;
};

export async function GET(_request: Request, { params }: RouteContext) {
  const parsedParams = paramsSchema.safeParse(await params);
  if (!parsedParams.success) {
    return NextResponse.json({ error: "Invalid call id." }, { status: 400 });
  }

  const metadata = await getCallRecordingMetadata(parsedParams.data.callId);
  if (!metadata) {
    return NextResponse.json({ error: "Recording not found." }, { status: 404 });
  }

  if (metadata.provider !== "gcp") {
    return NextResponse.json({ error: "Unsupported recording provider." }, { status: 501 });
  }

  const recordingConfig = (() => {
    try {
      return getRecordingConfig();
    } catch {
      return null;
    }
  })();
  if (!recordingConfig || recordingConfig.provider !== "gcp") {
    return NextResponse.json({ error: "Recording storage is not configured." }, { status: 503 });
  }

  const projectId = getProjectId(recordingConfig.gcpCredentials);
  const storage = new Storage({
    credentials: recordingConfig.gcpCredentials as { [key: string]: string },
    projectId,
  });

  const location = parseStorageLocation(metadata.location);
  if (location) {
    const file = storage.bucket(location.bucket).file(location.object);
    const [exists] = await file.exists();
    if (!exists) {
      return NextResponse.json({ error: "Recording file not found in bucket." }, { status: 404 });
    }

    const [audio] = await file.download();
    return new Response(new Uint8Array(audio), {
      status: 200,
      headers: {
        "content-type": "audio/mpeg",
        "cache-control": "private, max-age=120",
      },
    });
  }

  if (metadata.location.startsWith("http://") || metadata.location.startsWith("https://")) {
    const upstream = await fetch(metadata.location).catch(() => null);
    if (!upstream?.ok) {
      return NextResponse.json({ error: "Recording file not reachable." }, { status: 502 });
    }
    const audio = await upstream.arrayBuffer();
    return new Response(audio, {
      status: 200,
      headers: {
        "content-type": upstream.headers.get("content-type") ?? "audio/mpeg",
        "cache-control": "private, max-age=120",
      },
    });
  }

  return NextResponse.json({ error: "Invalid recording location." }, { status: 500 });
}

function parseStorageLocation(location: string) {
  if (location.startsWith("gs://")) {
    const value = location.slice("gs://".length);
    const firstSlash = value.indexOf("/");
    if (firstSlash <= 0) {
      return null;
    }

    const bucket = value.slice(0, firstSlash);
    const object = value.slice(firstSlash + 1);
    if (!bucket || !object) {
      return null;
    }

    return { bucket, object: decodeURIComponent(object) };
  }

  if (!location.startsWith("http://") && !location.startsWith("https://")) {
    return null;
  }

  let parsed: URL;
  try {
    parsed = new URL(location);
  } catch {
    return null;
  }

  const host = parsed.hostname.toLowerCase();
  const pathname = parsed.pathname.replace(/^\/+/, "");
  if (!pathname) {
    return null;
  }

  if (host === "storage.googleapis.com" || host === "storage.cloud.google.com") {
    const firstSlash = pathname.indexOf("/");
    if (firstSlash <= 0) {
      return null;
    }

    const bucket = pathname.slice(0, firstSlash);
    const object = pathname.slice(firstSlash + 1);
    if (!bucket || !object) {
      return null;
    }
    return { bucket, object: decodeURIComponent(object) };
  }

  const bucketSubdomainSuffixes = [".storage.googleapis.com", ".storage.cloud.google.com"];
  for (const suffix of bucketSubdomainSuffixes) {
    if (host.endsWith(suffix)) {
      const bucket = host.slice(0, -suffix.length);
      if (!bucket || !pathname) {
        return null;
      }
      return { bucket, object: decodeURIComponent(pathname) };
    }
  }

  return null;
}

function getProjectId(credentials: Record<string, unknown>) {
  const value = credentials.project_id;
  return typeof value === "string" ? value : undefined;
}
