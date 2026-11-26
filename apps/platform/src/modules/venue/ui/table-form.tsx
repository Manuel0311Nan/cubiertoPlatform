"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef } from "react";
import { es } from "@/i18n/es";
import { Alert, FieldError } from "@/ui/forms/field-error";
import { SubmitButton } from "@/ui/forms/submit-button";
import { useUserInvalidAria } from "@/ui/forms/use-user-invalid-aria";
import { MAX_SEATS, TABLES_PATH, type TableField } from "../domain/tables";
import { saveTableAction, type TableFormState, type TableFormValues } from "../table-actions";

const t = es.settings.tables;

/** PLT-05: alta o edición de una mesa. */
export function TableForm({ editing }: { editing: ({ id: string } & TableFormValues) | null }) {
  const initial: TableFormValues = editing ?? { label: "", zone: "", minSeats: "1", maxSeats: "4" };
  const [state, formAction] = useActionState<TableFormState, FormData>(saveTableAction, { status: "idle", values: initial });
  const formRef = useRef<HTMLFormElement>(null);
  const announcerRef = useRef<HTMLDivElement>(null);
  useUserInvalidAria(formRef, announcerRef);

  const invalid = (field: TableField) => state.status === "invalid" && state.fields.includes(field);
  const v = state.values;

  useEffect(() => {
    if (state.status === "invalid") formRef.current?.querySelector<HTMLElement>('[data-server-invalid="true"]')?.focus();
  }, [state]);

  const labelError = state.status === "invalid" && state.labelTaken ? t.labelTaken : t.labelError;
  const maxError = state.status === "invalid" && state.maxBelowMin ? t.maxBelowMin : t.seatsError;
  const titleId = "table-form-title";

  const field = (name: TableField) => ({
    id: `table-${name}`,
    name,
    defaultValue: v[name],
    "aria-invalid": invalid(name) ? ("true" as const) : ("false" as const),
    "data-error": `table-${name}-error`,
    "data-server-invalid": invalid(name) ? "true" : undefined,
    className: "input",
  });

  return (
    <form ref={formRef} action={formAction} aria-labelledby={titleId} className="flex flex-col gap-4 rounded-2xl border border-line bg-white p-4 md:p-5">
      <h2 id={titleId} className="text-[1.25rem] font-[750] tracking-[-0.02em]">
        {editing ? t.editTitle(editing.label) : t.newTitle}
      </h2>
      {editing ? <input type="hidden" name="id" value={editing.id} /> : null}
      {state.status === "invalid" ? <Alert>{es.settings.formError}</Alert> : null}

      <div className="grid gap-4 md:grid-cols-2">
        <div className="field flex flex-col gap-1.5">
          <label htmlFor="table-label" className="text-sm font-[650]">
            {t.label}
            <span aria-hidden="true"> *</span>
          </label>
          <input {...field("label")} type="text" required maxLength={20} autoComplete="off" aria-describedby="table-label-hint" />
          <FieldError id="table-label-error">{labelError}</FieldError>
          <p id="table-label-hint" className="text-[0.8125rem] text-mute">
            {t.labelHint}
          </p>
        </div>
        <div className="field flex flex-col gap-1.5">
          <label htmlFor="table-zone" className="text-sm font-[650]">
            {t.zone}
          </label>
          <input {...field("zone")} type="text" maxLength={40} autoComplete="off" aria-describedby="table-zone-hint" />
          <p id="table-zone-hint" className="text-[0.8125rem] text-mute">
            {t.zoneHint}
          </p>
        </div>
        <div className="field flex flex-col gap-1.5">
          <label htmlFor="table-minSeats" className="text-sm font-[650]">
            {t.minSeats}
            <span aria-hidden="true"> *</span>
          </label>
          <input {...field("minSeats")} type="number" inputMode="numeric" required min={1} max={MAX_SEATS} className="input w-[8rem]" />
          <FieldError id="table-minSeats-error">{t.seatsError}</FieldError>
        </div>
        <div className="field flex flex-col gap-1.5">
          <label htmlFor="table-maxSeats" className="text-sm font-[650]">
            {t.maxSeats}
            <span aria-hidden="true"> *</span>
          </label>
          <input {...field("maxSeats")} type="number" inputMode="numeric" required min={1} max={MAX_SEATS} className="input w-[8rem]" />
          <FieldError id="table-maxSeats-error">{maxError}</FieldError>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton className="btn btn-primary" pendingLabel={es.settings.saving}>
          {editing ? t.save : t.create}
        </SubmitButton>
        {editing ? (
          <Link href={TABLES_PATH} className="link px-2 py-2.5">
            {t.cancel}
          </Link>
        ) : null}
      </div>
      <div ref={announcerRef} aria-live="polite" className="sr-only" />
    </form>
  );
}
