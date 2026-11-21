"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef } from "react";
import { es } from "@/i18n/es";
import { useUserInvalidAria } from "@/ui/forms/use-user-invalid-aria";
import { requestSignInLinkAction, type SignInFormState } from "../actions";

const t = es.signIn;

function ErrorIcon() {
  return (
    <svg role="img" aria-label={t.errorLabel} viewBox="0 0 20 20" width="18" height="18" className="shrink-0">
      <circle cx="10" cy="10" r="9" fill="currentColor" />
      <path d="M10 5.5v5.5M10 14.2v.3" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}

/** PLT-02 · D5/M10: pedir el enlace y, después, "Revisa tu correo". */
export function SignInForm({ linkInvalid }: { linkInvalid: boolean }) {
  const [state, formAction, pending] = useActionState<SignInFormState, FormData>(requestSignInLinkAction, {
    status: "idle",
    email: "",
  });

  if (state.status === "sent") {
    return <CheckEmail state={state} formAction={formAction} pending={pending} />;
  }
  return <EmailStep state={state} formAction={formAction} pending={pending} linkInvalid={linkInvalid} />;
}

interface StepProps {
  formAction: (formData: FormData) => void;
  pending: boolean;
}

function EmailStep({ state, formAction, pending, linkInvalid }: StepProps & { state: SignInFormState; linkInvalid: boolean }) {
  const formRef = useRef<HTMLFormElement>(null);
  const announcerRef = useRef<HTMLDivElement>(null);
  useUserInvalidAria(formRef, announcerRef);

  const serverInvalid = state.status === "invalid";
  const alertMessage = state.status === "failed" ? t.sendFailed : linkInvalid ? t.linkInvalid : null;

  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-[2.125rem] leading-[1.05] font-[750] tracking-[-0.03em] md:text-[2.375rem]">{t.title}</h1>
      <p className="text-base leading-normal text-mute">{t.intro}</p>

      {alertMessage ? (
        <p role="alert" className="flex items-start gap-2 rounded-xl border-2 border-tomato bg-tomato-soft p-3 text-sm leading-snug text-tomato-ink">
          <ErrorIcon />
          <span>{alertMessage}</span>
        </p>
      ) : null}

      <form ref={formRef} action={formAction} className="flex flex-col gap-5">
        <div className="field flex flex-col gap-1.5">
          <label htmlFor="email" className="text-sm font-[650]">
            {t.emailLabel}
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="username"
            required
            maxLength={254}
            spellCheck={false}
            autoCapitalize="none"
            autoCorrect="off"
            enterKeyHint="send"
            defaultValue={state.email}
            aria-invalid={serverInvalid ? "true" : "false"}
            aria-describedby={serverInvalid ? "email-error" : undefined}
            data-error="email-error"
            data-server-invalid={serverInvalid ? "true" : undefined}
            className="input"
          />
          <p id="email-error" className="field-error items-start gap-1.5 text-sm leading-snug text-tomato-ink">
            <ErrorIcon />
            <span>{t.emailError}</span>
          </p>
        </div>

        <button type="submit" disabled={pending} className="btn btn-primary btn-lg w-full">
          {pending ? t.submitting : t.submit}
        </button>
        <p className="text-[0.8125rem] leading-snug text-mute">{t.hint}</p>
        <div ref={announcerRef} aria-live="polite" className="sr-only" />
      </form>
    </div>
  );
}

function CheckEmail({ state, formAction, pending }: StepProps & { state: Extract<SignInFormState, { status: "sent" }> }) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    // El contenido cambia sin cambiar de página: el foco va al nuevo título para que se lea.
    if (!state.resent) headingRef.current?.focus();
  }, [state.resent]);

  return (
    <div className="flex flex-col gap-5">
      <svg width="96" height="80" viewBox="0 0 96 80" aria-hidden="true">
        <rect x="4" y="10" width="88" height="62" rx="10" fill="#fff" stroke="currentColor" strokeWidth="3" />
        <path d="M6 14l42 32 42-32" fill="none" stroke="currentColor" strokeWidth="3" strokeLinejoin="round" />
        <circle cx="82" cy="12" r="10" fill="var(--saffron)" />
      </svg>
      <h1 ref={headingRef} tabIndex={-1} className="text-[2.125rem] leading-[1.05] font-[750] tracking-[-0.03em] outline-none">
        {t.checkTitle}
      </h1>
      <p className="text-base leading-normal">
        {t.checkBodyBefore}
        <b className="break-all">{state.email}</b>
        {t.checkBodyAfter}
      </p>
      <p className="text-[0.8125rem] leading-snug text-mute">{t.checkHint}</p>

      <div className="flex flex-col gap-2 pt-4">
        <form action={formAction}>
          <input type="hidden" name="email" value={state.email} />
          <button type="submit" disabled={pending} className="btn btn-lg w-full">
            {pending ? t.resending : t.resend}
          </button>
        </form>
        <p role="status" className="min-h-5 text-center text-sm text-mute">
          {state.resent && !pending ? t.resent : ""}
        </p>
        <Link href="/entrar" className="link self-center px-2.5 py-2.5">
          {t.otherEmail}
        </Link>
      </div>
    </div>
  );
}
