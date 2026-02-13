export function normalizeKey(k) {
  if (!k) return "";
  return String(k)
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "")
    .replace(/×/g, "X");
}
