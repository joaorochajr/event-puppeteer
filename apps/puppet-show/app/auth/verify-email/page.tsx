/**
 * Email confirmation: `/auth/verify-email?token=…`, opened from the verification email.
 *
 * @module
 */

import { Suspense } from "react";
import { VerifyEmailLinkContainer } from "@/components/forms/containers/VerifyEmailLinkContainer";
import { LoadingMessage } from "@/components/ui/Feedback";

export const metadata = { title: "Confirmar e-mail" };

/** The container reads the token from the query string (`useSearchParams`), so it renders inside `Suspense`. */
export default function VerifyEmailPage() {
  return (
    <main className="center flex-1 px-4 py-12 sm:px-6">
      <Suspense fallback={<LoadingMessage>Carregando...</LoadingMessage>}>
        <VerifyEmailLinkContainer />
      </Suspense>
    </main>
  );
}
