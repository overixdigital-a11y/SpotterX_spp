-- SpotterX - 00045: hardening de las funciones de recordatorio (pg_cron)
-- Las funciones de recordatorio son "security definer" y corre el pg_cron, asi que
-- NO pueden llevar un `if auth.uid() is null` (el cron no tiene sesion). Pero si
-- quedan con EXECUTE para PUBLIC, cualquiera puede pegarle un POST a
-- /rest/v1/rpc/<funcion> desde el navegador y generar avisos falsos.
-- Verificado por REST: POST anon a notify_trainer_membership_due -> HTTP 204.
-- Ninguna app las llama (solo las agenda pg_cron), asi que se les cierra el acceso.
-- Patron de permisos: la 00043 ya hacia revoke de anon en sus RPCs.

revoke execute on function public.notify_trainer_membership_due() from public;
revoke execute on function public.notify_trainer_membership_due() from anon;
revoke execute on function public.notify_trainer_membership_due() from authenticated;

-- Mismo hueco en el recordatorio del gym (00011), que quedo con el mismo patron.
revoke execute on function public.notify_upcoming_expiry() from public;
revoke execute on function public.notify_upcoming_expiry() from anon;
revoke execute on function public.notify_upcoming_expiry() from authenticated;

-- Verificacion: todo lo que el cliente puede invocar por RPC
grant execute on function public.trainer_mark_membership_paid(uuid, numeric, text) to authenticated;
revoke execute on function public.trainer_mark_membership_paid(uuid, numeric, text) from anon;
grant execute on function public.unlink_student(uuid) to authenticated;
revoke execute on function public.unlink_student(uuid) from anon;
grant execute on function public.unlink_trainer_student(uuid) to authenticated;
revoke execute on function public.unlink_trainer_student(uuid) from anon;
