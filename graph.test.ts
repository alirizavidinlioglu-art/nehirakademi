import { it, expect } from "vitest";
import { coordinateScale } from "../lib/graph";
it("plots negative coordinates inside the chart and positions the zero axes correctly", () => {
  const scale = coordinateScale([
    { x: -5, y: -10 },
    { x: 5, y: 10 },
  ]);
  expect(scale.x(-5)).toBe(40);
  expect(scale.x(0)).toBe(200);
  expect(scale.x(5)).toBe(360);
  expect(scale.y(10)).toBe(30);
  expect(scale.y(-10)).toBe(200);
});
it("avoids division by zero for empty and origin-only graphs", () => {
  expect(Number.isFinite(coordinateScale([]).x(0))).toBe(true);
  expect(Number.isFinite(coordinateScale([{ x: 0, y: 0 }]).y(0))).toBe(true);
});
