/** Plain-English quadrant for a ±10 compass position. */
export function compassQuadrant(x: number, y: number) {
  if (Math.abs(x) < 1 && Math.abs(y) < 1) return "centre";
  const econ = x < 0 ? "left" : "right";
  const social = y < 0 ? "libertarian" : "authoritarian";
  return `${econ}-${social}`;
}

export function formatCompassPoint(x: number, y: number) {
  return `${compassQuadrant(x, y)} (${x.toFixed(1)}, ${y.toFixed(1)})`;
}
