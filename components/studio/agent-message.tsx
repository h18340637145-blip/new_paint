"use client";

import { AttachmentCard } from "./attachment-card";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { StudioAgentTurn } from "@/lib/studio/agent-events";

export function AgentMessage({ turn }: { turn: StudioAgentTurn }) {
  const text = turn.events.map((entry) => entry.type === "text" ? entry.text : "").join("");
  const thinking = turn.events.map((entry) => entry.type === "thinking" ? entry.text : "").join("");
  const tools = turn.events.filter((entry) => entry.type === "tool-start");
  return (
    <article className="space-y-3 text-sm">
      <div className="ml-auto w-fit max-w-[90%] rounded-xl bg-neutral-100 px-3 py-2">
        <p className="whitespace-pre-wrap break-words">{turn.prompt}</p>
        {turn.attachments.length > 0 && <div className="mt-2 flex flex-wrap gap-2">
          {turn.attachments.map((asset) => <AttachmentCard key={asset.id} asset={asset} />)}
        </div>}
      </div>
      {thinking && <details open={turn.status === "running"} className="rounded-lg bg-neutral-50 px-2 py-1 text-xs text-neutral-600">
        <summary className="cursor-pointer">思考过程</summary>
        <p className="whitespace-pre-wrap break-words py-1">{thinking}</p>
      </details>}
      {tools.map((tool) => {
        const result = turn.events.find((event) => event.type === "tool-end" && event.id === tool.id);
        return <details key={tool.id} className="rounded-lg border border-neutral-200 p-2 text-xs">
          <summary className="cursor-pointer">{tool.name} · {result?.type === "tool-end" ? (result.failed ? "失败" : "完成") : "运行中"}</summary>
          <p className="mt-2">参数</p>
          <pre className="overflow-auto whitespace-pre-wrap break-all">{JSON.stringify(tool.args, null, 2)}</pre>
          {result?.type === "tool-end" && <>
            <p className="mt-2">{result.failed ? "错误" : "结果"}</p>
            <pre className="overflow-auto whitespace-pre-wrap break-all">{JSON.stringify(result.result, null, 2)}</pre>
          </>}
        </details>;
      })}
      {text && (
        <div className="break-words [&_ul]:list-disc [&_ol]:list-decimal [&_li]:ml-5 [&_hr]:my-2 [&_p]:my-1 [&_pre]:overflow-auto [&_pre]:rounded-lg [&_pre]:bg-neutral-100 [&_pre]:p-2 [&_table]:block [&_table]:overflow-auto [&_td]:border [&_td]:p-1 [&_th]:border [&_th]:p-1">
          <Markdown remarkPlugins={[remarkGfm]} skipHtml disallowedElements={["img"]}
            urlTransform={(url) => /^https?:\/\//i.test(url) ? url : ""}
            components={{ a: ({ children, href }) => href
              ? <a href={href} target="_blank" rel="noreferrer" className="underline">{children}</a> : <span>{children}</span> }}>
            {text}
          </Markdown>
        </div>
      )}
      {turn.status === "running" && !text && <p role="status" className="text-xs text-neutral-500">Agent 正在处理</p>}
      {turn.events.map((entry, index) => entry.type === "error" && (
        <p key={index} role="alert" className="text-xs text-red-700">{entry.text}</p>
      ))}
    </article>
  );
}
