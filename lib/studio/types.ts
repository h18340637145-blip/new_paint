import type { GenerationConfig } from "./models";

export interface ProjectCardData {
  id: string;
  title: string;
  updatedAt: string;
  coverUrl: string | null;
}

export interface ImageAsset {
  id: string;
  url: string;
}

export type JobStatus = "pending" | "starting" | "generating" | "importing" | "succeeded" | "failed" | "unknown";

export interface CanvasJob {
  id: string;
  slot: number;
  attempt: number;
  status: JobStatus;
  error: string | null;
  asset: ImageAsset | null;
  x: number;
  y: number;
}

export interface CanvasSubmission {
  id: string;
  prompt: string;
  config: GenerationConfig;
  reference: ImageAsset | null;
  jobs: CanvasJob[];
}
