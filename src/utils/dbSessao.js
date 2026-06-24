import { sb } from '../lib/supabase';

// ── Listar sessões do usuário logado ──
export async function listarSessoes() {
  const { data, error } = await sb
    .from('sessoes_orcamento')
    .select('id, nome, criado_em, atualizado_em')
    .order('atualizado_em', { ascending: false });

  if (error) throw error;
  return data || [];
}

// ── Inserir nova sessão — retorna o registro criado (com id) ──
export async function criarSessao(session, nome) {
  const { data: { user } } = await sb.auth.getUser();
  if (!user) throw new Error('Não autenticado');

  const { data, error } = await sb
    .from('sessoes_orcamento')
    .insert({
      usuario_id: user.id,
      nome,
      dados: session,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

// ── Atualizar sessão existente pelo id ──
export async function atualizarSessao(id, session) {
  const { error } = await sb
    .from('sessoes_orcamento')
    .update({
      dados: session,
      atualizado_em: new Date().toISOString(),
    })
    .eq('id', id);

  if (error) throw error;
}

// ── Carregar dados completos de uma sessão ──
export async function carregarSessao(id) {
  const { data, error } = await sb
    .from('sessoes_orcamento')
    .select('dados')
    .eq('id', id)
    .single();

  if (error) throw error;
  return data.dados;
}

// ── Deletar sessão ──
export async function deletarSessao(id) {
  const { error } = await sb
    .from('sessoes_orcamento')
    .delete()
    .eq('id', id);

  if (error) throw error;
}
