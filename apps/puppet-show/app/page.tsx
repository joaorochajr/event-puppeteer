/**
 * Home page: the public feed of events.
 *
 * @module
 */

import { HomeContainer } from "@/components/home/containers/HomeContainer";
import { RequestSiteQrCode } from "@/components/qrcode/requestSiteQrCode";

/** Reads the address from each request, so the QR code is always where the app is served. */
export const dynamic = "force-dynamic";

/** Builds the QR code on the server and hands it to the live feed. */
export default async function HomePage() {
  return <HomeContainer qr={await RequestSiteQrCode()} />;
}
