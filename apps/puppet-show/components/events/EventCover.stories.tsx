import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect } from "storybook/test";
import { DarkPaletteFor } from "@/lib/theme/oklch";
import { EventCover } from "./EventCover";

/** `#2563eb` (blue) and `#f59e0b` (the app's default amber) in OKLCH. */
const BLUE = { l: 0.546, c: 0.215, h: 262.9 };
const AMBER = { l: 0.769, c: 0.165, h: 70.1 };

/**
 * The 1200×630 picture link previews show for an event without a banner. The
 * server draws it with Satori, which embeds Bricolage Grotesque for the title;
 * here the browser draws it with the page's fonts.
 */
const meta = {
  title: "Components/Events/EventCover",
  component: EventCover,
  tags: ["autodocs"],
  parameters: { layout: "fullscreen" },
  args: {
    title: "Uso Racional de Antimicrobianos",
    badge: { day: "13", month: "nov" },
    when: "sexta-feira, 13 de novembro, às 08:00",
    location: "Auditório IV - módulo 6 - UEFS",
    organization: "UEFS",
    palette: DarkPaletteFor(BLUE),
  },
} satisfies Meta<typeof EventCover>;

export default meta;
type Story = StoryObj<typeof meta>;

/** A one-day event: date tile, title, when, where and the site's signature. */
export const OneDay: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByText("13")).toBeVisible();
    await expect(canvas.getByText("nov")).toBeVisible();
    await expect(canvas.getByText("Uso Racional de Antimicrobianos")).toBeVisible();
    await expect(canvas.getByText("sexta-feira, 13 de novembro, às 08:00")).toBeVisible();
    await expect(canvas.getByText("Mural de Eventos · UEFS")).toBeVisible();
  },
};

/** No schedule yet: no tile and no date line; the title takes the row. */
export const NoDate: Story = {
  args: { badge: null, when: null },
  play: async ({ canvas }) => {
    await expect(canvas.queryByText("nov")).toBeNull();
    await expect(canvas.getByText("Uso Racional de Antimicrobianos")).toBeVisible();
  },
};

/** A long title shrinks so three lines still fit; the organization's own color tints the gradient. */
export const LongTitleOtherColor: Story = {
  args: {
    title: "Semana Acadêmica de Engenharia de Computação: inteligência artificial, robótica e…",
    location: "Anfiteatro - Módulo 2",
    palette: DarkPaletteFor(AMBER),
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByText(/Semana Acadêmica/)).toHaveStyle({ fontSize: "56px" });
  },
};
