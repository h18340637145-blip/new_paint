# ZPAY 订阅接入

## 运行配置

- `NEXT_PUBLIC_BASE_URL` 填写 ZPAY 可以通过公网访问的 HTTPS 站点根地址。
- `ZPAY_PID`、`ZPAY_KEY` 配置为 ZPAY 商户凭据。密钥只在服务端使用。
- Supabase 浏览器端支持 `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` 或 `NEXT_PUBLIC_SUPABASE_ANON_KEY`，服务端使用 `SUPABASE_SECRET_KEY` 或 `SUPABASE_SERVICE_ROLE_KEY`。
- Supabase 迁移位于 `supabase/migrations/`。迁移兼容已有的 `zpay_transactions` 表。

## 支付流程

1. 登录后向 `POST /api/checkout/providers/zpay/url` 发送 `{"planId":"monthly","method":"alipay"}`，也可使用 `wxpay`。金额由服务端依据套餐确定，未登录时返回 401。
2. 响应提供签名后的 `url`，个人中心使用 `action` 和 `fields` 以 POST 表单进入 ZPAY 收银台。
3. ZPAY 向 `GET /api/checkout/providers/zpay/webhook` 发起异步通知。服务端验证商户、签名、订单号、支付方式和实付金额。同一订单的重复通知返回纯文本 `success`，只入账一次。
4. 浏览器通过 `/checkout/return` 返回个人中心。该路由只跳转，页面从已入账的订单读取状态。
5. 续订按北京时间的日历月顺延。每月生图额度在北京时间自然月开始时重置，免费为 3 张，Pro 为 50 张，升级当月沿用已使用数量。
