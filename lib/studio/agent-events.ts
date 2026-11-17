export type StudioAgentEvent =
  | { type: "text" | "thinking" | "error"; text: string }
  | { type: "tool-start"; id: string; name: string; args: unknown }
  | { type: "tool-end"; id: string; result: unknown; failed: boolean }
  | { type: "done" };

export interface StudioAttachment {
  id: string;
  filename: string;
  kind: "reference" | "generated" | "markdown";
  url: string;
}

export interface StudioAgentTurn {
  id: string;
  prompt: string;
  attachments: StudioAttachment[];
  events: StudioAgentEvent[];
  status: "running" | "complete" | "failed";
  createdAt: string;
}

export interface StudioPlacedNode {
  id: string;
  x: number;
  y: number;
  width: number | null;
  asset: StudioAttachment;
}
