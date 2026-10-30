/**
 * The picture link previews show for an event without a banner: the date tile
 * of the banner-less feed card, the title, when and where, over the
 * organization's gradient.
 *
 * It is drawn by `ImageResponse` (Satori), so it uses only inline styles,
 * flexbox and literal colors: no classes, no CSS variables, and every element
 * with more than one child says `display: flex`.
 *
 * @module
 */

import type { DarkPalette } from "@/lib/theme/oklch";

/** Size of Open Graph images (1.91:1), in pixels. */
export const COVER_SIZE = { width: 1200, height: 630 } as const;

/** Family name the title font is registered under in `ImageResponse`. */
export const COVER_TITLE_FONT = "Bricolage Grotesque";

export type EventCoverProps = {
  title: string;
  /** Day and short month of the first day; `null` without a schedule (no tile). */
  badge: { day: string; month: string } | null;
  /** First day in words, e.g. "sexta-feira, 13 de novembro, às 08:00"; `null` without a schedule. */
  when: string | null;
  location: string;
  organization: string;
  palette: DarkPalette;
};

/** Translucent white for the tile and the secondary text, over any gradient. */
const VEIL = "rgba(255, 255, 255, 0.12)";
const VEIL_LINE = "rgba(255, 255, 255, 0.24)";

/** The 1200×630 preview picture. */
export function EventCover({ title, badge, when, location, organization, palette }: EventCoverProps) {
  return (
    <div
      style={{
        ...COVER_SIZE,
        display: "flex",
        flexDirection: "column",
        padding: 72,
        backgroundColor: palette.bg,
        backgroundImage: `linear-gradient(140deg, ${palette.g1}, ${palette.g2} 55%, ${palette.g3})`,
        color: palette.fg,
        fontSize: 30,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 48 }}>
        {badge !== null && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              width: 196,
              height: 196,
              borderRadius: 44,
              backgroundColor: VEIL,
              border: `2px solid ${VEIL_LINE}`,
            }}
          >
            <span style={{ fontFamily: COVER_TITLE_FONT, fontWeight: 700, fontSize: 104, lineHeight: 1 }}>{badge.day}</span>
            <span style={{ fontSize: 34, letterSpacing: 4, textTransform: "uppercase", opacity: 0.85 }}>{badge.month}</span>
          </div>
        )}
        <span
          style={{
            flex: 1,
            fontFamily: COVER_TITLE_FONT,
            fontWeight: 700,
            fontSize: title.length > 60 ? 56 : 68,
            lineHeight: 1.08,
          }}
        >
          {title}
        </span>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: "auto" }}>
        {when !== null && <span style={{ fontSize: 34 }}>{when}</span>}
        {location !== "" && <span style={{ opacity: 0.85 }}>{location}</span>}
        <span style={{ marginTop: 28, fontSize: 24, opacity: 0.7 }}>{`Mural de Eventos · ${organization}`}</span>
      </div>
    </div>
  );
}
