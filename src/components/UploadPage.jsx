import { useState, useRef, useEffect } from 'react';
import { parseExcel } from '../utils/parseExcel';
import { loadSession } from '../utils/sessionManager';
import { ANO_BASE, ANO_ORCAMENTO } from '../config';
import { useAuth } from '../contexts/AuthContext';
import { listarSessoes, carregarSessao, deletarSessao } from '../utils/dbSessao';

export default function UploadPage({ onData, onLoadSession, autoSavedSession }) {
  const { user } = useAuth();

  const [dragging, setDragging]           = useState(false);
  const [loading, setLoading]             = useState(false);
  const [error, setError]                 = useState(null);
  const [cloudSessoes, setCloudSessoes]   = useState([]);
  const [loadingCloud, setLoadingCloud]   = useState(false);
  const [deletando, setDeletando]         = useState(null); // id sendo deletado
  const inputRef   = useRef();
  const sessionRef = useRef();

  // Carrega sessões da nuvem ao montar (se logado)
  useEffect(() => {
    if (!user) return;
    const fetch = async () => {
      setLoadingCloud(true);
      try {
        const lista = await listarSessoes();
        setCloudSessoes(lista);
      } catch (err) {
        console.warn('Erro ao listar sessões:', err.message);
      } finally {
        setLoadingCloud(false);
      }
    };
    fetch();
  }, [user]);

  const handleFile = async (file) => {
    if (!file) return;
    const ext = file.name.split('.').pop().toLowerCase();
    if (!['xls', 'xlsx', 'xlsm'].includes(ext)) {
      setError('Formato inválido. Envie um arquivo .xls, .xlsx ou .xlsm');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const data = await parseExcel(file);
      onData(data, file.name);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSession = async (file) => {
    if (!file) return;
    setError(null);
    setLoading(true);
    try {
      const sess = await loadSession(file);
      onLoadSession(sess);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLoadCloud = async (id) => {
    setError(null);
    setLoading(true);
    try {
      const dados = await carregarSessao(id);
      onLoadSession(dados, id); // passa o id para o App saber qual atualizar
    } catch (err) {
      setError('Erro ao carregar sessão da nuvem: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteCloud = async (e, id) => {
    e.stopPropagation();
    setDeletando(id);
    try {
      await deletarSessao(id);
      setCloudSessoes(prev => prev.filter(s => s.id !== id));
    } catch (err) {
      setError('Erro ao deletar sessão: ' + err.message);
    } finally {
      setDeletando(null);
    }
  };

  const onDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (!file) return;
    if (file.name.endsWith('.json')) handleSession(file);
    else handleFile(file);
  };

  const handleDownloadTemplate = () => {
    import('xlsx').then(XLSX => {
      const wb = XLSX.utils.book_new();
      const headers = ['Categoria','Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
      const exemplo = [
        ['Aluguel',           6810,6810,6810,6810,6810,6810,6810,6810,6810,6810,6810,6810],
        ['Energia Elétrica',  1200,1100,1300,1250,1400,1500,1600,1550,1350,1200,1100,1300],
        ['Folha de Pagamento',45000,45000,45000,45000,45000,45000,45000,45000,45000,45000,45000,45000],
        ['Telefonia / Internet',800,800,800,800,800,800,800,800,800,800,800,800],
        ['Manutenção',        500,0,2000,0,500,0,3000,0,500,0,1000,0],
        ['Brindes / Eventos', 0,0,500,0,0,0,1200,0,0,0,3000,5000],
      ];
      const ws = XLSX.utils.aoa_to_sheet([headers, ...exemplo]);
      ws['!cols'] = [{ wch: 28 }, ...Array(12).fill({ wch: 10 })];
      XLSX.utils.book_append_sheet(wb, ws, `Gastos ${ANO_BASE}`);
      XLSX.writeFile(wb, `template_orcamento_${ANO_BASE}.xlsx`);
    });
  };

  const formatDate = (iso) => {
    const d = new Date(iso);
    return d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 pb-10">
      <div className="text-center mb-12 fade-up">
        <div className="inline-flex items-center gap-2 bg-jade-50 text-jade-700 text-xs
                        font-mono px-3 py-1 rounded-full mb-6 border border-jade-200">
          <span className="w-1.5 h-1.5 rounded-full bg-jade-500 animate-pulse inline-block" />
          Sistema de Controle Orçamentário
        </div>
        <h1 className="font-display text-5xl md:text-6xl text-ink-900 leading-tight mb-4">
          Controle de<br />
          <span className="italic text-jade-600">Despesas {ANO_ORCAMENTO}</span>
        </h1>
        <p className="text-ink-500 text-lg max-w-md mx-auto leading-relaxed">
          Faça upload da planilha de gastos de {ANO_BASE} ou carregue uma sessão salva.
        </p>
      </div>

      {/* Banner sessão autosalva (localStorage) */}
      {autoSavedSession && (
        <div className="w-full max-w-lg mb-4 bg-amber-50 border border-amber-200
                        rounded-xl px-4 py-3 flex items-center justify-between gap-3 fade-up">
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-amber-600 flex-shrink-0" fill="none"
                 viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <p className="text-xs font-medium text-amber-800">Sessão local encontrada</p>
              <p className="text-xs text-amber-600 font-mono">{autoSavedSession.fileName}</p>
            </div>
          </div>
          <button
            onClick={() => onLoadSession(autoSavedSession)}
            className="flex-shrink-0 px-3 py-1.5 text-xs font-mono bg-amber-500
                       text-white rounded-lg hover:bg-amber-600 transition-colors"
          >
            Restaurar
          </button>
        </div>
      )}

      {/* Sessões salvas na nuvem */}
      {user && (
        <div className="w-full max-w-lg mb-4 fade-up">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-mono text-ink-400 uppercase tracking-widest">
              Sessões na nuvem
            </p>
            {loadingCloud && (
              <div className="w-3.5 h-3.5 border-2 border-jade-400 border-t-transparent
                              rounded-full animate-spin" />
            )}
          </div>

          {!loadingCloud && cloudSessoes.length === 0 && (
            <div className="text-xs text-ink-400 font-mono italic px-1">
              Nenhuma sessão salva ainda — aparecerá aqui após o primeiro upload.
            </div>
          )}

          {cloudSessoes.length > 0 && (
            <div className="space-y-2">
              {cloudSessoes.map(s => (
                <div key={s.id}
                     onClick={() => handleLoadCloud(s.id)}
                     className="flex items-center justify-between gap-3 px-4 py-3
                                bg-white border border-ink-100 rounded-xl cursor-pointer
                                hover:border-jade-300 hover:bg-jade-50 transition-all group">
                  <div className="flex items-center gap-3 min-w-0">
                    {/* Ícone nuvem */}
                    <svg className="w-4 h-4 text-jade-500 flex-shrink-0" fill="none"
                         viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                        d="M3 15a4 4 0 004 4h9a5 5 0 10-4.546-2.916A4 4 0 003 15z" />
                    </svg>
                    <div className="min-w-0">
                      <p className="text-sm text-ink-800 font-medium truncate">{s.nome}</p>
                      <p className="text-xs text-ink-400 font-mono">
                        Atualizado {formatDate(s.atualizado_em)}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={(e) => handleDeleteCloud(e, s.id)}
                    disabled={deletando === s.id}
                    className="flex-shrink-0 p-1.5 rounded-lg text-ink-300
                               hover:text-rose-500 hover:bg-rose-50 transition-colors
                               opacity-0 group-hover:opacity-100"
                    title="Deletar sessão"
                  >
                    {deletando === s.id ? (
                      <div className="w-3.5 h-3.5 border-2 border-rose-400 border-t-transparent
                                      rounded-full animate-spin" />
                    ) : (
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24"
                           stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    )}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Drop zone */}
      <div
        className={`drop-zone w-full max-w-lg border-2 border-dashed rounded-2xl
                    p-12 text-center cursor-pointer transition-all
                    ${dragging
                      ? 'border-jade-500 bg-jade-50 scale-105'
                      : 'border-ink-200 bg-white hover:border-jade-400 hover:bg-jade-50'
                    } fade-up fade-up-1`}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current.click()}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".xls,.xlsx,.xlsm"
          className="hidden"
          onChange={(e) => handleFile(e.target.files[0])}
        />
        {loading ? (
          <div className="flex flex-col items-center gap-4">
            <div className="w-10 h-10 border-2 border-jade-500 border-t-transparent
                            rounded-full animate-spin" />
            <p className="text-ink-500 text-sm font-mono">Processando...</p>
          </div>
        ) : (
          <>
            <div className="w-16 h-16 bg-jade-50 border border-jade-200 rounded-2xl
                            flex items-center justify-center mx-auto mb-5">
              <svg width="28" height="28" fill="none" viewBox="0 0 24 24"
                   stroke="currentColor" className="text-jade-600">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0
                     01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <p className="text-ink-800 font-medium mb-1">Arraste sua planilha aqui</p>
            <p className="text-ink-400 text-sm">
              ou clique para selecionar · .xls · .xlsx · .xlsm
            </p>
          </>
        )}
      </div>

      {/* Botões secundários */}
      <div className="w-full max-w-lg mt-4 space-y-3 fade-up fade-up-2">
        <div className="flex items-center gap-3">
          <div className="flex-1 h-px bg-ink-100" />
          <span className="text-xs text-ink-400 font-mono">ou</span>
          <div className="flex-1 h-px bg-ink-100" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => sessionRef.current.click()}
            className="flex items-center justify-center gap-2 px-4 py-3 border
                       border-ink-200 rounded-xl bg-white hover:bg-ink-50 text-sm
                       text-ink-600 transition-colors"
          >
            <svg className="w-4 h-4 text-ink-400" fill="none" viewBox="0 0 24 24"
                 stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Carregar sessão
          </button>
          <button
            onClick={handleDownloadTemplate}
            className="flex items-center justify-center gap-2 px-4 py-3 border
                       border-jade-200 rounded-xl bg-jade-50 hover:bg-jade-100
                       text-sm text-jade-700 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586
                   a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Baixar template
          </button>
        </div>
        <input
          ref={sessionRef}
          type="file"
          accept=".json"
          className="hidden"
          onChange={(e) => handleSession(e.target.files[0])}
        />
      </div>

      {error && (
        <div className="mt-4 max-w-lg w-full bg-rose-50 border border-rose-200
                        rounded-xl px-4 py-3 text-rose-700 text-sm fade-up">
          <strong>Erro:</strong> {error}
        </div>
      )}

      {/* Formato esperado */}
      <div className="mt-8 max-w-lg w-full fade-up fade-up-3">
        <p className="text-xs text-ink-400 font-mono mb-3 uppercase tracking-widest">
          Formato esperado
        </p>
        <div className="bg-white border border-ink-100 rounded-xl overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-ink-50">
                {['Categoria', 'Jan', 'Fev', '...', 'Dez'].map(h => (
                  <th key={h} className="text-left px-4 py-2 text-ink-400 font-mono">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr className="border-t border-ink-50">
                <td className="px-4 py-2 text-ink-700 font-medium">Aluguel</td>
                <td className="px-4 py-2 text-jade-600 font-mono">6.810</td>
                <td className="px-4 py-2 text-jade-600 font-mono">6.810</td>
                <td className="px-4 py-2 text-ink-300">...</td>
                <td className="px-4 py-2 text-jade-600 font-mono">6.810</td>
              </tr>
              <tr className="border-t border-ink-50">
                <td className="px-4 py-2 text-ink-700 font-medium">Energia Elétrica</td>
                <td className="px-4 py-2 text-jade-600 font-mono">1.200</td>
                <td className="px-4 py-2 text-jade-600 font-mono">1.100</td>
                <td className="px-4 py-2 text-ink-300">...</td>
                <td className="px-4 py-2 text-jade-600 font-mono">1.300</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="text-xs text-ink-400 mt-2 font-mono">
          Também aceita: Jan-2025 · Janeiro · 01/01/2025 · january
        </p>
        <p className="text-xs text-ink-400 mt-1 font-mono">
          Despesas lançadas como negativo (-1.234) são lidas normalmente ·
          linhas de receita e de total são ignoradas
        </p>
      </div>
    </div>
  );
}
