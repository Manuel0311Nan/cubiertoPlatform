"use client";

import { useEffect, type RefObject } from "react";

/**
 * Sincroniza `aria-invalid` y `aria-describedby` con `:user-invalid` en los campos de un
 * formulario, y anuncia por una región `aria-live` el error que aparece al salir de un campo.
 * Adaptado de la guía `accessible-error-announcement` de modern-web-guidance.
 *
 * Cada campo indica en `data-error` el id de su mensaje de error. El mensaje se muestra con CSS
 * (`:user-invalid`) y solo se enlaza en `aria-describedby` mientras se ve: si no, el lector de
 * pantalla lo leería desde el principio.
 */
export function useUserInvalidAria(
  formRef: RefObject<HTMLFormElement | null>,
  announcerRef: RefObject<HTMLElement | null>,
): void {
  useEffect(() => {
    const form = formRef.current;
    if (!form) return;

    const announced = new WeakSet<Element>();
    let timer: ReturnType<typeof setTimeout> | undefined;

    const isField = (el: EventTarget | null): el is HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement =>
      el instanceof HTMLInputElement || el instanceof HTMLSelectElement || el instanceof HTMLTextAreaElement;

    const linkError = (el: HTMLElement, shown: boolean) => {
      const errorId = el.dataset.error;
      if (!errorId) return;
      const ids = (el.getAttribute("aria-describedby") ?? "").split(/\s+/).filter((id) => id && id !== errorId);
      if (shown) ids.push(errorId);
      if (ids.length) el.setAttribute("aria-describedby", ids.join(" "));
      else el.removeAttribute("aria-describedby");
    };

    const announce = (el: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement) => {
      const announcer = announcerRef.current;
      const error = el.dataset.error ? document.getElementById(el.dataset.error) : null;
      if (!announcer || !error) return;
      const label = el.labels?.[0]?.textContent?.trim();
      clearTimeout(timer);
      announcer.textContent = "";
      // Espera a que el lector anuncie el campo que recibe el foco.
      timer = setTimeout(() => {
        announcer.textContent = `${label ? `${label}: ` : ""}${error.textContent?.replace(/\s+/g, " ").trim() ?? ""}`;
      }, 500);
    };

    const sync = (target: EventTarget | null, shouldAnnounce = false) => {
      if (!isField(target)) return;
      const invalid = target.matches(":user-invalid");
      if (invalid) {
        if (shouldAnnounce && !announced.has(target)) {
          announce(target);
          announced.add(target);
        }
        target.setAttribute("aria-invalid", "true");
        linkError(target, true);
      } else if (target.dataset.serverInvalid !== "true") {
        target.setAttribute("aria-invalid", "false");
        linkError(target, false);
        announced.delete(target);
      }
    };

    const onBlur = (event: FocusEvent) => sync(event.target, true);
    const onChange = (event: Event) => sync(event.target, true);
    const onInput = (event: Event) => {
      // Un error del servidor se quita en cuanto la persona corrige el campo.
      if (isField(event.target) && event.target.dataset.serverInvalid === "true") {
        delete event.target.dataset.serverInvalid;
      }
      sync(event.target);
    };
    // Un envío fallido marca todos los campos; el foco en el primero ya lee su error.
    const onInvalid = (event: Event) => {
      if (isField(event.target)) announced.add(event.target);
      sync(event.target);
    };

    form.querySelectorAll("input, select, textarea").forEach((el) => sync(el));
    form.addEventListener("blur", onBlur, true);
    form.addEventListener("change", onChange, true);
    form.addEventListener("input", onInput);
    form.addEventListener("invalid", onInvalid, true);
    return () => {
      clearTimeout(timer);
      form.removeEventListener("blur", onBlur, true);
      form.removeEventListener("change", onChange, true);
      form.removeEventListener("input", onInput);
      form.removeEventListener("invalid", onInvalid, true);
    };
  }, [formRef, announcerRef]);
}
