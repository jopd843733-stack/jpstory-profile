# JP이야기(월드원공인중개사사무소) 회사 문서·웹페이지·상담 챗봇

웹사이트 카피와 고객응대 챗봇 지식으로 쓰는 문서 3종, 디자인을 적용한 회사 소개 웹페이지, 문서 기반(RAG) 상담 챗봇입니다.

웹페이지 주소: https://jpstory-profile.vercel.app

## 구성

| 경로 | 내용 |
|---|---|
| `docs/company-profile.md` | 회사 소개서 |
| `docs/service-policy.md` | 서비스 및 계약·정산 정책 |
| `docs/faq.md` | 자주 묻는 질문 100개 |
| `public/index.html` | 배포용 회사 소개 웹페이지 (Vercel 출력 폴더) |
| `public/chatbot.js` | 오른쪽 아래 상담 챗봇 위젯 (키 없음) |
| `api/chat.js` | 챗봇 답변 API: 질문 임베딩 → 문서 검색 → 답변 생성 → 대화 기록 |
| `api/lead.js` | 상담 신청 API: 입력 검사 → `leads` 저장 |
| `lib/` | 서버 공통 코드 (환경 변수, Supabase, 임베딩, 시스템 프롬프트) |
| `scripts/ingest.mjs` | `docs/*.md` → 청크 분할 → 임베딩 → Supabase `documents` 적재 |
| `scripts/dev-server.mjs` | 로컬 확인용 서버 |
| `supabase/` | 데이터베이스 스키마 (마이그레이션, SQL Editor용) |
| `design/` | 디자인 시스템, 시안, 검토용 웹페이지 |
| `_src/`, `_data/facts.yaml` | 문서·웹페이지 원본 템플릿과 운영 정책 값 |
| `_research/sources.md` | 자료 수집 기록 |

## 환경 변수 (서버 전용)

키는 서버(`api/`, `scripts/`)에서만 씁니다. `public/` 에는 어떤 키도 넣지 않습니다.

| 이름 | 설명 |
|---|---|
| `ANTHROPIC_API_KEY` | 답변 생성 (Claude) |
| `OPENAI_API_KEY` | 임베딩 (`text-embedding-3-small`, 1536차원) |
| `SUPABASE_URL` | `https://zfommmoxtxjrctoswsot.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase 서버용 키 (RLS 우회, 절대 공개 금지) |
| `CHAT_MODEL` (선택) | 기본값 `claude-opus-5-5` |
| `ALLOWED_ORIGINS` (선택) | 챗봇 API를 호출할 수 있는 사이트. 기본값 `https://jpstory-profile.vercel.app` |

- 배포: Vercel 프로젝트 Settings → Environment Variables 에 입력합니다.
- 로컬: `.env.example` 을 `.env.local` 로 복사해 값을 채웁니다. `.env.local` 은 저장소에 올라가지 않습니다.

## 챗봇 지식 적재

문서를 고친 뒤에는 Supabase 에 다시 적재해야 챗봇 답변에 반영됩니다.

```bash
npm install
npm run ingest:dry   # 키 없이 청크 분할 결과만 확인
npm run ingest       # 임베딩 후 documents 테이블을 통째로 교체
```

적재할 때 `[확정 필요: …]` 는 "상담 시 확인 후 안내"로 바뀌고, `[법률·운영 검토 필요]` 표시와 "운영 전 확정할 항목" 같은 내부 구역은 빠집니다.

## 로컬 확인

```bash
npm run dev -- --mock   # 키 없이 화면만 확인 (고정 답변, DB 저장 안 함)
npm run dev             # .env.local 의 키로 실제 동작 확인
```

## 정책 값 반영 방법

1. `_data/facts.yaml` 에서 `value: null` 을 실제 값으로 바꿉니다.
2. 문서와 웹페이지를 다시 만들고 검사합니다.

   ```bash
   python scripts/render_docs.py
   python scripts/validate_docs.py
   ```

3. `npm run ingest` 로 챗봇 지식을 다시 적재합니다.
4. 변경 사항을 커밋하고 GitHub `main` 브랜치에 푸시하면 Vercel에 자동으로 다시 배포됩니다.

문서와 웹페이지는 생성 결과물입니다. 내용을 고칠 때는 `_src/` 의 원본을 수정합니다.
