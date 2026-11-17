export const markdownMime = "text/markdown";
export const maxMarkdownBytes = 256 * 1024;
export const markdownFilename = /\.(?:md|markdown)$/i;

export function attachmentFilename(value: unknown) {
  return typeof value === "string" ? value.replace(/[\x00-\x1f\x7f/\\]/g, "").trim().slice(0, 180) : "";
}
