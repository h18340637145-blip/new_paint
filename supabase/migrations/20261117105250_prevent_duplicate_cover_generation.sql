-- 同一篇文章的风格确认只启动一次，避免并发请求重复扣费。
create unique index studio_agent_turns_cover_source_unique
  on public.studio_agent_turns (project_id, (cover_workflow ->> 'sourceId'))
  where cover_workflow ? 'sourceId';
