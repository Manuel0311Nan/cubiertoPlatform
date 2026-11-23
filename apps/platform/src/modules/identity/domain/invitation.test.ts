import { describe, expect, test } from "vitest";
import {
  hashInvitationToken,
  invitationExpiresAt,
  invitationState,
  invitationTokenSchema,
  newInvitationToken,
} from "./invitation";

const now = new Date("2026-11-23T10:00:00.000Z");

describe("PLT-02 · reglas de la invitación", () => {
  test("PLT-02: caduca a los 7 días", () => {
    expect(invitationExpiresAt(now).toISOString()).toBe("2026-11-30T10:00:00.000Z");
  });

  test("PLT-02: válida, caducada o ya aceptada", () => {
    const expiresAt = invitationExpiresAt(now);
    expect(invitationState({ acceptedAt: null, expiresAt }, now)).toBe("VALID");
    expect(invitationState({ acceptedAt: null, expiresAt }, expiresAt)).toBe("EXPIRED");
    expect(invitationState({ acceptedAt: now, expiresAt }, now)).toBe("ACCEPTED");
  });

  test("el token es aleatorio, con la forma esperada, y solo se guarda su hash", () => {
    const token = newInvitationToken();
    expect(invitationTokenSchema.safeParse(token).success).toBe(true);
    expect(newInvitationToken()).not.toBe(token);
    expect(hashInvitationToken(token)).toMatch(/^[0-9a-f]{64}$/);
    expect(hashInvitationToken(token)).not.toContain(token);
    expect(invitationTokenSchema.safeParse("corto").success).toBe(false);
  });
});
