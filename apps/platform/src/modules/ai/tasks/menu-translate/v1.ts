import { defineTask } from "@cubierto/ai";
import { z } from "zod";

/**
 * MENU-07 · `menu.translate` v1: traduce textos de la carta del español a otro idioma.
 * Nivel `fast`, sin datos personales (AI-07), en segundo plano (AI-05). Lo que devuelve se guarda
 * como borrador `DRAFT_AI` hasta que el OWNER lo revisa (AI-06).
 *
 * Cambiar el prompt o los schemas obliga a crear v2 y a pasar `evals.json` (AI-08).
 */

export const MENU_LOCALES = ["en", "fr", "de", "it", "pt"] as const;
export type MenuLocale = (typeof MENU_LOCALES)[number];

const LANGUAGE: Readonly<Record<MenuLocale, string>> = {
  en: "inglés",
  fr: "francés",
  de: "alemán",
  it: "italiano",
  pt: "portugués",
};

/** Textos por llamada: una carta entera se parte en varias llamadas (MENU-07). */
export const MAX_ENTRIES_PER_CALL = 40;

const entryInput = z.object({
  /** Identifica el texto en la carta ("MenuItem:<id>"); vuelve igual en la respuesta. */
  key: z.string().min(1).max(100),
  name: z.string().min(1).max(200),
  description: z.string().min(1).max(1000).optional(),
  priceNote: z.string().min(1).max(200).optional(),
  /** El nombre es propio ("Tortilla de Betanzos"): se deja tal cual. */
  keepName: z.boolean().optional(),
});

const entryOutput = z.object({
  key: z.string(),
  name: z.string().min(1),
  description: z.string().optional(),
  priceNote: z.string().optional(),
});

export const menuTranslateInput = z.object({
  targetLocale: z.enum(MENU_LOCALES),
  /** Contexto para el tono; no es un dato personal. */
  venueName: z.string().max(120).optional(),
  entries: z.array(entryInput).min(1).max(MAX_ENTRIES_PER_CALL),
});

export const menuTranslateOutput = z.object({ entries: z.array(entryOutput) });

export type MenuTranslateInput = z.infer<typeof menuTranslateInput>;
export type MenuTranslateOutput = z.infer<typeof menuTranslateOutput>;

const SYSTEM = `Eres traductor profesional de cartas de restaurantes y bares de España.
Traduces del español al idioma que se indica, con el estilo natural de una carta en ese idioma.

Reglas:
- Traduce cada texto por separado y devuelve exactamente las mismas claves ("key"), sin añadir ni quitar ninguna.
- Si un texto tiene "keepName": true, deja su "name" exactamente igual, sin traducirlo.
- Los nombres propios de platos típicos (tortilla, salmorejo, pulpo a feira…) pueden quedarse en español; si lo haces, no añadas explicaciones al nombre.
- Traduce "description" y "priceNote" solo si vienen; si un texto no los trae, no los inventes.
- No añadas ingredientes, alérgenos, precios ni información que no esté en el original.
- No uses comillas ni emojis que no estén en el original.`;

export const menuTranslateV1 = defineTask({
  id: "menu.translate",
  version: 1,
  tier: "fast",
  input: menuTranslateInput,
  output: menuTranslateOutput,
  personalData: "none",
  maxOutputTokens: 8000,
  buildPrompt: (input) => ({
    system: SYSTEM,
    prompt: [
      `Idioma de destino: ${LANGUAGE[input.targetLocale]} (${input.targetLocale}).`,
      input.venueName ? `Local: ${input.venueName}.` : null,
      "Textos de la carta en español (JSON):",
      JSON.stringify(input.entries),
    ]
      .filter(Boolean)
      .join("\n"),
  }),
  check: (input, output) => {
    if (output.entries.length !== input.entries.length) return "número de textos distinto";
    const byKey = new Map(output.entries.map((entry) => [entry.key, entry]));
    for (const entry of input.entries) {
      const translated = byKey.get(entry.key);
      if (!translated) return `falta la clave ${entry.key}`;
      if (entry.keepName && translated.name !== entry.name) return `cambia un nombre que debía quedarse: ${entry.key}`;
      if (entry.description && !translated.description) return `falta la descripción de ${entry.key}`;
      if (entry.priceNote && !translated.priceNote) return `falta la nota de precio de ${entry.key}`;
    }
    return null;
  },
  mock: (input) => ({
    entries: input.entries.map((entry) => {
      const tag = `[${input.targetLocale.toUpperCase()}] `;
      return {
        key: entry.key,
        name: entry.keepName ? entry.name : tag + entry.name,
        ...(entry.description ? { description: tag + entry.description } : {}),
        ...(entry.priceNote ? { priceNote: tag + entry.priceNote } : {}),
      };
    }),
  }),
});
