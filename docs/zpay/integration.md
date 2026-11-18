# ZPAY 订阅接入

## 运行配置

- `NEXT_PUBLIC_BASE_URL` 填写 ZPAY 可以通过公网访问的 HTTPS 站点根地址。
- `ZPAY_PID`、`ZPAY_KEY` 配置为 ZPAY 商户凭据。密钥只在服务端使用。
- Supabase 浏览器端支持 `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` 或 `NEXT_PUBLIC_SUPABASE_ANON_KEY`，服务端使用 `SUPABASE_SECRET_KEY` 或 `SUPABASE_SERVICE_ROLE_KEY`。
- Supabase 迁移位于 `supabase/migrations/`。迁移兼容已有的 `zpay_transactions` 表。

## 支付流程

1. 登录后向 `POST /api/checkout/providers/zpay/url` 发送 `{"planId":"monthly","method":"alipay"}`，也可使用 `wxpay`。金额由服务端依据套餐确定，未登录时返回 401。
2. 响应提供签名后的 `url`，个人中心使用 `action` 和 `fields` 以 POST 表单进入 ZPAY 收银台。
3. Supabase 部署模式下，ZPAY 向 `GET /functions/v1/zpay-webhook` 发起异步通知。项目原有的 `GET /api/checkout/providers/zpay/webhook` 仍可处理从本地后端创建的订单。服务端验证商户、签名、订单号、支付方式和实付金额。同一订单的重复通知返回纯文本 `success`，只入账一次。
4. 浏览器通过 `/checkout/return` 返回个人中心。该路由只跳转，页面从已入账的订单读取状态。
5. 续订按北京时间的日历月顺延。每月生图额度在北京时间自然月开始时重置，免费为 3 张，Pro 为 50 张，升级当月沿用已使用数量。

## Supabase 部署

- `zpay-checkout` 使用当前 Supabase 用户的访问令牌验证登录，再创建订单。个人中心通过原有购买接口转发请求。
- `zpay-webhook` 使用商户签名验证 ZPAY 的通知，随后调用现有数据库事务完成入账。其公网地址由 Supabase 提供。
- 应用 `configure_zpay_edge` 迁移并部署这两个 Edge Function 后，运行 `node --env-file=.env.local scripts/configure-zpay-edge.mjs`。脚本仅将商户号、签名密钥、付款返回所需的 HTTPS 根地址写入 Supabase Vault。
- Next.js 项目设置 `ZPAY_BACKEND=supabase` 后，购买接口使用云端下单。修改商户配置或站点地址时，重新运行同一导入脚本。
- `NEXT_PUBLIC_BASE_URL` 对应运行 Next.js 个人中心的公网 HTTPS 站点。付款返回使用这个地址，异步通知使用 Supabase 项目地址。
