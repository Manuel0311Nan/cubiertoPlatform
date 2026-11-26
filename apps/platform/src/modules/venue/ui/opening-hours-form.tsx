"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { es } from "@/i18n/es";
import { Alert, Saved } from "@/ui/forms/field-error";
import { SubmitButton } from "@/ui/forms/submit-button";
import { updateOpeningHoursAction, type OpeningHoursFormState } from "../actions";
import { MAX_RANGES_PER_DAY, WEEKDAYS, type OpeningHours, type TimeRange, type Weekday } from "../domain/opening-hours";

const t = es.settings;
const h = es.settings.hours;

type Row = TimeRange & { key: number };

/**
 * PLT-04: horario semanal. Un grupo por día con sus franjas (`<input type="time">`); "Añadir franja"
 * y "Quitar" cambian las filas. Lo que se envía son los campos `hours.<día>.<n>.open|close`.
 */
export function OpeningHoursForm({ initial }: { initial: OpeningHours }) {
  const [state, formAction] = useActionState<OpeningHoursFormState, FormData>(updateOpeningHoursAction, { status: "idle" });
  const nextKey = useRef(0);
  const withKeys = (ranges: TimeRange[]): Row[] => ranges.map((range) => ({ ...range, key: nextKey.current++ }));
  const [days, setDays] = useState<Record<Weekday, Row[]>>(() =>
    Object.fromEntries(WEEKDAYS.map((day) => [day, withKeys(initial[day])])) as Record<Weekday, Row[]>,
  );
  const formRef = useRef<HTMLFormElement>(null);

  const errorFor = (day: Weekday) => (state.status === "invalid" ? state.errors.find((e) => e.day === day) : undefined);

  useEffect(() => {
    if (state.status !== "invalid") return;
    const first = state.errors[0];
    if (first) formRef.current?.querySelector<HTMLElement>(`#day-${first.day} input`)?.focus();
  }, [state]);

  const addRange = (day: Weekday) => {
    setDays((current) => ({ ...current, [day]: [...current[day], { open: "", close: "", key: nextKey.current++ }] }));
    // El foco va a la hora de apertura de la franja nueva.
    requestAnimationFrame(() => {
      const inputs = formRef.current?.querySelectorAll<HTMLInputElement>(`#day-${day} input[name$=".open"]`);
      inputs?.[inputs.length - 1]?.focus();
    });
  };

  // Campos controlados: React vacía los no controlados al volver de cada envío, y tras un error
  // se perdería lo escrito.
  const setTime = (day: Weekday, key: number, field: keyof TimeRange, value: string) => {
    setDays((current) => ({ ...current, [day]: current[day].map((row) => (row.key === key ? { ...row, [field]: value } : row)) }));
  };

  const removeRange = (day: Weekday, key: number) => {
    setDays((current) => ({ ...current, [day]: current[day].filter((row) => row.key !== key) }));
    requestAnimationFrame(() => formRef.current?.querySelector<HTMLElement>(`#day-${day} [data-add]`)?.focus());
  };

  return (
    <form ref={formRef} action={formAction} aria-labelledby="hours-title" className="flex flex-col gap-4">
      {state.status === "invalid" ? <Alert>{t.formError}</Alert> : null}
      <div className="flex flex-col divide-y divide-line rounded-2xl border border-line bg-white">
        {WEEKDAYS.map((day) => {
          const rows = days[day];
          const error = errorFor(day);
          const dayName = h.days[day];
          return (
            <fieldset key={day} id={`day-${day}`} aria-describedby={error ? `day-${day}-error` : undefined} className="px-4 py-3.5">
              {/* El legend va encima: no participa en rejillas ni en flex dentro de un fieldset. */}
              <legend className="float-left w-full font-[700]">
                {dayName}
                {rows.length === 0 ? <span className="ms-2 font-normal text-mute">· {h.closed}</span> : null}
              </legend>
              <div className="clear-both flex flex-col gap-2 pt-2">
                {rows.map((row, index) => (
                  <div key={row.key} className="flex flex-wrap items-end gap-x-3 gap-y-2">
                    <label className="flex flex-col gap-1 text-sm font-[650]">
                      {h.opens}
                      <input type="time" name={`hours.${day}.${index}.open`} value={row.open} onChange={(e) => setTime(day, row.key, "open", e.target.value)} required className="input w-[9.5rem]" aria-invalid={error ? "true" : "false"} />
                    </label>
                    <label className="flex flex-col gap-1 text-sm font-[650]">
                      {h.closes}
                      <input type="time" name={`hours.${day}.${index}.close`} value={row.close} onChange={(e) => setTime(day, row.key, "close", e.target.value)} required className="input w-[9.5rem]" aria-invalid={error ? "true" : "false"} />
                    </label>
                    <button type="button" onClick={() => removeRange(day, row.key)} className="btn min-h-12 px-3.5 text-sm" aria-label={h.removeRange(dayName, index + 1)}>
                      {t.closures.remove}
                    </button>
                  </div>
                ))}
                {error ? (
                  <p id={`day-${day}-error`} className="flex items-start gap-1.5 text-sm leading-snug text-tomato-ink">
                    <span aria-hidden="true">●</span>
                    <span>{h.errors[error.code]}</span>
                  </p>
                ) : null}
                {rows.length < MAX_RANGES_PER_DAY ? (
                  <button type="button" data-add onClick={() => addRange(day)} className="link self-start py-2 text-sm">
                    {h.addRange}
                  </button>
                ) : null}
              </div>
            </fieldset>
          );
        })}
      </div>
      <p className="text-[0.8125rem] text-mute">{h.overnightHint}</p>
      <div className="flex flex-wrap items-center gap-4">
        <SubmitButton className="btn btn-primary" pendingLabel={t.saving}>
          {h.save}
        </SubmitButton>
        <Saved show={state.status === "saved"}>{t.saved}</Saved>
      </div>
    </form>
  );
}
