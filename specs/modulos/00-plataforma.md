# 00 · Plataforma común

**Estado:** Borrador v0.4 · **Fase:** F0 Fundaciones · **Owner:** Manuel

## 1. Objetivo

Dar a los tres módulos (`SITE`, `MENU`, `RESERVATIONS`) una base común: clientes (tenants), usuarios y permisos, contratación de módulos y cobro, locales y mesas, notificaciones y resolución de dominios. Debe soportar al menos 30 tenants sin cambios de arquitectura.

## 2. Alcance MVP

**Incluye:** tenants, locales (1 por tenant en el MVP), mesas, usuarios con roles, invitaciones, magic link, módulos contratables, suscripciones Stripe, outbox de notificaciones, resolución por dominio y slug, superadmin, auditoría básica, RGPD básico.

**Fuera de alcance MVP:** varios locales por tenant en la UI (el modelo lo permite), SSO, 2FA, facturación propia (Stripe genera las facturas), app móvil, API pública para terceros, permisos granulares más allá de los 3 roles.

## 3. Actores y roles

| Rol | Quién | Puede |
|---|---|---|
| `SUPERADMIN` | Manuel | Todo, en todos los tenants. Crear tenants, impersonar (con registro en auditoría), gestionar dominios y módulos |
| `OWNER` | Dueño o encargado del local | Todo dentro de su tenant: módulos, usuarios, facturación, datos |
| `STAFF` | Personal de sala | Operar reservas y marcar platos como agotados. No ve facturación ni usuarios |
| Visitante | Comensal o público | Ver web y carta, crear y cancelar su reserva |

## 4. Bounded contexts

| Contexto | Responsabilidad |
|---|---|
| `tenancy` | Tenant, dominios, slug, módulos activos, resolución de tenant |
| `identity` | Usuarios, membresías, invitaciones, sesión |
| `billing` | Planes, suscripciones Stripe, estado de pago → módulos |
| `venue` | Local (dirección, horario, zona horaria, contacto) y mesas |
| `notifications` | Outbox, plantillas, envío por email y WhatsApp |
| `sites`, `menu`, `reservations` | Ver specs 01, 02 y 03 |
| `ai` | Tareas de IA, uso y coste por tenant, presupuestos y trabajos en segundo plano. Ver spec 04 |

## 5. Resolución de tenant

`PLATFORM_DOMAIN = cubierto.site` (decidido el 16/11/2026). Mapa completo de dominios y DNS en `../02-arquitectura.md`.

El middleware decide el contexto a partir del host y la ruta:

| Host | Ruta | Contexto | Tenant |
|---|---|---|---|
| `app.<PLATFORM_DOMAIN>` | `/panel/**` | Panel | Membresía activa de la sesión |
| `app.<PLATFORM_DOMAIN>` | `/admin/**` | Superadmin | Ninguno (elige tenant) |
| `app.<PLATFORM_DOMAIN>` | `/c/<slug>/**` | Carta pública | Por `slug` |
| `app.<PLATFORM_DOMAIN>` | `/r/<slug>/**`, `/embed.js` | Reservas públicas y widget | Por `slug` |
| `app.<PLATFORM_DOMAIN>` | `/api/public/v1/**` | API pública para las webs de los locales (WEB-13) y recepción de sus mensajes (FORM-07) | Por `slug` o por `SiteKey` |
| `<slug>.<PLATFORM_DOMAIN>` | `/**` | Página mínima del local o redirección 301 a su web (WEB-16) | Por `slug` |
| `<slug>.<PLATFORM_DOMAIN>` | `/panel` | Redirección 302 a `app.<PLATFORM_DOMAIN>/panel` (PLT-11) | — |

**Las webs de los locales no las sirve la plataforma** (21/11/2026): son webs Astro a medida, cada una con su repositorio y su proyecto de Vercel, donde vive su dominio (`01-webs.md`). La plataforma les da datos públicos (WEB-13), guarda su ficha y permite recompilarlas desde el superadmin (WEB-14), y recibe sus mensajes en la fase 2 (FORM-07).

`<PLATFORM_DOMAIN>` y `www` (la raíz) son de la web comercial, otro proyecto: la plataforma no los atiende.

**Provisional:** carta y reservas públicas cuelgan de `app.` porque la raíz es de la web comercial. Confirmar antes de F2 (los QR impresos no cambian); alternativa en `../02-arquitectura.md` §4.

- La búsqueda slug → tenant se cachea (tag `tenancy:slugs`) y se invalida al cambiar el slug o el estado del local.
- Host desconocido → página 404 genérica de la plataforma, sin filtrar nombres de otros clientes.
- Tenant suspendido → página "Servicio temporalmente no disponible" (HTTP 503) en público.

## 6. Módulos y contratación

- Un tenant tiene 0..n `TenantModule` (`SITE`, `MENU`, `RESERVATIONS`), cada uno con estado `ACTIVE`, `PAST_DUE`, `SUSPENDED` o `CANCELED`.
- El estado lo deriva `billing` desde la suscripción de Stripe; el superadmin puede forzar `ACTIVE` (cortesía o piloto) con motivo obligatorio.
- `requireModule(tenant, module)` permite el acceso si el estado es `ACTIVE` o `PAST_DUE` (periodo de gracia).

| Estado Stripe | Estado módulo | Efecto |
|---|---|---|
| `trialing`, `active` | `ACTIVE` | Normal |
| `past_due` | `PAST_DUE` | Funciona; aviso en panel y email al OWNER |
| `past_due` > 14 días o `unpaid` | `SUSPENDED` | Público muestra 503 de ese módulo; panel en solo lectura |
| `canceled` | `CANCELED` | Igual que suspendido; datos conservados 90 días |

**Productos Stripe:** un precio mensual por módulo + un precio de pack que activa los tres, y las altas (web suelta y pack completo) como pago único en la primera factura. Catálogo, IVA, estados y facturas en `05-pagos.md` (BILL-01 a BILL-13).

## 7. Modelo de datos (núcleo)

Boceto de referencia; el `schema.prisma` final puede variar en nombres, no en significado.

```prisma
model Tenant {
  id          String   @id @default(cuid())
  slug        String   @unique            // usado en app.<PLATFORM_DOMAIN>/c/<slug>, /r/<slug> y <slug>.<PLATFORM_DOMAIN>
  name        String
  status      TenantStatus @default(ACTIVE) // ACTIVE | SUSPENDED
  stripeCustomerId String? @unique
  createdAt   DateTime @default(now())
  deletedAt   DateTime?
}

model Domain {                           // MVP: sin uso (el dominio de cada local va en el proyecto de Vercel de su web, WEB-08). Se reserva por si la plataforma vuelve a servir dominios propios.
  id        String  @id @default(cuid())
  tenantId  String
  hostname  String  @unique               // en minúsculas, sin www si se redirige
  isPrimary Boolean @default(false)
  status    DomainStatus                  // PENDING_DNS | VERIFIED | ERROR
  verifiedAt DateTime?
  @@index([tenantId])
}

model TenantModule {
  tenantId  String
  module    ModuleKey                     // SITE | MENU | RESERVATIONS
  status    ModuleStatus
  overrideReason String?                  // si lo activa el superadmin sin pago
  @@id([tenantId, module])
}

model Subscription {
  id                   String @id @default(cuid())
  tenantId             String
  stripeSubscriptionId String @unique
  stripeStatus         String
  currentPeriodEnd     DateTime
  items                Json                // price ids → módulos
  @@index([tenantId])
}

model User {
  id        String @id @default(cuid())
  email     String @unique
  name      String?
  isSuperadmin Boolean @default(false)
}

model Membership {
  userId   String
  tenantId String
  role     Role                            // OWNER | STAFF
  @@id([userId, tenantId])
  @@index([tenantId])
}

model Invitation {
  id        String @id @default(cuid())
  tenantId  String
  email     String
  role      Role
  tokenHash String @unique
  expiresAt DateTime                       // 7 días
  acceptedAt DateTime?
}

model Venue {
  id        String @id @default(cuid())
  tenantId  String
  name      String
  addressLine String?                     // opcionales hasta que el dueño los rellene (PLT-04): el alta crea el local vacío (PLT-01)
  city      String?
  postalCode String?
  phone     String?
  whatsappPhone String?                    // E.164; con valor, la web y las reservas muestran "Reservar por WhatsApp" (RES-18)
  email     String?
  timezone  String @default("Europe/Madrid")
  openingHours Json                        // por día de la semana, varias franjas
  lat       Float?
  lng       Float?
  @@index([tenantId])
}

model Table {
  id        String @id @default(cuid())
  tenantId  String
  venueId   String
  label     String                         // "5", "Terraza 2"
  zone      String?                        // "Sala", "Terraza"
  minSeats  Int @default(1)
  maxSeats  Int
  qrToken   String @unique                 // usado en la URL del QR, no adivinable
  active    Boolean @default(true)
  // Posición en el plano de sala (RES-15/16). null = "Sin colocar".
  floorZoneId String?
  shape     TableShape @default(SQUARE)    // ROUND | SQUARE | RECT
  x         Int?                           // centro, en coordenadas lógicas 0..1000
  y         Int?
  width     Int @default(60)
  height    Int @default(60)
  rotation  Int @default(0)                // grados, múltiplos de 15
  @@unique([venueId, label])
  @@index([tenantId])
}

model ClosedDate {                         // cierres puntuales (PLT-04); en F3 se añade shiftId (03-reservas §4)
  id        String @id @default(cuid())
  tenantId  String
  venueId   String
  date      String                         // "2026-12-25" en hora local
  reason    String?
  deletedAt DateTime?                      // borrado lógico desde el panel
  @@index([tenantId, venueId, date])
}

model FloorZone {                          // "Sala", "Terraza", "Planta alta"
  id        String @id @default(cuid())
  tenantId  String
  venueId   String
  name      String
  position  Int
  fixtures  Json                           // barra, cocina, paredes, puertas: [{ type, x, y, width, height, rotation, label }]
  updatedAt DateTime @updatedAt
  @@index([tenantId, venueId])
}

model OutboxEvent {
  id          String @id @default(cuid())
  tenantId    String?
  type        String                       // "reservation.confirmed", "lead.created"...
  payload     Json
  status      OutboxStatus @default(PENDING) // PENDING | SENT | FAILED
  attempts    Int @default(0)
  nextAttemptAt DateTime @default(now())
  createdAt   DateTime @default(now())
  @@index([status, nextAttemptAt])
}

model ProcessedWebhook {
  id        String @id                     // id del evento del proveedor
  source    String                         // "stripe" | "n8n"
  processedAt DateTime @default(now())
}

model AuditLog {
  id        String @id @default(cuid())
  tenantId  String?
  actorUserId String?
  action    String                         // "module.override", "impersonation.start"...
  data      Json?
  createdAt DateTime @default(now())
  @@index([tenantId, createdAt])
}
```

## 8. Historias de usuario

### PLT-01 · Crear tenant (superadmin)
Como superadmin quiero dar de alta un restaurante para empezar a configurarlo.
- Formulario: nombre, slug (sugerido desde el nombre, editable, único, `[a-z0-9-]` sin guion al principio ni al final porque es un subdominio, 3–40 caracteres), email del OWNER, módulos iniciales.
- Crea `Tenant`, `Venue` vacío, `Invitation` OWNER y envía el email de invitación (vía outbox).
- Slug reservado → error de validación. Lista completa en `../02-arquitectura.md` §7 (`app`, `admin`, `api`, `www`, `mail`, `panel`, `c`, `r`…); vive en una constante de `tenancy` y solo se amplía.
- Slug que ya tiene otro local → error en el campo, sin crear nada.
- **Módulos iniciales (23/11/2026, a confirmar):** hasta que exista el cobro (BILL-03), se activan como `ACTIVE` sin pago, igual que una activación manual del superadmin (§6): el formulario pide motivo (piloto, cortesía…) si se elige alguno y se guarda en `overrideReason`. Cuando llegue Stripe, el alta de pago los activará por el webhook.
- Todo en una transacción, con registro `tenant.created` en `AuditLog`. El email de invitación sale justo después (PLT-08); en la lista de locales, "Reenviar invitación" manda otro enlace mientras no se haya aceptado (el anterior deja de valer).

### PLT-02 · Aceptar invitación e iniciar sesión
- El enlace de invitación caduca a los 7 días; un enlace usado o caducado muestra un mensaje claro y la opción de pedir otro.
- Abrir el enlace no cambia nada (los antivirus del correo abren los enlaces): la pantalla dice de qué local es, con qué papel y para qué email, y se acepta con "Aceptar y entrar". Aceptar crea el usuario si no existe y su membresía, y **abre la sesión en el momento**, sin otro email: recibir el enlace en ese buzón ya comprueba el email (23/11/2026).
- Caducado y sin aceptar → "Enviarme otra invitación" manda un enlace nuevo al mismo email (el viejo deja de valer). Ya aceptado → "Entrar en el panel" (enlace de entrada). Un enlace que no existe no dice nada del local.
- Del token solo se guarda el hash (SHA-256).
- Inicio de sesión por magic link (válido 15 minutos, un solo uso).
- El enlace se envía **directo, sin outbox ni cron** (22/11/2026): hasta 3 intentos seguidos si el fallo es pasajero (red, 429, 5xx), con la misma clave de idempotencia. Si no sale, la pantalla dice "No hemos podido enviar el enlace" y el enlace que no salió se borra, para que se pueda pedir otro al momento sin esperar el minuto entre enlaces. El enlace no se guarda en ninguna tabla nuestra (Better Auth guarda solo el hash del token).
- Un usuario con varias membresías elige tenant tras iniciar sesión; la elección queda en la sesión.
- **Local activo (25/11/2026):** se guarda en `Session.activeTenantId` y en cada petición se comprueba que el usuario sigue teniendo membresía en ese local; si no (le han quitado el acceso o el local se ha borrado), se olvida. Con un solo local se elige solo; con varios, `/panel/elegir-local` y "Cambiar de local" en el panel. Sin ningún local: el superadmin va a `/admin` y el resto ve "Aún no tienes acceso a ningún local".
- **Menú del panel (vistas D6 y M11):** Hoy siempre; Reservas, Sala y Clientes con `RESERVATIONS`; Carta con `MENU`; Web y Mensajes con `SITE`; Ajustes solo para `OWNER` (contiene facturación y equipo, que `STAFF` no ve, §3). Un apartado de un módulo que el local no tiene no sale en el menú y, si se abre su dirección, ofrece activarlo (CLAUDE.md §6.4). En móvil, la barra inferior lleva Hoy, hasta tres apartados de sus módulos y "Más" con el resto.

### PLT-03 · Invitar y gestionar personal (OWNER)
- El OWNER invita por email con rol `OWNER` o `STAFF`, cambia roles y revoca accesos.
- No se puede quitar el último OWNER de un tenant.

### PLT-04 · Datos del local
- El OWNER edita nombre comercial, dirección, teléfono, email, horario semanal (varias franjas por día) y cierres puntuales.
- Estos datos alimentan la web, la carta y las reservas; no se duplican en cada módulo.
- **Implementado el 26/11/2026** en Ajustes → El local (`/panel/ajustes/local`), solo para `OWNER`:
  - Datos: nombre, dirección, localidad, código postal (5 cifras), teléfono y WhatsApp (a E.164, `+34` si no llevan prefijo, como RES-02) y email. Nombre obligatorio; el resto, opcional.
  - Horario: de 0 a 4 franjas por día, sin solapes. Una franja que cierra de madrugada ("20:00"–"02:00") vale si es la última del día. Se guarda en `Venue.openingHours` como `{ "1": [{ "open": "13:00", "close": "16:00" }], … }`, con los días como `Shift.daysOfWeek` (1 = lunes). Un día sin franjas está cerrado.
  - Cierres: un día o un periodo de hasta 62 días, con motivo opcional que solo ve el local; nunca en el pasado. Se guarda un `ClosedDate` por día (el local cierra entero); quitarlo es un borrado lógico. Se muestran agrupados ("del 12 al 26 de enero").

### PLT-05 · Mesas y QR
- El OWNER crea, edita y desactiva mesas (etiqueta, zona, plazas mín./máx.).
- Cada mesa tiene un `qrToken` aleatorio; regenerarlo invalida el QR anterior (con confirmación).
- La posición de las mesas en el plano y las zonas se editan desde el editor de RES-16 (`03-reservas.md`).
- **Implementado el 26/11/2026** en Ajustes → Mesas (`/panel/ajustes/mesas`), solo para `OWNER`:
  - Etiqueta (hasta 20 caracteres, única en el local), zona opcional en texto libre y plazas de 1 a 50 (máximas ≥ mínimas). Lista en orden natural ("2" antes que "10"), las desactivadas al final.
  - Las mesas no se borran: se desactivan y se pueden volver a activar. Editar o desactivar no cambia el QR.
  - `qrToken`: 128 bits aleatorios en 22 caracteres (base64url). "Regenerar QR" pide confirmación en una pantalla aparte y explica que el QR impreso seguirá abriendo la carta, pero sin mesa (MENU-01). La lista enseña los 6 primeros caracteres del token para ver que ha cambiado.
  - Las imágenes del QR y el PDF para imprimir son de MENU-08 (F2).

### PLT-06 · Contratar y cambiar módulos
Detalle en `05-pagos.md` (BILL-03 a BILL-07).
- El OWNER ve sus módulos, precio y estado, y abre el portal de cliente de Stripe para pagar, cambiar método de pago o cancelar.
- Contratar un módulo nuevo usa Stripe Checkout; al volver, el módulo aparece activo en cuanto llega el webhook (la pantalla muestra "Activando…" hasta entonces).

### PLT-07 · Sincronizar estado de pago
Detalle y lista completa de eventos en `05-pagos.md` (BILL-08 y BILL-09).
- El webhook de Stripe (`customer.subscription.*`, `invoice.paid`, `invoice.payment_failed`) actualiza `Subscription` y `TenantModule` según la tabla de la sección 6.
- Webhook repetido → se ignora sin efectos (idempotencia por `ProcessedWebhook`).
- Firma inválida → 400 y registro en Sentry.

### PLT-08 · Outbox de notificaciones
- Los casos de uso guardan el `OutboxEvent` en la misma transacción que el cambio de datos y, **después del commit**, lo envían al momento (`dispatchOutboxEvent`, desde `after()` de Next para no hacer esperar la respuesta). Lo que falla o se programa para más tarde lo recoge un barrido (`processDueOutboxEvents`): toma los `PENDING` con `nextAttemptAt <= now`, los envía y los marca `SENT`. Cuándo se barre: "Envíos sin cron cada minuto", más abajo.
- Cada proceso reserva el evento antes de enviarlo, para no mandarlo dos veces.
- Al enviarse o fallar del todo, del evento se borra lo que no debe quedarse guardado (cada tipo de evento dice qué).
- Reintentos con backoff exponencial (1, 5, 15, 60 minutos); tras 5 fallos → `FAILED` y alerta al superadmin. Un evento que ya no sirve (p. ej. el recordatorio de una reserva cancelada) pasa a `FAILED` sin reintentos.
- Cada tipo de evento registra cómo se entrega en `notifications/application/outbox-handlers.ts`; un tipo sin registrar queda `FAILED`.
- El enlace de entrada (PLT-02) no pasa por el outbox desde el 22/11/2026: se envía directo.
- Canales: email (Resend), WhatsApp (webhook a n8n) y Deploy Hooks de Vercel para recompilar la web de un local cuando Manuel lo pide (`website.rebuild`, WEB-14). Plantillas en español con variables tipadas.

**Envíos sin cron cada minuto (22/11/2026).** Ningún envío depende de un cron frecuente: Vercel Hobby solo admite crons diarios, y un cron cada minuto no deja que Neon se suspenda (lo hace tras 5 minutos sin uso), unos 19 $/mes de cómputo a 0,25 CU en Launch sin clientes. El primer evento es la invitación de PLT-01 (`invitation.created`, 23/11/2026), que sale al momento; si falla, el superadmin la reenvía desde la lista de locales. `/api/cron/outbox` no está programado en `vercel.json`; se puede llamar a mano con `CRON_SECRET`. Con reservas (F3) funciona así:

1. **Al momento, tras el commit.** Confirmación y "Hemos recibido tu solicitud" (RES-03), aviso al local (RES-04), confirmar o rechazar una `PENDING`, cancelación (RES-06) e invitaciones (PLT-01, ya en marcha, y PLT-03): el caso de uso guarda el evento en su transacción y lo envía con `after(() => dispatchOutboxEvent(id))`. Es el camino normal: casi todo sale aquí.
2. **Barrido oportunista.** Las peticiones que ya tienen la base de datos despierta (el panel, sobre todo la vista del día de sala, que refresca cada 20 s durante el servicio, RES-08; y la página pública de reservas) lanzan con `after()` un barrido corto (`processDueOutboxEvents`, 5 eventos), como mucho una vez por minuto por instancia. No cuesta nada de más y cumple los reintentos de 1, 5 y 15 minutos mientras haya actividad, que es justo cuando hay reservas.
3. **Un cron diario** (Hobby lo admite), `/api/cron/daily` a las 8:00 UTC (9:00 en Madrid en invierno, 10:00 en verano; en Hobby salta en cualquier momento de esa hora): crea y envía los recordatorios de las reservas del día siguiente (RES-05), barre el outbox como red de seguridad y, más adelante, hace las tareas diarias de pagos (`05-pagos.md`). Una sola ruta para todo lo diario.

Consecuencias que se aceptan:
- El recordatorio sale a una hora fija del día anterior, no 24 h exactas antes (propuesta, pendiente de confirmar en `03-reservas.md` §9). Una reserva hecha para mañana después del cron no recibe recordatorio, igual que las hechas con menos de 24 h.
- Si un email falla y no hay actividad en la plataforma, el reintento espera al cron de la mañana. Lo mitiga que el comensal ya tiene el código y el `.ics` en la pantalla de confirmación (RES-02) y que el local ve las reservas y las `PENDING` en el panel aunque su email falle (RES-04).

Cuándo cambiarlo, en este orden:
- **Vercel Schedules** (beta, sustituye a los Cron Jobs): en Hobby admite un schedule cada 15 minutos con 15 de margen, y schedules de una sola vez a una hora concreta con zona horaria (con Vercel Queues), útiles para un recordatorio exacto por reserva. Límite en Hobby: 500 schedules creados y 5.000 ejecuciones al mes.
- **En Vercel Pro:** cron cada minuto solo de día (`* 7-23 * * *`, UTC) si los datos lo piden; pasar a Pro (uso comercial) no obliga a subirlo.
- **En el VPS** (`anexos/alojamiento-vps.md`): *Scheduled tasks* de Coolify llamando a las mismas rutas `/api/cron/*`.

### PLT-09 · Superadmin
- Lista de tenants con estado, módulos, dominio y fecha de alta; búsqueda por nombre o slug.
- Impersonación de un tenant en modo lectura por defecto; cada inicio y fin queda en `AuditLog`.
- Activar o suspender módulos manualmente con motivo obligatorio.

### PLT-10 · RGPD
- Exportar en JSON los datos personales de un comensal o usuario a petición (superadmin).
- Borrado/anonimización de un comensal a petición, registrado en auditoría.
- Los datos de un tenant cancelado se anonimizan a los 90 días (proceso programado).
- Plantillas de contrato de encargo de tratamiento (la plataforma trata datos de los comensales por cuenta del restaurante) — **pendiente de texto legal**.

### PLT-11 · Acceso al panel desde la web del local
Como dueño o empleado quiero llegar al panel desde la web de mi local sin recordar otra dirección.
- `/panel` en la web del local redirige a `app.<PLATFORM_DOMAIN>/panel`: la redirección viene en la plantilla de las webs (WEB-12). En `<slug>.<PLATFORM_DOMAIN>` la hace la plataforma con un 302, aunque el local no tenga `SITE` activo.
- El pie de la web del local (`<TeamAccessLink />` de la plantilla) y el de la página mínima (WEB-16) muestran un enlace discreto "Acceso del equipo" a `app.<PLATFORM_DOMAIN>/panel`.
- El panel nunca se sirve dentro del dominio de un local: la sesión, las cookies y el enlace de entrada son solo de `app.<PLATFORM_DOMAIN>`.
- `/panel` en el dominio de un local no se indexa (`X-Robots-Tag: noindex` en la redirección).

### PLT-12 · Panel instalable como app
Como encargado quiero tener el panel en la pantalla de inicio de la tablet de sala y de mi móvil.
- `app.<PLATFORM_DOMAIN>` sirve un manifest con el nombre "Cubierto", los iconos de la marca (`../diseno/marca/`) y `start_url` `/panel`.
- Al abrir la app instalada sin sesión, lleva a la pantalla de entrada; con sesión, a "Hoy" del local activo.
- Sin funcionamiento sin conexión en el MVP: si no hay red, una pantalla clara de "Sin conexión" en lugar del error del navegador.

## 9. Requisitos no funcionales

| Área | Requisito |
|---|---|
| Disponibilidad | Objetivo comercial 99,5 % mensual en páginas públicas |
| Rendimiento | Páginas públicas: LCP < 2,5 s en 4G y móvil medio; TTFB < 500 ms desde España con caché caliente |
| Región | Funciones Vercel en `fra1`; Neon en Frankfurt |
| Aislamiento | Ninguna consulta de datos de cliente sin `tenantId`; RLS activo; test de aislamiento por repositorio |
| Seguridad | Cookies `HttpOnly`/`Secure`/`SameSite=Lax`; CSRF cubierto por Server Actions; rate limit en endpoints públicos (por IP y por tenant) |
| Copias | Historial de Neon (7 días en Launch, 30 en Scale) + volcado diario a R2; prueba de restauración mensual |
| Observabilidad | Sentry con `tenantId` como tag; logs estructurados; monitor externo de disponibilidad con alerta al móvil |
| Accesibilidad | WCAG 2.1 AA en páginas públicas |
| Idioma | UI en español; estructura i18n lista para inglés |

## 10. Preguntas abiertas

- [x] ~~Nombre comercial y `PLATFORM_DOMAIN`~~ Decidido el 16/11/2026: Cubierto, `cubierto.site` (pendiente la comprobación de marca en OEPM/EUIPO).
- [ ] Dirección pública de carta y reservas: `app.<PLATFORM_DOMAIN>/c|r/<slug>` (provisional) o `<slug>.<PLATFORM_DOMAIN>/carta|reservar`. Cerrar antes de F2.
- [ ] Textos legales: condiciones del servicio, encargo de tratamiento, política de privacidad de la plataforma.
- [ ] ¿Periodo de prueba gratuito? ¿De cuántos días y para qué módulos?
- [ ] ¿Precio anual con descuento desde el MVP o más adelante?
- [ ] Impago del módulo `SITE`: la web es un despliegue aparte y no se apaga sola. ¿Se pausa a mano su proyecto de Vercel, se muestra un aviso o se deja la web y solo se corta el mantenimiento?
- [ ] Ajustes de reservas (RES-11): hoy Ajustes es solo de `OWNER`. ¿El encargado con papel `STAFF` necesita cambiar algo de ahí (días cerrados, por ejemplo)? Relacionado con el tercer papel de la vista D19 (`diseno/README.md` §5).
- [ ] ¿Cuánto dura la sesión del panel? Hoy, 7 días desde el último uso (lo que trae Better Auth). En la tablet de sala quizá convenga más.
