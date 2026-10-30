/**
 * Reads what an anonymous visitor may see, from the server.
 *
 * The browser client (`./client`) goes through the `/api` proxy and sends the
 * session token kept in `localStorage`; neither exists while Next renders on
 * the server. These calls go to Puppeteer directly (`PUPPETEER_URL`) without a
 * session, so what they return is exactly what a link preview may show:
 * nothing hidden, nothing from another organization.
 *
 * Nothing here throws: every outcome is a {@link Result}.
 *
 * @module
 */

import type { z } from "zod";
import { Err, Ok, type Result } from "@/lib/result";
import { EventWithVotesSchema, OrganizationSchema, type EventWithVotes, type Organization } from "./schemas";
import { MISSING_ORG_MESSAGE, PUBLIC_ORG_ID } from "./session";

/** Text of a rejected promise. */
function Cause(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause);
}

/**
 * GETs `path` from Puppeteer without a session: the body when it matches
 * `schema`, `null` when the API answers 404, or why it couldn't be read.
 */
async function PublicGet<S extends z.ZodType>(schema: S, path: string): Promise<Result<z.infer<S> | null, string>> {
  const base = process.env.PUPPETEER_URL;
  if (base === undefined || base === "") return Err("PUPPETEER_URL não definida.");

  let response: Response;
  try {
    response = await fetch(`${base}${path}`);
  } catch (cause) {
    return Err(`Sem resposta de ${path}: ${Cause(cause)}`);
  }
  if (response.status === 404) return Ok(null);
  if (!response.ok) return Err(`${path} respondeu ${response.status}.`);

  let body: unknown;
  try {
    body = await response.json();
  } catch (cause) {
    return Err(`${path} respondeu um JSON inválido: ${Cause(cause)}`);
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return Err(`${path} respondeu fora do contrato: ${parsed.error.message}`);
  return Ok(parsed.data);
}

/**
 * The event as the public sees it, in the public organization
 * ({@link PUBLIC_ORG_ID}); `null` when the public can't see it (the API answers
 * 404 for missing, deleted, hidden and other-organization events).
 */
export function PublicEvent(eventId: string): Promise<Result<EventWithVotes | null, string>> {
  if (PUBLIC_ORG_ID === null) return Promise.resolve(Err(MISSING_ORG_MESSAGE));
  const path = `/organizations/${encodeURIComponent(PUBLIC_ORG_ID)}/events/${encodeURIComponent(eventId)}`;
  return PublicGet(EventWithVotesSchema, path);
}

/** An organization's public profile (name, color, logo); `null` when it doesn't exist. */
export function PublicOrganization(orgId: string): Promise<Result<Organization | null, string>> {
  return PublicGet(OrganizationSchema, `/organizations/${encodeURIComponent(orgId)}`);
}
