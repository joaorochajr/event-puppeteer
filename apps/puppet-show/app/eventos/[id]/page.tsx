/**
 * Details of one event: `/eventos/<id>`.
 *
 * @module
 */

import type { Metadata } from "next";
import Link from "next/link";
import { MdArrowBack } from "react-icons/md";
import { EventDetailsContainer } from "@/components/events/EventDetailsContainer";
import { EventMetadata, UNKNOWN_EVENT_METADATA } from "@/components/events/eventMetadata";
import { PublicEvent } from "@/lib/api/public";

/** Absolute address of `/eventos/<id>`, or `null` when `NEXT_PUBLIC_SITE_URL` is missing or invalid. */
function PageUrl(id: string): string | null {
  const site = process.env.NEXT_PUBLIC_SITE_URL;
  if (site === undefined || !URL.canParse(site)) return null;
  return new URL(`/eventos/${encodeURIComponent(id)}`, site).toString();
}

/**
 * Tab title and link preview from the event as the public sees it. The session
 * lives in the browser, so the server only knows public events: events of other
 * organizations and hidden ones keep the generic head. A failed read is logged
 * on the server; the page itself still loads the event in the browser and shows
 * the person its own error.
 */
export async function generateMetadata(props: PageProps<"/eventos/[id]">): Promise<Metadata> {
  const { id } = await props.params;
  const event = await PublicEvent(id);
  if (!event.ok) {
    console.error(`Metadados do evento ${id} indisponíveis: ${event.error}`);
    return UNKNOWN_EVENT_METADATA;
  }
  if (event.value === null) return UNKNOWN_EVENT_METADATA;
  const pageUrl = PageUrl(id);
  if (pageUrl === null) console.error("NEXT_PUBLIC_SITE_URL ausente ou inválida: og:url fica de fora da prévia do evento.");
  return EventMetadata(event.value, pageUrl);
}

/** Back link to the feed plus the event, loaded in the browser (it depends on the session). */
export default async function EventPage(props: PageProps<"/eventos/[id]">) {
  const { id } = await props.params;

  return (
    <main className="w-full px-4 pb-20 pt-4 sm:px-6 lg:px-8 lg:pt-6">
      <div className="mx-auto column w-full max-w-page gap-6">
        <Link href="/" className="t2 row min-h-11 self-start gap-2 rounded-xl font-medium transition-colors hover:text-foreground focus-ring">
          <MdArrowBack aria-hidden className="icon" />
          Voltar ao mural
        </Link>

        <EventDetailsContainer eventId={id} />
      </div>
    </main>
  );
}
