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
│   │   └── (gyms)/          → (Fase 4) control de acceso del gym + cobro de cuota
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

### Fase 4 — Control de Acceso del Gimnasio
16. Panel gym (admin): gestiona gym, miembros, planes/membresías, aforo en tiempo real
17. **Growth loop**: el gym **CREA las cuentas** de alumnos (rol alumno) y profesores (rol profesor) en la app → miembros automáticos → más usuarios para la plataforma
18. El gym configura **planes/membresías** (mensual/trimestral/etc.) con precio + vigencia
19. **QR por gimnasio + membresía**:
    - **Alumno**: escanea QR del gym → muestra su info + si está **habilitado** (membresía vigente)
    - **Profesor**: escanea al entrar y al salir → **cuenta horas de trabajo**
20. Historial de accesos + estadísticas de asistencia

### Fase 5 — Cobro de Cuota del gym (panel gym)
- Cobro de membresías/cuotas de los alumnos (manual primero, pasarela MercadoPago/Stripe después)
- Monetización directa del gym

### Fase 6 — Marketplace Fit
- Venta de productos de fitness, tipo **MercadoLibre** → comisiones

### Futuro / Otras monetizaciones
- Boosts/verificación (patrón ya probado en fitpro), contenido pago, suscripciones premium
- Gym como SaaS (freemium por cantidad de usuarios)
- Conexión/integración con otras apps (login compartido / API / deep links)

## Reglas / recordatorios
- NO tocar `fitpro`. Este proyecto es independiente.
- Texto en español. Identidad visual neón/dark.
- Preferir `[IO.File]` sobre `Get-Content/Set-Content` de PowerShell al manejar UTF-8 (corrompen acentos).
- Realtime de Supabase para notificaciones en vivo.
