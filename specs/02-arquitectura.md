# 02 · Arquitectura y dominios

**Estado:** v0.1 · **Última actualización:** 16/11/2026

Cómo se reparte Cubierto entre proyectos, dominios y servicios, y de dónde salen los datos. El detalle de cada pieza está en las specs de `modulos/`.

## 1. Dos proyectos, cada uno con su trabajo

| | Web comercial | Plataforma |
|---|---|---|
| Para qué | Vender el servicio: posicionar en Google y conseguir contactos | Todo lo que usan los locales y sus comensales |
| Dirección | `cubierto.site` | `app.cubierto.site`, `<slug>.cubierto.site` y dominios propios de los locales |
| Tecnología | Astro estático + PWA | Next.js (App Router) + Prisma + PostgreSQL |
| Datos | Ninguno; el formulario va a una función que envía el email con Resend | Base de datos única en Neon (Fráncfort) |
| Secretos | Ninguno | Base de datos, Stripe, Resend, IA… |
| Estado | Hecha (repo `zoenlab-web`) | Por empezar (F0) |

**Por qué separados:**

- La web comercial ya está hecha y saca 100 en Lighthouse; rehacerla en Next.js no aporta nada.
- Un despliegue fallido de la plataforma (con migraciones de base de datos) no tumba la web que vende, y al revés.
- Los textos y el SEO cambian a menudo; el producto, con pruebas y con calma.

**Cuándo se replantearía:** si la web comercial necesitara datos vivos (alta y pago sin intervención, enseñar webs reales de clientes). Aun así, se resolvería con una API de la plataforma, no juntando proyectos.

## 2. Una sola plataforma para todos los locales

```
Comensal        → casabrezo.es, casa-brezo.cubierto.site, carta y reservas ┐
Dueño y equipo  → app.cubierto.site/panel                                   ├→ UN proyecto Next.js (Vercel, fra1)
Manuel          → app.cubierto.site/admin                                   ┘            │
                                                                                         ▼
                                                              UNA base de datos PostgreSQL (Neon, Fráncfort)
                                                              cada fila de cliente lleva tenantId + RLS
```

- **No hay un proyecto ni una base de datos por restaurante.** Un código, un despliegue, una base de datos (`CLAUDE.md` §6).
- **El backend está dentro de Next.js:** Server Actions, route handlers (`/api/webhooks`, `/api/cron`) y Server Components que leen la base de datos con Prisma. No hay que conectarse a nada externo para leer los datos de un local.
- **La web de cada local es una plantilla de la plataforma** que se rellena con sus datos. El middleware mira el dominio, sabe qué local es y pinta su web. Un precio cambiado en el panel cambia a la vez en la carta, en la web y en las reservas.
- **Aislamiento:** `getTenantDb(tenantId)` en todo acceso y RLS de PostgreSQL como segunda barrera. Aunque falle el código, un local no ve los datos de otro.

## 3. De dónde salen los datos

| Origen | Qué datos | Módulo |
|---|---|---|
| Superadmin (Manuel) | Alta del local, slug, módulos, dominio, overrides de pago | `tenancy`, `billing` |
| Panel del local (OWNER/STAFF) | Datos del local, horario, mesas y plano, carta, menú del día, agotados, textos y fotos de la web, turnos y reglas de reservas, reservas por teléfono y WhatsApp, equipo | `venue`, `sites`, `menu`, `reservations`, `identity` |
| Comensales | Reservas, cancelaciones, mensajes del formulario de contacto | `reservations`, `sites` |
| Stripe (webhooks) | Estado de las suscripciones → estado de cada módulo | `billing` |
| Proveedor de IA | Borradores (traducciones de la carta, textos) que el local revisa antes de publicar | `ai` |
| Procesos programados | Recordatorios, envío del outbox, informes mensuales, anonimización RGPD | `notifications`, `reservations` |

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
| `<slug>.cubierto.site` | Plataforma | Web del local sin dominio propio (o página mínima si no tiene `SITE`) |
| Dominio propio (`casabrezo.es`) | Plataforma | Web del local |

**Carta y reservas públicas en `app.`:** un dominio solo puede apuntar a un proyecto de Vercel, y la raíz `cubierto.site` es de la web comercial. Por eso `/c/` y `/r/` viven en `app.cubierto.site`. **Provisional:** confirmar antes de F2, porque los QR impresos no se pueden cambiar. Alternativa estudiada: `<slug>.cubierto.site/carta` y `/reservar` (más bonita en el QR, pero cambia rutas de las specs 01–03).

## 5. Acceso al panel desde la web de cada local

El panel no vive dentro del dominio de cada local; hay un solo panel en `app.cubierto.site` (PLT-11):

1. **Atajo:** `<dominio del local>/panel` redirige a `app.cubierto.site/panel`. Es lo que se le dice al dueño: "tu web /panel".
2. **Enlace discreto** en el pie de cada web: "Acceso del equipo".
3. **Uso diario:** el panel es instalable como app (PWA). En la visita de alta se deja instalado en la tablet de sala y en el móvil del encargado.

Por qué un solo panel: una sesión y una configuración de Auth.js en vez de una por dominio; una sola puerta que vigilar (más difícil colar una página falsa); si el dominio de un local caduca o le cambian las DNS, el local sigue entrando a su panel. Esconder el enlace no protege nada: la protección es la invitación y los roles.

## 6. DNS y certificados

| Registro | Apunta a | Para |
|---|---|---|
| `cubierto.site` y `www` | Proyecto de la web comercial en Vercel | Web comercial |
| `app` | Proyecto de la plataforma | Panel, superadmin, carta y reservas |
| `*` (comodín) | Proyecto de la plataforma | Webs de los locales en `<slug>.cubierto.site` |
| Registros de Resend (SPF, DKIM) | Resend | Que los emails no acaben en spam |
| Dominios propios de los locales | Proyecto de la plataforma, vía API de dominios de Vercel (WEB-08) | Webs de los locales |

- **Comodín:** Vercel necesita poder renovar el certificado del comodín. O se ponen los nameservers del dominio en Vercel, o se mantienen donde están y se delegan los registros `_acme-challenge` a Vercel ([guía de Vercel](https://vercel.com/kb/guide/wildcard-domain-without-vercel-nameservers)).
- Los subdominios con registro propio (`app`, `www`) tienen prioridad sobre el comodín.

## 7. Subdominios y slugs reservados

Ningún local puede usar como slug: `app`, `admin`, `api`, `www`, `mail`, `email`, `blog`, `ayuda`, `help`, `soporte`, `status`, `estado`, `static`, `assets`, `cdn`, `docs`, `dev`, `staging`, `preview`, `c`, `r`, `panel`, `login`, `cubierto` (PLT-01). La lista vive en una constante de `tenancy` y se amplía, nunca se reduce.

## 8. Monorepo

Un repositorio, dos proyectos en Vercel (cada uno apunta a su carpeta y solo se redespliega si cambia lo suyo).

```
cubierto/
├── CLAUDE.md                  # reglas de trabajo
├── specs/                     # esta carpeta: fuente de verdad de producto
├── apps/
│   ├── platform/              # Next.js: webs de locales, carta, reservas, panel, superadmin
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

| Entorno | Plataforma | Base de datos | IA | Emails |
|---|---|---|---|---|
| Local | `app.localhost:3000`, `casa-brezo.localhost:3000` | Postgres local o rama de Neon | Proveedor simulado (`mock`) | Enlace en la consola |
| Preview (cada PR) | URL de Vercel | Rama de Neon por PR | `mock` | Resend en modo prueba o desactivado |
| Producción | `app.cubierto.site` y dominios | Neon producción | Proveedor real con presupuesto | Resend |
