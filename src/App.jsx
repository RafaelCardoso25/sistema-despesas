import { useState, useEffect, useRef } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import LoginPage from './components/LoginPage';
import UploadPage from './components/UploadPage';
import Dashboard from './components/Dashboard';
import AdminPage from './components/AdminPage';
import { saveAutoSession, loadAutoSession } from './utils/autoSave';
import { criarSessao, atualizarSessao } from './utils/dbSessao';

function buildNomeSessao(fileName) {
  const data = new Date().toLocaleDateString('pt-BR');
  return `${fileName} — ${data}`;
}

// Normaliza/migra uma sessão carregada (autosave local, JSON ou nuvem) para o
// formato atual com biblioteca de comparações reais.
function migrarSessao(s) {
  if (!s) return s;
  const out = {
    ...s,
    tetosAjustados:   s.tetosAjustados   || {},
    logAjustes:       s.logAjustes       || [],
    mesAtual:         s.mesAtual ?? new Date().getMonth(),
    metaAnual:        s.metaAnual ?? null,
    comparacoesSalvas: Array.isArray(s.comparacoesSalvas) ? s.comparacoesSalvas : [],
    comparacaoAtivaId: s.comparacaoAtivaId ?? null,
  };

  // Formato antigo: uma comparação única (comparacaoState) + deduções globais.
  // Converte na primeira comparação salva, preservando o trabalho anterior.
  if (out.comparacoesSalvas.length === 0 && s.comparacaoState?.realData) {
    const nova = {
      id: `cmp_migrado_${Date.now()}`,
      nome: s.comparacaoState.realFileName || 'Comparação importada',
      criadaEm: new Date().toISOString(),
      atualizadaEm: new Date().toISOString(),
      realData: s.comparacaoState.realData,
      realFileName: s.comparacaoState.realFileName || '',
      deducoesAplicadas: s.deducoesAplicadas || {},
    };
    out.comparacoesSalvas = [nova];
    out.comparacaoAtivaId = nova.id;
  }

  // Campos antigos não são mais usados diretamente
  delete out.comparacaoState;
  delete out.deducoesAplicadas;
  return out;
}

function AppInner() {
  const { user, isAdmin, loading, logout } = useAuth();
  const [session, setSession]   = useState(null);
  const [view, setView]         = useState('app'); // 'app' | 'admin'
  const cloudIdRef              = useRef(null);
  const sessionRef             = useRef(null);

  // Mantém sempre a última sessão acessível fora do ciclo de render
  useEffect(() => { sessionRef.current = session; }, [session]);

  // Autosave local + nuvem toda vez que session muda
  useEffect(() => {
    if (!session) return;

    // 1. LocalStorage (fallback offline)
    saveAutoSession(session);

    // 2. Nuvem com debounce de 2s
    if (!user) return;
    const timer = setTimeout(async () => {
      try {
        if (cloudIdRef.current) {
          await atualizarSessao(cloudIdRef.current, session);
        } else {
          const registro = await criarSessao(session, buildNomeSessao(session.fileName));
          cloudIdRef.current = registro.id;
        }
      } catch (err) {
        console.warn('Cloud autosave falhou (offline?):', err.message);
      }
    }, 2000);

    return () => clearTimeout(timer);
  }, [session, user]);

  // Proteção: salva na nuvem imediatamente ao fechar/esconder a aba,
  // eliminando a janela de 2s do debounce em que a última edição se perderia.
  useEffect(() => {
    if (!user) return;

    const flush = () => {
      const s = sessionRef.current;
      if (!s) return;
      try {
        if (cloudIdRef.current) {
          atualizarSessao(cloudIdRef.current, s);
        } else {
          criarSessao(s, buildNomeSessao(s.fileName))
            .then(reg => { cloudIdRef.current = reg.id; })
            .catch(() => {});
        }
      } catch {
        /* ignora — o localStorage já guardou a versão mais recente */
      }
    };

    const onVisibility = () => {
      if (document.visibilityState === 'hidden') flush();
    };

    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', flush);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', flush);
    };
  }, [user]);

  const handleData = (baseData, fileName) => {
    cloudIdRef.current = null;
    setSession({
      baseData,
      fileName,
      tetosAjustados: {},
      logAjustes: [],
      mesAtual: new Date().getMonth(),
      comparacoesSalvas: [],
      comparacaoAtivaId: null,
      metaAnual: null,
    });
  };

  const handleLoadSession = (savedSession, cloudId = null) => {
    cloudIdRef.current = cloudId;
    setSession(migrarSessao(savedSession));
  };

  const handleReset = () => {
    cloudIdRef.current = null;
    setSession(null);
    setView('app');
  };

  const updateSession = (patch) =>
    setSession(prev => ({ ...prev, ...patch }));

  // ── Loading inicial ──
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-jade-500 border-t-transparent
                        rounded-full animate-spin" />
      </div>
    );
  }

  // ── Não logado ──
  if (!user) return <LoginPage />;

  // ── Conteúdo principal ──
  const renderConteudo = () => {
    if (view === 'admin' && isAdmin) {
      return <AdminPage onVoltar={() => setView('app')} />;
    }
    if (session) {
      return (
        <Dashboard
          session={session}
          updateSession={updateSession}
          onReset={handleReset}
        />
      );
    }
    return (
      <UploadPage
        onData={handleData}
        onLoadSession={handleLoadSession}
        autoSavedSession={loadAutoSession()}
      />
    );
  };

  return (
    <>
      {renderConteudo()}

      {/* ── Barra inferior ── */}
      <div className="fixed bottom-0 left-0 right-0 h-8 bg-white border-t
                      border-ink-100 flex items-center justify-end px-4 gap-3
                      z-50 text-xs font-mono">

        {/* Link admin — só para admins, e só fora da view admin */}
        {isAdmin && view !== 'admin' && (
          <button
            onClick={() => setView('admin')}
            className="flex items-center gap-1.5 px-2.5 py-1 bg-jade-50
                       border border-jade-200 text-jade-700 rounded-md
                       hover:bg-jade-100 transition-colors"
          >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0
                   002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0
                   001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0
                   00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0
                   00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0
                   00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0
                   00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0
                   001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608
                   2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Admin
          </button>
        )}

        <span className="text-ink-400">Logado como</span>
        <span className="text-ink-600 font-medium">{user.email}</span>

        <button
          onClick={logout}
          className="px-2.5 py-1 bg-rose-50 border border-rose-200 text-rose-600
                     rounded-md hover:bg-rose-100 transition-colors"
        >
          Sair
        </button>
      </div>
    </>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppInner />
    </AuthProvider>
  );
}
