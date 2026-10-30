/**
 * The generated preview picture of an event without a banner:
 * `/eventos/<id>/capa`, a 1200×630 PNG drawn from {@link EventCover}.
 *
 * The page's `generateMetadata` points `og:image` here only when the event has
 * no approved banner. A route of its own (instead of an `opengraph-image`
 * file) keeps that choice there: file-based metadata would override the banner.
 *
 * It shows only what the public can see; any other event answers 404.
 *
 * @module
 */

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { COVER_SIZE, COVER_TITLE_FONT, EventCover } from "@/components/events/EventCover";
import { CoverPropsFor } from "@/components/events/eventMetadata";
import { PublicEvent, PublicOrganization } from "@/lib/api/public";
import { Err, Ok, type Result } from "@/lib/result";
import { DarkPaletteFor, HexToOklch } from "@/lib/theme/oklch";
import { DEFAULT_ORG_COLOR, IsHexColor } from "@/lib/theme/theme";

/** Browsers and CDNs may keep the picture a day (the organization's color can change). */
const CACHE_CONTROL = "public, max-age=86400";

/** The title font (Bricolage Grotesque Bold, OFL, see `assets/fonts`), read once. */
const TITLE_FONT: Promise<Result<Buffer, string>> = readFile(join(process.cwd(), "assets/fonts/BricolageGrotesque-Bold.ttf")).then(
  (data) => Ok(data),
  (cause: unknown) => Err(cause instanceof Error ? cause.message : String(cause)),
);

/** A plain-text answer for when there is no picture to draw. */
function Failure(status: number, message: string): Response {
  return new Response(message, { status, headers: { "Content-Type": "text/plain; charset=utf-8" } });
}

export async function GET(_request: Request, context: RouteContext<"/eventos/[id]/capa">): Promise<Response> {
  const { id } = await context.params;

  const event = await PublicEvent(id);
  if (!event.ok) {
    console.error(`Capa do evento ${id}: ${event.error}`);
    return Failure(502, "Não foi possível ler o evento.");
  }
  if (event.value === null) return Failure(404, "Evento não encontrado ou indisponível.");

  const organization = await PublicOrganization(event.value.organizationId);
  if (!organization.ok) {
    console.error(`Capa do evento ${id}: ${organization.error}`);
    return Failure(502, "Não foi possível ler a organização do evento.");
  }
  if (organization.value === null) return Failure(404, "Organização do evento não encontrada.");

  const font = await TITLE_FONT;
  if (!font.ok) {
    console.error(`Capa do evento ${id}: fonte do título indisponível: ${font.error}`);
    return Failure(500, "Não foi possível carregar a fonte da capa.");
  }

  /** The organization's color as the app paints it: the default one when it has none (see `ApplyOrgColor`). */
  const color = HexToOklch(IsHexColor(organization.value.colorScheme) ? organization.value.colorScheme : DEFAULT_ORG_COLOR);
  if (color === null) return Failure(500, "Cor da organização inválida.");

  const props = CoverPropsFor(event.value, organization.value.name, DarkPaletteFor(color));
  return new ImageResponse(<EventCover {...props} />, {
    ...COVER_SIZE,
    fonts: [{ name: COVER_TITLE_FONT, data: font.value, weight: 700, style: "normal" }],
    headers: { "Cache-Control": CACHE_CONTROL },
  });
}
