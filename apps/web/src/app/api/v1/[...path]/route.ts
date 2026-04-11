import type { NextRequest } from "next/server";
import { resolveServerApiOrigin } from "../../../../lib/env";

export const dynamic = "force-dynamic";

async function proxyRequest(request: NextRequest, path: string[]) {
  const targetUrl = new URL(`/api/v1/${path.join("/")}${request.nextUrl.search}`, resolveServerApiOrigin());
  const headers = new Headers(request.headers);

  headers.delete("host");
  headers.delete("connection");
  headers.delete("content-length");

  try {
    const upstream = await fetch(targetUrl, {
      method: request.method,
      headers,
      body: request.method === "GET" || request.method === "HEAD" ? undefined : await request.arrayBuffer(),
      cache: "no-store",
      redirect: "manual",
      signal: AbortSignal.timeout(10_000)
    });

    return new Response(upstream.body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: upstream.headers
    });
  } catch {
    return new Response(JSON.stringify({ error: "API upstream unavailable." }), {
      status: 503,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store"
      }
    });
  }
}

async function resolvePath(params: Promise<{ path: string[] }>) {
  return (await params).path;
}

export async function GET(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  return proxyRequest(request, await resolvePath(context.params));
}

export async function POST(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  return proxyRequest(request, await resolvePath(context.params));
}

export async function PUT(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  return proxyRequest(request, await resolvePath(context.params));
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  return proxyRequest(request, await resolvePath(context.params));
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  return proxyRequest(request, await resolvePath(context.params));
}

export async function OPTIONS(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  return proxyRequest(request, await resolvePath(context.params));
}
