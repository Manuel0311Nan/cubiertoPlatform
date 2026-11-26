"use client";

import { useActionState, useEffect, useRef } from "react";
import { es } from "@/i18n/es";
import { Alert, FieldError, Saved } from "@/ui/forms/field-error";
import { SubmitButton } from "@/ui/forms/submit-button";
import { useUserInvalidAria } from "@/ui/forms/use-user-invalid-aria";
import { updateVenueDetailsAction, type VenueDetailsFormState, type VenueDetailsFormValues } from "../actions";
import type { VenueDetailsField } from "../domain/venue-details";

const t = es.settings;
const v = es.settings.venue;

interface FieldSpec {
  name: VenueDetailsField;
  label: string;
  type: "text" | "tel" | "email";
  /** `section-venue`: son los datos del local, no los de quien rellena el formulario. */
  autoComplete: string;
  required?: boolean;
  maxLength: number;
  hint?: string;
  error?: string;
  inputMode?: "numeric";
  pattern?: string;
}

const FIELDS: FieldSpec[] = [
  { name: "name", label: v.name, type: "text", autoComplete: "section-venue organization", required: true, maxLength: 80, error: v.nameError },
  { name: "addressLine", label: v.addressLine, type: "text", autoComplete: "section-venue address-line1", maxLength: 160 },
  { name: "city", label: v.city, type: "text", autoComplete: "section-venue address-level2", maxLength: 80 },
  { name: "postalCode", label: v.postalCode, type: "text", autoComplete: "section-venue postal-code", maxLength: 5, inputMode: "numeric", pattern: "\\d{5}", error: v.postalCodeError },
  { name: "phone", label: v.phone, type: "tel", autoComplete: "section-venue tel", maxLength: 20, hint: v.phoneHint, error: v.phoneError },
  { name: "whatsappPhone", label: v.whatsappPhone, type: "tel", autoComplete: "off", maxLength: 20, hint: v.whatsappHint, error: v.phoneError },
  { name: "email", label: v.email, type: "email", autoComplete: "section-venue email", maxLength: 254, error: v.emailError },
];

/** PLT-04: datos del local. */
export function VenueDetailsForm({ initial }: { initial: VenueDetailsFormValues }) {
  const [state, formAction] = useActionState<VenueDetailsFormState, FormData>(updateVenueDetailsAction, { status: "idle", values: initial });
  const formRef = useRef<HTMLFormElement>(null);
  const announcerRef = useRef<HTMLDivElement>(null);
  useUserInvalidAria(formRef, announcerRef);

  const serverInvalid = (field: VenueDetailsField) => state.status === "invalid" && state.fields.includes(field);

  useEffect(() => {
    if (state.status === "invalid") formRef.current?.querySelector<HTMLElement>('[data-server-invalid="true"]')?.focus();
  }, [state]);

  return (
    <form ref={formRef} action={formAction} aria-labelledby="details-title" className="flex flex-col gap-5">
      {state.status === "invalid" ? <Alert>{t.formError}</Alert> : null}
      <div className="grid gap-5 md:grid-cols-2">
        {FIELDS.map((field) => {
          const invalid = serverInvalid(field.name);
          const describedBy = [field.hint ? `${field.name}-hint` : null, invalid ? `${field.name}-error` : null].filter(Boolean).join(" ");
          return (
            <div key={field.name} className={`field flex flex-col gap-1.5 ${field.name === "addressLine" ? "md:col-span-2" : ""}`}>
              <label htmlFor={field.name} className="text-sm font-[650]">
                {field.label}
                {field.required ? <span aria-hidden="true"> *</span> : null}
              </label>
              <input
                id={field.name}
                name={field.name}
                type={field.type}
                required={field.required}
                minLength={field.required ? 2 : undefined}
                maxLength={field.maxLength}
                inputMode={field.inputMode}
                pattern={field.pattern}
                autoComplete={field.autoComplete}
                spellCheck={field.type === "text" && field.name !== "postalCode" ? undefined : false}
                defaultValue={state.values[field.name]}
                // El formulario se vuelve a montar con lo guardado (ya normalizado) tras guardar.
                key={`${field.name}-${state.status === "saved" ? state.values[field.name] : "edit"}`}
                aria-invalid={invalid ? "true" : "false"}
                aria-describedby={describedBy || undefined}
                data-error={field.error ? `${field.name}-error` : undefined}
                data-server-invalid={invalid ? "true" : undefined}
                className="input"
              />
              {field.error ? <FieldError id={`${field.name}-error`}>{field.error}</FieldError> : null}
              {field.hint ? (
                <p id={`${field.name}-hint`} className="text-[0.8125rem] leading-snug text-mute">
                  {field.hint}
                </p>
              ) : null}
            </div>
          );
        })}
      </div>
      <div className="flex flex-wrap items-center gap-4">
        <SubmitButton className="btn btn-primary" pendingLabel={t.saving}>
          {t.save}
        </SubmitButton>
        <Saved show={state.status === "saved"}>{t.saved}</Saved>
      </div>
      <div ref={announcerRef} aria-live="polite" className="sr-only" />
    </form>
  );
}
