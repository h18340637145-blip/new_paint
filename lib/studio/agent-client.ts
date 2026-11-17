import type { StudioAgentEvent, StudioAttachment } from "./agent-events";

type StartEvent = {
  type: "start"; id: string; prompt: string; attachments: StudioAttachment[]; createdAt: string; skillName?: string | null;
};

export async function sendAgentMessage(
  projectId: string, prompt: string, attachmentIds: string[], skillId: string | null,
  onEvent: (event: StartEvent | StudioAgentEvent) => void,
) {
  const response = await fetch("/api/studio/agent", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ projectId, prompt, attachmentIds, skillId }),
  });
  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new Error(data?.error ?? "Agent 暂不可用。");
  }
  if (!response.body) throw new Error("未收到 Agent 响应。");
  const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = "";
  let done = false;
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      const lines = (buffer + chunk.value).split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        if (!line) continue;
        const event: StartEvent | StudioAgentEvent = JSON.parse(line);
        onEvent(event);
        if (event.type === "done") done = true;
      }
    }
  } finally {
    reader.releaseLock();
  }
  if (!done) throw new Error("Agent 响应已中断，刷新后可查看已保存记录。");
}
