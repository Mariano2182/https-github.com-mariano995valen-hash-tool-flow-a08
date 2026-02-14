// lib/connections/index.js
import { buildBasePlates } from "./baseplate.js";
import { buildKneeJoints } from "./kneejoint.js";
import { buildEndPlates } from "./endplate.js";
import { buildCopes } from "./copes.js";

export function buildConnectionsFromModel(model, opts = {}) {
  const b = model?.building;
  if (!b) return [];

  return [
    ...buildBasePlates(b, opts),
    ...buildKneeJoints(b, opts),
    ...buildEndPlates(b, opts),
    ...buildCopes(b, opts),
  ];
}
