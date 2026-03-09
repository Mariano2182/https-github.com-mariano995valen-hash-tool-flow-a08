// lib/ui/profiles.js
import { getAllProfiles } from "../profiles/index.js";

function qs(sel) {
  return document.querySelector(sel);
}

function fillSelect(select, items, selectedKey) {
  if (!select) return;

  select.innerHTML = "";

  items.forEach((p) => {
    const opt = document.createElement("option");
    opt.value = p.key;

    const massTxt =
      Number.isFinite(Number(p.mass_kg_m)) && Number(p.mass_kg_m) > 0
        ? `${Number(p.mass_kg_m).toLocaleString("es-AR", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })} kg/m`
        : "- kg/m";

    opt.textContent = `${p.key} — ${p.standard || p.country || ""} — ${massTxt}`;

    if (p.key === selectedKey) opt.selected = true;
    select.appendChild(opt);
  });
}

export function populateProfileSelectors() {
  const all = getAllProfiles();

  const columns = all.filter((p) =>
    ["I", "H", "TR", "TC"].includes(p.family)
  );

  const rafters = all.filter((p) =>
    ["I", "H", "TR", "TC"].includes(p.family)
  );

  const purlins = all.filter((p) =>
    ["Z"].includes(p.family)
  );

  const girts = all.filter((p) =>
    ["C", "U", "Z"].includes(p.family)
  );

  fillSelect(qs("#ind-profile-column"), columns, "HEB300");
  fillSelect(qs("#ind-profile-rafter"), rafters, "IPE300");
  fillSelect(qs("#ind-profile-purlin"), purlins, "Z200x70x15x3");
  fillSelect(qs("#ind-profile-girt"), girts, "C200x70x15x3");
}
