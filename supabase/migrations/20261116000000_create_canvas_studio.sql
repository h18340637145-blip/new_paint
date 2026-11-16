-- 工作台独立数据表，避免与项目中的现有生图及支付表冲突。
create table public.studio_members (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.studio_projects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  title text not null default '未命名项目' check (char_length(title) between 1 and 120),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index studio_projects_owner_updated_idx
  on public.studio_projects (owner_id, updated_at desc, id desc);

create table public.studio_assets (
  id uuid primary key,
  project_id uuid not null references public.studio_projects(id) on delete cascade,
  path text not null unique,
  kind text not null check (kind in ('reference', 'generated')),
  created_at timestamptz not null default now(),
  unique (project_id, id)
);

create index studio_assets_project_created_idx on public.studio_assets (project_id, created_at);

create table public.studio_submissions (
  id uuid primary key,
  project_id uuid not null references public.studio_projects(id) on delete cascade,
  prompt text not null check (char_length(prompt) between 1 and 20000),
  model text not null check (model in ('nano-banana-2', 'gpt-image-2')),
  aspect_ratio text not null,
  resolution text not null check (resolution in ('1K', '2K', '4K')),
  image_count smallint not null check (image_count between 1 and 5),
  reference_id uuid,
  created_at timestamptz not null default now(),
  unique (project_id, id),
  foreign key (project_id, reference_id) references public.studio_assets(project_id, id),
  check (model = 'gpt-image-2' or image_count = 1)
);

create index studio_submissions_project_created_idx
  on public.studio_submissions (project_id, created_at);

create table public.studio_jobs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null,
  submission_id uuid not null,
  slot smallint not null check (slot between 0 and 4),
  attempt integer not null default 1 check (attempt > 0),
  status text not null default 'pending'
    check (status in ('pending', 'starting', 'generating', 'importing', 'succeeded', 'failed', 'unknown')),
  provider_id text unique,
  asset_id uuid,
  error_message text,
  position_x double precision not null default 0,
  position_y double precision not null default 0,
  checked_at timestamptz,
  created_at timestamptz not null default now(),
  unique (submission_id, slot, attempt),
  foreign key (project_id, submission_id) references public.studio_submissions(project_id, id) on delete cascade,
  foreign key (project_id, asset_id) references public.studio_assets(project_id, id)
);

create index studio_jobs_project_idx on public.studio_jobs (project_id);

alter table public.studio_members enable row level security;
alter table public.studio_projects enable row level security;
alter table public.studio_assets enable row level security;
alter table public.studio_submissions enable row level security;
alter table public.studio_jobs enable row level security;

-- 客户端只查询自己的数据。可信任务和资产记录仅由应用服务端写入。
revoke all on public.studio_members, public.studio_projects, public.studio_assets,
  public.studio_submissions, public.studio_jobs from anon, authenticated;
grant select on public.studio_members, public.studio_projects, public.studio_assets,
  public.studio_submissions, public.studio_jobs to authenticated;
grant select, insert, update, delete on public.studio_members, public.studio_projects,
  public.studio_assets, public.studio_submissions, public.studio_jobs to service_role;

create policy studio_members_read on public.studio_members for select to authenticated
  using (user_id = (select auth.uid()));
create policy studio_projects_read on public.studio_projects for select to authenticated
  using (owner_id = (select auth.uid()) and exists (
    select 1 from public.studio_members m where m.user_id = owner_id
  ));
create policy studio_assets_read on public.studio_assets for select to authenticated
  using (exists (select 1 from public.studio_projects p
    where p.id = studio_assets.project_id and p.owner_id = (select auth.uid())));
create policy studio_submissions_read on public.studio_submissions for select to authenticated
  using (exists (select 1 from public.studio_projects p
    where p.id = studio_submissions.project_id and p.owner_id = (select auth.uid())));
create policy studio_jobs_read on public.studio_jobs for select to authenticated
  using (exists (select 1 from public.studio_projects p
    where p.id = studio_jobs.project_id and p.owner_id = (select auth.uid())));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('project-images', 'project-images', false, 52428800, array['image/jpeg', 'image/png', 'image/webp']);

-- 通过对象记录和项目归属限制读取，签名 URL 仅由已授权的应用流程签发。
create policy studio_project_images_read on storage.objects for select to authenticated
  using (bucket_id = 'project-images' and exists (
    select 1 from public.studio_assets a
    join public.studio_projects p on p.id = a.project_id
    where a.path = storage.objects.name and p.owner_id = (select auth.uid())
  ));
