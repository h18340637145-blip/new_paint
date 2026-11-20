-- 公众号个人库与团队库：团队、成员角色、站内邀请、私有媒体文件与版本化模板/素材记录（增量迁移，不影响既有业务表）。

create table if not exists public.typography_teams (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 80),
  owner_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists typography_teams_owner_idx
  on public.typography_teams (owner_id, created_at desc);

create table if not exists public.typography_team_members (
  team_id uuid not null references public.typography_teams(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  email text not null check (char_length(email) between 3 and 254),
  role text not null check (role in ('owner', 'editor', 'member')),
  joined_at timestamptz not null default now(),
  primary key (team_id, user_id)
);

create index if not exists typography_team_members_user_idx
  on public.typography_team_members (user_id, joined_at desc);

create table if not exists public.typography_team_invites (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.typography_teams(id) on delete cascade,
  invited_email text not null check (char_length(invited_email) between 3 and 254),
  invited_user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('editor', 'member')),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined', 'revoked')),
  invited_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  responded_at timestamptz
);

create index if not exists typography_team_invites_user_status_idx
  on public.typography_team_invites (invited_user_id, status, created_at desc);

create index if not exists typography_team_invites_team_status_idx
  on public.typography_team_invites (team_id, status, created_at desc);

create table if not exists public.typography_library_media (
  id uuid primary key default gen_random_uuid(),
  scope_type text not null check (scope_type in ('personal', 'team')),
  owner_id uuid references auth.users(id) on delete cascade,
  team_id uuid references public.typography_teams(id) on delete cascade,
  storage_path text not null unique,
  mime_type text not null check (mime_type in ('image/jpeg', 'image/png', 'image/webp')),
  filename text,
  size_bytes integer not null check (size_bytes > 0 and size_bytes <= 10485760),
  uploaded_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  check (
    (scope_type = 'personal' and owner_id is not null and team_id is null)
    or (scope_type = 'team' and team_id is not null)
  )
);

create index if not exists typography_library_media_owner_idx
  on public.typography_library_media (owner_id, created_at desc);

create index if not exists typography_library_media_team_idx
  on public.typography_library_media (team_id, created_at desc);

create table if not exists public.typography_library_items (
  id uuid primary key default gen_random_uuid(),
  scope_type text not null check (scope_type in ('personal', 'team')),
  owner_id uuid references auth.users(id) on delete cascade,
  team_id uuid references public.typography_teams(id) on delete cascade,
  kind text not null check (kind in ('template', 'asset')),
  category text not null check (category in ('template', 'card', 'divider', 'image-border', 'heading-border')),
  name text not null check (char_length(name) between 1 and 120),
  description text not null default '' check (char_length(description) <= 500),
  template_style jsonb check (template_style is null or jsonb_typeof(template_style) = 'object'),
  sample_markdown text check (sample_markdown is null or char_length(sample_markdown) <= 50000),
  root_node jsonb check (root_node is null or jsonb_typeof(root_node) = 'object'),
  media_ids uuid[] not null default '{}',
  archived boolean not null default false,
  version integer not null default 1 check (version > 0),
  created_by uuid not null references auth.users(id) on delete cascade,
  updated_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (scope_type = 'personal' and owner_id is not null and team_id is null)
    or (scope_type = 'team' and team_id is not null)
  ),
  check (
    (kind = 'template' and category = 'template' and template_style is not null)
    or (kind = 'asset' and category in ('card', 'divider', 'image-border', 'heading-border') and root_node is not null)
  )
);

create index if not exists typography_library_items_personal_idx
  on public.typography_library_items (owner_id, archived, updated_at desc)
  where scope_type = 'personal';

create index if not exists typography_library_items_team_idx
  on public.typography_library_items (team_id, archived, updated_at desc)
  where scope_type = 'team';

create or replace function public.is_typography_team_member(p_team uuid, p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.typography_team_members m
    where m.team_id = p_team and m.user_id = p_user
  );
$$;

revoke all on function public.is_typography_team_member(uuid, uuid) from public, anon;
grant execute on function public.is_typography_team_member(uuid, uuid) to authenticated, service_role;

alter table public.typography_teams enable row level security;
alter table public.typography_team_members enable row level security;
alter table public.typography_team_invites enable row level security;
alter table public.typography_library_media enable row level security;
alter table public.typography_library_items enable row level security;

revoke all on
  public.typography_teams,
  public.typography_team_members,
  public.typography_team_invites,
  public.typography_library_media,
  public.typography_library_items
from anon, authenticated;

grant select on
  public.typography_teams,
  public.typography_team_members,
  public.typography_team_invites,
  public.typography_library_media,
  public.typography_library_items
to authenticated;

grant select, insert, update, delete on
  public.typography_teams,
  public.typography_team_members,
  public.typography_team_invites,
  public.typography_library_media,
  public.typography_library_items
to service_role;

create policy typography_teams_read on public.typography_teams
  for select to authenticated
  using (
    owner_id = (select auth.uid())
    or public.is_typography_team_member(id, (select auth.uid()))
  );

create policy typography_team_members_read on public.typography_team_members
  for select to authenticated
  using (public.is_typography_team_member(team_id, (select auth.uid())));

create policy typography_team_invites_read on public.typography_team_invites
  for select to authenticated
  using (
    invited_user_id = (select auth.uid())
    or exists (
      select 1 from public.typography_teams t
      where t.id = typography_team_invites.team_id and t.owner_id = (select auth.uid())
    )
  );

create policy typography_library_media_read on public.typography_library_media
  for select to authenticated
  using (
    (scope_type = 'personal' and owner_id = (select auth.uid()))
    or (scope_type = 'team' and team_id is not null and public.is_typography_team_member(team_id, (select auth.uid())))
  );

create policy typography_library_items_read on public.typography_library_items
  for select to authenticated
  using (
    (scope_type = 'personal' and owner_id = (select auth.uid()))
    or (scope_type = 'team' and team_id is not null and public.is_typography_team_member(team_id, (select auth.uid())))
  );
