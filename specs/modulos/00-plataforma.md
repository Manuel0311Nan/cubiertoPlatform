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
  addressLine String
  city      String
  postalCode String
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
- Formulario: nombre, slug (sugerido desde el nombre, editable, único, `[a-z0-9-]`, 3–40 caracteres), email del OWNER, módulos iniciales.
- Crea `Tenant`, `Venue` vacío, `Invitation` OWNER y envía el email de invitación (vía outbox).
- Slug reservado → error de validación. Lista completa en `../02-arquitectura.md` §7 (`app`, `admin`, `api`, `www`, `mail`, `panel`, `c`, `r`…); vive en una constante de `tenancy` y solo se amplía.

### PLT-02 · Aceptar invitación e iniciar sesión
- El enlace de invitación caduca a los 7 días; un enlace usado o caducado muestra un mensaje claro y la opción de pedir otro.
- Inicio de sesión por magic link (válido 15 minutos, un solo uso).
- Un usuario con varias membresías elige tenant tras iniciar sesión; la elección queda en la sesión.

### PLT-03 · Invitar y gestionar personal (OWNER)
- El OWNER invita por email con rol `OWNER` o `STAFF`, cambia roles y revoca accesos.
- No se puede quitar el último OWNER de un tenant.

### PLT-04 · Datos del local
- El OWNER edita nombre comercial, dirección, teléfono, email, horario semanal (varias franjas por día) y cierres puntuales.
- Estos datos alimentan la web, la carta y las reservas; no se duplican en cada módulo.

### PLT-05 · Mesas y QR
- El OWNER crea, edita y desactiva mesas (etiqueta, zona, plazas mín./máx.).
- Cada mesa tiene un `qrToken` aleatorio; regenerarlo invalida el QR anterior (con confirmación).
- La posición de las mesas en el plano y las zonas se editan desde el editor de RES-16 (`03-reservas.md`).

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
- Un proceso (cron cada minuto) toma eventos `PENDING` con `nextAttemptAt <= now`, los envía y los marca `SENT`.
- Reintentos con backoff exponencial (1, 5, 15, 60 minutos); tras 5 fallos → `FAILED` y alerta al superadmin.
- Canales: email (Resend), WhatsApp (webhook a n8n) y Deploy Hooks de Vercel para recompilar la web de un local cuando Manuel lo pide (`website.rebuild`, WEB-14). Plantillas en español con variables tipadas.

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
