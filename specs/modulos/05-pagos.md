# 05 · Pagos y suscripciones (Stripe)

**Estado:** Borrador v0.2 (19/11/2026: alta del pack con primer mes y oferta del piloto) · **Fase:** F0 (modo prueba) → modo real antes del piloto · **Depende de:** `00-plataforma.md` · **Owner:** Manuel

Desarrolla el contexto `billing` de `00-plataforma.md` (§4 y §6, PLT-06 y PLT-07). Si algo de aquí contradice a la plataforma, manda esta spec y se corrige la otra en el mismo PR.

## 1. Objetivo

Cobrar a cada local sus cuotas mensuales y el primer pago del alta, sin tocar datos de tarjeta, con facturas válidas en España, y que el estado del pago encienda o apague los módulos solo. Manuel no debería tener que cobrar a mano ni perseguir recibos.

## 2. Alcance MVP

**Incluye:** catálogo de productos y precios en Stripe, datos fiscales del cliente, alta con primer pago (cuota + alta) por Stripe Checkout, tarjeta y adeudo SEPA, IVA del 21 %, pack automático cuando hay tres módulos, añadir y quitar módulos, portal de cliente de Stripe, impagos con periodo de gracia, facturas en el panel, cupones del piloto y cortesías del superadmin, webhooks idempotentes.

**Fuera de alcance MVP:** precio anual, pagos fuera de la zona euro, clientes de Canarias, Ceuta y Melilla (sin IVA peninsular) y de fuera de España, cobrar a los comensales (señales de reserva, pagos en mesa), facturación propia sin Stripe, Bizum, informes contables más allá de exportar facturas.

## 3. Precios y catálogo

Fuente de verdad comercial: `../01-contexto.md` §4. La web comercial (`zoenlab-web/src/config/site.ts`) debe decir lo mismo.

| Concepto | Tipo | Importe sin IVA | Con IVA (21 %) | `lookup_key` |
|---|---|---|---|---|
| Carta digital con QR | Mensual | 24,00 € | 29,04 € | `menu_monthly` |
| Reservas | Mensual | 44,00 € | 53,24 € | `reservations_monthly` |
| Web + mantenimiento | Mensual | 39,00 € | 47,19 € | `site_monthly` |
| Pack completo (activa los tres) | Mensual | 79,00 € | 95,59 € | `pack_monthly` |
| Alta de la web suelta | Pago único | 412,40 € | **499,00 €** | `site_setup` |
| **Alta del pack completo** (incluye el primer mes) | Pago único | 412,40 € | **499,00 €** | `pack_setup` |
| **Alta del piloto** (pack completo, incluye el primer mes) | Pago único | 206,61 € | **250,00 €** | `pilot_setup` |

- **El alta del pack incluye la primera cuota** (decidido el 19/11/2026). Por eso la suscripción del pack empieza con 30 días sin cuota (`trial_period_days: 30`) y la primera cuota de 95,59 € se cobra el segundo mes. El alta del piloto funciona igual con 250 € IVA incluido: 206,61 € + 43,39 € de IVA = 250,00 €.
- **El alta del pack se anuncia como "499 € IVA incluido".** En Stripe se crea como 412,40 € sin IVA (41240 céntimos) para que todas las líneas de la factura lleven el mismo tipo de IVA exclusivo: 412,40 € + 86,60 € de IVA = 499,00 €. Un test comprueba ese total.
- **El código no guarda IDs de precio.** Busca los precios por `lookup_key` y los cachea. Así los mismos nombres sirven en modo prueba y en modo real.
- **Alta de la web suelta: 499 € IVA incluido, importe fijo** (19/11/2026). No hay presupuestos a medida ni importes propios: el superadmin elige el precio `site_setup` y nada más. A diferencia del pack, no incluye la primera cuota de la web.
- Cambiar un precio = precio nuevo en Stripe con la misma `lookup_key` (`transfer_lookup_key`), nunca editar uno existente. Las suscripciones vivas mantienen su precio hasta que se migren a propósito.

## 4. Decisiones de diseño

| Tema | Decisión | Motivo |
|---|---|---|
| Dónde se paga | **Stripe Checkout** (página de Stripe) para el alta y para añadir módulos; **portal de cliente** para tarjeta, facturas y baja | La plataforma nunca ve datos de pago (PCI SAQ A). Menos código y menos riesgo |
| Una suscripción por local | Cada tenant tiene como mucho una suscripción viva, con un *item* por módulo o un único *item* de pack | Una sola factura al mes; altas y bajas son cambios de *items* |
| Primer pago | Checkout en modo `subscription` con los precios mensuales y el precio de alta como línea de pago único. Stripe lo cobra solo en la primera factura | Un pago, una factura, sin pasos a mano |
| Métodos de pago | Tarjeta y adeudo SEPA (domiciliación) | La domiciliación es lo habitual para recibos recurrentes de empresa en España |
| IVA | Tipos de impuesto manuales de Stripe: `IVA 21 %` exclusivo, `jurisdiction: ES`. Sin Stripe Tax en el MVP | Todos los clientes son empresas o autónomos de la península. Revisar si se vende fuera |
| Facturas | Las genera Stripe Billing en cada cobro, con numeración correlativa de la cuenta, datos fiscales de Manuel y NIF del cliente | Ver §8: hace falta un sistema Veri\*factu antes del 1/7/2027 |
| Bajas | Siempre al final del periodo pagado. Sin permanencia y sin devolución del mes en curso | Es lo que promete la web comercial |
| Altas a mitad de mes | Se prorratean y se cobran en la siguiente factura | El cliente no recibe dos cargos el mismo mes |
| Activación | Solo por webhook. Volver de Checkout no activa nada | `success_url` se puede abrir sin haber pagado |

## 5. Estados y efectos

Amplía la tabla de `00-plataforma.md` §6:

| Evento o estado de Stripe | Suscripción local | Módulos (`TenantModule`) | Aviso |
|---|---|---|---|
| `checkout.session.completed` (tarjeta pagada o SEPA en proceso) | `active` o `trialing` | `ACTIVE` | Email de bienvenida al OWNER |
| `checkout.session.async_payment_failed` (SEPA rechazado) | `incomplete` / `past_due` | `PAST_DUE` | Email al OWNER y aviso al superadmin |
| `invoice.paid` | `active` | `ACTIVE` | Factura disponible en el panel |
| `invoice.payment_failed` | `past_due` | `PAST_DUE` (funciona) | Banner en el panel + email al OWNER |
| `past_due` más de 14 días o `unpaid` | `unpaid` | `SUSPENDED` | Público: 503 del módulo; panel en solo lectura |
| `customer.subscription.deleted` | `canceled` | `CANCELED` | Datos 90 días (PLT-10) |
| `customer.subscription.updated` con `cancel_at_period_end` | igual | igual hasta el fin del periodo | "Tu plan termina el …" en el panel |

Reintentos de cobro: los de Stripe (Smart Retries) durante 14 días. Al agotarse, la suscripción pasa a `unpaid`, **no** se cancela, para no perder la relación si el cliente paga tarde.

## 6. Modelo de datos

Amplía `Subscription` de `00-plataforma.md` §7. Los datos fiscales viven en Stripe (`Customer`); aquí solo lo necesario para pintar el panel sin llamar a Stripe.

```prisma
model Subscription {
  id                   String  @id @default(cuid())
  tenantId             String  @unique              // una suscripción viva por tenant
  stripeSubscriptionId String  @unique
  stripeStatus         String                       // active | trialing | past_due | unpaid | canceled | incomplete
  plan                 BillingPlan                  // PACK | MODULES
  currentPeriodEnd     DateTime
  cancelAtPeriodEnd    Boolean @default(false)
  trialEnd             DateTime?
  pastDueSince         DateTime?                    // para pasar a SUSPENDED a los 14 días
  items                Json                         // [{ lookupKey, stripeItemId, module? }]
  updatedAt            DateTime @updatedAt
}

model BillingInvoice {                             // espejo para la lista del panel (D18)
  id              String   @id @default(cuid())
  tenantId        String
  stripeInvoiceId String   @unique
  number          String?                          // número legal de la factura
  status          String                           // draft | open | paid | uncollectible | void
  totalCents      Int
  taxCents        Int
  hostedUrl       String?
  pdfUrl          String?
  issuedAt        DateTime
  @@index([tenantId, issuedAt])
}

model PendingModuleChange {                        // bajas programadas al final del periodo
  id        String   @id @default(cuid())
  tenantId  String
  module    ModuleKey
  action    String                                 // "remove"
  effectiveAt DateTime
  appliedAt DateTime?
  @@index([tenantId])
  @@index([effectiveAt, appliedAt])
}
```

`Tenant.stripeCustomerId` ya existe. Ningún importe en `Float` (`CLAUDE.md` §6.7).

## 7. Historias de usuario

### BILL-01 · Catálogo en Stripe
Como Manuel quiero crear los productos y precios con un comando para tener el mismo catálogo en prueba y en real.
- Script idempotente `pnpm stripe:seed` que crea o actualiza productos y precios de §3 por `lookup_key` y el tipo de impuesto `IVA 21 %`.
- Ejecutarlo dos veces no duplica nada.
- Nunca se ejecuta contra la cuenta real sin `--live` explícito.

### BILL-02 · Datos fiscales del cliente
- En el alta se crea el `Customer` de Stripe con razón social, NIF/CIF, dirección fiscal y email de facturación. Checkout pide los que falten (`tax_id_collection`, dirección de facturación obligatoria).
- El NIF es obligatorio: sin NIF no se puede emitir factura completa. Validación de formato español antes de enviar.
- El OWNER puede cambiar sus datos fiscales desde el portal de Stripe; el webhook `customer.updated` refresca lo que muestra el panel. Una factura ya emitida no cambia.

### BILL-03 · Primer pago en el alta (superadmin → OWNER)
Como Manuel quiero que, al dar de alta un local, su dueño pague cuota y alta en un solo paso.
- En PLT-01, el superadmin elige módulos (o pack) y el alta: `pack_setup`, `pilot_setup` (locales del piloto), `site_setup` (499 € IVA incluido), o ninguna (solo carta o reservas no tienen alta).
- Se genera una sesión de Checkout en modo `subscription` con los precios mensuales + el precio de alta como línea de pago único, IVA 21 %, tarjeta y SEPA, en español (`locale: es`).
- El enlace de pago va en el email de invitación y se ve en el panel ("Completa el pago para activar tu plan") hasta que se paga. Caduca a las 24 h; el superadmin o el OWNER generan otro.
- Con `pack_setup` o `pilot_setup`, la sesión lleva `subscription_data.trial_period_days: 30`: el alta cubre el primer mes. En la factura, el concepto del alta dice "Alta del pack completo (incluye el primer mes)".
- Ejemplo pack: primera factura = 412,40 € + 86,60 € de IVA = **499,00 €**. Desde el segundo mes, 95,59 € al mes.
- Ejemplo piloto: primera factura = 206,61 € + 43,39 € de IVA = **250,00 €**. Del segundo al duodécimo mes, 86,03 € con el 10 % del piloto (71,10 € + 14,93 € de IVA); desde el mes 13, 95,59 € (BILL-11).
- Los módulos se activan al llegar `checkout.session.completed`. La pantalla de vuelta muestra "Activando…" y se actualiza sola.

### BILL-04 · Añadir un módulo desde el panel
- El OWNER ve los módulos que no tiene, con su precio, y pulsa "Añadir". Con suscripción viva, se añade el *item* (prorrateado en la próxima factura) tras confirmar el importe; sin suscripción, va a Checkout como en BILL-03.
- Si con el nuevo módulo tiene los tres, el plan pasa a pack en la misma operación (BILL-05).
- Solo `OWNER`. `STAFF` no ve precios.

### BILL-05 · Pack automático
- Tres módulos activos = un único *item* `pack_monthly`. Nunca se cobran los tres sueltos a la vez.
- Al quitar un módulo del pack, a final de periodo el pack se sustituye por los dos módulos que quedan, a precio suelto. El panel lo explica antes de confirmar ("Pasarás a pagar 68 € al mes + IVA desde el …").
- El alta del pack no se devuelve ni se vuelve a cobrar si después se vuelve al pack.

### BILL-06 · Dar de baja un módulo o todo
- Quitar un módulo crea un `PendingModuleChange` con fecha de fin de periodo; un cron diario aplica los vencidos (quitar el *item* en Stripe sin prorrateo) y el módulo pasa a `CANCELED`.
- Darse de baja de todo = `cancel_at_period_end` (desde el panel o el portal).
- Hasta la fecha, todo funciona. El panel muestra la fecha y permite deshacer la baja.

### BILL-07 · Portal de cliente
- Botón "Gestionar pago y facturas" en Ajustes → Plan y factura (D18) que abre el portal de Stripe con una sesión de un solo uso.
- Configuración del portal: cambiar método de pago, ver y descargar facturas, editar datos fiscales y cancelar al final del periodo. **Desactivado** cambiar de plan en el portal: los cambios de módulos se hacen en el panel (BILL-04 a BILL-06) por la lógica del pack.

### BILL-08 · Webhooks
Sustituye el detalle de PLT-07.
- Route handler `POST /api/webhooks/stripe` (runtime Node), lee el cuerpo en crudo y verifica la firma con `STRIPE_WEBHOOK_SECRET`. Firma inválida → 400 y Sentry.
- Eventos: `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, `customer.subscription.created|updated|deleted`, `invoice.finalized`, `invoice.paid`, `invoice.payment_failed`, `customer.updated`.
- Idempotencia: el `event.id` se guarda en `ProcessedWebhook` en la misma transacción que los cambios; un evento repetido responde 200 sin efectos.
- No se fía del orden de llegada: ante cualquier evento de suscripción, se lee la suscripción actual de Stripe (fuera de la transacción) y se aplica su estado completo.
- Los emails que provoca un evento se escriben en el outbox (PLT-08), nunca se envían desde el webhook.
- Responde en menos de 5 s; si algo falla, 500 para que Stripe reintente.

### BILL-09 · Impagos y periodo de gracia
- `invoice.payment_failed` → `PAST_DUE`, `pastDueSince` = ahora, banner en el panel con botón para pagar (factura alojada de Stripe) y email al OWNER.
- Cron diario: `PAST_DUE` con `pastDueSince` de más de 14 días → `SUSPENDED` y aviso al superadmin.
- Al pagar (`invoice.paid`), todo vuelve a `ACTIVE` y se limpia `pastDueSince`.
- Un override del superadmin (`overrideReason`) prevalece sobre el estado de pago.

### BILL-10 · Facturas en el panel
- Ajustes → Plan y factura (D18): plan, cuota con y sin IVA, próximo cobro, método de pago (los 4 últimos dígitos o "Domiciliación") y lista de facturas con número, fecha, total y descarga en PDF.
- La lista sale de `BillingInvoice` (rellenada por `invoice.finalized` e `invoice.paid`); el PDF es el de Stripe.
- La factura incluye: número correlativo, fecha, datos fiscales de Manuel (titular, NIF, domicilio), razón social, NIF y domicilio del cliente, concepto por módulo y periodo, base, tipo y cuota de IVA y total.

### BILL-11 · Piloto, cupones y cortesías
- El superadmin aplica a un tenant un cupón del catálogo (`pilot_*`) al generar el Checkout o sobre una suscripción viva. Queda en `AuditLog`.
- Oferta del piloto (decidida el 19/11/2026): pack completo con alta `pilot_setup` de 250 € IVA incluido, que cubre el primer mes (BILL-03). Desde el segundo mes, la cuota normal del pack.
- Descuento del piloto (decidido el 19/11/2026): **10 % en la cuota durante el primer año** desde el alta. Cupón `pilot_10`: `percent_off: 10`, `duration: repeating`, `duration_in_months: 12`, `applies_to` solo el producto de la cuota del pack (nunca el alta). Se aplica en la sesión de Checkout del alta con `pilot_setup`. No se publica en la web: se ofrece en persona.
- Cortesía sin cobro: override del superadmin con motivo (PLT-09), sin suscripción en Stripe.

### BILL-12 · Cobros en el superadmin
- En la lista de locales (D20/M17), columna "Pago" con el estado y, arriba, "Necesita tu atención" con los impagos y SEPA rechazados.
- En la ficha del local (D21): plan, cuota actual, cupón y fecha de fin, último pago, enlace a la ficha del cliente en el dashboard de Stripe.
- Total mensual recurrente (suma de cuotas sin IVA de suscripciones `active`), solo informativo.

### BILL-13 · Veri\*factu
- Antes del **1 de julio de 2027** (fecha para autónomos; 1 de enero de 2027 si factura una sociedad), cada factura debe salir de un sistema de facturación adaptado a Veri\*factu. Stripe Invoicing no lo es por sí solo.
- Opciones a decidir (§10): una app de Stripe que registre las facturas en Veri\*factu, o pasar las facturas al programa de facturación del gestor por API y que Stripe solo cobre.
- Hasta decidirlo, nada en el código debe dar por hecho que el PDF de Stripe es la factura definitiva: el panel enlaza "la factura" y se podrá cambiar de origen sin migrar datos.

## 8. Requisitos fiscales y legales (resumen)

- **IVA:** 21 % en todas las cuotas y altas para clientes de la península y Baleares.
- **Factura completa** a empresas y autónomos con los datos de BILL-10. Numeración correlativa sin saltos: una sola serie en Stripe para toda la cuenta.
- **Veri\*factu:** obligatorio el 1/1/2027 para sociedades y el 1/7/2027 para autónomos (Real Decreto-ley 15/2025). Ver BILL-13.
- **Retención de IRPF:** depende de cómo esté dado de alta Manuel (actividad empresarial o profesional). Si hubiera que practicarla, Stripe no la resuelve bien: cerrar con el gestor antes del modo real (§10).
- **Condiciones del servicio:** el Checkout enlaza las condiciones y la privacidad de la plataforma (pendientes de abogado, `00-necesidades.md` §6) y pide aceptarlas (`consent_collection.terms_of_service`).

## 9. Requisitos no funcionales y tests clave

| Área | Requisito |
|---|---|
| Seguridad | Ningún dato de tarjeta o IBAN pasa por la plataforma. Claves solo en el servidor. Webhook con firma verificada |
| Entornos | Desarrollo y previews en modo prueba con la CLI de Stripe reenviando webhooks; producción en modo real. Nunca claves reales fuera de producción |
| Robustez | Llamadas a Stripe con `idempotencyKey` en las que crean objetos; nunca dentro de una transacción de BD (`CLAUDE.md` §11) |
| Dinero | Céntimos (`Int`), `EUR`; los totales con IVA los calcula Stripe y se guardan tal cual |
| Observabilidad | Sentry con `tenantId` en errores de webhook y de Checkout; alerta al superadmin si un webhook falla 3 veces seguidas |

Tests que nombran su ID:
- BILL-01: el seed dos veces deja el mismo catálogo.
- BILL-03: la primera factura del pack suma 499,00 € y la del piloto 250,00 €; la segunda, 95,59 € en el pack y 86,03 € en el piloto; la del mes 13 del piloto, 95,59 €. La de la web suelta: 499,00 € + 47,19 € = 546,19 €.
- BILL-05: añadir el tercer módulo deja un único *item* `pack_monthly`; quitar uno programa dos *items* sueltos.
- BILL-08: firma inválida → 400; mismo `event.id` dos veces → un solo cambio; eventos desordenados → estado final correcto.
- BILL-09: 15 días en `PAST_DUE` → `SUSPENDED`; un pago lo devuelve a `ACTIVE`.
- Aislamiento: el OWNER del tenant B no ve facturas ni plan del tenant A.

## 10. Preguntas abiertas

- [x] **Oferta del piloto** (19/11/2026): 250 € IVA incluido el primer mes con el pack completo; después, la cuota normal del pack.
- [x] **El alta del pack (499 € IVA incluido) incluye la primera cuota** (19/11/2026).
- [x] **Descuento del piloto** (19/11/2026): 10 % en la cuota durante el primer año.
- [x] **Alta de la web suelta** (19/11/2026): 499 € IVA incluido, importe fijo.
- [ ] **¿El alta de la web suelta incluye también el primer mes**, como la del pack? Esta spec asume que no.
- [ ] **Precios con y sin IVA en la web comercial:** todo se anuncia sin IVA salvo el alta del pack. ¿Mantenerlo así o pasar todo a "IVA incluido" (lo habitual al hablar con dueños de bares)?
- [ ] **Métodos de pago:** ¿tarjeta y SEPA, o solo SEPA para las cuotas?
- [ ] **Retención de IRPF** según el epígrafe de Manuel. Consultar al gestor.
- [ ] **Veri\*factu:** app de Stripe o programa del gestor (BILL-13). Decidir antes de marzo de 2027.
- [ ] **Precio anual** (ya pendiente en `00-plataforma.md` §10).
