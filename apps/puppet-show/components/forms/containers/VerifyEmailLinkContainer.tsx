/**
 * Confirms the email with the token of the emailed link
 * (`/auth/verify-email?token=…`) as soon as the page opens, and requests a
 * new link when that one is no good.
 *
 * @module
 */

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { api, ApiErrorMessage } from "@/lib/api/client";
import { VerifyEmailLink, type VerifyEmailLinkStatus } from "../VerifyEmailLink";

/** Reads the token from the URL, sends it to the API once and shows the result. */
export function VerifyEmailLinkContainer() {
  const token = useSearchParams().get("token");
  const hasToken = token !== null && token !== "";
  const [status, setStatus] = useState<VerifyEmailLinkStatus>(hasToken ? "verifying" : "missing-token");
  const [error, setError] = useState("");
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);
  const [resendError, setResendError] = useState("");
  /** Keeps development's double effect run (Strict Mode) from sending the token twice. */
  const started = useRef(false);

  const verify = useCallback(async (value: string) => {
    setStatus("verifying");
    setError("");
    const answer = await api.auth.verifyEmail(value);
    if (answer.ok) {
      setStatus("verified");
      return;
    }
    if (answer.error.kind === "http" && answer.error.status === 400) {
      setStatus("invalid");
      return;
    }
    setError(`Não foi possível confirmar o e-mail. ${ApiErrorMessage(answer.error)}`);
    setStatus("failed");
  }, []);

  useEffect(() => {
    if (!hasToken || started.current) return;
    started.current = true;
    void verify(token);
  }, [hasToken, token, verify]);

  const handleResend = async (email: string) => {
    setResending(true);
    setResendError("");
    const answer = await api.auth.resendVerification(email);
    setResending(false);
    if (!answer.ok) {
      setResendError(`Não foi possível enviar o novo link. ${ApiErrorMessage(answer.error)}`);
      return;
    }
    setResent(true);
  };

  return (
    <VerifyEmailLink
      status={status}
      error={error}
      resending={resending}
      resent={resent}
      resendError={resendError}
      onRetry={() => { if (hasToken) void verify(token); }}
      onResend={(email) => void handleResend(email)}
    />
  );
}
