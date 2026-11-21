# 01 · Webs a medida + mantenimiento (`SITE`)

**Estado:** Borrador v0.3 · **Fase:** F1 · **Depende de:** `00-plataforma.md`, `06-formulario-contacto.md`

> **Cambio de modelo (21/11/2026).** Las webs de los locales **no las sirve la plataforma**. Cada una es una **web Astro hecha a medida, en su propio repositorio y con su propio proyecto de Vercel**, como la web comercial `cubierto.site`. **Los cambios de la web los hace Manuel** dentro del mantenimiento; el dueño no la edita desde el panel. La plataforma Next.js guarda la ficha de cada web, da los datos públicos del local (WEB-13) y recoge las solicitudes de cambios (WEB-11). La v0.2 describía una plantilla con bloques editables dentro de la plataforma: esas historias quedan descartadas (§6).

## 1. Objetivo

Cada restaurante tiene una web diseñada para él, muy rápida (Lighthouse 100 como la web comercial), con su dominio y bien posicionada en Google. **Es una web de información, no de datos:** presenta el local, lleva a la carta y a las reservas y tiene un formulario de contacto. Textos, fotos y diseño los mantiene Manuel; los datos que el local ya mantiene en el panel para la carta y las reservas (horario, cierres, teléfono, WhatsApp) se leen de la plataforma al compilar, para no escribirlos dos veces.

**Condición para que sea Astro estático:** la web no muestra datos que cambien a diario. Carta, menú del día, agotados y disponibilidad de reservas viven en la plataforma y la web solo enlaza a ellos. Si un local necesitara contenido vivo en su web, se replantea.

## 2. Alcance MVP

**Incluye:** una web Astro estática por local, en su repositorio, a partir de un repositorio plantilla; diseño a medida; dominio propio con SSL; SEO local (metadata, sitemap, JSON-LD); datos del local desde la API pública al compilar; formulario de contacto (`06-formulario-contacto.md`); enlaces a carta, reservas y WhatsApp; analítica sin cookies; textos legales desde plantilla; acceso al panel desde la web; ficha de la web en el superadmin con aviso cuando cambian datos que salen en ella; pantalla "Mi web" en el panel; solicitudes de cambios con minutos.

**Fuera de alcance MVP:** que el dueño edite textos, fotos o diseño desde el panel; recompilar la web sola al guardar en el panel; carta, menú del día, platos destacados o agotados dentro de la web (se enlaza a la carta); disponibilidad de reservas dentro de la web (se enlaza o se usa el widget); editor visual, blog, tienda online, multidioma en la web (la carta sí es multidioma), email corporativo del dominio, importar webs existentes.

## 3. Cómo encaja

```
repo web-casa-brezo  ──su proyecto de Vercel──▶  casabrezo.es
repo web-el-arco     ──su proyecto de Vercel──▶  elarco.es
        │  nacen de
        └─ repo cubierto-web-plantilla   (estructura, SEO, legales, formulario, horario, botones, pie)
        │  al compilar leen
        ▼
app.cubierto.site/api/public/v1/venues/<slug>   ← la plataforma (datos que el local mantiene en su panel)
```

- **Una web = un repositorio = un proyecto de Vercel** con su dominio. No vive en el monorepo de la plataforma ni comparte despliegue con nada.
- **Las webs no tocan la base de datos** ni tienen secretos de la plataforma. Leen la API pública (WEB-13) y, en la fase 2 del formulario, envían mensajes con su clave (`SiteKey`, FORM-07).
- **Diseño a medida, base común.** Cada web tiene su diseño y sus textos. Lo que se repite en todas (horario, "Abierto ahora", botones de reservar y WhatsApp, pie con "Acceso del equipo", legales, JSON-LD, formulario) viene de la plantilla al crear la web. **Un arreglo en esas piezas se aplica en la plantilla y después web a web** (WEB-12).
- **Los cambios los hace Manuel** cuando toca: por una solicitud del local (WEB-11) o porque la plataforma avisa de que han cambiado datos que salen en la web (WEB-14). Cada cambio es un commit y un despliegue de esa web.

## 4. Estructura mínima de cada web

| Ruta | Contenido |
|---|---|
| `/` | Portada a medida |
| `/contacto/` | Datos del local, mapa, horario y formulario (`06`) |
| `/aviso-legal/`, `/privacidad/`, `/cookies/` | Desde la plantilla legal + datos del local |
| `/carta/` | Redirige a la carta pública del local en la plataforma si tiene `MENU` |
| `/reservar/` | Redirige a la página de reservas del local si tiene `RESERVATIONS` |
| `/panel` | Redirige a `app.cubierto.site/panel` (PLT-11) |
| `/api/contacto/` | Única ruta de servidor (`06`) |
| `/gracias/`, `/no-enviado/` | Destinos del formulario sin JavaScript (`noindex`) |
| `/sitemap-index.xml`, `/robots.txt` | Generados en cada web |

Pie común: datos del local, enlaces legales y "Acceso del equipo" (PLT-11). Más páginas (historia, eventos, galería) según el proyecto de cada local.

## 5. Modelo de datos (en la plataforma)

La web no tiene base de datos; la plataforma guarda su ficha.

```prisma
model Website {
  tenantId        String   @id
  repoUrl         String?                   // github.com/<cuenta>/web-<slug>
  primaryDomain   String?  @unique          // "casabrezo.es"; null mientras use la URL de Vercel
  vercelProjectId String?
  deployHookUrl   String?                   // cifrado en reposo; nunca se muestra entero
  lastDeployRequestedAt DateTime?
  publicDataChangedAt   DateTime?           // último cambio en datos que salen en la API pública (WEB-14)
  umamiWebsiteId  String?
  status          WebsiteStatus @default(IN_PROGRESS) // IN_PROGRESS | LIVE | PAUSED
  liveAt          DateTime?
  updatedAt       DateTime @updatedAt
}

model ContactSubmission { … }             // ver 06-formulario-contacto.md §5 (fase 2)
model SiteKey { … }                       // ver 06-formulario-contacto.md §5

model ChangeRequest {
  id        String @id @default(cuid())
  tenantId  String
  requestedBy String                      // userId
  description String
  attachments Json?                       // fotos o textos que manda el local
  status    ChangeRequestStatus @default(OPEN) // OPEN | IN_PROGRESS | DONE | REJECTED
  minutesSpent Int @default(0)
  createdAt DateTime @default(now())
  @@index([tenantId, status])
}
```

`SiteConfig` (bloques, temas, borrador y publicado) de la v0.2 desaparece. `MediaAsset` sigue existiendo para la carta (`02`).

## 6. Historias de usuario

### WEB-01 · Ver la web del restaurante
Como comensal quiero ver la web del restaurante en su dominio, rápida y con datos correctos.
- Cada web se sirve como HTML estático desde la CDN de Vercel; sin JavaScript de framework (solo scripts pequeños en los componentes que lo necesiten).
- Horario, cierres, teléfono, WhatsApp y los botones de carta y reservas salen de la API pública al compilar (WEB-13). La carta y las reservas se abren en la plataforma.
- "Abierto ahora / Cerrado" se calcula en el navegador a partir del horario incluido en la página, para que sea correcto aunque la web se compilara días antes.

### ~~WEB-02~~ (descartada el 21/11/2026: el dueño no edita la web desde el panel; los cambios van por WEB-11)
### ~~WEB-03~~ (descartada el 21/11/2026: no hay borrador ni botón de publicar; cada cambio es un despliegue de esa web)
### ~~WEB-04~~ (descartada el 21/11/2026: sin temas cerrados; cada web tiene diseño propio)

### WEB-05 · Imágenes
- Las fotos las manda el local (por WEB-11 o en la visita) y viven en el repositorio de su web.
- Se optimizan al compilar con `astro:assets` (AVIF/WebP, tamaños responsivos, `width`/`height` siempre) y `loading="lazy"` por debajo del pliegue.
- Texto alternativo obligatorio en todas las imágenes con contenido.

### WEB-06 · Formulario de contacto
Ver `06-formulario-contacto.md` (FORM-01 a FORM-08): fase 1 por email directo desde la web; fase 2 guardando en el panel del local (`ContactSubmission`, vista D15).

### WEB-07 · SEO local
- `title` y `meta description` propios en cada página (descripción ≤ 160 caracteres) y un único `<h1>` con la búsqueda objetivo.
- JSON-LD `Restaurant` con los datos de la API: nombre, dirección, teléfono, horario, `menu` (URL de la carta si hay) y `acceptsReservations`.
- Sitemap y `robots.txt` por web; canonical al dominio principal.
- Open Graph con imagen propia de cada web.
- Lighthouse móvil ≥ 95 en las cuatro categorías en `/` y `/contacto/` antes de cada despliegue a producción (CI de cada repositorio).

### WEB-08 · Dominio propio
Como superadmin quiero conectar el dominio del local a su web.
- El dominio se añade al **proyecto de Vercel de esa web** (no a la plataforma), con redirección `www` ↔ raíz.
- En la ficha del local (D21) el superadmin apunta `primaryDomain` y ve el estado del dominio; la comprobación usa la API de Vercel sobre `vercelProjectId`.
- Mientras no haya dominio propio, la web vive en la URL de Vercel y `<slug>.cubierto.site` muestra la página mínima (WEB-16).

### WEB-09 · Textos legales
- Aviso legal, privacidad y cookies salen de la plantilla legal con los datos del responsable (razón social, NIF/CIF, domicilio, email), que viven en la configuración de cada web.
- **La compilación falla** si falta alguno de esos datos: una web sin NIF no puede salir a producción.
- La política de privacidad incluye el tratamiento del formulario (FORM-08).
- Analítica sin cookies (Umami): sin banner salvo que una web añada un servicio con cookies (entonces, gestor de consentimiento como en la web comercial).

### WEB-10 · Analítica e informe mensual
- Cada web lleva el script de Umami con su `umamiWebsiteId` y eventos de clic en "Llamar", "Reservar", "Reservar por WhatsApp" y "Ver carta".
- El panel ("Mi web", WEB-15) muestra visitas de los últimos 30 días y esos clics, leídos de la API de Umami.
- El día 1 de cada mes, el OWNER recibe por email el resumen del mes anterior.

### WEB-11 · Solicitar cambios (mantenimiento)
Es la forma de cambiar textos, fotos o diseño de la web.
- El OWNER pide cambios desde `/panel/web/solicitudes` (texto + fotos o archivos). También valen WhatsApp o email; Manuel los apunta igual.
- El superadmin los gestiona, apunta minutos dedicados y cambia el estado; el OWNER ve el estado y el consumo del mes frente a lo incluido en la cuota.

### WEB-12 · Repositorio plantilla
Como Manuel quiero empezar cada web desde una base probada.
- Repositorio `cubierto-web-plantilla` (plantilla de GitHub): web Astro con la estructura de §4, SEO, legales (WEB-09), Umami (WEB-10), formulario (`06`), redirecciones `/carta/`, `/reservar/` y `/panel`, y estas piezas sin estilos impuestos (cada web las viste con sus tokens):
  - `getVenue(slug)`: lee la API pública al compilar, con tipos y validación (WEB-13).
  - `<OpeningHours />` y `<OpenNow />` (script pequeño).
  - `<ReserveButton />` y `<WhatsAppButton />` con la lógica de RES-18 (qué botón mostrar según módulos y número).
  - `<TeamAccessLink />` (pie, PLT-11), `restaurantJsonLd()` (WEB-07) y `<Analytics />` (WEB-10).
- Las piezas comunes van en `src/cubierto/` de cada web, con un `VERSION` y un `CHANGELOG.md`. **Cada web es independiente:** un arreglo en la plantilla no llega solo a las webs; se copia web a web cuando toca y se apunta la versión que lleva cada una.
- La plantilla lleva los tests de las piezas comunes (Vitest) y su propio Lighthouse en CI.

### WEB-13 · Datos del local para las webs (API pública)
- `GET app.cubierto.site/api/public/v1/venues/<slug>` devuelve, solo con datos públicos:
  - nombre, dirección, coordenadas, teléfono, `whatsappPhone` y mensaje de WhatsApp (RES-18);
  - horario semanal y cierres de los próximos 60 días, zona horaria;
  - módulos activos y enlaces: carta, reservas y WhatsApp (`wa.me`).
- Nada de la carta ni de las reservas: la web enlaza a ellas. Si en el futuro se añade algo, va en una versión nueva de la API.
- Sin datos personales, sin precios internos y sin nada de otros locales. `slug` inexistente o local sin `SITE` → `404`.
- Respuesta cacheable (`Cache-Control: public, s-maxage=60`), rate limit por IP, versión en la URL (`v1`) para no romper webs antiguas.
- Lo consume `getVenue()` al compilar; si la API falla, la compilación falla y sigue en línea la versión anterior de la web.

### WEB-14 · Aviso de datos cambiados y recompilar desde el superadmin
Como Manuel quiero saber cuándo la web de un local se ha quedado atrás y ponerla al día con un botón.
- Al guardar en el panel algo que sale en la API pública (datos del local, horario, cierres, WhatsApp, módulos), la plataforma fija `Website.publicDataChangedAt`.
- En el superadmin, la lista de locales y la ficha (D21) marcan "Datos cambiados desde la última compilación" cuando `publicDataChangedAt > lastDeployRequestedAt`.
- Botón "Recompilar web" en la ficha: llama al Deploy Hook de esa web (`deployHookUrl`) por el outbox (`website.rebuild`) y fija `lastDeployRequestedAt`. Un clic repetido en menos de 2 minutos no lanza otra compilación.
- **No hay recompilación automática** en el MVP: Manuel decide cuándo (21/11/2026). Un cierre de última hora en el panel ya se refleja en la carta y las reservas de la plataforma, que son las que miran disponibilidad.

### WEB-15 · "Mi web" en el panel
Como dueño quiero ver de un vistazo el estado de mi web.
- `/panel/web`: dirección de la web, visitas y clics del mes (WEB-10), mensajes recibidos (fase 2 de `06`) y solicitudes de cambios (WEB-11) con los minutos consumidos.
- Botón principal: "Pedir un cambio" (WEB-11).
- Sustituye a la vista D14 (editor de bloques) de las maquetas.

### WEB-16 · `<slug>.cubierto.site`
- Si el local **no tiene web propia** (sin `SITE` o en construcción): la plataforma muestra una página mínima con nombre, dirección, teléfono, horario y botones a carta, reservas y WhatsApp según sus módulos. Sirve como enlace para la ficha de Google.
- Si el local **tiene web publicada** (`Website.status = LIVE` y `primaryDomain`): redirección 301 a su dominio.

### WEB-17 · Alta de una web nueva
Lista de pasos del superadmin (y checklist en D22):
1. Crear el repositorio `web-<slug>` desde `cubierto-web-plantilla`, rellenar configuración (slug, datos legales, Umami) y diseñar.
2. Crear el proyecto de Vercel conectado a ese repositorio, región de funciones `fra1`, y las variables del formulario (FORM-05).
3. Crear el Deploy Hook y guardarlo en la ficha del local (`deployHookUrl`), con `repoUrl` y `vercelProjectId`.
4. Añadir el dominio (WEB-08) y comprobar Lighthouse (WEB-07).
5. Marcar `Website.status = LIVE`; `<slug>.cubierto.site` pasa a redirigir (WEB-16).

## 7. Requisitos no funcionales específicos

- Webs 100 % estáticas salvo `/api/contacto/`; ninguna llamada a la plataforma por visita.
- Peso de la portada < 300 KB transferidos sin contar imágenes por debajo del pliegue; JavaScript propio < 20 KB.
- Fuentes autoalojadas; sin scripts de terceros salvo Umami (y los que pase el gestor de consentimiento si una web los necesita).
- Accesibilidad AA, móvil primero (360 px sin scroll horizontal).

## 8. Tests clave

- WEB-13: un slug del tenant A nunca devuelve datos del tenant B; un local sin `SITE` → `404`; la respuesta no contiene emails, NIF, datos de comensales ni nada de la carta o las reservas.
- WEB-14: guardar el horario marca la web como "Datos cambiados"; "Recompilar web" llama una vez al Deploy Hook y quita la marca; dos clics en un minuto → una sola llamada.
- WEB-16: local sin web → página mínima; local `LIVE` con dominio → `301` a su dominio.
- WEB-09: una web sin NIF no compila (test de la plantilla).
- WEB-01: con el horario de un martes de 13:00 a 16:00, `<OpenNow />` dice "Abierto" a las 14:00 de Madrid y "Cerrado" a las 17:00, aunque la página se compilara el lunes.

## 9. Preguntas abiertas

- [x] ~~¿Monorepo con `apps/webs/*` o un repositorio por web?~~ Decidido el 21/11/2026: **un repositorio y un proyecto de Vercel por web**, independientes de la plataforma.
- [x] ~~¿La web se recompila sola al guardar en el panel?~~ Decidido el 21/11/2026: no; los cambios los hace Manuel cuando toca (WEB-14).
- [ ] ¿Quién compra y renueva el dominio: el cliente o Cubierto (incluido en la cuota)? La web comercial dice hoy que se registra a nombre del local.
- [ ] ¿Minutos de cambios incluidos en la cuota mensual? (propuesta: 60)
- [ ] **Propiedad del código:** si un local se da de baja, ¿se le entrega su web (repositorio y contenidos) o solo los textos y fotos? Afecta al contrato.
- [ ] ¿En qué cuenta viven los repositorios y los proyectos de Vercel de las webs (la de Cubierto, entendemos)? Comprobar límites de proyectos y minutos de compilación del plan con 30 webs antes de pasar de 10.
- [ ] Con WEB-04 descartada, ¿dónde se fijan el color y el logo que usan la carta y la página de reservas de cada local? Propuesta: campos `brandColor` (con contraste AA) y logo en `Venue`, que edita el superadmin.
- [ ] ¿Bloque de reseñas? Solo con reseñas reales de Google, nunca escritas a mano.
