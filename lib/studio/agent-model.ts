import "server-only";
import { createModels, createProvider, envApiKeyAuth, type Model } from "@earendil-works/pi-ai";
import { openAICompletionsApi } from "@earendil-works/pi-ai/api/openai-completions.lazy";
import { StudioError } from "./auth";

export function createStudioAgentModel() {
  const endpoint = process.env.DEEPSEEK_BASE_URL;
  if (!endpoint || !process.env.DEEPSEEK_API_KEY) {
    throw new StudioError("尚未配置 Agent 模型网关。", 503);
  }

  const baseUrl = endpoint.replace(/\/+$/, "").replace(/\/chat\/completions$/, "");
  const modelId = "deepseek-flash";
  const providerId = "deepseek";
  const model: Model<"openai-completions"> = {
    id: modelId,
    name: "DeepSeek Flash",
    api: "openai-completions",
    provider: providerId,
    baseUrl,
    reasoning: true,
    input: ["text", "image"],
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    contextWindow: 128000,
    maxTokens: 8192,
    compat: { supportsDeveloperRole: false, supportsReasoningEffort: false, thinkingFormat: "deepseek" },
  };
  const models = createModels();
  models.setProvider(createProvider({
    id: providerId,
    name: "DeepSeek Flash",
    baseUrl,
    auth: { apiKey: envApiKeyAuth("DeepSeek 网关", ["DEEPSEEK_API_KEY"]) },
    models: [model],
    api: openAICompletionsApi(),
  }));
  return { model, streamFn: models.streamSimple.bind(models) };
}
