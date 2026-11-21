# Plan: llevar la web comercial a un VPS de Hostinger

**Estado:** v0.1 · **Fecha:** 19/11/2026 · **Owner:** Manuel · **Guía general:** `alojamiento-vps.md`

## 0. Decisiones (19/11/2026)

- **Proveedor:** Hostinger (Manuel ya ha trabajado con él).
- **Mientras tanto:** la web comercial sigue en **Vercel Pro**. Este plan se ejecuta sin prisa y sin cortar el servicio.
- **Alcance:** el VPS, la web comercial, Umami y n8n. La plataforma (`app.cubierto.site`) vendrá después, con su propio plan, cuando el piloto esté estable.

**Objetivo:** `cubierto.site` servida desde el VPS, con el mismo Lighthouse que hoy, el formulario funcionando, copias fuera del servidor y un aviso al móvil si se cae. Vercel queda como plan de vuelta atrás durante dos semanas.

**Tiempo estimado:** 2–3 tardes de trabajo, repartidas en 2–3 semanas para poder observar cada paso.

## 1. Lo que hay que tener antes de empezar

| Qué | Para qué | Estado |
|---|---|---|
| VPS Hostinger **KVM 2** (2 vCPU, 8 GB, 100 GB NVMe), centro de datos **Fráncfort**, plantilla **"Ubuntu 24.04 with Coolify"** | Servidor | Por contratar. Mira el precio de **renovación**, no solo el del primer periodo |
| Saber dónde están los DNS de `cubierto.site` (registrador, Vercel o Cloudflare) | El día del cambio se toca ahí | Por comprobar |
| Lista de registros DNS actuales: MX y SPF/DKIM/DMARC del correo `hola@cubierto.site` y de Resend | **No perderlos** al mover DNS | Por exportar |
| Cuenta de Cloudflare (gratis) con un bucket R2 | Copias fuera del VPS | Por crear |
| Monitor externo (UptimeRobot o Better Stack, plan gratuito) | Aviso al móvil si se cae | Por crear |
| Clave SSH en tu ordenador (`ssh-keygen -t ed25519`) | Entrar al servidor sin contraseña | Por crear |

Si los DNS están ahora en Vercel, el primer paso de todos es **pasarlos a Cloudflare** (o al registrador), copiando todos los registros. Si no, al cancelar Vercel te quedarías sin DNS.

## 2. Fase A · Montar el servidor (sin tocar la web publicada)

### A1. Contratar y asegurar

- [ ] Contratar el KVM 2 con la plantilla de Coolify en Fráncfort.
- [ ] Añadir tu clave SSH en hPanel y comprobar que entras: `ssh root@IP`.
- [ ] Crear un usuario propio con `sudo`, entrar con él y desactivar en `/etc/ssh/sshd_config` el acceso de `root` y las contraseñas (`PermitRootLogin no`, `PasswordAuthentication no`). Antes de cerrar la sesión, comprueba en otra ventana que sigues pudiendo entrar.
- [ ] Cortafuegos en hPanel: abrir solo **22, 80 y 443**. El puerto 8000 del panel de Coolify, solo desde tu IP y solo hasta que el panel tenga su dominio con HTTPS.
- [ ] `sudo apt install unattended-upgrades fail2ban` y activar las actualizaciones de seguridad automáticas.

### A2. Coolify

- [ ] DNS: registro A `coolify.cubierto.site` → IP del VPS.
- [ ] En Coolify: dominio del panel `https://coolify.cubierto.site`, contraseña fuerte y **doble factor**. Cerrar después el puerto 8000.
- [ ] Conectar GitHub con la GitHub App de Coolify, con acceso solo al repo de la web comercial.
- [ ] Destino de copias S3: el bucket de R2 (endpoint, claves de acceso con permiso solo para ese bucket).

### A3. Umami y n8n

- [ ] DNS: `stats.cubierto.site` y `n8n.cubierto.site` → IP del VPS.
- [ ] Umami desde las plantillas de Coolify, con su PostgreSQL. Usuario admin con contraseña fuerte; dar de alta la web `cubierto.site`.
- [ ] n8n desde las plantillas de Coolify, con usuario y doble factor.
- [ ] Copia diaria de las dos bases de datos a R2 (30 diarias y 12 mensuales).
- [ ] **Prueba de restauración**: restaurar la base de Umami en un contenedor aparte y comprobar que tiene datos. Sin esto la fase no está terminada.

**Hecho cuando:** entras al panel por HTTPS con doble factor, Umami y n8n responden en sus dominios y has restaurado una copia.

## 3. Fase B · Preparar la web para el VPS (un PR en `zoenlab-web`)

El mismo código debe poder publicarse en Vercel y en el VPS durante la transición. Probado el 19/11/2026 en una copia: con `@astrojs/node` la web se genera, sirve todas las páginas y `/api/contacto/` responde.

### B1. Adaptador según el destino

```bash
npm i -D @astrojs/node@^11   # compatible con Astro 7
```

`astro.config.mjs`:

```js
import vercel from '@astrojs/vercel';
import node from '@astrojs/node';

// DEPLOY_TARGET=node genera un servidor Node para el VPS; sin valor, Vercel.
const target = process.env.DEPLOY_TARGET === 'node' ? 'node' : 'vercel';

export default defineConfig({
  // …
  adapter: target === 'node' ? node({ mode: 'standalone' }) : vercel(),
});
```

`@astrojs/node` va en `dependencies` (no en `devDependencies`) si el contenedor instala solo producción.

### B2. Dockerfile

```dockerfile
FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
ENV DEPLOY_TARGET=node
RUN npm run build

FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production HOST=0.0.0.0 PORT=4321
COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules ./node_modules
COPY package.json ./
USER node
EXPOSE 4321
HEALTHCHECK CMD wget -qO- http://127.0.0.1:4321/ >/dev/null || exit 1
CMD ["node", "dist/server/entry.mjs"]
```

Las variables `PUBLIC_*` se leen **al compilar**: en Coolify van como *build variables*. `RESEND_API_KEY`, `CONTACT_TO` y `CONTACT_FROM` van como variables de ejecución y nunca en la imagen.

### B3. Cabeceras que hoy pone Vercel

- `/_astro/*` (archivos con hash): `Cache-Control: public, max-age=31536000, immutable`. El servidor de Node los sirve con `max-age=0`, lo que empeora la puntuación de Lighthouse. Se pone con una regla de Traefik en Coolify o en Cloudflare.
- `/sw.js` y `/manifest.webmanifest`: sin caché (`no-cache`), igual que ahora.
- Cabeceras de seguridad básicas: `Strict-Transport-Security`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`.

### B4. Que el staging no se indexe

Variable `PUBLIC_NOINDEX=true` en staging que añada `<meta name="robots" content="noindex">` en `Base.astro` y un `robots.txt` con `Disallow: /`. En producción no se define.

### B5. Documentación

- README: cómo compilar para el VPS (`DEPLOY_TARGET=node npm run build`) y para Vercel.
- `CLAUDE.md` del repo: §2 (stack) y §3 (comandos) con el doble destino; "Qué NO hacer": no usar nada exclusivo de Vercel.

**Hecho cuando:** el PR está fusionado, Vercel sigue publicando igual y `docker build` funciona en local.

## 4. Fase C · Staging en el VPS

- [ ] DNS: `staging.cubierto.site` → VPS.
- [ ] En Coolify, aplicación desde el repo con el Dockerfile, rama `main`, dominio `staging.cubierto.site`, variables de B2 y `PUBLIC_NOINDEX=true`.
- [ ] Comprobar en staging:
  - [ ] Todas las páginas del sitemap responden 200; `/no-existe/` responde 404 con su página.
  - [ ] El formulario llega por Resend (con un `CONTACT_TO` de pruebas) y sin JavaScript redirige a `/gracias/`.
  - [ ] Lighthouse móvil ≥ 95 en home, un servicio, `/precios/` y una guía (hoy 99–100).
  - [ ] La PWA se instala y `/offline/` aparece sin conexión.
  - [ ] Las cabeceras de B3 están puestas (`curl -I`).
  - [ ] `noindex` presente en staging.
- [ ] Umami de staging (otra web en Umami) recibe visitas y los eventos `pedir-demo`, `contacto-enviado` y `llamar`.
- [ ] Monitor externo vigilando `staging.cubierto.site` una semana.

**Hecho cuando:** una semana en staging sin caídas ni errores, y todas las casillas marcadas.

## 5. Fase D · El cambio (día D)

**Antes (48 h):**
- [ ] Bajar el TTL de los registros `@` y `www` de `cubierto.site` a 300 s.
- [ ] Añadir en Coolify los dominios `cubierto.site` y `www.cubierto.site` (www → redirección 301 a la raíz) a una aplicación de producción, sin `PUBLIC_NOINDEX`, con el `CONTACT_TO` real y el `websiteId` de Umami de producción.

**Día D (a primera hora de la mañana, con poco tráfico):**
- [ ] Cambiar los registros A/AAAA de `@` y `www` a la IP del VPS. **No tocar MX, SPF, DKIM ni DMARC.**
- [ ] Esperar a que Coolify obtenga el certificado (minutos) y comprobar `https://cubierto.site` y `https://www.cubierto.site`.
- [ ] Repetir las comprobaciones de la Fase C en producción y enviar un formulario real.
- [ ] Comprobar que llega un email normal a `hola@cubierto.site` (el correo no debe verse afectado).
- [ ] Monitor externo apuntando a `cubierto.site`.

**Después:**
- [ ] Search Console: revisar errores de rastreo e indexación durante dos semanas.
- [ ] Actualizar la política de privacidad: alojamiento en Hostinger (Fráncfort) en lugar de Vercel, y Umami autoalojado en el mismo servidor. Sale el texto de Vercel; Resend se queda.
- [ ] Subir el TTL a su valor normal pasada una semana.

## 6. Vuelta atrás

Mientras el proyecto siga en Vercel, volver es devolver los registros A/AAAA de `@` y `www` a Vercel (con TTL 300, efecto en minutos).

- Se vuelve si: la web no responde más de 15 minutos, falla el formulario o el Lighthouse cae por debajo de 90 sin arreglo rápido.
- **No se borra el proyecto de Vercel hasta dos semanas sin incidencias.**

## 7. Después de la mudanza: qué hacer con Vercel Pro

- Con la web comercial en el VPS, Vercel Pro solo haría falta para la plataforma, que aún no existe.
- Opciones a decidir entonces: **(a)** bajar a Hobby o cancelar y empezar F0 directamente en el VPS (siguiendo §6 de `alojamiento-vps.md`), o **(b)** mantener Pro para desarrollar F0 con vistas previas de Vercel y llevarla al VPS tras el piloto.
- Recomendación: **(a)** si las fases A–D salen bien; ya tendrás Coolify con vistas previas por PR.

## 8. Costes orientativos

| Concepto | Ahora | Tras la mudanza |
|---|---|---|
| Vercel Pro | 1 asiento | 0 o 1, según §7 |
| VPS Hostinger KVM 2 | — | Precio del primer periodo; prevé el de renovación (bastante más alto) |
| Cloudflare R2 (copias) | — | Céntimos con este volumen; tiene capa gratuita |
| Monitor externo | — | 0 € en plan gratuito |
| Umami | Cloud gratuito | Incluido en el VPS |

## 9. Riesgos

| Riesgo | Cómo se cubre |
|---|---|
| Perder el correo al mover DNS | Exportar todos los registros antes; no tocar MX/SPF/DKIM/DMARC |
| Servidor sin memoria al compilar | KVM 2 (8 GB). Si falla, compilar en GitHub Actions y que Coolify solo arranque la imagen |
| Caída del VPS = web caída | Monitor externo; Vercel como vuelta atrás las dos primeras semanas; copias en R2 |
| Peor puntuación en Lighthouse por la caché | Cabeceras de B3; medir en staging antes del día D |
| Suspensión o problema con el proveedor | Copias diarias fuera (R2) y el repo como fuente: se puede montar en otro VPS en una tarde |
| Subida de precio al renovar | Calcular con el precio de renovación antes de pagar varios años |
