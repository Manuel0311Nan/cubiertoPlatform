# Cubierto · Contexto para empezar la plataforma

Traspaso del chat de trabajo del 2 al 21 de noviembre de 2026, para arrancar la plataforma en un chat nuevo o en Claude Code abierto en esta carpeta. **Este archivo resume; la fuente de verdad son `CLAUDE.md` y `specs/`.** Si algo de aquí choca con ellos, mandan ellos.

---

## 1. Quién y cómo se trabaja

- **Manuel**, desarrollador freelance en Alcalá de Henares. Viene de .NET/C#; hoy trabaja sobre todo con Next.js. Marca madre: Zoen.
- Responder **en español**; términos técnicos en inglés.
- **Commits solo a nombre de Manuel: nunca trailers `Co-Authored-By: Claude` ni `Claude-Session`.**
- Conventional Commits en inglés con el ID de la spec (`feat(platform): PLT-01 create tenant`). Una rama y un PR pequeño por historia o grupo pequeño de historias. Manuel revisa todos los PRs antes de fusionar.
- Ante una regla de negocio que la spec no cubre: **parar y preguntar**. La duda va a "Preguntas abiertas" de su spec; la decisión, con fecha, a `specs/00-necesidades.md` §7.
- Le gustan los `CLAUDE.md` con una sección explícita de "Qué NO hacer".

## 2. Qué es Cubierto

Plataforma SaaS multi-tenant para bares y restaurantes de Alcalá de Henares y el Corredor del Henares, pensada para 25–30 locales sin cambiar la arquitectura. Tres módulos, sueltos o en pack:

| Módulo | Enum | Spec |
|---|---|---|
| Web a medida + mantenimiento | `SITE` | `specs/modulos/01-webs.md` (WEB-01…17; 02 a 04 descartadas) |
| Carta digital con QR | `MENU` | `specs/modulos/02-carta-qr.md` (MENU-01…10) |
| Reservas con plano de sala | `RESERVATIONS` | `specs/modulos/03-reservas.md` (RES-01…18) |

Comunes: `00-plataforma.md` (PLT-01…12), `04-ia.md` (AI-01…09), `05-pagos.md` (BILL-01…13, Stripe) y `06-formulario-contacto.md` (FORM-01…08, el formulario de las webs de los locales).

**Precios** (sin IVA salvo donde se indica, sin permanencia): carta 24 €/mes · reservas 44 €/mes · web 39 €/mes + alta de 499 € IVA incluido · pack de los tres 79 €/mes + alta de 499 € IVA incluido, que ya cubre el primer mes. **Piloto** (3 locales): 250 € IVA incluido el primer mes con el pack completo; después, cuota normal con un 10 % de descuento el primer año (no se publica). Detalle en `specs/01-contexto.md` §4 y `05-pagos.md`.

## 3. Dónde está cada cosa

| Qué | Dónde | Estado |
|---|---|---|
| Plataforma (este proyecto) | `C:\Users\manuk\source\nextjs\cubiertoPlataform\` → `CLAUDE.md` + `specs/` + monorepo | **Esqueleto creado el 21/11** (ver §6). Lógica por empezar. La carpeta antigua `cubierto\` es una copia: se puede borrar |
| Web comercial | `C:\Users\manuk\source\nextjs\zoenlab-web` → `cubierto.site` (Astro, Vercel Pro) | Publicada. Ver §5 |
| Maquetas de las 39 pantallas | `specs/diseno/vistas-movil.html` (M1–M17) y `vistas-ordenador.html` (D1–D22) | Hechas. Si chocan con una spec, manda la spec (`diseno/README.md` §5) |
| Logo | `specs/diseno/marca/` (SVG) y `zoenlab-web/brand/` | Hecho |

## 4. Arquitectura en resumen (detalle en `specs/02-arquitectura.md` y `CLAUDE.md`)

- **Stack:** Next.js 15 (App Router) + TypeScript estricto, Prisma + PostgreSQL en Neon (Fráncfort), Auth.js con enlace por email (Resend), Stripe Billing (Checkout + portal), Tailwind + shadcn/ui, Zod, Vercel AI SDK con Claude por defecto, Vitest + Playwright, Sentry, pnpm + Turborepo.
- **Tenancy:** un código, un despliegue, una base de datos. `tenantId` en cada fila, `getTenantDb(tenantId)` y RLS como segunda barrera. El `tenantId` del panel sale de la sesión; el público, del middleware (host o slug). Nunca del navegador.
- **Reglas fijas:** efectos externos por outbox, webhooks idempotentes, dinero en céntimos, fechas en UTC, migraciones compatibles hacia atrás, IA solo por el módulo `ai`.
- **Dominios:** `cubierto.site` y `www` → web comercial (otro proyecto). `app.cubierto.site` → panel, superadmin, carta y reservas públicas. `<slug>.cubierto.site` → página mínima del local o redirección a su web (WEB-16). El dominio de cada local → **su web, que no es de la plataforma** (ver abajo).
- **Acceso al panel:** un solo panel en `app.cubierto.site`; desde la web de cada local, `/panel` redirige y el pie tiene "Acceso del equipo" (PLT-11). Panel instalable (PLT-12).
- **Reservas:** capacidad por cubiertos; sin overbooking con `pg_advisory_xact_lock` por local y día (**RES-12, lo primero de F3**). Mesas juntas se reservan juntas (RES-17). WhatsApp en el MVP = solo enlace `wa.me` (RES-18).
- **Hosting:** Vercel Pro (`fra1`) por ahora; a largo plazo VPS de Hostinger con Coolify (`specs/anexos/alojamiento-vps.md`). Desde F0, nada exclusivo de Vercel fuera de un adaptador.

- **Webs de los locales (decidido el 21/11):** cada una es una **web Astro a medida, en su propio repositorio (`web-<slug>`) y con su proyecto de Vercel**, como `cubierto.site`. Nacen del repositorio plantilla `cubierto-web-plantilla` (WEB-12). **Los cambios los hace Manuel** cuando toca: no hay editor en el panel ni recompilación automática. La plataforma da los datos públicos del local por API al compilar (WEB-13), marca en el superadmin cuándo han cambiado y tiene un botón "Recompilar web" (WEB-14), y recoge las solicitudes de cambios (WEB-11). La web comercial ya promete esto ("me pides los cambios y los hago yo"). El 17/11 se planteó lo mismo dentro del monorepo (`apps/webs/<slug>`) y con recompilación automática; eso no vale. No usar `cubierto-specs.zip` ni ninguna otra copia antigua.

## 5. Web comercial (`zoenlab-web`): lo hecho estos días

- **Formulario de contacto** funcionando sin n8n: `src/pages/api/contacto.ts` (única ruta de servidor, función de Vercel en `fra1`) valida y envía con la API de Resend (región UE) a `hola@cubierto.site`. Sin JavaScript redirige a la página de gracias o de error.
- **Correo:** `hola@cubierto.site` en Google Workspace. DNS en Hostinger con MX y SPF de Google, y los registros de Resend verificados (DKIM `resend._domainkey`, CNAME `send` y `rsend`, `_dmarc`). API key de Resend con Sending access limitada a `cubierto.site`, solo en las variables de Vercel. **La plataforma puede reutilizar ese dominio verificado en Resend** para sus emails (enlace de entrada, invitaciones, reservas), con su propia clave.
- **Idiomas:** rama `feat/i18n` con la web en inglés de EE. UU. (`/en/`) y portugués de Portugal (`/pt/`), lista para subir y revisar en una vista previa. Plan en `zoenlab-web/docs/plan-traduccion-en-pt.md`. Pendiente: revisión de una persona nativa. Encima, un commit del 21/11 (`fix(copy): …`) que cambia lo que promete el módulo web en los tres idiomas: diseño hecho para el local y "me pides los cambios y los hago yo", en lugar de "la editas tú" y "platos destacados".
- **Pendiente de la web comercial:** Google Search Console y etiquetas UTM en los enlaces propios, NIF y dirección en los legales, foto y trayectoria en "Sobre mí", y el enlace "Acceso clientes" a `app.cubierto.site` cuando exista.
- Los precios y lo que promete la web **deben coincidir** con las specs: si cambias uno, cambia el otro.

## 6. Cómo empezar la plataforma

**Dónde:** mejor en **Claude Code abierto en esta carpeta** (`C:\Users\manuk\source\nextjs\cubiertoPlataform`), que trabaja sobre los archivos, ejecuta `pnpm`, tests y migraciones y hace los commits. Una sesión por objetivo (por ejemplo, "primer hito de F0"), no una sesión eterna.

**Ya hecho (21/11):** monorepo con pnpm + Turborepo (`package.json`, `pnpm-workspace.yaml`, `turbo.json`, `.nvmrc` = 24) y `apps/platform` con Next.js 15.5, React 19.3 (la que pide `react-konva`), TypeScript, Tailwind 4, ESLint y Bricolage Grotesque autoalojada. `pnpm build`, `pnpm typecheck` y `pnpm lint` pasan. Repositorio git local con un primer commit. **Next.js 16 ya es la versión actual:** decidir en la primera sesión si se arranca en 16 en vez de 15, antes de escribir código.

**Antes de la primera sesión (Manuel):**
1. `corepack enable` y `pnpm install` en la carpeta. Crear el repositorio en GitHub y subir lo que hay (`git remote add origin …` + `git push -u origin main`).
2. Quitar la marca de solo lectura de `CLAUDE.md` (hoy está así en Windows y no se puede editar).
3. Tener a mano: proyecto en Neon (Fráncfort; hoy en plan gratuito), y más adelante Vercel (proyecto `app.cubierto.site`), Stripe en modo prueba y Sentry.

**Primer hito (F0), de `specs/00-necesidades.md` §3:**
1. Monorepo con `apps/platform` y sitio para `apps/landing`.
2. Base de datos con los modelos de `00-plataforma.md`, `getTenantDb` y RLS desde el primer día, con test de aislamiento.
3. Entrada con enlace por email (en local, el enlace sale en la consola).
4. Superadmin con "Dar de alta un local" (PLT-01): crea el local y envía la invitación.
5. Panel vacío del local con su menú lateral según los módulos activos.
6. Resolución por dominio: `casa-brezo.localhost:3000` muestra la página mínima del local.
7. Desplegado en Vercel con `app.cubierto.site` y Neon.

Hecho cuando: un local de prueba se da de alta desde el superadmin, su dueña entra con el enlace, ve su panel y no puede ver nada de otro local. Después, en F0: Stripe en modo prueba (BILL-01 a 03, 08 y 09) y la base de IA con el proveedor simulado (AI-01 a 05 y 08).

**Pequeño arreglo de documentación pendiente:** `00-necesidades.md` §6 dice "falta el email definitivo": `hola@cubierto.site` ya funciona; confirmar si es el definitivo. (El resto de lo encontrado al revisar las specs el 21/11 ya está corregido en el segundo commit.)

## 7. Decisiones pendientes que más condicionan

Lista completa y por fases en `specs/00-necesidades.md` §8. Las de F0:
- ¿El alta de la web suelta (499 €) incluye el primer mes, como la del pack?
- Retención de IRPF en las facturas (gestor).
- ¿Prueba gratuita? ¿Precio anual?
- IA incluida con presupuesto por local o como extra.
- ¿Quién compra y renueva el dominio de cada local?

Antes de F1 (webs): propiedad del código de la web si un local se va, qué pasa con la web si no paga, dónde se fijan el color y el logo de la carta y las reservas de cada local (ya no hay temas de web), y límites de Vercel con 30 webs.

Y antes de imprimir el primer QR (F2): la dirección pública de carta y reservas (`app.cubierto.site/c/<slug>` provisional o `<slug>.cubierto.site/carta`), porque luego no se puede cambiar.

## 8. Frase para empezar

> Soy Manuel. Vamos a empezar a programar la plataforma Cubierto. Lee entero `CLAUDE.md`, después `specs/README.md`, `specs/00-necesidades.md`, `specs/01-contexto.md` y `specs/02-arquitectura.md`, y `CONTEXTO-CHAT.md` para el contexto de cómo hemos llegado aquí. Objetivo de esta sesión: el primer hito de F0 (`00-necesidades.md` §3). Antes de escribir código, propón un plan por pasos con las historias que toca, los commits que harías y las dudas que la spec no resuelva. Commits solo a mi nombre.
