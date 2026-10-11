import { EMBEDDING_MODEL, requireEnv } from "./env.js";

// OpenAI 임베딩 (1536차원). inputs 는 문자열 배열, 결과는 같은 순서의 벡터 배열.
export async function embed(inputs) {
  const res = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${requireEnv("OPENAI_API_KEY")}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model: EMBEDDING_MODEL, input: inputs }),
  });
  if (!res.ok) {
    throw Object.assign(new Error(`임베딩 요청 실패 (${res.status})`), { status: res.status });
  }
  const json = await res.json();
  return json.data.sort((a, b) => a.index - b.index).map((d) => d.embedding);
}
