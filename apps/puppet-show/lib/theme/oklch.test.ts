import { expect, test } from "vitest";
import { DarkPaletteFor, HexToOklch, OklchToHex } from "./oklch";

test("reads hex colors as OKLCH", () => {
  const white = HexToOklch("#fff");
  expect(white?.l).toBeCloseTo(1, 3);
  expect(white?.c).toBeCloseTo(0, 3);

  const amber = HexToOklch("#f59e0b");
  expect(amber?.l).toBeCloseTo(0.769, 2);
  expect(amber?.c).toBeCloseTo(0.165, 2);
  expect(amber?.h).toBeCloseTo(70.08, 0);

  expect(HexToOklch("amber")).toBeNull();
  expect(HexToOklch("#f59e0")).toBeNull();
});

test("round-trips sRGB colors", () => {
  for (const hex of ["#f59e0b", "#2563eb", "#16a34a", "#000000", "#ffffff"]) {
    const color = HexToOklch(hex);
    expect(color).not.toBeNull();
    if (color !== null) expect(OklchToHex(color)).toBe(hex);
  }
});

test("derives the dark theme like globals.css", () => {
  const amber = HexToOklch("#f59e0b");
  expect(amber).not.toBeNull();
  if (amber === null) return;
  const palette = DarkPaletteFor(amber);
  expect(HexToOklch(palette.g1)?.l).toBeCloseTo(0.44, 2);
  expect(HexToOklch(palette.bg)?.l).toBeCloseTo(0.15, 2);
  expect(Object.values(palette).every((value) => /^#[0-9a-f]{6}$/.test(value))).toBe(true);
});
