-- 保留原普通生图记录，Agent 任务单独保存按顺序排列的参考图资产编号。
alter table public.studio_submissions
  drop constraint studio_submissions_model_check,
  add constraint studio_submissions_model_check
    check (model in ('nano-banana-2', 'gpt-image-2', 'gpt-image-2-5-flare')),
  add column ordered_reference_ids uuid[],
  add constraint studio_agent_reference_order_check
    check (ordered_reference_ids is null or
      (model = 'gpt-image-2-5-flare' and reference_id is null));

alter table public.studio_assets
  drop constraint studio_assets_kind_check,
  add constraint studio_assets_kind_check
    check (kind in ('reference', 'generated', 'markdown')),
  add column filename text;

-- 画布节点与素材分开保存，允许同一素材放置多次或移除而保留原文件。
create table public.studio_canvas_nodes (
  id uuid primary key,
  project_id uuid not null references public.studio_projects(id) on delete cascade,
  asset_id uuid not null,
  position_x double precision not null,
  position_y double precision not null,
  width double precision check (width between 24 and 4096),
  created_at timestamptz not null default now(),
  foreign key (project_id, asset_id) references public.studio_assets(project_id, id)
);
create index studio_canvas_nodes_project_idx on public.studio_canvas_nodes (project_id);

-- 生成任务需要保留记录，删除生成图节点时只隐藏对应位置。
alter table public.studio_jobs
  add column canvas_hidden boolean not null default false,
  add column canvas_width double precision check (canvas_width between 24 and 4096);

create table public.studio_agent_turns (
  id uuid primary key,
  project_id uuid not null references public.studio_projects(id) on delete cascade,
  prompt text not null check (char_length(prompt) <= 20000),
  attachment_ids uuid[] not null default '{}',
  events jsonb not null default '[]' check (jsonb_typeof(events) = 'array'),
  status text not null default 'running' check (status in ('running', 'complete', 'failed')),
  created_at timestamptz not null default now()
);
create index studio_agent_turns_project_idx on public.studio_agent_turns (project_id, created_at);

alter table public.studio_canvas_nodes enable row level security;
alter table public.studio_agent_turns enable row level security;

revoke all on public.studio_canvas_nodes, public.studio_agent_turns from anon, authenticated;
grant select on public.studio_canvas_nodes, public.studio_agent_turns to authenticated;
grant select, insert, update, delete on public.studio_canvas_nodes, public.studio_agent_turns to service_role;

create policy studio_canvas_nodes_read on public.studio_canvas_nodes for select to authenticated
  using (exists (select 1 from public.studio_projects p
    where p.id = studio_canvas_nodes.project_id and p.owner_id = (select auth.uid())));
create policy studio_agent_turns_read on public.studio_agent_turns for select to authenticated
  using (exists (select 1 from public.studio_projects p
    where p.id = studio_agent_turns.project_id and p.owner_id = (select auth.uid())));

-- 继续使用现有私有桶，增加 Markdown 对象的 MIME 类型。
update storage.buckets
set allowed_mime_types = array_append(allowed_mime_types, 'text/markdown')
where id = 'project-images' and not public and not ('text/markdown' = any(allowed_mime_types));
