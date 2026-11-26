import { z } from "zod";
import { signInEmailSchema } from "./sign-in";

/** Ajustes → Equipo (PLT-03). Aquí y no en las acciones: un archivo "use server" solo exporta funciones. */
export const TEAM_PATH = "/panel/ajustes/equipo";

export const ROLES = ["OWNER", "STAFF"] as const;

export const inviteSchema = z.object({
  email: signInEmailSchema,
  role: z.enum(ROLES),
});

export const roleSchema = z.enum(ROLES);
