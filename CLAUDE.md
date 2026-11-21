# CLAUDE.md

Guía de trabajo para Claude Code en este repositorio. Léela entera antes de cada sesión.

> **Este archivo NO es la spec.** Aquí están las reglas de cómo se trabaja en el repo.
> Qué hay que construir y cómo debe comportarse está en `specs/modulos/`. Si este archivo y una spec se contradicen en comportamiento de producto, manda la spec; en convenciones de código, manda este archivo.

---

## 1. Qué es este proyecto

Plataforma SaaS **multi-tenant** para hostelería (restaurantes y bares) con tres módulos que se venden por separado o en pack:

| Módulo | Enum | Spec |
|---|---|---|
| Web + mantenimiento | `SITE` | `specs/modulos/01-webs.md` |
| Carta digital y QR | `MENU` | `specs/modulos/02-carta-qr.md` |
| Reservas | `RESERVATIONS` | `specs/modulos/03-reservas.md` |

Todo lo compartido (tenancy, auth, notificaciones, locales y mesas) está en `specs/modulos/00-plataforma.md`; el cobro con Stripe, en `specs/modulos/05-pagos.md` (BILL-*). El servicio de IA, que usan todos los módulos, está en `specs/modulos/04-ia.md`. El formulario de contacto de las webs de los locales, en `specs/modulos/06-formulario-contacto.md` (FORM-*).

**En la primera sesión lee, por este orden:** `specs/README.md`, `specs/00-necesidades.md` (qué hace falta, decisiones tomadas y pendientes), `specs/01-contexto.md` (producto, precios, forma de trabajar) y `specs/02-arquitectura.md` (dominios, acceso al panel, monorepo). Las maquetas de las pantallas y el logo están en `specs/diseno/`.

**Dominios:** `PLATFORM_DOMAIN = cubierto.site`. La raíz y `www` son de la web comercial (otro proyecto). Esta app atiende `app.cubierto.site` (panel, superadmin, carta y reservas públicas, API pública) y `<slug>.cubierto.site` (página mínima o redirección). **Las webs de los locales no las sirve esta app ni viven en este repositorio:** son webs Astro a medida, cada una en su repositorio (`web-<slug>`) y con su proyecto de Vercel y su dominio (`specs/modulos/01-webs.md`).

**Modelo de tenancy:** la plataforma es un código, un despliegue y una base de datos para todos los locales. Cada fila de datos de cliente lleva `tenantId`. La única pieza por local es su web Astro de información, fuera de este repositorio (sin base de datos ni secretos de la plataforma).

## 2. Specs: cómo usarlas

- Antes de tocar un módulo, lee su spec y `00-plataforma.md`.
- Cada requisito tiene un ID (`PLT-03`, `WEB-07`, `MENU-04`, `RES-12`). Referéncialo en commits, PRs y tests: `test("RES-12: no permite overbooking en el último hueco", ...)`.
- Si una tarea exige un comportamiento que la spec no cubre o contradice: **para y pregunta**. No inventes reglas de negocio.
- Si cambia el comportamiento, la spec se actualiza en el mismo PR.
- Las dudas sin resolver van a la sección "Preguntas abiertas" de la spec correspondiente.

## 3. Stack

- **Next.js 15** (App Router, Server Components, Server Actions), **TypeScript** estricto
- **Prisma** + **PostgreSQL en Neon** (región Frankfurt)
- **Better Auth** (plugin `magic-link`, enlace por email vía Resend y el outbox). Sustituye a Auth.js desde el 22/11/2026: Auth.js está en modo mantenimiento y su v5 sigue en beta
- **Tailwind + shadcn/ui**, **TanStack Query** (solo en vistas con refresco, p. ej. sala de reservas), **Zustand** (solo estado de UI local)
- **Zod** para toda validación de entrada
- **Stripe** (Billing + webhooks), **Resend** (email), **n8n** autoalojado (WhatsApp y tareas programadas)
- **Vercel AI SDK** (`ai` + `@ai-sdk/anthropic`) dentro de `packages/ai`; Claude por defecto, otros proveedores por configuración
- **Vercel Pro** (funciones en `fra1`), **Vercel Blob** o **Cloudflare R2** para imágenes
- **Vitest** (unit/integration), **Playwright** (e2e), **Sentry** (errores)
- **pnpm** + **Turborepo**

## 4. Estructura del monorepo

```
apps/
  platform/                 # Única app Next.js
    src/app/
      (sites)/              # <slug>.cubierto.site: página mínima del local o 301 a su web (WEB-16)
      (public)/c/[slug]/    # Carta pública
      (public)/r/[slug]/    # Reservas públicas + widget
      (panel)/panel/        # Panel del restaurante (OWNER/STAFF)
      (admin)/admin/        # Superadmin (Manuel)
      api/public/v1/        # API pública para las webs de los locales (WEB-13) y sus mensajes (FORM-07)
      api/webhooks/         # Stripe, n8n
      api/cron/             # Endpoints llamados por Vercel Cron / n8n
    src/modules/            # Un directorio por bounded context
      tenancy/ identity/ billing/ notifications/ venue/
      sites/ menu/ reservations/ ai/
    src/middleware.ts       # Resolución de tenant por host/ruta
packages/
  db/                       # schema.prisma, migraciones, cliente con tenant scope
  ai/                       # conexión con proveedores de IA (runTask, modelos, precios, mock)
  ui/                       # componentes shadcn compartidos
  brand/                    # logo SVG, colores y tipografía (originales en specs/diseno/marca/)
  config/                   # eslint, tsconfig, tailwind preset
specs/                      # Fuente de verdad de producto (índice en specs/README.md)
```

`apps/landing` (la web comercial en Astro) se incorporará al monorepo como otro proyecto de Vercel; tiene su propio `CLAUDE.md` y no comparte despliegue con `apps/platform`. Las webs de los locales nacen del repositorio plantilla `cubierto-web-plantilla` (WEB-12) y solo hablan con la plataforma por la API pública (WEB-13) y, en la fase 2 del formulario, con su `SiteKey` (FORM-07).

Cada módulo en `src/modules/<context>/` sigue:

```
domain/        # tipos, reglas puras, sin imports de Next ni Prisma
application/   # casos de uso (funciones), orquestan domain + infra
infra/         # repositorios Prisma, clientes externos
ui/            # componentes del módulo
actions.ts     # Server Actions públicas del módulo (finas: validan y llaman a application/)
```

## 5. Comandos

```bash
pnpm install
pnpm dev                       # app en http://localhost:3000
pnpm db:migrate:dev            # prisma migrate dev
pnpm db:migrate:deploy         # solo en CI
pnpm db:migrate:test           # migra TEST_DATABASE_URL (rama `test` de Neon) antes de pnpm test
pnpm db:seed                   # datos de demo: 2 tenants, 1 superadmin
pnpm lint && pnpm typecheck
pnpm test                      # vitest
pnpm test:e2e                  # playwright
```

Desarrollo local de dominios: `casa-brezo.localhost:3000` simula `<slug>.cubierto.site` (página mínima); `app.localhost:3000` es el panel, el superadmin, la carta y reservas públicas y la API pública. Las webs de los locales se arrancan desde su repositorio (`localhost:4321`) contra la API local.

## 6. Reglas de arquitectura (obligatorias)

1. **Aislamiento por tenant.** Todo acceso a datos de cliente pasa por `getTenantDb(tenantId)` de `packages/db`, que añade `tenantId` a cada consulta. RLS en PostgreSQL es la segunda barrera: cada consulta corre con `app.tenant_id` y el rol `cubierto_app`, sin BYPASSRLS. Para varias operaciones atómicas, `$tenantTransaction`. `getSystemDb()` solo para tablas de plataforma (`Tenant`, `User`, `ProcessedWebhook`), resolver el slug, el superadmin y los procesos que recorren todos los locales (`packages/db/README.md`).
2. **El `tenantId` del panel sale de la sesión** (membresía activa), nunca de la URL, de un parámetro ni del body.
3. **El `tenantId` público sale del middleware** (host o slug), nunca del cliente.
4. **Módulos contratados:** toda ruta y Server Action de un módulo comprueba `requireModule(tenant, "RESERVATIONS")`. Sin módulo activo → 404 en público, pantalla de upsell en panel.
5. **Efectos externos por outbox.** Emails, WhatsApp y llamadas a n8n se escriben como `OutboxEvent` en la misma transacción que el cambio de datos. Nunca se llama a Resend o n8n dentro de una transacción ni directamente desde una acción.
6. **Webhooks idempotentes.** Todo webhook se registra en `ProcessedWebhook` antes de procesarse.
7. **Dinero en céntimos** (`Int`), moneda `EUR`. Fechas en UTC en BD; zona horaria del local (`Venue.timezone`, por defecto `Europe/Madrid`) solo para mostrar y calcular disponibilidad.
8. **Caché pública por tags:** las páginas públicas usan `revalidateTag("tenant:<id>:<module>")` al guardar en el panel.
9. Los bounded contexts no importan el `infra/` de otro contexto. Se comunican por funciones de `application/` exportadas o por eventos.
10. **IA solo a través del módulo `ai`.** Cualquier uso de un modelo es una tarea registrada en `modules/ai/tasks/` y se ejecuta con `runAiTask` o `enqueueAiJob`, que aplican presupuesto, límites, registro de coste y validación de la salida. Lo que vea un comensal se guarda como borrador hasta que el OWNER lo acepta.

## 7. Convenciones de código

- Nombres de código, variables, tablas y commits técnicos **en inglés**. Textos de UI **en español** vía diccionario i18n (`es` por defecto, `en` preparado).
- Server Components por defecto; `"use client"` solo cuando haga falta interacción.
- Validación Zod en el borde: cada Server Action y route handler parsea su input con un schema.
- Errores de dominio como resultados tipados (`{ ok: false, code: "SLOT_FULL" }`), no excepciones para flujo normal.
- Fechas con `date-fns` + `date-fns-tz`. Nada de `new Date()` sin zona en lógica de reservas.
- Componentes accesibles (labels, foco, contraste AA). Las páginas públicas deben funcionar bien en móvil de gama baja.
- **Frontend con la skill `modern-web-guidance`** (`.claude/skills/modern-web-guidance/`, oficial de Google Chrome): antes de escribir o cambiar HTML, CSS o JavaScript de cliente (diálogos, formularios, tablas, accesibilidad, rendimiento, fechas en el navegador…), busca y lee la guía con la skill, adáptala a React y Tailwind y comprueba el código con ella. No aplica a backend, Prisma, rutas de API ni tooling.
- **Soporte de navegadores:** lo que sea Baseline *Widely available* se usa sin fallback; lo que no, con el fallback que indique la guía (el criterio por defecto de la skill).

## 8. Base de datos y migraciones

- Un único `schema.prisma` en `packages/db`. Toda tabla de datos de cliente tiene `tenantId String` + índice que empieza por `tenantId`.
- Migraciones **compatibles hacia atrás** (expand → migrate → contract). Nunca renombrar o borrar una columna en el mismo despliegue que deja de usarla.
- Cada PR tiene su rama de Neon para las previews.
- Seeds deterministas; nunca datos reales de clientes en seeds ni en tests.

## 9. Definition of Done

Una tarea está terminada cuando:

- [ ] Cumple los criterios de aceptación de los IDs de la spec que toca
- [ ] Tiene tests que nombran esos IDs (unit para dominio, integration para casos de uso con BD, e2e para flujos públicos críticos)
- [ ] `pnpm lint`, `pnpm typecheck`, `pnpm test` en verde
- [ ] Incluye un test de aislamiento si añade una consulta nueva a datos de cliente (el tenant B no ve datos del tenant A)
- [ ] La spec está actualizada si cambió el comportamiento
- [ ] El PR describe cómo probarlo a mano en la preview

## 10. Git y commits

- Ramas: `feat/<id>-descripcion`, `fix/<id>-descripcion`.
- Conventional Commits: `feat(reservations): RES-12 lock per venue/day`.
- **Los commits salen solo a nombre de Manuel: no añadir trailers `Co-Authored-By: Claude` ni `Claude-Session` en ningún commit.**
- PRs pequeños, uno por historia o grupo pequeño de historias. Manuel revisa todos los PRs antes de fusionar.

## 11. Qué NO hacer

- **No** consultar Prisma directamente con el cliente global para datos de cliente; siempre `getTenantDb`.
- **No** aceptar `tenantId` desde el navegador (query, body, headers propios).
- **No** crear un proyecto, despliegue o base de datos de la plataforma por cliente. La excepción son las webs Astro de los locales, que viven fuera de este repositorio, son estáticas y no tienen base de datos ni secretos de la plataforma.
- **No** servir las webs de los locales desde esta app ni añadir aquí un editor de su contenido: los cambios los hace Manuel en el repositorio de cada web (`01-webs.md`).
- **No** añadir a la API pública datos de la carta, de las reservas ni datos personales: solo lo de WEB-13, y una versión nueva si cambia.
- **No** servir el panel dentro del dominio de un local: `/panel` allí solo redirige a `app.<PLATFORM_DOMAIN>` (PLT-11).
- **No** cambiar la dirección pública de la carta una vez impresos QR de clientes reales.
- **No** llamar a servicios externos (Resend, n8n, Stripe) dentro de una transacción.
- **No** guardar precios como `Float`.
- **No** usar `localStorage` para estado que importe (carrito, reservas, sesión).
- **No** añadir dependencias nuevas sin justificarlo en el PR (tamaño, mantenimiento, alternativa nativa).
- **No** introducir funcionalidades marcadas como "Fuera de alcance MVP" en las specs.
- **No** integrar con TPV, impresoras térmicas ni Reserve with Google en el MVP.
- **No** escribir textos legales nuevos inventados: usar las plantillas que haya (las de las webs de los locales están en su repositorio plantilla) y marcar lo que falte.
- **No** guardar datos de salud de comensales salvo en el campo previsto y con consentimiento explícito (ver `03-reservas.md`).
- **No** borrar datos de forma permanente desde el panel: soft delete (`deletedAt`) salvo en los procesos RGPD documentados.
- **No** importar SDKs de proveedores de IA (`@anthropic-ai/sdk`, `openai`, `@ai-sdk/*`) fuera de `packages/ai`, ni escribir prompts sueltos fuera de `modules/ai/tasks/`.
- **No** llamar a un modelo dentro de una transacción ni durante el render de una página pública; ni usar proveedores reales en tests, CI o previews (siempre `mock`).
- **No** enviar datos personales de comensales a un modelo salvo en tareas `personalData: minimal`, y nunca datos de salud.
- **No** dejar que la IA decida sola sobre alérgenos, precios o reservas: solo sugiere.
- **No** instalar skills sin leer su `SKILL.md`; preferir fuentes oficiales y subirlas a `.claude/skills/`.
- **No** desactivar tests que fallan para que pase el CI.
- **No** usar `any`, `@ts-ignore` ni `eslint-disable` sin un comentario que explique por qué.
