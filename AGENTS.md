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
- **Edge function `delete-account`** (`supabase/functions/delete-account/index.ts`): valida token, `auth.admin.deleteUser(id)` con service role. ⚠️ **Pendiente deploy**: `supabase functions deploy delete-account`.
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

### 🟦 Etapa 4 — Módulo Profesor (gym + personal trainers)
- Panel conectado al gym: ver gyms (`gym_staff`), horas trabajadas, **alumnos del gym automáticos** (sync `gym_memberships` → `trainer_students source='gym'`; hoy la etiqueta "Del gym" es manual).
- **Vista ALUMNO** (hoy NO existe): `/mi-entrenamiento` con planes, rutinas y chat de cada profe — pieza clave para que el módulo sirva.
- Planes **estructurados** (tabla de items: días/ejercicios/series/reps/descanso) + **plantillas** reutilizables.
- Rutinas con fecha (`due_on` existe pero no se usa) + historial de cumplimiento con gráfico.
- Chat 1:1 completo: trigger de notificación `type='message'` (hoy nunca se genera), vistos (`read`), adjuntos.
- Vinculación bidireccional: profe se postula a un gym (el dueño autoriza); alumno busca/contrata profe por zona con mapa (Leaflet, ya en repo).
- Disponibilidad/horarios del profe.

### 🟦 Etapa 5 — Marketplace fit (estilo MercadoLibre)
- `market_products` (publicador: gym/profe/usuario, nombre, descripción, precio, fotos bucket `market`, stock, estado), `market_orders` + items (carrito, total, estados, dirección retiro/envío).
- Reseñas por vendedor/producto.
- **Comisión de la plataforma** vía `credits`/`wallet` (schema base ya preparado).
- UI: home grid, detalle, carrito, comprar, Mis publicaciones, Mis pedidos, reseñas.

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
- **Vinculación bidireccional profe↔gym** (A5, migración 00015 CORRIDA 07/09/2026): tabla `trainer_gym_requests` (trainer_id, gym_id, status, unique) + RLS (profe: crea y lee sus solicitudes; owner: ve y aprueba/rechaza) + triggers `notify_gym_solicitud` / `notify_staff_aprobado` + columnas `trainer_gyms.availability` + tipos `solicitud_staff` / `staff_aprobado` en `notifications` + realtime. El profe busca gym real por nombre/ciudad, hace "Postularme" (insert/upsert, estado visible Pendiente/Aprobado/Rechazado) o agrega gym manual; el dueño en `/gimnasio` ve solicitudes pendientes con Aprobar (→ upsert `gym_staff` authorized) / Rechazar (→ notificación al profe); el profe captura GPS y setea disponibilidad. Pendiente: que el alumno busque profe por zona con mapa (Leaflet).
- **Milestone 1 de Fase A**: A1 (ruta+rutinas+historial+chat), A2 (schema+UI profe+vista alumno, **sin plantillas**), A3 (due_on+completar+historial, **sin calendario ni gráfico**), A4 parcial (leídos marcados, seguir badge visible + adjuntos), A5 parcial (solicitud profe↔gym + disponibilidad; **sin mapa de alumnos**). Checkboxes en `PLAN_PULIDO.md`.

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
- **Vercel**: proyecto `pump13/spotterx` → producción `https://spotterx-five.vercel.app` (deploy **vinculación profe↔gym** `https://spotterx-j4sxhe172-pump13.vercel.app`, 25s). Env vars de Supabase configuradas en production/preview/development. Redploy: `vercel --prod --yes` (requiere login o `VERCEL_TOKEN`). Token vigente transitorio (dura 1 día): `[REDACTED]` (cargado 07/09/2026; `[REDACTED]...` quedó viejo/expirado). (El token `[REDACTED]...` también perdió acceso al scope `pump13`; los tokens de Vercel son de corta duración y hay que regenerarlos.)
- **Supabase** (proyecto `dzalgziofiwcljgnphap`): URL `https://dzalgziofiwcljgnphap.supabase.co`. `.env.local` usa la **anon key clásica** (la publishable no lista Storage). Edge function deployada: `invite-member`.
- **Edge Function `invite-member`**: crea cuentas (rol alumno/profesor) con la **service role key** guardada como **secreto** `SPOTTERX_SERVICE_ROLE` en Supabase (nunca en frontend). Deploy/secretos con `supabase functions deploy invite-member` y `supabase secrets set` (CLI + access token `sbp_...`). **ATENCIÓN**: la service role key se expuso en el chat → regenerarla luego del deploy si se quiere máxima seguridad. Para crear `auth.users` desde la app solo se puede vía esta edge function (el frontend usa anon key).
- **Migraciones**: no se pueden ejecutar desde la app; el usuario las corre manualmente en **SQL Editor** de Supabase. Completadas: 00001, 00002, 00003, 00004, 00005, 00006, **00007** (`00007_gym_memberships_unique.sql` = unique `gym_id,user_id` en `gym_memberships`, necesario para el `upsert` con `onConflict` de la edge function `invite-member`; al crear el unique deja de haber duplicados de membresía por par gym+usuario), **00008** (`00008_gym_member_details.sql` = tabla `gym_member_details` para la ficha del miembro, corrida 11/09/2026), **00009** (`00009_social_polish.sql` = Etapa 1: realtime social + RLS + `post_saves`/`post_reports` + `parent_id`, corrida 11/09/2026), **00010** (`00010_profiles_extend.sql` = Etapa 2: columnas de perfil + triggers + índices, corrida 11/09/2026) y **00011** (`00011_gym_reminders.sql` = Etapa 3: tipo `vencimiento` + `notify_upcoming_expiry` + pg_cron, **corrida 12/09/2026**). Y **00012** (`00012_staff_owner_manage.sql` = policy `Staff: owner gestiona` en `gym_staff` para el buscador de personas, **corrida 07/09/2026**). Y **00013** (`00013_training_estructurado.sql` = Fase A: `trainer_plan_items` + `trainer_routines.completed_at` + policy `Messages: marca leido` + realtime training, **corrida 07/09/2026**). Y **00014** (`00014_plan_templates.sql` = plantillas de planes: `trainer_plans.is_template` + índice, **corrida 07/09/2026**). Y **00015** (`00015_trainer_gym_requests.sql` = Fase A A5: tabla `trainer_gym_requests` (postulación profe↔gym con aprobación del dueño), RLS + triggers de notificación (`solicitud_staff`, `staff_aprobado`), `trainer_gyms.availability`, extendidos types en `notifications`, realtime; **corrida** 07/09/2026).

## Reglas / recordatorios
- NO tocar `fitpro`. Este proyecto es independiente.
- Texto en español. Identidad visual neón/dark.
- Preferir `[IO.File]` sobre `Get-Content/Set-Content` de PowerShell al manejar UTF-8 (corrompen acentos).
- Realtime de Supabase para notificaciones en vivo.
- Las Edge Functions (carpeta `supabase/functions/`) corren en **Deno**, no Node: están **excluidas del tsconfig** de Next (`exclude: ["node_modules", "supabase/functions"]`) para que el build no las type-checkee.
- **Journal de conversaciones**: al finalizar cada sesión/feature implementada (igual que se actualiza AGENTS.md), actualizar automáticamente `docs/journal/YYYY-MM-DD.md` con los 4 bloques del formato del README (Contexto / Decisiones / Implementado / Pendiente). Cada sesión agrega su propio bloque; los archivos nunca se borran.

## Estado de fases
- ✅ Fase 1 — Fundación (Next + Supabase + auth roles + theme + route groups + schema 00001)
- ✅ Fase 2 — Red social (feed real, crear contenido via Storage, discover, perfiles, notificaciones realtime)
- ✅ Fase 3 — Gestión de alumnos del profe (+ schema 00002_training)
- ✅ Fase 4 — Control de Acceso del gym (panel, memberships, QR check-in, accesos/aforo, edge function invite-member, schema 00003, mapa Leaflet)
- ✅ Fase 5 — Cobro de Cuota manual (+ pulido de planes con promos, schema 00004)
- ✅ Pulido alumnos + kiosk gym: `/mi-gimnasio` + escáner + kiosk realtime + campanita de ingresos (schema 00005, `@yudiel/react-qr-scanner`)
- ⏸️ Fase 6 — Marketplace Fit
- 🔜 Empaquetar como app móvil (Play Store / App Store via Capacitor) al final del roadmap
