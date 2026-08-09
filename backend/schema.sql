-- Run this once against your Supabase Postgres database.
-- Enables pgvector and creates the "documents" table used by the RAG routes.
-- all-MiniLM-L6-v2 (used in services/embeddings.js) produces 384-dim vectors.

create extension if not exists vector;

create table if not exists documents (
  id bigserial primary key,
  content text not null,
  filename text,
  embedding vector(384) not null,
  created_at timestamptz not null default now()
);

-- Approximate nearest-neighbor index for cosine similarity search.
create index if not exists documents_embedding_idx
  on documents
  using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

-- RPC used by services/vectorSearch.js to find the top-k most similar chunks.
create or replace function match_documents(
  query_embedding vector(384),
  match_count int default 3
)
returns table (
  id bigint,
  content text,
  filename text,
  similarity float
)
language sql stable
as $$
  select
    id,
    content,
    filename,
    1 - (embedding <=> query_embedding) as similarity
  from documents
  order by embedding <=> query_embedding
  limit match_count;
$$;
