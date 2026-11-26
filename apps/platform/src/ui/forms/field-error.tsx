import type { ReactNode } from "react";
import { es } from "@/i18n/es";

/** Icono de error con texto alternativo: el error no se comunica solo con el color. */
export function ErrorIcon() {
  return (
    <svg role="img" aria-label={es.signIn.errorLabel} viewBox="0 0 20 20" width="18" height="18" className="shrink-0">
      <circle cx="10" cy="10" r="9" fill="currentColor" />
      <path d="M10 5.5v5.5M10 14.2v.3" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}

/** Mensaje de error de un campo: lo muestra el CSS con `:user-invalid` o un error del servidor. */
export function FieldError({ id, children }: { id: string; children: ReactNode }) {
  return (
    <p id={id} className="field-error items-start gap-1.5 text-sm leading-snug text-tomato-ink">
      <ErrorIcon />
      <span>{children}</span>
    </p>
  );
}

/** Error visible siempre (de un grupo o de todo el formulario). */
export function Alert({ children }: { children: ReactNode }) {
  return (
    <p role="alert" className="flex items-start gap-2 rounded-xl border-2 border-tomato bg-tomato-soft p-3 text-sm leading-snug text-tomato-ink">
      <ErrorIcon />
      <span>{children}</span>
    </p>
  );
}

/** Confirmación de guardado, anunciada a lectores de pantalla. */
export function Saved({ show, children }: { show: boolean; children: ReactNode }) {
  return (
    <p role="status" className="min-h-5 text-sm font-[650] text-bottle">
      {show ? children : ""}
    </p>
  );
}
