-- =====================================================================
-- 고객응대 챗봇 스키마 (Supabase SQL Editor 붙여넣기용, 재실행 안전)
-- 1) pgvector  2) documents / leads / chat_logs  3) match_documents
-- 4) 세 테이블 RLS 활성화, 공개 정책 없음 (service_role 키로만 접근)
-- =====================================================================

-- 1. pgvector 확장 활성화
create extension if not exists vector with schema extensions;

-- 2-1. 챗봇 지식 문서
create table if not exists public.documents (
  id         bigint generated always as identity primary key,
  source     text not null,                  -- 예: 'faq.md#FAQ-001'
  content    text not null,
  embedding  extensions.vector(1536),
  created_at timestamptz not null default now()
);

create index if not exists documents_embedding_hnsw_idx
  on public.documents
  using hnsw (embedding extensions.vector_cosine_ops);

-- 2-2. 상담 문의(리드)
create table if not exists public.leads (
  id         bigint generated always as identity primary key,
  name       text not null,
  phone      text,
  email      text,
  company    text,
  message    text,
  created_at timestamptz not null default now()
);

-- 2-3. 대화 기록
create table if not exists public.chat_logs (
  id         bigint generated always as identity primary key,
  session_id text not null,
  role       text not null check (role in ('user', 'assistant', 'system')),
  content    text not null,
  created_at timestamptz not null default now()
);

create index if not exists chat_logs_session_created_idx
  on public.chat_logs (session_id, created_at);

-- 3. 코사인 유사도 상위 N개 문서 반환
--    similarity = 1 - 코사인 거리 (1에 가까울수록 유사), match_count 1~50
create or replace function public.match_documents(
  query_embedding extensions.vector(1536),
  match_count     int default 5
)
returns table (
  id         bigint,
  source     text,
  content    text,
  similarity double precision
)
language sql
stable
set search_path = ''
as $$
  select
    d.id,
    d.source,
    d.content,
    1 - (d.embedding operator(extensions.<=>) query_embedding) as similarity
  from public.documents d
  where d.embedding is not null
  order by d.embedding operator(extensions.<=>) query_embedding
  limit least(greatest(match_count, 1), 50);
$$;

-- 함수는 서버(service_role)에서만 호출
revoke execute on function public.match_documents(extensions.vector, int) from public, anon, authenticated;
grant  execute on function public.match_documents(extensions.vector, int) to service_role;

-- 4. RLS 활성화, 공개 정책 없음
alter table public.documents enable row level security;
alter table public.leads     enable row level security;
alter table public.chat_logs enable row level security;
