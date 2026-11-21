# Cubierto · plataforma

Plataforma multi-tenant para bares y restaurantes: panel de cada local, superadmin, carta QR, reservas y API pública. Monorepo con pnpm + Turborepo.

**Antes de tocar nada:** `CLAUDE.md` (cómo se trabaja) y `specs/README.md` (qué se construye). Contexto de cómo se llegó aquí: `CONTEXTO-CHAT.md`.

## Arrancar

```bash
corepack enable        # activa pnpm (versión fijada en package.json)
pnpm install
pnpm dev               # apps/platform en http://localhost:3000
```

Requiere Node ≥ 22.23.4 (`.nvmrc` = 24).

## Estructura

```
apps/platform/   # la app Next.js (panel, superadmin, carta y reservas públicas)
packages/        # paquetes compartidos (db, ai, ui, config…), según CLAUDE.md §4
specs/           # fuente de verdad de producto
```
