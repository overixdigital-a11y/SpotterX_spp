# Journal de Conversaciones

Registro histórico de cada sesión de trabajo en SpotterX Platform.

## Formato

Cada archivo lleva el nombre `YYYY-MM-DD.md` y contiene:

```markdown
# YYYY-MM-DD

## Contexto
Qué se estaba haciendo / qué se discutió

## Decisiones
Qué se decidió y por qué

## Implementado
Qué se hizo (commits, migraciones, etc.)

## Pendiente
Qué quedó para la próxima sesión
```

## Cómo funciona

- Al finalizar cada sesión, el agente guarda la conversación **automáticamente** (regla en `AGENTS.md`) en el archivo del día, igual que actualiza AGENTS.md al terminar un plan.
- Si hay más de una sesión el mismo día, cada una agrega su propio bloque con un encabezado `### Sesión N · HH:MM — tema breve`, manteniendo el formato Contexto / Decisiones / Implementado / Pendiente.
- Los archivos se acumulan y nunca se borran.
