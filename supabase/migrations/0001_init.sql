-- RiceGuard — skema awal (PRD bagian 9).
-- Aman dijalankan ulang: semua objek memakai IF NOT EXISTS atau guard duplicate_object.

do $$ begin
  create type version_status as enum ('draft', 'published', 'archived');
exception when duplicate_object then null; end $$;

do $$ begin
  create type province_status as enum ('surplus', 'balanced', 'defisit');
exception when duplicate_object then null; end $$;

-- Data referensi provinsi: tidak berubah per tahun.
create table if not exists provinces (
  kode_bps        text primary key,
  kode_kemendagri text not null unique,
  nama            text not null,
  pulau           text not null,
  lat             numeric(8,4) not null,
  lng             numeric(8,4) not null,
  luas_km2        numeric(12,2)
);

-- Satu tahun boleh punya banyak versi, tapi hanya satu yang published.
create table if not exists dataset_versions (
  id            uuid primary key default gen_random_uuid(),
  tahun         int not null,
  version_no    int not null,
  status        version_status not null default 'draft',
  notes         text,
  validation    jsonb,
  summary       jsonb,
  source_files  jsonb,
  created_by    uuid,
  created_at    timestamptz not null default now(),
  published_by  uuid,
  published_at  timestamptz,
  unique (tahun, version_no)
);

create unique index if not exists dataset_versions_one_published
  on dataset_versions (tahun) where status = 'published';

-- Angka per provinsi untuk satu versi.
create table if not exists province_stats (
  version_id               uuid not null references dataset_versions (id) on delete cascade,
  kode_bps                 text not null references provinces (kode_bps),
  penduduk_jiwa            bigint not null,
  konsumsi_kg_kapita_tahun numeric(6,2) not null,
  produksi_padi_ton_gkg    numeric(14,2) not null,
  produksi_beras_ton       numeric(14,2) not null,
  kebutuhan_beras_ton      numeric(14,2) not null,
  rice_balance_ton         numeric(14,2) not null,
  rasio_swasembada         numeric(8,4) not null,
  status                   province_status not null,
  is_edited                boolean not null default false,
  primary key (version_id, kode_bps),
  check (penduduk_jiwa > 0),
  check (konsumsi_kg_kapita_tahun > 0),
  check (produksi_padi_ton_gkg >= 0),
  check (produksi_beras_ton >= 0)
);

create index if not exists province_stats_status_idx on province_stats (version_id, status);

-- Riwayat edit manual per provinsi (insert-only).
create table if not exists province_stat_edits (
  id         bigint generated always as identity primary key,
  version_id uuid not null references dataset_versions (id) on delete cascade,
  kode_bps   text not null references provinces (kode_bps),
  field      text not null,
  old_value  numeric,
  new_value  numeric,
  reason     text not null,
  edited_by  uuid,
  edited_at  timestamptz not null default now()
);

-- Rekomendasi resmi per versi.
create table if not exists distribution_recommendations (
  id          bigint generated always as identity primary key,
  version_id  uuid not null references dataset_versions (id) on delete cascade,
  urutan      int not null,
  dari_kode   text not null references provinces (kode_bps),
  ke_kode     text not null references provinces (kode_bps),
  ton         numeric(14,2) not null,
  jarak_km    numeric(8,1) not null,
  explanation text,
  unique (version_id, urutan),
  check (ton > 0)
);

create index if not exists distribution_recommendations_version_idx
  on distribution_recommendations (version_id, urutan);

create table if not exists data_sources (
  id           bigint generated always as identity primary key,
  key          text not null unique,
  nama         text not null,
  instansi     text not null,
  tabel_resmi  text,
  tahun        int,
  diperbarui   date,
  url          text
);

create table if not exists site_content (
  key        text primary key,
  title      text not null,
  body_md    text not null default '',
  updated_by uuid,
  updated_at timestamptz not null default now()
);

-- Admin dibuat manual di dashboard Supabase lalu didaftarkan di sini.
create table if not exists admins (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  nama       text not null,
  created_at timestamptz not null default now()
);

create table if not exists audit_log (
  id         bigint generated always as identity primary key,
  actor      uuid,
  action     text not null,
  entity     text,
  entity_id  text,
  detail     jsonb,
  created_at timestamptz not null default now()
);

create index if not exists audit_log_created_idx on audit_log (created_at desc);
create index if not exists audit_log_action_idx on audit_log (action);

-- RLS aktif tanpa policy: akses lewat anon/authenticated ditolak.
-- Backend memakai connection string Postgres (bypass RLS) atau service role.
do $$
declare t text;
begin
  for t in
    select tablename from pg_tables where schemaname = 'public'
  loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;
