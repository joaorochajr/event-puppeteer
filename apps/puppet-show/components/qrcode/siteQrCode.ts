/**
 * The QR code that takes people from a big screen to the site on their phone.
 *
 * Generated on the server with the `qrcode` package as an SVG string, so the
 * page loads nothing from outside. The address is the one the app is being
 * served from (see {@link RequestOrigin}); a missing or invalid address is
 * reported so the screen can say what went wrong.
 *
 * @module
 */

import QRCode from "qrcode";
import { Err, Ok, type Result } from "@/lib/result";

/** A ready QR code, or the reason (for the person) it couldn't be made. */
export type SiteQr = Result<{ url: string; svg: string }, string>;

/** Shown when the request does not say which host it was addressed to. */
export const MISSING_SITE_URL_MESSAGE =
  "Não foi possível descobrir o endereço do site: a requisição não informou o host.";

/**
 * The address the app is served from, taken from the request: the host the
 * client asked for (`x-forwarded-host` when a proxy sits in front, else
 * `host`) and the protocol the proxy reports in `x-forwarded-proto`. Without
 * that header no proxy terminated TLS, so the request reached the server as
 * plain `http`. When a header lists several values (a chain of proxies) the
 * first one, the client's own, is used.
 */
export function RequestOrigin(headers: Headers): Result<string, string> {
  const first = (name: string) => headers.get(name)?.split(",")[0]?.trim() || undefined;
  const host = first("x-forwarded-host") ?? first("host");
  if (host === undefined) return Err(MISSING_SITE_URL_MESSAGE);
  const origin = `${first("x-forwarded-proto") ?? "http"}://${host}`;
  if (!URL.canParse(origin)) return Err(`O endereço do site não é válido: "${origin}".`);
  return Ok(origin);
}

/** Builds the QR code for `url`, the address the app is served from. */
export async function SiteQrCode(url: string): Promise<SiteQr> {
  if (!URL.canParse(url)) return Err(`O endereço do site não é válido: "${url}".`);

  try {
    const svg = await QRCode.toString(url, {
      type: "svg",
      margin: 1,
      errorCorrectionLevel: "M",
      color: { dark: "#0b0b0f", light: "#ffffff" },
    });
    return Ok({ url, svg });
  } catch (cause) {
    return Err(`Não foi possível gerar o QR Code: ${cause instanceof Error ? cause.message : String(cause)}`);
  }
}
