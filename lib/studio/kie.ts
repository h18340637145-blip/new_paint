import "server-only";
import type { GenerationConfig } from "./models";

export class KieError extends Error {
  constructor(message: string, public uncertain = false) {
    super(message);
  }
}

const baseUrl = "https://api.kie.ai";

function providerMessage(code: number) {
  switch (code) {
    case 401: return "生图服务暂不可用，请联系管理员。";
    case 402: return "生图服务额度不足，请联系管理员。";
    case 422: return "生图服务拒绝了本次参数，请检查设置或参考图。";
    case 429: return "生图服务繁忙，请稍后重试。";
    default: return "生图服务未能完成请求，请稍后重试。";
  }
}

async function kieRequest<T>(path: string, method: "GET" | "POST", body?: object): Promise<T> {
  const apiKey = process.env.KIE_API_KEY;
  if (!apiKey) throw new KieError("生图服务尚未配置。");
  let response: Response;
  let payload: { code?: number; data?: T };
  try {
    response = await fetch(new URL(path, baseUrl), {
      method,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
    payload = await response.json();
  } catch {
    throw new KieError("暂时无法确认生图服务的响应。", method === "POST");
  }
  if (!response.ok || payload?.code !== 200) {
    const code = response.ok ? (payload?.code ?? 500) : response.status;
    const uncertain = method === "POST" && (code >= 500 || code === 408);
    throw new KieError(providerMessage(code), uncertain);
  }
  if (!payload.data) throw new KieError("生图服务返回了不完整的响应。", method === "POST");
  return payload.data;
}

export function buildKieTaskPayload(
  prompt: string,
  config: GenerationConfig,
  referenceUrls: string[] = [],
): { model: string; input: Record<string, unknown> } {
  if (config.model === "seedream-5-5") {
    const hasReference = referenceUrls.length > 0;
    return {
      model: hasReference ? "seedream/5-5-image-to-image" : "seedream/5-5-text-to-image",
      input: {
        prompt,
        aspect_ratio: !hasReference && config.aspectRatio === "auto" ? "1:1" : config.aspectRatio,
        size: config.resolution,
        output_format: "png",
        ...(hasReference ? { image_urls: referenceUrls } : {}),
      },
    };
  }

  const isNano = config.model === "nano-banana-2";
  const model = isNano
    ? config.model
    : `${config.model}-${referenceUrls.length ? "image-to-image" : "text-to-image"}`;
  const input: Record<string, unknown> = {
    prompt,
    aspect_ratio: config.aspectRatio,
    resolution: config.resolution,
    ...(referenceUrls.length ? { [isNano ? "image_input" : "input_urls"]: referenceUrls } : {}),
  };
  return { model, input };
}

export async function createKieTask(prompt: string, config: GenerationConfig, referenceUrls: string[] = []) {
  const payload = buildKieTaskPayload(prompt, config, referenceUrls);
  const data = await kieRequest<{ taskId?: string }>("/api/v1/jobs/createTask", "POST", payload);
  if (!data.taskId) throw new KieError("生图服务未返回任务编号。", true);
  return data.taskId;
}

export async function getKieTask(taskId: string) {
  const data = await kieRequest<{ state?: string; resultJson?: string }>(
    `/api/v1/jobs/recordInfo?${new URLSearchParams({ taskId })}`, "GET",
  );
  if (data.state === "fail") return { status: "failed" as const };
  if (data.state === "success") {
    let urls: unknown;
    try {
      urls = JSON.parse(data.resultJson ?? "").resultUrls;
    } catch {
      throw new KieError("生图服务返回了无法读取的结果。");
    }
    const url: unknown = Array.isArray(urls) ? urls[0] : null;
    if (typeof url !== "string") throw new KieError("生图结果缺少图片地址。");
    return { status: "succeeded" as const, url };
  }
  if (["waiting", "queuing", "generating"].includes(data.state ?? "")) {
    return { status: "generating" as const };
  }
  throw new KieError("生图服务返回了未知的任务状态。");
}
