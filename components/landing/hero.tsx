import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Command, ImagePlus, MousePointer2 } from "lucide-react";

export function LandingHero({ isAuthenticated }: { isAuthenticated: boolean }) {
  return (
    <section className="landing-hero" data-enter>
      <div className="landing-wrap wrap">
        <div className="landing-hero-copy">
          <h1>在画布上生图，<br />把图文排成公众号文章。</h1>
          <p>把参考图放上画布，让 Agent 帮你出图，再用 Markdown 排版。免费版每月可生成 3 张图。</p>
          <div className="landing-actions">
            <Link className="landing-button landing-button-primary" href={isAuthenticated ? "/protected" : "/auth/sign-up"}>
              {isAuthenticated ? "进入工作台" : "免费开始创作"}<ArrowRight size={16} aria-hidden />
            </Link>
            <Link className="landing-button" href="/typography">试用公众号排版</Link>
          </div>
        </div>
        <div className="landing-frame app-frame" aria-label="画布与 Agent 界面示意">
          <div className="landing-frame-bar"><Command size={15} aria-hidden />公众号封面项目</div>
          <div className="landing-frame-body">
            <div className="landing-preview-board">
              <div className="landing-preview-image">
                <Image src="/images/cover-example.jpg" alt="画布中的雾林中的建筑封面示例" width={291} height={164} unoptimized priority />
              </div>
              <span aria-hidden className="landing-preview-cursor"><MousePointer2 size={19} fill="currentColor" /></span>
            </div>
            <div className="landing-preview-panel">
              <strong>Agent</strong>
              <p>给文章做一张雾林主题封面。</p>
              <span><ImagePlus size={14} aria-hidden /> 添加参考图</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
