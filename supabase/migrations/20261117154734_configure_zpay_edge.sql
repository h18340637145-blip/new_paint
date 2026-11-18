-- 支付配置写入 Vault，迁移文件不包含实际商户密钥。
create function public.configure_zpay_edge(p_config text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  config_id uuid;
begin
  perform pg_catalog.pg_advisory_xact_lock(186420711);
  select id into config_id from vault.secrets where name = 'new_paint_zpay_edge';
  if config_id is null then
    perform vault.create_secret(p_config, 'new_paint_zpay_edge', '创作工作台 ZPAY 支付配置');
  else
    perform vault.update_secret(config_id, p_config);
  end if;
end;
$$;

create function public.read_zpay_edge_config()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select decrypted_secret::jsonb from vault.decrypted_secrets where name = 'new_paint_zpay_edge';
$$;

revoke all on function public.configure_zpay_edge(text) from public, anon, authenticated;
revoke all on function public.read_zpay_edge_config() from public, anon, authenticated;
grant execute on function public.configure_zpay_edge(text) to service_role;
grant execute on function public.read_zpay_edge_config() to service_role;
