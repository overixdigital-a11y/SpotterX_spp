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

## 🗺️ Plan maestro "SpotterX vibrante" (aprobado 11/09/2026)

Orden de etapas para pulir/completar la app, módulo por módulo. Cada etapa termina en: **migración nueva (correr en SQL Editor juntos) + build/lint + commit + deploy a producción + actualizar AGENTS.md**.

### 🟦 Etapa 1 — Red social bien hecha (feed)
- Migración **00009**: publicar `posts`, `post_pulses`, `post_comments`, `follows` en `supabase_realtime`; RLS faltantes (`notifications` UPDATE para marcar leídas, `posts`/`post_comments` UPDATE+DELETE del dueño, **storage policies**); índices de conteos/feed; columna `parent_id` en `post_comments` (respuestas anidadas).
- Primitivas core (no existen): `Avatar` (usa `avatar_url` con fallback), `Button`, `Modal`/`BottomSheet`, `Skeleton`, `EmptyState`, `Toast`; `src/lib/format.ts` compartido (`timeAgo`, `formatNumber`, fechas `es-AR`).
- Fix bugs visibles: contadores de pulses/comentarios muestran 0 (feed lee `data.length` con `head:true`); avatares con iniciales pese a `avatar_url` (perfil público y PostCard); timestamps ausentes.
- **PostCard completa**: avatar clicable → perfil, nombre + @ + timeAgo + badge de categoría, media 4:5; acciones reales: **Pulse** (estado precargado + animación + rollback en error), **Comentarios** (BottomSheet: lista + realtime + respuestas anidadas + eliminar), **Compartir** (Web Share / copiar link), **Guardar** (favoritos), menú **⋮** (editar/borrar propio, reportar).
- **Feed**: tabs "Para vos" / "Siguiendo" / por categoría, paginación por cursor + "Cargar más", skeletons y empty states.
- Página detalle `/posts/[id]` (deep link desde notis/guardados).
- Notificaciones: marcar leídas + badge de no leídas, links al post, unión con `type='checkin'` (hoy rompería a un dueño), agrupación por actor.
- Crear: preview del archivo, barra de progreso, conectar o quitar botones muertos Reels/Texto.
- Discover: chips que filtran **posts** por categoría (hoy buscan usuarios), búsqueda de posts + usuarios, "A quién seguir".
- Decisión: interacciones completas, **sin** Remix real (compartir = link/Web Share).

### ✅ Etapa 1 — Implementado y deployado (11/09/2026); FALTA correr migración 00009
- Migración **`00009_social_polish.sql`** (NUEVA, **pendiente de correr por el usuario en SQL Editor**): realtime en `posts`/`post_pulses`/`post_comments`/`follows`, RLS faltantes (`notifications` UPDATE/DELETE, `posts`/`post_comments` UPDATE+DELETE del dueño), columna `parent_id` en `post_comments` (respuestas anidadas), tablas `post_saves` + `post_reports` con RLS, storage policies del bucket `media`, índices. La app degrada con gracia: si `post_saves`/`post_reports` no existen, las queries devuelven `data: null` y no crashean.
- Primitivas core nuevas: `Avatar` (imagen con fallback de iniciales), `Button`, `Skeleton`, `EmptyState`, `BottomSheet`, `ToastProvider`/`useToast` (wrap en `src/app/layout.tsx`), `BottomNav` con **badge de notificaciones no leídas** (realtime).
- `src/lib/format.ts`: `timeAgo`, `formatNumber`, `formatDateTime` (es-AR), `parseMentions`. `src/lib/posts.ts`: `hydratePosts` compartido (Feed + detalle) para pulsos/saves/comments con joins hechos en cliente.
- **PostCard completa**: avatar clicable → perfil, nombre + @ + timeAgo + categoria, media 4:5; Pulse (optimista + rollback), comentarios en BottomSheet (lista + respuestas + realtime + borrar + sync de contador), compartir (Web Share / copiar link), Guardar (favoritos), menú ⋮ (editar/borrar propio, reportar). Caption editable con **estado local** (no muta la prop, regla `react-hooks/immutability`).
- **Feed**: tabs Para vos/Siguiendo, chips de categoría, paginación por cursor + "Cargar más", skeletons/empty states, realtime de posts nuevos.
- Página `/posts/[id]` (deep link): PostCard + CommentsList inline + back.
- Notificaciones: auto-marcado de leídas al abrir, "Marcar todas como leídas", badge en la nav (INSERT realtime), links al post/gym, `type='checkin'` soportado.
- Crear: **preview** del archivo (objectURL, revocada), publicar con/sin archivo, sin botones muertos Reels/Texto.
- Discover: chips que **filtran posts** por categoría (PostCard enlaza `?cat=`), búsqueda de posts + personas (debounce 250ms), "A quién seguir" con seguir inline.
- Nota lint (`react-hooks/set-state-in-effect`): envolver los setState iniciales de efectos en `setTimeout(..., 0)` o callback async; no llamar setState sync en el cuerpo del efecto.
- Commit `9ab06fa`, deployado a **https://spotterx-five.vercel.app** (26s). Para completar la Etapa 1: correr `00009_social_polish.sql`.

### ✅ Etapa 2 — Perfil de usuario completo (implementado y deployado 11/09/2026); PENDIENTES usuario: migración 00010 + deploy delete-account
- Migración **`00010_profiles_extend.sql`** (NUEVA, **pendiente de correr**): columnas `birth_date`, `phone`, `website`, `social_links jsonb`, `is_verified`, `privacy`, `settings jsonb`, `updated_at` (+ trigger `touch_profile`); trigger `notify_message` (notif `type='message'` al recibir chat); índices de followers/chat. La página de editar degrada con gracia si no se corrió (guarda campos base + avisa con toast).
- **Stats reales**: `src/lib/stats.ts` (`getProfileStats` → posts/followers/following/pulses recibidos con `count: exact, head: true`), fuera el hardcode "12/1.2k/890".
- **`/perfil` (propio)**: `Avatar` con foto, badge verificado, chip de rol, bio con @menciones, ubicación + website, cards "Mi gimnasio"/"Mi zona", **grid real** de posts con conteos por tile y **lightbox** (`ProfileGrid` → BottomSheet con PostCard), seguidores/siguiendo abren lista (FollowList con seguir/des-seguir), link a Configuración.
- **`/perfil/[username]` (público)**: avatar con foto, badge verificado, bio con menciones, stats reales, botón **Seguir** (optimista + toast) y **Mensaje** (→ `/chat/[id]`), seguidores/siguiendo (FollowList), grid + lightbox. **Profesor**: sección "Gimnasios donde trabaja" (gym_staff `authorized` + trainer_gyms) con mapa Leaflet si hay coordenadas.
- **`/perfil/editar` (extendido)**: avatar, nombre, **username** (`@`, normalizado, validación de unicidad), email (read-only), **teléfono**, **nacimiento** (date), **website**, ubicación, bio.
- **`/perfil/ajustes` (Configuración, nueva)**: cambiar email, cambiar contraseña, **preferencias de notificación** (toggles en `profiles.settings`), cerrar sesión, **borrar cuenta** (edge function `delete-account`).
- **Chat 1:1** `/chat/[id]`: lista + envío + realtime (INSERT filtrado por sender) + auto-scroll; notificación `message` vía trigger 00010.
- **Edge function `delete-account`** (`supabase/functions/delete-account/index.ts`): valida token, `auth.admin.deleteUser(id)` con service role. ✅ **DEPLOYADA** 10/09/2026 (`supabase functions deploy delete-account`).
- Tipado: los embeds de PostgREST 1:1 (`gym:gyms`, `follower:profiles!follows_*_fkey`) se tipan como array → castear con `as unknown as { kol: Type | null }[]`.
- Commit `cce27e2`, deployado a **https://spotterx-five.vercel.app** (27s). Para completar la Etapa 2: correr `00010_profiles_extend.sql` y deployar la edge function `delete-account`.

### ✅ Etapa 3 — Gimnasio completo (implementado y deployado 12/09/2026, migración 00011 CORRIDA)
- Migración **`00011_gym_reminders.sql`** **CORRIDA** (12/09/2026): habilita tipo `vencimiento` en `notifications`, función `notify_upcoming_expiry()` (aviso 3 días antes del vencimiento de membresías activas y al día) y job **pg_cron** diario a las 09:00 (job id devuelto por `cron.schedule`).
- **Cuenta de feed del gym** (decisión: el perfil del dueño ES el gym): pestaña **"Feed"** en el GymNav (`/perfil/<username del dueño>`, icono Sparkles), card **"Este gimnasio usa SpotterX"** en el perfil público de usuarios `role='gym'` (nombre + dirección/ciudad + mapa Leaflet, desde `gyms` por `owner_id`), botón **"Publicar en el feed"** (`/crear`) en el panel, y card **"Panel del gimnasio"** en el **perfil propio** `/perfil` (solo visible para el dueño, no en el perfil público) para volver a `/gimnasio` desde la zona social. ⚠️ La condición NO usa `profile.role` (un dueño puede tener otro rol): se detecta consultando si el usuario **posee un gym** (`gyms` por `owner_id`).
- **Panel resumen** (`/gimnasio`): cards de **Miembros activos**, **Ahora dentro** (presence/capacidad), **Deudores** (pendientes/vencidos) e **Ingresos del mes** (suma de `gym_payments`).
- **Staff con horas** (`/gimnasio`): sección Staff que lista profesores (consulta separada a `profiles`, lección del embed), con rol, estado de autorización y **horas trabajadas hoy** calculadas emparejando `ingreso`/`egreso` de `gym_access_logs` (sesión abierta = hasta ahora).
- **Cobros avanzados** (`/gimnasio/cobros`): totales (ingresos del mes + total deuda), sección **Deudores** (monto por miembro, "Marcar pagó" con **prompt de monto + nota**), lista "Al día y en promo", historial de pagos con nota y **recibo imprimible** (overlay con `@media print` que solo imprime el recibo).
- **Historial individual + CSV** (ficha `/gimnasio/miembros/[userId]`): últimos accesos y pagos del miembro, botón **"Exportar CSV"** (Blob UTF-8 con BOM, separador `;`).
- **Aforo con tope** (`/checkin/[qrCode]`): si `gyms.capacity` está definido y el presencia (excluyendo al propio usuario) llegó al tope, el ingreso se **bloquea** ("Aforo completo"); staff no se ve afectado.
- Commit `df88762`, deployado a **https://spotterx-five.vercel.app** (21s). **Etapa 3 completa** (migración 00011 corrida por el usuario).
- Nota lint: al tocar `g.capacity` (número o null) guardarlo en `const cap` local para que TypeScript lo estreche.

### 🟦 Etapa 2 — Perfil de usuario completo
- Migración **00010**: `profiles` += `birth_date`, `phone`, `website`, `social_links`, `is_verified`, `privacy`; RPCs de stats (posts, followers, following, pulses recibidos, racha); tablas `post_saves` + `post_reports` (si no se crearon en E1).
- Stats **reales** en perfil propio y público (fuera el hardcode "12/1.2k/890"), grid real con conteos por tile + lightbox.
- Perfil público: avatar con foto arreglado, listas de seguidores/siguiendo, botón mensaje.
- Perfil del profe **real**: gyms donde trabaja (`gym_staff`) + zona (`trainer_gyms`) con mapa Leaflet (fuera del placeholder "próximamente").
- Editar perfil extendido: username (validación unique), teléfono, nacimiento, website, enlaces, privacidad.
- **Configuración de cuenta** (nueva): cambiar email, cambiar contraseña, **borrar cuenta** (edge function con service role), preferencias de notificación, sesiones.
- `@menciones` parseables en captions y bio → links.
- Decisión: **todo público** (sin cuentas privadas ni aprobación de seguidores).

### 🟦 Etapa 3 — Gimnasio completo (herramientas del dueño)
- Decisiones: **cobro manual + estructura lista** (`gym_payments.method` ya soporta mercadopago; sin webhook aún, se agrega al final); **un gym por dueño** (sin multi-sede); avisos **in-app + push a futuro** (sin email/WhatsApp reales).
- Panel con cards de resumen: miembros activos, en el gym ahora, deudores, ingresos del mes.
- Miembros: editar datos del miembro, eliminar/desvincular, **historial individual** (accesos + pagos), exportar.
- **Staff**: gestión de profes (agregar/quitar, roles `admin`/`recepcion`/`profesor`), **horas trabajadas por profe** (ya se registran ingresos/egresos).
- Cobros: sección **Deudores** con montos, "Marcar pagó" mejorado (monto + nota), **recibos imprimibles**, totales por período, filtros.
- Aforo con tope (el checkin bloquea si está lleno). Comunicados del dueño a miembros/staff (notif en app). Recordatorios de vencimiento (pg_cron → notificación).
- Accesos con estadísticas (horario pico, asistencia media) + exportar CSV.

### ✅ Etapa 4 — Módulo Profesor (hecho en su totalidad, migración 00025 CORRIDA)
- **Sync automático gym → trainer_students** (migración 00025): triggers en `gym_memberships` (AFTER INSERT) y `gym_staff` (AFTER INSERT/UPDATE cuando `authorized=true`) vinculan automáticamente al miembro con cada `profesor_invitado` del gym (`source='gym'`), con backfill y `on conflict do nothing`. El dueño (`admin`) no se vincula (es la entidad, no una persona). Sin cambios de frontend.
- **Vista ALUMNO** (`/mi-entrenamiento`): planes, rutinas con historial + racha, chat con adjuntos, buscar profe por zona (Leaflet).
- **Planes estructurados + plantillas** + dietas con alimentos del catálogo y cálculo de macros.
- **Rutinas fechadas** con calendario, stats y cumplimiento (BarChart), publicar en feed.
- **Chat 1:1** con leídos y adjuntos (foto/reel/galería).
- **Vinculación bidireccional profe↔gym** (solicitudes + aprobación).

### 🟦 Etapa 5 — Marketplace fit + billetera + panel admin (PLAN APROBADO 12/09/2026, dividido en 3 lotes)

**Decisiones cerradas:**
- Comisión configurable, inicial **1%** (via `platform_config`, editable desde el panel admin; cada orden guarda snapshot del % del momento).
- Billetera interna (wallet): cargas/retiros manuales por el dueño (desde el panel admin); compra, comisión y acreditación al vendedor 100% automáticas (RPC).
- Pago manual/efectivo; entrega por **retiro o envío** coordinada por chat.
- "Preguntar" → abre el chat 1:1 existente (sin tabla de mensajes de mercado).
- Vende cualquier usuario logueado; reseñas solo compradores con orden **entregada** (unique producto+usuario).
- Categorías (todas deportivas): Ropa deportiva · Calzado deportivo · Equipamiento de entrenamiento · Suplementos y nutrición · Accesorios de gimnasio · Electrónica deportiva · Otros.
- Fotos en bucket `media` (`<uid>/market/<ts>.<ext>`, sin bucket nuevo).
- Admin: `profiles.is_admin` (setup con `UPDATE ... WHERE email='TU_EMAIL'`), panel `/market/admin`.

**Lote 1 — Marketplace + billetera (migraciones 00026 + 00027) — IMPLEMENTADO (commit `4b0ac8b`, deployado, migraciones corridas 12/09/2026):**
- `00026_market.sql`: `market_products`, `market_orders`, `market_order_items`, `market_reviews` + RLS + índices + realtime + RPC `market_checkout` (`security definer`, transacción `FOR UPDATE`, stock, 0 → `sold`) + trigger notif `orden` + constraint `'orden'` en notifications.
- `00027_wallet_admin.sql`: `profiles.is_admin`, `platform_config` (comisión 1%), `wallets` + `wallet_transactions` (ledger inmutable), RPCs (`get_or_create_wallet`, `buy_from_wallet`, `admin_set_commission`, `admin_credit_wallet`, `admin_mark_withdrawal_paid`, `request_withdrawal`, `get_my_wallet`).
- Páginas: `/market`, `/market/[id]`, `/market/crear`, `/market/carrito`, `/market/mis-publicaciones`, `/market/mis-compras`, `/market/billetera`.
- Entry points: card Marketplace en `/perfil` (todos los roles) + link en header `/market`.

**Lote 2 — Panel admin del market (`/market/admin`, solo `is_admin`) — IMPLEMENTADO (commit `a87fd33`, deployado 12/09/2026):**
- Dashboard (KPIs: productos, órdenes, ventas del mes, comisión acumulada, top categorías) + gráfico recharts.
- Comisión: muestra actual + input + botón guardar (`admin_set_commission`).
- Cargas pendientes → "Acreditar saldo"; retiros pendientes → "Marcar transferido".
- Entry point: icono Shield Admin en header de `/market` (solo visible para `is_admin`).

**Lote 3 — Panel de plataforma (commit `6808347`, deployado 12/09/2026, migración 00028 corrida + invite-member redeployada):**
- **`/admin`**: panel global admin (nuevo route group `(admin)` con layout auth guard + AdminShell).
  - Dashboard: KPIs globales (usuarios por rol, gyms, profes, posts, órdenes, ventas, comisiones).
  - Usuarios: búsqueda + verificar (`admin_set_verified`) + banear (`admin_toggle_ban`) + ver perfil.
  - Moderación: reportes pendientes → eliminar post (`admin_delete_post`) / descartar (`admin_resolve_report`).
  - Gyms: lista con ciudad + miembros.
  - Profes: lista con cantidad de alumnos.
  - Catálogo: ejercicios + alimentos con eliminar (`admin_delete_exercise`/`admin_delete_food`).
  - Market: resumen ventas + comisiones + exportar CSV.
- **Ban a nivel app**: `profiles.is_banned` + auth-context signOut + `/login?banned=1`.
- **Importación CSV** en `/gimnasio/miembros`: parse CSV → batch invite-member API.
- **Edge function `invite-member`** extendida: `users[]` batch + `as_admin`.
- **Migración `00028_admin.sql`** **CORRIDA** 12/09/2026: `profiles.is_banned`, `post_reports.status`/`resolved_by`, RPCs admin, `_assert_admin` helper.
- **Edge function `invite-member`** extendida + **redeployada** 12/09/2026: `users[]` batch + `as_admin`.
- **Admin account**: Dueño (`Alla`, overix.digital@gmail.com) con `is_admin=true` via `UPDATE profiles SET is_admin = true WHERE email = 'overix.digital@gmail.com';`.
- Entry points: card Admin en `/perfil` (is_admin) + link en `/market` header.

### 🟦 Etapa 6 — Empaquetado app (bonus, final del roadmap)
- Capacitor → APK/iOS, escaneo QR nativo, push reales.

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
- Check-in `/checkin/[qrCode]`: ruta pública, QR codifica URL `https://spotterx-five.vercel.app/checkin/<CODIGO>`. **Check-in automático** (sin botones): alumno → auto-ingreso con guard de doble escaneo y auto-egreso ≥ 3h; staff → form de hora de salida + nuevo ingreso. Si no está logueado redirige a `/login?next=...`. Muestra estado "¡Presente!" o "Ya estás ingresado".
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
- **Kiosk `/gimnasio/pantalla`** (overlay full-screen para monitor, acceso desde pestaña QR con "Abrir en pantalla"): QR gigante + **realtime** en `gym_access_logs` → al escanear un alumno o profesor muestra **ficha ~8s** con foto de perfil + hora, con badge verde "Ingresó" o naranja "Salió". Dos secciones: **"Alumnos en el gym"** (lista de alumnos adentro con avatar + hora de ingreso) y **"Profesores trabajando"** (lista de staff adentro, borde naranja). La lista se actualiza en tiempo real con cada escaneo.
- **Aviso al gym**: trigger `notify_gym_checkin` (migración 00005) inserta notificación `type='checkin'` (columna `gym_id` nueva + tipo habilitado) al dueño por cada ingreso. **Campanita** en el header del GymShell con contador de no leídas + desplegable "Quién entró".
- **Precio guardado en membresía**: migración 00005 agrega `gym_memberships.price`; se setea al alta (`invite-member` recibe `price`) y al "Marcar pagó" (Cobros registra el monto real y lo persiste). El alumno siempre ve la cifra aunque el plan se borre/edite.

### Recuperación de contraseña (hecho)
- **`/recuperar`** (auth): ingresa email → `resetPasswordForEmail` con `redirectTo = <origin>/actualizar-contrasena` (funciona en localhost y producción). Muestra confirmación sin filtrar cuentas existentes.
- **`/actualizar-contrasena`** (auth): se abre con el token del correo (`type=recovery`), valida que haya sesión, pide clave nueva + confirmación, `updateUser({ password })` → redirige a `/login`.
- Link **"¿Olvidaste tu contraseña?"** en `/login`.
- ⚠️ Requiere registrar la URL de redirección en Supabase **Auth → URL Configuration**: `https://spotterx-five.vercel.app/actualizar-contrasena` (y `http://localhost:3000/actualizar-contrasena` para pruebas locales).

### Auto-checkout de presencia (hecho)
- **Alumno**: escaneo automático de ingreso (sin botones). Si el último ingreso fue hace **≥ 3 horas** (o no tiene ingreso abierto), se auto-cierra la sesión anterior y se registra un nuevo ingreso → "¡Presente!". Si fue hace **< 3 horas**, muestra "Ya estás ingresado" (sin acción). Sin notificación al alumno.
- **Profesor/staff**: al escanear con sesión abierta, muestra **form con time picker** ("¿Cuándo saliste?") para que el profesor ingrese manualmente la hora de salida de la sesión anterior. Al confirmar → registra egreso con hora ingresada + nuevo ingreso automático. Si no tiene sesión abierta → auto-ingreso directo.
- **pg_cron** (`00006_auto_checkout.sql`): job cada **15 minutos** que cierra automáticamente sesiones de alumni > 3 horas (sin notificación). Excluye staff explícitamente. El egreso se timestampa con `created_at + 3 hours` (no `NOW()`) para que el aforo sea más preciso.
- **Kiosk**: ahora muestra **dos listas separadas** — "Alumnos en el gym" y "Profesores trabajando" — con presencia actual (más ingresos que egresos). La flash card muestra tanto ingresos (verde) como egresos (naranja).
- **Migración `00006_auto_checkout.sql`**: requiere `pg_cron` y `pg_net` extensions (ya disponibles en Supabase).

### Salida manual desde Accesos (hecho)
- **`/gimnasio/accesos`** nueva sección **"Ahora dentro"**: lista en vivo (realtime `INSERT` en `gym_access_logs`) de **Alumnos** y **Profesores** con presencia, cada uno con botón **"Dar salida"**.
- Al tocar se abre un **BottomSheet**: checkbox **"Registrar con la hora actual"** (default) → egreso con `NOW()`; si se desmarca, aparece un **time picker** y la salida se timba con **hoy a esa hora** (validación: no puede ser anterior a la entrada del miembro; si lo es → toast de error y no inserta).
- Inserta en `gym_access_logs` `{ gym_id, user_id, type='egreso', created_at }`. **Sin migración**: la policy `Access: owner registra` (00003) ya permite al dueño insertar egresos por cualquier miembro. La lista y el contador se refrescan solos (single source of truth `refreshInside`: `gym_presence` + `gym_staff` + `profiles` con `Map` en cliente, lección de embeds).

### Fase A — Módulo Profesor: vista alumno + planes estructurados + rutinas fechadas (implementado y desplegado; migración 00013 CORRIDA 07/09/2026)
- **Vista del alumno `/mi-entrenamiento`** (nueva, ruta `(social)`): accesible desde Perfil (card naranja "Mi entrenamiento", solo rol alumno). Lista los profes vinculados (`trainer_students` activos), selector de profe si hay varios, y por profe: tab **Planes** (estructurados, expandibles, agrupados por día), tab **Rutinas** (pendientes con badge Vencida/Hoy/fecha vía `DueBadge`, completadas con fecha de `completed_at` → historial), tab **Chat** (realtime + auto-marcado de leídos). Banner "Tenés N rutinas para hoy".
- **Planes estructurados**: nueva tabla `trainer_plan_items` (plan_id FK cascade, `day`, `exercise`, `sets`, `reps`, `rest_seconds`, `notes`, `position`) con RLS espejo de `trainer_plans` (lectura involucrados vía join; profe gestiona). En `/entrenamiento/alumno/[id]` el profe crea planes con formulario (título + tipo + descripción) en vez de `window.prompt`, y agrega/borra ejercicios por plan y día (series/reps/descanso/nota).
- **Rutinas con fecha**: formulario con `<input type=date>` (`due_on`), toggle de completada con **`completed_at`** (columna nueva en 00013) que alimenta el historial. Badge compartido `src/components/training/DueBadge.tsx` (Vencida/Hoy/fecha) usado por profe y alumno.
- **Chat con leídos**: policy nueva `Messages: marca leido` (UPDATE por `recipient_id`); ambas vistas marcan `read=true` al abrir el hilo. Trigger `notify_message` (00010) genera la notificación.
- **Realtime** (00013): `trainer_plans`, `trainer_plan_items`, `trainer_routines`, `messages` en `supabase_realtime`; cada vista refresca al recibir cambios.
- **Filtro realtime de mensajes**: canal con `filter: recipient_id=eq.<userId>` (entrantes → reload); los enviados se agregan localmente (patrón `/chat/[id]`). El filtro viejo `recipient_id=X,sender_id=Y` era AND (nunca matcheaba) → corregido.
- **Plantillas de planes** (A2, migración 00014 CORRIDA): columna `trainer_plans.is_template`; el profe guarda un plan como plantilla (ícono BookmarkPlus, chip naranja "Plantilla") y desde "Plantillas" lo copia a cualquier alumno con todos sus ejercicios (`copyTemplate` → inserta plan + items). El alumno NO ve planes marcados como plantilla (`.eq("is_template", false)` en `/mi-entrenamiento`).
- **Vinculación bidireccional profe↔gym** (A5, migración 00015 CORRIDA 07/09/2026): tabla `trainer_gym_requests` (trainer_id, gym_id, status, unique) + RLS (profe: crea y lee sus solicitudes; owner: ve y aprueba/rechaza) + triggers `notify_gym_solicitud` / `notify_staff_aprobado` + columnas `trainer_gyms.availability` + tipos `solicitud_staff` / `staff_aprobado` en `notifications` + realtime. El profe busca gym real por nombre/ciudad, hace "Postularme" (insert/upsert, estado visible Pendiente/Aprobado/Rechazado) o agrega gym manual; el dueño en `/gimnasio` ve solicitudes pendientes con Aprobar (→ upsert `gym_staff` authorized + auto-crea `trainer_students`) / Rechazar (→ notificación al profe); el profe captura GPS y setea disponibilidad. Pendiente: que el alumno busque profe por zona con mapa (Leaflet).
- **Auto-vinculación trainer_students** (commit `ff6a72e`): `confirmAlumno` (agregar alumno desde `/gimnasio/miembros`) y `addProfesor` (agregar profe) ahora auto-crean entradas en `trainer_students` vinculando profe↔alumno del mismo gym. También `approveRequest` (aprobar solicitud de profe en `/gimnasio`) y la edge function `invite-member` (alta masiva) crean `trainer_students` automáticamente. Sin esto, el alumno nunca veía planes ni rutinas del profe (campo `trainer_students` vacío).
- **Planes vs Rutinas explícitos** (commit `ff6a72e`): tab Planes en `/mi-entrenamiento` ahora distingue `kind='alimentacion'` (chip naranja "Alimentación", contenido como "Guía nutricional" con borde naranja, items como comidas) de `kind='entrenamiento'` (chip neón, ejercicios). Tab Rutinas muestra chip "Del plan: [título]" cuando la rutina tiene `plan_id`. El profe ve placeholder de guía nutricional al crear plan tipo alimentación. Sin migración nueva (campo `content` de `trainer_plans` ya existía).
- **Milestone 1 de Fase A**: A1 (ruta+rutinas+historial+chat), A2 (schema+UI profe+vista alumno, **sin plantillas**), A3 (due_on+completar+historial, **sin calendario ni gráfico**), A4 parcial (leídos marcados + badge visible de no-leídos, adjuntos pendientes), A5 parcial (solicitud profe↔gym + disponibilidad; **sin mapa de alumnos**). Checkboxes en `PLAN_PULIDO.md`.

### Buscador de personas + agregar alumno/profesor (hecho)
- **`/gimnasio/miembros`** nueva card **"Agregar por búsqueda"** (estilo Instagram): input con **debounce 250ms** que consulta `profiles` (`select id, username, full_name, email, avatar_url, role` + `.or("username.ilike.%q%,full_name.ilike.%q%")` + `.neq("id", userId)` + `.limit(12)`, patrón de Discover). Resultados: `Avatar` + nombre + `@usuario` + rol registrado.
- Cada resultado tiene **dos botones, independientes del rol con el que se registró** (alumno → profesor y viceversa):
  - **Como alumno** (neón): abre modal para elegir **plan** → `upsert` directo en `gym_memberships` `{ plan_name, price, status:'activa', pay_status:'pagado', expires_on: hoy+meses del plan }` con `onConflict: "gym_id,user_id"`. RLS `Memberships: owner gestiona` (00003) ya lo permitía, **sin migración**.
  - **Como profesor** (naranja): `upsert` directo en `gym_staff` `{ role:'profesor_invitado', authorized:true }` con `onConflict: "gym_id,user_id"`. Requiere la **migración 00012** (policy `Staff: owner gestiona`, **PENDIENTE de correr**); sin ella falla por RLS.
- **Badges**: quien ya es alumno/profesor del gym se ve con "*· Alumno ✓*" (neón) / "*· Profesor ✓*" (naranja) y su botón queda deshabilitado ("✓ Alumno"/"✓ Profesor"). Se usan `Set`s de `gym_memberships.user_id`/`gym_staff.user_id` cargados en el efecto inicial.
- Toast de confirmación por cada alta + la persona se prepende a la lista de miembros en memoria.
- **Fix bugs del alta existente** (`createAll`): `role` estaba **hardcodeado a `"alumno"`** (ignoraba el selector Profesor) → ahora `role: form.role`; el guard `if (!selectedPlan) return` **bloqueaba a los profesores** (no hay selector de plan) → ahora solo exige plan cuando `form.role === "alumno"`; para profesor los campos de plan van `null` (la edge fn los ignora). Resultados del alta ahora muestran "Vinculado como profesor del gimnasio" para rol profesor.

### Fix checkin "no sos miembro" (hecho)
- **Síntoma**: el check-in decía "no sos miembro" para alumnos con membresía activa/pagada.
- **Causa raíz**: al escanear el QR con la cámara nativa del celular, el link se abre en un navegador **sin sesión** (`userId=null`). El checkin no podía resolver la membresía porque no había usuario autenticado.
- **Fix**: `/checkin/[qrCode]` ahora **redirige automáticamente** a `/login?next=/checkin/<qr>` cuando no hay sesión. Al loguear, vuelve y registra el presente.
- **Segundo bug (loop)**: el checkin redirigía al login **antes** de que `AuthProvider` resolviera la sesión (`authLoading` aún true) → loop login↔checkin que parecía "no deja entrar / cierra la sesión". Fix: el efecto **espera `authLoading=false`** antes de decidir (añadir `authLoading` a las deps y un early `if (authLoading) return`).
- **Lección**: no asumir que una sesión existe al montar `/checkin`; esperar a que la sesión esté resuelta y, si es `null`, redirigir al login con `?next=` (el login ya respeta `next` vía `signIn`).

### Editar perfil (hecho)
- **`/perfil/editar`**: formulario para cambiar avatar (sube a bucket `media` en `avatars/<userId>/`), nombre completo, ubicación y bio. Usa el patrón de subida de `crear/page.tsx` (extensión + `supabase.storage.from("media").upload()` + `getPublicUrl`). La preview del avatar es即时。
- **`/perfil` (propio)**: ahora muestra el avatar con imagen si `avatar_url` existe (sino iniciales), la bio, y un icono ⚙️ que lleva a `/perfil/editar`.
- **Nota**: el bucket `media` fue creado manualmente en Supabase Dashboard. Los avatares se guardan en subcarpeta `avatars/<userId>/` dentro de ese bucket.

### Cancelar membresía desde el gym (hecho)
- **`/gimnasio/miembros`**: cada miembro alumno con `status=activa` tiene un botón **"Cancelar"** (naranja, con icono XCircle). Al tocar, pide confirmación (`window.confirm`), luego ejecuta `UPDATE gym_memberships SET status='inactiva' WHERE gym_id=X AND user_id=Y`. El badge cambia a "Cancelada" (gris). Los alumnos inactivos no pueden escanear el QR (ya existente: checkin requiere `status=activa`).
- **RLS**: el owner del gym ya puede hacer `UPDATE` en `gym_memberships` por la policy existente.

### Buscador + reactivar membresía (hecho)
- **`/gimnasio/miembros`** ahora tiene un **buscador** (input que filtra en vivo por nombre, usuario o email) sobre la lista de miembros.
- Los miembros **inactivos/cancelados** muestran la línea del plan + su última fecha de **vencimiento** (`expires_on`) y un botón **"Reactivar"** (verde).
- Al tocar "Reactivar" se abre un **modal** que lista los planes del gym; el dueño elige un plan y se reactiva la membresía: `status='activa'`, `pay_status='pagado'`, `expires_on` = hoy + duración del plan, `price` = precio del plan, `plan_name` actualizado.
- Permite rastrear ex-alumnos (personas que ya fueron parte del gym) con su último vencimiento y darlos de alta de nuevo.

### Fix: lista de miembros vacía (embed a profiles roto)
- **Síntoma**: en `/gimnasio/miembros` los recuadros de clientes mostraban solo `@` sin nombre/email/username.
- **Causa**: el embed de PostgREST `profiles:profiles!gym_memberships_user_id_fkey(full_name,email,username)` devolvía `null` en runtime autenticado aunque con service role sí traía los datos y la policy `Profiles: lectura pública` (`using(true)`) debería permitirlo. Mismo patrón que el bug del "Gimnasio" en `/mi-gimnasio`.
- **Fix (robusto)**: **no confiar en el embedding a `profiles`**. Ahora `/gimnasio/miembros` hace una **consulta separada** a `profiles` (`select id, full_name, email, username ... in (ids)`) y construye un `Map<userId, profile>` para unir en el frontend.
- **Lección**: los embeds de PostgREST por nombre de FK (`!<tabla>_<columna>_fkey`) pueden fallar en runtime. Para join de datos de perfil, preferir consulta separada a `profiles` y unir por `id` en el cliente.

### Historial de asistencia del alumno (hecho)
- **`/mi-gimnasio`**: debajo del botón "Dar el presente", sección **"Últimos accesos"** con los últimos 15 registros de `gym_access_logs` (ingresos/egresos) para ese gym. Muestra badge verde (ingreso) o naranja (egreso) con fecha y hora. Se carga al montar la página junto con la membresía.

### Ficha del miembro (frontend deployado; falta migración 00008)
- **`/gimnasio/miembros/<userId>`** (`src/app/(gyms)/gimnasio/miembros/[userId]/page.tsx`): ficha con cabecera (nombre, @, email, badge Alumno/Profesor del gimnasio), resumen de membresía (plan, vencimiento, estado) y form de **datos extra**: teléfono, dirección, ciudad, obra social, fecha de nacimiento (con edad calculada), DNI/CUIL, contacto de emergencia (nombre + teléfono) y notas/observaciones. Guarda con `upsert` y `onConflict: "gym_id,user_id"`. Aplica a alumnos y profesores.
- **Lista `/gimnasio/miembros`**: los recuadros ahora son **clicables** (Link → ficha, chevron derecho); los botones Cancelar/Reactivar hacen `preventDefault`/`stopPropagation` para no navegar.
- **Migración `00008_gym_member_details.sql` CORRIDA** (11/09/2026): crea `gym_member_details(gym_id, user_id, phone, address, city, obra_social, birth_date, dni, emergency_name, emergency_phone, notes, updated_at)` con PK `(gym_id, user_id)`, RLS owner (full) + propia (select).
- Nota de lint (regla `react-hooks/purity` del nuevo React compiler): no llamar `Date.now()` ni crear componentes (`Field`) dentro del render; la edad se calcula en los handlers y se guarda en estado.

### Fase 6 — Marketplace Fit
- Venta de productos de fitness, tipo **MercadoLibre** → comisiones

### Futuro / Otras monetizaciones
- Boosts/verificación (patrón ya probado en fitpro), contenido pago, suscripciones premium
- Gym como SaaS (freemium por cantidad de usuarios)
- Conexión/integración con otras apps (login compartido / API / deep links)

## Deploy / Producción
- **Vercel**: proyecto `pump13/spotterx` → producción `https://spotterx-five.vercel.app` (deploy **catálogo de ejercicios + ExercisePicker** `https://spotterx-bu4c4dyz5-pump13.vercel.app`, 26s). Env vars de Supabase configuradas en production/preview/development. Redploy: `vercel --prod --yes` (requiere login o `VERCEL_TOKEN`). Token vigente transitorio (dura 1 día): `[REDACTED]` (cargado 10/09/2026).
- **Supabase** (proyecto `dzalgziofiwcljgnphap`): URL `https://dzalgziofiwcljgnphap.supabase.co`. `.env.local` usa la **anon key clásica** (la publishable no lista Storage). Edge function deployada: `invite-member` (redeployada 09/09/2026 con auto-vinculación trainer_students).
- **Edge Function `invite-member`**: crea cuentas (rol alumno/profesor) con la **service role key** guardada como **secreto** `SPOTTERX_SERVICE_ROLE` en Supabase (nunca en frontend). Deploy/secretos con `supabase functions deploy invite-member` y `supabase secrets set` (CLI + access token `sbp_...`). **ATENCIÓN**: la service role key se expuso en el chat → regenerarla luego del deploy si se quiere máxima seguridad. Para crear `auth.users` desde la app solo se puede vía esta edge function (el frontend usa anon key).
- **Migraciones**: no se pueden ejecutar desde la app; el usuario las corre manualmente en **SQL Editor** de Supabase. Completadas: 00001, 00002, 00003, 00004, 00005, 00006, **00007** (`00007_gym_memberships_unique.sql` = unique `gym_id,user_id` en `gym_memberships`, necesario para el `upsert` con `onConflict` de la edge function `invite-member`; al crear el unique deja de haber duplicados de membresía por par gym+usuario), **00008** (`00008_gym_member_details.sql` = tabla `gym_member_details` para la ficha del miembro, corrida 11/09/2026), **00009** (`00009_social_polish.sql` = Etapa 1: realtime social + RLS + `post_saves`/`post_reports` + `parent_id`, corrida 11/09/2026), **00010** (`00010_profiles_extend.sql` = Etapa 2: columnas de perfil + triggers + índices, corrida 11/09/2026) y **00011** (`00011_gym_reminders.sql` = Etapa 3: tipo `vencimiento` + `notify_upcoming_expiry` + pg_cron, **corrida 12/09/2026**). Y **00012** (`00012_staff_owner_manage.sql` = policy `Staff: owner gestiona` en `gym_staff` para el buscador de personas, **corrida 07/09/2026**). Y **00013** (`00013_training_estructurado.sql` = Fase A: `trainer_plan_items` + `trainer_routines.completed_at` + policy `Messages: marca leido` + realtime training, **corrida 07/09/2026**). Y **00014** (`00014_plan_templates.sql` = plantillas de planes: `trainer_plans.is_template` + índice, **corrida 07/09/2026**). Y **00015** (`00015_trainer_gym_requests.sql` = Fase A A5: tabla `trainer_gym_requests` (postulación profe↔gym con aprobación del dueño), RLS + triggers de notificación (`solicitud_staff`, `staff_aprobado`), `trainer_gyms.availability`, extendidos types en `notifications`, realtime; **corrida** 07/09/2026). Y **00016** (`00016_routines_structured.sql` = Fase A: tablas `disciplines` (12 disciplinas), `trainer_routine_items` (ejercicios por día con `data` jsonb) y `trainer_routine_logs` (logs de progreso jsonb) + RLS + realtime; columnas `profiles.disciplines`, `trainer_routines.discipline`/`custom_fields`; **corrida** 09/09/2026). Y **00017** (`00017_routine_logs_unique.sql` = constraint único `(item_id, log_date)` en `trainer_routine_logs`, necesario para el `upsert` del alumno — **corrida** 09/09/2026). Y **00018** (`00018_exercises_catalog.sql` = catálogo global de ejercicios: tabla `exercises` (name + disciplina sugerida + created_by) con RLS (todos leen, autenticados agregan), unique `lower(name)`, realtime, y seed de ~145 ejercicios por disciplina — **CORRIDA** 09/09/2026, verificada: 118 ejercicios). Y **00019** (`00019_exercises_muscle_es.sql` = grupo muscular `muscle` en `exercises` + backfill de los ejercicios existentes + lote de ejercicios en español además de los de inglés — **CORRIDA** 09/09/2026, verificada: 156 ejercicios, 155 con `muscle`). Y **00020** (`00020_dietas.sql` = dietas por alumno: `trainer_plans.assigned_at` (null = borrador, con fecha = asignada al alumno) + `trainer_plan_items.data jsonb` (`{ meal, qty, unit, kcal, protein_g, fat_g, carbs_g }`) + índice + backfill `assigned_at=now()` en planes no-plantilla — **CORRIDA** 09/09/2026, verificada: columnas `assigned_at`/`data` presentes, backfill aplicado). Y **00021** (`00021_foods_catalog.sql` = catálogo de alimentos con macros por 100g: tabla `foods` (name, category, kcal, protein_g, fat_g, carbs_g, created_by) + RLS + unique `lower(name)` + realtime + seed de ~100 alimentos comunes — **CORRIDA** 09/09/2026, verificada: 87 alimentos, 7 categorías). Y **00023** (`00023_more_foods.sql` = lote amplio del catálogo: +170 alimentos en 6 categorías nuevas — Panadería y tostadas, Bebidas, Snacks y ultraprocesados, Comidas preparadas, Conservas, Condimentos y especias — y ampliaciones en las existentes; `ON CONFLICT (lower(name)) DO NOTHING`, con `unit_grams` en los que van por unidad; total ≈ 257 — **CORRIDA** 09/09/2026, verificada: 257 alimentos, 13 categorías (Frutas 32, Proteínas 31, Carbohidratos 28, Verduras 27, Grasas y frutos secos 24, Lácteos 23, Comidas preparadas 19, Bebidas 17, Snacks y ultraprocesados 15, Panadería y tostadas 13, Condimentos y especias 11, Conservas 11, Otros 6)). Y **00024** (`00024_chat_attachments.sql` = columnas `messages.attachment jsonb` + `content` nullable para adjuntos de fotos/videos en el chat — **CORRIDA** 10/09/2026, verificada: `attachment` presente y `content` nullable). Y **00025** (`00025_gym_sync_students.sql` = triggers en `gym_memberships` y `gym_staff` que sincronizan automáticamente `trainer_students source='gym'` (solo `profesor_invitado`), con backfill — **CORRIDA** 10/09/2026). Y **00026** (`00026_market.sql` = marketplace: `market_products`, `market_orders`, `market_order_items`, `market_reviews`, RLS, índices, realtime, RPC `market_checkout`, trigger `notify_market_order`, constraint `'orden'` en notifications — **CORRIDA** 12/09/2026). Y **00027** (`00027_wallet_admin.sql` = billetera + admin: `profiles.is_admin`, `platform_config`, `wallets`, `wallet_transactions`, RPCs wallet — **CORRIDA** 12/09/2026). Y **00028** (`00028_admin.sql` = admin panel: profiles.is_banned, post_reports.status/resolved_by, RPCs admin_global_stats, admin_set_verified, admin_toggle_ban, admin_delete_post, admin_resolve_report, admin_delete_exercise, admin_delete_food, _assert_admin helper - **CORRIDA** 12/09/2026).

## Rutinas con series + registro por checks (hecho, commit `b4bd86a`)
- **Disciplinas de fuerza** (`musculacion`, `crossfit`, `calistenia`, `funcional` → `isSeriesDiscipline()` en `src/lib/disciplines.ts`): cada ejercicio del profe se edita como **series** — fila por serie con reps / peso (kg) / descanso (s), botón **"+ Serie"** agrega fila y cada fila tiene su ✕. Formato en `data.series`: `[{ reps, weight_kg, rest_seconds }, ...]`.
- **Legacy**: rutinas viejas con campos planos (`sets/reps/weight_kg/rest_seconds`) se convierten a series automáticamente al editar (`legacyToSeries`) y al guardar (`resolveSeries`). Helpers en `disciplines.ts`: `getSeries`, `resolveSeries`, `legacyToSeries`, `formatSeries`, `isSeriesDiscipline`, `Series`/`SeriesLog`.
- **Alumno NO carga datos**: cada serie se **marca con check** (✓ hecha) y solo puede editar el **peso real** que levantó (precargado con el plan, step 0.5). reps/descanso quedan fijos del plan. `saveLogs` hace `upsert` 1 log por (ejercicio, día) con `data.series = [{ done, weight_kg }]`.
- **Progreso / PR / promedio** del alumno: usa el **mayor peso real** entre las series hechas de cada sesión (por ejercicio). Disciplinas sin series (cardio, running, yoga, HIIT, etc.) quedan con campos planos y el logging anterior.
- **Realtime** (00016): `trainer_routine_items`, `trainer_routine_logs`, `disciplines` en `supabase_realtime`; las vistas recargan al recibir cambios.
- **Pendiente**: correr la migración 00017 en SQL Editor (sin ella, el upsert del alumno falla con "no unique or exclusion constraint matching ON CONFLICT").

## Catálogo de ejercicios con buscador (hecho, commit `23f2afd`)
- **Solo rutinas** (decisión: planes quedan para alimentación cuando terminemos las rutinas).
- **`src/components/training/ExercisePicker.tsx`** (NUEVO): combobox con buscador que reemplaza el input "Ejercicio" en el form de rutinas del profe. Dropdown al enfocar, filtra por substring sin importar mayúsculas, **sugeridos de la disciplina primero** (sección "Sugeridos" + "Todos"), y **"+ Crear 'texto'"** si el nombre no existe (inserta en `exercises` con `created_by`, dedupe por `lower(name)`). Cache a nivel módulo (una carga por sesión). **Degrada a input simple** si la tabla `exercises` no existe.
- **Migración `00018_exercises_catalog.sql`** (PENDIENTE de correr): tabla `exercises` + RLS + realtime + seed de ~145 ejercicios comunes por disciplina.
- **Planes NO se tocaron**.

## Catálogo de ejercicios: grupos musculares + agregar (hecho, commit `35e0727`)
- **Columna `muscle`** (grupo muscular) en `exercises`: pecho, espalda, hombros, bíceps, tríceps, antebrazo, cuádriceps, femoral, glúteos, pantorrilla, core, full body, cardio, técnica, movilidad.
- **Backfill (migración 00019)**: los ejercicios del seed quedan etiquetados con su `muscle`; se agrega un lote nuevo de ~37 ejercicios **en español** al lado de los de inglés (Cargada de fuerza, Arrancada, Salto al cajón, Flexión de pino, Curl nórdico, Cruce de poleas, Curl concentrado, Puente de glúteos, etc.).
- **`ExercisePicker.tsx`**: chips de grupo en el dropdown (scroll horizontal, "Todas" + grupos, orden `MUSCLE_ORDER`); la búsqueda matchea **nombre OR grupo OR disciplina** (escribir "pecho" lista todo el pecho de musculación); order: sugeridos de la disciplina primero y dentro, por grupo. El "+ Crear 'texto'" usa el chip activo como `muscle`. Una **función "+ Agregar ejercicio"** abre un mini-form (nombre + grupo + disciplina) que inserta y selecciona el ejercicio. Degrada a input simple si la tabla no existe.
- **Pendiente**: ~~correr la migración 00019 en SQL Editor~~ ➜ **CORRIDA 09/09/2026**, verificada (156 ejercicios, 155 con muscle, 11 de pecho).

## Dietas: planes de alimentación estructurados con asignación (hecho, commit `4f58fcb`)
- **Concepto**: la pestaña **Planes** del profe (`/entrenamiento/alumno/[id]`) permite crear planes tipo **Alimentación** con **dietas estructuradas**: Día → Comida (Desayuno/Colación/Almuerzo/Merienda/Cena/Post-entreno) → alimentos con **cantidad** + **unidad** + **kcal** + macros (**P/G/C** en g) + nota.
- **Borrador / Asignada**: `trainer_plans.assigned_at` — los planes de alimentación se crean como **borrador** (invisible para el alumno) y el profe los hace visibles con el botón **"Asignar"** (o los oculta con **"Quitar"**, badge Asignada/Borrador). Controles 100% del profe.
- **Los planes de entrenamiento/general** se crean directamente visibles (`assigned_at=now()`), sin ningún cambio de comportamiento.
- **Alumno (`/mi-entrenamiento`, tab Planes)**: query con `.not("assigned_at","is",null)` → **solo ve dietas asignadas**; las de alimentación se renderizan estructuradas (Día → comidas → alimentos con cantidad/unidad/kcal/macros) + mantiene la "guía nutricional" (`content`) como notas.
- **Datito**: `trainer_plan_items.data` jsonb es el mismo patrón que `trainer_routine_items.data`; items de comida viejos sin `data` se agrupan como "Sin etiquetar". Helper compartido **`src/lib/diets.ts`** (`MEALS`, `mealLabel`, `getDietData`).
- **Migración 00020 CORRIDA 09/09/2026** (verificada en DB: columnas presentes + backfill).

## Catálogo de alimentos con macros (hecho, commit `5d7a368`)
- **`FoodPicker`** (`src/components/training/FoodPicker.tsx`, NUEVO) reemplaza el input de alimento en el form de dieta del profe: dropdown con buscador (matchea nombre O categoría), **chips por categoría** (Proteínas / Carbohidratos / Frutas / Verduras / Lácteos / Grasas y frutos secos / Otros...), y por cada alimento muestra "kcal · P · G · C". Opciones **"+ Crear 'texto' (0 kcal)"** y **"Agregar alimento con macros"** (form: nombre + categoría + kcal/P/G/C **por 100 g**) que inserta en `foods` y autocompleta el form.
- **Autocompletado escalado por cantidad**: al elegir un alimento, kcal/P/G/C se calculan `base × qty/100`. Si no hay cantidad, carga los valores por 100g y pone unidad "g". Los campos quedan editables. Helper `autoFillFood` en la página del profe.
- **Migración `00021_foods_catalog.sql` CORRIDA 09/09/2026** (verificada: 87 alimentos, 7 categorías): tabla `foods` + RLS + unique `lower(name)` + realtime + seed. **Degrada con gracia**: sin la tabla, FoodPicker cae a input simple (igual que ExercisePicker).
- No cambia el schema guardado (`data` jsonb) ni la vista del alumno.

## Alimentos: gramos o cantidad, con macros recalculadas (hecho, commit `9b66083`)
- **Form de dieta**: dos campos **mutuamente excluyentes** — **Gramos** (alimentos por peso) y **Cantidad (unid.)** (alimentos por unidad). Si escribís en uno, el otro se limpia.
- **Macros recalculados al escribir**: cada vez que cambia la cantidad/gramos con un alimento elegido, kcal/P/G/C se recalculan solos:
  - **Gramos**: `base × gramos / 100`.
  - **Cantidad**: `base × cantidad × unit_grams / 100` (ej: 2 huevos = 2 × 50g × base/100).
- **`unit_grams`** (`foods.unit_grams`, migración 00022, PENDIENTE de correr): peso estimado de 1 unidad de cada alimento. En el picker se muestra "1 unidad ≈ X g" en la fila y el form "Agregar alimento" tiene un campo de gramos por unidad. Sin la migración, la cantidad (unid.) no puede calcular macros (los alimentos por peso con Gramos sí).
- **`data` jsonb guarda**: `qty` + `qty_mode` ("g" | "u") + `unit` derivado ("g"/"unidades"). Helper `formatQuantity(d)` en `src/lib/diets.ts` usado por profe y alumno (muestra "150 g" o "2 unid."; items viejos sin `qty_mode` usan el join qty+unit anterior).
- Sin migración para el guardado: items viejos siguen andando.

## Catálogo de alimentos: lote amplio 2.0 (hecho, commit `2d67e38`)
- **Migración `00023_more_foods.sql`** (✅ CORRIDA 09/09/2026, verificada: **257 alimentos, 13 categorías**): +170 alimentos nuevos con `ON CONFLICT (lower(name)) DO NOTHING` (no duplicó los 87 existentes). Valores por 100g y `unit_grams` en los que van por unidad.
- **6 categorías nuevas** (aparecen solas en los chips del picker, ordenadas por `CATEGORY_ORDER` y select de "Agregar alimento"): **Panadería y tostadas** (tostadas integrales/de salvado/de centeno, galletitas de arroz, pan de molde, francés, árabe, centeno, hamburguesa, bizcochos, grissines), **Comidas preparadas** (milanesas, pizza, empanada, guiso, locro, pastel de papas...), **Bebidas** (agua, gaseosas, jugos, gatorade, leches vegetales, café, té, cerveza, vino, licuado, batido de proteína, chocolatada), **Snacks y ultraprocesados** (barras, galletas, doritos, helado, chocolate, turfón/mantecol budín/alfajor), **Conservas** (atún al aceite, caballa, anchoas, sardinas, legumbres en lata, tomate triturado, pepinillos), **Condimentos y especias** (orégano, pimentón, curry, comino, ajos en polvo, soja, vinagre).
- **`FoodPicker.tsx`**: `CATEGORY_ORDER` actualizado con las categorías nuevas entre "Grasas y frutos secos" y "Otros". Chips y busqueda funcionan igual (matchean nombre o categoría).

## Buscar profe por zona (alumno, hecho, commit `809ba0c`)
- **Página `/mi-entrenamiento/buscar`** (nueva): el alumno encuentra profes por zona en **mapa Leaflet** (multi-marcador, icono naranja reutilizando patrón de `GymMap`) + **buscador** (filtra por ciudad/dirección/zona/nombre del profe) + **lista de profes** con Avatar, @username, zona, disponibilidad y badge "Ya te entrena".
- **Datos**: `trainer_gyms` (lectura pública) + `profiles` en **consulta separada** con joeña `Map` (lección: no fiarse del embed) + `trainer_students` activos del alumno para el badge. Los profes sin coordenadas no salen en el mapa pero sí en la lista.
- **Contacto directo** (decisión del usuario, sin migración): cada profe tiene botones **Ver perfil** (`/perfil/<username>`) y **Mensaje** (`/chat/<trainerId>`) — el chat funciona con cualquier usuario sin chat previo; el mensaje dispara la notificación `message` (trigger 00010).
- **Mi zona en el mapa**: botón que centra el mapa con la geolocalización GPS del alumno (default: Argentina, zoom 5).
- **Entradas**: botón "Buscar profe" en el header de `/mi-entrenamiento` (+ empty state "Todavía no tenés un profe" → botón ember) y card "Buscar profe por zona" en `/perfil` (alumno, debajo de "Mi entrenamiento").
- Sin migración: `trainer_gyms` ya se lee público y `profiles`/`trainer_students` aplican policies existentes.

## Adjuntos en el chat (hecho, commit `ebe091f`)
- **Columna `messages.attachment jsonb`** (`{ type: "image"|"video", url }`) + `content` pasa a permitir **NULL** (mensaje solo imagen). Migración **`00024_chat_attachments.sql` CORRIDA** (10/09/2026, verificada: `attachment jsonb` presente, `content` nullable).
- **Subida**: fotos/videos al bucket `media` en `chat/<userId>/<timestamp>.<ext>` — ojo: la policy de storage exige que el primer folder sea `auth.uid()` (los posts usan `<uid>/`), por eso NO se usa `chat/` como carpeta raíz.
- **UI en ambos chats** (`/chat/[id]` y pestaña Chat de `/mi-entrenamiento`): botón 📎 (input `capture="environment"`, acepta `image/*,video/*`) → **preview** con quitar, texto opcional + adjunto, spinner de envío, y burbujas que muestran la imagen + el texto debajo.
- `messages` ya está en realtime (00013), así el adjunto llega en vivo; el re-select de `/chat/[id]` ahora incluye `attachment`.

## Historial de rutinas: calendario + racha + cumplimiento + publicar en feed (hecho, commit `3aae915`)
- **Componente compartido** `src/lib/history.ts` (puro, sin migración ni deps): `monthGrid`, `monthLabel`, `isFutureDate`, `countLogsByDate`, `sessionsByDate`, `plannedDates`, `computeStreak` (racha terminando hoy), `monthlySeries` (últimos 6 meses: hechas vs planificadas), `categoryForDiscipline` (disciplina → hashtag).
- **Nueva pestaña "Historial"** (4ª) en `/mi-entrenamiento` (alumno) **y** en `/entrenamiento/alumno/[id]` (profe): calendario mensual (grid CSS, intensidad neón por sesiones del día, borde ember en planificadas sin completar, anillo en hoy, futuro gris, navegación ◀ ▶ sin ir al futuro), stats (días entrenados, racha 🔥, top mes) y **BarChart** de cumplimiento 6 meses (hechas neón / planificadas ember, recharts).
- **Tap a un día** → bottom sheet con las sesiones de ese día (rutina + n° de día + label).
- **Publicar en el feed** (solo alumno): botón por sesión → inserta `posts` solo-texto (`caption: 🔥 Terminé "Rutina" · Día N`, categoría mapeada de la disciplina, `media_url null`) → link "Ver publicación" a `/posts/[id]`. Anti-doble-click.
- **Datos**: `trainer_routine_logs.log_date` (hechas) + `trainer_routines.due_on` (planificadas). El profe ahora carga los logs del alumno (policy "Routine logs: profe lee" de 00016) — **sin migración**. Se agregó realtime de `trainer_routine_logs` en AMBAS páginas (filtro `student_id`) para que el calendario se refresque solo.
- Lint/build OK (27 rutas); sin SQL.

## Publicar con foto/reel + Compartir racha (hecho, commit `045825d`)
- **`src/components/social/PostComposer.tsx`** (NUEVO, compartido): bottom sheet para crear un post con **foto o reel** opcionales (`accept="image/*,video/*"` + `capture` → cámara), preview removible, caption editable, categoría con chips (`POST_CATEGORIES` exportado) y botón Publicar con spinner. Sube a `media/<uid>/<ts>.<ext>` (policy OK) → `posts.insert` con `media_url`/`media_type` (sin medio = texto). El padre lo monta con `key` por apertura (estado fresco, lint-safe, sin effects de sync).
- **Sesión** (`/mi-entrenamiento`, Historial → detalle del día): el botón "Publicar en el feed" ya no publica al instante — abre el composer con caption `🔥 Terminé "…" · Día N` y categoría según disciplina; al publicar muestra link "Ver publicación". Se eliminó la lógica `publishSession` inline.
- **Racha en el Historial** (`/mi-entrenamiento`): botón "Compartir racha" en la card 🔥 → composer con `🔥 Mi racha actual: N días` + link "Ver publicación" tras publicar.
- **Racha en el feed social** (`Feed.tsx` en `/home`): botón 🔥 "Racha" en la barra sticky de tabs → consulta `trainer_routine_logs` (`log_date`) del usuario, calcula la racha (`computeStreak` + `logDates` nuevo en `src/lib/history.ts`) y abre el composer con `🔥 Mi racha actual: N días`.
- Sin migración ni deps nuevas. Lint/build OK (27 rutas).

## Cámara nativa: Foto / Reel / Galería (hecho, commit `62ac44f`)
- **`src/components/core/MediaPicker.tsx`** (NUEVO, compartido): componente con 3 inputs ocultos nativos — **Foto** (`image/*` + `capture` → cámara en modo foto), **Reel** (`video/*` + `capture` → cámara en modo video), **Galería** (`image/*,video/*` sin capture). Dos modos de render: `mode="row"` (botones inline) y `mode="popover"` (📎 → mini-sheet con las 3 opciones + cancelar).
- **`PostComposer.tsx`**: reemplazado el botón "Adjuntar foto o reel" por `MediaPicker mode="row"` — en el composer de sesión y racha ahora aparecen 3 botones: 📷 Foto / 🎬 Reel / 🖼️ Galería.
- **Chat** (`/chat/[id]` y pestaña Chat de `/mi-entrenamiento`): el botón 📎 con el input combinado se reemplazó por `MediaPicker mode="popover"` — al tocar abre un mini-sheet con las 3 opciones.
- Sin migración ni deps nuevas. Lint/build OK (27 rutas).

## Reglas / recordatorios
- NO tocar `fitpro`. Este proyecto es independiente.
- Texto en español. Identidad visual neón/dark.
- Preferir `[IO.File]` sobre `Get-Content/Set-Content` de PowerShell al manejar UTF-8 (corrompen acentos).
- Realtime de Supabase para notificaciones en vivo.
- Las Edge Functions (carpeta `supabase/functions/`) corren en **Deno**, no Node: están **excluidas del tsconfig** de Next (`exclude: ["node_modules", "supabase/functions"]`) para que el build no las type-checkee.
- **Journal de conversaciones**: al finalizar cada sesión/feature implementada (igual que se actualiza AGENTS.md), actualizar automáticamente `docs/journal/YYYY-MM-DD.md` con los 4 bloques del formato del README (Contexto / Decisiones / Implementado / Pendiente). Cada sesión agrega su propio bloque; los archivos nunca se borran.
- **Migraciones al usuario para copy-paste**: cada vez que una feature requiera migración, pasarle al usuario el SQL completo (que no tenga que abrir el archivo) para copiar y pegar en SQL Editor, al final del mensaje. Preferencia del usuario (09/09/2026).

## Estado de fases
- ✅ Fase 1 — Fundación (Next + Supabase + auth roles + theme + route groups + schema 00001)
- ✅ Fase 2 — Red social (feed real, crear contenido via Storage, discover, perfiles, notificaciones realtime)
- ✅ Fase 3 — Gestión de alumnos del profe (+ schema 00002_training)
- ✅ Fase 4 — Control de Acceso del gym (panel, memberships, QR check-in, accesos/aforo, edge function invite-member, schema 00003, mapa Leaflet)
- ✅ Fase 5 — Cobro de Cuota manual (+ pulido de planes con promos, schema 00004)
- ✅ Pulido alumnos + kiosk gym: `/mi-gimnasio` + escáner + kiosk realtime + campanita de ingresos (schema 00005, `@yudiel/react-qr-scanner`)
- ✅ Fase A — Módulo Profesor: vista alumno, planes/rutinas, historial, chat, vinculación (schemas 00013–00025)
- ⏸️ Fase 6 — Marketplace Fit
- 🔜 Empaquetar como app móvil (Play Store / App Store via Capacitor) al final del roadmap
