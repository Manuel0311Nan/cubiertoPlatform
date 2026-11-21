# 06 · Formulario de contacto en las webs Astro de los locales

**Estado:** Borrador v0.2 (21/11/2026) · **Fase:** F1 (con las webs) · **Depende de:** `01-webs.md` (WEB-06), `00-plataforma.md`

**Origen:** las webs de los locales se hacen en **Astro**, igual que la web comercial `cubierto.site`, cada una en su repositorio y con su proyecto de Vercel (`01-webs.md` v0.3, 21/11/2026). El formulario funciona como el de esa web: una única ruta de servidor dentro de la web, sin n8n. Esta spec lo describe para que todas las webs lo lleven igual; el código viene en el repositorio plantilla (`cubierto-web-plantilla`, WEB-12).

## 1. Objetivo

Que un comensal escriba al restaurante desde su web en menos de un minuto y que el mensaje llegue siempre al local, sin depender de servicios intermedios ni de que haya JavaScript. El local responde directamente al comensal desde su correo.

## 2. Alcance

**Incluye:** formulario accesible, validación en el navegador y en el servidor, envío por email con Resend, funcionamiento sin JavaScript, protección contra spam, configuración por local con variables de entorno, el mismo código en todas las webs (desde la plantilla), y (fase 2) registro del mensaje en el panel del local.

**Fuera de alcance:** reservas por el formulario (para eso están el módulo de reservas y el enlace de WhatsApp, RES-18), adjuntos, respuestas automáticas al comensal, captcha de terceros, suscripción a novedades, CRM.

## 3. Cómo funciona

```
Navegador ──POST──▶ /api/contacto/ (función de Vercel dentro de la web Astro del local)
                       │  valida, filtra spam
                       ├─ Fase 1: email al local con la API de Resend
                       └─ Fase 2: POST a la plataforma (app.cubierto.site) → ContactSubmission + outbox → email
```

- La web sigue siendo **estática**; solo `/api/contacto/` se ejecuta en el servidor (`export const prerender = false` + adaptador `@astrojs/vercel`).
- El comensal no sale de la página: con JavaScript ve "Mensaje enviado"; sin JavaScript, el navegador envía el formulario normal y se le redirige a `/gracias/` o `/no-enviado/`.
- **Remitente:** los emails salen desde el dominio de Cubierto (`web@cubierto.site`, verificado una sola vez en Resend), con el nombre del local ("Web de Casa Brezo"). Así no hay que verificar en Resend el dominio de cada local. La respuesta va al comensal (`reply_to`).

## 4. Campos

| Campo | Nombre | Obligatorio | Límite | Notas |
|---|---|---|---|---|
| Nombre | `name` | Sí | 2–80 | |
| Email | `email` | Uno de los dos | 120 | Formato de email |
| Teléfono | `phone` | Uno de los dos | 9–20 | Dígitos, espacios y `+` |
| Motivo | `topic` | No | Valores cerrados | `general`, `grupo` (grupos y celebraciones), `evento`, `trabajo`; configurable por local |
| Mensaje | `message` | Sí | 10–1500 | |
| Privacidad | `consent` | Sí | — | Casilla con enlace a la política de privacidad del local |
| Trampa | `company` | — | — | Oculto; si llega relleno, es un bot |
| Origen | `source` | — | 200 | Ruta desde la que se envía (oculto) |

Coinciden con WEB-06 (nombre, email o teléfono, mensaje, privacidad) y añaden `topic` para que el local filtre de un vistazo grupos y eventos.

## 5. Modelo de datos (fase 2)

Sin datos en la fase 1: el mensaje solo vive en el email del local. En la fase 2 se usa `ContactSubmission` de `01-webs.md` §5, añadiendo:

```prisma
model ContactSubmission {
  // … campos de 01-webs.md
  topic     String?                       // general | grupo | evento | trabajo
  source    String?                       // ruta de la web desde la que se envió
}

model SiteKey {                         // clave de cada web Astro para hablar con la plataforma
  id        String @id @default(cuid())
  tenantId  String
  keyHash   String @unique                // se guarda el hash, nunca la clave
  label     String                        // "Web casabrezo.es"
  revokedAt DateTime?
  createdAt DateTime @default(now())
  @@index([tenantId])
}
```

## 6. Historias de usuario

### FORM-01 · Enviar un mensaje
Como comensal quiero escribir al restaurante desde su web.
- Con JavaScript: envío `POST` JSON a `/api/contacto/`; al recibir `200`, el formulario se sustituye por "Mensaje enviado" y el foco pasa a ese texto.
- Con error: mensaje que dice qué revisar ("Escribe un email o un teléfono") o, si falla el envío, "No se ha podido enviar. Llámanos al {teléfono} o escríbenos a {email}".
- Sin JavaScript: el formulario se envía como `application/x-www-form-urlencoded` al mismo endpoint, que responde `303` a `/gracias/` o `/no-enviado/` (ambas `noindex` y fuera del sitemap).
- El botón se desactiva mientras se envía ("Enviando…") para evitar dobles envíos.

### FORM-02 · Validar en el servidor
- El endpoint repite todas las reglas de §4 y además: solo acepta `POST`, `Content-Type` JSON o formulario, cuerpo de hasta 10 KB y cabecera `Origin` igual a la propia web (producción, previews de Vercel y local).
- Respuestas: `200` enviado · `400` datos no válidos (`reason`: `consent`, `name`, `contact`, `email`, `phone`, `message`) · `403` otro origen · `405` método · `413` demasiado grande · `415` formato · `502` falló el envío · `503` falta configuración.
- Los campos se recortan a su límite y se escapan antes de meterlos en el HTML del email.

### FORM-03 · Aviso al local por email (fase 1)
Como dueño quiero recibir cada mensaje en mi correo y contestar con un clic.
- Asunto: `{Motivo si no es general}: {nombre}` p. ej. "Grupo o celebración: Ana Ruiz"; si es general, "Mensaje de {nombre}".
- Cuerpo HTML y texto con: nombre, teléfono pulsable, enlace a WhatsApp si hay teléfono, email, motivo, mensaje, página de origen y fecha en hora de Madrid.
- `from`: `Web de {nombre del local} <web@cubierto.site>`; `to`: `CONTACT_TO` (uno o varios separados por comas); `reply_to`: email del comensal si lo dejó.
- Envío por la API HTTP de Resend con tiempo máximo de 8 s, sin librería.

### FORM-04 · Protección contra spam
- Campo trampa `company`: si llega relleno, se responde `200` (para que el bot no reintente) y no se envía nada.
- Rechazo de envíos de otro origen (FORM-02).
- Regla de rate limit en el Firewall de Vercel para `/api/contacto/`: **5 envíos por hora por IP** (como WEB-06).
- Sin captcha de terceros en el MVP: añadiría cookies y un banner. Si llega spam real, se valora Cloudflare Turnstile en la fase 2 y se documenta en la política de cookies.

### FORM-05 · Configuración por local
- Variables de entorno del proyecto de Vercel de cada web (Production y Preview):

| Variable | Contenido | Dónde se lee |
|---|---|---|
| `PUBLIC_CONTACT_ENDPOINT` | `/api/contacto/` (vacío = el formulario abre el email del visitante) | Navegador, al compilar |
| `RESEND_API_KEY` | Clave de Resend de Cubierto con permiso solo de envío | Servidor (`astro:env/server`) |
| `CONTACT_TO` | Email(s) del local | Servidor |
| `CONTACT_FROM` | `Web de Casa Brezo <web@cubierto.site>` | Servidor |
| `CUBIERTO_API_URL`, `CUBIERTO_SITE_KEY` | Solo fase 2 (FORM-07) | Servidor |

- Región de las funciones: `fra1`.
- Las variables de servidor se declaran en el esquema `env` de `astro.config.mjs` y nunca llegan al navegador.
- Sin `RESEND_API_KEY`, `CONTACT_TO` o `CONTACT_FROM`, el endpoint responde `503` y registra el error (sin datos personales).

### FORM-06 · El mismo código en todas las webs
Como Manuel quiero que todas las webs lleven el mismo formulario, probado una vez.
- El código vive en `src/cubierto/contact/` del repositorio plantilla (WEB-12) y se copia a cada web al crearla. Exporta:
  - `parseContact(input, options)`: validación pura (§4), con los motivos permitidos como opción.
  - `buildContactEmail(contact, venue)`: asunto, HTML y texto.
  - `createContactEndpoint(config)`: el handler `POST` listo para `src/pages/api/contacto.ts`.
  - `<ContactForm />`: componente Astro con el formulario, sus textos (configurables) y el script en JavaScript vanilla.
  - Páginas `gracias` y `no-enviado` como componentes para montar en cada web.
- En cada web, `src/pages/api/contacto.ts` es una línea que llama a `createContactEndpoint` con su configuración. **No se modifica `src/cubierto/contact/` dentro de una web:** si hace falta un cambio, se hace en la plantilla, se sube su `VERSION` y se copia a las webs que lo necesiten.
- La plantilla lleva tests (Vitest) de `parseContact` y `buildContactEmail`, y de los códigos de respuesta del endpoint con `fetch` simulado.
- Una corrección de seguridad del formulario se copia a **todas** las webs; el resto de mejoras, cuando se toque cada una.

### FORM-07 · Mensajes en el panel del local (fase 2)
Como dueño quiero ver y marcar los mensajes en el panel, no solo en mi correo.
- Si existen `CUBIERTO_API_URL` y `CUBIERTO_SITE_KEY`, el endpoint, en vez de enviar el email, hace `POST {CUBIERTO_API_URL}/api/public/contact` con el mensaje validado y la cabecera `Authorization: Bearer {CUBIERTO_SITE_KEY}`.
- La plataforma identifica el tenant **por la clave** (`SiteKey`), nunca por un dato del cuerpo; crea `ContactSubmission` y un `OutboxEvent` `lead.created`, que envía el email de FORM-03 desde la plataforma.
- El mensaje aparece en `/panel/web/mensajes` (vista D15), donde se marca como atendido o spam.
- Si la plataforma no responde en 8 s o da error `5xx`, el endpoint envía el email directamente (fase 1) para no perder el mensaje.
- El superadmin crea y revoca claves de cada web en la ficha del local (D21); la clave se muestra una sola vez.

### FORM-08 · Privacidad
- El responsable de los datos es el **restaurante**; Cubierto es encargado del tratamiento (contrato de PLT-10).
- La casilla enlaza a `/privacidad/` de la web del local, que debe mencionar: finalidad (contestar al mensaje), que los mensajes pasan por Vercel y Resend, y (fase 2) que se guardan en la plataforma.
- Fase 1: Cubierto no guarda los mensajes; solo quedan en el correo del local. Fase 2: retención según PLT-10.
- Los logs de la función no incluyen nombre, email, teléfono ni mensaje: solo códigos de error.

## 7. Requisitos no funcionales

- Lighthouse móvil de `/contacto/` ≥ 95 en las cuatro categorías (la web comercial está en 100 con este mismo formulario).
- Respuesta del endpoint < 2 s en el percentil 95 con Resend sano.
- Accesible: `label` en cada campo, errores asociados al campo, foco al primer error y al mensaje de éxito, contraste AA.
- Funciona a 360 px de ancho y sin JavaScript.

## 8. Tests clave

- FORM-01/02: JSON válido → `200`; sin consentimiento → `400 consent`; sin email ni teléfono → `400 contact`; formulario sin JS válido → `303 /gracias/`; inválido → `303 /no-enviado/`; `GET` → `405`; `Origin` ajeno → `403`; JSON roto → `400`; texto plano → `415`; 11 KB → `413`.
- FORM-02: un mensaje con `<script>` llega escapado en el HTML del email.
- FORM-03: con teléfono de 9 cifras, el enlace de WhatsApp lleva el prefijo 34; sin email, no hay `reply_to`.
- FORM-04: `company` relleno → `200` y ningún envío.
- FORM-05: falta `RESEND_API_KEY` → `503` y ningún envío.
- FORM-07: clave revocada → `401` de la plataforma y envío directo de respaldo; una clave del tenant A nunca crea mensajes en el tenant B.

## 9. Referencia

Implementación ya hecha y probada en la web comercial (`zoenlab-web`, 17/11/2026): `src/pages/api/contacto.ts`, `src/lib/contact.ts`, `src/pages/gracias.astro`, `src/pages/no-enviado.astro`. Es la base de `src/cubierto/contact/` de la plantilla; cambian los campos (la web comercial pide local, teléfono obligatorio e interés por módulos) y el remitente.

## 10. Preguntas abiertas

- [x] ~~Encaje de las webs Astro con `01-webs.md`~~ Decidido el 21/11/2026: webs a medida, un repositorio y un despliegue por local, cambios hechos por Manuel (WEB-11), datos del local por la API pública al compilar (WEB-13), dominio en el proyecto de cada web (WEB-08). `01-webs.md` v0.3.
- [ ] Motivos del formulario (`topic`): ¿estos cuatro para todos o configurables por local?
- [ ] ¿Un aviso por WhatsApp al local además del email? (Encaja con la fase 2 de WhatsApp de RES-18.)
- [ ] ¿Respuesta automática al comensal ("Hemos recibido tu mensaje")? Hoy fuera de alcance para no enviar emails que el local no ha escrito.
