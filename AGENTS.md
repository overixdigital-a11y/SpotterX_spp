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

Orden de etapas para pulir/completar la app, módulo por módulo. Cada etapa termina en: **migración nueva (correr en SQL Editor juntos) + build/lint + commit + `git push` (dispara el deploy automático de Vercel, N0 correr `vercel --prod` a mano) + actualizar AGENTS.md**.

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

**Lote 4 — Consola Admin "empresa" (commit `646b3f7`, 12/09/2026):**
- **AdminShell rediseñado**: sidebar fijo (desktop ≥lg) con nav items, full-width, paleta enterprise oscuro (fondos `#070a0f`/`#0c1017`/`#121722`, bordes `#1e2530`, acento teal `#00e5c7`). Mobile: drawer sidebar + top bar.
- **Todas las páginas admin** (`/admin/*`) convertidas de cards mobile a **tablas enterprise** con densidad, bordes, fondos consistentes.
- **Rol `admin`** agregado a `AppRole` + root redirect `/admin` + `homeByRole`.
- **Migración `00029_admin_role.sql`** **CORRIDA** 15/09/2026: CHECK constraint ampliado a `('gym','profesor','alumno','admin')`, UPDATE role='admin' para Alla + DELETE gym "Lautiadmin".
- **Edge function `admin-delete-user`** (deployada): valida caller `is_admin`, borra `auth.admin.deleteUser()` (cascade profiles + children). Protege: no self-delete, no borrar otros admins.
- **`/admin/usuarios`**: botón "Eliminar" por usuario + confirmación (bloquea admins).
- **`/admin/gyms`**: botón "Planilla" por gym → importar CSV o Excel (.xlsx) vía `invite-member` batch `as_admin:true`.
- **`lib/parsePlanilla.ts`**: helper compartido para parsear CSV + XLSX (SheetJS `xlsx`).
- **Dependencia `xlsx`** (SheetJS) agregada para soporte Excel.
- **Auth guard** admin permanece: `(admin)/layout.tsx` + `(admin)/admin/` solo con `is_admin`.

**Lote 4b — Fix consola admin (commit `c562b7e`, 15/09/2026):**
- **Botón "Cerrar sesión"** en AdminShell (desktop sidebar + drawer mobile): `createClient().auth.signOut()` → `/login` (patrón SocialShell).
- **Migración `00030_admin_global_read.sql`** (PENDIENTE de correr): policies RLS "Admin: lectura global" en 8 tablas (`gym_memberships`, `gym_staff`, `gym_plans`, `gym_access_logs`, `gym_member_details`, `trainer_students`, `market_orders`, `market_order_items`) para que el admin pueda leer todos los datos (sin esto, las páginas Gyms/Profes/Market mostraban 0 o vacío).
- **Columna "Dueño"** en `/admin/gyms`: username + @ del owner vía consulta separada a `profiles`.
- **Diagnóstico RLS**: la causa de "no me deja hacer muchas cosas" era que las policies existentes filtraban por dueño/participante; el admin (sin ownership) no veía memberships, staff, students, ni órdenes.

**Lote 5 — PWA (commit `a9da20b` + merge `3d3bdb1`, 15/09/2026):**
- **`src/app/manifest.ts`** (nuevo): Web App Manifest para instalación en pantalla de inicio (name "SpotterX", display standalone, theme `#05070a`, icons 192/512/maskable).
- **`src/components/core/InstallPrompt.tsx`** (nuevo): banner "Instalá SpotterX en tu cel" con soporte Android (beforeinstallprompt) e iOS (tip "Compartir → Agregar a inicio"), dismiss con sessionStorage.
- **`src/app/layout.tsx`**: merge con remote (max-w-md removido, responsive full-width) + `appleWebApp`, `viewportFit: cover`, icons PWA + `<InstallPrompt />` montado.
- Iconos en `public/`: `icon-192.png`, `icon-512.png`, `icon-maskable-512.png`, `apple-touch-icon.png` (traídos de la copia Antigravity, textos corregidos — la copia tenía mojibake "Entrenǭ").
- **Merge con GitHub**: resueltos conflictos con commits del remote (invite-member API route, GymShell fixes, responsive layout, kiosk fixes). Se tomó la versión remota para archivos no modificados por nosotros.

**Lote 6 — Shells responsivos: Training + Market (18/09/2026, commits `3278bce` + `a0a50d1`):**
- **`TrainingShell` responsivo** (commit `3278bce`): **El área "Mis alumnos" ya no pierde la barra lateral en la web.**
  - **`DesktopSidebar`** (`hidden md:flex`, fija izq. `w-64`, mismo estilo/iconos que SocialShell): brand + badge "Profesor", nav (Alumnos · Mi zona · Market · Perfil) con active = href más específico, sección "Mi Espacio" (**Red social** `/home` · **Editar perfil**), **Cerrar sesión**.
  - Header y pill del profe → `md:hidden` (solo mobile).
  - Root: `<div className="flex min-h-screen bg-bg">` + sidebar + `<div className="flex-1 md:pl-64">{children}</div>`.
  - Los 3 mains del training (`/entrenamiento`, `zona`, `alumno/[id]`) de `max-w-full` → `mx-auto max-w-xl md:max-w-2xl lg:max-w-3xl`.
- **`MarketShell` responsivo** (commit `a0a50d1`): mismo patrón para todo el market.
  - **`DesktopSidebar`** (`hidden md:flex`, `w-64`): nav (Productos · Crear [highlight neón] · Mis ventas · Mis compras · Billetera · Carrito) + **Admin** (solo `is_admin`) + sección "Mi Espacio" (**Red social** `/home`) + **Cerrar sesión**.
  - **Pill inferior** (`md:hidden`) en market móvil: Productos · **Crear** (+) · Mis ventas · Mis compras · Carrito.
  - Root: same flex pattern con `md:pl-64`; **quitado `pb-24`** de los mains (el shell maneja el espaciado).
  - `(market)/layout.tsx`: auth check server-side (`redirect("/login")`) + `<MarketShell>` (wrap AuthProvider) — ahora el market **exige iniciar sesión**.
  - Los 8 mains del market **ensanchados**: storefront `max-w-md` → `md:max-w-2xl lg:max-w-4xl`; páginas internas → `md:max-w-2xl lg:max-w-3xl`.

**Lote 8 — Marcador v7 para diagnosticar caché (18/09/2026, commit `a2547f4`):**
- El usuario seguía viendo el feed cortado/racha invisible en el celular **después** de los fixes reales del Lote 7 (build OK). Hipótesis fuerte: **bundle/caché viejo** en el teléfono (Next/Vercel firma `_next/static/*` con `immutable` + cache largo; sin service worker en el repo, no es PWA-offline).
- **`Feed.tsx`** (al final, líneas 253-255): badge **`v7 · SpotterX`** `pointer-events-none fixed inset-x-0 bottom-20 z-[60] flex justify-center ... md:bottom-6` (autocontenido, no genera overflow).
- **Cómo verificar**: abrir la app en el celular → si **NO** aparece el badge `v7` → es caché/bundle viejo → recarga forzada / cerrar app / si está instalada como PWA, **desinstalar y reinstalar** / abrir en navegador. Si **SÍ** aparece y el feed sigue cortado → recién ahí es CSS real → diagnosticar con medición del DOM.
- **Atención docs**: AGENTS.md + journal tenían mojibake (PowerShell corrompe UTF-8 con `Get-Content`). Anclar en texto ASCII puro + reads vía herramienta `read`.

**Lote 7 — Racha visible + feed sin overflow (18/09/2026, commit `Racha-feed-overflow`):**
- En el celular, el feed desbordaba por su lateral derecho: `overflow-x-hidden` del body recortaba el excedente �?"" en vez de desplazarlo �?"" y el bot��n **Racha** (que cuelga con `ml-auto` al borde derecho de la barra sticky de tabs) quedaba fuera de pantalla e invisible.
- **`Feed.tsx`**: root `w-full` ��' `mx-auto w-full max-w-xl overflow-x-clip` (clipea el desbordamiento UNA capa antes que el body + enmarca el contenido en una columna centrada angosta en mobile).
- **Barra de tabs + Racha** (`Feed.tsx`): tabs `shrink-0`, Racha `ml-auto flex shrink-0 px-2.5 ... sm:px-3 sm:text-sm` �?"" cabe junto a "Para vos / Siguiendo" en pantallas angostas.
- **`PostCard.tsx`**: caption ��' `break-words` (URLs/palabras largas ya no empujan el ancho de la columna, causa t��pica del corte por derecha).
- Verificado: lint 0 errores + build ✓ (44 rutas).

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
- **Vercel**: proyecto `pump13/spotterx` → producción `https://spotterx-five.vercel.app`. Env vars de Supabase configuradas en production/preview/development. **LA INTEGRACIÓN GIT ESTÁ ACTIVA Y ES EL MÉTODO CANÓNICO (21/09/2026, verificado vía API):** el proyecto `spotterx` está vinculado a GitHub (`overixdigital-a11y/SpotterX_spp`, rama de producción `main`, credencial Git conectada) y **cada `git push` a `main` dispara el build + deploy automático a producción**. ⚠️ **REGLAS**:
  - **Flujo normal: `commit` → `git push` → Vercel deployea solo.** NO correr `vercel --prod` a mano (duplica el deploy: un push genera 2 builds, uno automático + uno manual; verificado en el listado de deployments del sha `46a88e0`).
  - Correr `vercel --prod --yes` **solo** si: (a) el deploy automático falló por otra razón distinta a un error de build del código, (b) se quiere redeployar sin nuevo commit (repetir el último build, ej. después de un fallo de infraestructura de Vercel), o (c) el push no se reflejó en `https://spotterx-five.vercel.app` tras ~1-2 minutos.
  - Verificación del estado de un deploy: `git push` → esperar ~1min → chequear que `git log --oneline -1` coincide con el último build en la consola de Vercel (o directamente la app en el celular). El URL de alias de producción SIEMPRE es `https://spotterx-five.vercel.app` (los URLs `spotterx-<random>.vercel.app` son builds individuales).
- **Verificar la integración Git** (si algo cambia a futuro): `vercel project inspect spotterx --json` no muestra el link; consultar la API REST con el token local (`$env:USERPROFILE\AppData\Roaming\xdg.data\com.vercel.cli\auth.json`) a `https://api.vercel.com/v9/projects/spotterx?teamId=pump13` → campo `.link` (type, repo, org, productionBranch). Deployments: `https://api.vercel.com/v6/deployments?projectId=prj_IR3ARpi5bqwE3Fzjtzd0ZwjsMniT&teamId=pump13` → `.deployments` con `state` y `meta.githubCommitSha`.
- **Supabase** (proyecto `dzalgziofiwcljgnphap`): URL `https://dzalgziofiwcljgnphap.supabase.co`. `.env.local` usa la **anon key clásica** (la publishable no lista Storage). Edge function deployada: `invite-member` (redeployada 09/09/2026 con auto-vinculación trainer_students).
- **Edge Function `invite-member`**: crea cuentas (rol alumno/profesor) con la **service role key** guardada como **secreto** `SPOTTERX_SERVICE_ROLE` en Supabase (nunca en frontend). Deploy/secretos con `supabase functions deploy invite-member` y `supabase secrets set` (CLI + access token `sbp_...`). **ATENCIÓN**: la service role key se expuso en el chat → regenerarla luego del deploy si se quiere máxima seguridad. Para crear `auth.users` desde la app solo se puede vía esta edge function (el frontend usa anon key).
- **Migraciones**: no se pueden ejecutar desde la app; el usuario las corre manualmente en **SQL Editor** de Supabase. Completadas: 00001, 00002, 00003, 00004, 00005, 00006, **00007** (`00007_gym_memberships_unique.sql` = unique `gym_id,user_id` en `gym_memberships`, necesario para el `upsert` con `onConflict` de la edge function `invite-member`; al crear el unique deja de haber duplicados de membresía por par gym+usuario), **00008** (`00008_gym_member_details.sql` = tabla `gym_member_details` para la ficha del miembro, corrida 11/09/2026), **00009** (`00009_social_polish.sql` = Etapa 1: realtime social + RLS + `post_saves`/`post_reports` + `parent_id`, corrida 11/09/2026), **00010** (`00010_profiles_extend.sql` = Etapa 2: columnas de perfil + triggers + índices, corrida 11/09/2026) y **00011** (`00011_gym_reminders.sql` = Etapa 3: tipo `vencimiento` + `notify_upcoming_expiry` + pg_cron, **corrida 12/09/2026**). Y **00012** (`00012_staff_owner_manage.sql` = policy `Staff: owner gestiona` en `gym_staff` para el buscador de personas, **corrida 07/09/2026**). Y **00013** (`00013_training_estructurado.sql` = Fase A: `trainer_plan_items` + `trainer_routines.completed_at` + policy `Messages: marca leido` + realtime training, **corrida 07/09/2026**). Y **00014** (`00014_plan_templates.sql` = plantillas de planes: `trainer_plans.is_template` + índice, **corrida 07/09/2026**). Y **00015** (`00015_trainer_gym_requests.sql` = Fase A A5: tabla `trainer_gym_requests` (postulación profe↔gym con aprobación del dueño), RLS + triggers de notificación (`solicitud_staff`, `staff_aprobado`), `trainer_gyms.availability`, extendidos types en `notifications`, realtime; **corrida** 07/09/2026). Y **00016** (`00016_routines_structured.sql` = Fase A: tablas `disciplines` (12 disciplinas), `trainer_routine_items` (ejercicios por día con `data` jsonb) y `trainer_routine_logs` (logs de progreso jsonb) + RLS + realtime; columnas `profiles.disciplines`, `trainer_routines.discipline`/`custom_fields`; **corrida** 09/09/2026). Y **00017** (`00017_routine_logs_unique.sql` = constraint único `(item_id, log_date)` en `trainer_routine_logs`, necesario para el `upsert` del alumno — **corrida** 09/09/2026). Y **00018** (`00018_exercises_catalog.sql` = catálogo global de ejercicios: tabla `exercises` (name + disciplina sugerida + created_by) con RLS (todos leen, autenticados agregan), unique `lower(name)`, realtime, y seed de ~145 ejercicios por disciplina — **CORRIDA** 09/09/2026, verificada: 118 ejercicios). Y **00019** (`00019_exercises_muscle_es.sql` = grupo muscular `muscle` en `exercises` + backfill de los ejercicios existentes + lote de ejercicios en español además de los de inglés — **CORRIDA** 09/09/2026, verificada: 156 ejercicios, 155 con `muscle`). Y **00020** (`00020_dietas.sql` = dietas por alumno: `trainer_plans.assigned_at` (null = borrador, con fecha = asignada al alumno) + `trainer_plan_items.data jsonb` (`{ meal, qty, unit, kcal, protein_g, fat_g, carbs_g }`) + índice + backfill `assigned_at=now()` en planes no-plantilla — **CORRIDA** 09/09/2026, verificada: columnas `assigned_at`/`data` presentes, backfill aplicado). Y **00021** (`00021_foods_catalog.sql` = catálogo de alimentos con macros por 100g: tabla `foods` (name, category, kcal, protein_g, fat_g, carbs_g, created_by) + RLS + unique `lower(name)` + realtime + seed de ~100 alimentos comunes — **CORRIDA** 09/09/2026, verificada: 87 alimentos, 7 categorías). Y **00023** (`00023_more_foods.sql` = lote amplio del catálogo: +170 alimentos en 6 categorías nuevas — Panadería y tostadas, Bebidas, Snacks y ultraprocesados, Comidas preparadas, Conservas, Condimentos y especias — y ampliaciones en las existentes; `ON CONFLICT (lower(name)) DO NOTHING`, con `unit_grams` en los que van por unidad; total ≈ 257 — **CORRIDA** 09/09/2026, verificada: 257 alimentos, 13 categorías (Frutas 32, Proteínas 31, Carbohidratos 28, Verduras 27, Grasas y frutos secos 24, Lácteos 23, Comidas preparadas 19, Bebidas 17, Snacks y ultraprocesados 15, Panadería y tostadas 13, Condimentos y especias 11, Conservas 11, Otros 6)). Y **00024** (`00024_chat_attachments.sql` = columnas `messages.attachment jsonb` + `content` nullable para adjuntos de fotos/videos en el chat — **CORRIDA** 10/09/2026, verificada: `attachment` presente y `content` nullable). Y **00025** (`00025_gym_sync_students.sql` = triggers en `gym_memberships` y `gym_staff` que sincronizan automáticamente `trainer_students source='gym'` (solo `profesor_invitado`), con backfill — **CORRIDA** 10/09/2026). Y **00026** (`00026_market.sql` = marketplace: `market_products`, `market_orders`, `market_order_items`, `market_reviews`, RLS, índices, realtime, RPC `market_checkout`, trigger `notify_market_order`, constraint `'orden'` en notifications — **CORRIDA** 12/09/2026). Y **00027** (`00027_wallet_admin.sql` = billetera + admin: `profiles.is_admin`, `platform_config`, `wallets`, `wallet_transactions`, RPCs wallet — **CORRIDA** 12/09/2026). Y **00028** (`00028_admin.sql` = admin panel: profiles.is_banned, post_reports.status/resolved_by, RPCs admin_global_stats, admin_set_verified, admin_toggle_ban, admin_delete_post, admin_resolve_report, admin_delete_exercise, admin_delete_food, _assert_admin helper - **CORRIDA** 12/09/2026). Y **00029** (`00029_admin_role.sql` = CHECK de role ampliado a `('gym','profesor','alumno','admin')` + `UPDATE role='admin'` para Alla + DELETE gym "Lautiadmin" - **CORRIDA** 15/09/2026; archivo RECREADO en el repo 25/09/2026, commit `3a0ef3b`, solo registro historico). Y **00030** (`00030_admin_global_read.sql` = policy "Admin: lectura global" en 8 tablas - **CORRIDA**, verificada 25/09/2026, >=8 policies presentes). Y **00031** (`00031_profesor_profile.sql` = columnas de profe certifications/hourly_rate/specialties/portfolio/availability/years_experience + `trainer_reviews` + RPCs get_trainer_stats/upsert_trainer_review + realtime - **CORRIDA**, verificada 25/09/2026). Y **00032** (`00032_public_profesor_visits.sql` = policy "TS: lectura publica" + RPC get_trainer_workplaces + columnas notifications.ref_id/message - **CORRIDA**, verificada 25/09/2026). Y **00033** (`00033_gyms_address_split.sql` = street/street_number/postal_code/province en gyms y trainer_gyms - **CORRIDA**, verificada 25/09/2026). Y **00034** (`00034_trainer_gyms_features.sql` = trainer_gyms.disciplines/description/notes - **CORRIDA** 23/09/2026). Y **00035** (`00035_notifications_type_orden.sql` = constraint notifications con lista acumulativa + 'orden' - **CORRIDA** 23/09/2026). Y **00036** (`00036_spotter_shop.sql` = Lote 25: sin comision, market_publish/get_publish_quote/admin_set_publication_config/admin_set_user_free_limit/admin_publish_revenue, profiles.shop_free_limit, tipo 'publish' en wallet_transactions - **CORRIDA** 25/09/2026). **TODAS las migraciones 00001-00036 estan aplicadas en la DB** (verificado 25/09/2026 con query de marcadores). **00037 ELIMINADA del repo** (flujo de retiros sacado en Lote 27: si se corrio, inofensiva; si no, no correrla). **00038_payment_config.sql PENDIENTE de correr** (Lote 27: publish_deposits + report_deposit/admin_list_deposits/admin_approve_deposit/admin_set_payment_config + `pago_publicacion`).

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

**Lote 9 - Confirmar que la cache del celular estaba CERRADA (21/09/2026, commits `3951d95` y `3966169`, badge v9-3951d95-ASCII):** el celular imprimio `v9-3951d95-ASCII` => llego el bundle NUEVO => la cache vieja NO era la causa del feed cortado (un bundle viejo no puede imprimir el label del Lote 9). `doc 423/423` => documento sin desborde (fix de raiz del Lote 7/8 confirmado en el celular).

**Lote 10 - Excluir el propio badge del escaneo (21/09/2026, commit `7c6ba29`, badge v10-L10-ASCII):** el offender #1 que reportaba el scan era el PROPIO badge (span con `truncate` siempre cumplia scrollWidth > clientWidth = auto-ruido). Se le agrego `data-med="1"` a los 2 divs de badge y `Feed.tsx` L45 salta `el.closest("[data-med]")`. Con eso el scan del feed queda limpio.

**Lote 11 - El feed no se achicaba: root con `max-w-xl` (576) sentado sobre un ancestro de 544, mas ancho que la pantalla real 423 => posts cortados por derecha (21/09/2026, commit `3edf2a0`, badge v11-L11-ASCII, build 0 errores, deploy spotterx-five.vercel.app):** el usuario pidio "hace las publicaciones mas chicas como cuando entro en la publicacion que se achica y se ve mejor". El detalle usa `main mx-auto max-w-full` => se achica y se ve bien; el feed usaba root `mx-auto w-full max-w-xl overflow-x-clip` (ancho 576) sobre un ancestro de 544 => mas ancho que la pantalla real de 423 => posts cortados por derecha. FIX: el root del feed pasa a `mx-auto w-full max-w-[92vw] overflow-x-clip` => el feed se cina a 92vw de la pantalla y se centra, igual que el detalle. CONFIRMADO POR EL USUARIO EN EL CELULAR: "listo quedo bien ahora se achica y se ve como el detalle". Con eso el offender real queda resuelto.

**Lote 12 - Quitar badge + medidor del feed, produccion limpia (21/09/2026, commit `PENDIENTE`, build 0 errores, deploy spotterx-five.vercel.app):** con la cache CERRADA (Lote 9) y el fix real de raiz aplicado (Lote 11), el badge/medidor cumplio su ciclo y se elimina del `Feed.tsx` (edicion byte-a-byte: se borran los 2 divs de badge + comentarios de marcador v8-v11, conservando el mojibake del resto del archivo). El feed queda limpio sin marcadores.

**Lote 13 - Ver a mi profesor en el perfil del alumno (21/09/2026, sin migracion, lint 0 errores, build OK 44 rutas, deploy spotterx-five.vercel.app):** en `src/app/(social)/perfil/page.tsx`, dentro de la seccion de accesos del alumno (junto a "Mi gimnasio" y "Marketplace"):
- **Card "Ver a mi profesor"** (icono `GraduationCap`, mismo estilo que "Mi gimnasio") → `/mi-entrenamiento` (la vista donde el alumno ve las **rutinas y planes que le manda su profe**). Visible siempre para rol `alumno`.
- **Botón secundario "Ver perfil de {profeName}"** → `/perfil/[username]` (texto pequeño muted, hover neon), visible solo si el alumno tiene un profe vinculado: fetch en `useEffect` de `trainer_students` por `student_id` → ids de trainers → `profiles` (username, full_name) → primer profe (`profeUsername`/`profeName`). Patron ya usado en `mi-entrenamiento`; **no** se usa `profesor_id` (no tipado ni en flujos reales).
- Sin `profesor_id` el card principal igual aparece y `/mi-entrenamiento` muestra el buscador de entrenador.
- Decisión del usuario (21/09): "ver a mi profesor" = ver las rutinas/planes que manda el profe → `/mi-entrenamiento`; el perfil público del profe es el acceso secundario. Journal `docs/journal/2026-09-21.md`.

**Lote 14 - Experiencia GPS y Mapas Vibrantes Nivel 1 (21/09/2026, sin migración, lint 0 errores, build OK 44 rutas):**
- **Utilidades geográficas compartidas** (`src/lib/geo.ts`): `haversineDistance` (fórmula de Haversine en km), `formatDistance` (metros para <1 km, km con 1 decimal para ≥1 km), `getDirectionsUrl` (enlace universal a Google Maps/Apple Maps/Waze) y `DARK_MAP_TILES` (CartoDB Dark Matter para Leaflet con atribución OSM).
- **Mapas en Modo Oscuro**: reemplazados los tiles blancos deslumbrantes de OpenStreetMap por CartoDB Dark Matter en `GymMap.tsx`, `buscar/page.tsx` y `perfil/[username]/page.tsx`, con fondo base `#0c1017` para evitar parpadeos blancos.
- **Pin de ubicación actual y radar**: en `/mi-entrenamiento/buscar`, al activar "Mi zona", se añade el marcador `userIcon` (radar pulsante cyan) indicando *"📍 Tu ubicación actual"*, con zoom inteligente a nivel calle/barrio (`zoom: 13`).
- **Distancias reales y ordenamiento por cercanía**: en `/mi-entrenamiento/buscar`, calcula la distancia a cada profesor/zona. Si el usuario activa su GPS, la lista se reordena automáticamente de más cercano a más lejano y muestra el chip de proximidad (ej. `A 1.2 km`, `A 850 m`).
- **Navegación directa "Cómo llegar"**: botones agregados en los popups de Leaflet y en las tarjetas de profesores/gimnasios (`GymMap.tsx`, `buscar/page.tsx`, `perfil/[username]/page.tsx`) abriendo la ruta en la app de mapas preferida del celular.

**Lote 15 - Fix watermark de CartoDB (tiles oscuros Esri sin API key) (21/09/2026, commit `db37179`, lint 0 errores, build OK, deploy automático por push):**
- **Problema**: los tiles oscuros de CartoDB (`{s}.basemaps.cartocdn.com/dark_all/...`) ahora muestran una marca de agua "API KEY REQUIRED" (carto.com/basemaps/apikey) porque CartoDB exige API key para su servicio gratuito.
- **Fix**: en `src/lib/geo.ts`, la constante `DARK_MAP_TILES` ahora usa el servicio público **Esri World Dark Gray Canvas** (`https://{s}.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}`, subdomains `abcd`, atribución Esri) que **no requiere API key**. Los 3 mapas que lo importan (`GymMap.tsx`, `buscar/page.tsx`, `perfil/[username]/page.tsx`) quedan arreglados con solo este cambio.
- **Flujo deploy validado**: este lote se pusheó (`46a88e0..db37179`) y el deploy **automático de Vercel** (integración Git) lo publicó solo (READY) sin correr `vercel --prod`. Confirmado el flujo documentado en "Deploy / Producción".

**Lote 15b - Fix tiles Esri {s} (el mapa no cargaba) (21/09/2026, commit `96172d0`, lint 0 errores, build OK, deploy automático):**
- **Problema**: tras el Lote 15 (Esri Dark Gray), el mapa **no cargaba**. Causa: la URL usaba `{s}.arcgisonline.com` (subdominios a/b/c/d) pero **Esri solo responde en `server.arcgisonline.com`** — verificado por HTTP: `a.arcgisonline.com/...` falla, `server.arcgisonline.com/...` devuelve 200 (image/jpeg).
- **Fix**: en `src/lib/geo.ts`, `DARK_MAP_TILES.url` pasa a `https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}` (sin `{s}.`) y se elimina `subdomains: "abcd"` (Leaflet solo lo usa si la URL trae `{s}`). Los 3 mapas (`GymMap.tsx`, `buscar/page.tsx`, `perfil/[username]/page.tsx`) quedan corregidos con solo este cambio.
- **Lección**: al usar tiles de Esri, NO usar subdominios `{s}` (a diferencia de OSM/Carto). `server.arcgisonline.com` es el único host.
- Deploy validado por API (sha `96172d0` READY, push automático).

**Lote 16 - Geocodificar la direccion del gym (22/09/2026, commit `a749c3f`, lint 0 errores, build OK, deploy automatico):**
- **Problema**: el usuario puso la direccion del gym en el panel pero el mapa seguia apuntando a otro lado. Causa: `saveGym` NUNCA tocaba `latitude/longitude`; solo el boton GPS (geolocalizacion del dispositivo) las seteaba. Escribir la direccion guardaba texto plano, sin coordenadas -> el pin quedaba donde se capturo el GPS (PC/IP), no en el comercio.
- **Helper nuevo** (`src/lib/geo.ts` `geocodeAddress`): geocodifica via **Nominatim** (OpenStreetMap, gratis, SIN api key, header `User-Agent` propio). Verificado: `"Av. Corrientes 1234, Buenos Aires"` -> `-34.6044, -58.3958`. Retorna `{lat,lng,displayName} | null`.
- **Opcion A - geocodificar al guardar** (`gimnasio/page.tsx` `saveGym`): si NO se uso GPS en la sesion (`gpsOverride`) y hay direccion, geocodea `direccion + ciudad` y agrega `latitude/longitude` al payload del insert/update. Si falla, conserva las coords existentes (no rompe).
- **Opcion B - boton "Buscar direccion en el mapa"** (`gimnasio/page.tsx` `geocodeForm`): geocodea el form y actualiza el pin AL INSTANTE (persiste si el gym ya existe, preview si no, mensaje de exito/error). `geoMsg` muestra feedback.
- **Mapa** (`mapCoords`): usa `previewCoords ?? coords del gym`; placeholder actualizado mencionando ambas opciones. El boton GPS setea `gpsOverride` y limpia el preview.
- **Precedencia (decision)**: GPS de la sesion gana sobre la geocodificacion al guardar; sin GPS en la sesion, la direccion geocodifica sola en cada guardado.
- **Nota**: el token de la API de Vercel expiro (expira ~24h); `npx vercel whoami` lo refresca antes de verificar deployments por API.
- 3 consumidores de `gyms.latitude/longitude` (panel, checkin, perfil publico) se benefician sin cambios: el fix del panel actualiza las coords en la DB.

**Lote 17 - Direccion dividida (calle/altura/CP/provincia/ciudad) + fix del mapa que no se movia (22/09/2026, commit `a3ecce3`, lint 0 errores, build OK, deploy automatico):**
- **Fix raiz de "sigue sin funcionar"**: en react-leaflet el prop `center` de `MapContainer` solo vale al montar; cambiar las coords movia el marker pero NO la vista del mapa (quedaba fuera de pantalla -> parecia que el pin no se movia). Nuevo `MapController` interno (`useMap()` + `useEffect` en `[latitude,longitude]`) que hace `map.setView([lat,lng], max(zoom,14))` en `GymMap.tsx`. Aplica a panel del gym y perfil publico.
- **Campos divididos**: migracion `00033_gyms_address_split.sql` (PENDIENTE de correr en SQL Editor) agrega `street`, `street_number`, `postal_code`, `province` (text) a `gyms` y `trainer_gyms`. Se conservan `address`/`city`: **no se rompe** checkin, mi-gimnasio ni perfil publico (leen `address`).
- **`src/lib/geo.ts`**: `geocodeAddress(parts | string)` ahora usa parametros **estructurados** de Nominatim (`street`=calle+altura, `city`, `state`=provincia, `postalcode`, `countrycodes=ar`) mucho mas preciso que texto libre; cae a `q=` si no hay calle. Nuevo `formatAddress(parts)` que autocompleta `address` = "Calle Altura, Ciudad, Provincia, CP".
- **`/gimnasio`**: form con Calle / Altura / CP / Provincia / Ciudad (+ Aforo). Guardar persiste los 5 campos + computa `address`. Geocode con campos divididos. GPS y "Buscar direccion en el mapa" intactos.
- **`/entrenamiento/zona` (profe)**: mismo form dividido en "Agregar gimnasio manual" + boton **"Buscar direccion en el mapa"** (antes solo GPS). Las **multiples zonas ya existian** (`trainer_gyms` = 1 fila por lugar; cada "Agregar gimnasio manual" agrega otr). `address` autocomputado para la lista y el buscador del alumno.
- Geocoder estructurado verificado por HTTP de antemano + CORS OK (`Access-Control-Allow-Origin: *`).
- Docs journal `docs/journal/2026-09-22.md`.

**Lote 18 - Profe: editar ubicaciones + caracteristicas por ubicacion (22/09/2026, commit `6d25128`, lint 0 errores, build OK, deploy automatico):**
- **Edicion de ubicaciones** en `/entrenamiento/zona`: el icono lapiz de una zona en "Mis lugares" la carga en el form (nombre, 5 campos, horarios, coords) -> "Guardar cambios" hace `update` por id; boton "Cancelar edicion" (el X sigue para borrar).
- **Caracteristicas por ubicacion** (`trainer_gyms`, migracion `00034_trainer_gyms_features.sql` **CORRIDA** 23/09/2026): columnas `disciplines text[]`, `description text`, `notes text`. Form "Agregar gimnasio manual" con chips multiselect de disciplinas (labels de `DISCIPLINES` en `src/lib/disciplines.ts`), textarea "Descripcion" y textarea "Notas/condiciones". Los cards de "Mis lugares" muestran chips + descripcion + notas (📌).
- **Perfil publico** (`perfil/[username]`): RPC `get_trainer_workplaces` (00034) ahora devuelve `disciplines`/`description`/`notes` de las zonas; los popups del mapa y los cards de "Lugares donde trabaja" los muestran.
- **Buscador de profes** (`mi-entrenamiento/buscar`): select ampliado + popup y card muestran nombre + chips de disciplinas + descripcion + notas de cada zona.
- El nombre de la ubicacion ya se mostraba en las 3 vistas (Lote 17); este lote agrega editar + caracteristicas.

**Lote 18b - Perfil del profe: entrada a "Mis lugares" + gym contratante visible (22/09/2026, commit `f4393ed`, lint 0 errores, build OK, deploy automatico):**
- El usuario no encontraba el lapiz porque vivia dentro de `/entrenamiento/zona` (escondido en el menu), y el perfil propio no mostraba el gym que lo contrato.
- **`/perfil` (profesor/admin)**: card **"Mis lugares de trabajo"** (icono MapPin, ember) → `/entrenamiento/zona`; seccion **"Lugares donde trabajo"** que lista el gym que lo contrato (icono Store neon, via RPC `get_trainer_workplaces` con `p_trainer_id: userId`) y sus zonas personalizadas (icono MapPin ember), cada fila con lapiz → `/entrenamiento/zona`; empty state "Agrega tu primer lugar" si no hay ninguno. Link **"Ver mi perfil publico"** → `/perfil/<username>`.
- Sin migracion: se reutiliza la RPC existente (funciona aunque 00034 aun no se corrio; solo muestra nombre/ciudad).

**Lote 19 - Provincia con desplegable + Ciudad con buscador autocompletado (22/09/2026, commit `a9d185f`, lint 0 errores, build OK 44 rutas, deploy automatico):**
- Componente compartido **`src/components/gyms/ProvinceCityFields.tsx`** (client): **Provincia** = `<select>` con `ARG_PROVINCIAS` (las 24 provincias+ CABA, nombres que acepta el geocoder); **Ciudad** = buscador con autocompletado **Nominatim** (`countrycodes=ar`, debounce 300ms) que al elegir una localidad autocompleta provincia + codigo postal + lat/lng (pin del mapa). Prop `withLabels` para el estilo del panel del gym. Fuera-click cierra el dropdown.
- `src/lib/geo.ts`: `ARG_PROVINCIAS` (24), `CitySuggestion`, `autocompleteCity(q)` (limit 6, `accept-language=es`, User-Agent propio `NOMINATIM_UA` reutilizado en `geocodeAddress`).
- Aplicado en **`/entrenamiento/zona`** (reemplaza el grid provincia/ciudad del form, con/editar) y **`/gimnasio`** (con labels; el pick devuelve coords y setea `previewCoords`).
- **Fix de visibilidad del error en `saveZone`** (`zona/page.tsx`): si la base rechaza el guardado (antes se limpiaba el form en silencio) ahora muestra `No se pudo guardar: <mensaje>` en rojo (`saveError`), no limpia el form ni cierra.
- **Migracion `00034` CORRIDA** (23/09/2026): el guardado de lugares con disciplinas/descripcion/notas ya funciona y las 3 vistas las muestran (Mis lugares, perfil publico, buscador de profes).

**Lote 19b - Buscador de gimnasios de internet en "Mi zona" (22/09/2026, commit `b00e239`, lint 0 errores, build OK, deploy automatico):**
- El buscador de "Postulate" solo buscaba gimnasios **registrados en la app** (`gyms`). El usuario pidio encontrar gimnasios que existan de verdad en internet.
- **`src/lib/geo.ts`**: `WebGymSuggestion` + `searchGymsWeb(q, city?)` via **Nominatim OSM** (gratis, sin API key): con `city` usa el query estructurado `amenity=gym&city=...&countrycodes=ar&limit=50` (probado: 37 gimnasios reales en Cordoba) y filtra por nombre sin importar mayusculas; sin city cae a `q=` libre filtrando por tipos (`fitness_centre`, `sports_centre`, `gym`...) o nombre con gym/fitness/crossfit/club. Errores -> `[]`.
- **`/entrenamiento/zona`**: nueva tarjeta **"Buscar gimnasios en internet"** (borde neon, icono Globe, input con debounce 400ms + spinner). Resultados con nombre + ciudad y boton **"Usar"** (`applyWebGym`) que abre el form "Agregar gimnasio manual" **precargado** (nombre + ciudad del resultado + lat/lng del pin). Nota: usa `form.city` (la del form manual) para acotar la busqueda; nota al pie "Datos de OpenStreetMap - revisalos antes de guardar".
- Sin migracion y sin tocar el buscador de "Postulate" ni `/gimnasio`.

**Lote 19c - Botones "Ubicar en el mapa" + leyenda/Ver todos (22/09/2026, commit `811babf`, lint 0 errores, build OK, deploy automatico):**
- **Componente nuevo `src/components/gyms/ZoomToPoint.tsx`**: boton que con `useMap()` (react-leaflet) hace `map.setView([lat,lng], max(zoom,15))` para reencuadrar el mapa en ESE pin sin salir de la app. Estilo por prop `className`, icono `LocateFixed`.
- **Popup del perfil publico (`/perfil/[username]`, "Lugares donde trabaja")**: cada popup (gym y zona) ahora tiene DOS botones lado a lado (`flex gap-1.5`, mismo ancho `flex-1`): **"Ubicar en el mapa"** (ghost, borde neon/ember segun tipo) + **"Como llegar"** (a Google Maps con la ruta, neon para gym / ember para zona).
- **Overlay sobre el mapa del perfil publico** cuando hay **>1 lugar con coords**: leyenda arriba-centro (no clicable) "Aleja el mapa para ver todos los lugares" + boton **"Ver todos"** arriba-derecha (`FitAllButton` local, `L.latLngBounds(points).pad(0.25)` + `fitBounds` maxZoom 14). El wrapper del mapa paso a `relative`.
- **Popup del buscador de profes (`/mi-entrenamiento/buscar`)**: mismo boton "Ubicar en el mapa" junto a "Como llegar" en la fila Perfil/Chat/Como llegar (estilo compacto de ese popup).
- `GymMap` (panel del gym) NO se toca (decision del usuario). Sin migracion.

**Lote 19c hotfix - `useMap` fuera del contexto rompia el perfil publico del profe (22/09/2026, commit `42955e3`, lint 0 errores, build OK, deploy automatico):**
- **Sintoma**: "This page couldn't load / Reload / Back" en `/perfil/<username>` del profe (Ariel Loquindoli) visto desde el alumno. Evaluaba 500 en produccion (SSR) solo para profes con MAS de 1 lugar con coords. Causado por el Lote 19c.
- **Causa raiz**: `FitAllButton` (usa `useMap()` de react-leaflet) quedo como **hermano de `<MapContainer>`** (afuera), no hijo. `useMap()` lee el contexto `LeafletContext` que SOLO existe debajo de `<MapContainer>`; fuera de el es `null` → TypeError al renderizar (SSR + client) → pagina entera caia.
- **Lecion**: cualquier componente que use `useMap()`/`useMapEvents()` debe ir SIEMPRE como hijo (descendiente) de `<MapContainer>`, no como hermano. Los `ZoomToPoint` (dentro de `<Popup>`) estaban bien; la leyenda flotante (sin hooks) puede quedar afuera.
- **Fix**: `<FitAllButton>` movido dentro de `MapContainer` (justo despues de `<TileLayer>`), manteniendo la condicion `withCoords.length > 1`. El resto del Lote 19c intacto. Deploy READY sha `42955e3`.

**Lote 21 - Fix desborde lateral del mapa Leaflet en el celular (23/09/2026, commit `45f6a30`, lint 0 errores, build OK, deploy automatico):**
- **Diagnostico** (badge temporal v2 en el perfil publico del profe): `doc:0px` (la pagina NO desborda) + `clip:688px div.leaflet-container` (el MAPA quedaba ~688px interno, mas ancho que el telefono) + `right:808px img.leaflet-marker-icon` (los pines a 808px a la derecha, fuera de pantalla). El wrapper `overflow-hidden` recortaba ese excedente -> hacia que "no se vea todo" en las secciones de lugares, sin overflow del documento.
- **Causa raiz**: leaflet mide su contenedor UNA sola vez al montar; si ese momento el ancho es distinto al real (SSR/layout/transiciones), el mapa queda interno mas ancho y no se re-mide.
- **Fix**: componente compartido nuevo **`src/components/gyms/LeafletAutoResize.tsx`** (usa `useMap()`, renderiza `null`): llama `map.invalidateSize()` a los 300ms y 900ms de montar y en cada `window.resize`. Se inserto como PRIMER hijo de cada `MapContainer`:
  - `perfil/[username]` (el que rompia, seccion "Lugares donde trabaja"/"mis lugares").
  - `mi-entrenamiento/buscar` (mapa de profes).
  - `GymMap.tsx` (cubre panel gym + checkin, de prevencion).
- **Badge de diagnostico eliminado** (estado `meas`, efecto de medicion y chip flotante) del perfil publico; el archivo queda limpio.
- **Leccion**: si un mapa Leaflet se ve recortado/desplazado en mobile (pero la pagina no desborda, `doc:0`), es un problema de tamano interno del mapa -> `invalidateSize()`. Verificar ademas con el marker en el escaneo: `right`>viewport = pines fuera.

**Lote 22 - Blindaje del mapa leaflet (clamp ancho real + ResizeObserver) (23/09/2026, commit `ad89e28`, lint 0 errores, build OK, deploy automatico):**
- El Lote 21 (`invalidateSize` simple) NO basto: el usuario reporto corte lateral identico en el perfil publico del profe y desde el alumno ("ver mi profesor"). Con layout por bloques el mapa no puede medir 688px si la pagina no desborda => lo mas probable: el mapa se monta/mide antes de que el layout final se asiente (workplaces llegan async), o algun ancestro flex/grid empuja el ancho.
- **`LeafletAutoResize.tsx` reforzado**:
  - **Clamp explicito**: `container.style.width = min(parent.clientWidth, innerWidth) + "px"` + `maxWidth:100%` antes de `invalidateSize()` (aferra el mapa al ancho REAL del padre; si en el proximo frame el ancho cambia, fuerza invalidateSize).
  - **ResizeObserver sobre el padre** -> re-ajusta ante CUALQUIER cambio de layout (sidebar, datos tardios, hint).
  - Retries escalonados 0/60/300/900/2000/3500ms para pillar el montaje tardio (mapa monta recien cuando `workplaces` resuelve).
- **Wrapper del mapa** en `perfil/[username]`: `relative overflow-hidden` -> `relative z-0 w-full min-w-0 max-w-full overflow-hidden` (defensivo ante ancestros flex/grid).
- Si aun asi el celular lo muestra cortado: el paso siguiente es un badge v3 de precision (viewport + main + wrapper + leaflet client/scrollWidth + rect de un marker + zoom + token de version del bundle) para dictar el dato exacto (`Paso 2` del Lote 22).

**Lote 22 - Badge D3 de precision -> causa raiz (23/09/2026, commit tmp `bb64532`):**
- Badge v3 en el perfil publico midio: `D3 423px d423/b576 m576/sw576 w510/sw510 l1423/sw1155 out765px`. Dicifrado:
  - `main` y `body` en 576px (= tope de `max-w-xl`) con viewport de 423 -> **153px de corte a la derecha** (recortado por `overflow-x-hidden` del body). El documento NO desborda (`d423`) por eso `doc:0` de badges v1/v2.
  - `.leaflet-container` media 1423px (los panes gigantes) -> era el contenido que estiraba todo.

**Lote 23 - Fix raiz del corte lateral: min-width:auto en los shells flex (23/09/2026, commit `1e8f8d8`, lint 0 errores, build OK, deploy automatico, CONFIRMADO por el usuario en el celular):**
- **Causa raiz**: en los 3 shells (`SocialShell`, `TrainingShell`, `MarketShell`) el contenido vive dentro de `<div className="flex-1 ...">` (flex item con `min-width:auto` por defecto) -> el div NO puede encoger por debajo del ancho minimo de su contenido. El mapa Leaflet (y textos largos) estiraban el div hasta el cap `max-w-xl` del `main` (576) -> 576 en un telefono de 423 = 153px cortados a la derecha.
- **Fix**:
  - `flex-1` -> `flex-1 min-w-0` en los 3 shells (`SocialShell.tsx`, `TrainingShell.tsx`, `MarketShell.tsx`).
  - `main` de `SocialShell`: `mx-auto min-h-screen max-w-xl ...` -> `mx-auto min-h-screen w-full min-w-0 max-w-xl ...` (contenido que ya no puede estirarlo).
  - `div` de contenido de `TrainingShell` -> `w-full min-w-0`.
  - Textos largos del perfil publico (certificaciones, disponibilidad) -> `flex flex-wrap`; website -> `break-all`, para que al estrechar a 391px no generen cortes nuevos dentro de las cards.
- **Leccion**: un flex item con `min-width:auto` (default) NO encoge por debajo del min-content de su contenido; con hijos como mapas Leaflet (panes absolutos de cientos de px) o textos largos, el contenedor se estira y el body `overflow-x-hidden` RECORTA el excedente. En app mobile-first con maps, SIEMPRE poner `min-w-0` en los wrappers `flex-1` + `w-full min-w-0` en el `main`.
- **Diagnostico rapido**: si una pagina se corta por derecha pero `documentElement.scrollWidth == viewport` (`doc:0`), medir `body.scrollWidth` y `document.querySelector("main").clientWidth`: si `main` == su `max-w-*`, es el bug de `min-width:auto` (no del mapa).
- Badge D3 eliminado (commit de limpieza `ce07da5`); el fix de `LeafletAutoResize` (Lote 22) queda en el codigo.

**Lote 24 - Fix constraint `notifications_type_check`: faltaba 'orden' y el checkout fallaba (23/09/2026, migracion `00035`, lint 0 errores, build OK, deploy automatico):**
- **Sintoma**: al simular una compra, `new row for relation "notifications" violates check constraint "notifications_type_check"`. El trigger `notify_market_order` (00026) inserta `type='orden'` al crear la orden con `market_checkout`, y la CHECK lo rechazaba.
- **Diagnostico**: `select pg_get_constraintdef(oid) from pg_constraint where conname='notifications_type_check';` devolvio la lista de 00015 (`pulse, comment, follow, message, checkin, vencimiento, solicitud_staff, staff_aprobado`) SIN `'orden'`. => en algun momento se re-ejecuto una migracion vieja (00005/00011/00015) en el SQL Editor DESPUES de la 00026, y pisó el tipo agregado.
- **Causa raiz estructural**: la constraint se re-crea en CADA migracion (00005, 00011, 00015, 00026) con `drop constraint` + `add constraint`, y cada version vieja trae SOLO su lista del momento. Re-correr una vieja destruye los tipos nuevos. NO son idempotentes entre si.
- **Fix**: migracion nueva `00035_notifications_type_orden.sql` que re-crea la constraint con la LISTA ACUMULATIVA COMPLETA: `('pulse','comment','follow','message','checkin','vencimiento','solicitud_staff','staff_aprobado','orden')`. Idempotente (`drop constraint if exists`).
- **Leccion**: las migraciones de `notifications` que tocan la constraint deben re-crearla siempre con TODOS los tipos existentes; si un dia se agrega un tipo nuevo, el ALTER tiene que traer la lista completa, y avisar al usuario que NO re-corra migraciones viejas del notifications en SQL Editor (pisan los tipos posteriores).
- Corrida por el usuario 23/09/2026; checkout verificado. Sin cambios de frontend (el trigger ya usaba 'orden' correctamente).

**Lote 25 - Rebrand SpotterShop + monetizacion por publicaciones (25/09/2026, commit `f4b859b`, lint 0 errores, build OK 44 rutas, push deploy automatico):**
- **Rebrand**: el marketplace pasa a llamarse **SpotterShop** (SOLO labels; las rutas `/market/*` NO cambian). Tocado: h1 en `/market`, card en `/perfil`, pill "Shop" en `MarketShell`, nav "SpotterShop" en `AdminShell` y `TrainingShell`, texto notif `orden`, "Volver a SpotterShop" en el panel.
- **Nuevo modelo de monetizacion (decision del usuario 25/09)**: se ELIMINA la comision 1% por venta. Se cobra **por publicacion** una vez agotado el cupo de publicaciones gratis: cupo global **3** (default) y precio **$100** (default), ambos configurables en `/market/admin`. El vendedor cobra el 100% de cada venta (sin comision).
- **Cupo por publicacion**: cuentan solo las publicaciones `active` + `paused` (`sold` y `inactive` liberan cupo). Cada publicacion activa registra su costo (`wallet_transactions type='publish'`) pero el debito es ONE-TIME por publicacion (accelerado con la config del momento). **Sin saldo -** la RPC `market_publish` lanza "Saldo insuficiente"; `/market/crear` muestra un banner con link a la billetera.
- **Override individual**: columna `profiles.shop_free_limit int` (NULL = usa el cupo global). El admin lo ajusta por publicador (0 = paga todo; el cupo se "transfiere" como premio a los top publicadores). El chip del publicador marca "ajustado" si tiene override.
- **Config global** en `platform_config` con keys `free_publishes` (int, default 3) y `publish_price` (numeric, default 100).
- **Migracion `00036_spotter_shop.sql`** (PENDIENTE de correr por el usuario en SQL Editor): CHECK de `wallet_transactions` re-creada con la lista ACUMULATIVA completa + `'publish'`; 4 RPCs security definer — `market_publish(p_name,p_description,p_price,p_category,p_condition,p_stock,p_location,p_images)` (valida cupo/saldo y debita), `get_publish_quote()` (free_limit/free_left/price/balance/in_shop/will_pay), `admin_set_publication_config(p_free_count,p_price)` (ambos aceptan NULL = no tocar), `admin_set_user_free_limit(p_user_id,p_free_limit)` (NULL = global) — + RPC `admin_publish_revenue()` (jsonb `{total,count}`): el admin NO lee `wallet_transactions` ajenas por RLS, por eso el KPI usa RPC en vez de query.
- **UI**:
  - `/market/crear`: banner de cupo via `get_publish_quote` (restantes gratis / costo / saldo), publica con `market_publish`, error de saldo → toast + link a billetera.
  - `/market/carrito`: eliminada la fila y el calculo de "Comision SpotterX (1%)".
  - `/market/admin`: seccion **Monetizacion SpotterShop** (global gratis+precio → `admin_set_publication_config`) + card **Publicadores — ranking y premios** (ordenados por vigentes, stepper `-`/`+`, Aplicar, "Global" para resetear a override NULL, buscador) + KPI "Ingresos pub." (era "Comision").
  - `/admin/market`: KPI "Ingresos por publicaciones" (era "Comision total").
- **Legacy**: `commissionFor` y `admin_set_commission` quedan sin uso en la UI (no se borran). Las ordenes viejas conservan su snapshot de `platform_fee`; las nuevas guardan 0.
- **PENDIENTE usuario**: correr `00036_spotter_shop.sql` en SQL Editor. **CORRIDA 25/09/2026** (verificada por query de marcadores: `m29_role_admin`..`m36_rpcs` todos `true`). Con eso el Lote 25 queda CERRADO.

**Lote 26 - Todo el admin del market en el perfil administrador (25/09/2026, commit `f71cbfe`, lint 0 errores, build OK 44 rutas, push deploy automatico; migracion 00037 PENDIENTE de correr por el usuario):**
- **Motivo**: el usuario no encontraba `/market/admin` (panel escondido del market) y pidio que TODO el dinero/publicadores del marketplace se maneje desde el perfil administrador de la app (`/admin`). Antes eran 2 paginas: `/market/admin` y `/admin/market`. Ahora es UNA sola: `/admin/market` (la "SpotterShop" del AdminShell, estilo enterprise).
- **`/admin/market` reescrito** (junta todo): KPIs (Ordenes, Ventas totales, Ventas este mes, Ingresos por publicaciones, Retiros pendientes) + Exportar CSV + ultimas ordenes + grafico de ventas 6 meses + chips de categorias populares + seccion **Monetizacion SpotterShop** (`admin_set_publication_config`) + seccion **Publicadores - ranking y premios** (orden por vigentes, stepper `-`/`+`, Aplicar, reset "Global" a override NULL, buscador) + seccion **Acreditar saldo** (`admin_credit_wallet`) + seccion **Retiros pendientes** (`admin_pending_withdrawals` -> `admin_mark_withdrawal_paid`).
- **`/market/admin` -> redirect server** a `/admin/market` (nunca 404; el archivo de ruta es un `redirect("/admin/market")`). Se quitaron los 2 accesos: escudo "Admin" en el header de `/market` y item Admin del `MarketShell`. Los usuarios NO pierden nada (tienda, crear, mis ventas/compras, billetera, carrito, checkout intactos).
- **Migracion `00037_admin_withdrawals.sql`** (NUEVA, **PENDIENTE de correr por el usuario en SQL Editor**): RPC `admin_pending_withdrawals()` (`security definer`, valida `is_admin`) que lista los retiros `withdrawal_request` que NO tienen su `withdrawal_paid` asociado, con `email`/`username`/`full_name` del usuario (el admin NO lee `wallet_transactions` ajenas por RLS -> mismo patron que `admin_publish_revenue` de 00036). Marcar pagado reutiliza `admin_mark_withdrawal_paid` (00027).
- **Limpieza**: en `market/page.tsx` y `MarketShell.tsx` se eliminaron los imports/state que quedaron sin uso (`profile`, `Shield`, `useAuthState`).

**Lote 27 - Plataforma: monetizacion solo por publicaciones (sin retiros) + cuentas de cobro + depositos registrados + carrito oculto (25/09/2026, commit PENDIENTE, lint 0 errores, build OK 44 rutas, push deploy automatico; migracion 00038 PENDIENTE de correr por el usuario):**
- **Decision planataria (usuario 25/09)**: las ventas se cierran 100% entre vendedor y comprador (fuera de la plataforma). La billetera queda SOLO para pagar publicaciones (se elimino TODO el flujo de retiros: "Retirar" del usuario, equest_withdrawal/dmin_pending_withdrawals/dmin_mark_withdrawal_paid sin uso en la UI). El dinero del marketplace entra solo por publicidad.
- **Pago de publicaciones**: cuando se agota el cupo gratis (will_pay && balance < price), el panel de /market/crear muestra la tarjeta **"Publicacion paga"**: monto (), **cuenta de cobro activa del admin** (banco/CBU-tipo/numero/titular/nota), email de contacto y boton **"Hice el deposito - avisar"** -> RPC eport_deposit(p_amount, p_note) que genera el **pedido SP-YYYYMMDD-XXXX**, lo guarda en la tabla nueva publish_deposits, inserta una **notificacion in-app al admin** (	ype='pago_publicacion', message "Deposito SP-x por ") y devuelve el pedido; luego abre wa.me/<whatsappAdmin> con un mensaje prellenado (pedido, monto, publicador) para que el administrador le acredite rapido sin entrar a la app. El email automatico se descarto: lo reemplaza el **registro de depositos en el admin**.
- **/admin/market**: nueva seccion **Depositos pendientes** (RPC dmin_list_deposits('pendiente') con publicador/email/fecha) con boton **"Acreditar"** -> dmin_approve_deposit: acredita la wallet del publicador (credit con eference=pedido), marca el deposito creditado y lo pasa al historial "Ultimos acreditados". Nueva seccion **Config SpotterShop / modo carrito**: CRUD de **cuentas de cobro** (payment_accounts en platform_config, una activa a la vez con estrella Star), contacto admin (**email + whatsapp** en dmin_contact), y **toggle "Modo carrito"** (llow_cart, arranca **OFF**). Todo se guarda con un solo RPC dmin_set_payment_config(p_accounts, p_allow_cart, p_contact) (NULL = no tocar) + esetMarketConfigCache(). Se quito la seccion/KPI de **Retiros pendientes** (tile reemplazado por "Publicadores").
- **Carrito oculto (OFF por defecto)**: llow_cart=false default. Se oculta en: nav sidebar + pill del MarketShell, icono carrito del header de /market, bloque Cantidad+Agregar al carrito de /market/[id] (queda "Preguntar al vendedor" como CTA principal), y /market/carrito redirige a /market. Cuando el admin lo active desde "Config SpotterShop", todo reaparece (modo de crecimiento a futuro). market_checkout queda intacto en la DB.
- **/admin dashboard**: la card "Comision mes" paso a **"Ingresos publicaciones"** (RPC dmin_publish_revenue, acumulado) con detalle de publicaciones pagas.
- **Billetera del usuario**: sin "Retirar"; card "Para que sirve mi saldo" (solo publicaciones) con boton "Publicar un producto"; card "Como cargo saldo" explica el flujo de deposito; nueva seccion **"Mis depositos"** (lee publish_deposits propias por RLS, badge Pendiente/Acreditado).
- **Helper nuevo src/lib/market-config.ts**: tipos PaymentAccount/AdminContact/MarketConfig + getMarketConfig() cacheado (keys llow_cart, payment_accounts, dmin_contact, ree_publishes, publish_price) + esetMarketConfigCache() + ctivePaymentAccount() (sirve la activa o la primera).
- **Migracion  0038_payment_config.sql** (NUEVA, **PENDIENTE de correr por el usuario en SQL Editor**): defaults de config (free_publishes 3, publish_price 100, allow_cart false, payment_accounts [], admin_contact {}, ya existentes con 00036/00027); tabla publish_deposits (id, user_id, pedido unico SP-yyyymmdd-XXXX generado en la RPC, amount, status 'pendiente'/'acreditado', note) con RLS solo-lectura-propia + indice; **RPC eport_deposit**, **dmin_list_deposits(p_status)**, **dmin_approve_deposit(p_deposit_id)** (security definer, valida is_admin, acredita wallet con credit + eference=pedido, notification complementaria) y **dmin_set_payment_config**; CONSTRAINT 
otifications_type_check re-creada con la lista acumulativa completa + 'pago_publicacion'.
- **Migracion  0037_admin_withdrawals.sql ELIMINADA del repo** (se saco el flujo de retiros): si el usuario ya la corrio, es inofensiva (quedan RPCs dormidas); **NO correrla** si aun no.
- **PENDIENTE usuario**: correr  0038_payment_config.sql en SQL Editor (con eso el Lote 27 queda CERRADO).


**Lote 28 - Publicaciones pendientes de pago (sin billetera para publicar) (commit PENDIENTE, lint 0 errores, build OK 44 rutas, migracion 00039 PENDIENTE de correr por el usuario):**
- **Flujo nuevo (decision del usuario)**: cuando el publicador agota su cupo gratis, /market/crear abre un **MODAL "Publicacion paga"** al tocar Publicar (cuenta de cobro activa + monto $X + contacto del admin, configurable $100). Al tocar "Confirme la transferencia y publicar", la RPC **market_publish_pending(...)** crea el producto con **status 'pending'** + registra el deposito en **publish_deposits** (con product_id y pedido SP-...) + notificacion in-app al admin. La tienda NO lo muestra (filtra status='active') y NO cuenta el cupo (que mira active/paused).
- **/admin/market**: la seccion paso a **"Publicaciones pendientes de pago"**: cada fila muestra producto + monto + publicador + pedido, con boton **"Aprobar y publicar"** -> **admin_approve_deposit** (redefinida) marca el deposito 'acreditado' y activa el producto (pending->active), SIN tocar la billetera. La card **"Acreditar saldo" solo aparece con allowCart=true** (con aviso cuando esta desactivada).
- **Billetera del usuario**: se queda visible (nav siempre) pero cambiada de rol: muestra **"Ventas realizadas"** (market_orders por seller_id) y **"Compras"** (por buyer_id) con nombres de productos via market_order_items. El saldo / historial / "Mis depositos" SOLO si allowCart=true (modo carrito).
- **Migracion 00039_pending_publish.sql** (NUEVA, **PENDIENTE de correr por el usuario en SQL Editor**): market_products.status admite 'pending'; publish_deposits += product_id (FK nullable + indice); **RPC market_publish_pending(...)** (mismos params que market_publish, valida auth/nombre/precio, usa publish_price); admin_list_deposits incluye product_id/product_name/product_price; admin_approve_deposit redefinida (acredita deposito + activa producto, sin wallet); admin_publish_revenue suma **depositos acreditados** (antes wallet_transactions type='publish').
- Se quito del frontend el flujo report_deposit + wa.me del publicador (la RPC queda en la DB por legacy; la billetera dejo de participar del flujo de publicar).
- **Migracion 00038 CORRIDA por el usuario** 25/09/2026 y **verificada via REST** (tabla publish_deposits HTTP 200; report_deposit/admin_list_deposits/admin_approve_deposit/admin_set_payment_config existentes con guards 'No autenticado'/'No autorizado'; defaults de platform_config y constraint pago_publicacion NO verificables por REST porque RLS esconde platform_config a anon).
- **PENDIENTE usuario**: correr **00039_pending_publish.sql** en SQL Editor (con eso el Lote 28 queda CERRADO) + de paso el query de verificacion de 00038 (notif_ok/defaults_ok -> true|true).

## Lote 28 CERRADO (25/09/2026)
- **Migracion 00039 CORRIDA por el usuario** 25/09/2026 y **verificada via REST**: market_publish_pending (firma completa) -> 'No autenticado'; admin_list_deposits/admin_approve_deposit (con uuid)/admin_publish_revenue -> 'No autorizado'; publish_deposits?select=product_id -> HTTP 200 (columna product_id existe). Deploy bc0a2b4 READY.
- El flujo queda habilitado en produccion: crear con cupo agotado -> modal publicacion paga -> pending -> admin aprueba y publica.

**Lote 29 - Fix: la config de SpotterShop no se leia (RLS sin policies en platform_config) (25/09/2026, sin cambios de codigo, migracion 00040 PENDIENTE de correr por el usuario):**
- **Sintoma del usuario**: cargo la cuenta bancaria en /admin/market (Config SpotterShop) pero al publicar el modal mostraba "El administrador todavia no cargo una cuenta de cobro".
- **Causa raiz identificada por REST**: platform_config tiene RLS HABILITADA (probado: INSERT anon -> "new row violates row-level security policy", HTTP 401) y **ninguna policy** -> `GET /rest/v1/platform_config` devuelve `[]` para TODOS los roles. El guardado del admin funciona porque `admin_set_payment_config` es security definer; lo que no andaba era LEERLA de vuelta. Afectaba a getMarketConfig() (accounts:[] -> modal sin cuenta) y a la lectura directa de /admin/market (free_publishes/publish_price).
- **Fix**: migracion `00040_platform_config_read.sql` que agrega policy **SELECT con using(true)** (valores publicos: cupo, precio, cuentas de cobro, contacto, toggle carrito) a las roles anon+authenticated. INSERT/UPDATE/DELETE quedan SIN policy (solo escriben las RPCs security definer). Idempotente (DO block con if-not-exists). Sin cambios de frontend.
- **PENDIENTE usuario**: correr 00040 en SQL Editor. Despues se verifica con GET anon a platform_config (debe devolver las filas).

**Lote 30 - Market en vivo: pedidos y publicaciones sin refrescar (25/09/2026, sin migracion, lint 0 errores, build OK 44 rutas, push deploy automatico):**
- **Sintoma**: el admin debia refrescar /admin/market para ver los pedidos (depositos pendientes) y el publicador debia refrescar para ver su publicacion pasar a activa tras "Aprobar y publicar".
- **Fix (sin migracion, puro realtime ya existente)**:
  - `/admin/market`: nuevo canal `admin-market-live` (uid via auth.getUser): eventos INSERT de `notifications` filtrados por `user_id=eq.<uid>` que cuando `type='pago_publicacion'` llaman a un nuevo `loadDeposits useCallback` (refetch admin_list_deposits pendiente+acreditado); y UPDATE de `market_products` (cualquiera) que tambien llama `loadDeposits` (multi-pestana consistente). El boton Aprobar sigue moviendo la fila localmente.
  - `mis-publicaciones`: `load` extraido a useCallback + canal `mis-publicaciones-live` (market_products y market_orders con filter seller_id) evento "*" -> refetch. El fetch inicial en setTimeout(0) (regla react-hooks/set-state-in-effect).
  - `/market` (storefront): canal `market-live` (market_products evento "*") -> refetch del load actual via ref (`loadRef`) -> los compradores ven la publicacion recien aprobada sin refrescar.
  - `/market/billetera`: canal `billetera-live` (market_orders filter seller_id y buyer_id) evento "*" -> refetch de ventas/compras.
- **Por que funciona sin migracion**: market_products/market_orders/notifications ya estan en supabase_realtime (00026/00005); publish_deposits NO se usa en realtime (el admin se entera via la notif pago_publicacion que 00039 ya inserta). RLS: notifications entrega solo las propias (recipient), market_products entrega a todo autenticado (policy lectura), market_orders solo buyer/seller. checks: el approve es pending->active = un UPDATE que entra por el canal del vendedor y del storefront.
- Commit `PENDIENTE` (verificado en deploy por API).

**Lote 31 - Market en el menu lateral del perfil administrador (25/09/2026, sin migracion, lint 0 errores, build OK 44 rutas, push deploy automatico):**
- **Pedido del usuario**: "el market de la cuenta de gym me gustaria que este en el menu lateral del perfil de administrador y no en el perfil de la red social". Hoy la entrada al mercado desde la red era una card "SpotterShop" en /perfil (visible para todos los roles); el AdminShell ya tenia "SpotterShop" pero apunta al panel de administracion /admin/market.
- **AdminShell.tsx** (NAV_ITEMS): nuevo item **{ href: "/market", label: "Market", icon: Store }** entre "Catalogo" y "SpotterShop" -> lleva a la TIENDA (/market, donde el publicador vende). El item "SpotterShop" (/admin/market), el panel de administracion, queda intacto. NAV_ITEMS alimenta desktop sidebar + drawer mobile.
- **/perfil (social)**: eliminada la card "SpotterShop" -> /market (todas las roles) y quitado `ShoppingBag` del import de lucide (ChevronRight sigue en uso, Store tambien). El acceso social al mercado sigue vivo por el item nav "Market" del SocialShell.
- Sin migracion. Los usuarios no pierden accesos: /market from admin sidebar + SocialShell nav "Market" + MarketShell propio.
- Deploy verificado por API (push automatico).

**Lote 31 REHECHO - SpotterShop en el menu lateral del gimnasio (25/09/2026, sin migracion, lint 0 errores, build OK 44 rutas, push deploy automatico):**
- **Correccion del pedido (el usuario aclaro)**: el boton para ir al market tenia que ir en el MENU LATERAL DEL PANEL DEL GIMNASIO (GymShell: Panel Principal / Miembros / Planes & Promos / Cobros & Cuotas / Codigo QR / Accesos & Aforo), NO en la consola admin global. Con el rebrand de Lote 25 el market se llama **SpotterShop**.
- **GymShell.tsx**: en el array `nav` (alimenta el sidebar lateral desktop + la barra inferior mobile) se agrego el item `{ href: "/market", label: "SpotterShop", icon: ShoppingBag }` como 7.º, despues de "Accesos & Aforo".
- **AdminShell.tsx**: se REVIRTIO el item "Market" (que habia quedado mal del intento previo); la consola global queda como estaba (Catalogo + SpotterShop = panel /admin/market).
- **SocialShell.tsx**: renombrado el label del nav del mercadillo de "Market" a "SpotterShop" (consistencia de marca).
- **/perfil (social)**: la card SpotterShop sigue removida (pedido original: el mercadillo ya no vive en el perfil de la red social).
- Sin migracion. Deploy verificado por API (push automatico).
**Lote 32 - Optimizacion de carga inicial (25/09/2026, commit `1d640fb`, sin migracion, lint 0 errores, build OK 44 rutas, push deploy automatico verificado por API):**
- **Objetivo**: el usuario reporto la app "un poco lenta" al arrancar en el celular. Lineas aprobadas: (1) lazy loading de bundles pesados, (2) una sola conexion realtime, (3) cache HTML revalidable, (4) media lazy.
- **Baselines medidos en produccion** (metodo: GET al HTML + regex `/_next/static/.*\.js` + suma de bytes): `/home` inicial = ~826 KB brutos (~250 KB gzip) en 9-10 scripts. El peso casi todo es `react-dom` (224 KB) + `supabase` (231 KB) + codigo de la app; los tiles/cache de `_next/static` ya eran `immutable`.
- **Lazy loading via `next/dynamic` (`ssr:false`) + componentes extraidos**:
  - **recharts** -> `src/components/training/HistoryCharts.tsx` (ProgressLine + MonthlyBars) para `mi-entrenamiento` y `entrenamiento/alumno/[id]` (pestana Historial) y `src/components/admin/SalesChart.tsx` para `/admin/market`. recharts ya no entra en el parse inicial de esas rutas.
  - **leaflet/react-leaflet** -> `src/components/gyms/PublicProfileMap.tsx` (mapa del perfil publico `/perfil/[username]`, antes inline en el page; debajo del MapContainer viven gymIcon/zonaIcon/FitAllButton/ZoomToPoint/LeafletAutoResize y el overlay "Aleja el mapa") y `src/components/gyms/TrainerSearchMap.tsx` (mapa de `/mi-entrenamiento/buscar`; recibe zones/profiles/linked/userCoords/center/zoom; incluye los popus con Perfil/Chat/Ubicar/Como llegar). Skeleton mientras carga.
  - **xlsx** -> `parsePlanilla.ts` con `await import("xlsx")` dentro del branch xlsx/xls (el branch CSV no paga la dependencia).
- **Singleton del client de Supabase** (`src/lib/supabase/client.ts`): se cachea la instancia en la sesion (una sola conexion/websocket en vez de una por llamada).
- **Cache HTML**: `next.config.ts` `/:path*` pasa de `no-cache, no-store, must-revalidate` a `private, no-cache, must-revalidate` (el navegador puede guardar el shell de la pagina y revalidarla; los datos siguen cargando por cliente).
- **Media lazy**: `loading="lazy" decoding="async"` en los `<img>` de `PostCard.tsx`, `ProfileGrid.tsx` y `ProductCard.tsx` (el `<video>` del feed mantiene preload por autoplay muted). Logos y previsualizaciones de subida NO se tocaron.
- **Limpieza**: eliminado de `Feed.tsx` el codigo de diagnostico morto de los Lotes 8-12 (`FeedDiag`, `measureDiag`, `renderDiag`, state `diag`, `feedRef` y su efecto con `setInterval`; el badge ya se habia sacado en el Lote 12). Con esto vuelve a 0 warnings propios.
- **LECCION (importante)**: en `client.ts`, tipar el cache con `ReturnType<typeof createBrowserClient>` ROMPE la inferencia en TODA la app: `createBrowserClient` es generico con overloads y `ReturnType` resuelve la firma del overload, no la del call -> TS7006 "parameter implicitly has an 'any'" en callbacks `.map((g)=>...)` y `.on(..., (payload)=>)` por DECENAS de archivos que nadie toco, sobre todo los que usan `supabase` (parece una regression masiva pero es la tipa del client). FIX: cachear con una funcion helper `makeClient()` y `type Client = ReturnType<typeof makeClient>` (el tipo del call, identico al inferido) -> build verde al instante. Diagnostico: `git stash` + `npm run build` (HEAD compila) + `git stash pop` + rebuild para separar errores propios de los latentes; un build limpio previo calienta el cache incremental de Turbopack y reduce el ruido.
- **Medicion despues**: `/home` 845.477 Bytes (10 scripts) vs 845.963 antes (~indiferente, correcto: las libs pesadas NUNCA estuvo en /home). `/perfil/[username]` carga el MISMO set de 10 scripts del shell (~826 KB) -> leaflet ya no entra en el HTML inicial de esa ruta (antes era statico). Los 4 tiles del shell de /home (react-dom + supabase + app) no se pueden reducir sin sacrificar funcionalidad.
- Deploy READY sha `1d640fb` (push automatico, verificado por API).