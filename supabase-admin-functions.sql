-- ============================================================
--  CORREÇÃO: permitir que ADMINS aprovem / promovam usuários
-- ============================================================
--
--  PROBLEMA:
--    A página de admin lia os usuários via RPC (get_todos_usuarios),
--    mas tentava ALTERAR via update direto na tabela `usuarios`.
--    O RLS bloqueava o update de OUTRAS linhas em silêncio (0 linhas
--    alteradas, sem erro), então a mudança nunca era salva.
--
--  SOLUÇÃO:
--    Funções SECURITY DEFINER que rodam com privilégio elevado,
--    MAS só depois de checar que quem chamou é admin de verdade.
--    Isso evita também o problema de recursão de RLS na própria tabela.
--
--  COMO USAR:
--    1. Abra o painel do Supabase do projeto
--    2. Menu lateral → SQL Editor → New query
--    3. Cole TODO este arquivo e clique em "Run"
--    4. Pronto. Não apaga nenhum dado — só cria/atualiza funções.
-- ============================================================


-- ── Aprovar / reprovar um usuário ──────────────────────────
create or replace function public.admin_set_aprovado(p_id uuid, p_aprovado boolean)
returns public.usuarios
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.usuarios;
begin
  -- Só admin pode usar
  if not exists (
    select 1 from public.usuarios
    where id = auth.uid() and admin = true
  ) then
    raise exception 'Acesso negado: apenas administradores podem aprovar usuários.';
  end if;

  update public.usuarios
    set aprovado = p_aprovado
    where id = p_id
    returning * into v_row;

  if v_row.id is null then
    raise exception 'Usuário não encontrado.';
  end if;

  return v_row;
end;
$$;


-- ── Tornar / remover admin ─────────────────────────────────
create or replace function public.admin_set_admin(p_id uuid, p_admin boolean)
returns public.usuarios
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.usuarios;
begin
  -- Só admin pode usar
  if not exists (
    select 1 from public.usuarios
    where id = auth.uid() and admin = true
  ) then
    raise exception 'Acesso negado: apenas administradores podem alterar permissões.';
  end if;

  -- Impede que o admin remova o próprio status de admin
  if p_id = auth.uid() and p_admin = false then
    raise exception 'Você não pode remover seu próprio acesso de administrador.';
  end if;

  update public.usuarios
    set admin = p_admin
    where id = p_id
    returning * into v_row;

  if v_row.id is null then
    raise exception 'Usuário não encontrado.';
  end if;

  return v_row;
end;
$$;


-- ── Permissões: só usuários logados podem chamar ───────────
grant execute on function public.admin_set_aprovado(uuid, boolean) to authenticated;
grant execute on function public.admin_set_admin(uuid, boolean)    to authenticated;
