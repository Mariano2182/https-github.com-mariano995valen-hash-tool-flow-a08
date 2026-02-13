// En Tekla real, estas props vienen tabuladas.
// Acá: si no existen, derivamos mínimas (A y estimación) para no romper.
export function derivePropsIfMissing(p) {
  if (p.props && Number.isFinite(p.props.A)) return p.props;

  // fallback: aproximación por área = mass/(7850) (kg/m / kg/m3 = m2)
  const rho = 7850; // acero
  const A = (p.mass_kg_m || 0) / rho;

  return {
    A,
    Ix: p.props?.Ix ?? 0,
    Iy: p.props?.Iy ?? 0,
    Wx: p.props?.Wx ?? 0,
    Wy: p.props?.Wy ?? 0,
    rx: p.props?.rx ?? 0,
    ry: p.props?.ry ?? 0,
  };
}
