import { redirect } from "next/navigation";

/** Ajustes abre en su primer apartado (D17–D19: El local, Reservas, Equipo, Plan y factura). */
export default function SettingsPage() {
  redirect("/panel/ajustes/local");
}
