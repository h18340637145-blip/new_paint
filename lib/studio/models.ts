export const models = {
  "nano-banana-2": "Nano Banana 2",
  "gpt-image-2": "GPT Image 2",
  "gpt-image-2-5-flare": "GPT Image 2.5 Flare",
} as const;

export type Model = keyof typeof models;
export const manualModels = ["nano-banana-2", "gpt-image-2"] as const;
export const resolutions = ["1K", "2K", "4K"] as const;
export type Resolution = (typeof resolutions)[number];

export interface GenerationConfig {
  model: Model;
  resolution: Resolution;
  aspectRatio: string;
  count: number;
}

export const defaultConfig: GenerationConfig = {
  model: "nano-banana-2",
  resolution: "1K",
  aspectRatio: "1:1",
  count: 1,
};

const nanoRatios = [
  "8:1", "4:1", "21:9", "16:9", "3:2", "4:3", "5:4", "1:1",
  "4:5", "3:4", "2:3", "9:16", "1:4", "1:8", "auto",
];
const gptRatios = [
  "1:1", "3:2", "2:3", "4:3", "3:4", "5:4", "4:5", "16:9",
  "9:16", "2:1", "1:2", "3:1", "1:3", "21:9", "9:21", "auto",
];
const restrictedRatios: Record<Resolution, string[]> = {
  "1K": [],
  "2K": ["5:4", "4:5", "3:1", "1:3", "9:21"],
  "4K": ["3:1", "1:3", "9:21"],
};

export function supportedRatios(model: Model, resolution: Resolution) {
  return model === "nano-banana-2"
    ? nanoRatios
    : gptRatios.filter((ratio) => !restrictedRatios[resolution].includes(ratio));
}

export function validConfig(value: unknown): value is GenerationConfig {
  if (!value || typeof value !== "object") return false;
  const config = value as GenerationConfig;
  if (!Object.hasOwn(models, config.model) || !resolutions.includes(config.resolution)) return false;
  return supportedRatios(config.model, config.resolution).includes(config.aspectRatio)
    && Number.isInteger(config.count)
    && config.count >= 1
    && config.count <= (config.model === "gpt-image-2" ? 5 : 1);
}

export function configLabel(config: GenerationConfig) {
  const ratio = config.aspectRatio === "auto" ? "自动比例" : config.aspectRatio;
  const size = `${config.resolution} · ${ratio}`;
  return config.model === "gpt-image-2" ? `${size} · ${config.count} 张` : size;
}

export const imageTypes = ["image/jpeg", "image/png", "image/webp"];
export const maxReferenceSize = 10 * 1024 * 1024;
export const maxPromptLength = 20_000;
