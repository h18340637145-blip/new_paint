import "server-only";
import sharp from "sharp";
import { createModels, createProvider, envApiKeyAuth, type Model } from "@earendil-works/pi-ai";
import { openAICompletionsApi } from "@earendil-works/pi-ai/api/openai-completions.lazy";
import { StudioError } from "./auth";

const DEFAULT_ZHIPU_BASE_URL = "https://open.bigmodel.cn/api/paas/v4";

export function zhipuEndpointBase() {
  return (process.env.ZIPU_BASE_URL?.trim() || DEFAULT_ZHIPU_BASE_URL)
    .replace(/\/+$/, "")
    .replace(/\/chat\/completions$/, "");
}

export function createStudioAgentModel() {
  const apiKey = process.env.ZIPU_API_KEY?.trim();
  if (!apiKey) {
    throw new StudioError("尚未配置智谱 Agent 模型密钥（ZIPU_API_KEY）。", 503);
  }

  const baseUrl = zhipuEndpointBase();
  const modelId = process.env.ZIPU_MODEL?.trim() || "glm-5.3";
  const providerId = "zhipu";
  const supportsDirectVision = /(?:4\.\d*v|5v|4v|5\.3-flash)/i.test(modelId);

  const model: Model<"openai-completions"> = {
    id: modelId,
    name: `Zhipu ${modelId}`,
    api: "openai-completions",
    provider: providerId,
    baseUrl,
    reasoning: true,
    input: supportsDirectVision ? ["text", "image"] : ["text"],
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    contextWindow: 128_000,
    maxTokens: 8192,
    thinkingLevelMap: {
      off: "low",
      minimal: "low",
      low: "low",
      medium: "high",
      high: "high",
      xhigh: "max",
      max: "max",
    },
    compat: {
      supportsStore: false,
      supportsDeveloperRole: false,
      supportsReasoningEffort: true,
      maxTokensField: "max_tokens",
      thinkingFormat: "zai",
      supportsStrictMode: true,
      zaiToolStream: true,
    },
  };

  const models = createModels();
  models.setProvider(
    createProvider({
      id: providerId,
      name: "智谱开放平台",
      baseUrl,
      auth: { apiKey: envApiKeyAuth("智谱网关", ["ZIPU_API_KEY"]) },
      models: [model],
      api: openAICompletionsApi(),
    }),
  );

  return { model, streamFn: models.streamSimple.bind(models), supportsDirectVision };
}

/**
 * Uses Zhipu multimodal vision model (`glm-5.3-flash`) to inspect a project image
 * when the primary reasoning model (`glm-5.3`) is text-only.
 */
export async function describeImageWithZhipuVision(
  bytes: Uint8Array,
  mimeType: string,
  filename?: string | null,
): Promise<string> {
  const apiKey = process.env.ZIPU_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("尚未配置智谱模型密钥。");
  }

  let dataUrl: string;
  try {
    const compressed = await sharp(Buffer.from(bytes))
      .rotate()
      .resize({ width: 1024, height: 1024, fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 82 })
      .toBuffer();
    dataUrl = `data:image/jpeg;base64,${compressed.toString("base64")}`;
  } catch {
    dataUrl = `data:${mimeType};base64,${Buffer.from(bytes).toString("base64")}`;
  }

  const visionModel = process.env.ZIPU_VISION_MODEL?.trim() || "glm-5.3-flash";
  const response = await fetch(`${zhipuEndpointBase()}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: visionModel,
      reasoning_effort: "low",
      max_tokens: 600,
      messages: [
        {
          role: "user",
          content: [
            { type: "image_url", image_url: { url: dataUrl } },
            {
              type: "text",
              text: `请用中文简明描述这张参考图${filename ? `（${filename}）` : ""}的：1）核心主体与细节；2）构图与视角；3）色彩光影与视觉风格；4）画面中包含的文字（如有）。用于后续画布创意策划与图生图参考。`,
            },
          ],
        },
      ],
    }),
    signal: AbortSignal.timeout(25_000),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`视觉解析请求失败（HTTP ${response.status}）。`);
  }

  const payload = (await response.json().catch(() => null)) as {
    choices?: Array<{ message?: { content?: string } }>;
  } | null;
  const text = payload?.choices?.[0]?.message?.content?.trim();
  if (!text) {
    throw new Error("视觉模型返回了空描述。");
  }
  return text;
}
