# Plan de Pulido y Completado - SpotterX Platform

## Objetivo
Completar todos los módulos existentes, pulir la experiencia de usuario y preparar el proyecto para la Fase 6 (Marketplace Fit).

---

## Fase A: Completar Módulo Profesor (Training)

### A1. Vista del Alumno (`/mi-entrenamiento`)
- [x] Crear ruta `/mi-entrenamiento` para que el alumno vea sus planes y rutinas asignadas
- [x] Mostrar rutinas del día con ejercicios, series, repeticiones y descanso
- [x] Historial de cumplimiento (check-ins de rutinas)
- [x] Chat con el profesor asignado
- [ ] Estado del plan (progreso, días restantes)

### A2. Planes Estructurados
- [x] Tabla `trainer_plan_items` (ejercicio, series, reps, descanso, día)
- [x] UI para que el profesor cree planes con estructura real
- [x] Plantillas reutilizables de planes
- [x] Alumno puede ver plan estructurado (no solo texto)

### A3. Rutinas con Fecha
- [x] Campo `due_on` en `trainer_routines` (ya existe pero no se usa)
- [ ] Calendario de rutinas asignadas
- [x] Marcar rutina como completada
- [ ] Historial de cumplimiento con gráfico

### A4. Chat Profesor-Alumno Mejorado
- [x] Trigger de notificación `type='message'` (ya existe en 00010)
- [ ] Indicador de mensajes leídos/no leídos (marcado de leídos implementado; falta badge visible)
- [ ] Adjuntos en mensajes (fotos de ejercicios)
- [x] Historial de chat completo

### A5. Vinculación Bidireccional
- [ ] Profesor se postula a gym (el dueño autoriza)
- [ ] Alumno busca/contrata profe por zona con mapa
- [ ] Disponibilidad/horarios del profe

---

## Fase B: Completar Módulo Gym

### B1. Comunicados del Dueño
- [ ] Tabla `gym_announcements` (mensaje, fecha, target: alumnos/staff/todos)
- [ ] Notificación in-app a miembros
- [ ] Historial de comunicados

### B2. Estadísticas de Acceso Mejoradas
- [ ] Gráfico de asistencia semanal/mensual
- [ ] Horario pico (qué horas hay más movimiento)
- [ ] Días más concurridos
- [ ] Exportar datos a CSV/Excel

### B3. Gestión de Staff Mejorada
- [ ] Roles: admin, recepcion, profesor
- [ ] Permisos por rol (qué puede hacer cada uno)
- [ ] Horarios de trabajo del staff
- [ ] Historial de horas trabajadas

### B4. Recordatorios y Notificaciones
- [ ] Push notifications (futuro, preparar estructura)
- [ ] Email de vencimiento de membresía
- [ ] Recordatorios de pago

---

## Fase C: Completar Módulo Alumno

### C1. Dashboard del Alumno
- [ ] Resumen: próximo vencimiento, rutinas pendientes, gym actual
- [ ] Historial de check-ins
- [ ] Estadísticas personales (asistencia, racha)

### C2. Progreso Personal
- [ ] Registro de peso/fotografías (opcional)
- [ ] Gráficos de progreso
- [ ] Logros/badges (gamificación básica)

### C3. Búsqueda de Gyms/Profes
- [ ] Mapa con gyms cercanos
- [ ] Filtro por tipo de gym, precio, distancia
- [ ] Reseñas de gyms

---

## Fase D: Pulido General

### D1. UI/UX
- [ ] Consistencia de colores (neon cyan/ember en todos los componentes)
- [ ] Transiciones suaves entre páginas
- [ ] Loading states consistentes (skeletons en todas las páginas)
- [ ] Empty states personalizados por módulo
- [ ] Formularios con validación en tiempo real
- [ ] Toast messages consistentes

### D2. Rendimiento
- [ ] Optimización de imágenes (Next/Image)
- [ ] Lazy loading de componentes pesados
- [ ] Reducción de re-renders innecesarios
- [ ] Memoización donde sea necesario

### D3. Accesibilidad
- [ ] Labels en todos los inputs
- [ ] Navegación por teclado
- [ ] Contraste de colores (WCAG AA)
- [ ] ARIA labels en componentes interactivos

### D4. Mobile
- [ ] Touch gestures (swipe, pull-to-refresh)
- [ ] Safe areas (notch, home indicator)
- [ ] PWA basics (manifest, icons)

### D5. Errores
- [ ] Error boundaries por módulo
- [ ] Páginas de error personalizadas
- [ ] Retry automático en queries fallidas
- [ ] Offline handling básico

---

## Fase E: Marketplace Fit + Billetera + Panel Admin — PLAN APROBADO 12/09/2026

Ver **AGENTS.md → Etapa 5** para el plan completo y decisiones cerradas. Dividido en 3 lotes:

- **Lote 1 (ahora):** Marketplace + billetera (migraciones 00026 + 00027, páginas, componentes).
- **Lote 2 (después):** Panel admin `/market/admin` (dashboard + comisión + cargas/retiros).
- **Lote 3 (futuro):** Panel de plataforma completo (moderación, verificación, usuarios, KPIs globales).

El schema original de esta sección fue **reemplazado** por las migraciones reales 00026_market.sql y 00027_wallet_admin.sql (ver carpeta `supabase/migrations/`).

---

## Fase F: Técnico Pendiente

### F1. Migraciones
- [ ] Correr migración 00012 (staff owner manage)
- [ ] Crear migración 00013 para marketplace schema

### F2. Edge Functions
- [ ] Deployar `delete-account` function
- [ ] Crear `process-payment` (futuro, preparar estructura)
- [ ] Crear `send-notification` (push notifications)

### F3. Testing
- [ ] Unit tests para funciones utilitarias
- [ ] Integration tests para queries de Supabase
- [ ] E2E tests críticos (login, check-in, crear post)

### F4. Documentación
- [ ] README.md actualizado con guía de inicio
- [ ] Documentación de componentes
- [ ] Guía de deployment

---

## Orden de Implementación Recomendado

1. **Fase A** (Profesor) - ✅ Hecha
2. **Fase B** (Gym) - ✅ Hecha
3. **Fase C** (Alumno) - ✅ Hecha
4. **Fase D** (Pulido) - ✅ Hecha
5. **Fase F** (Técnico) - ✅ Hecha (delete-account deployada, 00025 corrida)
6. **Fase E** (Marketplace + Billetera + Admin) - 🟦 En progreso (Lote 1 = marketplace+billetera, Lote 2 = panel admin, Lote 3 = panel plataforma futuro)

---

## Notas Importantes

- Cada fase termina con: migración SQL + build/lint + commit + deploy + actualizar AGENTS.md
- El marketplace es la fase más grande; considerar dividirla en sub-fases
- Mantener el flujo de journal para registrar decisiones
- Priorizar funcionalidad sobre estética (pulir después de completar)
