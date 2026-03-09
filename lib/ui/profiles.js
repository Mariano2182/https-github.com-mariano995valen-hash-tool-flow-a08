import { PROFILE_CATALOG } from "../profiles/index.js";

function qs(s) {
  return document.querySelector(s);
}

function fillSelect(select, profiles) {
  if (!select) return;

  select.innerHTML = "";

  profiles.forEach((p) => {
    const opt = document.createElement("option");
    opt.value = p.key;
    opt.textContent = `${p.key} (${p.mass_kg_m} kg/m)`;
    select.appendChild(opt);
  });
}

export function populateProfileSelectors() {
  const profiles = Object.values(PROFILE_CATALOG);

  const beams = profiles.filter(p => p.family === "I");
  const columns = profiles.filter
