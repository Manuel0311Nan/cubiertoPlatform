"use client";

import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";

/**
 * Botón de envío que se desactiva mientras se envía, para no mandar el formulario dos veces
 * (guía `forms` de modern-web-guidance). Antes de enviar sigue activo: el navegador marca los
 * campos que faltan y lleva el foco al primero.
 */
export function SubmitButton({
  children,
  pendingLabel,
  className,
  "aria-label": ariaLabel,
}: {
  children: ReactNode;
  pendingLabel: ReactNode;
  className?: string;
  /** Solo si el texto visible no basta (p. ej. un botón por fila); debe empezar por ese texto. */
  "aria-label"?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={className} aria-label={ariaLabel}>
      {pending ? pendingLabel : children}
    </button>
  );
}
