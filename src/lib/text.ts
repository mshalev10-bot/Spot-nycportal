export function previewText(input: string | null | undefined, max = 360): string {
  if (!input) return "";
  const text = input
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/\r/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
  if (text.length <= max) return text;
  return text.slice(0, max - 1).trimEnd() + "…";
}

export function labelOf(map: Record<string, string>, value: string | null | undefined): string | null {
  if (!value) return null;
  return map[value] ?? value;
}

export function safeNext(path: string | undefined | null): string {
  if (!path) return "/";
  if (!path.startsWith("/") || path.startsWith("//") || path.startsWith("/\\") || path.startsWith("/login")) {
    return "/";
  }
  if (path.includes("://") || path.includes("\\")) return "/";
  return path;
}
