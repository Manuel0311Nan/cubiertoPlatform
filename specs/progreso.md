# Progreso de la plataforma

**Última actualización:** 28/11/2026 (base del servicio de IA)

Qué está construido, fase a fase, qué hace cada pieza y qué decisiones se han tomado por el camino. Se actualiza en cada PR que añada o cambie funcionalidad (CLAUDE.md §9).

> Este archivo cuenta **lo que ya existe**. Lo que hay que construir y cómo debe comportarse está en las specs (`modulos/`); las decisiones con su fecha, en `00-necesidades.md` §7. Si algo de aquí contradice una spec, manda la spec y se corrige este archivo.

## Estado general

| Fase | Contenido | Estado |
|---|---|---|
| **F0** Fundaciones | Monorepo, base de datos, entrada, alta de locales, panel, datos del local, mesas, equipo y base de IA; falta CI y Sentry | 🟡 En curso |
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

#### 10. Equipo · PLT-03 (27/11/2026, PR pendiente)
- **Ajustes → Equipo** (`/panel/ajustes/equipo`, vista D19), solo para el responsable.
- Lista del equipo con papel, qué puede hacer cada papel y último acceso; invitaciones pendientes con "Reenviar" y "Cancelar invitación".
- Invitar por email como responsable o personal; avisa si ya está en el equipo o si ya tiene una invitación pendiente.
- Cambiar papel ("Pasar a personal" / "Pasar a responsable") y quitar el acceso con confirmación. Nadie se cambia ni se quita a sí mismo, y siempre queda al menos un responsable, también si dos lo intentan a la vez.
- Quitar el acceso no borra nada: la persona deja de entrar al momento y una invitación nueva la recupera. Cancelar una invitación invalida su enlace.
- Todo queda en la auditoría.
- Migración `20261127000000_team` (`Membership.deletedAt`, `Invitation.revokedAt`).
- **Por qué se mantiene (27/11, decisión de Manuel):** no era algo con lo que contara al principio, pero ya está hecho y probado. Sirve para que el personal entre con su propio email sin usar el correo ni la sesión del dueño (que da acceso a ajustes y plan), para quitar el acceso a quien deja el local y para saber quién hizo cada cosa. No es imprescindible: un bar pequeño donde el dueño lo lleva todo puede no usarlo nunca. Si sobra, se puede ocultar la pestaña "Equipo" hasta que un cliente lo pida.

#### 11. Base del servicio de IA · AI-01 a AI-05 y AI-08 (28/11/2026, PR pendiente)
Pieza interna, sin pantallas para el local todavía. La usará primero la traducción de la carta (MENU-07, F2).
- **`packages/ai`**: el único sitio con SDKs de proveedores (Vercel AI SDK 7 y `@ai-sdk/anthropic`). `runTask()` pide la salida estructurada y la valida con Zod; si no vale, la repite una vez (`AI_INVALID_OUTPUT`). Ante 429 o 5xx reintenta una vez y, si hay respaldo configurado, prueba el respaldo una vez. Tiempo máximo de 30 s por llamada.
- **Modelo por nivel desde el entorno** (`AI_MODEL_FAST`, `_STANDARD`, `_ADVANCED`): Haiku 5.5, Sonnet 5.5 y Opus 5.5 por defecto. Sin `ANTHROPIC_API_KEY`, todo devuelve `AI_DISABLED` sin romper nada.
- **Proveedor simulado (`mock`)** en tests, CI y previews de Vercel, siempre; en local también con `AI_PROVIDER=mock`. Pasa por el mismo camino que el real, con coste 0.
- **Precios** (`packages/ai/src/pricing.ts`) en dólares por millón de tokens, pasados a euros con un cambio fijo de 0,90 (algo alto a propósito). Revisar si cambian las tarifas.
- **Tareas registradas** en `modules/ai/tasks/`: `menu.translate` v1 (traduce textos de la carta a en/fr/de/it/pt, conserva los nombres marcados y comprueba que devuelve las mismas claves) con 6 casos en `evals.json`, y `system.ping` para "Probar conexión".
- **`runAiTask`**: antes de llamar comprueba IA activada para el local, tarea no desactivada, presupuesto del mes (2 € por defecto, mes en hora de Madrid), tope global y 20 llamadas por minuto. Cada llamada, también las fallidas, queda en `AiUsage` con tokens, modelo, coste y latencia, sin el texto (AI-07).
- **Tope global** `AI_GLOBAL_BUDGET_EUR`: aviso por email al superadmin al 80 % y al 100 % (una vez al mes cada uno, por la outbox); al 100 % se cortan las tareas no esenciales.
- **Trabajos en segundo plano** (`enqueueAiJob`, `processAiJob`, `processDueAiJobs`): la misma clave no duplica el trabajo; 3 intentos con espera de 1 y 5 minutos ante fallos pasajeros; un trabajo que se quedó a medias se recupera al caducar su reserva. Barrido en `/api/cron/ai-jobs` (con `CRON_SECRET`, sin programar todavía).
- **Superadmin → IA** (`/admin/ia`): modelo y respaldo de cada nivel, "Probar conexión" por nivel y gasto del mes frente al tope.
- **`pnpm ai:eval <tarea>`** ejecuta los evals contra el modelo real, a mano y nunca en CI. Una regla de ESLint impide importar SDKs de IA fuera de `packages/ai`.
- Migración `20261128000000_ai` (`AiSettings`, `AiUsage`, `AiJob`, con RLS).
- **Falta para usarla con clientes:** cómo ve el local su consumo (AI-03, pregunta abierta), el panel completo del superadmin (AI-09) y revisar las condiciones de datos de Anthropic antes de activarla en producción (AI-07).

### Pendiente en F0
- **CI** en GitHub Actions (lint, tipos, tests y migraciones automáticas) y **Sentry**. ← siguiente

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
| 27/11 | Equipo: nadie se cambia ni se quita a sí mismo; quitar el acceso es un borrado lógico | Evitar dejarse fuera por error; CLAUDE.md §11 |
| 27/11 | Se mantiene Equipo (PLT-03) aunque no estaba previsto por Manuel | Ya probado; cuentas propias para el personal sin compartir el correo del dueño. Opcional para el local |
| 28/11 | IA: 2 € al mes por local, solo Anthropic (sin respaldo configurado) y precios pasados a euros a 0,90 | Lo que proponía la spec; se revisa con el uso real (04-ia.md §8) |
| 28/11 | El mes del presupuesto de IA se cuenta en hora de Madrid | "Se renueva el día 1" para el local, no a la 1:00 de la madrugada |

## Decisiones pendientes que afectan a lo construido
- Módulos activos sin pago en el alta (PLT-01).
- Si el personal necesita ver Ajustes de reservas (00-plataforma §10).
- Resend en las previews: clave aparte o sin envío.
- Recordatorios de reservas: el día anterior a la hora del turno, o el mismo día (RES-05).
- Dirección pública de la carta, antes de F2.
- IA: si va incluida en los módulos o se vende aparte, y si el local ve su consumo (04-ia.md §8).

## Infraestructura y operación
- **Vercel** (Hobby): proyecto de la plataforma con `app.cubierto.site`. Variables necesarias: base de datos, Better Auth, `PLATFORM_DOMAIN`, `RESEND_API_KEY`, `EMAIL_FROM`, `CRON_SECRET`. Para la IA (opcional hasta F2): `ANTHROPIC_API_KEY` y `AI_GLOBAL_BUDGET_EUR`, solo en producción; las previews usan siempre el proveedor simulado.
- **Neon:** rama `main` (producción) y `test` (tests). **Pendiente:** crear la rama `dev` para trabajar en local sin tocar producción.
- **Migraciones:** en producción se aplican a mano con `pnpm db:migrate:deploy` contra la conexión directa de `main` hasta que haya CI.
- **Resend:** dominio `cubierto.site` verificado; la plataforma necesita su propia clave en Vercel.
- **Turborepo:** el cliente de Prisma (`packages/db/src/generated`) está declarado como salida de `@cubierto/db#build` (`packages/db/turbo.json`). Sin eso, cuando turbo reutilizaba la caché no lo recuperaba y la compilación de Vercel fallaba con `Can't resolve './generated/prisma/enums.ts'` (26/11/2026).
- **Pendiente:** cambiar `sslmode=require` por `sslmode=verify-full` en las cadenas de conexión antes de actualizar a `pg` 9 (hoy solo da un aviso).
