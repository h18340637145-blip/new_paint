-- 画布生成公众号文章全流程持久化：文本节点、有向连线、不可变暂存版本、Qwen 排版任务、独立排版稿（乐观锁）与公开图片副本映射。

create table if not exists public.studio_article_text_nodes (
  id uuid primary key,
  project_id uuid not null references public.studio_projects(id) on delete cascade,
  content text not null default '' check (char_length(content) <= 20000),
  role text not null default 'material' check (role in ('material', 'requirement', 'verbatim')),
  position_x double precision not null default 120,
  position_y double precision not null default 120,
  width double precision not null default 280 check (width between 180 and 1200),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists studio_article_text_nodes_project_idx
  on public.studio_article_text_nodes (project_id, created_at);

create table if not exists public.studio_article_edges (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.studio_projects(id) on delete cascade,
  source_node_id uuid not null,
  target_node_id uuid not null,
  created_at timestamptz not null default now(),
  check (source_node_id <> target_node_id),
  unique (project_id, source_node_id, target_node_id)
);

create index if not exists studio_article_edges_project_idx
  on public.studio_article_edges (project_id, created_at);

create table if not exists public.studio_article_snapshots (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.studio_projects(id) on delete cascade,
  version_number integer not null check (version_number > 0),
  title text not null default '未命名暂存' check (char_length(title) between 1 and 160),
  nodes jsonb not null check (jsonb_typeof(nodes) = 'array' and jsonb_array_length(nodes) >= 1),
  excluded_nodes jsonb not null default '[]' check (jsonb_typeof(excluded_nodes) = 'array'),
  created_at timestamptz not null default now(),
  unique (project_id, version_number),
  unique (project_id, id)
);

create index if not exists studio_article_snapshots_project_idx
  on public.studio_article_snapshots (project_id, version_number desc);

create or replace function public.prevent_article_snapshot_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'studio_article_snapshots is immutable';
end;
$$;

drop trigger if exists studio_article_snapshots_immutable on public.studio_article_snapshots;
create trigger studio_article_snapshots_immutable
  before update on public.studio_article_snapshots
  for each row execute function public.prevent_article_snapshot_mutation();

create table if not exists public.studio_article_tasks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.studio_projects(id) on delete cascade,
  snapshot_id uuid not null,
  sub_template_id text not null check (char_length(sub_template_id) between 1 and 80),
  template_style jsonb not null check (jsonb_typeof(template_style) = 'object'),
  status text not null default 'running' check (status in ('running', 'succeeded', 'failed')),
  draft_id uuid,
  error_message text,
  warnings jsonb not null default '[]' check (jsonb_typeof(warnings) = 'array'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (project_id, snapshot_id) references public.studio_article_snapshots(project_id, id) on delete cascade
);

create index if not exists studio_article_tasks_project_idx
  on public.studio_article_tasks (project_id, created_at desc);

create table if not exists public.studio_article_drafts (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.studio_projects(id) on delete cascade,
  snapshot_id uuid not null,
  task_id uuid references public.studio_article_tasks(id) on delete set null,
  title text not null default '未命名排版稿' check (char_length(title) between 1 and 200),
  sub_template_id text not null check (char_length(sub_template_id) between 1 and 80),
  template_style jsonb not null check (jsonb_typeof(template_style) = 'object'),
  document_style jsonb not null default '{}' check (jsonb_typeof(document_style) = 'object'),
  blocks jsonb not null check (jsonb_typeof(blocks) = 'array'),
  warnings jsonb not null default '[]' check (jsonb_typeof(warnings) = 'array'),
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (project_id, snapshot_id) references public.studio_article_snapshots(project_id, id) on delete cascade
);

create index if not exists studio_article_drafts_project_idx
  on public.studio_article_drafts (project_id, updated_at desc);

-- 发布图片副本与画布原件独立保留，日常整理画布不影响已发布文章。
create table if not exists public.studio_published_images (
  asset_id uuid primary key,
  owner_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid not null,
  public_path text not null unique,
  public_url text not null,
  mime_type text not null check (mime_type in ('image/jpeg', 'image/png', 'image/webp')),
  created_at timestamptz not null default now()
);

create index if not exists studio_published_images_owner_idx
  on public.studio_published_images (owner_id, created_at desc);

alter table public.studio_article_text_nodes enable row level security;
alter table public.studio_article_edges enable row level security;
alter table public.studio_article_snapshots enable row level security;
alter table public.studio_article_tasks enable row level security;
alter table public.studio_article_drafts enable row level security;
alter table public.studio_published_images enable row level security;

revoke all on public.studio_article_text_nodes, public.studio_article_edges,
  public.studio_article_snapshots, public.studio_article_tasks,
  public.studio_article_drafts, public.studio_published_images from anon, authenticated;

grant select on public.studio_article_text_nodes, public.studio_article_edges,
  public.studio_article_snapshots, public.studio_article_tasks,
  public.studio_article_drafts, public.studio_published_images to authenticated;

grant select, insert, update, delete on public.studio_article_text_nodes,
  public.studio_article_edges, public.studio_article_tasks,
  public.studio_article_drafts, public.studio_published_images to service_role;

grant select, insert, delete on public.studio_article_snapshots to service_role;

create policy studio_article_text_nodes_read on public.studio_article_text_nodes for select to authenticated
  using (exists (select 1 from public.studio_projects p
    where p.id = studio_article_text_nodes.project_id and p.owner_id = (select auth.uid())));

create policy studio_article_edges_read on public.studio_article_edges for select to authenticated
  using (exists (select 1 from public.studio_projects p
    where p.id = studio_article_edges.project_id and p.owner_id = (select auth.uid())));

create policy studio_article_snapshots_read on public.studio_article_snapshots for select to authenticated
  using (exists (select 1 from public.studio_projects p
    where p.id = studio_article_snapshots.project_id and p.owner_id = (select auth.uid())));

create policy studio_article_tasks_read on public.studio_article_tasks for select to authenticated
  using (exists (select 1 from public.studio_projects p
    where p.id = studio_article_tasks.project_id and p.owner_id = (select auth.uid())));

create policy studio_article_drafts_read on public.studio_article_drafts for select to authenticated
  using (exists (select 1 from public.studio_projects p
    where p.id = studio_article_drafts.project_id and p.owner_id = (select auth.uid())));

create policy studio_published_images_read on public.studio_published_images for select to authenticated
  using (owner_id = (select auth.uid()));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('published-article-images', 'published-article-images', true, 20971520, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

drop policy if exists studio_published_article_images_public_read on storage.objects;
create policy studio_published_article_images_public_read on storage.objects for select to anon, authenticated
  using (bucket_id = 'published-article-images');
