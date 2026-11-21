# 03 · Reservas (`RESERVATIONS`)

**Estado:** Borrador v0.3 · **Fase:** F3 · **Depende de:** `00-plataforma.md`

## 1. Objetivo

Que un comensal reserve en menos de un minuto desde la web, Instagram o Google, y que el restaurante no vuelva a tener dobles reservas ni confirmaciones perdidas. Es el módulo más delicado: un fallo aquí hace perder al cliente, así que la corrección va por delante de las funcionalidades.

## 2. Alcance MVP

**Incluye:** turnos y capacidad por franja, página pública y widget incrustable, confirmación inmediata o manual, email de confirmación, recordatorio 24 h antes, cancelación por enlace, vista del día para sala, alta manual de reservas telefónicas y walk-ins, lista de espera simple, fichas básicas de cliente, días cerrados, botón "Reservar por WhatsApp" con enlace (RES-18).

**Incluye también:** plano de sala visual con el estado de cada mesa (RES-15), editor del plano (RES-16) y mesas juntas para grupos (RES-17).

**Fuera de alcance MVP:** asignación automática de mesas (la asignación, también de mesas juntas, es manual), tarjeta en garantía y cobro de no-shows, Reserve with Google, reservar dentro de WhatsApp (bot o formulario de WhatsApp) y avisos por la API de WhatsApp (ver §9), reservas de eventos o menús especiales con prepago, websockets, app móvil, encuestas post-visita.

## 3. Modelo de capacidad (MVP)

Disponibilidad **por plazas (cubiertos)**, no por mesas:

- Un **turno** (`Shift`) define días de la semana, hora de inicio de la primera reserva y hora de la última (`lastSeating`), intervalo de huecos (15 o 30 min) y dos límites:
  - `maxCoversPerSlot`: cubiertos máximos que pueden **empezar** en un mismo hueco (controla la entrada en cocina).
  - `maxConcurrentCovers`: cubiertos máximos sentados a la vez (aforo).
- Cada reserva ocupa desde su hora durante `durationMinutes` (por defecto según tamaño del grupo, ver `ReservationSettings`).
- Un hueco está disponible para un grupo de `n` personas si, al sumar `n`:
  1. los cubiertos que empiezan en ese hueco no superan `maxCoversPerSlot`, y
  2. en **todos** los intervalos que cubre la reserva, los cubiertos sentados no superan `maxConcurrentCovers`.
- Cuentan para capacidad las reservas en estado `PENDING`, `CONFIRMED` y `SEATED`.
- La asignación de mesa es **manual y opcional** por el personal, desde la lista o desde el plano (RES-15). Una reserva puede ocupar **una o varias mesas juntas** (RES-17). No afecta a la disponibilidad en el MVP.

## 4. Modelo de datos

```prisma
model ReservationSettings {
  tenantId          String  @id
  venueId           String
  autoConfirm       Boolean @default(true)     // false → entran como PENDING
  minAdvanceMinutes Int     @default(60)       // antelación mínima
  maxAdvanceDays    Int     @default(60)
  maxOnlinePartySize Int    @default(8)        // grupos mayores: "llámanos"
  durationByPartySize Json                     // [{ upTo: 2, minutes: 90 }, { upTo: 6, minutes: 120 }, { upTo: 99, minutes: 150 }]
  cancellationCutoffMinutes Int @default(120)  // hasta cuándo puede cancelar el comensal
  reminderEnabled   Boolean @default(true)
  whatsappEnabled   Boolean @default(false)   // avisos por WhatsApp: fase 2, no entra en el MVP (§9)
  whatsappMessage   String?                    // texto prerrellenado del enlace de RES-18 (≤ 200); vacío = texto por defecto
  policyText        String?                    // "Mantenemos la mesa 15 minutos"
}

model Shift {
  id                 String @id @default(cuid())
  tenantId           String
  venueId            String
  name               String                    // "Comidas", "Cenas"
  daysOfWeek         Int[]                     // 1 = lunes … 7 = domingo
  firstSeating       String                    // "13:00" hora local
  lastSeating        String                    // "15:30"
  slotIntervalMinutes Int @default(15)         // 15 | 30
  maxCoversPerSlot   Int
  maxConcurrentCovers Int
  validFrom          DateTime?
  validTo            DateTime?
  active             Boolean @default(true)
  @@index([tenantId, venueId])
}

model ClosedDate {
  id        String @id @default(cuid())
  tenantId  String
  venueId   String
  date      String                             // "2026-12-25" en hora local
  shiftId   String?                            // null = todo el día
  reason    String?
  @@unique([venueId, date, shiftId])
}

model Customer {
  id          String @id @default(cuid())
  tenantId    String
  name        String
  phone       String?                          // E.164
  email       String?
  notes       String?                          // notas internas del personal
  dietaryNotes String?                         // alergias declaradas: solo con consentimiento explícito
  dietaryConsentAt DateTime?
  marketingConsentAt DateTime?
  visitCount  Int @default(0)
  noShowCount Int @default(0)
  createdAt   DateTime @default(now())
  anonymizedAt DateTime?
  @@unique([tenantId, phone])
  @@index([tenantId, email])
}

model Reservation {
  id          String @id @default(cuid())
  tenantId    String
  venueId     String
  code        String                           // 6 caracteres legibles, único por tenant: "K7M2QX"
  customerId  String
  startsAt    DateTime                         // UTC
  durationMinutes Int
  partySize   Int
  status      ReservationStatus                // ver §5
  source      ReservationSource                // WEB | WIDGET | PHONE | WHATSAPP | WALK_IN | STAFF
  customerComment String?                      // lo que escribe el comensal (≤ 500)
  staffNotes  String?
  shiftId     String
  cancelTokenHash String @unique
  confirmedAt DateTime?
  cancelledAt DateTime?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  @@unique([tenantId, code])
  @@index([tenantId, venueId, startsAt])
  @@index([tenantId, status])
}

model ReservationTable {                 // mesas asignadas; varias filas = mesas juntas (RES-17)
  tenantId      String
  reservationId String
  tableId       String
  @@id([reservationId, tableId])
  @@index([tenantId, tableId])
}

model ReservationEvent {                       // historial de cambios para auditoría y soporte
  id            String @id @default(cuid())
  tenantId      String
  reservationId String
  type          String                         // "created", "status_changed", "edited"...
  actorUserId   String?                        // null = comensal o sistema
  data          Json?
  createdAt     DateTime @default(now())
  @@index([tenantId, reservationId])
}
```

## 5. Estados

| Estado | Significado | Cuenta en capacidad |
|---|---|---|
| `PENDING` | Pendiente de aprobación (si `autoConfirm = false`) | Sí |
| `CONFIRMED` | Confirmada | Sí |
| `SEATED` | El grupo ha llegado | Sí |
| `COMPLETED` | Mesa liberada | No |
| `NO_SHOW` | No se presentó | No |
| `CANCELLED_BY_CUSTOMER` | Cancelada por el comensal | No |
| `CANCELLED_BY_VENUE` | Cancelada o rechazada por el local | No |
| `WAITLIST` | En lista de espera | No |

Transiciones permitidas: `PENDING → CONFIRMED | CANCELLED_BY_VENUE`; `CONFIRMED → SEATED | NO_SHOW | CANCELLED_*`; `SEATED → COMPLETED`; `WAITLIST → CONFIRMED | CANCELLED_*`. Cualquier otra transición se rechaza con `INVALID_TRANSITION`. Cada cambio crea un `ReservationEvent`.

## 6. Historias de usuario

### RES-01 · Consultar disponibilidad
Como comensal quiero ver qué horas quedan libres para mi grupo.
- Entrada: fecha y número de personas. Salida: huecos disponibles agrupados por turno.
- Respeta `minAdvanceMinutes`, `maxAdvanceDays`, `ClosedDate`, `Shift.validFrom/validTo` y la zona horaria del local (incluido el cambio de hora de octubre y marzo).
- Grupos mayores que `maxOnlinePartySize` → mensaje "Para grupos de más de N personas, llámanos" con el teléfono del local, y el enlace de WhatsApp si el local lo tiene (RES-18).
- La disponibilidad es una lectura sin caché (o con caché ≤ 10 s); nunca se sirve una página estática con huecos.

### RES-02 · Reservar
Como comensal quiero reservar en menos de un minuto.
- Datos: nombre, teléfono (obligatorio, validado a E.164 con prefijo +34 por defecto), email (obligatorio para recibir confirmación), comentario opcional, casilla de privacidad obligatoria.
- Al confirmar se vuelve a comprobar la disponibilidad **dentro de la transacción** (RES-12). Si el hueco se llenó entre medias: mensaje "Esa hora acaba de completarse" + huecos alternativos cercanos.
- Se crea o reutiliza el `Customer` por `(tenantId, phone)`.
- Resultado: pantalla con código de reserva, resumen y "Añadir al calendario" (archivo `.ics`).
- Estado inicial: `CONFIRMED` si `autoConfirm`, si no `PENDING`.

### RES-03 · Email de confirmación
- `OutboxEvent` `reservation.created` en la misma transacción.
- Email con: local, fecha y hora local, personas, código, política del local, dirección con enlace a mapa, enlace para cancelar.
- Si es `PENDING`: email "Hemos recibido tu solicitud" y otro al confirmarla o rechazarla.
- WhatsApp equivalente si `whatsappEnabled` (fase 2, fuera del MVP).

### RES-04 · Aviso al restaurante
- Cada reserva online genera aviso al local (email; WhatsApp en fase 2) con los datos y enlace al panel.
- Las `PENDING` aparecen destacadas en el panel hasta que se aprueban o rechazan.

### RES-05 · Recordatorio
- 24 h antes (o a las 10:00 del día anterior si la reserva es antes de las 12:00 — ver preguntas abiertas), se envía recordatorio con enlace para cancelar.
- Lo dispara un cron cada 15 minutos que crea `OutboxEvent`s para las reservas que entran en la ventana; nunca se envían dos recordatorios para la misma reserva.
- No se envía si la reserva se hizo con menos de 24 h de antelación.

### RES-06 · Cancelar desde el enlace
- El enlace lleva un token aleatorio (se guarda solo su hash). Abre una página con el resumen y el botón "Cancelar reserva".
- Hasta `cancellationCutoffMinutes` antes: cancela, libera la capacidad y avisa al local. Después: muestra "Llama al restaurante" con el teléfono.
- Un token ya usado o inválido muestra un mensaje claro sin revelar datos.

### RES-07 · Widget incrustable
- Snippet: `<script src="https://app.<PLATFORM_DOMAIN>/embed.js" data-restaurant="<slug>" async></script>` que inserta un iframe a `app.<PLATFORM_DOMAIN>/r/<slug>?embed=1`.
- El iframe ajusta su altura al contenido (`postMessage`) y hereda el color de marca.
- Funciona en la web de la plataforma (`SITE`) y en webs externas del cliente.

### RES-08 · Vista del día (sala)
Como STAFF quiero ver todas las reservas del día y gestionarlas durante el servicio.
- `/panel/reservas`: selector de fecha, lista agrupada por turno y hora, con nombre, personas, estado, comentario y notas.
- Totales por turno: reservas, cubiertos, cubiertos sentados.
- Acciones de un toque: Sentar, Completar, No presentado, Cancelar; asignar mesa opcional.
- Refresco automático cada 20 s (TanStack Query) y al volver a la pestaña; indicador "Actualizado hace X s".
- Usable en tablet y móvil.

### RES-09 · Reserva manual y walk-in
- El personal crea reservas telefónicas (`source = PHONE`) o cerradas por chat de WhatsApp (`source = WHATSAPP`, ver RES-18) con los mismos datos; email opcional. El origen se elige en el formulario y por defecto es Teléfono.
- Por defecto se aplican las mismas reglas de capacidad; el OWNER puede forzar una reserva por encima de la capacidad con confirmación explícita ("Forzar") que queda registrada en `ReservationEvent`.
- Walk-in: alta rápida con personas y nombre opcional, directamente `SEATED`.

### RES-10 · Lista de espera
- Si no hay huecos, el comensal puede apuntarse a la lista de espera para un turno (estado `WAITLIST`).
- El personal ve la lista y la convierte en reserva confirmada (envía confirmación) o la descarta.
- Sin avisos automáticos de hueco liberado en el MVP.

### RES-11 · Configurar turnos y reglas
- El OWNER crea turnos, capacidades, duración por tamaño de grupo, antelaciones, días cerrados y textos de política.
- Cambiar la capacidad nunca cancela reservas existentes; si quedan reservas por encima del nuevo límite, se muestra un aviso con cuáles.
- Vista previa de huecos resultantes para un día elegido antes de guardar.

### RES-12 · Sin overbooking (concurrencia)
- La creación de una reserva (online, widget o manual sin "Forzar") ejecuta, en una única transacción:
  1. `pg_advisory_xact_lock` con una clave derivada de `(venueId, fecha local)`;
  2. recálculo de ocupación del día;
  3. inserción si cabe, o resultado `{ ok: false, code: "SLOT_FULL" }`.
- Lo mismo al editar fecha, hora o personas de una reserva y al pasar de `WAITLIST` a `CONFIRMED`.
- **Test obligatorio:** 20 peticiones simultáneas por el último hueco con capacidad para 2 grupos → exactamente 2 creadas, 18 `SLOT_FULL`.

### RES-13 · Fichas de cliente
- Lista de clientes con búsqueda por nombre, teléfono o email; ficha con historial de reservas, visitas, no-shows y notas internas.
- `dietaryNotes` (alergias o intolerancias declaradas) **solo** se guarda si el comensal marca una casilla de consentimiento explícito específica; sin ella, el campo no se muestra ni se guarda. Se trata como dato de salud: no aparece en listados, solo en la ficha y en la reserva del día.
- Anonimizar un cliente (RGPD) sustituye nombre, teléfono, email y notas por valores vacíos y conserva las reservas para estadísticas.

### RES-14 · Protección del formulario público
- Rate limit: 10 consultas de disponibilidad/minuto y 5 reservas/hora por IP y tenant.
- Campo trampa oculto; Cloudflare Turnstile activable por tenant si hay abuso.
- Un mismo teléfono no puede tener más de 2 reservas activas para el mismo día en el mismo local (mensaje claro).

### RES-15 · Plano de sala en tiempo de servicio
Como STAFF quiero ver el local dibujado con cada mesa y su estado para saber de un vistazo qué está libre, qué llega y qué está ocupado.
- `/panel/reservas/sala`: plano del local (una pestaña por zona si hay varias) con todas las mesas activas en su posición.
- Estado de cada mesa a la hora seleccionada (por defecto, ahora), calculado con las reservas que tienen mesa asignada (`ReservationTable`):
  - **Ocupada:** una reserva `SEATED`, o `CONFIRMED` cuyo intervalo `[startsAt, startsAt + durationMinutes)` contiene la hora.
  - **Llega pronto:** la próxima reserva `PENDING`/`CONFIRMED` empieza en los próximos 60 minutos.
  - **Libre:** ninguna de las anteriores.
- Selector de hora del día (franjas del turno) para ver cómo estará la sala más tarde.
- Tocar una mesa abre su ficha: reserva actual y siguiente (nombre, hora, personas, notas internas) y acciones de un toque: Sentar, Completar, No presentado, Sentar sin reserva (crea walk-in, RES-09).
- **Asignar mesa:** las reservas del día sin mesa aparecen en una lista lateral; se asignan arrastrándolas a una mesa o tocando reserva y luego mesa (para varias mesas, ver RES-17). Asignar mesas cuya suma de `maxSeats` es menor que `partySize`, o alguna con una reserva que se solapa, pide confirmación (no se bloquea, la sala manda).
- Totales: mesas en uso, personas sentadas y reservas que llegan en la próxima hora.
- Refresco como RES-08 (cada 20 s y al volver a la pestaña).
- Usable en tablet horizontal (uso principal) y en móvil con desplazamiento del plano; mesas de al menos 44 × 44 px en pantalla.
- Accesible: cada mesa es un control con nombre ("Mesa 5, 4 plazas, ocupada, Marta G. 13:00"); la vista de lista de RES-08 sigue disponible como alternativa.
- Mesas sin posición en el plano aparecen en una bandeja "Sin colocar" y siguen funcionando en la lista.

### RES-16 · Editor del plano
Como OWNER quiero dibujar mi local una vez con mis mesas reales.
- `/panel/ajustes/plano`: lienzo con cuadrícula (paso de 10 px, imán activado) por zona.
- Mesas: arrastrar, girar (pasos de 15°), cambiar forma (redonda, cuadrada, rectangular) y tamaño; duplicar; borrar del plano (no borra la mesa, la manda a "Sin colocar").
- Elementos fijos sin reservas: barra, cocina, pared, puerta, columna y texto libre, para que el plano se reconozca.
- Deshacer/rehacer al menos 20 pasos; "Guardar" valida y guarda todo el plano en una transacción; avisar si se sale con cambios sin guardar.
- El plano se guarda en coordenadas lógicas (lienzo de 1000 × 1000 por zona), independientes de la pantalla.
- Plantillas de arranque: "Bar con barra y mesas altas", "Restaurante en sala", "Terraza" (opcional en MVP).
- Solo OWNER; el STAFF ve el plano pero no lo edita.

### RES-17 · Mesas juntas
Como STAFF quiero juntar mesas para un grupo y que queden reservadas juntas.
- Una reserva puede tener asignadas varias mesas. **Las mesas juntas se reservan juntas:** comparten la misma reserva, el mismo estado y las mismas acciones.
- Asignar: en el plano, "Juntar mesas" permite tocar varias mesas y asignarlas a una reserva; también se pueden añadir o quitar mesas de una reserva desde su ficha.
- Capacidad: la del grupo es la suma de `maxSeats` de sus mesas; si es menor que `partySize`, se pide confirmación (como en RES-15).
- Solapes: si cualquiera de las mesas tiene otra reserva que se solapa en el tiempo, se avisa y se pide confirmación; nunca se reparte una reserva en mesas que el personal no ha elegido.
- Estado: todas las mesas del grupo muestran el estado de la reserva (llega pronto, ocupada, libre) y, en el plano, se dibujan unidas para que se vea que van juntas.
- Acciones: Sentar, Completar, No presentado o Liberar en cualquiera de las mesas se aplica a la reserva y, por tanto, a todas sus mesas a la vez.
- Fuera de la reserva las mesas vuelven a ser independientes: juntar mesas no cambia el plano guardado en RES-16.
- Totales: las personas de una reserva con mesas juntas se cuentan una sola vez; las mesas en uso cuentan cada mesa.

### RES-18 · Reservar por WhatsApp (enlace)
Como comensal que prefiere WhatsApp quiero escribir al local con un toque; como local quiero que esas conversaciones acaben en una reserva del sistema.
- Solo aparece si `Venue.whatsappPhone` tiene valor (E.164 validado). Sin número no se muestra nada.
- El botón abre `https://wa.me/<número sin +>?text=<mensaje>` con el mensaje codificado en URL. Mensaje por defecto: "Hola, quiero reservar mesa en {nombre del local}."; el OWNER lo cambia en `ReservationSettings.whatsappMessage` (≤ 200 caracteres).
- Dónde aparece:
  - Página pública de reservas y widget (RES-07): enlace secundario bajo el formulario, "¿Prefieres WhatsApp?". El formulario sigue siendo la vía principal.
  - Mensaje de grupos grandes (RES-01), junto al teléfono.
  - Web del local (`SITE`): CTA del hero y bloque `reservationCta` (tabla de bloques de `01-webs.md`).
- En `/panel/reservas`, botón "Copiar enlace de reserva" (URL pública de reservas del local) y un texto sugerido para pegar en la respuesta automática de WhatsApp Business: "Gracias por escribir a {local}. Puedes reservar en un minuto aquí: {enlace}. Si lo prefieres, dinos día, hora y cuántos sois."
- Las reservas que se cierran en el chat las apunta el personal con origen WhatsApp (RES-09). Pasan por las mismas reglas de capacidad (RES-12).
- La conversación ocurre en el WhatsApp del local: no se usa la API de Meta, no hay coste por mensaje y la plataforma no recibe el contenido del chat.
- Analítica: el clic cuenta como `whatsapp_click` (WEB-10).
- Accesibilidad: el nombre del enlace es "Reservar por WhatsApp (abre WhatsApp)".

**Decisión técnica:** el editor (RES-16) usa **Konva** con `react-konva` (arrastrar, girar y redimensionar con su `Transformer`, eventos táctiles incluidos), cargado solo en esa ruta con `next/dynamic` y `ssr: false`. La vista de servicio (RES-15) se dibuja en **SVG con React**, sin Konva: es solo lectura más toques, pesa menos, se ve nítida a cualquier tamaño y cada mesa es un elemento accesible. Antes de instalar, comprobar que la versión de `react-konva` admite la versión de React del proyecto (react-konva 19.x pide React ≥ 19.3).

## 7. Requisitos no funcionales específicos

- Cálculo de disponibilidad de un día < 200 ms con 200 reservas en BD para ese local.
- Todas las fechas se guardan en UTC y se convierten con `Venue.timezone`; tests que cubran los dos cambios de hora anuales.
- Ningún email ni WhatsApp se envía dentro de la transacción de reserva (solo outbox).
- Los datos de comensales son del restaurante; la plataforma los trata como encargada del tratamiento.

## 8. Tests clave

- RES-15: con una reserva `CONFIRMED` de 14:00 a 16:00 en la mesa 7, a las 13:30 sale "llega pronto", a las 15:00 "ocupada" y a las 16:00 "libre"; el STAFF del tenant B no ve el plano ni las mesas del tenant A.
- RES-17: una reserva de 8 personas en las mesas 9 y 10 (4 plazas cada una) pone ambas en "ocupada" a su hora; liberar la 10 libera también la 9; otra reserva que se solapa en la 9 pide confirmación; los totales cuentan 8 personas, no 16.
- RES-16: guardar un plano con dos mesas en la misma etiqueta falla sin guardar nada; una mesa borrada del plano sigue existiendo en "Sin colocar".

- RES-01: un turno de 13:00 a 15:30 con huecos de 15 min ofrece 11 horas; un `ClosedDate` lo elimina; el domingo 25 de octubre de 2026 (cambio de hora) calcula bien los huecos.
- RES-02/12: concurrencia (ver RES-12); hueco lleno entre consulta y reserva → `SLOT_FULL` con alternativas.
- RES-05: una reserva no recibe dos recordatorios aunque el cron se ejecute dos veces en la ventana.
- RES-18: sin `whatsappPhone` el enlace no se pinta; un nombre de local con acentos y "&" se codifica bien en `text`; una reserva manual con origen WhatsApp respeta la capacidad y aparece con ese origen en la lista.
- RES-06: cancelar después del límite → rechazado; token de otra reserva o de otro tenant → no revela datos.
- Aislamiento: el STAFF del tenant A no puede leer ni modificar reservas del tenant B ni conociendo su `id`.

## 9. Preguntas abiertas

- [ ] ¿Quién dibuja el plano en el alta: el cliente con el editor o tú durante la instalación? (Propuesta: tú, en la visita, y el cliente solo retoca.)
- [x] ~~¿Combinar mesas entra en esta fase?~~ Decidido el 13/11/2026: sí, las mesas juntas se reservan juntas (RES-17).
- [ ] ¿Guardamos combinaciones habituales en el editor (por ejemplo "9 + 10") para juntarlas de un toque, o se juntan siempre a mano?

- [ ] Recordatorio: ¿siempre 24 h antes o a una hora fija del día anterior?
- [ ] ¿Confirmación manual (`autoConfirm = false`) por defecto en algún tipo de local?
- [x] ~~¿WhatsApp en el MVP?~~ Decidido el 16/11/2026: solo el enlace "Reservar por WhatsApp" (RES-18), sin API ni coste.
- [ ] Fase 2, avisos por WhatsApp (confirmación, recordatorio, cancelación): ¿API directa de Meta o proveedor? Meta cobra por mensaje de plantilla; las respuestas en las 24 h siguientes a que escriba el cliente son gratis. Afecta al precio del módulo.
- [ ] Fase 3, reservar dentro de WhatsApp (formulario en el chat conectado a RES-12): requiere conectar el número de cada local a la API (coexistencia con la app de WhatsApp Business) y verificar la empresa en Meta. Decidir cuando lo pidan varios locales.
- [ ] ¿Se piden alergias en el formulario público o solo las anota el personal? (Implica consentimiento explícito y tratamiento de datos de salud.)
- [ ] Revisión legal del tratamiento de datos de comensales antes del piloto.
