"use client";

import { useActionState } from "react";
import { es } from "@/i18n/es";
import { Alert, Saved } from "@/ui/forms/field-error";
import { SubmitButton } from "@/ui/forms/submit-button";
import { addClosureAction, type ClosureFormState } from "../actions";

const c = es.settings.closures;

/** PLT-04: añadir un cierre de un día o de un periodo. */
export function ClosureForm({ today }: { today: string }) {
  const [state, formAction] = useActionState<ClosureFormState, FormData>(addClosureAction, { status: "idle", key: 0 });
  const values = state.status === "invalid" ? state.values : { from: "", to: "", reason: "" };

  return (
    <form key={state.key} action={formAction} aria-label={c.add} className="flex flex-col gap-4">
      {state.status === "invalid" ? <Alert>{c.errors[state.code]}</Alert> : null}
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="closure-from" className="text-sm font-[650]">
            {c.from}
            <span aria-hidden="true"> *</span>
          </label>
          <input id="closure-from" name="from" type="date" required min={today} defaultValue={values.from} className="input w-[11rem]" />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="closure-to" className="text-sm font-[650]">
            {c.to}
          </label>
          <input id="closure-to" name="to" type="date" min={today} defaultValue={values.to} className="input w-[11rem]" />
        </div>
        <div className="flex min-w-[14rem] flex-1 flex-col gap-1.5">
          <label htmlFor="closure-reason" className="text-sm font-[650]">
            {c.reason}
          </label>
          <input id="closure-reason" name="reason" type="text" maxLength={80} autoComplete="off" defaultValue={values.reason} aria-describedby="closure-reason-hint" className="input" />
        </div>
      </div>
      <p id="closure-reason-hint" className="-mt-2 text-[0.8125rem] text-mute">
        {c.reasonHint}
      </p>
      <div className="flex flex-wrap items-center gap-4">
        <SubmitButton className="btn" pendingLabel={c.adding}>
          {c.add}
        </SubmitButton>
        <Saved show={state.status === "added"}>{c.added}</Saved>
      </div>
    </form>
  );
}
