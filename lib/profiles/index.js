// lib/profiles/index.js
import { CATALOG_EN } from "./catalog.en.js";
import { normalizeProfileKey, defaultProfileForElementType } from "./normalize.js";
import { profilePolygon } from "./shapes.js";
import { massKgPerM, dims } from "./props.js";

export { CATALOG_EN };
export { profilePolygon };
export { defaultProfileForElementType };

export function getProfileEntry(keyOrType, catalog = CATALOG_EN) {
  const key = normalizeProfileKey(keyOrType, catalog);
  return catalog[key] || catalog[defaultProfileForElementType("viga")];
}

export function getProfileSpec(keyOrType, catalog = CATALOG_EN) {
  const entry = getProfileEntry(keyOrType, catalog);
  return {
    code: entry.key,
    family: entry.family,
    dims: entry.dims,
    mass_kg_m: massKgPerM(entry),
    props: entry.props || {},
    meta: entry.meta || {},
  };
}

export function profileMassKg(profileCodeOrType) {
  const e = getProfileEntry(profileCodeOrType, CATALOG_EN);
  return massKgPerM(e);
}

export function profileDims(profileCodeOrType) {
  const e = getProfileEntry(profileCodeOrType, CATALOG_EN);
  return dims(e);
}
