export function GET() {
  // 同步跳转只展示状态，入账以已验签的异步通知为准。
  return new Response(null, {
    status: 303,
    headers: { Location: "/profile?payment=returned", "Cache-Control": "no-store" },
  });
}
