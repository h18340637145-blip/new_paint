-- 技能仅对拥有项目的上传者可见，已发送消息独立保留当时的技能名称。
create table public.studio_skills (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.studio_projects(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 64 and name ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  description text not null check (char_length(description) between 1 and 1024),
  body text not null check (char_length(body) > 0 and octet_length(body) <= 65536),
  created_at timestamptz not null default now(),
  unique (project_id, name)
);
alter table public.studio_skills enable row level security;
revoke all on public.studio_skills from anon, authenticated;
grant select on public.studio_skills to authenticated;
grant select, insert, delete on public.studio_skills to service_role;
create policy studio_skills_read on public.studio_skills for select to authenticated
  using (owner_id = (select auth.uid()) and exists (
    select 1 from public.studio_projects p
    where p.id = studio_skills.project_id and p.owner_id = (select auth.uid())
  ));

alter table public.studio_agent_turns
  add column skill_name text,
  add column cover_workflow jsonb;
