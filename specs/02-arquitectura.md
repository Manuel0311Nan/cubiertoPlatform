# 02 · Arquitectura y dominios

**Estado:** v0.2 · **Última actualización:** 21/11/2026

Cómo se reparte Cubierto entre proyectos, dominios y servicios, y de dónde salen los datos. El detalle de cada pieza está en las specs de `modulos/`.

## 1. Tres tipos de proyecto

| | Web comercial | Plataforma | Webs de los locales |
|---|---|---|---|
| Para qué | Vender el servicio: posicionar en Google y conseguir contactos | Paneles de todos los locales, carta, reservas, superadmin, API pública | Web a medida de cada restaurante |
| Dirección | `cubierto.site` | `app.cubierto.site` y `<slug>.cubierto.site` | Dominio de cada local (`casabrezo.es`) |
| Tecnología | Astro estático + PWA | Next.js (App Router) + Prisma + PostgreSQL | Astro estático |
| Repositorio y despliegue | `zoenlab-web` (pasará a `apps/landing`), uno | Este monorepo, **uno para todos los locales** | **Uno por local**: repositorio `web-<slug>` y su proyecto de Vercel |
| Datos | Ninguno; el formulario va a una función que envía el email con Resend | Base de datos única en Neon (Fráncfort) | Ninguno; leen la API pública al compilar |
| Secretos | Clave de Resend del formulario | Base de datos, Stripe, Resend, IA… | Clave de Resend del formulario y, en la fase 2, su `SiteKey` |
| Quién cambia el contenido | Manuel | El local desde su panel | Manuel (mantenimiento, WEB-11) |
| Estado | Hecha | Esqueleto creado (F0) | Por empezar (F1) |

**Por qué así (21/11/2026):**

- **Webs a medida y aparte:** cada local tiene un diseño propio, que es lo que justifica el alta de 499 €, y Astro estático da la máxima velocidad (100 en Lighthouse) con casi nada de JavaScript. Los cambios los hace Manuel, así que no hace falta un editor en el panel. Un fallo en una web, o en la plataforma, no tumba las demás.
- **Paneles juntos:** lo que usa el local a diario (reservas, sala, carta, mensajes, ajustes) vive en una sola plataforma: una mejora llega a todos con un despliegue y los datos están en una sola base.
- **La web comercial aparte:** un despliegue fallido de la plataforma (con migraciones de base de datos) no tumba la web que vende, y al revés.

## 2. Cómo se conectan

```
Comensal ──▶ casabrezo.es  (web Astro de Casa Brezo: su repositorio, su proyecto de Vercel)
                │  enlaces y botones
                ├──▶ app.cubierto.site/c/casa-brezo   carta (plataforma)
                ├──▶ app.cubierto.site/r/casa-brezo   reservas (plataforma)
                └──▶ wa.me/…                          WhatsApp del local (RES-18)

Al compilar:     web de Casa Brezo ──GET──▶ app.cubierto.site/api/public/v1/venues/casa-brezo   (WEB-13)
Para recompilar: superadmin ──"Recompilar web"──▶ Deploy Hook de esa web (WEB-14; lo decide Manuel)
Formulario:      web ──▶ su /api/contacto/ ──▶ email (fase 1) | plataforma con SiteKey (fase 2, FORM-07)

Dueño y equipo ──▶ app.cubierto.site/panel ┐
Manuel         ──▶ app.cubierto.site/admin ┴─▶ UN proyecto Next.js (Vercel, fra1) ──▶ UNA base de datos (tenantId + RLS)
```

- **La plataforma es una sola para todos los locales:** un código, un despliegue, una base de datos, `getTenantDb` y RLS (`CLAUDE.md` §6). El backend está dentro de Next.js: Server Actions, route handlers y Server Components que leen la base de datos con Prisma.
- **Las webs no tocan la base de datos** ni tienen sus secretos: solo leen la API pública (datos públicos) y, en la fase 2, envían mensajes con una clave propia que solo sirve para eso.
- **Las webs son de información:** presentan el local, enlazan a la carta y a las reservas de la plataforma y tienen el formulario. No muestran carta, menú del día ni disponibilidad (por eso pueden ser estáticas).
- **Los cambios de la web los hace Manuel:** textos y fotos por solicitud del local (WEB-11); si el local cambia en el panel su horario o su teléfono, la plataforma lo marca en el superadmin y Manuel recompila esa web (WEB-14). "Abierto ahora" se calcula en el navegador.

## 3. De dónde salen los datos

| Origen | Qué datos | Dónde |
|---|---|---|
| Superadmin (Manuel) | Alta del local, slug, módulos, overrides de pago, ficha de su web (repositorio, dominio, proyecto de Vercel, Deploy Hook) | Plataforma: `tenancy`, `billing`, `sites` |
| Panel del local (OWNER/STAFF) | Datos del local, horario, mesas y plano, carta, menú del día, agotados, turnos y reglas de reservas, reservas por teléfono y WhatsApp, equipo, solicitudes de cambios de la web. A la web solo pasan datos del local, horario, cierres, WhatsApp y módulos | Plataforma: `venue`, `sites`, `menu`, `reservations`, `identity` |
| Manuel (mantenimiento) | Diseño, textos y fotos de cada web | Repositorio de esa web |
| Comensales | Reservas y cancelaciones; mensajes del formulario | Plataforma: `reservations`; mensajes: email (fase 1) o `sites` (fase 2) |
| Stripe (webhooks) | Estado de las suscripciones → estado de cada módulo | Plataforma: `billing` |
| Proveedor de IA | Borradores (traducciones de la carta, textos) que el local revisa antes de publicar | Plataforma: `ai` |
| Procesos programados | Recordatorios, envío del outbox, informes mensuales, anonimización RGPD | Plataforma: `notifications`, `reservations` |

Salidas: emails por Resend, avisos y automatizaciones por n8n, analítica por Umami. Todo efecto externo pasa por el outbox (`CLAUDE.md` §6.5).

## 4. Mapa de dominios

`PLATFORM_DOMAIN = cubierto.site`

| Dirección | Proyecto | Qué se ve |
|---|---|---|
| `cubierto.site`, `www.cubierto.site` | Web comercial | Venta del servicio, guías, contacto |
| `app.cubierto.site/panel/**` | Plataforma | Panel del local |
| `app.cubierto.site/admin/**` | Plataforma | Superadmin |
| `app.cubierto.site/c/<slug>` | Plataforma | Carta pública (el QR apunta aquí) |
| `app.cubierto.site/r/<slug>` | Plataforma | Reservas públicas y widget |
| `app.cubierto.site/embed.js` | Plataforma | Script del widget de reservas |
| `app.cubierto.site/api/public/v1/**` | Plataforma | API pública para las webs de los locales (WEB-13, FORM-07) |
| `<slug>.cubierto.site` | Plataforma | Página mínima del local, o 301 a su web si ya está publicada (WEB-16) |
| Dominio del local (`casabrezo.es`) | **Proyecto de Vercel de la web de ese local** | Su web a medida |

**Carta y reservas públicas en `app.`:** la raíz `cubierto.site` es de la web comercial. Por eso `/c/` y `/r/` viven en `app.cubierto.site`. **Provisional:** confirmar antes de F2, porque los QR impresos no se pueden cambiar. Alternativa estudiada: `<slug>.cubierto.site/carta` y `/reservar` (más bonita en el QR, pero cambia rutas de las specs 01–03).

## 5. Acceso al panel desde la web de cada local

El panel no vive dentro del dominio de cada local; hay un solo panel en `app.cubierto.site` (PLT-11):

1. **Atajo:** `<dominio del local>/panel` redirige a `app.cubierto.site/panel`. Es lo que se le dice al dueño: "tu web /panel". La redirección viene en la plantilla de las webs (WEB-12).
2. **Enlace discreto** en el pie de cada web: "Acceso del equipo".
3. **Uso diario:** el panel es instalable como app (PWA). En la visita de alta se deja instalado en la tablet de sala y en el móvil del encargado.

Por qué un solo panel: una sesión y una configuración de Auth.js en vez de una por dominio; una sola puerta que vigilar (más difícil colar una página falsa); si el dominio de un local caduca o le cambian las DNS, el local sigue entrando a su panel. Esconder el enlace no protege nada: la protección es la invitación y los roles.

## 6. DNS y certificados

| Registro | Apunta a | Para |
|---|---|---|
| `cubierto.site` y `www` | Proyecto de la web comercial en Vercel | Web comercial |
| `app` | Proyecto de la plataforma | Panel, superadmin, carta, reservas y API pública |
| `*` (comodín) | Proyecto de la plataforma | `<slug>.cubierto.site` (WEB-16) |
| MX, SPF, DKIM y DMARC del buzón | Google Workspace | `hola@cubierto.site` |
| Registros de Resend (DKIM, `send`) | Resend (región UE) | Emails de la plataforma y de los formularios |
| Dominio de cada local | **Proyecto de Vercel de su web** (WEB-08) | Su web |

- **Comodín:** Vercel necesita poder renovar el certificado del comodín. O se ponen los nameservers del dominio en Vercel, o se mantienen donde están y se delegan los registros `_acme-challenge` a Vercel ([guía de Vercel](https://vercel.com/kb/guide/wildcard-domain-without-vercel-nameservers)).
- Los subdominios con registro propio (`app`, `www`) tienen prioridad sobre el comodín.

## 7. Subdominios y slugs reservados

Ningún local puede usar como slug: `app`, `admin`, `api`, `www`, `mail`, `email`, `blog`, `ayuda`, `help`, `soporte`, `status`, `estado`, `static`, `assets`, `cdn`, `docs`, `dev`, `staging`, `preview`, `c`, `r`, `panel`, `login`, `cubierto` (PLT-01). La lista vive en una constante de `tenancy` y se amplía, nunca se reduce.

## 8. Monorepo

Un repositorio para la plataforma (y, cuando se mueva, la web comercial), con un proyecto de Vercel por carpeta que solo se redespliega si cambia lo suyo. **Las webs de los locales no están aquí:** cada una tiene su repositorio (`web-<slug>`), creado desde `cubierto-web-plantilla` (`modulos/01-webs.md` WEB-12).

```
cubierto/
├── CLAUDE.md                  # reglas de trabajo
├── specs/                     # esta carpeta: fuente de verdad de producto
├── apps/
│   ├── platform/              # Next.js: paneles, carta, reservas, superadmin, API pública, página mínima
│   └── landing/               # web comercial en Astro (se mueve aquí desde zoenlab-web cuando arranque F0; hasta entonces sigue en su repo)
├── packages/
│   ├── db/                    # schema.prisma, migraciones, seed, getTenantDb, RLS
│   ├── ai/                    # conexión con proveedores de IA (Vercel AI SDK)
│   ├── brand/                 # logo SVG, colores y tipografía compartidos por landing y plataforma
│   ├── ui/                    # componentes shadcn de la plataforma
│   └── config/                # eslint, tsconfig, preset de Tailwind
└── .github/workflows/ci.yml   # lint, typecheck, test, build; migraciones en rama de Neon
```

La estructura interna de `apps/platform` (rutas y bounded contexts) está en `CLAUDE.md` §4.

## 9. Entornos

| Entorno | Plataforma | Webs de los locales | Base de datos | IA | Emails |
|---|---|---|---|---|---|
| Local | `app.localhost:3000`, `casa-brezo.localhost:3000` | `localhost:4321` contra la API local | Postgres local o rama de Neon | Proveedor simulado (`mock`) | Enlace en la consola |
| Preview (cada PR) | URL de Vercel | URL de Vercel por PR, contra la API de producción (solo lectura de datos públicos) | Rama de Neon por PR | `mock` | Resend en modo prueba o desactivado |
| Producción | `app.cubierto.site` | Dominio de cada local | Neon producción | Proveedor real con presupuesto | Resend |
