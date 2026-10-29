/**
 * One event in the public feed.
 *
 * From `sm` up it is the design's photo card: the banner with the calendar
 * badge and the like button over it, then the title, time, place and tags. On
 * phones it collapses into a row: a square thumbnail with the badge, the text,
 * and the heart on the right.
 *
 * An event without a banner trades the photo for a date tile in the
 * organization's gradient: on phones it fills the thumbnail's square; from `sm`
 * up it sits beside the like button over a faint wash of the gradient, and the
 * room the photo took shows the start of the description instead.
 *
 * @module
 */

import Link from "next/link";
import { MdAccessTime, MdArrowForward, MdDateRange, MdDeleteOutline, MdEvent, MdLocationOn } from "react-icons/md";
import type { CardImage, FeedCard } from "@/domain/feed";
import { DateBadge as BadgeParts, FeaturedDay, MultiDayLabel, TimeRange } from "@/domain/schedule";
import { ImageWithPlaceholder } from "@/components/ui/ImageWithPlaceholder";
import { LikeButton, TagChips } from "./EventParts";

/** What a card shows instead of a banner: the organization's gradient. */
export const NO_BANNER_BACKGROUND = "linear-gradient(140deg, var(--g1), var(--g2) 55%, var(--g3))";

/** Fades the no-banner wash out towards the middle of the card. */
const WASH_MASK = "linear-gradient(to bottom, #000, transparent)";

type Badge = ReturnType<typeof BadgeParts>;

/** The banner, zooming on hover, with the calendar badge in dark glass over it. */
function BannerCover({ banner, badge }: { banner: CardImage; badge: Badge }) {
  return (
    <div aria-hidden className="relative col-start-1 row-start-1 h-[92px] overflow-hidden rounded-2xl sm:aspect-[16/10] sm:h-auto sm:rounded-none">
      <div className="absolute inset-0 transition-transform duration-[600ms] ease-[cubic-bezier(.2,.8,.2,1)] group-hover:scale-105">
        <ImageWithPlaceholder image={banner} alt="" className="h-full w-full" />
      </div>
      <span className="glass-photo absolute left-2 top-2 column w-[46px] items-center rounded-xl py-1.5 leading-none sm:left-3.5 sm:top-3.5 sm:w-[58px] sm:rounded-2xl sm:pb-1.5 sm:pt-[7px]">
        {badge === null ? (
          <MdEvent className="h-6 w-6" />
        ) : (
          <>
            <span className="font-display text-lg font-bold sm:text-2xl">{badge.day}</span>
            <span className="mt-1 font-mono text-[10px] uppercase opacity-85 sm:text-[11px]">{badge.month}</span>
          </>
        )}
      </span>
    </div>
  );
}

/**
 * The calendar day on the organization's gradient, standing in for the banner:
 * the thumbnail's whole square on phones, a 64 px tile from `sm` up.
 */
function DateTile({ badge }: { badge: Badge }) {
  return (
    <div
      aria-hidden
      className="relative col-start-1 row-start-1 column h-[92px] items-center justify-center rounded-2xl border border-muted leading-none shadow-sm sm:mx-[22px] sm:mt-[22px] sm:h-16 sm:w-16"
      style={{ background: NO_BANNER_BACKGROUND }}
    >
      {badge === null ? (
        <MdEvent className="h-8 w-8 sm:h-7 sm:w-7" />
      ) : (
        <>
          <span className="font-display text-[32px] font-bold tracking-[-.02em] sm:text-[26px]">{badge.day}</span>
          <span className="mt-1.5 font-mono text-xs uppercase opacity-85 sm:mt-1 sm:text-[11px]">{badge.month}</span>
        </>
      )}
    </div>
  );
}

export type EventCardProps = {
  card: FeedCard;
  /** `YYYY-MM-DD`; decides which day the badge features. */
  today: string;
  /** While the like request for this card runs. */
  likeBusy?: boolean;
  /** Shown under the actions after an anonymous visitor tried to like this event. */
  loginPrompt?: boolean;
  /** Path to come back to after logging in. */
  loginRedirect?: string;
  onToggleLike: (eventId: string) => void;
  /** Called when the person shows intent to open the event (hover, focus, touch), to load it beforehand. */
  onIntent?: (eventId: string) => void;
  /** Asks to delete the event; only offered to the event's creator and to a Superadmin. */
  onDelete: (eventId: string) => void;
};

/**
 * Banner with calendar badge and like button (or, without a banner, the date
 * tile and the start of the description), title (linking to the details
 * page), time, multi-day hint, place, tags, "Ver detalhes" and, on the
 * viewer's own events, "Excluir".
 */
export function EventCard({
  card, today, likeBusy = false, loginPrompt = false, loginRedirect = "/", onToggleLike, onIntent, onDelete,
}: EventCardProps) {
  const day = FeaturedDay(card.schedule, today);
  const badge = day === null ? null : BadgeParts(day.date);
  const multiDay = MultiDayLabel(card.schedule);
  const href = `/eventos/${card.id}`;
  const hasBanner = card.banner != null;
  const intent = {
    onMouseEnter: () => onIntent?.(card.id),
    onFocus: () => onIntent?.(card.id),
    onTouchStart: () => onIntent?.(card.id),
  };

  return (
    <article
      aria-labelledby={`event-${card.id}-title`}
      className="group glass lift relative grid h-full grid-cols-[92px_minmax(0,1fr)_auto] gap-x-3.5 gap-y-3 overflow-hidden rounded-[22px] p-2.5 sm:flex sm:flex-col sm:gap-0 sm:rounded-[26px] sm:p-0"
    >
      {!hasBanner && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 -z-10 hidden h-36 opacity-50 sm:block"
          style={{ background: NO_BANNER_BACKGROUND, maskImage: WASH_MASK, WebkitMaskImage: WASH_MASK }}
        />
      )}

      {/* The title already names the event; the picture and the badge are decoration here. */}
      {card.banner != null ? <BannerCover banner={card.banner} badge={badge} /> : <DateTile badge={badge} />}

      <div className={`col-start-2 row-start-1 column min-w-0 gap-1 self-center sm:gap-2.5 sm:self-stretch sm:px-[22px] ${hasBanner ? "sm:pt-5" : "sm:pt-4"}`}>
        <h2
          id={`event-${card.id}-title`}
          className="line-clamp-2 font-display text-base font-bold leading-tight tracking-[-.015em] break-words sm:text-[22px]"
        >
          <Link href={href} {...intent} className="rounded focus-ring hover:text-main">
            {card.title}
          </Link>
        </h2>

        {!hasBanner && (
          <p className="t2 hidden text-sm leading-relaxed whitespace-pre-line break-words sm:line-clamp-4">
            {card.description}
          </p>
        )}

        <div className="t2 column gap-1 text-[13px] sm:text-sm">
          <p className="row gap-2">
            <MdAccessTime aria-hidden className="h-4 w-4 shrink-0" />
            <span>{day === null ? "Sem data definida" : TimeRange(day)}</span>
          </p>

          {multiDay !== null && (
            <p className="row gap-2">
              <MdDateRange aria-hidden className="h-4 w-4 shrink-0" />
              <span>{multiDay}</span>
            </p>
          )}

          <p className="row min-w-0 gap-2">
            <MdLocationOn aria-hidden className="h-4 w-4 shrink-0" />
            <span className="truncate">{card.location}</span>
          </p>
        </div>
      </div>

      {/* One button for both layouts: beside the text on phones; from `sm` up over the photo, or level with the date tile. */}
      <div
        className={`col-start-3 row-start-1 self-center sm:absolute ${hasBanner ? "sm:right-3.5 sm:top-3.5" : "sm:right-[22px] sm:top-[22px] sm:flex sm:h-16 sm:items-center"}`}
      >
        <LikeButton
          title={card.title}
          voted={card.voted}
          count={card.voteCount}
          busy={likeBusy}
          onToggle={() => onToggleLike(card.id)}
          className={`t2 flex-col gap-0.5 border-transparent bg-transparent px-1.5 text-xs sm:flex-row sm:gap-2 sm:rounded-full sm:px-3.5 sm:text-sm ${hasBanner ? "sm:glass-photo sm:hover:bg-[rgba(10,10,12,.58)]" : "sm:border-muted sm:bg-surface-1 sm:hover:bg-surface-2"}`}
        />
      </div>

      <div className="col-span-3 column gap-3 sm:mt-auto sm:px-[22px] sm:pb-[22px] sm:pt-4">
        <TagChips tags={card.tags} />

        <div className="row flex-wrap gap-2">
          <Link
            href={href}
            {...intent}
            className="button touch focus-ring"
            aria-label={`Ver detalhes de “${card.title}”`}
          >
            Ver detalhes
            <MdArrowForward aria-hidden className="h-4 w-4" />
          </Link>

          {card.canDelete && (
            <button
              type="button"
              onClick={() => onDelete(card.id)}
              className="button danger-soft touch focus-ring ml-auto"
              aria-label={`Excluir “${card.title}”`}
            >
              <MdDeleteOutline aria-hidden className="icon" />
              Excluir
            </button>
          )}
        </div>

        {loginPrompt && (
          <p role="status" className="notice n-info">
            <span>
              Você precisa entrar na sua conta para curtir eventos.{" "}
              <Link href={`/entrar?redirect=${encodeURIComponent(loginRedirect)}`} className="ink font-semibold underline focus-ring rounded">
                Entrar
              </Link>
            </span>
          </p>
        )}
      </div>
    </article>
  );
}
