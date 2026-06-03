import { useState } from 'react';
import {
  BarChart, Bar, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer
} from 'recharts';
import { brl, brlShort } from '../utils/formatters';
import { MESES } from '../config';

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-ink-100 rounded-xl px-4 py-3 shadow-sm text-sm">
      <p className="font-medium text-ink-800 mb-2">{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color }} className="font-mono text-xs">
          {p.name}: {brl(p.value)}
        </p>
      ))}
    </div>
  );
};

// ── Modal de confirmação da meta ─────────────────────────────────────────────
function ConfirmarMetaModal({ totalAtual, novaMeta, onConfirm, onClose }) {
  const diff = novaMeta - totalAtual;
  const pct  = totalAtual > 0 ? ((diff / totalAtual) * 100) : 0;
  return (
    <div className="fixed inset-0 bg-ink-900/40 z-50 flex items-center justify-center p-4"
         onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md"
           onClick={e => e.stopPropagation()}>
        <div className="px-6 py-4 border-b border-ink-100">
          <h3 className="font-display text-lg text-ink-900">Confirmar nova meta</h3>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800">
            ⚠️ Definir uma nova meta vai <strong>recalcular proporcionalmente</strong> o
            limite de todas as categorias. Ajustes manuais anteriores serão resetados.
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-ink-50 rounded-xl p-3 text-center">
              <p className="text-xs font-mono text-ink-400 mb-1">Teto atual</p>
              <p className="font-display text-ink-900">{brl(totalAtual)}</p>
            </div>
            <div className={`rounded-xl p-3 text-center ${diff <= 0 ? 'bg-jade-50' : 'bg-rose-50'}`}>
              <p className="text-xs font-mono text-ink-400 mb-1">Nova meta</p>
              <p className={`font-display ${diff <= 0 ? 'text-jade-700' : 'text-rose-700'}`}>
                {brl(novaMeta)}
              </p>
            </div>
          </div>
          <p className="text-sm text-center text-ink-500">
            {diff <= 0
              ? `Redução de ${brl(Math.abs(diff))} (${Math.abs(pct).toFixed(1)}% a menos)`
              : `Aumento de ${brl(diff)} (+${pct.toFixed(1)}%)`
            }
          </p>
        </div>
        <div className="px-6 py-4 border-t border-ink-100 flex gap-3 justify-end">
          <button onClick={onClose}
            className="px-4 py-2 text-sm border border-ink-200 text-ink-600 rounded-lg hover:bg-ink-50">
            Cancelar
          </button>
          <button onClick={onConfirm}
            className="px-4 py-2 text-sm bg-jade-500 text-white rounded-lg hover:bg-jade-600 font-medium">
            Confirmar meta
          </button>
        </div>
      </div>
    </div>
  );
}

export default function TabResumo({
  data,
  tetosAjustados,
  mesAtual,
  comparacaoResultado,
  metaAnual,
  onDefinirMeta,
}) {
  const [inputMeta, setInputMeta]       = useState('');
  const [modalMeta, setModalMeta]       = useState(null); // { novaMeta }
  const [editandoMeta, setEditandoMeta] = useState(false);

  const getTeto = (d) =>
    tetosAjustados[d.cat] != null ? tetosAjustados[d.cat] : d.total;

  const totalAnual = data.reduce((s, d) => s + getTeto(d), 0);

  // Total base (sem ajustes manuais) — usado para calcular proporções
  const totalBase = data.reduce((s, d) => s + d.total, 0);

  const totalMensal = MESES.map((_, i) =>
    data.reduce((s, d) => s + (d.vals[i] || 0), 0)
  );
  const limite2026Mensal = MESES.map((_, i) =>
    data.reduce((s, d) => {
      const teto = getTeto(d);
      const lim  = d.limite2026[i];
      return s + (lim ? (teto / d.total) * lim : 0);
    }, 0)
  );

  const picoMes  = totalMensal.indexOf(Math.max(...totalMensal));
  const menosMes = totalMensal.indexOf(Math.min(...totalMensal));
  const topCats  = [...data].sort((a, b) => getTeto(b) - getTeto(a)).slice(0, 5);

  const consolidado = MESES.map((m, i) => {
    const limOriginal = limite2026Mensal[i];
    const gastoReal   = comparacaoResultado
      ? comparacaoResultado.reduce((s, r) => s + (r.real[i] || 0), 0)
      : null;
    const novoLim = comparacaoResultado
      ? comparacaoResultado.reduce((s, r) => s + (r.limitesRecalculados[i] || 0), 0)
      : null;
    const saldo     = novoLim != null ? novoLim - (gastoReal || 0) : limOriginal;
    const isCurrent = i === mesAtual;
    const isPast    = i < mesAtual;
    return { mes: m, idx: i, limOriginal, gastoReal, novoLim, saldo, isCurrent, isPast };
  });

  const chartData = MESES.map((m, i) => ({
    mes: m,
    'Gasto 2025':  Math.round(totalMensal[i]),
    'Limite 2026': Math.round(limite2026Mensal[i]),
  }));

  // ── Handlers da meta ───────────────────────────────────────────────────────
  const abrirConfirmacao = (valor) => {
    const num = parseFloat(String(valor).replace(',', '.'));
    if (isNaN(num) || num <= 0) return;
    setModalMeta({ novaMeta: num });
  };

  const confirmarMeta = () => {
    if (!modalMeta) return;
    onDefinirMeta(modalMeta.novaMeta);
    setModalMeta(null);
    setInputMeta('');
    setEditandoMeta(false);
  };

  const atalhosMeta = [
    { label: '-5%',  fator: 0.95 },
    { label: '-10%', fator: 0.90 },
    { label: '-15%', fator: 0.85 },
    { label: '-20%', fator: 0.80 },
  ];

  const metaAtiva = metaAnual != null ? metaAnual : totalAnual;
  const economiaMeta = metaAnual != null ? (totalBase - metaAnual) : 0;
  const pctMeta      = totalBase > 0 ? ((economiaMeta / totalBase) * 100) : 0;

  return (
    <div className="space-y-8">
      {modalMeta && (
        <ConfirmarMetaModal
          totalAtual={totalAnual}
          novaMeta={modalMeta.novaMeta}
          onConfirm={confirmarMeta}
          onClose={() => setModalMeta(null)}
        />
      )}

      {/* Cards de resumo */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total teto 2026',    value: brl(totalAnual),          sub: 'limite anual',          color: 'jade' },
          { label: 'Categorias',         value: data.length,              sub: 'planos de contas' },
          { label: 'Mês de maior gasto', value: MESES[picoMes],           sub: brl(totalMensal[picoMes]),  color: 'rose' },
          { label: 'Mês de menor gasto', value: MESES[menosMes],          sub: brl(totalMensal[menosMes]), color: 'amber' },
        ].map((m, i) => (
          <div key={i} className={`fade-up fade-up-${i+1} bg-white border border-ink-100 rounded-2xl p-5`}>
            <p className="text-xs text-ink-400 font-mono uppercase tracking-wider mb-2">{m.label}</p>
            <p className="text-2xl font-display text-ink-900">{m.value}</p>
            <p className="text-xs text-ink-400 mt-1">{m.sub}</p>
          </div>
        ))}
      </div>

      {/* ── Painel de Meta ─────────────────────────────────────────────────── */}
      <div className="bg-white border border-ink-100 rounded-2xl p-6 fade-up">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <h3 className="font-display text-xl text-ink-900 mb-0.5">Meta anual 2026</h3>
            <p className="text-xs text-ink-400">
              Define o teto global e redistribui proporcionalmente entre todas as categorias.
            </p>
          </div>
          {metaAnual != null && (
            <div className="flex items-center gap-2 bg-jade-50 border border-jade-200
                            rounded-xl px-4 py-2">
              <svg className="w-4 h-4 text-jade-600" fill="none" viewBox="0 0 24 24"
                   stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <p className="text-xs font-mono text-jade-700 font-medium">Meta ativa</p>
                <p className="text-xs text-jade-600 font-mono">
                  {brl(metaAnual)}
                  {economiaMeta > 0
                    ? ` · economia de ${brl(economiaMeta)} (${pctMeta.toFixed(1)}%)`
                    : economiaMeta < 0
                    ? ` · aumento de ${brl(Math.abs(economiaMeta))}`
                    : ''
                  }
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="mt-5 space-y-4">
          {/* Atalhos percentuais */}
          <div>
            <p className="text-xs font-mono text-ink-400 uppercase tracking-wider mb-2">
              Atalhos rápidos (sobre o total base de {brl(totalBase)})
            </p>
            <div className="flex gap-2 flex-wrap">
              {atalhosMeta.map(a => {
                const valor  = Math.round(totalBase * a.fator);
                const ativo  = metaAnual != null && Math.round(metaAnual) === valor;
                return (
                  <button key={a.label}
                    onClick={() => abrirConfirmacao(valor)}
                    className={`px-4 py-2 rounded-xl text-sm font-mono border transition-colors
                      ${ativo
                        ? 'bg-jade-500 text-white border-jade-500'
                        : 'border-ink-200 text-ink-600 bg-white hover:border-jade-400 hover:bg-jade-50'
                      }`}
                  >
                    {a.label}
                    <span className="ml-1.5 text-xs opacity-70">{brl(valor)}</span>
                  </button>
                );
              })}
              {metaAnual != null && (
                <button
                  onClick={() => {
                    onDefinirMeta(null);
                    setInputMeta('');
                    setEditandoMeta(false);
                  }}
                  className="px-4 py-2 rounded-xl text-sm font-mono border border-rose-200
                             text-rose-600 bg-white hover:bg-rose-50 transition-colors"
                >
                  Remover meta
                </button>
              )}
            </div>
          </div>

          {/* Input de valor livre */}
          <div>
            <p className="text-xs font-mono text-ink-400 uppercase tracking-wider mb-2">
              Ou defina um valor específico
            </p>
            {editandoMeta ? (
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono text-ink-400">R$</span>
                <input
                  autoFocus
                  value={inputMeta}
                  onChange={e => setInputMeta(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') abrirConfirmacao(inputMeta);
                    if (e.key === 'Escape') setEditandoMeta(false);
                  }}
                  placeholder="Ex: 288000"
                  className="w-44 px-3 py-2 text-sm font-mono border border-jade-400
                             rounded-xl focus:outline-none"
                />
                <button
                  onClick={() => abrirConfirmacao(inputMeta)}
                  className="px-4 py-2 text-sm bg-jade-500 text-white rounded-xl
                             hover:bg-jade-600 font-mono"
                >
                  Aplicar
                </button>
                <button
                  onClick={() => { setEditandoMeta(false); setInputMeta(''); }}
                  className="px-3 py-2 text-sm border border-ink-200 text-ink-500
                             rounded-xl hover:bg-ink-50"
                >
                  Cancelar
                </button>
              </div>
            ) : (
              <button
                onClick={() => setEditandoMeta(true)}
                className="flex items-center gap-2 px-4 py-2 text-sm border border-ink-200
                           text-ink-600 rounded-xl hover:border-jade-400 hover:bg-jade-50
                           transition-colors font-mono"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5
                       m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                {metaAnual != null ? `Meta atual: ${brl(metaAnual)} — clique para editar` : 'Digitar valor da meta'}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Gráfico */}
      <div className="bg-white border border-ink-100 rounded-2xl p-6 fade-up fade-up-2">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-display text-xl text-ink-900">
              Gasto mensal 2025 vs Limite 2026
            </h3>
            <p className="text-xs text-ink-400 mt-0.5">
              Distribuição proporcional ao histórico
              {metaAnual != null && (
                <span className="ml-1 text-jade-600 font-mono">
                  · meta aplicada: {brl(metaAnual)}
                </span>
              )}
            </p>
          </div>
          <div className="flex gap-4 text-xs text-ink-400">
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm bg-jade-200 inline-block" />
              Gasto 2025
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-1 bg-rose-400 inline-block rounded" />
              Limite 2026
            </span>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={chartData} barSize={24}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e8e6df" vertical={false} />
            <XAxis dataKey="mes" tick={{ fontSize: 11, fill: '#888278' }}
                   axisLine={false} tickLine={false} />
            <YAxis tickFormatter={brlShort} tick={{ fontSize: 11, fill: '#888278' }}
                   axisLine={false} tickLine={false} width={60} />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="Gasto 2025"  fill="#a9e8cc" radius={[4,4,0,0]} />
            <Line type="monotone" dataKey="Limite 2026" stroke="#e11d48"
                  strokeWidth={2} dot={{ r: 3, fill: '#e11d48' }} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Tabela consolidada */}
      <div className="bg-white border border-ink-100 rounded-2xl overflow-hidden fade-up fade-up-3">
        <div className="px-6 py-4 border-b border-ink-50">
          <h3 className="font-display text-xl text-ink-900">Visão consolidada mensal</h3>
          <p className="text-xs text-ink-400 mt-0.5">
            Limite total somando todas as categorias · mês atual destacado
          </p>
        </div>
        <div className="overflow-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-ink-50">
                <th className="text-left px-5 py-3 text-xs font-mono text-ink-400">Mês</th>
                <th className="text-right px-5 py-3 text-xs font-mono text-ink-400">Limite original</th>
                {comparacaoResultado && (
                  <th className="text-right px-5 py-3 text-xs font-mono text-ink-400">Gasto real</th>
                )}
                {comparacaoResultado && (
                  <th className="text-right px-5 py-3 text-xs font-mono text-ink-400">Novo limite</th>
                )}
                <th className="text-right px-5 py-3 text-xs font-mono text-ink-400">Saldo disponível</th>
                <th className="text-center px-5 py-3 text-xs font-mono text-ink-400">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-50">
              {consolidado.map((row) => {
                const pct = row.limOriginal > 0
                  ? ((row.gastoReal || 0) / row.limOriginal * 100)
                  : 0;
                return (
                  <tr key={row.mes}
                      className={`${row.isCurrent ? 'bg-jade-50 font-medium' : row.isPast ? 'bg-ink-50/50' : ''}`}>
                    <td className="px-5 py-3 font-mono text-ink-700">
                      <div className="flex items-center gap-2">
                        {row.isCurrent && (
                          <span className="w-2 h-2 rounded-full bg-jade-500 animate-pulse inline-block" />
                        )}
                        {row.mes}
                        {row.isCurrent && (
                          <span className="text-xs text-jade-600 font-mono">← atual</span>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-3 text-right font-mono text-ink-600">
                      {brl(row.limOriginal)}
                    </td>
                    {comparacaoResultado && (
                      <td className={`px-5 py-3 text-right font-mono
                        ${row.gastoReal > row.limOriginal ? 'text-rose-600 font-medium' : 'text-ink-700'}`}>
                        {row.gastoReal ? brl(row.gastoReal) : '—'}
                      </td>
                    )}
                    {comparacaoResultado && (
                      <td className="px-5 py-3 text-right font-mono text-amber-700">
                        {row.novoLim ? brl(row.novoLim) : '—'}
                      </td>
                    )}
                    <td className={`px-5 py-3 text-right font-mono font-medium
                      ${row.saldo < 0 ? 'text-rose-600' : 'text-jade-600'}`}>
                      {brl(Math.abs(row.saldo))}{row.saldo < 0 ? ' neg.' : ''}
                    </td>
                    <td className="px-5 py-3 text-center">
                      {row.isCurrent ? (
                        <span className="text-xs bg-jade-100 text-jade-700 px-2 py-0.5 rounded-full font-mono">Atual</span>
                      ) : row.isPast ? (
                        <span className="text-xs bg-ink-100 text-ink-500 px-2 py-0.5 rounded-full font-mono">Encerrado</span>
                      ) : pct > 90 ? (
                        <span className="text-xs bg-rose-100 text-rose-700 px-2 py-0.5 rounded-full font-mono">Crítico</span>
                      ) : (
                        <span className="text-xs bg-ink-50 text-ink-400 px-2 py-0.5 rounded-full font-mono">Futuro</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Top 5 */}
      <div className="bg-white border border-ink-100 rounded-2xl p-6 fade-up fade-up-4">
        <h3 className="font-display text-xl text-ink-900 mb-5">Top 5 maiores categorias</h3>
        <div className="space-y-3">
          {topCats.map((d, i) => {
            const teto = getTeto(d);
            const pct  = (teto / totalAnual * 100).toFixed(1);
            return (
              <div key={i} className="flex items-center gap-4">
                <span className="text-xs font-mono text-ink-400 w-4">{i + 1}</span>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-ink-800 font-medium">{d.cat}</span>
                    <span className="text-xs font-mono text-ink-500">{pct}% · {brl(teto)}</span>
                  </div>
                  <div className="h-1.5 bg-ink-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full bg-jade-400 transition-all duration-700"
                         style={{ width: `${pct}%` }} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}