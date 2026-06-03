import { useState, useRef } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, ReferenceLine
} from 'recharts';
import { parseExcel } from '../utils/parseExcel';
import { recalcularLimites, aplicarDeducao, detectarUltimoMes } from '../utils/recalculo';
import { exportComparacaoExcel, exportComparacaoPDF } from '../utils/exportUtils';
import { formatLogEntry } from '../utils/sessionManager';
import { brl } from '../utils/formatters';
import { MESES } from '../config';

function UploadZone({ onFile, loading }) {
  const [dragging, setDragging] = useState(false);
  const ref = useRef();
  const handle = (file) => {
    if (!file) return;
    const ext = file.name.split('.').pop().toLowerCase();
    if (!['xls', 'xlsx', 'xlsm'].includes(ext)) return;
    onFile(file);
  };
  return (
    <div
      className={`border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all
        ${dragging ? 'border-jade-500 bg-jade-50' : 'border-ink-200 bg-white hover:border-jade-400 hover:bg-jade-50'}`}
      onDragOver={e => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={e => { e.preventDefault(); setDragging(false); handle(e.dataTransfer.files[0]); }}
      onClick={() => ref.current.click()}
    >
      <input ref={ref} type="file" accept=".xls,.xlsx,.xlsm" className="hidden"
        onChange={e => handle(e.target.files[0])} />
      {loading ? (
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-jade-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-ink-400 font-mono">Processando planilha 2026...</p>
        </div>
      ) : (
        <>
          <div className="w-12 h-12 bg-jade-50 border border-jade-200 rounded-xl
                          flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-jade-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
          </div>
          <p className="font-medium text-ink-800 mb-1">Arraste a planilha real de 2026</p>
          <p className="text-sm text-ink-400">ou clique para selecionar · .xls · .xlsx</p>
        </>
      )}
    </div>
  );
}

function StatusBadge({ pct, estourou, pago }) {
  if (pago) return <span className="bg-jade-100 text-jade-700 text-xs font-mono px-2 py-0.5 rounded-full border border-jade-300">✓ Pago</span>;
  if (estourou) return <span className="bg-rose-100 text-rose-700 text-xs font-mono px-2 py-0.5 rounded-full">Estourou</span>;
  if (pct >= 90) return <span className="bg-amber-100 text-amber-700 text-xs font-mono px-2 py-0.5 rounded-full">Crítico</span>;
  if (pct >= 70) return <span className="bg-amber-50 text-amber-600 text-xs font-mono px-2 py-0.5 rounded-full border border-amber-200">Atenção</span>;
  return <span className="bg-jade-50 text-jade-700 text-xs font-mono px-2 py-0.5 rounded-full border border-jade-200">OK</span>;
}

function ProgressBar({ pct, estourou, pago }) {
  const clamped = Math.min(pct, 100);
  const color = pago
    ? '#1d9e6a'
    : estourou
      ? '#e11d48'
      : pct >= 90
        ? '#f88007'
        : pct >= 70
          ? '#fea520'
          : '#1d9e6a';
  return (
    <div className="w-full h-1.5 bg-ink-100 rounded-full overflow-hidden">
      <div className="h-full rounded-full transition-all duration-500"
        style={{ width: `${clamped}%`, background: color }} />
    </div>
  );
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-ink-100 rounded-xl px-4 py-3 shadow-sm text-xs">
      <p className="font-medium text-ink-800 mb-2">{label}</p>
      {payload.map((p, i) => p.value != null && (
        <p key={i} style={{ color: p.color }} className="font-mono">{p.name}: {brl(p.value)}</p>
      ))}
    </div>
  );
};

function DeducaoModal({ catOrigem, resultado, onConfirm, onClose }) {
  const [valorStr, setValorStr] = useState('');
  const [selecionadas, setSelecionadas] = useState([]);
  const [busca, setBusca] = useState('');

  const catData = resultado.find(r => r.cat === catOrigem);
  const excedente = catData ? Math.max(0, catData.gastoReal - catData.tetoEfetivo) : 0;
  const isEstourou = excedente > 0;
  const valorNum = isEstourou ? excedente : parseFloat(valorStr.replace(',', '.')) || 0;

  const disponiveis = resultado
    .filter(r => r.cat !== catOrigem)
    .filter(r => r.cat.toLowerCase().includes(busca.toLowerCase()))
    .sort((a, b) => b.tetoEfetivo - a.tetoEfetivo);

  const toggleCat = (cat) => {
    setSelecionadas(prev =>
      prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]
    );
  };

  const selecionadasData = resultado.filter(r => selecionadas.includes(r.cat));
  const totalTetosSel = selecionadasData.reduce((s, r) => s + r.tetoEfetivo, 0);
  const preview = selecionadasData.map(r => ({
    cat: r.cat,
    valorDeduzido: totalTetosSel > 0
      ? (r.tetoEfetivo / totalTetosSel) * valorNum
      : valorNum / selecionadasData.length,
  }));

  const canConfirm = valorNum > 0 && selecionadas.length > 0;

  return (
    <div className="fixed inset-0 bg-ink-900/40 z-50 flex items-center justify-center p-4"
      onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col"
        onClick={e => e.stopPropagation()}>
        <div className="px-6 py-4 border-b border-ink-100 flex items-start justify-between">
          <div>
            <h3 className="font-display text-lg text-ink-900">
              {isEstourou ? 'Redistribuir excesso' : 'Ajustar limite'}
            </h3>
            <p className="text-xs text-ink-400 font-mono mt-0.5">{catOrigem}</p>
          </div>
          <button onClick={onClose} className="text-ink-400 hover:text-ink-700 mt-0.5">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-auto px-6 py-4 space-y-5">
          <div>
            <label className="block text-xs font-mono text-ink-500 uppercase tracking-wider mb-2">
              {isEstourou ? 'Excedente a redistribuir' : 'Valor a deduzir desta categoria'}
            </label>
            {isEstourou ? (
              <div className="flex items-center gap-2 px-4 py-3 bg-rose-50 border border-rose-200 rounded-xl">
                <span className="text-xs font-mono text-rose-500">R$</span>
                <span className="font-display text-rose-700 text-xl">{brl(excedente)}</span>
                <span className="text-xs text-rose-500 ml-auto">fixo</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 px-4 py-3 bg-white border border-ink-200 rounded-xl focus-within:border-jade-400">
                <span className="text-xs font-mono text-ink-400">R$</span>
                <input
                  autoFocus value={valorStr}
                  onChange={e => setValorStr(e.target.value)}
                  placeholder="0,00"
                  className="flex-1 text-ink-800 font-mono text-lg focus:outline-none bg-transparent"
                />
              </div>
            )}
            {valorNum > 0 && (
              <p className="text-xs text-ink-400 mt-1.5 font-mono">
                Esse valor sera retirado proporcionalmente das categorias selecionadas abaixo.
              </p>
            )}
          </div>

          <div>
            <label className="block text-xs font-mono text-ink-500 uppercase tracking-wider mb-2">
              Categorias que vao ceder saldo
            </label>
            <input
              type="text" placeholder="Buscar categoria..."
              value={busca} onChange={e => setBusca(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-ink-200 rounded-lg mb-2 font-mono
                         focus:outline-none focus:border-jade-400"
            />
            <div className="border border-ink-100 rounded-xl overflow-hidden max-h-48 overflow-y-auto">
              {disponiveis.map(r => {
                const sel = selecionadas.includes(r.cat);
                const prev = preview.find(p => p.cat === r.cat);
                return (
                  <button key={r.cat} onClick={() => toggleCat(r.cat)}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 border-b border-ink-50
                                text-left transition-colors ${sel ? 'bg-rose-50' : 'bg-white hover:bg-ink-50'}`}>
                    <div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0
                                    ${sel ? 'bg-rose-500 border-rose-500' : 'border-ink-300'}`}>
                      {sel && (
                        <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                    <span className="flex-1 text-xs text-ink-800 font-medium">{r.cat}</span>
                    <span className="text-xs font-mono text-ink-400">{brl(r.tetoEfetivo)}</span>
                    {sel && prev && valorNum > 0 && (
                      <span className="text-xs font-mono text-rose-600 font-medium ml-1">
                        -{brl(prev.valorDeduzido)}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {preview.length > 0 && valorNum > 0 && (
            <div className="bg-ink-50 rounded-xl p-4">
              <p className="text-xs font-mono text-ink-500 uppercase tracking-wider mb-2">Preview da deducao</p>
              <div className="space-y-1.5">
                {preview.map(p => (
                  <div key={p.cat} className="flex justify-between text-xs font-mono">
                    <span className="text-ink-600 truncate mr-4">{p.cat}</span>
                    <span className="text-rose-600 font-medium flex-shrink-0">-{brl(p.valorDeduzido)} de saldo</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-ink-100 flex gap-3 justify-end">
          <button onClick={onClose}
            className="px-4 py-2 text-sm border border-ink-200 text-ink-600 rounded-lg hover:bg-ink-50">
            Cancelar
          </button>
          <button
            disabled={!canConfirm}
            onClick={() => onConfirm({ catOrigem, valorNum, catsDestino: selecionadasData, preview })}
            className="px-4 py-2 text-sm bg-jade-500 text-white rounded-lg hover:bg-jade-600
                       disabled:opacity-40 disabled:cursor-not-allowed font-medium"
          >
            Confirmar dedução
          </button>
        </div>
      </div>
    </div>
  );
}

export default function TabComparacao({
  baseData, tetosAjustados, deducoesAplicadas, mesAtual,
  onDeducao, onLog, comparacaoState, onComparacaoChange
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedCat, setSelectedCat] = useState(null);
  const [search, setSearch] = useState('');
  const [sortMode, setSortMode] = useState('estourou');
  const [exporting, setExporting] = useState(null);
  const [modalCat, setModalCat] = useState(null);

  const realData = comparacaoState?.realData || null;
  const realFileName = comparacaoState?.realFileName || '';
  const resultado = comparacaoState?.resultado || null;

  const handleFile = async (file) => {
    setError(null);
    setLoading(true);
    try {
      const parsed = await parseExcel(file);
      const calc = recalcularLimites(baseData, parsed, tetosAjustados, deducoesAplicadas);
      const newState = { realData: parsed, realFileName: file.name, resultado: calc };
      onComparacaoChange(newState);
      setSelectedCat(calc[0]?.cat || null);
      onLog(formatLogEntry({
        tipo: 'comparacao_carregada',
        nota: `Planilha "${file.name}" carregada para comparação.`,
        valor: 0,
      }));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeducaoConfirm = ({ catOrigem, valorNum, catsDestino, preview }) => {
    const novasDeducoes = aplicarDeducao(deducoesAplicadas, catOrigem, valorNum, catsDestino, resultado);
    onDeducao(novasDeducoes);
    const calc = recalcularLimites(baseData, realData, tetosAjustados, novasDeducoes);
    onComparacaoChange({ realData, realFileName, resultado: calc });
    setSelectedCat(catOrigem);
    onLog(formatLogEntry({
      tipo: 'deducao',
      catOrigem,
      valor: valorNum,
      catsDestino: preview.map(p => ({ cat: p.cat, valorDeduzido: p.valorDeduzido })),
    }));
    setModalCat(null);
  };

  const handleExport = (type) => {
    if (!resultado) return;
    setExporting(type);
    try {
      if (type === 'excel') exportComparacaoExcel(resultado);
      else exportComparacaoPDF(resultado);
    } finally {
      setTimeout(() => setExporting(null), 1500);
    }
  };

  // ── Tela de upload (sem dados ainda) ────────────────────────────────────────
  if (!resultado) {
    return (
      <div className="max-w-2xl mx-auto py-4 space-y-6">
        <div>
          <h2 className="font-display text-2xl text-ink-900 mb-1">
            Comparação com gastos reais 2026
          </h2>
          <p className="text-sm text-ink-500 leading-relaxed">
            Faça upload da planilha com os gastos reais de 2026. O sistema compara com os
            limites e redistribui o saldo nos meses futuros, mantendo proporções históricas.
          </p>
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800">
          <strong>Recálculo proporcional:</strong> se você gastou mais do que o limite em um
          mês, o sistema reduz os meses seguintes proporcionalmente ao padrão histórico de 2025.
        </div>
        <UploadZone onFile={handleFile} loading={loading} />
        {error && (
          <div className="bg-rose-50 border border-rose-200 rounded-xl px-4 py-3 text-sm text-rose-700">
            <strong>Erro:</strong> {error}
          </div>
        )}
      </div>
    );
  }

  // ── Dados carregados ──────────────────────────────────────────────────────────
  const ultimoMes = detectarUltimoMes(realData);
  const filtrado = resultado
    .filter(r => r.cat.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      if (sortMode === 'estourou') return (b.estourou ? 1 : 0) - (a.estourou ? 1 : 0) || b.percentualUsado - a.percentualUsado;
      if (sortMode === 'pct_desc') return b.percentualUsado - a.percentualUsado;
      if (sortMode === 'saldo_asc') return a.saldoRestante - b.saldoRestante;
      return a.cat.localeCompare(b.cat, 'pt');
    });

  const catDetail = resultado.find(r => r.cat === selectedCat);
  const totalTeto = resultado.reduce((s, r) => s + r.tetoEfetivo, 0);
  const totalGasto = resultado.reduce((s, r) => s + r.gastoReal, 0);
  const totalSaldo = resultado.reduce((s, r) => s + r.saldoRestante, 0);
  const qtdEstourou = resultado.filter(r => r.estourou).length;
  const qtdPago = resultado.filter(r => r.pago).length;
  const qtdCritico = resultado.filter(r => !r.estourou && !r.pago && r.percentualUsado >= 90).length;

  const chartData = MESES.map((m, i) => ({
    mes: m,
    'Limite original': catDetail?.limiteOriginal[i] ?? null,
    'Gasto real': catDetail?.real[i] ?? null,
    'Novo limite': catDetail?.limitesRecalculados[i] ?? null,
  }));

  // ── Totais para a linha de rodapé do detalhe mensal ────────────────────────
  const totalLimiteOriginalAnual = catDetail
    ? catDetail.limiteOriginal.reduce((s, v) => s + (v || 0), 0)
    : 0;
  const totalGastoRealAnual = catDetail
    ? catDetail.real.reduce((s, v) => s + (v || 0), 0)
    : 0;
  const totalDiferencasAnual = catDetail
    ? catDetail.diferencas.reduce((s, v) => s + (v || 0), 0)
    : 0;
  const totalNovoLimiteAnual = catDetail
    ? catDetail.limitesRecalculados.reduce((s, v) => s + (v || 0), 0)
    : 0;
  const totalDeducoesMensaisAnual = catDetail
    ? (catDetail.deducoesMensais || []).reduce((s, v) => s + (v || 0), 0)
    : 0;

  return (
    <div className="space-y-6">
      {modalCat && (
        <DeducaoModal
          catOrigem={modalCat}
          resultado={resultado}
          onConfirm={handleDeducaoConfirm}
          onClose={() => setModalCat(null)}
        />
      )}

      {/* Cabeçalho */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="font-display text-xl text-ink-900">Comparação 2026</h2>
          <p className="text-xs text-ink-400 font-mono mt-0.5">
            Real: <span className="text-jade-600">{realFileName}</span>
            · Meses com dados:{' '}
            <strong>
              {ultimoMes >= 0 ? MESES.slice(0, ultimoMes + 1).join(', ') : 'nenhum'}
            </strong>
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => onComparacaoChange(null)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono border
                       border-ink-200 text-ink-600 hover:bg-ink-50 rounded-lg"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0
                   0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Nova planilha
          </button>
          <button
            onClick={() => handleExport('excel')}
            disabled={!!exporting}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono border
                       border-jade-300 text-jade-700 bg-jade-50 hover:bg-jade-100
                       rounded-lg disabled:opacity-50"
          >
            {exporting === 'excel' ? 'Gerando...' : 'Excel'}
          </button>
          <button
            onClick={() => handleExport('pdf')}
            disabled={!!exporting}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono border
                       border-rose-200 text-rose-700 bg-rose-50 hover:bg-rose-100
                       rounded-lg disabled:opacity-50"
          >
            {exporting === 'pdf' ? 'Gerando...' : 'PDF'}
          </button>
        </div>
      </div>

      {/* Cards de resumo */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white border border-ink-100 rounded-2xl p-4">
          <p className="text-xs font-mono text-ink-400 uppercase tracking-wider mb-1">Teto anual</p>
          <p className="text-lg font-display text-ink-900">{brl(totalTeto)}</p>
        </div>
        <div className="bg-white border border-ink-100 rounded-2xl p-4">
          <p className="text-xs font-mono text-ink-400 uppercase tracking-wider mb-1">Gasto real 2026</p>
          <p className={`text-lg font-display ${totalGasto > totalTeto ? 'text-rose-600' : 'text-ink-900'}`}>
            {brl(totalGasto)}
          </p>
          <p className="text-xs text-ink-400 mt-0.5">
            {(totalGasto / totalTeto * 100).toFixed(1)}% do teto
          </p>
        </div>
        <div className="bg-white border border-ink-100 rounded-2xl p-4">
          <p className="text-xs font-mono text-ink-400 uppercase tracking-wider mb-1">Saldo restante</p>
          <p className={`text-lg font-display ${totalSaldo < 0 ? 'text-rose-600' : 'text-jade-600'}`}>
            {brl(totalSaldo)}
          </p>
          <p className="text-xs text-ink-400 mt-0.5">
            {MESES.length - ultimoMes - 1} meses pela frente
          </p>
        </div>
        <div className="bg-white border border-ink-100 rounded-2xl p-4">
          <p className="text-xs font-mono text-ink-400 uppercase tracking-wider mb-1">Alertas</p>
          <p className="text-lg font-display text-rose-600">{qtdEstourou} estouradas</p>
          <p className="text-xs text-ink-400 mt-0.5">
            {qtdCritico} críticas · {qtdPago} pagas
          </p>
        </div>
      </div>

      {/* Layout principal: lista + detalhe */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

        {/* ── Lista de categorias ─────────────────────────────────────────── */}
        <div className="lg:col-span-2">
          <div className="flex gap-2 mb-3">
            <input
              type="text" placeholder="Buscar..." value={search}
              onChange={e => setSearch(e.target.value)}
              className="flex-1 px-3 py-2 text-xs border border-ink-200 rounded-lg bg-white
                         text-ink-800 focus:outline-none focus:border-jade-400 font-mono"
            />
            <select
              value={sortMode} onChange={e => setSortMode(e.target.value)}
              className="px-3 py-2 text-xs border border-ink-200 rounded-lg bg-white
                         text-ink-700 focus:outline-none"
            >
              <option value="estourou">Críticos primeiro</option>
              <option value="pct_desc">% usado</option>
              <option value="saldo_asc">Menor saldo</option>
              <option value="nome">Alfabética</option>
            </select>
          </div>

          <div className="border border-ink-100 rounded-2xl overflow-hidden">
            <div className="overflow-auto max-h-[560px]">
              {filtrado.map(r => {
                const proxMesIdx = r.mesesFuturos.find(i => r.limitesRecalculados[i] != null);
                const proxMesLim = proxMesIdx != null ? r.limitesRecalculados[proxMesIdx] : null;
                const proxMesNome = proxMesIdx != null ? MESES[proxMesIdx] : null;
                const isCurrent = selectedCat === r.cat;
                return (
                  <div
                    key={r.cat}
                    className={`border-b border-ink-50 transition-colors
                      ${isCurrent
                        ? 'bg-jade-50 border-l-2 border-l-jade-500'
                        : 'bg-white'
                      }`}
                  >
                    <div className="flex items-start gap-2 px-3 pt-3 pb-2">
                      <button className="flex-1 text-left" onClick={() => setSelectedCat(r.cat)}>
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-xs font-medium text-ink-800 leading-tight">
                            {r.cat}
                          </span>
                          <StatusBadge
                            pct={r.percentualUsado}
                            estourou={r.estourou}
                            pago={r.pago}
                          />
                        </div>
                        <ProgressBar
                          pct={r.percentualUsado}
                          estourou={r.estourou}
                          pago={r.pago}
                        />
                        <div className="flex justify-between mt-1.5 text-xs font-mono text-ink-400">
                          <span>Gasto: {brl(r.gastoReal)}</span>
                          <span>{r.percentualUsado.toFixed(0)}% de {brl(r.tetoEfetivo)}</span>
                        </div>
                        {proxMesNome && (
                          <div className="flex items-center justify-between mt-1.5 pt-1.5
                                          border-t border-ink-50">
                            <span className="text-xs font-mono text-ink-400">
                              Limite{' '}
                              <span className="text-amber-600 font-medium">{proxMesNome}</span>
                            </span>
                            <span className={`text-xs font-mono font-medium
                              ${r.estourou ? 'text-rose-600' : 'text-amber-700'}`}>
                              {brl(proxMesLim)}
                            </span>
                          </div>
                        )}
                      </button>
                      <button
                        onClick={() => setModalCat(r.cat)}
                        title={r.estourou ? 'Redistribuir excesso' : 'Ajustar limite'}
                        className={`flex-shrink-0 w-7 h-7 rounded-lg flex items-center
                                    justify-center transition-colors
                          ${r.estourou
                            ? 'bg-rose-100 text-rose-600 hover:bg-rose-200'
                            : r.pago
                              ? 'bg-jade-100 text-jade-600 hover:bg-jade-200'
                              : 'bg-ink-100 text-ink-500 hover:bg-amber-100 hover:text-amber-700'
                          }`}
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24"
                          stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                            d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                        </svg>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* ── Detalhe da categoria selecionada ────────────────────────────── */}
        <div className="lg:col-span-3 space-y-4">
          {catDetail ? (
            <>
              {/* Cabeçalho do detalhe */}
              <div className="bg-white border border-ink-100 rounded-2xl p-5">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-display text-lg text-ink-900">{catDetail.cat}</h3>
                    <p className="text-xs text-ink-400 font-mono mt-0.5">
                      Teto: {brl(catDetail.tetoEfetivo)}
                      · Gasto: {brl(catDetail.gastoReal)}
                      · Saldo: {brl(catDetail.saldoRestante)}
                    </p>
                    {catDetail.deducaoTotal !== 0 && (
                      <p className={`text-xs font-mono mt-0.5
                        ${catDetail.deducaoTotal > 0 ? 'text-jade-600' : 'text-rose-600'}`}>
                        Dedução líquida:{' '}
                        {catDetail.deducaoTotal > 0 ? '+' : ''}
                        {brl(catDetail.deducaoTotal)}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge
                      pct={catDetail.percentualUsado}
                      estourou={catDetail.estourou}
                      pago={catDetail.pago}
                    />
                    <button
                      onClick={() => setModalCat(catDetail.cat)}
                      className={`text-xs font-mono px-3 py-1.5 rounded-lg border transition-colors
                        ${catDetail.estourou
                          ? 'bg-rose-50 border-rose-200 text-rose-700 hover:bg-rose-100'
                          : catDetail.pago
                            ? 'bg-jade-50 border-jade-200 text-jade-700 hover:bg-jade-100'
                            : 'bg-ink-50 border-ink-200 text-ink-600 hover:bg-amber-50 hover:border-amber-200 hover:text-amber-700'
                        }`}
                    >
                      {catDetail.estourou ? 'Redistribuir excesso' : 'Ajustar limite'}
                    </button>
                  </div>
                </div>

                {/* Banners informativos */}
                {catDetail.estourou && (
                  <div className="bg-rose-50 border border-rose-200 rounded-xl px-4 py-3
                                  text-xs text-rose-800 mb-4">
                    <strong>Teto ultrapassado!</strong>{' '}
                    Excedente de {brl(catDetail.gastoReal - catDetail.tetoEfetivo)}.
                    Use "Redistribuir excesso" para transferir esse valor para outras categorias.
                  </div>
                )}
                {catDetail.pago && !catDetail.estourou && (
                  <div className="bg-jade-50 border border-jade-200 rounded-xl px-4 py-3
                                  text-xs text-jade-800 mb-4">
                    <strong>✓ 100% utilizado.</strong>{' '}
                    Esta categoria atingiu o teto efetivo de {brl(catDetail.tetoEfetivo)}.
                  </div>
                )}
                {catDetail.deducaoReceptora > 0 && (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3
                                  text-xs text-amber-800 mb-4">
                    <strong>Limite reduzido.</strong>{' '}
                    Esta categoria cedeu {brl(catDetail.deducaoReceptora)} para redistribuições.
                  </div>
                )}
                {catDetail.deducaoOrigem > 0 && (
                  <div className="bg-jade-50 border border-jade-200 rounded-xl px-4 py-3
                                  text-xs text-jade-800 mb-4">
                    <strong>Saldo aumentado.</strong>{' '}
                    Esta categoria recebeu {brl(catDetail.deducaoOrigem)} de limite futuro.
                  </div>
                )}

                {/* Gráfico */}
                <p className="text-xs text-ink-400 mb-2 font-mono">
                  Limite original · Gasto real · Novo limite
                </p>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={chartData} barSize={16}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e8e6df" vertical={false} />
                    <XAxis dataKey="mes" tick={{ fontSize: 10, fill: '#888278' }}
                      axisLine={false} tickLine={false} />
                    <YAxis
                      tickFormatter={v => v >= 1000 ? `R$${(v / 1000).toFixed(0)}k` : `R$${v}`}
                      tick={{ fontSize: 10, fill: '#888278' }}
                      axisLine={false} tickLine={false} width={52}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    {ultimoMes >= 0 && (
                      <ReferenceLine
                        x={MESES[ultimoMes]}
                        stroke="#aaa49a"
                        strokeDasharray="3 3"
                        label={{ value: 'hoje', fill: '#aaa49a', fontSize: 9 }}
                      />
                    )}
                    <Bar dataKey="Limite original" fill="#e8e6df" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="Gasto real" fill="#3db984" radius={[3, 3, 0, 0]}>
                      {chartData.map((_, i) => {
                        const real = catDetail.real[i];
                        const lim = catDetail.limiteOriginal[i];
                        return (
                          <Cell key={i}
                            fill={real && lim && real > lim ? '#e11d48' : '#3db984'} />
                        );
                      })}
                    </Bar>
                    <Bar dataKey="Novo limite" fill="#fec04d" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
                <div className="flex gap-4 text-xs text-ink-400 mt-2 flex-wrap">
                  <span className="flex items-center gap-1">
                    <span className="w-2.5 h-2.5 rounded-sm bg-ink-200 inline-block" />
                    Limite original
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2.5 h-2.5 rounded-sm bg-jade-400 inline-block" />
                    Gasto real (OK)
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2.5 h-2.5 rounded-sm bg-rose-500 inline-block" />
                    Gasto real (estourou)
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2.5 h-2.5 rounded-sm bg-amber-300 inline-block" />
                    Novo limite
                  </span>
                </div>
              </div>

              {/* Tabela de detalhe mensal com linha de totais */}
              <div className="bg-white border border-ink-100 rounded-2xl overflow-hidden">
                <div className="px-5 py-3 border-b border-ink-50">
                  <h4 className="text-sm font-medium text-ink-800">
                    Detalhe mensal — {catDetail.cat}
                  </h4>
                </div>
                <div className="overflow-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-ink-50">
                        <th className="text-left px-4 py-2.5 font-mono text-ink-400">Mês</th>
                        <th className="text-right px-4 py-2.5 font-mono text-ink-400">Lim. original</th>
                        <th className="text-right px-4 py-2.5 font-mono text-ink-400">Gasto real</th>
                        <th className="text-right px-4 py-2.5 font-mono text-ink-400">Diferença</th>
                        <th className="text-right px-4 py-2.5 font-mono text-ink-400">Novo limite</th>
                        <th className="text-right px-4 py-2.5 font-mono text-ink-400">Dedução</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-ink-50">
                      {MESES.map((m, i) => {
                        const isReal = i <= catDetail.ultimoMesReal;
                        const isFuturo = i > catDetail.ultimoMesReal;
                        const isCur = i === mesAtual;
                        const real = catDetail.real[i];
                        const limOrig = catDetail.limiteOriginal[i];
                        const limNovo = catDetail.limitesRecalculados[i];
                        const dif = catDetail.diferencas[i];
                        const deducaoMes = catDetail.deducoesMensais?.[i];
                        return (
                          <tr key={m} className={`
                            ${isCur ? 'bg-jade-50/50 font-medium' : ''}
                            ${isReal && !isCur ? 'bg-jade-50/20' : ''}
                            ${isFuturo && limNovo ? 'bg-amber-50/20' : ''}
                          `}>
                            <td className="px-4 py-2.5 font-mono text-ink-600">
                              {m}
                              {isCur && <span className="ml-1 text-jade-500 text-xs font-normal">← atual</span>}
                              {isReal && !isCur && <span className="ml-1 text-jade-500 text-xs">●</span>}
                              {isFuturo && limNovo && <span className="ml-1 text-amber-500 text-xs">◐</span>}
                            </td>
                            <td className="px-4 py-2.5 text-right font-mono text-ink-500">
                              {brl(limOrig)}
                            </td>
                            <td className={`px-4 py-2.5 text-right font-mono
                              ${real && limOrig && real > limOrig
                                ? 'text-rose-600 font-medium'
                                : 'text-ink-700'
                              }`}>
                              {brl(real)}
                            </td>
                            <td className={`px-4 py-2.5 text-right font-mono
                              ${dif > 0 ? 'text-rose-500' : dif < 0 ? 'text-jade-600' : 'text-ink-400'}`}>
                              {dif != null ? (dif > 0 ? '+' : '') + brl(dif) : '—'}
                            </td>
                            <td className="px-4 py-2.5 text-right font-mono text-amber-700 font-medium">
                              {isFuturo && limNovo ? brl(limNovo) : '—'}
                            </td>
                            <td className={`px-4 py-2.5 text-right font-mono
                              ${deducaoMes > 0
                                ? 'text-jade-600'
                                : deducaoMes < 0
                                  ? 'text-rose-600'
                                  : 'text-ink-400'
                              }`}>
                              {deducaoMes != null && Math.abs(deducaoMes) > 0.004
                                ? `${deducaoMes > 0 ? '+' : ''}${brl(deducaoMes)}`
                                : '—'
                              }
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>

                    {/* ── Linha de totais ──────────────────────────────────── */}
                    <tfoot>
                      <tr className="bg-jade-50 border-t-2 border-jade-200 font-medium">
                        <td className="px-4 py-3 font-mono text-jade-700 text-xs uppercase tracking-wider">
                          Total anual
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-ink-700">
                          {brl(totalLimiteOriginalAnual)}
                        </td>
                        <td className={`px-4 py-3 text-right font-mono font-bold
                          ${totalGastoRealAnual > totalLimiteOriginalAnual
                            ? 'text-rose-600'
                            : 'text-ink-700'
                          }`}>
                          {brl(totalGastoRealAnual)}
                        </td>
                        <td className={`px-4 py-3 text-right font-mono font-bold
                          ${totalDiferencasAnual > 0
                            ? 'text-rose-600'
                            : totalDiferencasAnual < 0
                              ? 'text-jade-600'
                              : 'text-ink-400'
                          }`}>
                          {totalDiferencasAnual !== 0
                            ? (totalDiferencasAnual > 0 ? '+' : '') + brl(totalDiferencasAnual)
                            : '—'
                          }
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-amber-700 font-bold">
                          {totalNovoLimiteAnual > 0 ? brl(totalNovoLimiteAnual) : '—'}
                        </td>
                        <td className={`px-4 py-3 text-right font-mono font-bold
                          ${totalDeducoesMensaisAnual > 0
                            ? 'text-jade-600'
                            : totalDeducoesMensaisAnual < 0
                              ? 'text-rose-600'
                              : 'text-ink-400'
                          }`}>
                          {Math.abs(totalDeducoesMensaisAnual) > 0.004
                            ? (totalDeducoesMensaisAnual > 0 ? '+' : '') + brl(totalDeducoesMensaisAnual)
                            : '—'
                          }
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            </>
          ) : (
            <div className="bg-white border border-ink-100 rounded-2xl p-10 text-center text-ink-400">
              <p className="text-sm">Selecione uma categoria para ver o detalhe</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}