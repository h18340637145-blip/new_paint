export const coverStyles = ["极简大字报", "杂志封面", "插画", "科技", "孟菲斯"] as const;

export function readCoverStyle(prompt: string) {
  const choice = prompt.trim().replace(/^(?:我?(?:选择|选))\s*/, "").replace(/[。！!.]$/, "").trim();
  return coverStyles.find((style) => style === choice);
}
