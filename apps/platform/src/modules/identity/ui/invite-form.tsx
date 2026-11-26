"use client";

import { useActionState, useEffect, useRef } from "react";
import { es } from "@/i18n/es";
import { Alert, FieldError } from "@/ui/forms/field-error";
import { SubmitButton } from "@/ui/forms/submit-button";
import { useUserInvalidAria } from "@/ui/forms/use-user-invalid-aria";
import { ROLES } from "../domain/team";
import { inviteMemberAction, type InviteFormState } from "../team-actions";

const t = es.settings.team;

/** PLT-03 (D19): invitar a alguien al equipo con su papel. */
export function InviteForm() {
  const [state, formAction] = useActionState<InviteFormState, FormData>(inviteMemberAction, { status: "idle", values: { email: "", role: "STAFF" } });
  const formRef = useRef<HTMLFormElement>(null);
  const announcerRef = useRef<HTMLDivElement>(null);
  useUserInvalidAria(formRef, announcerRef);

  const emailInvalid = state.status === "invalid" && state.code === "INVALID_EMAIL";
  const conflict = state.status === "invalid" && state.code !== "INVALID_EMAIL" ? state.code : null;

  useEffect(() => {
    if (state.status === "invalid") formRef.current?.querySelector<HTMLInputElement>("#invite-email")?.focus();
  }, [state]);

  return (
    <form ref={formRef} action={formAction} aria-labelledby="invite-title" className="flex flex-col gap-4 rounded-2xl border border-line bg-white p-4 md:p-5">
      <h2 id="invite-title" className="text-[1.25rem] font-[750] tracking-[-0.02em]">
        {t.inviteTitle}
      </h2>
      {conflict ? <Alert>{conflict === "ALREADY_MEMBER" ? t.alreadyMember : t.alreadyInvited}</Alert> : null}

      <div className="field flex max-w-[26rem] flex-col gap-1.5">
        <label htmlFor="invite-email" className="text-sm font-[650]">
          {t.email}
          <span aria-hidden="true"> *</span>
        </label>
        <input
          id="invite-email"
          name="email"
          type="email"
          required
          maxLength={254}
          autoComplete="off"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          defaultValue={state.values.email}
          aria-invalid={emailInvalid ? "true" : "false"}
          aria-describedby="invite-hint"
          data-error="invite-email-error"
          data-server-invalid={emailInvalid ? "true" : undefined}
          className="input"
        />
        <FieldError id="invite-email-error">{t.emailError}</FieldError>
        <p id="invite-hint" className="text-[0.8125rem] text-mute">
          {t.inviteHint}
        </p>
      </div>

      <fieldset className="flex flex-col gap-1">
        <legend className="text-sm font-[650]">{t.roleLegend}</legend>
        {ROLES.map((role) => (
          <label key={role} className="check">
            <input type="radio" name="role" value={role} defaultChecked={state.values.role === role} />
            <span>
              <b className="font-[650]">{t.roles[role].name}</b>
              <span className="block text-sm text-mute">{t.roles[role].can}</span>
            </span>
          </label>
        ))}
      </fieldset>

      <SubmitButton className="btn btn-primary self-start" pendingLabel={t.inviting}>
        {t.invite}
      </SubmitButton>
      <div ref={announcerRef} aria-live="polite" className="sr-only" />
    </form>
  );
}
