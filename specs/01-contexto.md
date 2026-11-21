# 01 · Contexto del proyecto

Resumen de todo lo decidido antes de empezar a programar la plataforma. Léelo junto con `/CLAUDE.md` (cómo se trabaja), `00-necesidades.md` (qué hace falta), `02-arquitectura.md` (cómo se reparte) y `modulos/` (qué se construye). Si algo de aquí contradice una spec, manda la spec.

Última actualización: 16/11/2026.

## 1. Qué es y para quién

- **Producto:** plataforma SaaS multi-tenant para bares y restaurantes con tres módulos que se venden sueltos o en pack: web + mantenimiento (`SITE`), carta digital con QR (`MENU`) y reservas (`RESERVATIONS`).
- **Cliente:** dueños y encargados de hostelería de Alcalá de Henares y el Corredor del Henares. Poco técnicos, usan el móvil, valoran el trato directo.
- **Quién lo hace:** Manuel, desarrollador freelance en Alcalá. Claude programa; Manuel revisa cada PR y despliega.
- **Objetivo:** sistema robusto para 25–30 locales sin cambiar la arquitectura.

## 2. Nombre y marca

- **Nombre:** **Cubierto** (en sala, "cubiertos" son los comensales; y además "lo tienes todo cubierto"). **Dominio:** `cubierto.site`, ya en uso en la web comercial. **Pendiente:** comprobar la marca en OEPM/EUIPO y el usuario de Instagram.
- **Logo** (15/11/2026): marco redondeado abierto, tenedor que lo cierra y hoja azafrán en la esquina; nombre en Bricolage Grotesque ExtraBold. Originales y reglas de uso en `diseno/marca/`.
- **Colores de marca:** verde botella `#1D4A3A`, azafrán `#E8A317`, tinta `#14281F`, papel `#F7F8F5`; tomate `#B83A27` solo para errores y agotado. Detalle en `diseno/README.md`.
- Marca madre: **Zoen** (web principal Zoenlab). Fórmula propuesta: "Cubierto, de Zoen".
- Ojo: CoverManager (líder en reservas en España) significa "gestor de cubiertos"; no es un conflicto legal, pero hay parecido conceptual.
- Lemas en estudio: "Tú cocinas. Lo demás, cubierto." · "Tu local, con todo cubierto: web, carta y reservas." · "Cada cubierto cuenta."
- En código, el nombre vive en una sola constante de configuración (por si la comprobación de marca obligara a cambiarlo).

## 3. Decisiones de arquitectura

| Tema | Decisión | Motivo |
|---|---|---|
| Framework | Next.js 15 (App Router) + TypeScript, frente a PHP/Laravel | Stack que domina Manuel; un lenguaje para webs públicas, panel y carta |
| Tenancy | **Un código, un despliegue, una base de datos.** `tenantId` en cada fila + RLS | Una actualización llega a todos; nada de un proyecto por cliente |
| Proyectos | **Web comercial (Astro) y plataforma (Next.js) separadas**, con despliegues distintos y un mismo monorepo cuando arranque F0 | Una caída de la plataforma no tumba la web que vende; ritmos distintos. Ver `02-arquitectura.md` |
| Dominios | `cubierto.site` → web comercial; `app.cubierto.site` → panel, superadmin, carta y reservas; `<slug>.cubierto.site` y dominios propios → webs de los locales | Ver `02-arquitectura.md` §4 |
| Resolución de tenant | Middleware por host (dominio propio o subdominio) y por slug (`/c/<slug>`, `/r/<slug>`); en el panel, por sesión | Ver `modulos/00-plataforma.md` §5 |
| Acceso al panel | Un solo panel en `app.cubierto.site`; desde cada web, `/panel` redirige y el pie tiene "Acceso del equipo"; panel instalable como app | PLT-11 y PLT-12 |
| Base de datos | Neon PostgreSQL en Frankfurt: plan Launch en desarrollo y piloto, **Scale** al tener clientes (es el que da SLA y SOC 2) | Ramas por PR para previews |
| Hosting | Vercel Pro, funciones en `fra1`. Dominios de clientes por la API de Vercel (ilimitados en Pro) | Vercel no da SLA hasta Enterprise; el SLA comercial que prometemos es 99,5 % |
| Hosting a largo plazo | VPS propio (Hostinger o IONOS) con Coolify, por fases | Guía y plan en `anexos/alojamiento-vps.md`. Desde F0, nada exclusivo de Vercel fuera de un adaptador |
| Auth | Auth.js con magic link (Resend) | Personal de sala sin contraseñas |
| Pagos | Stripe Billing: un precio por módulo + precio pack; alta de web como pago único | Estado de suscripción → estado del módulo |
| Efectos externos | Patrón outbox; webhooks idempotentes | Ver `CLAUDE.md` §6 |
| Automatizaciones | n8n autoalojado en un VPS (WhatsApp, recordatorios, informes) | Pendiente: el VPS aún no está creado |
| Plano de sala | **Editor:** Konva con `react-konva` (cargado solo en esa ruta). **Vista de servicio:** SVG con React | Konva trae arrastrar/girar/redimensionar; SVG es ligero y accesible. Comprobar que `react-konva` 19.x admite la versión de React del proyecto (pide ≥ 19.3) |
| IA | Servicio propio (`packages/ai` + módulo `ai`) sobre **Vercel AI SDK**, con **Claude** por defecto e intercambiable por otros proveedores por configuración. Tareas tipadas, coste por cliente, presupuestos y revisión humana (`04-ia.md`) | Primer uso: traducción de la carta (MENU-07). Preparado para reseñas, textos, publicaciones e informes |
| Reservas | Capacidad por **cubiertos**, no por mesas. Sin overbooking con `pg_advisory_xact_lock` por local y día (RES-12) | Más simple y robusto para el MVP |

## 4. Precios (orientativos, sin IVA, sin permanencia)

| Módulo | Precio |
|---|---|
| Carta digital con QR | 24 €/mes |
| Reservas | 44 €/mes |
| Web + mantenimiento | 39 €/mes + alta de 499 € IVA incluido (pago único) |
| Pack con los tres | 79 €/mes + alta de 499 € **IVA incluido** (412,40 € + IVA), pago único |

Piloto: 3 locales de Alcalá con el pack completo: 250 € IVA incluido el primer mes (alta y primera cuota) y después la cuota normal del pack, con un 10 % de descuento en la cuota durante el primer año (no se publica en la web). Estrategia de venta: entrar con la carta QR (barata, se ve en un día) y subir a reservas o al pack.

## 5. Specs (`modulos/`)

| Spec | IDs | Estado |
|---|---|---|
| `00-plataforma.md` | PLT-01 a PLT-12 | v0.3 (cobro detallado en `05-pagos.md`) |
| `01-webs.md` | WEB-01 a WEB-11 | v0.2 (WhatsApp, pie con acceso del equipo) |
| `02-carta-qr.md` | MENU-01 a MENU-10 | v0.2 (carta en papel imprimible) |
| `03-reservas.md` | RES-01 a RES-18 | v0.3 |
| `04-ia.md` | AI-01 a AI-09 | v0.1 (base del servicio de IA) |
| `05-pagos.md` | BILL-01 a BILL-13 | v0.1 (Stripe: cuotas, primer pago, IVA, impagos, facturas) |

Decisiones recientes en reservas:
- **RES-15:** plano de sala en el servicio con estado de cada mesa (libre, llega pronto, ocupada) y acciones de un toque.
- **RES-16:** editor del plano para el dueño (cuadrícula, girar en pasos de 15°, barra/cocina/paredes, deshacer).
- **RES-17 (decidido el 13/11/2026):** **si se juntan mesas, se reservan juntas.** Una reserva puede tener varias mesas (`ReservationTable`); comparten estado y acciones; las personas cuentan una vez.
- **RES-18 (decidido el 16/11/2026):** **WhatsApp en el MVP = solo un enlace.** Botón "Reservar por WhatsApp" (wa.me con mensaje prerrellenado) en la web y en la página de reservas; lo que se cierra en el chat lo apunta el personal con origen WhatsApp. Avisos por la API de WhatsApp (fase 2) y reservar dentro del chat (fase 3) quedan pendientes.

## 6. Estructura del proyecto

Monorepo con pnpm + Turborepo: `apps/platform` (Next.js), `apps/landing` (la web comercial, cuando se mueva) y paquetes compartidos (`db`, `ai`, `brand`, `ui`, `config`). Árbol completo en `02-arquitectura.md` §8; rutas y bounded contexts de la plataforma en `/CLAUDE.md` §4. Variables de entorno en `00-necesidades.md` §5.

## 7. Orden de construcción

1. **F0 Fundaciones** (PLT-01 a PLT-12 + AI-01 a AI-05 y AI-08). Primer hito en `00-necesidades.md` §3: monorepo pnpm + Turborepo, Prisma + Neon, `getTenantDb` y RLS, middleware de tenant, Auth.js, roles, Stripe, outbox, superadmin y la base del servicio de IA con el proveedor simulado. Sin esto no arranca nada.
2. **F1** Webs (WEB-*).
3. **F2** Carta QR (MENU-*), con la traducción como primer uso real de la IA. Desde aquí ya se puede vender.
4. **F3** Reservas (RES-*), empezando por **RES-12** (concurrencia) y después el plano (RES-15/16/17).
5. **F5** Pruebas de aislamiento entre tenants, copias, monitorización.

Estimación inicial: unas 11 semanas de desarrollo con 2–3 h/día de revisión de Manuel.

## 8. Preguntas abiertas

Las que condicionan el arranque están reunidas en `00-necesidades.md` §8. El resto, al final de cada spec.

## 9. Proyecto hermano: web comercial (ya hecha)

- **Ruta:** `C:\Users\manuk\source\nextjs\zoenlab-web` (en el ordenador de Manuel). Tiene su propio `CLAUDE.md`. Pasará a `apps/landing` del monorepo.
- **Dominio y marca:** `cubierto.site`, con el logo nuevo, favicon, iconos de la PWA e imagen para compartir (16/11/2026). Los originales del logo están en su carpeta `brand/`.
- **Stack:** Astro 7 estático + PWA (service worker propio), CSS con tokens, JS vanilla. Requiere Node ≥ 22.23.4 (`.nvmrc` = 24).
- **Contenido:** portada con demo interactiva de la carta, sección de guías (artículos con fuentes), páginas por servicio, calculadora de precios por módulos, demo del plano de sala con mesas juntas en `/reservas-online/`, sobre mí (se publica solo lo completo), formulario por función de Vercel y Resend, carta de ejemplo, herramientas gratis, gestor de cookies propio (sin banner mientras no haya servicios con cookies).
- **Lighthouse móvil:** 100 en las cuatro categorías.
- **Pendiente:** datos personales y legales, foto, Vercel Pro o mudanza al VPS, enlace "Acceso clientes" a `app.cubierto.site` cuando exista.
- Los precios y lo que promete la web **deben coincidir** con las specs: si cambias uno, cambia el otro.

## 10. Forma de trabajar con Manuel

- Responder en español; términos técnicos en inglés.
- **Commits solo a nombre de Manuel: nunca trailers `Co-Authored-By: Claude` ni `Claude-Session`.**
- Conventional Commits en inglés con el ID de la spec: `feat(reservations): RES-12 lock per venue/day`.
- PRs pequeños, uno por historia; Manuel revisa todos antes de fusionar.
- Le gustan los `CLAUDE.md` con una sección explícita de "Qué NO hacer".
- Ante una regla de negocio que la spec no cubre: parar y preguntar; la duda va a "Preguntas abiertas".

## 11. Skills

Resumen de skills útiles para el día a día de los clientes (SEO local, redes, textos, documentos) y cómo convertirlas en servicio o en funcionalidad: `anexos/skills-para-locales.md`.

### Para este repo

Instalar a nivel de proyecto (`.claude/skills/`, subidas al repo) y leer el `SKILL.md` antes:

```bash
npx skills add https://github.com/vercel-labs/skills --skill find-skills
```

Candidatas: `vercel-react-best-practices` (Vercel), `neon-postgres` (Neon), `prisma-client-api` (Prisma), `playwright-cli` (Microsoft) o `webapp-testing` (Anthropic), `grill-me` (Matt Pocock) para cerrar preguntas abiertas antes de cada fase.
