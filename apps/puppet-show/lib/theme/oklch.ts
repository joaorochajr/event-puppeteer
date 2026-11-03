/**
 * OKLCH ↔ sRGB hex, for places that can't run CSS color functions: the link
 * preview image (`ImageResponse` doesn't understand `oklch(from …)` nor CSS
 * variables) gets the theme's colors computed here, with the same formulas as
 * `globals.css`.
 *
 * Conversion matrices from Björn Ottosson, "A perceptual color space for image
 * processing" (https://bottosson.github.io/posts/oklab/). Colors outside sRGB
 * keep their lightness and hue and lose chroma until they fit, as CSS Color 4
 * gamut mapping does in browsers.
 *
 * @module
 */

/** A color in OKLCH: lightness 0–1, chroma (≈0–0.4) and hue in degrees. */
export type Oklch = { l: number; c: number; h: number };

/** The dark theme's colors for one organization color (see `globals.css`). */
export type DarkPalette = {
  /** `--bg` */
  bg: string;
  /** `--fg` */
  fg: string;
  /** `--g1`, `--g2`, `--g3`: the organization's hue and two neighbours. */
  g1: string;
  g2: string;
  g3: string;
};

/** sRGB channel (0–1) → linear light. */
function ToLinear(channel: number): number {
  return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
}

/** Linear light → sRGB channel (0–1), clipped to the gamut. */
function FromLinear(channel: number): number {
  const encoded = channel <= 0.0031308 ? 12.92 * channel : 1.055 * channel ** (1 / 2.4) - 0.055;
  return Math.min(1, Math.max(0, encoded));
}

/** `#rgb` or `#rrggbb` → OKLCH; `null` when `hex` is neither. */
export function HexToOklch(hex: string): Oklch | null {
  const short = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/i.exec(hex);
  const long = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  const parts = short !== null ? short.slice(1).map((digit) => digit + digit) : long !== null ? long.slice(1) : null;
  if (parts === null) return null;
  const [r, g, b] = parts.map((part) => ToLinear(parseInt(part, 16) / 255));

  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);

  const lightness = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const a = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const bb = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  const hue = (Math.atan2(bb, a) * 180) / Math.PI;
  return { l: lightness, c: Math.hypot(a, bb), h: hue < 0 ? hue + 360 : hue };
}

/** OKLCH → linear sRGB channels, which may fall outside 0–1 (out of gamut). */
function ToLinearRgb({ l: lightness, c, h }: Oklch): [number, number, number] {
  const radians = (h * Math.PI) / 180;
  const a = c * Math.cos(radians);
  const b = c * Math.sin(radians);

  const l = (lightness + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (lightness - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (lightness - 0.0894841775 * a - 1.291485548 * b) ** 3;

  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
}

/** Whether linear channels are inside sRGB (with a little slack for rounding). */
function InGamut(rgb: readonly number[]): boolean {
  return rgb.every((channel) => channel >= -1e-4 && channel <= 1 + 1e-4);
}

/** OKLCH → `#rrggbb`, reducing chroma (binary search) when the color is outside sRGB. */
export function OklchToHex(color: Oklch): string {
  let rgb = ToLinearRgb(color);
  if (!InGamut(rgb)) {
    let low = 0;
    let high = color.c;
    for (let step = 0; step < 24; step++) {
      const middle = (low + high) / 2;
      if (InGamut(ToLinearRgb({ ...color, c: middle }))) low = middle;
      else high = middle;
    }
    rgb = ToLinearRgb({ ...color, c: low });
  }
  return `#${rgb.map((channel) => Math.round(FromLinear(channel) * 255).toString(16).padStart(2, "0")).join("")}`;
}

/** The dark theme for `org` (an OKLCH color), as `globals.css` derives it from `--org`. */
export function DarkPaletteFor(org: Oklch): DarkPalette {
  return {
    bg: OklchToHex({ l: 0.15, c: 0.014, h: org.h }),
    fg: OklchToHex({ l: 0.97, c: 0.006, h: org.h }),
    g1: OklchToHex({ l: 0.44, c: Math.min(org.c, 0.17), h: org.h }),
    g2: OklchToHex({ l: 0.38, c: Math.min(org.c, 0.15), h: org.h + 62 }),
    g3: OklchToHex({ l: 0.32, c: Math.min(org.c, 0.13), h: org.h - 74 }),
  };
}
