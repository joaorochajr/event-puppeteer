/**
 * What the page the verification email links to shows: the confirmation in
 * progress, its result, and, when the link is no good, a way to ask for a new one.
 *
 * @module
 */

"use client";

import { useId, useState, type FormEvent } from "react";
import Link from "next/link";
import { ErrorAlert, LoadingMessage, StatusMessage } from "@/components/ui/Feedback";
import { ValidateEmail } from "@/utils/validation/UserValidation";
import { AUTH_CARD, AUTH_FIELD, AUTH_FIELD_ERROR, AUTH_INPUT, AUTH_LABEL, AUTH_SUBMIT, AUTH_TITLE } from "./auth-styles";

/** Where the confirmation stands. */
export type VerifyEmailLinkStatus =
  /** The token is being sent to the API. */
  | "verifying"
  /** The email is confirmed. */
  | "verified"
  /** The link is invalid or expired. */
  | "invalid"
  /** The page was opened without a token (a truncated link). */
  | "missing-token"
  /** The API could not be asked, or answered with an unexpected error. */
  | "failed";

export type VerifyEmailLinkProps = {
  status: VerifyEmailLinkStatus;
  /** Why the confirmation failed (`failed` only). */
  error: string;
  /** While a new link is requested. */
  resending: boolean;
  /** A new link was requested; said the same whether or not the address has an account. */
  resent: boolean;
  /** Why requesting the new link failed. */
  resendError: string;
  /** Asks again after a `failed` confirmation. */
  onRetry: () => void;
  onResend: (email: string) => void;
};

/** The card of the page; an unusable link offers an email field to get a new one. */
export function VerifyEmailLink({ status, error, resending, resent, resendError, onRetry, onResend }: VerifyEmailLinkProps) {
  const ids = { title: useId(), email: useId() };
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);

  const handleResend = (event: FormEvent) => {
    event.preventDefault();
    const found = ValidateEmail(email);
    setEmailError(found);
    if (found === null) onResend(email.trim());
  };

  return (
    <section className={AUTH_CARD} aria-labelledby={ids.title}>
      <h1 id={ids.title} className={AUTH_TITLE}>Confirmação de e-mail</h1>

      {status === "verifying" && <LoadingMessage>Confirmando seu e-mail...</LoadingMessage>}

      {status === "verified" && (
        <>
          <StatusMessage>E-mail confirmado. Agora você já pode entrar.</StatusMessage>
          <Link href="/entrar" className={`${AUTH_SUBMIT} focus-ring`}>Ir para o login</Link>
        </>
      )}

      {status === "failed" && (
        <>
          <ErrorAlert>{error}</ErrorAlert>
          <button type="button" onClick={onRetry} className={AUTH_SUBMIT}>Tentar de novo</button>
        </>
      )}

      {(status === "invalid" || status === "missing-token") && (
        <>
          <ErrorAlert>
            {status === "invalid"
              ? "Este link é inválido ou expirou."
              : "O link de confirmação está incompleto. Abra o link exatamente como chegou no e-mail."}
          </ErrorAlert>

          {resent ? (
            <StatusMessage>Se o e-mail estiver cadastrado, enviamos um novo link de confirmação. Confira também a caixa de spam.</StatusMessage>
          ) : (
            <form onSubmit={handleResend} noValidate className="column gap-4">
              <p className="t2">Informe o e-mail da sua conta para receber um novo link.</p>

              <div className={AUTH_FIELD}>
                <label htmlFor={ids.email} className={AUTH_LABEL}>E-mail</label>
                <input
                  id={ids.email}
                  type="email"
                  value={email}
                  disabled={resending}
                  onChange={(event) => setEmail(event.target.value)}
                  className={`${AUTH_INPUT} ${emailError !== null ? "input-error" : ""}`}
                  placeholder="voce@email.com"
                  autoComplete="email"
                  aria-invalid={emailError !== null}
                  aria-describedby={emailError !== null ? `${ids.email}-error` : undefined}
                />
                {emailError !== null && <span id={`${ids.email}-error`} className={AUTH_FIELD_ERROR}>{emailError}</span>}
              </div>

              <ErrorAlert>{resendError}</ErrorAlert>

              <button type="submit" disabled={resending} className={AUTH_SUBMIT}>
                {resending ? "Enviando..." : "Enviar novo link"}
              </button>
            </form>
          )}

          <Link href="/entrar" className="button ghost text-fg-2 focus-ring">Voltar para o login</Link>
        </>
      )}
    </section>
  );
}
