# SpotterX Platform - Visión y Roadmap

> Documento vivo. Registra la visión del producto, la arquitectura y el roadmap para que cualquier sesión retome el trabajo sin perder contexto.

## Qué es SpotterX Platform
Una **superapp de fitness modular** y escalable. Cada funcionalidad es un **módulo** que se anexa a la plataforma y puede **generar monetización**. El objetivo final es un ecosistema tipo "MercadoLibre del fitness": un core + módulos/marketplaces que se suman con el tiempo.

El proyecto es un **experimento** para replantear la app de otra forma (más limpia y escalable). **NO toca ni modifica `fitpro`** (el proyecto avanzado de referencia, en `C:\Users\Loquindoli\Desktop\OPENCODE\fitpro`), del cual solo se toman patrones/conceptos.

## Stack
- Next.js (App Router) + TypeScript
- Tailwind CSS v4 (dark mode propio, paleta neón)
- Supabase (auth + DB + Storage + Realtime)
- lucide-react para iconos (cuando aplique)

## Identidad visual
- **Tema oscuro por defecto** (fondo `#05070a` / cards `#161b22`)
- **Cyan neón** `#00f2fe` (primario)
- **Naranja neón** `#ff5e36` (acento/energía/monetización)
- **Mobile-first** (app de celular, contenedor ~430px estilo SpotterX_spp), con versión web como extensión
- Texto en español
- Elementos distintivos del prototipo: post-cards con video, acciones flotantes Pulse⚡/Dialogue💬/Remix🔄, bottom nav flotante pill, drawer lateral, perfil con grid

## Arquitectura: "El registro define la vista"
El rol con el que se registra el usuario define qué módulo ve primero:

| Rol de registro | Módulo principal | Conectado con |
|---|---|---|
| **Gimnasio** | Control de Acceso (panel gym) | Red social + staff (profesores) |
| **Profesor** | Gestión de Alumnos | Red social + gyms donde trabaja |
| **Alumno** | Red Social | Gestión (contratar profe) |

- Los roles son **combinables/migrables** (ej. alumno → profesor independiente; profesor existente → staff de un gym, con su autorización).

## Estructura de carpetas
```
SpotterX_spp/
├── src/
│   ├── app/
│   │   ├── (auth)/          → login, registro por rol (gym / profesor / alumno)
│   │   ├── (social)/        → feed, discover, notifications, perfil, crear
│   │   ├── (training)/      → (Fase 3) gestión alumno/profesor
│   │   ├── (gyms)/          → (Fase 4) panel gym: gimnasio, miembros, planes, qr, accesos
│   │   └── (checkin)/       → (Fase 4) /checkin/[qrCode]: escaneo del QR público
│   ├── components/
│   │   ├── core/            → primitivas compartidas (Button, Avatar, Nav, Modal)
│   │   ├── social/          → PostCard, PulseButton, CommentsSheet, etc.
│   │   ├── training/        → (Fase 3)
│   │   └── gyms/            → (Fase 4)
│   ├── lib/                 → Supabase client, utils, hooks
│   └── modules/             → (futuro) config/registro por módulo
```

## Base de datos (Supabase)
Proyecto **NUEVO e independiente** (URL + anon key propias, en `.env.local`). No comparte datos con fitpro.

Tablas planificadas (schema en evolución):
- `users` (id, email, @username, full_name, role, avatar, bio) — role combinable
- Módulo social: `posts` (video/foto, caption, category), `post_pulses`, `post_comments`, `follows`, `notifications`
- Módulo gym: `gyms`, `gym_memberships` (plan + vigencia), `gym_access_logs` (entrada/salida, horas profe), `gym_payments` (cobro de cuota)
- Módulo training: planes, rutinas, chat, vinculación profe-alumno
- Monetización transversal: `subscriptions`, `credits`, `wallet`/`transactions` (preparar desde inicio para escalar sin re-migrar)

## Roadmap por fases

### ✅ Fase 1 — Fundación (prioridad al iniciar este documento)
1. Scaffolding Next.js + Tailwind + theme (dark, paleta neón)
2. Setup Supabase proyecto nuevo
3. Auth + roles combinables (gym / profesor / alumno); registro define la vista
4. Schema DB base + conceptos de monetización/gym preparados
5. Navegación base: bottom nav flotante (Home, Discover, ➕, Notif, Perfil) + drawer + auth guard

### Fase 2 — Red social (prioridad inicial)
6. Feed estilo SpotterX_spp: post-card con video/foto, acciones flotantes **Pulse⚡ / Dialogue💬 / Remix🔄**
7. Discover: búsqueda + categorías (#CrossFit, #Running, #Powerlifting...)
8. Notificaciones realtime (pulse, comment, follow)
9. Perfil público: avatar borde neón, stats (posts/followers/pulses), grid, seguir
10. Crear contenido (video/foto + caption + categoría → Storage)
11. Geoposicionamiento del profe en su perfil (hook para conectar con gyms en Fase 4)

### Fase 3 — Gestión de Alumnos (profesor)
12. División del profe: **Alumnos del gym** + **Alumnos propios**
13. Planes (entrenamiento/alimentación), rutinas, chat 1:1
14. Vincular gyms donde trabaja → geolocalización/contratación por zona
15. Monetización preparada (suscripción/comisión del profe a futuro)

### ✅ Fase 4 — Control de Acceso del Gimnasio
16. Panel gym (admin): gestiona gym, miembros, planes/membresías, aforo en tiempo real
17. **Growth loop**: el gym **CREA las cuentas** de alumnos (rol alumno) y profesores (rol profesor) en la app → miembros automáticos → más usuarios para la plataforma
18. El gym configura **planes/membresías** (mensual/trimestral/etc.) con precio + vigencia
19. **QR por gimnasio + membresía**:
    - **Alumno**: escanea QR del gym → muestra su info + si está **habilitado** (membresía vigente)
    - **Profesor**: escanea al entrar y al salir → **cuenta horas de trabajo**
20. Historial de accesos + estadísticas de asistencia

**Implementación Fase 4 (hecha):**
- `GymShell` + nav del gym (Panel / Miembros / Planes / QR / Accesos) en `src/components/gyms/`
- Panel `/gimnasio`: crear/editar gym, dirección, ciudad, capacidad, **geolocalización GPS** + mapa **Leaflet** (sin API key), QR generado con `qrcode.react`
- Miembros `/gimnasio/miembros`: **creación masiva** vía **Edge Function `invite-member`** (crea cuenta con contraseña provisional + rol + membresía/staff) + lista de miembros
- Planes `/gimnasio/planes`: CRUD de `gym_plans`
- Check-in `/checkin/[qrCode]`: ruta pública, QR codifica URL `https://spotterx-five.vercel.app/checkin/<CODIGO>`, registra ingreso/egreso (alumno) y entrada/salida (profe, horas); si no está logueado redirige a `/login?next=...`
- Accesos `/gimnasio/accesos`: aforo en vivo (vista `gym_presence`), asistencia del día (función `gym_attendance_today`), historial
- Migración `supabase/migrations/00003_gyms.sql` (corrida)
- Dependencias nuevas: `qrcode.react`, `leaflet`, `react-leaflet`, `@types/leaflet`

### Fase 5 — Cobro de Cuota del gym (panel gym)
- Cobro de membresías/cuotas de los alumnos (manual primero, pasarela MercadoPago/Stripe después)
- Monetización directa del gym

**Implementación Fase 5 + pulido de planes (hecho):**
- **Planes** (`/gimnasio/planes`): duración por **meses** (1/2/3/6/12), precio libre, **promos de captación** (`promo_type` 2x1/3x2/4x3), **editar/borrar**. Migración 00004.
- **Alta de miembro** (`/gimnasio/miembros`): elegir **plan**, con promo se crean N cuentas (1º `pagado`, extras `promo` gratis el 1º mes). Edge function `invite-member` extendida: acepta `plan_name`, `pay_status`, `expires_on`.
- **Cobros** (`/gimnasio/cobros`): lista de miembros activos con estado (Pagó/Promo/Pendiente), botón **"Marcar pagó"** (inserta en `gym_payments` con método manual, cambia `pay_status` a `pagado`, **extiende `expires_on`** sumando los meses del plan). Historial de pagos.
- **Check-in** (`/checkin/[qrCode]`): habilita solo si `pay_status` es `pagado` o `promo` y no venció; bloquea vencidos/pendientes. Badge "Promo 🎁 (primer mes)".
- Nav del gym: agregado tab **Cobros**.
- **Pendiente/futuro**: pasarela MercadoPago/Stripe por gym (se dejó `gym_payments.method` preparado con `manual`/`mercadopago`/`stripe`).

### Pulido alumnos + kiosk gym (hecho)
- **`/mi-gimnasio`** (alumno, sección propia separada de la barra social; acceso desde Perfil solo rol alumno): card "pasaporte" con gym + dirección + plan + **precio** + vencimiento + estado de cuota (✅ al día / 🎁 promo / ⏳ debe / 🔴 vencida). Botón **"Dar el presente"** abre la cámara con `@yudiel/react-qr-scanner` (dependencia `@yudiel/react-qr-scanner`) para escanear el QR (pantalla/cartel) → redirige a `/checkin/<qr>` con la sesión ya iniciada (sin re-login).
- **Kiosk `/gimnasio/pantalla`** (overlay full-screen para monitor, acceso desde pestaña QR con "Abrir en pantalla"): QR gigante + **realtime** en `gym_access_logs` (`postgres_changes`, publicación `supabase_realtime` agregó `gym_access_logs` y `notifications`) → al escanear un alumno muestra **ficha ~8s** con foto de perfil del feed (`profiles.avatar_url`, o iniciales neón) + hora, y lista "Ingresos de hoy".
- **Aviso al gym**: trigger `notify_gym_checkin` (migración 00005) inserta notificación `type='checkin'` (columna `gym_id` nueva + tipo habilitado) al dueño por cada ingreso. **Campanita** en el header del GymShell con contador de no leídas + desplegable "Quién entró".
- **Precio guardado en membresía**: migración 00005 agrega `gym_memberships.price`; se setea al alta (`invite-member` recibe `price`) y al "Marcar pagó" (Cobros registra el monto real y lo persiste). El alumno siempre ve la cifra aunque el plan se borre/edite.

### Fase 6 — Marketplace Fit
- Venta de productos de fitness, tipo **MercadoLibre** → comisiones

### Futuro / Otras monetizaciones
- Boosts/verificación (patrón ya probado en fitpro), contenido pago, suscripciones premium
- Gym como SaaS (freemium por cantidad de usuarios)
- Conexión/integración con otras apps (login compartido / API / deep links)

## Deploy / Producción
- **Vercel**: proyecto `pump13/spotterx` → producción `https://spotterx-five.vercel.app` (deploy `https://spotterx-aejk06equ-pump13.vercel.app`). Env vars de Supabase configuradas en production/preview/development. Redploy: `vercel --prod --yes` (requiere login o `VERCEL_TOKEN`).
- **Supabase** (proyecto `dzalgziofiwcljgnphap`): URL `https://dzalgziofiwcljgnphap.supabase.co`. `.env.local` usa la **anon key clásica** (la publishable no lista Storage). Edge function deployada: `invite-member`.
- **Edge Function `invite-member`**: crea cuentas (rol alumno/profesor) con la **service role key** guardada como **secreto** `SPOTTERX_SERVICE_ROLE` en Supabase (nunca en frontend). Deploy/secretos con `supabase functions deploy invite-member` y `supabase secrets set` (CLI + access token `sbp_...`). **ATENCIÓN**: la service role key se expuso en el chat → regenerarla luego del deploy si se quiere máxima seguridad. Para crear `auth.users` desde la app solo se puede vía esta edge function (el frontend usa anon key).
- **Migraciones**: no se pueden ejecutar desde la app; el usuario las corre manualmente en **SQL Editor** de Supabase. Sessions previas muestran completadas 00001, 00002, 00003.

## Reglas / recordatorios
- NO tocar `fitpro`. Este proyecto es independiente.
- Texto en español. Identidad visual neón/dark.
- Preferir `[IO.File]` sobre `Get-Content/Set-Content` de PowerShell al manejar UTF-8 (corrompen acentos).
- Realtime de Supabase para notificaciones en vivo.
- Las Edge Functions (carpeta `supabase/functions/`) corren en **Deno**, no Node: están **excluidas del tsconfig** de Next (`exclude: ["node_modules", "supabase/functions"]`) para que el build no las type-checkee.

## Estado de fases
- ✅ Fase 1 — Fundación (Next + Supabase + auth roles + theme + route groups + schema 00001)
- ✅ Fase 2 — Red social (feed real, crear contenido via Storage, discover, perfiles, notificaciones realtime)
- ✅ Fase 3 — Gestión de alumnos del profe (+ schema 00002_training)
- ✅ Fase 4 — Control de Acceso del gym (panel, memberships, QR check-in, accesos/aforo, edge function invite-member, schema 00003, mapa Leaflet)
- ✅ Fase 5 — Cobro de Cuota manual (+ pulido de planes con promos, schema 00004)
- ✅ Pulido alumnos + kiosk gym: `/mi-gimnasio` + escáner + kiosk realtime + campanita de ingresos (schema 00005, `@yudiel/react-qr-scanner`)
- ⏸️ Fase 6 — Marketplace Fit
- 🔜 Empaquetar como app móvil (Play Store / App Store via Capacitor) al final del roadmap
