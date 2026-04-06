import { proxyJsonRequest } from "../../_backend";

export async function GET(request, { params }) {
  return proxyJsonRequest(`/sessions/${params.sessionId}`, request);
}