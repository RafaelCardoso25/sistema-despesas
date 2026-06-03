import { useState } from 'react';
import TabResumo from './TabResumo';
import TabLimites from './TabLimites';
import TabVariacao from './TabVariacao';
import TabAlertas from './TabAlertas';
import TabComparacao from './TabComparacao';
import TabHistorico from './TabHistorico';
import TabProjecao from './TabProjecao';
import ConfirmModal from './ConfirmModal';
import { useToast } from './Toast';
import { exportExcel, exportPDF, buildAlertas } from '../utils/exportUtils';
import { buildSession, saveSession } from '../utils/sessionManager';
import { brl } from '../utils/formatters';
import { MESES, ANO_ORCAMENTO } from '../config';

const TABS = [
  {
    id: 'resumo', label: 'Resumo',
    icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>,
  },
  {
    id: 'limites', label: `Limites ${ANO_ORCAMENTO}`,
    icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>,
  },
  {
    id: 'variacao', label: 'Variação',
    icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>,
  },
  {
    id: 'projecao', label: 'Projeção',
    icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" /></svg>,
  },
  {
    id: 'alertas', label: 'Alertas',
    icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>,
  },
  {
    id: 'comparacao', label: 'Comparação real',
    icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" /></svg>,
  },
  {
    id: 'historico', label: 'Histórico',
    icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>,
  },
];

export default function Dashboard({ session, updateSession, onReset }) {
  const [tab, setTab]                   = useState('resumo');
  const [exporting, setExporting]       = useState(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const { showToast, ToastComponent }   = useToast();

  const {
    baseData,
    fileName,
    tetosAjustados,
    logAjustes,
    mesAtual,
    comparacaoState,
    metaAnual,
  } = session;

  const totalAnual = baseData.reduce((s, d) =>
    s + (tetosAjustados[d.cat] != null ? tetosAjustados[d.cat] : d.total), 0
  );

  const alertCount = buildAlertas(baseData).length;
  const logCount   = logAjustes.length;

  // ── Handlers existentes ───────────────────────────────────────────────────

  const handleAjustarTeto = (cat, novoTeto) => {
    const novos = { ...tetosAjustados, [cat]: novoTeto };
    const entry = {
      id: Date.now() + Math.random(),
      timestamp: new Date().toISOString(),
      tipo: 'ajuste_teto',
      catOrigem: cat,
      valor: novoTeto,
      nota: `Teto de "${cat}" ajustado para ${brl(novoTeto)}`,
    };
    updateSession({
      tetosAjustados: novos,
      logAjustes: [...logAjustes, entry],
    });
  };

  // Aplica vários tetos de uma vez — evita bug de state batch no loop
  const handleAjustarTetosBatch = (ajustes) => {
    const novos = { ...tetosAjustados };
    const entries = [];
    ajustes.forEach(({ cat, novoTeto }) => {
      novos[cat] = novoTeto;
      entries.push({
        id: Date.now() + Math.random(),
        timestamp: new Date().toISOString(),
        tipo: 'ajuste_teto',
        catOrigem: cat,
        valor: novoTeto,
        nota: `Teto de "${cat}" ajustado para ${brl(novoTeto)}`,
      });
    });
    updateSession({
      tetosAjustados: novos,
      logAjustes: [...logAjustes, ...entries],
    });
  };

  const handleDeducao = (novasDeducoes) => {
    updateSession({ deducoesAplicadas: novasDeducoes });
  };

  const handleLog = (entry) => {
    updateSession({ logAjustes: [...logAjustes, entry] });
  };

  const handleComparacaoChange = (newState) => {
    updateSession({ comparacaoState: newState });
  };

  const handleClearLog = () => {
    updateSession({ logAjustes: [] });
    showToast('Histórico limpo com sucesso.', 'success');
  };

  const handleSaveSession = () => {
    try {
      const sess = buildSession({
        baseData,
        tetosAjustados,
        comparacaoState,
        logAjustes,
        mesAtual,
        fileName,
        deducoesAplicadas: session.deducoesAplicadas || {},
        metaAnual: session.metaAnual ?? null,
      });
      saveSession(sess);
      showToast('Sessão salva com sucesso!', 'success');
    } catch {
      showToast('Erro ao salvar sessão. Tente novamente.', 'error');
    }
  };

  const handleExport = async (type) => {
    setExporting(type);
    try {
      if (type === 'excel') await exportExcel(baseData, tetosAjustados, metaAnual);
      else await exportPDF(baseData, tetosAjustados, metaAnual);
      showToast(type === 'excel' ? 'Excel exportado!' : 'PDF exportado!', 'success');
    } catch {
      showToast('Erro ao exportar. Tente novamente.', 'error');
    } finally {
      setExporting(null);
    }
  };

  // ── Handlers da meta ──────────────────────────────────────────────────────

  const handleDefinirMeta = (novaMeta) => {
    if (novaMeta === null) {
      const entry = {
        id: Date.now() + Math.random(),
        timestamp: new Date().toISOString(),
        tipo: 'meta_removida',
        nota: 'Meta anual removida. Tetos resetados para o histórico 2025.',
        valor: 0,
      };
      updateSession({
        metaAnual: null,
        tetosAjustados: {},
        logAjustes: [...logAjustes, entry],
      });
      showToast('Meta removida. Limites resetados.', 'success');
      return;
    }

    const totalBase  = baseData.reduce((s, d) => s + d.total, 0);
    const novosTetos = {};
    baseData.forEach(d => {
      novosTetos[d.cat] = totalBase > 0
        ? (d.total / totalBase) * novaMeta
        : novaMeta / baseData.length;
    });

    const entry = {
      id: Date.now() + Math.random(),
      timestamp: new Date().toISOString(),
      tipo: 'meta_definida',
      nota: `Meta anual definida em ${brl(novaMeta)}. Limites recalculados proporcionalmente.`,
      valor: novaMeta,
    };

    updateSession({
      metaAnual: novaMeta,
      tetosAjustados: novosTetos,
      logAjustes: [...logAjustes, entry],
    });
    showToast(`Meta de ${brl(novaMeta)} aplicada a todas as categorias.`, 'success');
  };

  const handleAjustarMeta = (novaMeta) => {
    const entry = {
      id: Date.now() + Math.random(),
      timestamp: new Date().toISOString(),
      tipo: 'meta_ajustada',
      nota: `Meta anual ajustada para ${brl(novaMeta)} após edição de limite individual.`,
      valor: novaMeta,
    };
    updateSession({
      metaAnual: novaMeta > 0 ? novaMeta : null,
      logAjustes: [...logAjustes, entry],
    });
  };

  const exibeTeto = metaAnual != null ? metaAnual : totalAnual;

  return (
    <div className="min-h-screen">
      {confirmReset && (
        <ConfirmModal
          title="Carregar nova planilha?"
          message="A sessão atual será encerrada. Seus ajustes foram salvos automaticamente e podem ser restaurados na tela inicial."
          confirmLabel="Sim, nova planilha"
          onConfirm={onReset}
          onClose={() => setConfirmReset(false)}
        />
      )}
      {confirmClear && (
        <ConfirmModal
          title="Limpar histórico?"
          message="Todos os registros de ajustes e redistribuições serão apagados. Esta ação não pode ser desfeita."
          confirmLabel="Sim, limpar"
          onConfirm={handleClearLog}
          onClose={() => setConfirmClear(false)}
        />
      )}

      {ToastComponent}

      <header className="border-b border-ink-100 bg-white sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 bg-jade-500 rounded-lg flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24"
                   stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0
                     002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2
                     2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2
                     2 0 01-2-2z" />
              </svg>
            </div>
            <div>
              <span className="font-display text-ink-900 text-lg">Controle Orçamentário</span>
              <span className="text-xs text-ink-400 font-mono ml-2">{fileName}</span>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <div className="hidden md:flex items-center gap-1.5 border border-jade-200
                            bg-jade-50 rounded-lg px-2 py-1.5">
              <span className="w-2 h-2 rounded-full bg-jade-500 animate-pulse inline-block" />
              <select
                value={mesAtual}
                onChange={e => updateSession({ mesAtual: Number(e.target.value) })}
                className="text-xs font-mono text-jade-700 bg-transparent
                           focus:outline-none cursor-pointer"
              >
                {MESES.map((m, i) => <option key={i} value={i}>{m}</option>)}
              </select>
            </div>

            <div className="hidden md:flex items-center gap-1.5 text-xs font-mono text-ink-500">
              {metaAnual != null ? (
                <span className="bg-jade-50 text-jade-700 border border-jade-200
                                 px-2 py-0.5 rounded-full flex items-center gap-1">
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24"
                       stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Meta: {brl(exibeTeto)}
                </span>
              ) : (
                <span className="bg-ink-50 text-ink-600 border border-ink-200
                                 px-2 py-0.5 rounded-full">
                  {brl(totalAnual)}
                </span>
              )}
            </div>

            <button onClick={handleSaveSession}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono border
                         border-amber-300 text-amber-700 bg-amber-50 hover:bg-amber-100
                         rounded-lg transition-colors">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24"
                   stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0
                     00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
              </svg>
              Salvar sessão
            </button>

            <button onClick={() => handleExport('excel')} disabled={!!exporting}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono border
                         border-jade-300 text-jade-700 bg-jade-50 hover:bg-jade-100
                         rounded-lg disabled:opacity-50">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24"
                   stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1
                     1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              {exporting === 'excel' ? 'Gerando...' : 'Excel'}
            </button>

            <button onClick={() => handleExport('pdf')} disabled={!!exporting}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono border
                         border-rose-200 text-rose-700 bg-rose-50 hover:bg-rose-100
                         rounded-lg disabled:opacity-50">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24"
                   stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0
                     0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
              {exporting === 'pdf' ? 'Gerando...' : 'PDF'}
            </button>

            <button onClick={() => setConfirmReset(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono border
                         border-ink-200 text-ink-600 hover:bg-ink-50 rounded-lg">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24"
                   stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
              Nova planilha
            </button>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-6 flex gap-0 overflow-x-auto">
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium
                border-b-2 transition-colors whitespace-nowrap
                ${tab === t.id
                  ? 'border-jade-500 text-jade-700'
                  : 'border-transparent text-ink-400 hover:text-ink-700'
                }`}>
              {t.icon}
              {t.label}
              {t.id === 'alertas' && alertCount > 0 && (
                <span className="bg-rose-500 text-white text-xs font-mono w-4 h-4
                                 rounded-full flex items-center justify-center">
                  {alertCount > 9 ? '9+' : alertCount}
                </span>
              )}
              {t.id === 'historico' && logCount > 0 && (
                <span className="bg-amber-500 text-white text-xs font-mono w-4 h-4
                                 rounded-full flex items-center justify-center">
                  {logCount > 9 ? '9+' : logCount}
                </span>
              )}
            </button>
          ))}
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {tab === 'resumo' && (
          <TabResumo
            data={baseData}
            tetosAjustados={tetosAjustados}
            mesAtual={mesAtual}
            comparacaoResultado={comparacaoState?.resultado || null}
            metaAnual={metaAnual}
            onDefinirMeta={handleDefinirMeta}
          />
        )}
        {tab === 'limites' && (
          <TabLimites
            data={baseData}
            tetosAjustados={tetosAjustados}
            onAjustarTeto={handleAjustarTeto}
            onAjustarTetosBatch={handleAjustarTetosBatch}
            metaAnual={metaAnual}
            onAjustarMeta={handleAjustarMeta}
          />
        )}
        {tab === 'variacao' && (
          <TabVariacao data={baseData} />
        )}
        {tab === 'projecao' && (
          <TabProjecao
            data={baseData}
            tetosAjustados={tetosAjustados}
            mesAtual={mesAtual}
            comparacaoResultado={comparacaoState?.resultado || null}
            metaAnual={metaAnual}
          />
        )}
        {tab === 'alertas' && (
          <TabAlertas data={baseData} />
        )}
        {tab === 'comparacao' && (
          <TabComparacao
            baseData={baseData}
            tetosAjustados={tetosAjustados}
            deducoesAplicadas={session.deducoesAplicadas || {}}
            mesAtual={mesAtual}
            onDeducao={handleDeducao}
            onLog={handleLog}
            comparacaoState={comparacaoState}
            onComparacaoChange={handleComparacaoChange}
          />
        )}
        {tab === 'historico' && (
          <TabHistorico
            logAjustes={logAjustes}
            onClearLog={() => setConfirmClear(true)}
          />
        )}
      </main>
    </div>
  );
}