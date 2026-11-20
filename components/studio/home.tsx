"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";
import { Composer, type ComposerInput, type StudioMode } from "./composer";
import { studioRequest, submitGeneration, uploadReference } from "@/lib/studio/client";
import type { StudioAttachment } from "@/lib/studio/agent-events";

export const PENDING_AGENT_KICKOFF_KEY = "new_paint_pending_agent_kickoff";

const STARTER_PROMPTS: Array<{
  label: string;
  mode: StudioMode;
  prompt: string;
}> = [
  {
    label: "节气生活推文 + 温暖插画",
    mode: "agent",
    prompt: "帮我策划一篇公众号《霜降后的三杯暖饮》推文，写出导语与三段正文，并生成 3 张暖色调治愈插画按阅读顺序连好。",
  },
  {
    label: "新品开箱评测分镜",
    mode: "agent",
    prompt: "规划一篇桌面无线音箱深度体验文章：包含 16:9 木质桌面实拍感封面图、外观细节与听感体验分镜。",
  },
  {
    label: "直接生成 16:9 公众号封面",
    mode: "image",
    prompt: "清晨薄雾笼罩的山谷木构茶室，柔和自然晨光透过落地窗洒在原木长桌上，极简东方美学，纪实摄影质感，16:9",
  },
];

export function HomeComposer() {
  const router = useRouter();
  const [mode, setMode] = useState<StudioMode>("agent");
  const [presetPrompt, setPresetPrompt] = useState<string | null>(null);

  const draft = useRef<{
    projectId: string;
    submissionId: string;
    assetId: string;
    file: File | null;
    prompt: string;
    configKey: string;
  } | null>(null);

  async function send(input: ComposerInput) {
    if (mode === "agent") {
      const projectId = crypto.randomUUID();
      const shortTitle =
        input.prompt.trim().replace(/\s+/g, " ").slice(0, 32) || "图文共创项目";

      await studioRequest({
        action: "create-project",
        projectId,
        createProject: true,
        title: shortTitle,
      });

      const uploadedAttachments: StudioAttachment[] = [];
      if (input.file) {
        const uploaded = await uploadReference(
          input.file,
          projectId,
          crypto.randomUUID(),
          false,
          true,
        );
        uploadedAttachments.push(uploaded);
      }

      try {
        window.sessionStorage.setItem(
          PENDING_AGENT_KICKOFF_KEY,
          JSON.stringify({
            projectId,
            prompt: input.prompt.trim() || "请结合我上传的参考图规划公众号图文分镜。",
            attachments: uploadedAttachments,
          }),
        );
      } catch {
        // 忽略存储异常
      }

      router.push(`/canvas?projectId=${projectId}`);
      return;
    }

    const configKey = JSON.stringify(input.config);
    if (
      !draft.current
      || draft.current.prompt !== input.prompt
      || draft.current.file !== input.file
      || draft.current.configKey !== configKey
    ) {
      draft.current = {
        projectId: draft.current?.projectId ?? crypto.randomUUID(),
        submissionId: crypto.randomUUID(),
        assetId: crypto.randomUUID(),
        prompt: input.prompt,
        file: input.file,
        configKey,
      };
    }
    const { projectId, submissionId, assetId } = draft.current;
    await submitGeneration(input, projectId, submissionId, assetId, true);
    draft.current = null;
    router.push(`/canvas?projectId=${projectId}`);
  }

  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-[#cfd8cc] bg-white p-1.5 shadow-md">
        <Composer
          home
          mode={mode}
          onModeChange={setMode}
          presetPrompt={presetPrompt}
          onPresetConsumed={() => setPresetPrompt(null)}
          onSend={send}
        />
      </div>

      <div className="flex flex-wrap items-center justify-center gap-2">
        <span className="inline-flex items-center gap-1 text-xs text-neutral-500">
          <Sparkles size={12} className="text-[#164b3e]" aria-hidden="true" />
          试试这样开始：
        </span>
        {STARTER_PROMPTS.map((starter) => (
          <button
            key={starter.label}
            type="button"
            onClick={() => {
              setMode(starter.mode);
              setPresetPrompt(starter.prompt);
            }}
            className="rounded-full border border-[#d6dfd3] bg-white/85 px-3 py-1.5 text-xs font-medium text-neutral-700 transition hover:border-[#164b3e]/50 hover:bg-white hover:text-[#164b3e]"
          >
            {starter.label}
          </button>
        ))}
      </div>
    </div>
  );
}
