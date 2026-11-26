# @cubierto/ai

Conexión con los proveedores de IA (`specs/modulos/04-ia.md`). Sin Prisma ni Next: no sabe de locales, presupuestos ni base de datos.

- **No se usa directamente desde la app.** Desde `apps/platform`, toda tarea pasa por `runAiTask` o `enqueueAiJob` (`src/modules/ai`), que comprueban el presupuesto y guardan el uso (CLAUDE.md §6.10).
- Es el único sitio donde se importan SDKs de proveedores (`ai`, `@ai-sdk/*`). Una regla de ESLint lo impide en la app.

| Archivo | Qué hace |
|---|---|
| `src/client.ts` | `runTask()`: salida estructurada validada con Zod, un reintento si no vale, reintento ante 429/5xx y respaldo |
| `src/models.ts` | Modelo de cada nivel (`fast`, `standard`, `advanced`) desde el entorno; modo `live` o `mock` |
| `src/pricing.ts` | Precio por millón de tokens de cada modelo y coste estimado en micro-euros |
| `src/providers/` | Anthropic y el proveedor simulado (`mock`, AI-08) |
| `src/task.ts` | Contrato de una tarea (`defineTask`) |

Variables: ver `.env.example` (`ANTHROPIC_API_KEY`, `AI_PROVIDER`, `AI_MODEL_*`, `AI_FALLBACK_*`, `AI_TIMEOUT_MS`).
