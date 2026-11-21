# 00 · Necesidades del proyecto

**Estado:** v0.3 · **Última actualización:** 21/11/2026

Todo lo que hace falta para construir, poner en marcha y vender Cubierto, en un solo sitio: qué se construye, qué cuentas y servicios hay que abrir, qué falta del lado del negocio y qué decisiones siguen pendientes. El detalle de producto está en `modulos/`; la arquitectura, en `02-arquitectura.md`.

## 1. En una frase

Una plataforma para bares y restaurantes de Alcalá de Henares y el Corredor del Henares que les da, sueltos o en pack, **web propia, carta digital con QR y reservas en línea con plano de sala**, gestionado todo desde un panel en el móvil. La construye Manuel con Claude; la vende la web comercial `cubierto.site`.

## 2. Qué hay que construir

| Pieza | Para quién | Spec | Fase | Estado |
|---|---|---|---|---|
| Plataforma común: locales, usuarios y roles, módulos, cobro, avisos, `<slug>.cubierto.site` | Todos | `modulos/00-plataforma.md` (PLT-01 a PLT-12) | F0 | Esqueleto del monorepo creado (21/11/2026) |
| Pagos y suscripciones (Stripe) | Locales y Manuel | `modulos/05-pagos.md` (BILL-01 a BILL-13) | F0 (prueba) → antes del piloto | Spec v0.1 |
| Servicio de IA (base y simulador) | Todos los módulos | `modulos/04-ia.md` (AI-01 a AI-05, AI-08) | F0 | Por empezar |
| Superadmin: alta de locales, módulos, ficha de su web, uso de IA | Manuel | PLT-01, PLT-09, AI-09 | F0 | Diseñado (D20–D22) |
| Panel del local | Dueño y equipo | Cada spec de módulo | F0 → F3 | Diseñado (D5–D19, M10–M16) |
| Webs de los locales: Astro a medida, un repositorio y un despliegue por local; información, enlaces a carta y reservas, formulario | Comensales | `modulos/01-webs.md` (WEB-01, WEB-05 a WEB-17) | F1 | Ejemplo diseñado (D1, M1–M2) |
| Repositorio plantilla de las webs | Manuel | WEB-12 | F1 | Por empezar |
| API pública de datos del local y ficha de cada web en el superadmin | Webs de los locales y Manuel | WEB-13, WEB-14 | F1 | Por empezar |
| Formulario de contacto de las webs de los locales | Comensales y local | `modulos/06-formulario-contacto.md` (FORM-01 a FORM-08) | F1 | Probado en la web comercial |
| Carta digital con QR | Comensales | `modulos/02-carta-qr.md` (MENU-01 a MENU-10) | F2 | Diseñado (D2, M3–M4) |
| Reservas, plano de sala, mesas juntas, enlace de WhatsApp | Comensales y sala | `modulos/03-reservas.md` (RES-01 a RES-18) | F3 | Diseñado (D3–D4, D7–D10, M5–M9) |
| Web comercial | Dueños de locales (venta) | Repo `zoenlab-web` | — | Hecha, con marca Cubierto |

Las vistas citadas (M1…, D1…) están en `diseno/`.

## 3. Primer hito: `app.cubierto.site` en marcha (F0)

Objetivo pequeño pero real, que se pueda enseñar:

1. Monorepo con `apps/platform` y sitio preparado para `apps/landing`.
2. Base de datos con los modelos de `00-plataforma.md`, `getTenantDb` y RLS activos desde el primer día, con test de aislamiento.
3. Entrada con enlace por email (en local, el enlace sale en la consola).
4. Superadmin con "Dar de alta un local" (PLT-01): crea el local y envía la invitación.
5. Panel vacío del local con su menú lateral, según los módulos activos.
6. Resolución por subdominio: `casa-brezo.localhost:3000` muestra la página mínima del local (WEB-16).
7. Desplegado en Vercel con `app.cubierto.site` y base de datos en Neon.

Hecho cuando: un local de prueba se da de alta desde el superadmin, su dueña entra con el enlace, ve su panel y no puede ver nada de otro local.

## 4. Cuentas y servicios

Antes de contratar, comprobar el precio vigente de cada plan.

| Servicio | Para qué | Plan | Fase | Estado |
|---|---|---|---|---|
| Dominio `cubierto.site` | Web comercial, panel, webs de locales | — | Ya | En uso en la web comercial. Confirmar titularidad y renovación automática |
| GitHub | Repositorio `cubierto` y CI | — | F0 | Pendiente |
| Vercel | Web comercial hasta la mudanza al VPS; la plataforma, según `anexos/plan-vps-hostinger.md` §7 | Pro | Ya | Decidido pasar a Pro el 19/11/2026 (Hobby no admite uso comercial) |
| Neon | Base de datos PostgreSQL en Fráncfort, ramas por PR | Launch; Scale al tener clientes (SLA) | F0 | Hoy en plan gratuito. Subir a Launch antes del piloto |
| Resend | Emails: entrada al panel, invitaciones, reservas | El que cubra el volumen | F0 | Pendiente. Verificar `cubierto.site` (SPF, DKIM) |
| Stripe | Cuotas por módulo y pack, altas (web y pack, 499 € IVA incluido cada una), facturas | Sin cuota; comisión por cobro y por Billing | F0 (modo prueba) | Pendiente. Catálogo con `pnpm stripe:seed` (BILL-01) |
| Programa de facturación Veri\*factu | Registrar las facturas (BILL-13) | — | Antes del 1/7/2027 | Por decidir con el gestor |
| Sentry | Errores con `tenantId` | Gratuito al empezar | F0 | Pendiente |
| Anthropic (API) | IA: traducción de la carta y tareas futuras | Pago por uso, con presupuesto | F2 (en F0, simulador) | Pendiente |
| Almacén de imágenes | Fotos de carta y web | Vercel Blob o Cloudflare R2 | F1 | Por decidir |
| Umami | Analítica sin cookies de las webs de locales y del informe mensual de visitas (`modulos/01-webs.md`); también la web comercial | Cloud gratuito para la web comercial; para los locales, **autoalojado en el VPS** (sin límite de webs, API para el alta automática) o Cloud Pro | Ya (web comercial) · F1 (locales) | Plan gratuito de Umami Cloud abierto, región de la UE. Decidir dónde van las webs de los locales antes de F1 |
| VPS Hostinger con Coolify | n8n, Umami, web comercial y, a largo plazo, la plataforma (`anexos/alojamiento-vps.md`) | KVM 2, Fráncfort, plantilla de Coolify | Plan en `anexos/plan-vps-hostinger.md` | **Sin contratar.** El VPS de n8n no llegó a crearse |
| n8n | Informes y automatizaciones (WhatsApp, recordatorios) | Autoalojado en el VPS | F0 | Pendiente del VPS. El formulario de la web comercial ya no lo usa: va por una función y Resend |
| Monitor de disponibilidad | Avisar al móvil si se cae una página pública | — | F5 | Pendiente |
| WhatsApp Business (API) | Nada en el MVP: solo enlace `wa.me` (RES-18) | — | Fase 2 | No hace falta ahora |

## 5. Variables de entorno de la plataforma

Lista de partida; se completa en cada PR que añada una.

| Variable | Para qué | Fase |
|---|---|---|
| `PLATFORM_DOMAIN` | `cubierto.site`; base del mapa de dominios | F0 |
| `DATABASE_URL`, `DATABASE_URL_UNPOOLED` | Neon: con pool (app) y directa (migraciones). Nombres de la integración de Vercel con Neon | F0 |
| `TEST_DATABASE_URL` | Rama `test` de Neon para `pnpm test` (directa) | F0 |
| `SEED_SUPERADMIN_EMAIL` | Email del superadmin de `pnpm db:seed` (opcional) | F0 |
| `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL` | Sesiones y enlaces de entrada de Better Auth. La URL es la de `app.` (`http://app.localhost:3000` en local) | F0 |
| `RESEND_API_KEY`, `EMAIL_FROM` | Envío de emails y remitente. Sin clave, en local los emails salen en la consola; en producción es obligatoria | F0 |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | Cobros y webhook (`05-pagos.md`) | F0 |
| `STRIPE_PORTAL_CONFIGURATION_ID` | Configuración del portal de cliente (BILL-07) | F0 |
| `VERCEL_API_TOKEN`, `VERCEL_TEAM_ID` | Comprobar el dominio del proyecto de Vercel de cada web (WEB-08) | F1 |
| `DEPLOY_HOOK_ENCRYPTION_KEY` | Cifrar los Deploy Hooks de las webs guardados en la base de datos (WEB-14) | F1 |
| `CRON_SECRET` | Proteger `/api/cron/*` | F0 |
| `N8N_WEBHOOK_URL` | Avisos y automatizaciones | F0 |
| `SENTRY_DSN` | Errores | F0 |
| `ANTHROPIC_API_KEY`, `AI_MODEL_FAST`, `AI_MODEL_STANDARD`, `AI_MODEL_ADVANCED`, `AI_GLOBAL_BUDGET_EUR` | Servicio de IA (`modulos/04-ia.md`) | F0 (con `mock`) |
| Credenciales del almacén de imágenes | Subida de fotos | F1 |
| Credenciales de Umami | Alta automática de webs | F1 |

## 6. Lo que falta del lado del negocio

- **Marca:** comprobar "Cubierto" en OEPM y EUIPO y el usuario de Instagram. El logo ya está hecho (`diseno/marca/`).
- **Datos fiscales:** NIF y dirección para los avisos legales (la web comercial los tiene como `TODO`).
- **Textos legales de la plataforma:** condiciones del servicio, contrato de encargo de tratamiento (los datos de los comensales son del restaurante) y privacidad. Necesitan revisión de un abogado antes del piloto.
- **Contacto real:** teléfono y WhatsApp 614 89 84 47 (19/11/2026). Falta el email definitivo (hoy `hola@cubierto.site`).
- **Datos fiscales para las facturas de Stripe:** titular, NIF y domicilio en la cuenta de Stripe; epígrafe de actividad y si hay retención de IRPF (consultar al gestor, `05-pagos.md` §8).
- **Precios:** carta 24 €, reservas 44 €, web 39 €, pack 79 € (sin IVA, sin permanencia); alta de la web 499 € IVA incluido y alta del pack completo 499 € IVA incluido con el primer mes incluido (19/11/2026).
- **Piloto:** 250 € IVA incluido el primer mes con el pack completo (alta y primera cuota); después, la cuota normal del pack. Descuento del 10 % en la cuota durante el primer año, sin publicar en la web (`05-pagos.md` BILL-11).
- **Primeros locales del piloto** y quién dibuja el plano de cada uno en el alta.

## 7. Decisiones tomadas

| Fecha | Decisión | Dónde |
|---|---|---|
| Antes del 14/11/2026 | Next.js multi-tenant: un código, un despliegue, una base de datos | `01-contexto.md` §3 |
| Antes del 14/11/2026 | Precios por módulo y pack, sin permanencia | `01-contexto.md` §4 |
| 13/11/2026 | Si se juntan mesas, se reservan juntas (RES-17) | `modulos/03-reservas.md` |
| 14/11/2026 | Nombre: Cubierto | `01-contexto.md` §2 |
| 15/11/2026 | Logo: marco abierto + tenedor + hoja azafrán; nombre en Bricolage Grotesque | `diseno/marca/` |
| 16/11/2026 | WhatsApp en el MVP: solo el enlace "Reservar por WhatsApp" (RES-18) | `modulos/03-reservas.md` |
| 16/11/2026 | Web comercial y plataforma en proyectos y despliegues separados, mismo monorepo cuando arranque F0 | `02-arquitectura.md` §1 y §8 |
| 16/11/2026 | `PLATFORM_DOMAIN = cubierto.site`; panel en `app.cubierto.site` | `02-arquitectura.md` §4 |
| 16/11/2026 | Un solo panel; desde la web del local, `/panel` redirige y hay enlace "Acceso del equipo" en el pie | PLT-11, `02-arquitectura.md` §5 |
| 19/11/2026 | Alta de la web suelta 499 € IVA incluido (importe fijo); alta del pack completo 499 € IVA incluido | `01-contexto.md` §4, `modulos/05-pagos.md` §3 |
| 19/11/2026 | Pagos con Stripe Checkout + portal de cliente, una suscripción por local, IVA 21 % con tipo manual, bajas a fin de periodo | `modulos/05-pagos.md` §4 |
| 19/11/2026 | El alta del pack (499 € IVA incluido) incluye la primera cuota. Piloto: 250 € IVA incluido el primer mes con el pack completo y después la cuota normal con un 10 % de descuento el primer año | `modulos/05-pagos.md` BILL-03 y BILL-11 |
| 19/11/2026 | Umami Cloud, región de la UE, para la web comercial | `00-necesidades.md` §4 |
| 19/11/2026 | Alojamiento a largo plazo en VPS de Hostinger con Coolify; la web comercial sigue en Vercel Pro hasta la mudanza | `anexos/alojamiento-vps.md`, `anexos/plan-vps-hostinger.md` |
| 21/11/2026 | Webs de los locales: **Astro a medida, cada una en su repositorio y con su proyecto de Vercel**, fuera de la plataforma. Solo información, enlaces a carta y reservas y formulario. **Los cambios los hace Manuel** (no hay editor en el panel ni recompilación automática). Los paneles siguen juntos en la plataforma | `modulos/01-webs.md` v0.3, `02-arquitectura.md` §1 |
| 21/11/2026 | Monorepo de la plataforma en `cubiertoPlataform` (pnpm + Turborepo, Next.js 15.5, React 19.3) | `CONTEXTO-CHAT.md` §6 |
| 21/11/2026 | Prisma 7 estable (7.10.1) con el adaptador `pg`; Neon con una rama por entorno: `main` producción, `dev` desarrollo, `test` para los tests y una por preview | `packages/db` |
| 21/11/2026 | La dirección del local (`addressLine`, `city`, `postalCode`) es opcional hasta que el dueño la rellene (PLT-04) | `modulos/00-plataforma.md` §7 |
| 21/11/2026 | Webs de los locales: vale `modulos/01-webs.md` v0.3 (Astro, una por local) | `modulos/01-webs.md` |
| 22/11/2026 | Entrada con Better Auth en lugar de Auth.js (en modo mantenimiento, v5 en beta) | `CLAUDE.md` §3 |
| 22/11/2026 | Los emails de entrada salen por el outbox y se envían al momento; si fallan, los reintenta el cron mientras el enlace no caduque | `modulos/00-plataforma.md` PLT-08 |

## 8. Decisiones pendientes

Las que condicionan el arranque o algo que luego cuesta cambiar. El resto está al final de cada spec.

**Antes o durante F0**
- [ ] ¿El alta de la web suelta (499 €) incluye el primer mes, como la del pack? (`modulos/05-pagos.md`)
- [ ] Retención de IRPF en las facturas, según el epígrafe. Gestor. (`modulos/05-pagos.md`)
- [ ] ¿Periodo de prueba gratuito? ¿Cuánto y para qué módulos? (PLT)
- [ ] ¿Precio anual con descuento desde el MVP? (PLT)
- [ ] IA: ¿incluida con presupuesto por local o como extra? (`modulos/04-ia.md`)
- [ ] ¿Quién compra y renueva el dominio de cada local: el cliente o Cubierto? (`modulos/01-webs.md`)

**Antes de F1 (webs)**
- [ ] Propiedad del código de la web si un local se da de baja. (`modulos/01-webs.md` §9)
- [ ] Qué pasa con la web si se suspende `SITE` por impago. (`modulos/00-plataforma.md` §10)
- [ ] Dónde se fijan el color y el logo de la carta y las reservas de cada local, ahora que no hay temas de web. (`modulos/01-webs.md` §9)
- [ ] Límites de proyectos y minutos de compilación de Vercel con 30 webs.

**Antes de F2 (antes de imprimir el primer QR)**
- [ ] Dirección pública de carta y reservas: `app.cubierto.site/c/<slug>` (provisional) o `<slug>.cubierto.site/carta`. (`02-arquitectura.md` §4)
- [ ] Coste de la traducción con IA: ¿sin límite o con cupo al mes? (`modulos/02-carta-qr.md`)

**Antes de F3**
- [ ] ¿Se piden alergias en el formulario público de reservas? Implica datos de salud. (`modulos/03-reservas.md`)
- [ ] Recordatorio: ¿24 h antes o a una hora fija del día anterior? (`modulos/03-reservas.md`)
- [ ] Fase 2 de WhatsApp (avisos por la API): proveedor y cómo se cobra. (`modulos/03-reservas.md`)

## 9. Orden de construcción

F0 Fundaciones → F1 Webs → F2 Carta (desde aquí ya se puede vender) → F3 Reservas (empezando por RES-12) → F5 aislamiento, copias y monitorización. Detalle y estimación en `01-contexto.md` §7.
