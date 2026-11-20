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

export interface StudioSkill {
  id: string;
  name: string;
  description: string;
}

export interface StudioAgentTurn {
  id: string;
  prompt: string;
  skillName?: string | null;
  attachments: StudioAttachment[];
  events: StudioAgentEvent[];
  status: "running" | "complete" | "failed";
  createdAt: string;
}

export interface CreativePlanStep {
  order: number;
  kind: "text" | "image";
  role?: "material" | "verbatim" | "requirement";
  brief: string;
}

export interface CreativePlanProposal {
  title: string;
  summary: string;
  recommendedModel: "seedream-5-5" | "nano-banana-2" | "gpt-image-2";
  steps: CreativePlanStep[];
}

export interface StudioPlacedNode {
  id: string;
  x: number;
  y: number;
  width: number | null;
  asset: StudioAttachment;
}
