// lib/connections/index.js
import { buildBasePlates } from "./baseplate.js";
import { buildCopesFromBuilding } from "./copes.js";

export function buildConnectionsFromModel(model, opts = {}) {
  const b = model?.building;
  if (!b) return [];

  const plates = buildBasePlates(b, opts);
  const copes  = buildCopesFromBuilding(b, opts);

  return [...plates, ...copes];
}
