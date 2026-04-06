const DEFAULT_BACKEND_URL = "http://127.0.0.1:5000";

export function getBackendBaseUrl() {
  const dockerDefault = process.env.NODE_ENV === "production" ? "http://backend:5000" : DEFAULT_BACKEND_URL;
  return (process.env.BACKEND_API_URL || process.env.NEXT_PUBLIC_API_BASE_URL || dockerDefault).replace(/\/$/, "");
}

export async function proxyJsonRequest(path, request) {
  const backendUrl = new URL(path, getBackendBaseUrl());
  const init = {
    method: request.method,
    headers: {
      "Content-Type": request.headers.get("content-type") || "application/json",
    },
    cache: "no-store",
  };

  if (request.method !== "GET" && request.method !== "HEAD") {
    init.body = await request.text();
  }

  const response = await fetch(backendUrl, init);
  const contentType = response.headers.get("content-type") || "application/json";
  const body = await response.text();

  return new Response(body, {
    status: response.status,
    headers: {
      "Content-Type": contentType,
    },
  });
}