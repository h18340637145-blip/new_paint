-- 支持画布与工作台使用字节跳动 Seedream 5.5 模型及 1.5K 分辨率档位。
alter table public.studio_submissions
  drop constraint if exists studio_submissions_model_check,
  add constraint studio_submissions_model_check
    check (model in ('nano-banana-2', 'gpt-image-2', 'gpt-image-2-5-flare', 'seedream-5-5'));

alter table public.studio_submissions
  drop constraint if exists studio_submissions_resolution_check,
  add constraint studio_submissions_resolution_check
    check (resolution in ('1K', '1.5K', '2K', '4K'));
