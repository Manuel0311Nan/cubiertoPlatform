# 01 · Webs + mantenimiento (`SITE`)

**Estado:** Borrador v0.2 · **Fase:** F1 · **Depende de:** `00-plataforma.md`

## 1. Objetivo

Cada restaurante tiene una web rápida, con su dominio, optimizada para SEO local y editable por el propio cliente dentro de unos bloques cerrados. Todas las webs salen de la misma aplicación: una mejora o un parche llega a todas con un solo despliegue.

## 2. Alcance MVP

**Incluye:** web de una página principal + páginas fijas (contacto y legales), editor de secciones por bloques, 3 temas visuales, dominio propio con SSL, subdominio de la plataforma si no hay dominio, SEO local (metadata, sitemap, JSON-LD), formulario de contacto con avisos, analítica sin cookies, textos legales a partir de plantillas, solicitud de cambios al mantenimiento.

**Fuera de alcance MVP:** maquetación libre o drag & drop, blog, tienda online, multidioma en la web (la carta sí es multidioma), páginas ilimitadas, editor de CSS, importar webs existentes, email corporativo del dominio.

## 3. Estructura de la web

| Ruta | Contenido |
|---|---|
| `/` | Home: secciones activas en el orden elegido |
| `/contacto` | Datos del local, mapa, horario, formulario |
| `/aviso-legal`, `/privacidad`, `/cookies` | Generadas desde plantillas + datos del tenant |
| `/carta` | Redirige a `app.<PLATFORM_DOMAIN>/c/<slug>` si `MENU` está activo; si no, 404 |
| `/reservar` | Redirige a `app.<PLATFORM_DOMAIN>/r/<slug>` si `RESERVATIONS` está activo; si no, 404 |
| `/panel` | Redirige al panel en `app.<PLATFORM_DOMAIN>` (PLT-11), con o sin `SITE` |
| `/sitemap.xml`, `/robots.txt` | Generados por tenant |

Pie común a todas las páginas: datos del local, enlaces legales y un enlace discreto "Acceso del equipo" al panel (PLT-11).

## 4. Bloques de la home

Cada bloque es un tipo cerrado con schema Zod. El cliente edita contenido, activa/desactiva y reordena; no edita diseño.

| Bloque | Campos | Notas |
|---|---|---|
| `hero` | título, subtítulo, imagen, CTA principal | CTA por defecto: "Reservar" si hay reservas; si no, "Reservar por WhatsApp" si el local tiene `whatsappPhone` (RES-18); si no, "Ver carta" si hay carta; si no, "Llamar" |
| `about` | título, texto (≤ 800 caracteres), imagen | |
| `gallery` | 3–12 imágenes con texto alternativo obligatorio | |
| `menuHighlights` | 3–6 platos elegidos de la carta | Solo disponible con `MENU`; datos leídos de la carta, no copiados |
| `hours` | — | Lee `Venue.openingHours` y cierres; muestra "Abierto ahora / Cerrado" |
| `location` | texto de cómo llegar | Mapa estático + enlace a Google Maps desde `Venue` |
| `reservationCta` | título, texto | Con `RESERVATIONS`: incrusta el widget o enlaza a `/reservar`, con el enlace de WhatsApp debajo si hay número. Sin `RESERVATIONS` pero con `whatsappPhone`: solo el botón "Reservar por WhatsApp" (RES-18) |
| `contactForm` | título, texto | Ver WEB-06 |
| `social` | enlaces a Instagram, Facebook, TikTok, Google | |

## 5. Modelo de datos

```prisma
model SiteConfig {
  tenantId     String   @id
  theme        SiteTheme                  // CLASSIC | MODERN | RUSTIC
  brandColor   String                     // hex, validado por contraste AA con el texto
  logoAssetId  String?
  faviconAssetId String?
  seoTitle     String?                    // por defecto: "<nombre> · Restaurante en <ciudad>"
  seoDescription String?                  // ≤ 160 caracteres
  blocks       Json                       // array ordenado de { id, type, enabled, data } validado con Zod
  publishedBlocks Json?                   // última versión publicada
  publishedAt  DateTime?
  umamiWebsiteId String?
  legalEntity  Json                       // razón social, NIF/CIF, domicilio, email legal
  updatedAt    DateTime @updatedAt
}

model ContactSubmission {
  id        String @id @default(cuid())
  tenantId  String
  name      String
  email     String?
  phone     String?
  message   String
  consentAt DateTime                      // checkbox de privacidad aceptado
  status    LeadStatus @default(NEW)      // NEW | HANDLED | SPAM
  createdAt DateTime @default(now())
  @@index([tenantId, createdAt])
}

model MediaAsset {                        // compartido con MENU
  id        String @id @default(cuid())
  tenantId  String
  url       String
  width     Int
  height    Int
  alt       String?
  bytes     Int
  createdAt DateTime @default(now())
  @@index([tenantId])
}

model ChangeRequest {
  id        String @id @default(cuid())
  tenantId  String
  requestedBy String                      // userId
  description String
  status    ChangeRequestStatus @default(OPEN) // OPEN | IN_PROGRESS | DONE | REJECTED
  minutesSpent Int @default(0)
  createdAt DateTime @default(now())
  @@index([tenantId, status])
}
```

## 6. Historias de usuario

### WEB-01 · Ver la web del restaurante
Como comensal quiero ver la web del restaurante en su dominio.
- El middleware resuelve el tenant por `Domain.hostname` o por `<slug>.<PLATFORM_DOMAIN>`.
- Se sirve la versión **publicada** (`publishedBlocks`), nunca el borrador.
- La página se genera estática y se revalida con el tag `tenant:<id>:site`.
- Sin `SITE` activo: el dominio propio muestra 404 genérico; el subdominio muestra una página mínima con nombre, dirección, teléfono y enlaces a carta/reservas si están activos.

### WEB-02 · Editar bloques
Como OWNER quiero cambiar textos, fotos y orden de las secciones sin llamar a nadie.
- Editor en `/panel/web`: lista de bloques con activar/desactivar, subir/bajar y formulario por bloque.
- Cada formulario valida con el schema Zod del bloque; los errores se muestran junto al campo.
- Guardar actualiza `blocks` (borrador). Hay vista previa del borrador en `/panel/web/preview`.

### WEB-03 · Publicar
- Botón "Publicar" copia `blocks` a `publishedBlocks`, fija `publishedAt` y revalida la caché.
- La web pública refleja el cambio en menos de 60 segundos.
- "Descartar cambios" restaura el borrador desde la versión publicada.

### WEB-04 · Tema e identidad
- El OWNER elige uno de 3 temas, color de marca, logo y favicon.
- Un color de marca que no cumpla contraste AA con el texto del tema se rechaza con sugerencia de uno cercano.

### WEB-05 · Imágenes
- Subida de JPG, PNG o WebP de hasta 8 MB; se rechaza cualquier otro tipo por contenido (no por extensión).
- Se guardan con dimensiones; se sirven con `next/image` en tamaños responsivos.
- Texto alternativo obligatorio en galería; recomendado en el resto.

### WEB-06 · Formulario de contacto
Como comensal quiero escribir al restaurante desde la web.
- Campos: nombre, email o teléfono (al menos uno), mensaje, casilla de privacidad obligatoria.
- Antispam: campo trampa oculto + rate limit de 5 envíos/hora por IP y tenant.
- Crea `ContactSubmission` y un `OutboxEvent` `lead.created` → email al email del local (y WhatsApp si el tenant lo activa).
- El OWNER ve los mensajes en `/panel/web/mensajes` y los marca como atendidos o spam.

### WEB-07 · SEO local
- `<title>` y `meta description` por defecto a partir de nombre, tipo y ciudad; editables.
- JSON-LD `Restaurant` con nombre, dirección, teléfono, horario, `servesCuisine` (opcional), `menu` (URL de la carta si hay) y `acceptsReservations`.
- `sitemap.xml` y `robots.txt` por tenant; canonical al dominio primario.
- Open Graph con imagen del hero.
- Lighthouse en móvil ≥ 90 en Performance, SEO y Accesibilidad para la plantilla de demo (comprobado en CI).

### WEB-08 · Dominio propio
Como superadmin quiero conectar el dominio del cliente sin tocar el servidor.
- En `/admin/tenants/<id>/dominios`: añadir hostname → llamada a la API de dominios de Vercel → instrucciones DNS (registros A/CNAME y TXT si hace falta).
- Botón "Comprobar" consulta la verificación; estados `PENDING_DNS`, `VERIFIED`, `ERROR` con el mensaje del proveedor.
- Al verificar, el certificado SSL lo emite Vercel; se marca primario y se configura la redirección `www` ↔ raíz.
- Las llamadas a la API respetan el límite de 100 altas de dominio por hora del equipo.

### WEB-09 · Textos legales
- Aviso legal, privacidad y cookies se generan desde plantillas con `legalEntity` y los datos del local.
- Si falta algún dato obligatorio (razón social, NIF/CIF, domicilio, email), la web no se puede publicar y el editor indica qué falta.
- La analítica es sin cookies (Umami), por lo que no se muestra banner de consentimiento salvo que un bloque futuro lo requiera.

### WEB-10 · Analítica e informe mensual
- Cada web tiene su `umamiWebsiteId` (alta automática vía API de Umami al activar `SITE`).
- El panel muestra visitas de los últimos 30 días y clics en "Llamar", "Reservar", "Reservar por WhatsApp" y "Ver carta".
- El día 1 de cada mes, n8n envía al OWNER un email con el resumen del mes anterior.

### WEB-11 · Solicitar cambios (mantenimiento)
- El OWNER pide cambios fuera de su alcance desde `/panel/web/solicitudes` (texto + adjunto opcional).
- El superadmin los gestiona, apunta minutos dedicados y cambia el estado; el OWNER ve el estado.
- El panel muestra el consumo del mes frente a lo incluido en la cuota (por ejemplo 60 min).

## 7. Requisitos no funcionales específicos

- Webs servidas estáticas (ISR); ninguna consulta a BD por visita salvo el formulario de contacto.
- Peso de la home en la plantilla de demo < 500 KB transferidos (sin contar imágenes de galería por debajo del pliegue).
- Fuentes autoalojadas con `next/font`; sin scripts de terceros salvo Umami.

## 8. Tests clave

- WEB-01: dos dominios de dos tenants devuelven contenidos distintos; un host desconocido devuelve 404 sin datos de nadie.
- WEB-03: un borrador sin publicar nunca aparece en la web pública.
- WEB-06: envío sin consentimiento → rechazado; sexto envío en una hora → 429.
- WEB-09: tenant sin NIF no puede publicar.

## 9. Preguntas abiertas

- [ ] ¿Quién compra y renueva el dominio: el cliente o tú (incluido en la cuota)?
- [ ] ¿Minutos de cambios incluidos en la cuota mensual? (propuesta: 60)
- [ ] ¿Se necesita un bloque de reseñas? Solo con reseñas reales importadas de Google, nunca escritas a mano.
- [ ] Diseño de los 3 temas: ¿partimos de tu plantilla `site.ts` actual?
