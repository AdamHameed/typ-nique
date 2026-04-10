import type { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

function resolveApiOrigin() {
  if (process.env.API_INTERNAL_URL) {
    return process.env.API_INTERNAL_URL;
  }

  if (process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL;
  }

  if (process.env.NODE_ENV !== "production") {
    return "http://127.0.0.1:4000";
  }

  throw new Error("API_INTERNAL_URL or NEXT_PUBLIC_API_URL must be set for the web API proxy in production.");
}

async function proxyRequest(request: NextRequest, path: string[]) {
  const targetUrl = new URL(`/api/v1/${path.join("/")}${request.nextUrl.search}`, resolveApiOrigin());
  const headers = new Headers(request.headers);

  headers.delete("host");
  headers.delete("connection");
  headers.delete("content-length");

  const upstream = await fetch(targetUrl, {
    method: request.method,
    headers,
    body: request.method === "GET" || request.method === "HEAD" ? undefined : await request.arrayBuffer(),
    cache: "no-store",
    redirect: "manual"
  });

  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: upstream.headers
  });
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
