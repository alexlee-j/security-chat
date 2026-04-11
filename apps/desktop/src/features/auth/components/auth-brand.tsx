/**
 * 品牌区组件 - 左侧渐变背景 + 装饰椭圆
 * 设计稿：2026-04-07-auth-pages-design.md
 */
export function AuthBrand(): JSX.Element {
  return (
    <aside className="relative w-[540px] h-full overflow-hidden">
      {/* 渐变覆盖层 */}
      <div className="auth-brand-gradient-overlay absolute inset-0 z-10" />

      {/* 装饰椭圆 */}
      <div className="auth-brand-ellipse-1 absolute -top-20 -left-16 w-[280px] h-[280px] rounded-full z-20" />
      <div className="auth-brand-ellipse-2 absolute top-[340px] left-[280px] w-[220px] h-[220px] rounded-full z-20" />
      <div className="auth-brand-ellipse-3 absolute -top-5 left-[380px] w-[160px] h-[160px] rounded-full z-20" />

      {/* 品牌内容 */}
      <div className="absolute inset-0 z-30 flex flex-col items-center justify-center text-white">
        <h1 className="text-[32px] font-bold mb-4">Security Chat</h1>
        <p className="text-[19px] font-bold">安全至上，畅聊无忧</p>
      </div>
    </aside>
  );
}
