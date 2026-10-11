import { guard, rateLimiter, readJson, sendJson } from "../lib/http.js";
import { supabaseAdmin } from "../lib/supabase.js";

const isLimited = rateLimiter({ limit: 5, windowMs: 10 * 60 * 1000 });

const PHONE = /^[0-9+()\-\s]{8,20}$/;
const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,255}\.[^\s@]{2,}$/;

function text(value, max) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export function validateLead(body) {
  const lead = {
    name: text(body.name, 50),
    phone: text(body.phone, 20),
    email: text(body.email, 120),
    company: text(body.company, 100),
    message: text(body.message, 2000),
  };
  if (!lead.name) return { error: "이름을 입력해 주세요." };
  if (!lead.phone && !lead.email) return { error: "연락처나 이메일 중 하나는 꼭 입력해 주세요." };
  if (lead.phone && !PHONE.test(lead.phone)) return { error: "연락처 형식을 확인해 주세요." };
  if (lead.email && !EMAIL.test(lead.email)) return { error: "이메일 형식을 확인해 주세요." };
  if (body.consent !== true) return { error: "개인정보 수집·이용에 동의해 주세요." };
  for (const key of ["phone", "email", "company", "message"]) if (!lead[key]) lead[key] = null;
  return { lead };
}

export default async function handler(req, res) {
  if (!guard(req, res, isLimited)) return;

  let body;
  try {
    body = await readJson(req);
  } catch (err) {
    return sendJson(res, err.status || 400, { error: err.message });
  }

  // 사람에게 보이지 않는 칸(website)이 채워졌으면 자동 입력 봇으로 보고 저장하지 않는다.
  if (typeof body.website === "string" && body.website.trim()) {
    return sendJson(res, 200, { ok: true });
  }

  const { lead, error } = validateLead(body);
  if (error) return sendJson(res, 400, { error });

  try {
    const { error: insertError } = await supabaseAdmin().from("leads").insert(lead);
    if (insertError) throw new Error(insertError.message);
    return sendJson(res, 200, { ok: true });
  } catch (err) {
    console.error("leads 저장 실패:", err.message);
    return sendJson(res, 500, { error: "접수 중 문제가 생겼습니다. 전화(010-3848-5949)로 문의해 주세요." });
  }
}
