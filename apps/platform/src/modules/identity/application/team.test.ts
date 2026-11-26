import { disconnectDb, getSystemDb, getTenantDb, type Role } from "@cubierto/db";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { defaultOutboxDeps, dispatchOutboxEvent } from "@/modules/notifications/application/outbox";
import type { EmailMessage } from "@/modules/notifications/domain/email";
import { requireTestDatabase, uniqueSuffix } from "@/test/database";
import { resolveActiveTenant } from "./active-tenant";
import { acceptInvitation, getInvitationView } from "./invitations";
import { changeRole, getTeam, inviteMember, removeMember, resendTeamInvitation, revokeInvitation } from "./team";

const tenantIds: string[] = [];
const userIds: string[] = [];
const emails: string[] = [];

async function tenant() {
  const suffix = uniqueSuffix();
  const created = await getSystemDb().tenant.create({ data: { slug: `e-${suffix}`, name: `Equipo ${suffix}` } });
  tenantIds.push(created.id);
  return created.id;
}

async function member(tenantId: string, role: Role) {
  const email = `p-${uniqueSuffix()}@cubierto.test`;
  const user = await getSystemDb().user.create({ data: { email } });
  userIds.push(user.id);
  emails.push(email);
  await getSystemDb().membership.create({ data: { userId: user.id, tenantId, role } });
  return user.id;
}

/** Envía el email del evento y devuelve el token del enlace. */
async function tokenOf(eventId: string): Promise<string> {
  const sent: EmailMessage[] = [];
  await dispatchOutboxEvent(eventId, { ...defaultOutboxDeps(), email: { send: async (m) => void sent.push(m) } });
  const url = sent[0]?.text.split("\n").find((line) => line.startsWith("http"));
  if (!url) throw new Error("Sin enlace");
  return new URL(url).pathname.split("/").at(-1)!;
}

const newEmail = () => {
  const email = `nuevo-${uniqueSuffix()}@cubierto.test`;
  emails.push(email);
  return email;
};

beforeAll(() => requireTestDatabase());
afterAll(async () => {
  const db = getSystemDb();
  const where = { tenantId: { in: tenantIds } };
  const invited = await db.user.findMany({ where: { email: { in: emails } }, select: { id: true } });
  const allUsers = [...new Set([...userIds, ...invited.map((u) => u.id)])];
  await db.session.deleteMany({ where: { userId: { in: allUsers } } });
  await db.auditLog.deleteMany({ where });
  await db.outboxEvent.deleteMany({ where });
  await db.invitation.deleteMany({ where });
  await db.membership.deleteMany({ where });
  await db.tenant.deleteMany({ where: { id: { in: tenantIds } } });
  await db.user.deleteMany({ where: { id: { in: allUsers } } });
  await disconnectDb();
});

describe("PLT-03 · equipo del local", () => {
  test("PLT-03: el equipo y las invitaciones pendientes, con quién eres", async () => {
    const t = await tenant();
    const owner = await member(t, "OWNER");
    await member(t, "STAFF");
    const invited = await inviteMember(t, owner, { email: newEmail(), role: "STAFF" });
    expect(invited.ok).toBe(true);

    const team = await getTeam(t, owner);
    expect(team.members.map((m) => [m.role, m.isYou])).toEqual([["OWNER", true], ["STAFF", false]]);
    expect(team.invitations).toHaveLength(1);
    expect(team.invitations[0]).toMatchObject({ role: "STAFF", expired: false });
  });

  test("PLT-03: invitar con papel; al aceptar entra con ese papel", async () => {
    const t = await tenant();
    const owner = await member(t, "OWNER");
    const email = newEmail();
    const result = await inviteMember(t, owner, { email, role: "OWNER" });
    if (!result.ok) throw new Error(result.code);
    await acceptInvitation(await tokenOf(result.eventId));
    const team = await getTeam(t, owner);
    expect(team.members.find((m) => m.email === email)?.role).toBe("OWNER");
    expect(team.invitations).toEqual([]);
  });

  test("PLT-03: no se invita a quien ya está en el equipo ni dos veces al mismo email", async () => {
    const t = await tenant();
    const owner = await member(t, "OWNER");
    const ownerEmail = (await getSystemDb().user.findUniqueOrThrow({ where: { id: owner } })).email;
    expect(await inviteMember(t, owner, { email: ownerEmail, role: "STAFF" })).toEqual({ ok: false, code: "ALREADY_MEMBER" });
    const email = newEmail();
    await inviteMember(t, owner, { email, role: "STAFF" });
    expect(await inviteMember(t, owner, { email, role: "OWNER" })).toEqual({ ok: false, code: "ALREADY_INVITED" });
  });

  test("PLT-03: cambiar el papel; nunca el propio", async () => {
    const t = await tenant();
    const owner = await member(t, "OWNER");
    const staff = await member(t, "STAFF");
    expect(await changeRole(t, owner, staff, "OWNER")).toEqual({ ok: true });
    expect(await changeRole(t, owner, staff, "STAFF")).toEqual({ ok: true });
    expect(await changeRole(t, owner, owner, "STAFF")).toEqual({ ok: false, code: "SELF" });
  });

  test("PLT-03: no se puede quitar el último OWNER, ni a la vez desde dos sesiones", async () => {
    const t = await tenant();
    const a = await member(t, "OWNER");
    const b = await member(t, "OWNER");
    // Cada una intenta quitar a la otra a la vez: solo una lo consigue.
    const results = await Promise.all([changeRole(t, a, b, "STAFF"), changeRole(t, b, a, "STAFF")]);
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(results.find((r) => !r.ok)).toEqual({ ok: false, code: "LAST_OWNER" });
    const owners = await getTenantDb(t).membership.count({ where: { role: "OWNER", deletedAt: null } });
    expect(owners).toBe(1);
  });

  test("PLT-03: quitar el acceso: deja de ver el local y una invitación nueva lo recupera", async () => {
    const t = await tenant();
    const owner = await member(t, "OWNER");
    const staff = await member(t, "STAFF");
    const session = await getSystemDb().session.create({
      data: { id: `s-${uniqueSuffix()}`, token: `tok-${uniqueSuffix()}`, userId: staff, expiresAt: new Date(Date.now() + 86_400_000), activeTenantId: t },
    });
    expect((await resolveActiveTenant(staff, session.id)).kind).toBe("active");

    expect(await removeMember(t, owner, staff)).toEqual({ ok: true });
    expect(await resolveActiveTenant(staff, session.id)).toEqual({ kind: "none" });
    expect((await getTeam(t, owner)).members.map((m) => m.userId)).toEqual([owner]);
    // No se borra la fila (CLAUDE.md §11).
    expect(await getSystemDb().membership.count({ where: { userId: staff, tenantId: t } })).toBe(1);

    const email = (await getSystemDb().user.findUniqueOrThrow({ where: { id: staff } })).email;
    const again = await inviteMember(t, owner, { email, role: "OWNER" });
    if (!again.ok) throw new Error(again.code);
    await acceptInvitation(await tokenOf(again.eventId));
    expect((await getTeam(t, owner)).members.find((m) => m.userId === staff)?.role).toBe("OWNER");
  });

  test("PLT-03: no puedes quitarte a ti mismo", async () => {
    const t = await tenant();
    const a = await member(t, "OWNER");
    await member(t, "OWNER");
    expect(await removeMember(t, a, a)).toEqual({ ok: false, code: "SELF" });
  });

  test("PLT-03: cancelar una invitación invalida su enlace; reenviar da uno nuevo", async () => {
    const t = await tenant();
    const owner = await member(t, "OWNER");
    const first = await inviteMember(t, owner, { email: newEmail(), role: "STAFF" });
    if (!first.ok) throw new Error(first.code);
    const token = await tokenOf(first.eventId);
    const [invitation] = (await getTeam(t, owner)).invitations;

    const resent = await resendTeamInvitation(t, invitation!.id);
    if (!resent.ok) throw new Error(resent.code);
    const newToken = await tokenOf(resent.eventId);
    expect(await getInvitationView(token)).toEqual({ state: "NOT_FOUND" });

    expect(await revokeInvitation(t, owner, invitation!.id)).toBe(true);
    expect(await getInvitationView(newToken)).toEqual({ state: "NOT_FOUND" });
    expect(await acceptInvitation(newToken)).toEqual({ ok: false, code: "NOT_FOUND" });
    expect((await getTeam(t, owner)).invitations).toEqual([]);
    expect(await resendTeamInvitation(t, invitation!.id)).toEqual({ ok: false, code: "NOT_FOUND" });
  });

  test("aislamiento: un local no ve ni toca el equipo ni las invitaciones de otro", async () => {
    const a = await tenant();
    const b = await tenant();
    const ownerA = await member(a, "OWNER");
    const staffA = await member(a, "STAFF");
    const ownerB = await member(b, "OWNER");
    const inv = await inviteMember(a, ownerA, { email: newEmail(), role: "STAFF" });
    if (!inv.ok) throw new Error(inv.code);
    const [invitationA] = (await getTeam(a, ownerA)).invitations;

    expect((await getTeam(b, ownerB)).members.map((m) => m.userId)).toEqual([ownerB]);
    expect((await getTeam(b, ownerB)).invitations).toEqual([]);
    expect(await changeRole(b, ownerB, staffA, "OWNER")).toEqual({ ok: false, code: "NOT_FOUND" });
    expect(await removeMember(b, ownerB, staffA)).toEqual({ ok: false, code: "NOT_FOUND" });
    expect(await revokeInvitation(b, ownerB, invitationA!.id)).toBe(false);
    expect(await resendTeamInvitation(b, invitationA!.id)).toEqual({ ok: false, code: "NOT_FOUND" });
    expect((await getTeam(a, ownerA)).members).toHaveLength(2);
  });
});
