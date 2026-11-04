/**
 * The site's QR code for the request being served: the address is read from
 * the request itself, so it is right in every environment (production domain,
 * preview deployments, a phone on the local network) without configuration.
 *
 * @module
 */

import { headers } from "next/headers";
import { RequestOrigin, SiteQrCode, type SiteQr } from "./siteQrCode";

/** Builds the QR code for the address this request was made to. Reading the headers makes the page dynamic. */
export async function RequestSiteQrCode(): Promise<SiteQr> {
  const origin = RequestOrigin(await headers());
  if (!origin.ok) return origin;
  return SiteQrCode(origin.value);
}
