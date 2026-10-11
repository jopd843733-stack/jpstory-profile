// 로컬 확인용 서버: public/ 정적 파일 + /api/chat, /api/lead
//
//   npm run dev               .env.local 의 키로 실제 API 호출
//   npm run dev -- --mock     키 없이 화면만 확인 (고정 답변, DB 저장 안 함)

import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PUBLIC = path.join(ROOT, "public");
const PORT = Number(process.env.PORT || 3000);
const MOCK = process.argv.includes("--mock");

try {
  process.loadEnvFile(path.join(ROOT, ".env.local"));
} catch {
  // .env.local 이 없으면 넘어간다
}

const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css" };

async function mockChat(req, res) {
  const { readJson, sendJson } = await import("../lib/http.js");
  const body = await readJson(req);
  await new Promise((r) => setTimeout(r, 600));
  sendJson(res, 200, {
    reply: `(테스트 답변) "${String(body.message).slice(0, 40)}"에 대한 안내입니다.\n실제 답변은 키를 설정한 뒤 확인할 수 있습니다. 문의: 010-3848-5949`,
  });
}

async function mockLead(req, res) {
  const { readJson, sendJson } = await import("../lib/http.js");
  const { validateLead } = await import("../api/lead.js");
  const body = await readJson(req);
  const { error } = validateLead(body);
  if (error) return sendJson(res, 400, { error });
  sendJson(res, 200, { ok: true });
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  try {
    if (url.pathname === "/api/chat" || url.pathname === "/api/lead") {
      if (MOCK) return url.pathname === "/api/chat" ? await mockChat(req, res) : await mockLead(req, res);
      const mod = await import(url.pathname === "/api/chat" ? "../api/chat.js" : "../api/lead.js");
      return await mod.default(req, res);
    }
    const file = path.join(PUBLIC, url.pathname === "/" ? "index.html" : path.normalize(url.pathname));
    if (!file.startsWith(PUBLIC)) throw Object.assign(new Error("forbidden"), { code: "ENOENT" });
    const data = await readFile(file);
    res.setHeader("Content-Type", TYPES[path.extname(file)] || "application/octet-stream");
    res.end(data);
  } catch (err) {
    res.statusCode = err.code === "ENOENT" ? 404 : 500;
    res.end(err.code === "ENOENT" ? "Not found" : "Server error");
  }
});

server.listen(PORT, () => {
  console.log(`http://localhost:${PORT} ${MOCK ? "(mock 모드)" : ""}`);
});
