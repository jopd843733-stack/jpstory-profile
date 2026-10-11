// 서버 전용 환경 변수. 이 파일은 api/ 와 scripts/ 에서만 import 한다 (public/ 에서 쓰지 않는다).

export function requireEnv(name) {
  // 대시보드에 붙여넣을 때 섞여 들어간 공백·줄바꿈, "이름=" 접두어, 따옴표는 지운다
  const value = (process.env[name] || "")
    .trim()
    .replace(new RegExp(`^${name}\\s*=\\s*`), "")
    .replace(/^["']|["']$/g, "")
    .trim();
  if (!value) throw new Error(`환경 변수 ${name} 가 설정되지 않았습니다.`);
  return value;
}

export const CHAT_MODEL = process.env.CHAT_MODEL || "claude-opus-5-5";
export const EMBEDDING_MODEL = "text-embedding-3-small"; // 1536차원 (documents.embedding 과 일치)

// 챗봇 API를 호출할 수 있는 사이트 주소. 쉼표로 여러 개 지정한다.
export const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || "https://jpstory-profile.vercel.app")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
