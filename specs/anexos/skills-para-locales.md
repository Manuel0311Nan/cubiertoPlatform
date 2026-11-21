# Skills que ayudan a los locales en su día a día

Resumen de agent skills útiles para el trabajo diario de un bar o restaurante, con prioridad en posicionar su web y su ficha de Google lo más arriba posible.

Consultado el 14/11/2026 en [skills.sh](https://skills.sh/coreyhaines31/marketingskills) y [Tessl](https://tessl.io/registry/skills/github/AgriciDaniel/claude-seo/seo-local). Las instalaciones cambian cada semana; revisa antes de usar.

## Cómo se usan en este negocio

El dueño del restaurante **no instala skills**: son instrucciones para agentes de IA. Hay dos formas de aprovecharlas:

1. **Como herramienta tuya (desde ya).** Las usas con Claude Code para dar servicio a cada cliente: auditar su SEO, preparar textos, revisar su ficha de Google. Es trabajo que vendes dentro de "Web + mantenimiento" o como servicio aparte.
2. **Como funcionalidad del producto (más adelante).** Lo que hace una skill se convierte en una tarea del servicio de IA de la plataforma (`specs/modulos/04-ia.md`), para que el dueño lo haga solo desde su panel, con revisión antes de publicar.

## Posicionamiento (SEO): la prioridad

| Skill | Repositorio | Qué hace | Cómo la aplicamos |
|---|---|---|---|
| `seo-local` | `AgriciDaniel/claude-seo` | Auditoría de SEO local: ficha de Google Business, coherencia de nombre-dirección-teléfono en directorios, reseñas, schema local y páginas por ubicación. Detecta restaurantes y aplica comprobaciones específicas. Puntúa sobre 100 y da un top 10 de acciones | **Auditoría inicial** de cada cliente nuevo y **revisión mensual** del mantenimiento |
| `seo-audit` | `coreyhaines31/marketingskills` | Auditoría SEO general de la web: técnica, contenido, enlaces | Revisar la web antes de entregarla y tras cambios grandes |
| `schema-markup` / `schema` | `coreyhaines31/marketingskills` | Datos estructurados (schema.org) | Comprobar el JSON-LD `Restaurant` que genera la plataforma (WEB-07) |
| `ai-seo` | `coreyhaines31/marketingskills` | Aparecer en las respuestas de buscadores con IA (ChatGPT, Google AI) | Cada vez más gente pregunta "dónde comer en Alcalá" a un asistente; conviene cuidarlo |
| `directory-submissions` | `coreyhaines31/marketingskills` | Alta en directorios | TripAdvisor, TheFork, Yelp, guías locales, con los mismos datos que en Google |
| `content-strategy` | `coreyhaines31/marketingskills` | Plan de contenidos | Ideas de páginas útiles: menú del día, eventos, celíacos, grupos |

**Servicio "SEO local" que puedes ofrecer**, con estas skills y lo que ya hace la plataforma:
1. Auditoría con `seo-local` + `seo-audit` → informe con la puntuación de partida.
2. Ficha de Google Business: categorías, horario, fotos, enlace a carta y reservas, publicaciones.
3. Mismos datos (nombre, dirección, teléfono) en web, Google y directorios.
4. Reseñas: pedirlas tras la visita y responderlas todas.
5. Web: `Restaurant` en JSON-LD, carta indexable, velocidad (la plataforma ya lo cubre).
6. Repetir la auditoría cada mes e incluir la evolución en el informe mensual (WEB-10).

**Límites, para ser honestos con el cliente:** nadie puede garantizar el primer puesto en Google. Lo que más pesa en el mapa local es la ficha de Google, la cercanía y las reseñas; la web ayuda, pero no lo es todo. Ni las páginas por ciudad con texto duplicado ni las reseñas escritas a mano: penalizan y van contra las normas de Google.

## Comunicación y ventas del local

| Skill | Repositorio | Uso en un restaurante |
|---|---|---|
| `copywriting` / `copy-editing` | `coreyhaines31/marketingskills` | Textos de la web, descripciones de platos, cartas de temporada |
| `social-content` / `social` | `coreyhaines31/marketingskills` | Publicaciones de Instagram del menú del día, eventos y platos nuevos |
| `email-sequence` / `emails` | `coreyhaines31/marketingskills` | Correos a clientes que han dado su consentimiento: aniversarios, novedades, eventos |
| `sms` | `coreyhaines31/marketingskills` | Avisos por SMS; mismas reglas de consentimiento |
| `offers` / `marketing-ideas` | `coreyhaines31/marketingskills` | Ideas para llenar días flojos: menú de mediodía, afterwork, grupos |
| `referral-program` | `coreyhaines31/marketingskills` | "Trae a un amigo" para clientes habituales |
| `competitor-profiling` | `coreyhaines31/marketingskills` | Comparar con los locales de la zona: precios, reseñas, presencia online |

Todo lo que envíe mensajes a comensales necesita consentimiento previo (RGPD/LSSI): la plataforma ya guarda `marketingConsentAt` en la ficha de cliente (RES-13).

## Gestión y documentos

| Skill | Fuente | Uso |
|---|---|---|
| `xlsx` | Anthropic (oficial) | Hojas de costes, escandallos, control de mermas |
| `docx` / `pdf` | Anthropic (oficial) | Presupuestos para eventos, menús de grupo en PDF, informes |
| `analytics-tracking` | `coreyhaines31/marketingskills` | Medir de dónde vienen las reservas (web, Google, Instagram) |

## Para construir y revisar el producto

| Skill | Fuente | Uso |
|---|---|---|
| `frontend-design` | Anthropic | Diseño de las webs de clientes y del panel |
| `web-design-guidelines` | Vercel | Revisión de accesibilidad y usabilidad |
| `vercel-react-best-practices` | Vercel | Calidad del código React/Next.js |
| `neon-postgres` · `prisma-client-api` | Neon · Prisma | Base de datos |
| `playwright-cli` / `webapp-testing` | Microsoft · Anthropic | Tests de extremo a extremo |
| `find-skills` | Vercel Labs | Buscar e instalar otras skills cuando haga falta |

## Reglas antes de instalar una skill

- Leer su `SKILL.md` y los scripts que traiga: son instrucciones que el agente va a seguir.
- Preferir fuentes oficiales o con mucho uso. La calidad varía: `seo-local`, por ejemplo, tiene 67/100 de calidad en Tessl (riesgo de seguridad bajo).
- Instalar a nivel de proyecto (`.claude/skills/`) y subirlas al repositorio, para saber qué usa cada proyecto.
- Comando: `npx skills add <repositorio> --skill <nombre>`, o pedírselo a `find-skills`.
