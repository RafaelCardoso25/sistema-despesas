import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { ANO_ORCAMENTO, ANO_BASE } from '../config';

export default function LoginPage() {
  const { login, cadastro } = useAuth();

  const [aba, setAba]           = useState('login');
  const [email, setEmail]       = useState('');
  const [senha, setSenha]       = useState('');
  const [confirma, setConfirma] = useState('');
  const [lembrar, setLembrar]   = useState(false);
  const [loading, setLoading]   = useState(false);
  const [msg, setMsg]           = useState(null);

  const trocarAba = (nova) => {
    setAba(nova);
    setMsg(null);
    setEmail('');
    setSenha('');
    setConfirma('');
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setMsg(null);
    setLoading(true);
    const result = await login(email.trim(), senha, lembrar);
    setLoading(false);
    if (!result.ok) setMsg({ tipo: 'erro', texto: result.msg });
  };

  const handleCadastro = async (e) => {
    e.preventDefault();
    setMsg(null);
    if (senha !== confirma) {
      setMsg({ tipo: 'erro', texto: 'As senhas não coincidem.' });
      return;
    }
    setLoading(true);
    const result = await cadastro(email.trim(), senha);
    setLoading(false);
    if (result.ok) {
      setMsg({
        tipo: 'ok',
        texto: '✓ Conta criada! Aguarde a aprovação do administrador para acessar.',
      });
      setEmail('');
      setSenha('');
      setConfirma('');
    } else {
      setMsg({ tipo: 'erro', texto: result.msg });
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4"
         style={{ background: '#f5f4f0' }}>

      <div className="w-full max-w-[820px] flex rounded-2xl overflow-hidden
                      border border-ink-200 shadow-lg bg-white">

        {/* ── Painel esquerdo ── */}
        <div className="hidden md:flex flex-col justify-between flex-1 p-12
                        border-r border-ink-100" style={{ background: '#f0efeb' }}>
          <div>
            {/* Marca */}
            <div className="flex items-center gap-3 mb-10">
              <div className="w-10 h-10 rounded-xl bg-jade-600 flex items-center
                              justify-center shadow-sm">
                <svg width="20" height="20" fill="none" viewBox="0 0 24 24"
                     stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0
                           012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0
                           002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0
                           10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2
                           2 0 00-2 2" />
                </svg>
              </div>
              <div>
                <div className="font-display text-base text-ink-900 leading-tight">
                  Controle Orçamentário
                </div>
                <div className="text-xs font-mono text-ink-400">{ANO_ORCAMENTO}</div>
              </div>
            </div>

            <h2 className="font-display text-3xl text-ink-900 leading-tight mb-4">
              Despesas sob<br />
              <span className="italic text-jade-600">controle.</span>
            </h2>
            <p className="text-ink-500 text-sm leading-relaxed max-w-xs">
              Importe a planilha de {ANO_BASE}, defina limites por categoria
              e acompanhe os gastos mensais em tempo real.
            </p>

            {/* Features */}
            <div className="mt-8 space-y-2.5">
              {[
                {
                  icon: (
                    <svg width="14" height="14" fill="none" viewBox="0 0 24 24"
                         stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3 3h18v18H3zM3 9h18M3 15h18M9 3v18" />
                    </svg>
                  ),
                  cor: 'text-jade-600 bg-jade-50 border-jade-200',
                  texto: 'Análise por categoria e mês',
                },
                {
                  icon: (
                    <svg width="14" height="14" fill="none" viewBox="0 0 24 24"
                         stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71
                               3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                    </svg>
                  ),
                  cor: 'text-amber-600 bg-amber-50 border-amber-200',
                  texto: 'Alertas de limite excedido',
                },
                {
                  icon: (
                    <svg width="14" height="14" fill="none" viewBox="0 0 24 24"
                         stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3 15a4 4 0 004 4h9a5 5 0 10-4.546-2.916A4 4 0 003 15z" />
                    </svg>
                  ),
                  cor: 'text-ink-500 bg-ink-50 border-ink-200',
                  texto: 'Sessões salvas na nuvem',
                },
              ].map(({ icon, cor, texto }) => (
                <div key={texto}
                     className="flex items-center gap-3 px-4 py-3 bg-white
                                rounded-xl border border-ink-100 text-sm text-ink-600">
                  <span className={`w-6 h-6 rounded-lg flex items-center justify-center
                                   flex-shrink-0 border ${cor}`}>
                    {icon}
                  </span>
                  {texto}
                </div>
              ))}
            </div>
          </div>

          <p className="text-xs text-ink-400 font-mono mt-8 flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-jade-500 inline-block" />
            Acesso restrito · sessão criptografada
          </p>
        </div>

        {/* ── Painel direito (formulário) ── */}
        <div className="w-full md:w-[360px] flex-shrink-0 flex flex-col
                        justify-center p-10">

          <h3 className="font-display text-xl text-ink-900 mb-1">
            {aba === 'login' ? 'Bem-vindo de volta' : 'Criar sua conta'}
          </h3>
          <p className="text-sm text-ink-500 mb-6">
            {aba === 'login'
              ? 'Entre com suas credenciais para continuar'
              : 'Preencha os dados para solicitar acesso'}
          </p>

          {/* Tabs */}
          <div className="flex gap-1 p-1 bg-ink-50 rounded-xl mb-6 border border-ink-100">
            {[['login', 'Entrar'], ['cadastro', 'Criar conta']].map(([key, label]) => (
              <button
                key={key}
                onClick={() => trocarAba(key)}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
                  aba === key
                    ? 'bg-white text-ink-900 shadow-sm border border-ink-200'
                    : 'text-ink-500 hover:text-ink-700'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* ── Login ── */}
          {aba === 'login' && (
            <form onSubmit={handleLogin} className="space-y-4">
              <Field label="E-mail">
                <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="seu@email.com" required autoComplete="email"
                  className={inputCls} />
              </Field>
              <Field label="Senha">
                <input type="password" value={senha} onChange={e => setSenha(e.target.value)}
                  placeholder="••••••••" required autoComplete="current-password"
                  className={inputCls} />
              </Field>

              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input type="checkbox" checked={lembrar}
                  onChange={e => setLembrar(e.target.checked)}
                  className="w-4 h-4 accent-jade-600 cursor-pointer" />
                <span className="text-xs text-ink-500">Lembrar de mim por 30 dias</span>
              </label>

              <SubmitBtn loading={loading} label="Entrar na plataforma" loadingLabel="Verificando..." />
            </form>
          )}

          {/* ── Cadastro ── */}
          {aba === 'cadastro' && (
            <form onSubmit={handleCadastro} className="space-y-4">
              <Field label="E-mail">
                <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="seu@email.com" required className={inputCls} />
              </Field>
              <Field label="Senha">
                <input type="password" value={senha} onChange={e => setSenha(e.target.value)}
                  placeholder="Mínimo 6 caracteres" minLength={6} required className={inputCls} />
              </Field>
              <Field label="Confirmar senha">
                <input type="password" value={confirma} onChange={e => setConfirma(e.target.value)}
                  placeholder="Repita a senha" required className={inputCls} />
              </Field>

              <SubmitBtn loading={loading} label="Criar minha conta" loadingLabel="Criando conta..." />
            </form>
          )}

          {/* Feedback */}
          {msg && (
            <div className={`mt-4 px-4 py-3 rounded-xl text-xs text-center
                            leading-relaxed border ${
              msg.tipo === 'ok'
                ? 'bg-jade-50 border-jade-200 text-jade-700'
                : 'bg-rose-50 border-rose-200 text-rose-700'
            }`}>
              {msg.texto}
            </div>
          )}

          <div className="mt-6 pt-5 border-t border-ink-100 text-center">
            <p className="text-xs text-ink-400 leading-relaxed">
              Novas contas requerem aprovação do administrador.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Sub-componentes ──
const inputCls = `w-full px-3.5 py-2.5 rounded-xl border border-ink-200 bg-ink-50
  text-ink-900 text-sm placeholder-ink-300 focus:outline-none focus:border-jade-500
  focus:bg-white transition-all`;

function Field({ label, children }) {
  return (
    <div>
      <label className="block text-xs font-mono text-ink-500 mb-1.5 uppercase tracking-wider">
        {label}
      </label>
      {children}
    </div>
  );
}

function SubmitBtn({ loading, label, loadingLabel }) {
  return (
    <button type="submit" disabled={loading}
      className="w-full py-2.5 mt-1 bg-jade-600 hover:bg-jade-700 text-white
                 text-sm font-medium rounded-xl transition-all
                 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[.98]">
      {loading ? (
        <span className="flex items-center justify-center gap-2">
          <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10"
                    stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          {loadingLabel}
        </span>
      ) : label}
    </button>
  );
}
