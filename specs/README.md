# Specs de Cubierto

Fuente de verdad de **qué** se construye, **para quién** y **cómo debe comportarse**. Las reglas de trabajo en el código están en `/CLAUDE.md`.

## Orden de lectura

1. `00-necesidades.md`: qué hay que construir, cuentas y servicios, variables, lo que falta del negocio, decisiones tomadas y pendientes. **Empieza aquí.**
2. `01-contexto.md`: producto, marca, precios, decisiones de arquitectura y forma de trabajar.
3. `02-arquitectura.md`: tres tipos de proyecto (web comercial, plataforma y una web por local), cómo se conectan, de dónde salen los datos, mapa de dominios, acceso al panel, monorepo.
4. `modulos/`: una spec por módulo, con historias e IDs.
5. `diseno/`: vistas de todas las pantallas, colores, principios y logo.

## Contenido

| Archivo | Qué es | Estado |
|---|---|---|
| `00-necesidades.md` | Necesidades del proyecto | v0.3 |
| `01-contexto.md` | Contexto y decisiones | 21/11/2026 |
| `02-arquitectura.md` | Arquitectura y dominios | v0.2 |
| `modulos/00-plataforma.md` | Base común: tenants, auth, cobro, locales, mesas, avisos, `<slug>.cubierto.site`, acceso al panel (`PLT-01`…`PLT-12`) | v0.4 |
| `modulos/01-webs.md` | Webs Astro a medida + mantenimiento, `SITE`: un repositorio por local, plantilla, API pública, ficha en el superadmin (`WEB-01`…`WEB-17`; 02 a 04 descartadas) | v0.3 |
| `modulos/02-carta-qr.md` | Carta digital y QR, `MENU` (`MENU-01`…`MENU-10`) | v0.2 |
| `modulos/03-reservas.md` | Reservas, `RESERVATIONS`, con plano de sala y WhatsApp (`RES-01`…`RES-18`) | v0.3 |
| `modulos/04-ia.md` | Servicio de IA interno (`AI-01`…`AI-09`) | v0.1 |
| `modulos/05-pagos.md` | Pagos y suscripciones con Stripe: catálogo, primer pago, IVA, pack, impagos, facturas (`BILL-01`…`BILL-13`) | v0.2 |
| `modulos/06-formulario-contacto.md` | Formulario de contacto de las webs de los locales (`FORM-01`…`FORM-08`) | v0.2 |
| `diseno/README.md` | Colores, principios, índice de vistas y diferencias con las specs | v0.1 |
| `diseno/vistas-movil.html`, `diseno/vistas-ordenador.html` | Maquetas de las 39 pantallas | 14/11/2026 |
| `diseno/marca/` | Logo en SVG y reglas de uso | 15/11/2026 |
| `anexos/alojamiento-vps.md` | Guía para alojar todo en un VPS propio (Hostinger o IONOS) con Coolify: directrices, ventajas, inconvenientes y plan de migración | v0.2 |
| `anexos/plan-vps-hostinger.md` | Plan paso a paso para llevar la web comercial, Umami y n8n a un VPS de Hostinger, con vuelta atrás | v0.1 |
| `anexos/skills-para-locales.md` | Skills de IA útiles para el día a día de los locales | 14/11/2026 |

## Orden de construcción

1. **F0** · `PLT-01` a `PLT-12` + base de IA `AI-01` a `AI-05` y `AI-08` + pagos en modo prueba `BILL-01` a `BILL-03`, `BILL-08` y `BILL-09`. Primer hito en `00-necesidades.md` §3.
   El resto de `BILL-*` antes de cobrar al primer local; `BILL-13` antes del 1/7/2027.
2. **F1** · `WEB-*` y `FORM-*` (la plantilla y la primera web, más la API pública y la ficha en la plataforma)
3. **F2** · `MENU-*` → a partir de aquí ya se puede vender
4. **F3** · `RES-*` → `RES-12` (concurrencia) antes que cualquier otra historia de reservas
5. **F5** · Pruebas de aislamiento entre tenants, copias, monitorización

## Estructura de cada spec de módulo

1. Objetivo · 2. Alcance MVP y fuera de alcance · secciones de dominio · Modelo de datos · Historias con criterios de aceptación (IDs) · Requisitos no funcionales · Tests clave · Preguntas abiertas

## Reglas de cambio

- Un ID no se reutiliza ni se renumera; si una historia se descarta, se marca `~~RES-10~~ (descartada: motivo)`.
- Cambiar comportamiento = actualizar la spec en el mismo PR y subir la versión (`v0.2`).
- Una pregunta abierta se cierra escribiendo la decisión y la fecha en su línea, y se apunta en `00-necesidades.md` §7.
- Si una vista de `diseno/` contradice una spec, manda la spec; la diferencia se apunta en `diseno/README.md` §5.
