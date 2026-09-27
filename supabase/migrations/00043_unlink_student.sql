-- SpotterX - 00043: desvincular alumno <-> profesor sin borrar la cuenta
-- Desvinculacion blanda: trainer_students.active = false
-- Los planes, rutinas, mensajes y el historial quedan intactos; al volver a
-- vincular el alumno los recupera (el upsert reactiva con active = true).
-- El alumno NO tiene policy de escritura sobre trainer_students, por eso la
-- desvinculacion de su lado va por RPC security definer.

drop function if exists public.unlink_student(uuid);
drop function if exists public.unlink_trainer_student(uuid);

-- El alumno se desvincula del profe
create or replace function public.unlink_student(p_trainer_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if auth.uid() is null then return false; end if;
  if p_trainer_id is null then return false; end if;

  update public.trainer_students
     set active = false
   where trainer_id = p_trainer_id
     and student_id = auth.uid()
     and active = true
  returning id into v_id;

  return v_id is not null;
end;
$$;

-- El profe desvincula a su alumno
create or replace function public.unlink_trainer_student(p_student_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if auth.uid() is null then return false; end if;
  if p_student_id is null then return false; end if;

  update public.trainer_students
     set active = false
   where trainer_id = auth.uid()
     and student_id = p_student_id
     and active = true
  returning id into v_id;

  return v_id is not null;
end;
$$;

grant execute on function public.unlink_student(uuid) to authenticated;
grant execute on function public.unlink_trainer_student(uuid) to authenticated;
revoke execute on function public.unlink_student(uuid) from anon;
revoke execute on function public.unlink_trainer_student(uuid) from anon;
