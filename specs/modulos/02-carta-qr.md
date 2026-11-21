# 02 · Carta digital y QR (`MENU`)

**Estado:** Borrador v0.2 · **Fase:** F2 · **Depende de:** `00-plataforma.md`

## 1. Objetivo

El restaurante publica su carta en el móvil del comensal con un QR, la cambia al momento (precios, platos agotados, menú del día) y cumple la obligación de informar de alérgenos. Es el módulo de entrada: barato, se ve en un día y apenas genera soporte.

## 2. Alcance MVP

**Incluye:** varias cartas por local (Carta, Menú del día, Bebidas…), secciones, platos con precio, foto, descripción, alérgenos y etiquetas, estado agotado, disponibilidad por días/horas, traducción asistida a otros idiomas con revisión, QR general y por mesa, PDF imprimible de QR, **carta en papel imprimible (MENU-10)**, página pública rápida sin login.

**Fuera de alcance MVP (fase 2):** pedidos en mesa, carrito, pantalla de cocina, pago en mesa, propinas, integración con TPV, variantes con modificadores de precio complejos, inventario.

## 3. Página pública

- URL: `app.<PLATFORM_DOMAIN>/c/<slug>` y, si el QR es de mesa, `app.<PLATFORM_DOMAIN>/c/<slug>?t=<qrToken>`. **Provisional** hasta antes de F2 (ver `00-plataforma.md` §10): una vez impresos los QR, la dirección no se puede cambiar.
- Muestra las cartas disponibles **ahora** (según su ventana de disponibilidad y la zona horaria del local); el resto, plegadas como "Disponible de 13:00 a 16:00".
- Navegación por secciones fija arriba; buscador de platos; filtro "Sin…" por alérgeno (oculta platos que contienen el alérgeno elegido).
- Selector de idioma visible si hay traducciones publicadas; por defecto, el idioma del navegador si existe, si no español.
- Pie fijo con aviso legal sobre alérgenos (texto de §6, MENU-05) y enlace a reservas si `RESERVATIONS` está activo.
- Sin cookies ni login. Estática con revalidación por tag `tenant:<id>:menu`.

## 4. Alérgenos

Lista cerrada de los 14 alérgenos de declaración obligatoria (Reglamento UE 1169/2011):

`GLUTEN`, `CRUSTACEANS`, `EGGS`, `FISH`, `PEANUTS`, `SOY`, `MILK`, `TREE_NUTS`, `CELERY`, `MUSTARD`, `SESAME`, `SULPHITES`, `LUPIN`, `MOLLUSCS`

Cada uno con icono, nombre en todos los idiomas soportados y descripción corta. La lista no es editable por el tenant.

## 5. Modelo de datos

```prisma
model Menu {
  id          String  @id @default(cuid())
  tenantId    String
  venueId     String
  name        String                     // "Carta", "Menú del día"
  description String?
  type        MenuType @default(A_LA_CARTE) // A_LA_CARTE | SET_MENU
  setPriceCents Int?                     // solo SET_MENU: precio cerrado del menú
  availability Json?                     // [{ days: [1..7], from: "13:00", to: "16:00" }]; null = siempre
  position    Int
  isPublished Boolean @default(false)
  deletedAt   DateTime?
  @@index([tenantId, venueId])
}

model MenuSection {
  id        String @id @default(cuid())
  tenantId  String
  menuId    String
  name      String                       // "Entrantes"
  description String?                    // "Elige uno" en menús del día
  position  Int
  @@index([tenantId, menuId])
}

model MenuItem {
  id          String  @id @default(cuid())
  tenantId    String
  sectionId   String
  name        String
  description String?                    // ≤ 300 caracteres
  priceCents  Int?                       // null en SET_MENU o "precio según mercado"
  priceNote   String?                    // "S/M", "por persona", "ración / media"
  imageAssetId String?
  allergens   Allergen[]                 // de la lista cerrada
  mayContain  Allergen[]                 // trazas
  tags        MenuTag[]                  // VEGETARIAN | VEGAN | SPICY | HOUSE_SPECIAL | NEW
  isAvailable Boolean @default(true)     // false = "Agotado"
  position    Int
  deletedAt   DateTime?
  @@index([tenantId, sectionId])
}

model Translation {                      // para Menu, MenuSection y MenuItem
  id         String @id @default(cuid())
  tenantId   String
  entityType String                      // "Menu" | "MenuSection" | "MenuItem"
  entityId   String
  locale     String                      // "en", "fr", "de", "it", "pt"
  fields     Json                        // { name, description, priceNote }
  status     TranslationStatus           // DRAFT_AI | REVIEWED | STALE
  sourceHash String                      // hash del texto en español al traducir
  @@unique([entityType, entityId, locale])
  @@index([tenantId, locale])
}

model MenuSettings {
  tenantId        String @id
  enabledLocales  String[]               // idiomas publicados además de "es"
  showPrices      Boolean @default(true)
  allergenNoticeExtra String?            // texto adicional del local
}
```

## 6. Historias de usuario

### MENU-01 · Ver la carta escaneando el QR
Como comensal quiero ver la carta en mi móvil sin instalar nada.
- Carga en < 2 s en 4G con móvil medio; usable con una mano; texto mínimo 16 px.
- Muestra precios con IVA incluido y el símbolo €, formato español (`12,50 €`).
- Un `qrToken` inexistente o de mesa desactivada muestra la carta igualmente (sin datos de mesa), nunca un error.

### MENU-02 · Gestionar cartas y secciones
Como OWNER quiero organizar mi carta.
- Crear, renombrar, reordenar (arrastrar) y eliminar (soft delete) cartas, secciones y platos.
- Duplicar una carta entera (útil para "Menú del día" o temporadas).
- Vista previa idéntica a la pública antes de publicar; `isPublished` controla si una carta aparece.

### MENU-03 · Editar platos
- Formulario con nombre, descripción, precio (o nota de precio), foto, alérgenos, trazas y etiquetas.
- Precio introducido como texto en formato español (`12,5` o `12,50`) y guardado en céntimos.
- Guardar revalida la carta pública en < 60 s.

### MENU-04 · Marcar agotado al momento
Como STAFF quiero marcar un plato como agotado desde el móvil durante el servicio.
- Pantalla `/panel/carta/servicio` con todos los platos y un interruptor por plato; un toque y se guarda.
- El plato se muestra "Agotado" (no se oculta) en la carta pública en < 60 s.
- Botón "Reponer todo" al terminar el servicio.

### MENU-05 · Alérgenos obligatorios
- Al guardar un plato sin ningún alérgeno marcado, el editor pide confirmación explícita: "Este plato no contiene ninguno de los 14 alérgenos".
- Cada plato muestra sus iconos de alérgenos con nombre accesible (no solo icono).
- La carta pública muestra siempre el aviso: "Si tienes alguna alergia o intolerancia, consulta al personal antes de pedir" + `allergenNoticeExtra`.
- El filtro "Sin…" se basa en `allergens` y también oculta platos con `mayContain` del alérgeno elegido.

### MENU-06 · Menú del día
- Una carta `SET_MENU` muestra un precio cerrado y secciones tipo "Primeros (a elegir)".
- Con `availability` solo aparece como disponible en sus días y horas; fuera de ellas se muestra plegada con su horario.
- Duplicar y editar el menú del día lleva menos de 2 minutos (objetivo de diseño).

### MENU-07 · Traducción asistida
- El OWNER activa idiomas (inglés, francés, alemán, italiano, portugués).
- "Traducir con IA" genera traducciones `DRAFT_AI` de toda la carta con la tarea `menu.translate` del servicio de IA (`04-ia.md`, en segundo plano), conservando nombres propios de platos si así se indica.
- Las traducciones `DRAFT_AI` no se publican hasta que el OWNER las revisa (`REVIEWED`) en una vista lado a lado.
- Si cambia el texto en español, la traducción pasa a `STALE` (comparando `sourceHash`) y se muestra el texto en español hasta revisarla.
- Los alérgenos usan siempre los nombres oficiales de la lista, no la traducción automática.

### MENU-08 · QR general y por mesa
- QR general del local (apunta a `/c/<slug>`) y un QR por mesa activa (apunta a `/c/<slug>?t=<qrToken>`).
- Descarga en PNG/SVG y un PDF A4 imprimible con varias tarjetas por hoja (nombre del local, número de mesa, texto "Escanea para ver la carta").
- El QR apunta siempre a la plataforma, de modo que cambiar la carta no obliga a reimprimir.

### MENU-09 · Visibilidad de precios
- `showPrices = false` oculta todos los precios (para cartas de evento o vinos por consulta) y muestra "Consultar precio".
- **Revisar antes de F2 (§9):** la normativa exige precios visibles; ocultarlos solo cabe en cartas que no se venden al público (eventos privados).

### MENU-10 · Carta en papel imprimible
Por qué: en la Comunidad de Madrid el local debe ofrecer en todo momento la carta y la lista de precios en formato físico; el QR es siempre opcional para el cliente y no puede pedir registro ni datos ([Comunidad de Madrid](https://www.comunidad.madrid/node/73652)). La web comercial promete que la carta en papel sale del mismo sitio que la del QR.
- Desde el panel, "Imprimir carta" genera un PDF A4 (y A5) de cada carta activa con secciones, platos, precios con IVA y los alérgenos de cada plato (o la indicación de dónde consultarlos).
- Mismo origen de datos que la página pública: un precio cambiado en el panel sale igual en el QR y en el PDF siguiente. El PDF lleva la fecha de generación al pie.
- Incluye el QR general en una esquina y el texto "También en tu móvil".
- Tras cambiar un precio, el panel muestra un aviso: "Has cambiado precios: imprime la carta en papel actualizada".

## 7. Fase 2 (no construir en el MVP)

Para que el modelo no lo impida: pedidos en mesa usarán `Table.qrToken` para saber la mesa, un `Order` con líneas que referencian `MenuItem` y copian nombre y precio en el momento del pedido, una pantalla de sala/cocina en tablet y pago opcional con Stripe Checkout. No crear tablas ni rutas de esto ahora.

## 8. Tests clave

- MENU-01: carta del tenant A no aparece con el slug del tenant B; token de mesa de otro tenant → carta sin mesa.
- MENU-03: `"12,5"` → `1250`; `"12.50"` → `1250`; `"abc"` → error de validación.
- MENU-05: el filtro "sin gluten" oculta platos con `GLUTEN` en `allergens` o en `mayContain`.
- MENU-06: carta con ventana L–V 13:00–16:00 aparece disponible un martes a las 14:00 en `Europe/Madrid` y no un sábado.
- MENU-07: editar el nombre en español marca la traducción como `STALE` y la pública vuelve al español.
- MENU-10: un precio cambiado aparece igual en la página pública y en el PDF generado después; el PDF muestra la fecha de generación.

## 9. Preguntas abiertas

- [ ] ¿Límite de platos o fotos por plan? (propuesta: sin límite en el MVP, revisar con el uso)
- [ ] ¿Cartas de vinos con varios precios por plato (copa / botella)? Si es frecuente, añadir `priceVariants` antes de F2.
- [ ] Coste de traducción con IA: ¿incluido sin límite o con un número de traducciones al mes?
- [ ] MENU-09: ¿se mantiene ocultar precios? La normativa pide precios visibles en la carta al público (19/11/2026).
