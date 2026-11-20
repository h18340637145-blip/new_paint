"use client";

import { AlertCircle, Check, CheckCircle2, FileText, Image as ImageIcon, LoaderCircle, Sparkles } from "lucide-react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { AttachmentCard } from "./attachment-card";
import { ARTICLE_TEXT_ROLE_LABEL } from "@/lib/studio/article-graph";
import type { CreativePlanProposal, StudioAgentEvent, StudioAgentTurn } from "@/lib/studio/agent-events";
import { models } from "@/lib/studio/models";

const TOOL_LABELS: Record<string, string> = {
  list_assets: "查看项目素材库",
  view_image: "识别参考图画面细节",
  read_canvas: "读取画布现有图文结构",
  propose_creative_plan: "规划图文分镜方案",
  compose_canvas_flow: "在画布铺设图文并自动串联",
  upsert_text_node: "写入画布文案节点",
  connect_canvas_nodes: "按阅读顺序串联节点",
  generate_image: "提交配图生成任务",
  place_asset: "放置素材到画布",
};

function summarizeHumanStep(
  toolName: string,
  args: unknown,
  endEvent?: Extract<StudioAgentEvent, { type: "tool-end" }>,
): string {
  const base = TOOL_LABELS[toolName] ?? "执行画布协助操作";
  const obj = args && typeof args === "object" ? (args as Record<string, unknown>) : {};

  if (endEvent?.failed) {
    const errMsg =
      endEvent.result && typeof endEvent.result === "object" && "error" in (endEvent.result as Record<string, unknown>)
        ? String((endEvent.result as Record<string, unknown>).error)
        : "未能完成此步骤";
    return `${base}：${errMsg.slice(0, 60)}`;
  }

  if (toolName === "upsert_text_node" && typeof obj.content === "string" && obj.content.trim()) {
    const snippet = obj.content.trim().replace(/\s+/g, " ").slice(0, 18);
    return `写入文案「${snippet}${obj.content.trim().length > 18 ? "…" : ""}」`;
  }
  if (toolName === "generate_image" && typeof obj.prompt === "string" && obj.prompt.trim()) {
    const snippet = obj.prompt.trim().replace(/\s+/g, " ").slice(0, 18);
    return `生成配图「${snippet}${obj.prompt.trim().length > 18 ? "…" : ""}」`;
  }
  if (toolName === "compose_canvas_flow" && Array.isArray(obj.nodes)) {
    return `已在画布铺设 ${obj.nodes.length} 个图文节点并按顺序连线`;
  }
  return base;
}

function extractProposal(turn: StudioAgentTurn): CreativePlanProposal | null {
  const planStarts = new Set(
    turn.events
      .filter((ev) => ev.type === "tool-start" && ev.name === "propose_creative_plan")
      .map((ev) => (ev.type === "tool-start" ? ev.id : "")),
  );
  if (planStarts.size === 0) return null;

  for (let i = turn.events.length - 1; i >= 0; i -= 1) {
    const ev = turn.events[i];
    if (
      ev.type === "tool-end"
      && !ev.failed
      && planStarts.has(ev.id)
      && ev.result
      && typeof ev.result === "object"
      && "steps" in (ev.result as Record<string, unknown>)
    ) {
      return ev.result as CreativePlanProposal;
    }
  }
  return null;
}

export function AgentMessage({
  turn,
  canConfirmPlan = false,
  planExecuted = false,
  onConfirmPlan,
}: {
  turn: StudioAgentTurn;
  canConfirmPlan?: boolean;
  planExecuted?: boolean;
  onConfirmPlan?: (proposal: CreativePlanProposal) => void;
}) {
  const text = turn.events.map((entry) => (entry.type === "text" ? entry.text : "")).join("");
  const thinking = turn.events.map((entry) => (entry.type === "thinking" ? entry.text : "")).join("");
  const visibleTools = turn.events.filter(
    (entry): entry is Extract<StudioAgentEvent, { type: "tool-start" }> =>
      entry.type === "tool-start" && entry.name !== "propose_creative_plan",
  );
  const proposal = extractProposal(turn);

  return (
    <article className="space-y-3 text-sm">
      <div className="ml-auto w-fit max-w-[90%] rounded-2xl bg-[#eef3ef] px-3.5 py-2.5 text-neutral-900">
        {turn.skillName && (
          <span className="mb-1 inline-block rounded bg-white px-1.5 py-0.5 text-xs font-medium text-[#164b3e]">
            风格预设 · {turn.skillName}
          </span>
        )}
        <p className="whitespace-pre-wrap break-words leading-relaxed">{turn.prompt}</p>
        {turn.attachments.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {turn.attachments.map((asset) => (
              <AttachmentCard key={asset.id} asset={asset} />
            ))}
          </div>
        )}
      </div>

      {thinking && (
        <details className="rounded-xl border border-neutral-100 bg-neutral-50/80 px-3 py-1.5 text-xs text-neutral-500">
          <summary className="cursor-pointer font-medium text-neutral-600">构思脉络</summary>
          <p className="whitespace-pre-wrap break-words py-1.5 leading-relaxed">{thinking}</p>
        </details>
      )}

      {visibleTools.length > 0 && (
        <div className="space-y-1.5 rounded-xl border border-neutral-200/75 bg-neutral-50/70 px-3 py-2 text-xs">
          {visibleTools.map((tool) => {
            const endEvent = turn.events.find(
              (ev): ev is Extract<StudioAgentEvent, { type: "tool-end" }> =>
                ev.type === "tool-end" && ev.id === tool.id,
            );
            const summaryText = summarizeHumanStep(tool.name, tool.args, endEvent);
            return (
              <div key={tool.id} className="flex items-center gap-2 text-neutral-700">
                {!endEvent ? (
                  <LoaderCircle size={13} className="shrink-0 animate-spin text-[#164b3e]" aria-hidden="true" />
                ) : endEvent.failed ? (
                  <AlertCircle size={13} className="shrink-0 text-amber-600" aria-hidden="true" />
                ) : (
                  <CheckCircle2 size={13} className="shrink-0 text-emerald-700" aria-hidden="true" />
                )}
                <span className={endEvent?.failed ? "text-amber-900" : "text-neutral-700"}>
                  {summaryText}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {text && (
        <div className="break-words leading-relaxed text-neutral-800 [&_hr]:my-2 [&_li]:ml-5 [&_ol]:list-decimal [&_p]:my-1.5 [&_pre]:overflow-auto [&_pre]:rounded-lg [&_pre]:bg-neutral-100 [&_pre]:p-2 [&_table]:block [&_table]:overflow-auto [&_td]:border [&_td]:p-1 [&_th]:border [&_th]:p-1 [&_ul]:list-disc">
          <Markdown
            remarkPlugins={[remarkGfm]}
            skipHtml
            disallowedElements={["img"]}
            urlTransform={(url) => (/^https?:\/\//i.test(url) ? url : "")}
            components={{
              a: ({ children, href }) =>
                href ? (
                  <a href={href} target="_blank" rel="noreferrer" className="text-[#164b3e] underline">
                    {children}
                  </a>
                ) : (
                  <span>{children}</span>
                ),
            }}
          >
            {text}
          </Markdown>
        </div>
      )}

      {proposal && (
        <div className="overflow-hidden rounded-2xl border border-[#cde0d4] bg-[#f8faf8] shadow-xs">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#e2ece5] bg-white px-3.5 py-2.5">
            <div className="min-w-0">
              <span className="text-[11px] font-semibold text-[#164b3e]">图文分镜建议</span>
              <h4 className="truncate text-sm font-semibold text-neutral-950">{proposal.title}</h4>
            </div>
            <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] font-medium text-neutral-700">
              配图模型：{models[proposal.recommendedModel] ?? proposal.recommendedModel}
            </span>
          </div>

          <div className="space-y-2 p-3">
            {proposal.summary && (
              <p className="text-xs leading-relaxed text-neutral-600">{proposal.summary}</p>
            )}

            <div className="space-y-1.5">
              {proposal.steps.map((step) => (
                <div
                  key={step.order}
                  className="flex items-start gap-2 rounded-xl border border-neutral-200/80 bg-white p-2.5 text-xs"
                >
                  <span className="inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-[#164b3e] text-[10px] font-bold text-white">
                    {step.order}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      {step.kind === "image" ? (
                        <span className="inline-flex items-center gap-1 rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-medium text-emerald-800">
                          <ImageIcon size={10} />
                          生成配图
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded bg-neutral-100 px-1.5 py-0.5 text-[10px] font-medium text-neutral-700">
                          <FileText size={10} />
                          {ARTICLE_TEXT_ROLE_LABEL[step.role ?? "material"]}
                        </span>
                      )}
                    </div>
                    <p className="mt-1 leading-relaxed text-neutral-800">{step.brief}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#e2ece5] bg-white px-3.5 py-2.5">
            {planExecuted ? (
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-800">
                <Check size={14} />
                已在画布铺好图文节点并串联顺序
              </span>
            ) : (
              <>
                <span className="text-[11px] text-neutral-500">可继续聊修改意见，或直接采纳上画布</span>
                {onConfirmPlan && (
                  <button
                    type="button"
                    disabled={!canConfirmPlan}
                    onClick={() => onConfirmPlan(proposal)}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-[#164b3e] px-3.5 py-1.5 text-xs font-semibold text-white shadow-xs transition hover:bg-[#123d32] disabled:cursor-not-allowed disabled:bg-neutral-200 disabled:text-neutral-500"
                  >
                    <Sparkles size={13} aria-hidden="true" />
                    采纳方案并铺上画布
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </article>
  );
}
