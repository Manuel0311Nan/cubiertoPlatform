import { redirect } from "next/navigation";

/** app.<PLATFORM_DOMAIN>/ lleva al panel; sin sesión, el panel manda a la pantalla de entrada. */
export default function Home() {
  redirect("/panel");
}
