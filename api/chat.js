import Anthropic from "@anthropic-ai/sdk";
import { CHAT_MODEL, requireEnv } from "../lib/env.js";
import { embed } from "../lib/embeddings.js";
import { guard, rateLimiter, readJson, sendJson } from "../lib/http.js";
import { SYSTEM_PROMPT, buildUserContent } from "../lib/prompt.js";
import { supabaseAdmin } from "../lib/supabase.js";

const MATCH_COUNT = 8; // 검색해 올 문서 조각 수
// 주소·연락처·등록번호 등 기본 정보는 질문 표현과 관계없이 항상 근거에 포함한다
const CORE_SOURCE = "company-profile.md#회사 개요";
const MIN_SIMILARITY = 0.25; // 이보다 관련도가 낮은 조각은 근거로 쓰지 않는다
const MAX_MESSAGE = 1000;
const MAX_HISTORY = 8;
const SESSION_ID = /^[A-Za-z0-9-]{8,64}$/;

const FALLBACK_REPLY =
  "지금은 답변을 드리기 어렵습니다. 전화(010-3848-5949)나 카카오톡 채널, 또는 아래 '상담 신청'으로 문의해 주세요.";

const isLimited = rateLimiter({ limit: 20, windowMs: 5 * 60 * 1000 });
let anthropic;

function cleanHistory(history) {
  if (!Array.isArray(history)) return [];
  const turns = history
    .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
    .map((m) => ({ role: m.role, content: m.content.slice(0, 1500) }))
    .slice(-MAX_HISTORY);
  while (turns.length && turns[0].role !== "user") turns.shift(); // 첫 메시지는 user 여야 한다
  return turns;
}

async function logChat(rows) {
  const { error } = await supabaseAdmin().from("chat_logs").insert(rows);
  if (error) console.error("chat_logs 저장 실패:", error.message);
}

export default async function handler(req, res) {
  if (!guard(req, res, isLimited)) return;

  let body;
  try {
    body = await readJson(req);
  } catch (err) {
    return sendJson(res, err.status || 400, { error: err.message });
  }

  const message = typeof body.message === "string" ? body.message.trim() : "";
  const sessionId = typeof body.sessionId === "string" ? body.sessionId : "";
  if (!message || message.length > MAX_MESSAGE) {
    return sendJson(res, 400, { error: `질문은 1~${MAX_MESSAGE}자로 입력해 주세요.` });
  }
  if (!SESSION_ID.test(sessionId)) {
    return sendJson(res, 400, { error: "잘못된 세션입니다. 새로고침 후 다시 시도해 주세요." });
  }

  // 실패 단계만 응답에 남긴다 (키·오류 내용은 노출하지 않음): embed / search / generate / log
  let stage = "embed";
  try {
    // 1) 질문 임베딩 → 2) 유사 문서 검색
    const [queryEmbedding] = await embed([message]);
    stage = "search";
    const db = supabaseAdmin();
    const [{ data: matches, error: matchError }, { data: core }] = await Promise.all([
      db.rpc("match_documents", { query_embedding: queryEmbedding, match_count: MATCH_COUNT }),
      db.from("documents").select("source, content").eq("source", CORE_SOURCE).limit(1),
    ]);
    if (matchError) throw new Error(`문서 검색 실패: ${matchError.message}`);
    const docs = (matches || []).filter((d) => d.similarity >= MIN_SIMILARITY);
    if (core?.[0] && !docs.some((d) => d.source === CORE_SOURCE)) docs.unshift(core[0]);

    // 3) 검색된 문서만 근거로 답변 생성
    stage = "generate";
    anthropic ||= new Anthropic({ apiKey: requireEnv("ANTHROPIC_API_KEY") });
    const response = await anthropic.beta.messages.create({
      model: CHAT_MODEL,
      max_tokens: 8000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default", // 안전 분류기가 거절하면 서버가 다른 모델로 다시 시도
      output_config: { effort: "low" }, // 짧은 상담 답변이라 낮은 effort로 충분
      system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
      messages: [
        ...cleanHistory(body.history),
        { role: "user", content: buildUserContent(message, docs) },
      ],
    });

    const text = response.content
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim();
    const reply = response.stop_reason === "refusal" || !text ? FALLBACK_REPLY : text;

    stage = "log";
    await logChat([
      { session_id: sessionId, role: "user", content: message },
      { session_id: sessionId, role: "assistant", content: reply },
    ]);

    return sendJson(res, 200, { reply });
  } catch (err) {
    if (err instanceof Anthropic.RateLimitError) {
      console.error("Claude 요청 한도 초과:", err.message);
    } else if (err instanceof Anthropic.APIError) {
      console.error(`Claude API 오류 ${err.status}:`, err.message);
    } else {
      console.error(`챗봇 처리 오류(${stage}):`, err.message);
    }
    // 원인 구분용 코드: HTTP 상태 번호 또는 missing_env (키 값은 노출하지 않음)
    const detail = err.status || (/환경 변수/.test(err.message) ? "missing_env" : "error");
    return sendJson(res, 200, { reply: FALLBACK_REPLY, degraded: true, stage, detail });
  }
}
