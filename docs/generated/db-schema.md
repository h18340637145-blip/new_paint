# 数据库结构索引

<!-- 此文件由仓库迁移生成。修改迁移后重新生成。 -->

索引列出仓库迁移中声明的对象。字段、外键、权限和变更顺序请查对应 SQL。确认部署环境时，单独核对目标 Supabase 项目的迁移历史和实际结构。

在仓库根目录重新生成。

```bash
node scripts/generate-db-schema-doc.mjs > docs/generated/db-schema.md
```

## 业务表

| 表 | 迁移声明启用 RLS | 定义迁移 |
| --- | --- | --- |
| `studio_members` | 是 | [20261116000000_create_canvas_studio.sql](../../supabase/migrations/20261116000000_create_canvas_studio.sql) |
| `studio_projects` | 是 | [20261116000000_create_canvas_studio.sql](../../supabase/migrations/20261116000000_create_canvas_studio.sql) |
| `studio_assets` | 是 | [20261116000000_create_canvas_studio.sql](../../supabase/migrations/20261116000000_create_canvas_studio.sql) |
| `studio_submissions` | 是 | [20261116000000_create_canvas_studio.sql](../../supabase/migrations/20261116000000_create_canvas_studio.sql) |
| `studio_jobs` | 是 | [20261116000000_create_canvas_studio.sql](../../supabase/migrations/20261116000000_create_canvas_studio.sql) |
| `studio_canvas_nodes` | 是 | [20261116095833_add_studio_agent.sql](../../supabase/migrations/20261116095833_add_studio_agent.sql) |
| `studio_agent_turns` | 是 | [20261116095833_add_studio_agent.sql](../../supabase/migrations/20261116095833_add_studio_agent.sql) |
| `studio_skills` | 是 | [20261117104823_add_studio_skills.sql](../../supabase/migrations/20261117104823_add_studio_skills.sql) |
| `zpay_transactions` | 是 | [20261117153004_create_zpay_transactions.sql](../../supabase/migrations/20261117153004_create_zpay_transactions.sql) |
| `billing_image_usage` | 是 | [20261117153227_enforce_billing_image_quota.sql](../../supabase/migrations/20261117153227_enforce_billing_image_quota.sql) |
| `studio_article_text_nodes` | 是 | [20261118223000_add_canvas_article_workflow.sql](../../supabase/migrations/20261118223000_add_canvas_article_workflow.sql) |
| `studio_article_edges` | 是 | [20261118223000_add_canvas_article_workflow.sql](../../supabase/migrations/20261118223000_add_canvas_article_workflow.sql) |
| `studio_article_snapshots` | 是 | [20261118223000_add_canvas_article_workflow.sql](../../supabase/migrations/20261118223000_add_canvas_article_workflow.sql) |
| `studio_article_tasks` | 是 | [20261118223000_add_canvas_article_workflow.sql](../../supabase/migrations/20261118223000_add_canvas_article_workflow.sql) |
| `studio_article_drafts` | 是 | [20261118223000_add_canvas_article_workflow.sql](../../supabase/migrations/20261118223000_add_canvas_article_workflow.sql) |
| `studio_published_images` | 是 | [20261118223000_add_canvas_article_workflow.sql](../../supabase/migrations/20261118223000_add_canvas_article_workflow.sql) |
| `typography_teams` | 是 | [20261119213000_add_typography_libraries_and_teams.sql](../../supabase/migrations/20261119213000_add_typography_libraries_and_teams.sql) |
| `typography_team_members` | 是 | [20261119213000_add_typography_libraries_and_teams.sql](../../supabase/migrations/20261119213000_add_typography_libraries_and_teams.sql) |
| `typography_team_invites` | 是 | [20261119213000_add_typography_libraries_and_teams.sql](../../supabase/migrations/20261119213000_add_typography_libraries_and_teams.sql) |
| `typography_library_media` | 是 | [20261119213000_add_typography_libraries_and_teams.sql](../../supabase/migrations/20261119213000_add_typography_libraries_and_teams.sql) |
| `typography_library_items` | 是 | [20261119213000_add_typography_libraries_and_teams.sql](../../supabase/migrations/20261119213000_add_typography_libraries_and_teams.sql) |

## 数据库函数

| 函数 | 定义迁移 |
| --- | --- |
| `settle_zpay_transaction` | [20261117153004_create_zpay_transactions.sql](../../supabase/migrations/20261117153004_create_zpay_transactions.sql) |
| `read_billing_usage` | [20261117153227_enforce_billing_image_quota.sql](../../supabase/migrations/20261117153227_enforce_billing_image_quota.sql) |
| `charge_studio_image_quota` | [20261117153227_enforce_billing_image_quota.sql](../../supabase/migrations/20261117153227_enforce_billing_image_quota.sql) |
| `configure_zpay_edge` | [20261117154734_configure_zpay_edge.sql](../../supabase/migrations/20261117154734_configure_zpay_edge.sql) |
| `read_zpay_edge_config` | [20261117154734_configure_zpay_edge.sql](../../supabase/migrations/20261117154734_configure_zpay_edge.sql) |
| `prevent_article_snapshot_mutation` | [20261118223000_add_canvas_article_workflow.sql](../../supabase/migrations/20261118223000_add_canvas_article_workflow.sql) |
| `is_typography_team_member` | [20261119213000_add_typography_libraries_and_teams.sql](../../supabase/migrations/20261119213000_add_typography_libraries_and_teams.sql) |

## 存储桶

| 存储桶 | 访问方式 | 定义迁移 |
| --- | --- | --- |
| `project-images` | 私有 | [20261116000000_create_canvas_studio.sql](../../supabase/migrations/20261116000000_create_canvas_studio.sql) |
| `published-article-images` | 公开读取 | [20261118223000_add_canvas_article_workflow.sql](../../supabase/migrations/20261118223000_add_canvas_article_workflow.sql) |
