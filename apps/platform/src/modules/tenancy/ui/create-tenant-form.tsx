"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { es } from "@/i18n/es";
import { SubmitButton } from "@/ui/forms/submit-button";
import { useUserInvalidAria } from "@/ui/forms/use-user-invalid-aria";
import { createTenantAction, type CreateTenantFormState } from "../actions";
import { ACTIVATION_REASON_MAX_LENGTH, MODULE_KEYS, TENANT_NAME_MAX_LENGTH, type CreateTenantField } from "../domain/create-tenant";
import { SLUG_MAX_LENGTH, SLUG_MIN_LENGTH, suggestSlug } from "../domain/slug";

const t = es.admin.createTenant;

/** El mismo patrón que valida el servidor (tenancy/domain/slug.ts), para avisar antes de enviar. */
const SLUG_HTML_PATTERN = "[a-z0-9](?:[a-z0-9\\-]*[a-z0-9])?";

const initialState: CreateTenantFormState = {
  status: "idle",
  values: { name: "", slug: "", ownerEmail: "", modules: [], reason: "" },
};

function ErrorIcon() {
  return (
    <svg role="img" aria-label={es.signIn.errorLabel} viewBox="0 0 20 20" width="18" height="18" className="shrink-0">
      <circle cx="10" cy="10" r="9" fill="currentColor" />
      <path d="M10 5.5v5.5M10 14.2v.3" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}

function FieldError({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <p id={id} className="field-error items-start gap-1.5 text-sm leading-snug text-tomato-ink">
      <ErrorIcon />
      <span>{children}</span>
    </p>
  );
}

function Required() {
  return <span aria-hidden="true"> *</span>;
}

/** PLT-01 · D22: formulario de alta. Funciona sin JavaScript; con él, sugiere el slug desde el nombre. */
export function CreateTenantForm({ platformDomain }: { platformDomain: string }) {
  const [state, formAction] = useActionState(createTenantAction, initialState);
  const formRef = useRef<HTMLFormElement>(null);
  const announcerRef = useRef<HTMLDivElement>(null);
  const slugRef = useRef<HTMLInputElement>(null);
  useUserInvalidAria(formRef, announcerRef);

  const { values } = state;
  const serverInvalid = (field: CreateTenantField) => state.status === "invalid" && state.fields.includes(field);

  // El slug sigue al nombre hasta que alguien lo escribe a mano (PLT-01: "sugerido desde el nombre, editable").
  const slugEdited = useRef(values.slug !== "" && values.slug !== suggestSlug(values.name));
  // El motivo solo es obligatorio si se activa algún módulo sin pago.
  const [anyModule, setAnyModule] = useState(values.modules.length > 0);
  // El texto del error del slug que dio el servidor (reservado, ya usado…) hasta que se corrige.
  const [slugServerError, setSlugServerError] = useState<string | null>(null);

  useEffect(() => {
    setAnyModule(state.values.modules.length > 0);
    setSlugServerError(state.status === "invalid" ? state.slugError : null);
    // Tras un error del servidor, el foco va al primer campo marcado (guía `forms`).
    if (state.status === "invalid") {
      formRef.current?.querySelector<HTMLElement>('[data-server-invalid="true"]')?.focus();
    }
  }, [state]);

  const slugError = slugServerError ? (t.slugErrors[slugServerError] ?? t.slugErrorDefault) : t.slugErrors.SLUG_INVALID_FORMAT;

  const describedBy = (field: CreateTenantField, ...ids: string[]) =>
    [...ids, ...(serverInvalid(field) ? [`${field}-error`] : [])].join(" ") || undefined;

  return (
    <form ref={formRef} action={formAction} aria-describedby="required-note" className="flex flex-col gap-6">
      <p id="required-note" className="text-sm text-mute">
        {t.requiredNote}
      </p>

      {state.status === "invalid" ? (
        <p role="alert" className="flex items-start gap-2 rounded-xl border-2 border-tomato bg-tomato-soft p-3 text-sm leading-snug text-tomato-ink">
          <ErrorIcon />
          <span>{t.formError}</span>
        </p>
      ) : null}

      <div className="field flex flex-col gap-1.5">
        <label htmlFor="name" className="text-sm font-[650]">
          {t.nameLabel}
          <Required />
        </label>
        <input
          id="name"
          name="name"
          type="text"
          required
          minLength={2}
          maxLength={TENANT_NAME_MAX_LENGTH}
          autoComplete="organization"
          defaultValue={values.name}
          onInput={(event) => {
            const slug = slugRef.current;
            if (slug && !slugEdited.current) slug.value = suggestSlug(event.currentTarget.value);
          }}
          aria-invalid={serverInvalid("name") ? "true" : "false"}
          aria-describedby={describedBy("name")}
          data-error="name-error"
          data-server-invalid={serverInvalid("name") ? "true" : undefined}
          className="input"
        />
        <FieldError id="name-error">{t.nameError}</FieldError>
      </div>

      <div className="field flex flex-col gap-1.5">
        <label htmlFor="slug" className="text-sm font-[650]">
          {t.slugLabel}
          <Required />
        </label>
        <input
          ref={slugRef}
          id="slug"
          name="slug"
          type="text"
          required
          minLength={SLUG_MIN_LENGTH}
          maxLength={SLUG_MAX_LENGTH}
          pattern={SLUG_HTML_PATTERN}
          autoComplete="off"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          defaultValue={values.slug}
          onInput={(event) => {
            slugEdited.current = event.currentTarget.value !== "";
            setSlugServerError(null);
          }}
          aria-invalid={serverInvalid("slug") ? "true" : "false"}
          aria-describedby={describedBy("slug", "slug-hint")}
          data-error="slug-error"
          data-server-invalid={serverInvalid("slug") ? "true" : undefined}
          className="input"
        />
        <FieldError id="slug-error">{slugError}</FieldError>
        <p id="slug-hint" className="text-[0.8125rem] leading-snug text-mute">
          {t.slugHint(platformDomain)}
        </p>
      </div>

      <div className="field flex flex-col gap-1.5">
        <label htmlFor="ownerEmail" className="text-sm font-[650]">
          {t.ownerEmailLabel}
          <Required />
        </label>
        <input
          id="ownerEmail"
          name="ownerEmail"
          type="email"
          required
          maxLength={254}
          autoComplete="off"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          defaultValue={values.ownerEmail}
          aria-invalid={serverInvalid("ownerEmail") ? "true" : "false"}
          aria-describedby={describedBy("ownerEmail", "ownerEmail-hint")}
          data-error="ownerEmail-error"
          data-server-invalid={serverInvalid("ownerEmail") ? "true" : undefined}
          className="input"
        />
        <FieldError id="ownerEmail-error">{t.ownerEmailError}</FieldError>
        <p id="ownerEmail-hint" className="text-[0.8125rem] leading-snug text-mute">
          {t.ownerEmailHint}
        </p>
      </div>

      <fieldset
        className="flex flex-col gap-1"
        aria-describedby={serverInvalid("modules") ? "modules-hint modules-error" : "modules-hint"}
        onChange={(event) => {
          setAnyModule(event.currentTarget.querySelector('input[name="modules"]:checked') !== null);
        }}
      >
        <legend className="text-sm font-[650]">{t.modulesLegend}</legend>
        <p id="modules-hint" className="mb-1 text-[0.8125rem] leading-snug text-mute">
          {t.modulesHint}
        </p>
        {MODULE_KEYS.map((key) => (
          <label key={key} className="check">
            <input type="checkbox" name="modules" value={key} defaultChecked={values.modules.includes(key)} />
            <span>
              <b className="font-[650]">{es.modules[key].name}</b>
              <span className="block text-sm text-mute">{es.modules[key].detail}</span>
            </span>
          </label>
        ))}
        {serverInvalid("modules") ? (
          <p id="modules-error" className="flex items-start gap-1.5 text-sm leading-snug text-tomato-ink">
            <ErrorIcon />
            <span>{t.modulesError}</span>
          </p>
        ) : null}
      </fieldset>

      <div className="field flex flex-col gap-1.5">
        <label htmlFor="reason" className="text-sm font-[650]">
          {t.reasonLabel}
          {anyModule ? <Required /> : null}
        </label>
        <input
          id="reason"
          name="reason"
          type="text"
          required={anyModule}
          minLength={3}
          maxLength={ACTIVATION_REASON_MAX_LENGTH}
          defaultValue={values.reason}
          aria-invalid={serverInvalid("reason") ? "true" : "false"}
          aria-describedby={describedBy("reason", "reason-hint")}
          data-error="reason-error"
          data-server-invalid={serverInvalid("reason") ? "true" : undefined}
          className="input"
        />
        <FieldError id="reason-error">{t.reasonError}</FieldError>
        <p id="reason-hint" className="text-[0.8125rem] leading-snug text-mute">
          {t.reasonHint}
        </p>
      </div>

      <SubmitButton className="btn btn-primary btn-lg self-start" pendingLabel={t.submitting}>
        {t.submit}
      </SubmitButton>
      <div ref={announcerRef} aria-live="polite" className="sr-only" />
    </form>
  );
}
