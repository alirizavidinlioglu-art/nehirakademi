export function coordinateScale(points: { x: number; y: number }[]) {
  const minX = Math.min(0, ...points.map((p) => p.x));
  const maxX = Math.max(0, ...points.map((p) => p.x));
  const minY = Math.min(0, ...points.map((p) => p.y));
  const maxY = Math.max(0, ...points.map((p) => p.y));
  return {
    x: (x: number) => 40 + ((x - minX) / (maxX - minX || 1)) * 320,
    y: (y: number) => 200 - ((y - minY) / (maxY - minY || 1)) * 170,
  };
}
