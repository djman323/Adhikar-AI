import { proxyJsonRequest } from "../_backend";

export async function POST(request) {
  return proxyJsonRequest("/chat", request);
}