// docs/*.md → 청크 분할 → 임베딩 → Supabase documents 테이블 적재
//
// 사용법
//   npm run ingest:dry   키 없이 청크 분할 결과만 확인
//   npm run ingest       .env.local 의 키로 임베딩 후 documents 를 통째로 교체
//
// 필요한 환경 변수 (.env.local): OPENAI_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DOCS_DIR = path.join(ROOT, "docs");
const MAX_CHARS = 1200; // 한 청크의 최대 길이 (넘으면 문단 단위로 나눈다)
const BATCH = 64; // 임베딩 한 번에 보낼 청크 수

// 챗봇에 넣지 않을 내부용 섹션
const SKIP_SECTIONS = ["운영 전 확정할 항목", "확인된 정보와 미확정 정보"];

// 문서의 내부 표시를 고객용 표현으로 바꾼다.
export function toPublicText(text) {
  return text
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/\[확정 필요: [^\]]*\]/g, "상담 시 확인 후 안내")
    .replace(/\s*\[법률·운영 검토 필요\]/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function splitLong(text) {
  if (text.length <= MAX_CHARS) return [text];
  const parts = [];
  let current = "";
  for (const para of text.split(/\n{2,}/)) {
    if (current && (current + "\n\n" + para).length > MAX_CHARS) {
      parts.push(current);
      current = para;
    } else {
      current = current ? `${current}\n\n${para}` : para;
    }
  }
  if (current) parts.push(current);
  return parts;
}

// FAQ: 질문 하나가 청크 하나
export function chunkFaq(markdown, file) {
  const chunks = [];
  const blocks = markdown.split(/^(?=### FAQ-\d{3}\. )/m).slice(1);
  for (const block of blocks) {
    const [, id, question] = block.match(/^### (FAQ-\d{3})\. (.+)$/m);
    const meta = Object.fromEntries(
      [...block.matchAll(/^- (카테고리|대상|태그): (.+)$/gm)].map((m) => [m[1], m[2].trim()]),
    );
    const answer = block
      .split("\n")
      .filter((l) => l.trim() && !l.startsWith("### ") && !l.startsWith("- ") && !l.startsWith("## "))
      .join("\n");
    const content = toPublicText(
      `[${id}] ${meta["카테고리"] || ""} (대상: ${meta["대상"] || "공통"})\n질문: ${question}\n답변: ${answer}\n관련 키워드: ${meta["태그"] || ""}`,
    );
    chunks.push({ source: `${file}#${id}`, content });
  }
  return chunks;
}

// 일반 문서: 제목(H2·H3) 단위로 나누고 제목 경로를 청크 앞에 붙인다
export function chunkSections(markdown, file) {
  const chunks = [];
  let h1 = "";
  let h2 = "";
  let h3 = "";
  let buffer = [];

  const flush = () => {
    const body = toPublicText(buffer.join("\n"));
    buffer = [];
    if (!body) return;
    if (SKIP_SECTIONS.some((s) => h2.includes(s) || h3.includes(s))) return;
    const heading = [h1, h2, h3].filter(Boolean).join(" > ");
    splitLong(body).forEach((part, i, all) => {
      const label = [h2, h3].filter(Boolean).join(" > ") || h1;
      chunks.push({
        source: `${file}#${label}${all.length > 1 ? ` (${i + 1})` : ""}`,
        content: `${heading}\n\n${part}`,
      });
    });
  };

  for (const line of markdown.split("\n")) {
    if (line.startsWith("# ")) {
      flush();
      h1 = line.slice(2).trim();
    } else if (line.startsWith("## ")) {
      flush();
      h2 = line.slice(3).trim();
      h3 = "";
    } else if (line.startsWith("### ")) {
      flush();
      h3 = line.slice(4).trim();
    } else {
      buffer.push(line);
    }
  }
  flush();
  return chunks;
}

export async function buildChunks() {
  const files = (await readdir(DOCS_DIR)).filter((f) => f.endsWith(".md")).sort();
  const chunks = [];
  for (const file of files) {
    const markdown = await readFile(path.join(DOCS_DIR, file), "utf8");
    chunks.push(...(file === "faq.md" ? chunkFaq(markdown, file) : chunkSections(markdown, file)));
  }
  return chunks;
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const chunks = await buildChunks();

  const byFile = {};
  for (const c of chunks) byFile[c.source.split("#")[0]] = (byFile[c.source.split("#")[0]] || 0) + 1;
  console.log(`청크 ${chunks.length}개:`, byFile);
  const longest = Math.max(...chunks.map((c) => c.content.length));
  console.log(`가장 긴 청크 ${longest}자`);

  if (dryRun) {
    for (const c of chunks.slice(0, 3)) console.log(`\n--- ${c.source}\n${c.content}`);
    return;
  }

  try {
    process.loadEnvFile(path.join(ROOT, ".env.local"));
  } catch {
    // .env.local 이 없으면 이미 설정된 환경 변수를 쓴다
  }
  const { embed } = await import("../lib/embeddings.js");
  const { supabaseAdmin } = await import("../lib/supabase.js");

  const rows = [];
  for (let i = 0; i < chunks.length; i += BATCH) {
    const batch = chunks.slice(i, i + BATCH);
    const vectors = await embed(batch.map((c) => c.content));
    batch.forEach((c, j) => rows.push({ ...c, embedding: vectors[j] }));
    console.log(`임베딩 ${Math.min(i + BATCH, chunks.length)}/${chunks.length}`);
  }

  const db = supabaseAdmin();
  const { error: delError } = await db.from("documents").delete().gte("id", 0);
  if (delError) throw new Error(`기존 문서 삭제 실패: ${delError.message}`);
  const { error: insError } = await db.from("documents").insert(rows);
  if (insError) throw new Error(`문서 적재 실패: ${insError.message}`);
  console.log(`documents 테이블에 ${rows.length}개 적재 완료`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
}
