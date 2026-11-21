# Alojar Cubierto en un VPS propio (Hostinger o IONOS)

**Estado:** v0.2 · **Fecha:** 19/11/2026 · **Owner:** Manuel · **Plan de la web comercial:** `plan-vps-hostinger.md`

Guía para llevar, a largo plazo, todos los proyectos (web comercial, plataforma, webs de los locales, Umami y n8n) a un VPS de Hostinger o IONOS en lugar de Vercel. Recoge qué hay que saber, cómo montarlo, las directrices y las ventajas e inconvenientes. Precios y planes comprobados en noviembre de 2026: revísalos antes de contratar.

## 1. En resumen

- **Sí es viable**, y a la larga es más barato y deja los datos en empresas europeas. A cambio, **lo que hoy hace Vercel lo haces tú**: seguridad, copias, actualizaciones, certificados, monitorización y responder si se cae.
- **Hazlo por fases**, no de golpe:
  1. **Ya:** un VPS con Coolify para n8n, Umami y la web comercial. Así la web comercial deja de depender del plan gratuito de Vercel, que no admite uso comercial.
  2. **Desde F0:** la plataforma se programa para poder salir de Vercel sin reescribir nada (§6).
  3. **Cuando el piloto esté estable:** la plataforma pasa al VPS. La base de datos puede seguir en Neon un tiempo más.
- **Recomendación de proveedor:** Hostinger KVM 2 en Fráncfort (o París) con la plantilla de Coolify para empezar. IONOS si quieres el servidor en España (Logroño) y facturación de una empresa europea con soporte en español.

## 2. Qué hace hoy Vercel y quién lo hará en el VPS

| Hoy en Vercel | En el VPS | Herramienta |
|---|---|---|
| Despliegue al hacer push | Igual, configurado por ti | Coolify (GitHub App) o GitHub Actions |
| Vistas previas por PR | Igual, con más consumo del servidor | Coolify (preview deployments) |
| HTTPS automático | Igual | Traefik (lo trae Coolify) o Caddy |
| Dominios de los clientes por API (WEB-08) | Certificados al vuelo para cada dominio verificado | Caddy con *On-Demand TLS* (§5.3) |
| Escalado y CDN mundial | Un servidor; CDN opcional delante | Cloudflare (plan gratuito) para `cubierto.site` |
| Funciones en `fra1` | Un proceso Node.js siempre encendido | `next start` en modo `standalone` |
| Cron de Vercel | Tareas programadas | Coolify *Scheduled tasks* o cron del sistema llamando a `/api/cron/*` |
| Copias y alta disponibilidad | **Tuyas** | Copias diarias fuera del VPS (§4.2) |
| Parches de seguridad del sistema | **Tuyos** | Actualizaciones automáticas + revisión mensual |

## 3. Hostinger o IONOS

| | Hostinger VPS (KVM) | IONOS VPS |
|---|---|---|
| Empresa | Hostinger (Kaunas, Lituania) | IONOS (Montabaur, Alemania) |
| Centros de datos en la UE | Fráncfort, París, Lituania, Países Bajos, Reino Unido… | Alemania, España (Logroño), Francia, Reino Unido |
| Plan de entrada útil | KVM 2: 2 vCPU, 8 GB RAM, 100 GB NVMe | VPS M+: 4 vCores, 4 GB RAM, 120 GB NVMe (en algunas tiendas, 2 vCores) |
| Precio orientativo | KVM 1 ≈ 6,49 $/mes y KVM 2 ≈ 9 $/mes el primer periodo; **al renovar sube mucho** (KVM 1 ≈ 12 $, KVM 4 ≈ 29 $) | VPS M+ ≈ 9 €/mes con contrato de 1 año; ofertas de pocos euros los 3 primeros meses |
| Copias incluidas | Copia semanal y una instantánea | Copias de Acronis como extra de pago |
| Coolify | Plantilla "Ubuntu 24.04 with Coolify" (y otra con Dokploy) | Instalación con un comando |
| A favor | Mucha RAM por euro; plantillas de Coolify y Dokploy; API | Servidor en España; empresa alemana con soporte en español; precio estable con contrato anual |
| En contra | Subida fuerte al renovar; hay usuarios que reportan bajadas de rendimiento por CPU compartida en los planes grandes | Menos RAM por euro; los planes más baratos no dan para Docker |

**Consejo:** paga el primer periodo largo (12–24 meses) solo si los números aguantan también **al precio de renovación**. Elige el centro de datos de Fráncfort si la base de datos sigue en Neon (está en Fráncfort): la latencia entre los dos será mínima.

### Tamaño del servidor

| Etapa | Qué corre | Servidor |
|---|---|---|
| Ahora | Coolify + web comercial + Umami + n8n | 2 vCPU / 8 GB (Hostinger KVM 2) |
| Piloto (3 locales) | Lo anterior + plataforma Next.js | El mismo, vigilando RAM al compilar |
| 25–30 locales | Lo anterior + PostgreSQL propio (si sale de Neon) | 4 vCPU / 16 GB, o dos servidores: uno para apps y otro para datos |

Compilar Next.js en el propio servidor puede dejarlo sin memoria. Con 8 GB o menos, compila en GitHub Actions, sube la imagen a GitHub Container Registry y que Coolify solo la descargue y arranque.

## 4. Directrices

### 4.1 Seguridad (el primer día)

- [ ] Entrar solo con clave SSH; desactivar la contraseña y el acceso directo de `root`.
- [ ] Cortafuegos con solo los puertos 22, 80 y 443 abiertos (el del panel de Coolify, solo desde tu IP o detrás de su dominio con HTTPS).
- [ ] Actualizaciones de seguridad automáticas (`unattended-upgrades`) y `fail2ban`.
- [ ] Panel de Coolify con contraseña fuerte y doble factor; nunca expuesto en `http`.
- [ ] Secretos solo en las variables de entorno de Coolify; nunca en el repositorio ni en imágenes.
- [ ] Bases de datos sin puerto público: solo accesibles desde la red interna de Docker.
- [ ] Revisión mensual: actualizar Coolify, imágenes base y sistema; leer los avisos de seguridad de Next.js.

### 4.2 Copias de seguridad (regla 3-2-1)

Las copias semanales del proveedor **no bastan**: están en la misma empresa y pueden ser de hace seis días.

- [ ] Volcado diario de cada base de datos (Umami, n8n y, cuando toque, la plataforma) a un almacén **fuera del VPS** (Cloudflare R2, Backblaze o similar). Coolify programa copias de bases de datos a S3.
- [ ] Copia de los volúmenes con datos (subidas, configuración de n8n).
- [ ] Conservar 30 días de diarias y 12 mensuales.
- [ ] **Prueba de restauración mensual** en un servidor aparte. Una copia que no se ha restaurado nunca no es una copia.
- [ ] Mientras la plataforma use Neon, Neon guarda su propio historial; el volcado diario a R2 que pide `00-plataforma.md` §9 sigue haciendo falta.

### 4.3 Monitorización

- [ ] Monitor externo (UptimeRobot, Better Stack o Uptime Kuma en **otro** servidor) que avise al móvil si cae `cubierto.site`, `app.cubierto.site` o una web de cliente.
- [ ] Alertas de disco al 80 % y de memoria.
- [ ] Sentry para errores de la aplicación (ya previsto).
- [ ] Logs con rotación para que no llenen el disco.

### 4.4 Despliegues

- [ ] Rama `main` → producción; cada PR → vista previa (`pr-123.preview.cubierto.site`), sin indexar.
- [ ] Despliegues sin corte: Coolify arranca el contenedor nuevo antes de parar el viejo. Comprueba que el servicio tiene *health check*.
- [ ] Migraciones de base de datos compatibles hacia atrás (ya es regla en `CLAUDE.md` §8): el contenedor viejo y el nuevo conviven unos segundos.
- [ ] Un entorno de *staging* separado (proyecto aparte en Coolify) antes de tocar producción con clientes reales.

### 4.5 Correo, DNS y RGPD

- **Correo:** se sigue enviando con Resend. Nunca envíes email desde la IP del VPS: acabaría en spam.
- **DNS:** registro comodín `*.cubierto.site` apuntando al VPS (lo usan Coolify, las webs de los locales y las vistas previas).
- **RGPD:** Hostinger e IONOS son empresas de la UE y ofrecen contrato de encargo de tratamiento. Al migrar, actualiza las políticas de privacidad (web comercial y plataforma) con el nuevo proveedor y el país del servidor.

## 5. Cómo encaja cada pieza

### 5.1 Web comercial (Astro)

- Es estática salvo `/api/contacto/`. En el VPS se cambia el adaptador `@astrojs/vercel` por `@astrojs/node` y se sirve con Coolify (contenedor Node) o como estática + una pequeña función aparte.
- Es la primera candidata a migrar: poco riesgo y quita la dependencia del plan de pago de Vercel.

### 5.2 Plataforma (Next.js)

- `output: 'standalone'` en `next.config` y una imagen Docker pequeña (`node server.js`).
- **Una sola instancia** al principio: la caché de ISR y la optimización de imágenes funcionan en disco sin configurar nada.
- **Si algún día hay varias instancias:** caché compartida (Redis) con `cacheHandler` y la misma `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` en todas, o las Server Actions fallan entre instancias.
- Imágenes: `sharp` instalado en la imagen.
- Cron: las rutas `/api/cron/*` ya protegidas con `CRON_SECRET` (`00-necesidades.md` §5); Coolify las llama a su hora.

### 5.3 Dominios propios de los locales (WEB-08)

> **Cambio del 21/11/2026:** las webs de los locales ya no las sirve la plataforma; cada una es una web Astro estática con su propio proyecto (`modulos/01-webs.md` v0.3). En el VPS, cada web sería un sitio estático de Coolify con su dominio y su certificado de Let's Encrypt, y la plataforma solo atiende `<slug>.cubierto.site`. Lo de On-Demand TLS de abajo solo haría falta si la plataforma volviera a servir dominios propios.

Lo que se planteaba antes del cambio:

- Los subdominios `<slug>.cubierto.site` los cubre el certificado comodín.
- Para dominios propios (`casabrezo.es`), **Caddy con On-Demand TLS**: pide el certificado la primera vez que alguien entra, pero antes pregunta a la plataforma si ese dominio es de un cliente verificado.
  - Endpoint interno `GET /api/internal/tls-ask?domain=…` → 200 solo si existe un `Domain` con estado `VERIFIED`; si no, 404. Sin esto, cualquiera podría hacer que el servidor pidiera certificados para dominios ajenos.
  - Caddy va delante de Coolify para el tráfico de dominios propios, o se configura un dominio por cliente con la API de Coolify (aceptable con 30 clientes, peor a partir de ahí).

### 5.4 Base de datos

| Opción | A favor | En contra |
|---|---|---|
| **Seguir en Neon** (recomendado hasta tener soltura) | Copias, historial y ramas por PR gestionados; nada que mantener | Coste mensual y datos en otra empresa (de EE. UU., servidor en Fráncfort) |
| PostgreSQL en el VPS | Todo en un sitio; coste cero | Copias, actualizaciones, réplicas y restauraciones son tuyas; sin ramas por PR |

Si pasas a PostgreSQL propio: servidor (o al menos volumen) separado de las apps, copias continuas (WAL) a R2 y restauración probada antes de mover a ningún cliente.

### 5.5 Umami y n8n

- Ambos tienen plantilla en Coolify. Cada uno con su propia base de datos PostgreSQL interna y copia diaria.
- Umami autoalojado no tiene límite de webs y su API permite dar de alta cada web de local al activar `SITE` (`01-webs.md`).
- n8n: accesible solo por HTTPS, con usuario y doble factor; los webhooks públicos con secreto en la URL o en una cabecera.

## 6. Preparar la plataforma desde F0 para poder salir de Vercel

Reglas que cuestan poco ahora y ahorran una reescritura después:

1. **Nada exclusivo de Vercel en el dominio de negocio.** La API de dominios, Blob o Edge Config, siempre detrás de una interfaz propia (`DomainProvider`, `FileStorage`) con una implementación para Vercel y otra para el VPS.
2. **Runtime Node.js**, no Edge, en rutas y middleware que no lo necesiten.
3. **Almacenamiento de imágenes compatible con S3** (Cloudflare R2), no Vercel Blob.
4. **Cron como rutas HTTP** con `CRON_SECRET`, sin depender del formato de `vercel.json`.
5. **Variables de entorno documentadas** en `00-necesidades.md` §5 y nada leído de variables propias de Vercel sin valor por defecto.
6. **Dockerfile en el repo desde el principio**, aunque producción siga en Vercel: así se prueba en local y en el VPS de staging.

## 7. Ventajas e inconvenientes

| Ventajas | Inconvenientes |
|---|---|
| **Coste previsible y bajo:** un servidor de 10–30 €/mes aloja todo, frente a una cuota por usuario más consumo en Vercel | **El tiempo de mantenimiento es tuyo:** parches, copias, renovaciones, sustos a las 23:00 |
| **Datos en empresas europeas** (Hostinger, IONOS), más fácil de explicar a clientes y en el RGPD | **Un solo servidor = un solo punto de fallo.** Si cae, caen todas las webs a la vez. Vercel reparte el riesgo |
| Sin límites por proyecto, función o dominio; el plan gratuito de Vercel no admite uso comercial | Sin CDN mundial ni escalado automático (para clientes de Alcalá y el Corredor no es grave) |
| n8n, Umami y las webs en el mismo sitio, con la misma forma de desplegar | Compilar en el servidor consume RAM; hace falta CI o un servidor más grande |
| Te independiza de cambios de precio o de condiciones de Vercel | Los certificados de dominios propios y la protección contra abusos los configuras tú |
| Aprendes y controlas toda la pila (útil para vender mantenimiento) | Precios de renovación de Hostinger muy por encima del primer periodo |
| Puedes ofrecer "alojado en España" con IONOS | Si un proveedor suspende la cuenta, sin copia externa lo pierdes todo |

## 8. Plan de migración propuesto

| Fase | Qué | Cuándo | Hecho cuando |
|---|---|---|---|
| 1 | VPS + Coolify + seguridad (§4.1) + copias a R2 (§4.2) + monitor externo | Ya | Restauración de prueba correcta |
| 2 | n8n y Umami en el VPS | Ya | Umami midiendo `cubierto.site` |
| 3 | Web comercial al VPS (`@astrojs/node`) con Cloudflare delante | Antes de que acabe la prueba sin Vercel Pro | Lighthouse igual que hoy y formulario funcionando |
| 4 | Reglas de §6 en la plataforma; Dockerfile y staging en el VPS | F0 | La plataforma arranca igual en Vercel y en el VPS |
| 5 | Plataforma en el VPS; Caddy con On-Demand TLS para dominios propios | Tras el piloto, con 1–2 meses de estabilidad | Un local de prueba con dominio propio y HTTPS automático |
| 6 | (Opcional) PostgreSQL propio fuera de Neon | Cuando haya soltura con copias y restauraciones | Restauración completa probada en menos de 1 hora |

## 9. Cambios en las specs si se decide

- `01-contexto.md` §3: "Hosting" pasa a VPS con Coolify a largo plazo; "Plan B" pasa a ser el plan.
- `02-arquitectura.md`: diagrama de despliegue con VPS, Cloudflare, Caddy y Coolify.
- `modulos/01-webs.md` WEB-08: dominios por Caddy On-Demand TLS + endpoint `tls-ask`, en lugar de la API de Vercel.
- `00-necesidades.md` §4 y §5: cuentas (VPS, R2, monitor) y variables nuevas.
- `/CLAUDE.md` §11: "No usar APIs exclusivas de Vercel fuera de un adaptador".

## 10. Preguntas abiertas

- [x] ~~Hostinger o IONOS~~ Decidido el 19/11/2026: **Hostinger** (Manuel ya ha trabajado con él).
- [x] ~~¿La web comercial va al VPS ya, o Vercel Pro mientras tanto?~~ Decidido el 19/11/2026: **Vercel Pro mientras tanto**; la mudanza sigue `plan-vps-hostinger.md`.
- [ ] Base de datos: ¿Neon indefinidamente o PostgreSQL propio a partir de cuántos clientes?
- [ ] ¿Un VPS para todo, o separar producción de staging/vistas previas desde el principio?

## Fuentes

- Hostinger: [planes VPS](https://www.hostinger.com/vps-hosting), [plantilla de Coolify](https://www.hostinger.com/support/9615197-how-to-use-the-coolify-vps-template-at-hostinger/) y [plantilla de Dokploy](https://www.hostinger.com/support/?p=489)
- Precios de renovación y centros de datos de Hostinger: [learnwithhasan.com](https://learnwithhasan.com/self-hosting-hub/vps-providers/hostinger-vps/), [valebyte.com](https://valebyte.com/en/providers/hostinger/)
- IONOS: [planes VPS](https://www.ionos.com/es-us/servidores/vps), [centros de datos](https://learnwithhasan.com/self-hosting-hub/vps-providers/ionos-vps/)
- Next.js: [guía oficial de autoalojamiento](https://nextjs.org/docs/app/guides/self-hosting)
- Caddy: [On-Demand TLS](https://caddyserver.com/on-demand-tls)
- Vercel: [plan Hobby, solo uso no comercial](https://vercel.com/docs/plans/hobby)
