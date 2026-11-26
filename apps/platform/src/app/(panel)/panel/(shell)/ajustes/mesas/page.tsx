import type { Metadata } from "next";
import Link from "next/link";
import { es } from "@/i18n/es";
import { requireOwner } from "@/modules/tenancy/panel";
import { getTable, listTables, type TableRow } from "@/modules/venue/application/tables";
import { qrFingerprint, TABLES_PATH } from "@/modules/venue/domain/tables";
import { regenerateQrAction, setTableActiveAction } from "@/modules/venue/table-actions";
import { TableForm } from "@/modules/venue/ui/table-form";
import { Alert } from "@/ui/forms/field-error";
import { SubmitButton } from "@/ui/forms/submit-button";

const t = es.settings.tables;

export const metadata: Metadata = { title: t.metaTitle };

type Params = { editar?: string; regenerar?: string; regenerada?: string; guardada?: string; noexiste?: string };

function Notice({ children }: { children: React.ReactNode }) {
  return (
    <p role="status" className="rounded-xl border-2 border-bottle bg-[#e6efe9] p-3 text-sm leading-snug">
      {children}
    </p>
  );
}

/** Confirmación antes de regenerar (PLT-05): sin JavaScript, como una pantalla más. */
function ConfirmRegenerate({ table }: { table: TableRow }) {
  return (
    <section aria-labelledby="confirm-title" className="flex flex-col gap-3 rounded-2xl border-2 border-tomato bg-white p-4 md:p-5">
      <h2 id="confirm-title" className="text-[1.25rem] font-[750] tracking-[-0.02em]">
        {t.confirmTitle(table.label)}
      </h2>
      <p className="max-w-[60ch]">{t.confirmBody}</p>
      <div className="flex flex-wrap items-center gap-3">
        <form action={regenerateQrAction}>
          <input type="hidden" name="id" value={table.id} />
          <SubmitButton className="btn btn-primary" pendingLabel={es.settings.saving}>
            {t.confirm}
          </SubmitButton>
        </form>
        <Link href={TABLES_PATH} className="link px-2 py-2.5">
          {t.cancel}
        </Link>
      </div>
    </section>
  );
}

/** PLT-05 · Ajustes → Mesas: alta, edición, desactivar y regenerar el QR. */
export default async function TablesPage({ searchParams }: { searchParams: Promise<Params> }) {
  const panel = await requireOwner();
  const tenantId = panel.membership.tenantId;
  const params = await searchParams;
  // Los ids de la dirección solo eligen una fila: getTenantDb no deja ver mesas de otro local.
  const [tables, editing, regenerating] = await Promise.all([
    listTables(tenantId),
    params.editar ? getTable(tenantId, params.editar) : null,
    params.regenerar ? getTable(tenantId, params.regenerar) : null,
  ]);
  const regenerated = params.regenerada ? tables.find((table) => table.id === params.regenerada) : undefined;

  return (
    <div className="flex max-w-[52rem] flex-col gap-6">
      <p className="max-w-[62ch] text-mute">{t.intro}</p>

      {params.guardada ? <Notice>{t.saved}</Notice> : null}
      {regenerated ? <Notice>{t.regenerated(regenerated.label)}</Notice> : null}
      {params.noexiste || (params.editar && !editing) || (params.regenerar && !regenerating) ? <Alert>{t.notFound}</Alert> : null}

      {regenerating ? (
        <ConfirmRegenerate table={regenerating} />
      ) : (
        <TableForm
          key={editing?.id ?? "new"}
          editing={
            editing
              ? { id: editing.id, label: editing.label, zone: editing.zone ?? "", minSeats: String(editing.minSeats), maxSeats: String(editing.maxSeats) }
              : null
          }
        />
      )}

      <section aria-labelledby="tables-title" className="flex flex-col gap-3">
        <h2 id="tables-title" className="text-[1.5rem] font-[750] tracking-[-0.02em]">
          {t.listTitle}
        </h2>
        {tables.length === 0 ? (
          <p className="text-mute">{t.empty}</p>
        ) : (
          <ul className="flex flex-col divide-y divide-line rounded-2xl border border-line bg-white">
            {tables.map((table) => (
              <li key={table.id} className={`flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 ${table.active ? "" : "bg-paper"}`}>
                <div className="min-w-[10rem] flex-1">
                  <p className="font-[700]">
                    {table.label}
                    {table.zone ? <span className="font-normal text-mute"> · {table.zone}</span> : null}
                  </p>
                  <p className="text-sm text-mute">
                    {t.seats(table.minSeats, table.maxSeats)}
                    {table.active ? (
                      <>
                        {" · "}
                        <span title={t.qrHint}>{t.qr(qrFingerprint(table.qrToken))}</span>
                      </>
                    ) : (
                      <>
                        {" · "}
                        <b className="font-[650] text-ink">{t.inactive}</b>
                      </>
                    )}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Link href={`${TABLES_PATH}?editar=${table.id}`} className="btn min-h-11 px-3.5 text-sm" aria-label={t.editLabel(table.label)}>
                    {t.edit}
                  </Link>
                  {table.active ? (
                    <Link href={`${TABLES_PATH}?regenerar=${table.id}`} className="btn min-h-11 px-3.5 text-sm" aria-label={t.regenerateLabel(table.label)}>
                      {t.regenerate}
                    </Link>
                  ) : null}
                  <form action={setTableActiveAction}>
                    <input type="hidden" name="id" value={table.id} />
                    <input type="hidden" name="active" value={table.active ? "false" : "true"} />
                    <button
                      type="submit"
                      className="btn min-h-11 px-3.5 text-sm"
                      aria-label={table.active ? t.deactivateLabel(table.label) : t.activateLabel(table.label)}
                    >
                      {table.active ? t.deactivate : t.activate}
                    </button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        )}
        <p className="text-[0.8125rem] text-mute">{t.printLater}</p>
      </section>
    </div>
  );
}
