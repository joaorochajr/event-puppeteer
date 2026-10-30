/**
 * The `<head>` of an event's page: tab title and the Open Graph / Twitter tags
 * that messengers and social networks read to build the link preview (title,
 * when and where, the description and a picture: the banner, or a generated
 * `EventCover` for events without one).
 *
 * @module
 */

import type { Metadata } from "next";
import { DateBadge, SortedDays, type ScheduleDay } from "@/domain/schedule";
import type { Event } from "@/lib/api/schemas";
import type { DarkPalette } from "@/lib/theme/oklch";
import { LongDate } from "@/utils/date";
import { COVER_SIZE, type EventCoverProps } from "./EventCover";

/** Name of the site, after the page name in the tab title and in previews. */
export const SITE_NAME = "Mural de Eventos";

/** Head of an event page whose event the public can't see (or that couldn't be read). */
export const UNKNOWN_EVENT_METADATA: Metadata = { title: `Evento | ${SITE_NAME}` };

/** Longest description previews get; longer ones are cut at a word, ending in "…". */
export const DESCRIPTION_LIMIT = 200;

/** First day (and its start) in words: `"sexta-feira, 13 de novembro, às 08:00"`; `null` without days. */
export function WhenText(schedule: readonly ScheduleDay[]): string | null {
  const days = SortedDays(schedule);
  const first = days[0];
  if (first === undefined) return null;
  const start = first.startTime === undefined ? "" : `, às ${first.startTime}`;
  const more = days.length > 1 ? ` (e mais ${days.length - 1} ${days.length === 2 ? "dia" : "dias"})` : "";
  return `${LongDate(first.date)}${start}${more}`;
}

/** `text` on one line, cut at the last word that fits in `limit` characters (with "…"). */
export function Clip(text: string, limit: number): string {
  const line = text.replace(/\s+/g, " ").trim();
  if (line.length <= limit) return line;
  const cut = line.slice(0, limit - 1);
  const space = cut.lastIndexOf(" ");
  return `${(space > 0 ? cut.slice(0, space) : cut).trimEnd()}…`;
}

/** Path of the generated preview picture, under the event's page (see `app/eventos/[id]/capa`). */
export const COVER_PATH = "capa";

/** What the generated picture shows, with long texts cut to fit it. */
export function CoverPropsFor(event: Event, organization: string, palette: DarkPalette): EventCoverProps {
  const first = SortedDays(event.schedule)[0];
  return {
    title: Clip(event.title, 90),
    badge: first === undefined ? null : DateBadge(first.date),
    when: WhenText(event.schedule),
    location: Clip(event.location, 80),
    organization: Clip(organization, 60),
    palette,
  };
}

/** The preview picture: the approved banner, else the generated one (needs the page's absolute address). */
function PreviewImage(event: Event, pageUrl: string | null): { url: string; width?: number; height?: number; alt: string } | null {
  if (event.banner !== undefined && event.banner.url !== undefined) return { url: event.banner.url, alt: event.title };
  if (pageUrl === null) return null;
  return { url: `${pageUrl}/${COVER_PATH}`, ...COVER_SIZE, alt: event.title };
}

/**
 * The page head for an event the public can see.
 *
 * @param event - As an anonymous visitor gets it, so the banner `url` is the
 *   approved, permanent one (absent while the banner is under review).
 * @param pageUrl - Absolute address of the page for `og:url` and the generated
 *   picture; `null` when the site's address isn't configured, and both are left out.
 */
export function EventMetadata(event: Event, pageUrl: string | null): Metadata {
  const when = WhenText(event.schedule);
  const summary = [when, event.location.trim()].filter((part) => part !== null && part !== "").join(" · ");
  const description = Clip(summary === "" ? event.description : `${summary}. ${event.description}`, DESCRIPTION_LIMIT);
  const image = PreviewImage(event, pageUrl);
  const images = image === null ? [] : [image];

  return {
    title: `${event.title} | ${SITE_NAME}`,
    description,
    openGraph: {
      type: "website",
      locale: "pt_BR",
      siteName: SITE_NAME,
      title: event.title,
      description,
      ...(pageUrl === null ? {} : { url: pageUrl }),
      images,
    },
    twitter: {
      card: image === null ? "summary" : "summary_large_image",
      title: event.title,
      description,
      images,
    },
  };
}
