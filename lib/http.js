import { ALLOWED_ORIGINS } from "./env.js";

const LOCAL_ORIGIN = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;

export function sendJson(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(body));
}

// 브라우저 요청은 허용한 사이트에서 온 것만 받는다.
export function isAllowedOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return false;
  if (ALLOWED_ORIGINS.includes(origin)) return true;
  return process.env.VERCEL_ENV !== "production" && LOCAL_ORIGIN.test(origin);
}

export async function readJson(req, maxBytes = 32 * 1024) {
  if (req.body && typeof req.body === "object") return req.body; // Vercel 이 이미 파싱한 경우
  let size = 0;
  const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > maxBytes) throw Object.assign(new Error("요청이 너무 큽니다."), { status: 413 });
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
  } catch {
    throw Object.assign(new Error("JSON 형식이 아닙니다."), { status: 400 });
  }
}

export function clientIp(req) {
  const fwd = req.headers["x-forwarded-for"];
  return (Array.isArray(fwd) ? fwd[0] : fwd || "").split(",")[0].trim() || req.socket?.remoteAddress || "unknown";
}

// 간단한 IP별 요청 제한. 서버리스 인스턴스마다 따로 세므로 최소한의 보호 장치다.
export function rateLimiter({ limit, windowMs }) {
  const hits = new Map();
  return function isLimited(key) {
    const now = Date.now();
    const recent = (hits.get(key) || []).filter((t) => now - t < windowMs);
    recent.push(now);
    hits.set(key, recent);
    if (hits.size > 5000) hits.clear();
    return recent.length > limit;
  };
}

// 공통 진입 처리: 메서드·출처·요청 제한 검사. 통과하면 true.
export function guard(req, res, isLimited) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    sendJson(res, 405, { error: "POST 요청만 받습니다." });
    return false;
  }
  if (!isAllowedOrigin(req)) {
    sendJson(res, 403, { error: "허용되지 않은 요청입니다." });
    return false;
  }
  if (isLimited(clientIp(req))) {
    sendJson(res, 429, { error: "요청이 많습니다. 잠시 후 다시 시도해 주세요." });
    return false;
  }
  return true;
}
