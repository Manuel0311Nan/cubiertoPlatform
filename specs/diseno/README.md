# Diseño

**Estado:** v0.1 · **Última actualización:** 16/11/2026

Cómo se ve Cubierto y qué pantallas hay diseñadas. Si una vista y una spec no coinciden, **manda la spec** (ver §5).

## 1. Archivos

| Archivo | Qué es |
|---|---|
| `vistas-movil.html` | Las 17 pantallas en móvil (M1–M17), a tamaño real. Se abre en el navegador (necesita conexión para las fuentes) |
| `vistas-ordenador.html` | Las 22 pantallas en ordenador (D1–D22), a 1280 px |
| `marca/` | Logo en SVG: logo completo, solo nombre, solo símbolo, iconos de app y favicon. Reglas en `marca/LEEME.md` |

## 2. Dos capas visuales

**Cubierto (panel, superadmin, emails de la plataforma):**

| Token | Valor | Uso |
|---|---|---|
| Verde botella | `#1D4A3A` | Marca, barra lateral del panel, botones secundarios |
| Azafrán | `#E8A317` | Acción principal y "llega pronto" en la sala |
| Tinta | `#14281F` | Texto |
| Gris | `#4B6158` | Texto secundario |
| Línea | `#C9D6CF` | Bordes |
| Papel | `#F7F8F5` | Fondo |
| Tomate | `#B83A27` | **Solo** errores y "agotado" |

Tipografía única: **Bricolage Grotesque** (la misma que la web comercial y el logo).

**Cada local:** su web tiene diseño propio (es una web Astro a medida, `modulos/01-webs.md` v0.3). Su carta, su página de reservas y sus emails a comensales usan su color y su logo (pendiente de decidir dónde se fijan, ahora que WEB-04 está descartada: `modulos/01-webs.md` §9). Las vistas usan de ejemplo a "Casa Brezo" con el tema rústico: marrón `#2B2118`, terracota `#C8553D`, fondo `#FBFAF6`, títulos en Fraunces. Casa Brezo y sus platos son inventados.

## 3. Principios

- **Móvil primero y de pie en sala:** botones de 44 px o más, la acción del momento es la más grande ("Ha llegado: sentar").
- **El plano de sala es la pieza principal** del módulo de reservas. En móvil, las mesas pasan a fichas por zona porque el plano no se lee (M15).
- **Los colores dicen algo:** libre (blanco), llega en menos de 1 h (azafrán), en mesa (verde), mesas juntas (verde con borde grueso).
- **Textos:** español de España, tuteo, frases cortas, sin mayúsculas en etiquetas ni flechas en botones. Los botones dicen lo que pasa ("Guardar reserva", "Reponer todo al cerrar").
- **Accesible:** contraste AA, foco visible, controles de estado con `role="switch"`/`aria-pressed`, el plano con nombre por mesa.

## 4. Índice de vistas

| Vista | Pantalla | Specs |
|---|---|---|
| M1, D1 | Web del local | WEB-01, WEB-07 |
| M2 | Aviso de cookies (solo si algún bloque carga terceros; hoy no aparece) | WEB-09 |
| M3, D2 | Carta con QR / en ordenador | MENU-01, MENU-04, MENU-05 |
| M4 | Filtro de alérgenos | MENU-01 (§3), MENU-05 |
| M5, M6, D3 | Reservar: día y hora, tus datos | RES-01, RES-02 |
| M7 | Reserva confirmada | RES-02 |
| D4 | Email de confirmación | RES-03 |
| M8 | Turno completo y lista de espera | RES-01, RES-10 |
| M9 | Gestionar mi reserva | RES-06 |
| M10, D5 | Entrar al panel | PLT-02 |
| M11, D6 | Hoy | RES-08, MENU-04, WEB-06 |
| M12, D7 | Reservas del día y ficha | RES-08, RES-13 |
| M13 | Ficha de reserva | RES-08, RES-13 |
| M14, D8 | Nueva reserva por teléfono | RES-09 |
| M15, D9 | Sala | RES-15, RES-17 |
| D10 | Editor del plano | RES-16, RES-17 |
| M16 | Agotados en servicio | MENU-04 |
| D11 | Carta: editor y alérgenos | MENU-02, MENU-03, MENU-05 |
| D12 | Revisar la traducción con IA | MENU-07, AI-06 |
| D13 | Códigos QR | MENU-08 |
| D14 | ~~Editor de la web~~ → "Mi web" | WEB-15 (WEB-02 y 03 descartadas) |
| D15 | Mensajes de la web | WEB-06, FORM-07 (fase 2) |
| D16 | Clientes | RES-13, PLT-10 |
| D17 | Ajustes: reservas | RES-11 |
| D18 | Ajustes: plan y factura | PLT-06 |
| D19 | Ajustes: equipo | PLT-03 |
| M17, D20 | Superadmin: locales | PLT-09, AI-09 |
| D21 | Superadmin: ficha de un local | PLT-09, WEB-08, WEB-14, AI-09 |
| D22 | Superadmin: alta de un local | PLT-01 |

## 5. Diferencias conocidas entre vistas y specs

Las vistas se hicieron antes de algunas decisiones o van un paso por delante. Hasta que se actualicen, **manda la spec**:

- [ ] **WhatsApp (RES-18):** falta el botón "Reservar por WhatsApp" en M1, M5, D1 y D3, y "Copiar enlace de reserva" en D7.
- [ ] **Acceso del equipo (PLT-11):** falta el enlace en el pie de D1.
- [ ] **Borde de los campos:** las vistas usan `#C9D6CF` (Línea), que no llega al contraste 3:1 de WCAG para controles. En la plataforma, los campos llevan borde Gris `#4B6158` (22/11/2026).
- [ ] **Roles (D19):** la vista muestra Propietaria, Encargado y Personal; la spec solo tiene `OWNER` y `STAFF`. O se añade el rol en PLT o la vista pasa a dos papeles.
- [ ] **Grupos grandes (M5, D17):** la vista dice "envía una solicitud"; RES-01 dice "llámanos" con el teléfono (y WhatsApp si lo hay).
- [ ] **Cambiar la reserva (M9):** la vista ofrece cambiar día, hora y personas; RES-06 solo permite cancelar. En el MVP, cambiar = cancelar y reservar de nuevo, salvo que se amplíe la spec.
- [ ] **Webs de los locales (21/11/2026):** D1 y M1–M2 sirven como ejemplo de una web a medida, no como plantilla común. D14 (editor de bloques) se sustituye por "Mi web" (WEB-15): estado, visitas y "Pedir un cambio". D21 y D22 necesitan la ficha de la web (repositorio, dominio, Deploy Hook, "Datos cambiados" y "Recompilar web", WEB-14 y WEB-17).
- [ ] **Alta de un local (D22, 23/11/2026):** la vista es un asistente de 4 pasos con precio y dominio; PLT-01 es hoy un formulario de una página (nombre, slug, email del responsable, módulos y motivo de activarlos sin pago). El precio llega con el cobro (BILL-03) y el dominio con la ficha de la web (WEB-08, WEB-17).
- [ ] **Locales (D20, 23/11/2026):** la primera versión solo lista locales, módulos y la invitación pendiente con "Reenviar invitación". Faltan la búsqueda, los avisos, el pago, el dominio y la IA del mes (PLT-09, AI-09).
- [ ] **Panel (D6, M11, 25/11/2026):** el marco ya está (barra lateral, barra inferior y "Más"); las pantallas son de momento vacías. La barra lateral añade "Cambiar de local" bajo el local cuando hay varios, y "Salir" abajo.
- [ ] **Cookies (M2):** WEB-09 no muestra banner mientras no haya servicios con cookies. La vista sirve para cuando haga falta.
