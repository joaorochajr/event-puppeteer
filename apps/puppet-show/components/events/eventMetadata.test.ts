import { expect, test } from "vitest";
import type { Event } from "@/lib/api/schemas";
import { Clip, CoverPropsFor, DESCRIPTION_LIMIT, EventMetadata, WhenText } from "./eventMetadata";

const EVENT: Event = {
  id: "c0765d47",
  title: "Uso Racional de Antimicrobianos",
  description: "Desafios do uso de antimicrobianos\ne estratégias para a Saúde Única.",
  location: "Auditório IV - módulo 6",
  creatorId: "user-1",
  organizationId: "org-1",
  isHidden: false,
  isDeleted: false,
  createdAt: "2026-10-29T16:38:18.906Z",
  schedule: [{ eventId: "c0765d47", date: "2026-11-13", startTime: "08:00" }],
  tags: [],
  links: [],
};

const PAGE = "https://mural.example.org/eventos/c0765d47";
const BANNER = "https://res.cloudinary.com/demo/image/authenticated/s--abc--/img.webp";

test("titles the tab with the event and describes when and where", () => {
  const head = EventMetadata(EVENT, PAGE);
  expect(head.title).toBe("Uso Racional de Antimicrobianos | Mural de Eventos");
  expect(head.description).toBe(
    "sexta-feira, 13 de novembro, às 08:00 · Auditório IV - módulo 6. Desafios do uso de antimicrobianos e estratégias para a Saúde Única.",
  );
  expect(head.openGraph).toMatchObject({
    title: "Uso Racional de Antimicrobianos",
    description: head.description,
    url: PAGE,
    siteName: "Mural de Eventos",
    locale: "pt_BR",
  });
});

test("uses the generated picture when the event has no banner", () => {
  const cover = { url: `${PAGE}/capa`, width: 1200, height: 630, alt: EVENT.title };
  const head = EventMetadata(EVENT, PAGE);
  expect(head.openGraph?.images).toEqual([cover]);
  expect(head.twitter).toMatchObject({ card: "summary_large_image", images: [cover] });
});

test("uses the approved banner as the preview image", () => {
  const head = EventMetadata({ ...EVENT, banner: { url: BANNER, thumbhash: "x" } }, PAGE);
  expect(head.openGraph?.images).toEqual([{ url: BANNER, alt: EVENT.title }]);
  expect(head.twitter).toMatchObject({ card: "summary_large_image", images: [{ url: BANNER, alt: EVENT.title }] });
});

test("uses the generated picture while the banner is under review", () => {
  const head = EventMetadata({ ...EVENT, banner: { thumbhash: "x" } }, PAGE);
  expect(head.openGraph?.images).toEqual([{ url: `${PAGE}/capa`, width: 1200, height: 630, alt: EVENT.title }]);
});

test("leaves og:url and the generated picture out when the site address is unknown", () => {
  const head = EventMetadata(EVENT, null);
  expect(head.openGraph).not.toHaveProperty("url");
  expect(head.openGraph?.images).toEqual([]);
  expect(head.twitter).toMatchObject({ card: "summary" });
});

test("fills the generated picture with the first day and cut texts", () => {
  const palette = { bg: "#000000", fg: "#ffffff", g1: "#111111", g2: "#222222", g3: "#333333" };
  const props = CoverPropsFor({ ...EVENT, title: "T".repeat(120) }, "UEFS", palette);
  expect(props.badge).toEqual({ day: "13", month: "nov" });
  expect(props.when).toBe("sexta-feira, 13 de novembro, às 08:00");
  expect(props.title.length).toBeLessThanOrEqual(90);
  expect(props.organization).toBe("UEFS");
  expect(CoverPropsFor({ ...EVENT, schedule: [] }, "UEFS", palette)).toMatchObject({ badge: null, when: null });
});

test("describes an event without a schedule by place and text only", () => {
  expect(EventMetadata({ ...EVENT, schedule: [] }, PAGE).description).toBe(
    "Auditório IV - módulo 6. Desafios do uso de antimicrobianos e estratégias para a Saúde Única.",
  );
});

test("counts the extra days of a long event", () => {
  expect(WhenText([{ date: "2026-11-14" }, { date: "2026-11-13", startTime: "08:00" }])).toBe("sexta-feira, 13 de novembro, às 08:00 (e mais 1 dia)");
  expect(WhenText([{ date: "2026-11-13" }, { date: "2026-11-14" }, { date: "2026-11-15" }])).toBe("sexta-feira, 13 de novembro (e mais 2 dias)");
  expect(WhenText([])).toBeNull();
});

test("cuts long descriptions at a word", () => {
  const long = "palavra ".repeat(60);
  const clipped = Clip(long, DESCRIPTION_LIMIT);
  expect(clipped.length).toBeLessThanOrEqual(DESCRIPTION_LIMIT);
  expect(clipped).toMatch(/palavra…$/);
  expect(Clip("  curta \n e direta ", DESCRIPTION_LIMIT)).toBe("curta e direta");
});
