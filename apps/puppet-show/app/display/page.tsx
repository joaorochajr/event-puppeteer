/**
 * TV display (kiosk mode): `/display`. Meant for screens in public spaces;
 * the site's navigation bar is not shown here.
 *
 * @module
 */

import type { Metadata } from "next";
import { RequestSiteQrCode } from "@/components/qrcode/requestSiteQrCode";
import { TvDisplayContainer } from "@/components/tv/TvDisplayContainer";

export const metadata: Metadata = {
  title: "Modo TV | Vem aí",
};

/** Reads the address from each request, so the QR code is always where the app is served. */
export const dynamic = "force-dynamic";

/** Builds the QR code on the server and hands it to the live display. */
export default async function TvDisplayPage() {
  return <TvDisplayContainer qr={await RequestSiteQrCode()} />;
}
