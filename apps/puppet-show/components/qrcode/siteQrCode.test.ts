import { expect, test } from "vitest";
import { MISSING_SITE_URL_MESSAGE, RequestOrigin, SiteQrCode } from "./siteQrCode";

test("builds an SVG QR code for the address", async () => {
  const qr = await SiteQrCode("http://vemai.akare.com.br");
  expect(qr.ok).toBe(true);
  if (qr.ok) {
    expect(qr.value.url).toBe("http://vemai.akare.com.br");
    expect(qr.value.svg).toMatch(/^<svg[\s\S]*<\/svg>\s*$/);
  }
});

test("an invalid address is reported", async () => {
  const qr = await SiteQrCode("not a url");
  expect(qr.ok).toBe(false);
});

test("the origin is the host the request was made to", () => {
  expect(RequestOrigin(new Headers({ host: "localhost:3000" }))).toEqual({ ok: true, value: "http://localhost:3000" });
});

test("a proxy's forwarded host and protocol win", () => {
  const headers = new Headers({ host: "internal:3000", "x-forwarded-host": "vemai.akare.com.br", "x-forwarded-proto": "https" });
  expect(RequestOrigin(headers)).toEqual({ ok: true, value: "https://vemai.akare.com.br" });
});

test("a chain of proxies uses the first value", () => {
  const headers = new Headers({ "x-forwarded-host": "vemai.akare.com.br, edge.internal", "x-forwarded-proto": "https, http" });
  expect(RequestOrigin(headers)).toEqual({ ok: true, value: "https://vemai.akare.com.br" });
});

test("a request without host is reported, never replaced", () => {
  expect(RequestOrigin(new Headers())).toEqual({ ok: false, error: MISSING_SITE_URL_MESSAGE });
});
