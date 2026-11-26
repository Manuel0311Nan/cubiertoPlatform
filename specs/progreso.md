# Progreso de la plataforma

**Última actualización:** 26/11/2026 (mesas y QR)

Qué está construido, fase a fase, qué hace cada pieza y qué decisiones se han tomado por el camino. Se actualiza en cada PR que añada o cambie funcionalidad (CLAUDE.md §9).

> Este archivo cuenta **lo que ya existe**. Lo que hay que construir y cómo debe comportarse está en las specs (`modulos/`); las decisiones con su fecha, en `00-necesidades.md` §7. Si algo de aquí contradice una spec, manda la spec y se corrige este archivo.

## Estado general

| Fase | Contenido | Estado |
|---|---|---|
| **F0** Fundaciones | Monorepo, base de datos, entrada, alta de locales, panel, datos del local y mesas; después equipo, IA y CI | 🟡 En curso |
| **F2** Carta QR | `MENU-*` y, al final, la página mínima del local (WEB-16) | ⏳ Pendiente |
| **F3** Reservas | `RES-*`, empezando por RES-12 | ⏳ Pendiente |
| **Antes del piloto** | Stripe, RGPD, superadmin completo, panel instalable | ⏳ Pendiente |
| **F1** Webs | "Mi web" con visitas, plantilla, API pública | ⏳ Pendiente |
| **F5** | Aislamiento, copias, monitorización | ⏳ Pendiente |

Orden de construcción cambiado el 26/11/2026: después de F0 van la carta y las reservas; las webs de los locales se montan por fuera y quedan para el final (`01-contexto.md` §7).

---

## F0 · Fundaciones

### Hecho

#### 1. Monorepo y proyecto (21/11/2026)
- pnpm + Turborepo con `apps/platform` (Next.js 15.5, React 19.3, TypeScript estricto, Tailwind 4) y `packages/db`.
- Specs, diseño y `CLAUDE.md` en el repositorio. Skill `modern-web-guidance` para todo el frontend.
- Commits: `73fd5af`, `fa866f1`, `a943f7f`, `9ddfbc8`.

#### 2. Reglas de los slugs y resolución por dominio · PLT-01, 00-plataforma §5 (21/11/2026)
- Slugs de 3 a 40 caracteres `[a-z0-9-]`, sin guion al principio ni al final, y una lista de reservados que solo se amplía (`app`, `admin`, `api`, `www`, `panel`, `c`, `r`…). Sugerencia de slug desde el nombre ("Bar La Plaza Ñ" → `bar-la-plaza-n`).
- Función pura que decide qué servir según host y ruta: panel, superadmin, carta y reservas públicas, API pública, web mínima del local, redirección del panel o 404.
- Código: `modules/tenancy/domain/slug.ts`, `request-context.ts`. Commit `91e986d`.

#### 3. Base de datos y aislamiento entre locales · PLT §7 y §9 (PR #1, 21/11/2026)
- Prisma 7 con el adaptador `pg`, PostgreSQL en Neon (Fráncfort). Esquema completo del núcleo: `Tenant`, `User`, `Membership`, `Invitation`, `Venue`, `Table`, `FloorZone`, `TenantModule`, `Subscription`, `Domain`, `OutboxEvent`, `AuditLog`, `ProcessedWebhook`.
- **Dos barreras de aislamiento:** `getTenantDb(tenantId)` añade el `tenantId` a toda consulta y la ejecuta con el rol `cubierto_app` y `app.tenant_id` (RLS de PostgreSQL). `getSystemDb()` solo para tablas de plataforma, superadmin y procesos que recorren todos los locales.
- Tests de aislamiento (el local A no ve, cambia ni crea nada del B) y de cobertura de RLS (toda tabla con `tenantId` tiene política).
- Seed: dos locales de demo (Casa Brezo con los tres módulos, El Arco solo con carta) y un superadmin.
- Commits: `1f0fa32`, `67bc1f7`.

#### 4. Entrada al panel con enlace por email · PLT-02 (PR #2 y PR #3, 21–23/11/2026)
- Better Auth con el plugin `magic-link` (en lugar de Auth.js). Enlace de 15 minutos y un solo uso; del token solo se guarda el hash. Sin registro abierto: solo entran usuarios invitados o el superadmin.
- Pantalla "Entra en tu panel" y "Revisa tu correo" (vistas D5 y M10), accesible y usable sin JavaScript. La respuesta es la misma exista o no el email; como mucho un enlace por minuto al mismo email.
- **Envío directo, sin outbox ni cron:** hasta 3 intentos seguidos si el fallo es pasajero (red, 429, 5xx) con la misma clave de idempotencia; si no sale, se avisa y se puede pedir otro al momento. En local, el email sale por la consola.
- Commits: `5b4bc6f`, `cc5c1d4`, `946897e`, `508c6a5`.

#### 5. Outbox de notificaciones · PLT-08 (PR #3, 23/11/2026)
- Los efectos externos se guardan como `OutboxEvent` en la misma transacción que el cambio de datos y se envían justo después del commit (`dispatchOutboxEvent`, desde `after()`). Lo que falla queda para un barrido (`processDueOutboxEvents`) con reintentos de 1, 5, 15 y 60 minutos; tras 5 fallos, `FAILED`.
- Cada proceso reserva el evento antes de enviarlo: nunca se manda dos veces. Al enviarse, del evento se borra lo sensible (los enlaces).
- Cada tipo de evento registra cómo se entrega en `outbox-handlers.ts`. Hoy: `invitation.created`.
- `/api/cron/outbox` existe, protegido con `CRON_SECRET`, pero **no está programado**: ningún envío depende de un cron frecuente (ver Decisiones).

#### 6. Alta de un local e invitación · PLT-01, PLT-02, PLT-11 (PR #4, 23/11/2026)
- **Middleware:** `<slug>.cubierto.site/panel` redirige al panel (302, `noindex`); hosts y rutas que no son de la plataforma dan una 404 genérica que no dice si el local existe; las URL de Vercel de las previews se sirven como `app.`.
- **Superadmin (`/admin`):** lista de locales con sus módulos y el estado de la invitación del responsable, con "Reenviar invitación". Solo para usuarios con `isSuperadmin`; el resto ve una 404. Botón "Salir" en la cabecera.
- **Dar de alta un local (`/admin/locales/nuevo`):** nombre, slug (sugerido y validado), email del responsable, módulos iniciales y motivo. En una transacción: local, establecimiento vacío, módulos, invitación, evento de email y registro en auditoría.
- **Invitación:** caduca a los 7 días; abrirla no cambia nada (los antivirus del correo abren los enlaces) y se acepta con "Aceptar y entrar", que crea el usuario y su membresía y abre la sesión sin otro email. Caducada → "Enviarme otra invitación". Ya usada → "Entrar en el panel".
- Commits: `7febc13`, `d678d6a`.

#### 7. Panel del local y local activo · PLT-02 (PR #5, 25/11/2026)
- **Local activo en la sesión** (`Session.activeTenantId`), comprobado en cada petición contra las membresías del usuario: si le quitan el acceso o alguien cambia el valor, se ignora. Con un local se entra directo; con varios, se elige en `/panel/elegir-local` y se cambia desde el panel. El superadmin sin locales va a `/admin`.
- **Marco del panel** (vistas D6 y M11): en ordenador, barra lateral con el local, el menú, quién eres y "Salir"; en móvil, cabecera y barra inferior con Hoy, hasta tres apartados y "Más". Apartado actual marcado con `aria-current`; enlace "Saltar al contenido".
- **Menú según módulos y papel:** Reservas, Sala y Clientes con `RESERVATIONS`; Carta con `MENU`; Web y Mensajes con `SITE`; Ajustes solo para `OWNER`. Un apartado de un módulo que el local no tiene ofrece activarlo.
- Las pantallas de cada apartado están vacías por ahora ("en preparación").
- Commit: `13f2a06`.

#### 8. Datos, horario y cierres del local · PLT-04 (26/11/2026, PR pendiente)
- **Ajustes → El local** (`/panel/ajustes/local`), solo para el responsable.
- Datos: nombre, dirección, localidad, código postal, teléfono y WhatsApp (guardados en formato internacional, `+34` si no llevan prefijo) y email. Se ven al momento en la barra lateral.
- Horario: de 0 a 4 franjas por día, sin solapes; admite cierres de madrugada (20:00–02:00). Un día sin franjas sale como cerrado.
- Cierres: un día o un periodo de hasta 62 días, con motivo opcional; agrupados en la lista ("del 12 al 26 de enero"); nunca en el pasado; quitar es un borrado lógico.
- Tabla nueva `ClosedDate` con RLS; en F3 se añade el cierre de un solo turno.
- Commit: `8722a4c`.

#### 9. Mesas y QR · PLT-05 (26/11/2026, PR pendiente)
- **Ajustes → Mesas** (`/panel/ajustes/mesas`), solo para el responsable.
- Alta y edición: nombre o número (único en el local), zona opcional y plazas mínimas y máximas. Lista en orden natural, con las desactivadas al final.
- Las mesas no se borran: se desactivan y se reactivan.
- Cada mesa tiene un token de QR aleatorio (128 bits). "Regenerar QR" pide confirmación y avisa de que el QR impreso dejará de llevar a esa mesa (seguirá abriendo la carta). La lista enseña los primeros caracteres del token para ver que ha cambiado.
- Las imágenes de los QR y el PDF para imprimir llegan con la carta (MENU-08).

### Pendiente en F0
- **Equipo:** invitar, cambiar papeles y quitar accesos (PLT-03). ← siguiente
- **Base del servicio de IA** con proveedor simulado (AI-01 a AI-05, AI-08). Puede ir al final de F2, antes de la traducción.
- **CI** en GitHub Actions (lint, tipos, tests y migraciones automáticas) y **Sentry**.

---

## F2 · Carta QR · pendiente
Editor de carta y alérgenos, menú del día, agotados en servicio, códigos QR y traducción con IA. Al final, la página mínima del local (WEB-16) con el botón a la carta. Antes de imprimir el primer QR: cerrar la dirección pública de la carta.

## F3 · Reservas · pendiente
RES-12 (sin overbooking) primero; después reservar desde la web y el widget, emails, cancelación por enlace, vista del día, plano de sala, clientes, lista de espera y WhatsApp. Aquí llegan el barrido del outbox desde el panel, el cron diario y los recordatorios.

## Antes del piloto · pendiente
Stripe (PLT-06, PLT-07, `05-pagos.md`), RGPD (PLT-10), superadmin completo (PLT-09) y panel instalable (PLT-12).

## F1 · Webs · pendiente
"Mi web" en el panel con estado y visitas (WEB-15), plantilla Astro, API pública (WEB-13), ficha de la web en el superadmin (WEB-14) y formulario de contacto (FORM-*).

## F5 · pendiente
Pruebas de aislamiento, copias con restauración probada, monitorización con alertas.

---

## Decisiones tomadas por el camino

Las que han cambiado cómo funciona algo. La lista completa con fechas está en `00-necesidades.md` §7.

| Fecha | Decisión | Por qué |
|---|---|---|
| 22/11 | Better Auth en lugar de Auth.js | Auth.js está en mantenimiento y su v5 sigue en beta |
| 22/11 | La plataforma sigue en Vercel Hobby hasta estar completa | Pro se activa antes del piloto (uso comercial) |
| 23/11 | El enlace de entrada se envía directo, sin outbox ni cron | Caduca en 15 minutos: un reintento minutos después ya no sirve. Única excepción a la regla del outbox (CLAUDE.md §6.5) |
| 23/11 | Ningún envío depende de un cron cada minuto | Hobby solo admite crons diarios y un cron por minuto impide que Neon se suspenda (~19 $/mes). Plan: envío tras el commit, barrido desde el panel y un cron diario |
| 23/11 | Los módulos del alta se activan sin pago, con motivo (**a confirmar**) | Aún no hay Stripe |
| 23/11 | Aceptar una invitación abre la sesión sin otro email | Recibir el enlace en ese buzón ya comprueba el email |
| 25/11 | El local activo va en la sesión y se comprueba en cada petición | El `tenantId` nunca sale de la URL ni del navegador (CLAUDE.md §6.2) |
| 25/11 | Ajustes solo para el responsable | El personal no ve facturación ni equipo (00-plataforma §3) |
| 26/11 | Orden: F0 → carta → reservas → antes del piloto → webs → F5 | Las webs se montan por fuera y corren menos prisa |
| 26/11 | Los cierres son días enteros del local (`ClosedDate`) | No se duplican por módulo; F3 añade el cierre de un turno |
| 26/11 | Mesas en Ajustes → Mesas; no se borran, se desactivan | Un QR impreso no debe dar error nunca; la carta y las reservas comparten las mesas |

## Decisiones pendientes que afectan a lo construido
- Módulos activos sin pago en el alta (PLT-01).
- Si el personal necesita ver Ajustes de reservas (00-plataforma §10).
- Resend en las previews: clave aparte o sin envío.
- Recordatorios de reservas: el día anterior a la hora del turno, o el mismo día (RES-05).
- Dirección pública de la carta, antes de F2.

## Infraestructura y operación
- **Vercel** (Hobby): proyecto de la plataforma con `app.cubierto.site`. Variables necesarias: base de datos, Better Auth, `PLATFORM_DOMAIN`, `RESEND_API_KEY`, `EMAIL_FROM`, `CRON_SECRET`.
- **Neon:** rama `main` (producción) y `test` (tests). **Pendiente:** crear la rama `dev` para trabajar en local sin tocar producción.
- **Migraciones:** en producción se aplican a mano con `pnpm db:migrate:deploy` contra la conexión directa de `main` hasta que haya CI.
- **Resend:** dominio `cubierto.site` verificado; la plataforma necesita su propia clave en Vercel.
