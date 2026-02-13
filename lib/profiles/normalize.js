// lib/profiles/normalize.js
// Normaliza tipo de elemento -> perfil por defecto

export function defaultProfileForElementType(type) {
  const t = String(type || "").toLowerCase();

  if (t === "columna") return "HEB300";
  if (t === "viga") return "IPE300";
  if (t === "cabio") return "IPE300";
  if (t === "correas") return "Z200";
  if (t === "correas_columna") return "C200";

  return "IPE300";
}

export function normalizeProfileKey(keyOrType, catalog) {
  if (!keyOrType) return defaultProfileForElementType("viga");

  const k = String(keyOrType);
  if (catalog && catalog[k]) return k;

  // si no existe, lo tratamos como type
  return defaultProfileForElementType(k);
}
