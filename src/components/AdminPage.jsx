import { useState, useEffect } from 'react';
import { sb } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

export default function AdminPage({ onVoltar }) {
  const { user } = useAuth();
  const [usuarios, setUsuarios] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [erro, setErro]         = useState(null);
  const [atualizando, setAtualizando] = useState(null); // id sendo atualizado

  useEffect(() => {
    carregarUsuarios();
  }, []);

  async function carregarUsuarios() {
    setLoading(true);
    setErro(null);
    const { data, error } = await sb.rpc('get_todos_usuarios');
    if (error || !data) {
      setErro('Erro ao carregar usuários. Verifique se a função get_todos_usuarios existe no Supabase.');
    } else {
      setUsuarios(data);
    }
    setLoading(false);
  }

  async function toggleAprovado(id, aprovadoAtual) {
    setAtualizando(id + '_aprovado');
    const { error } = await sb
      .from('usuarios')
      .update({ aprovado: !aprovadoAtual })
      .eq('id', id);
    if (!error) {
      setUsuarios(prev =>
        prev.map(u => u.id === id ? { ...u, aprovado: !aprovadoAtual } : u)
      );
    }
    setAtualizando(null);
  }

  async function toggleAdmin(id, adminAtual) {
    // Impede que o próprio admin se rebaixe
    if (id === user?.id && adminAtual) return;
    setAtualizando(id + '_admin');
    const { error } = await sb
      .from('usuarios')
      .update({ admin: !adminAtual })
      .eq('id', id);
    if (!error) {
      setUsuarios(prev =>
        prev.map(u => u.id === id ? { ...u, admin: !adminAtual } : u)
      );
    }
    setAtualizando(null);
  }

  const pendentes  = usuarios.filter(u => !u.aprovado);
  const aprovados  = usuarios.filter(u => u.aprovado);

  return (
    <div className="min-h-screen px-6 py-10" style={{ paddingBottom: '48px' }}>

      {/* Header */}
      <div className="max-w-2xl mx-auto mb-8 flex items-center justify-between">
        <div>
          <div className="inline-flex items-center gap-2 bg-jade-50 text-jade-700
                          text-xs font-mono px-3 py-1 rounded-full mb-3 border border-jade-200">
            <span className="w-1.5 h-1.5 rounded-full bg-jade-500 inline-block" />
            Área restrita
          </div>
          <h1 className="font-display text-3xl text-ink-900">Gerenciar Usuários</h1>
          <p className="text-ink-500 text-sm mt-1">
            {usuarios.length} usuário{usuarios.length !== 1 ? 's' : ''} cadastrado{usuarios.length !== 1 ? 's' : ''} ·{' '}
            <span className="text-amber-600 font-medium">{pendentes.length} pendente{pendentes.length !== 1 ? 's' : ''}</span>
          </p>
        </div>
        <button
          onClick={onVoltar}
          className="flex items-center gap-2 px-4 py-2 border border-ink-200 rounded-xl
                     bg-white text-sm text-ink-600 hover:bg-ink-50 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Voltar
        </button>
      </div>

      <div className="max-w-2xl mx-auto space-y-6">

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-16">
            <div className="w-8 h-8 border-2 border-jade-500 border-t-transparent
                            rounded-full animate-spin" />
          </div>
        )}

        {/* Erro */}
        {erro && (
          <div className="bg-rose-50 border border-rose-200 rounded-xl px-5 py-4
                          text-rose-700 text-sm">
            <strong>Erro:</strong> {erro}
            <button onClick={carregarUsuarios}
                    className="ml-3 underline hover:no-underline">
              Tentar novamente
            </button>
          </div>
        )}

        {/* Pendentes */}
        {!loading && pendentes.length > 0 && (
          <section>
            <h2 className="text-xs font-mono text-amber-600 uppercase tracking-widest mb-3">
              ⏳ Aguardando aprovação ({pendentes.length})
            </h2>
            <div className="space-y-2">
              {pendentes.map(u => (
                <UserRow
                  key={u.id}
                  u={u}
                  eu={user?.id}
                  atualizando={atualizando}
                  onToggleAprovado={toggleAprovado}
                  onToggleAdmin={toggleAdmin}
                />
              ))}
            </div>
          </section>
        )}

        {/* Aprovados */}
        {!loading && aprovados.length > 0 && (
          <section>
            <h2 className="text-xs font-mono text-jade-600 uppercase tracking-widest mb-3">
              ✓ Aprovados ({aprovados.length})
            </h2>
            <div className="space-y-2">
              {aprovados.map(u => (
                <UserRow
                  key={u.id}
                  u={u}
                  eu={user?.id}
                  atualizando={atualizando}
                  onToggleAprovado={toggleAprovado}
                  onToggleAdmin={toggleAdmin}
                />
              ))}
            </div>
          </section>
        )}

        {/* Vazio */}
        {!loading && !erro && usuarios.length === 0 && (
          <div className="text-center py-16 text-ink-400 text-sm font-mono">
            Nenhum usuário cadastrado ainda.
          </div>
        )}

      </div>
    </div>
  );
}

// ── Linha de usuário ──
function UserRow({ u, eu, atualizando, onToggleAprovado, onToggleAdmin }) {
  const isEu          = u.id === eu;
  const loadAprovado  = atualizando === u.id + '_aprovado';
  const loadAdmin     = atualizando === u.id + '_admin';

  return (
    <div className={`flex items-center justify-between gap-4 px-5 py-4 bg-white
                     rounded-xl border transition-all
                     ${u.aprovado ? 'border-ink-100' : 'border-amber-200 bg-amber-50'}`}>

      {/* Email + badges */}
      <div className="flex items-center gap-3 min-w-0">
        {/* Avatar inicial */}
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center
                         text-xs font-mono font-bold flex-shrink-0
                         ${u.admin
                           ? 'bg-jade-100 text-jade-700 border border-jade-200'
                           : 'bg-ink-100 text-ink-500'}`}>
          {u.email[0].toUpperCase()}
        </div>

        <div className="min-w-0">
          <p className="text-sm text-ink-800 font-medium truncate">
            {u.email}
            {isEu && (
              <span className="ml-2 text-xs font-mono text-ink-400">(você)</span>
            )}
          </p>
          <div className="flex items-center gap-2 mt-0.5">
            {u.admin && (
              <span className="text-xs font-mono text-jade-600 bg-jade-50
                               border border-jade-200 px-1.5 py-0.5 rounded-md">
                👑 Admin
              </span>
            )}
            <span className={`text-xs font-mono ${u.aprovado ? 'text-jade-600' : 'text-amber-600'}`}>
              {u.aprovado ? '● Ativo' : '○ Pendente'}
            </span>
          </div>
        </div>
      </div>

      {/* Ações */}
      <div className="flex items-center gap-2 flex-shrink-0">
        {/* Aprovar / Reprovar */}
        <button
          onClick={() => onToggleAprovado(u.id, u.aprovado)}
          disabled={!!atualizando}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all
                      disabled:opacity-50 disabled:cursor-not-allowed
                      ${u.aprovado
                        ? 'bg-rose-50 border-rose-200 text-rose-600 hover:bg-rose-100'
                        : 'bg-jade-50 border-jade-200 text-jade-700 hover:bg-jade-100'}`}
        >
          {loadAprovado ? <MiniSpinner /> : (u.aprovado ? 'Reprovar' : 'Aprovar')}
        </button>

        {/* Tornar Admin / Remover Admin */}
        <button
          onClick={() => onToggleAdmin(u.id, u.admin)}
          disabled={!!atualizando || isEu}
          title={isEu ? 'Você não pode remover seu próprio admin' : ''}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all
                      disabled:opacity-40 disabled:cursor-not-allowed
                      ${u.admin
                        ? 'bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100'
                        : 'bg-ink-50 border-ink-200 text-ink-600 hover:bg-ink-100'}`}
        >
          {loadAdmin ? <MiniSpinner /> : (u.admin ? 'Remover admin' : 'Tornar admin')}
        </button>
      </div>
    </div>
  );
}

function MiniSpinner() {
  return (
    <svg className="w-3.5 h-3.5 animate-spin inline" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10"
              stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}
