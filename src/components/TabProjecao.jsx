import { useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine
} from 'recharts';
import { brl, brlShort } from '../utils/formatters';
import { MESES, ANO_ORCAMENTO, ANO_BASE } from '../config';

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-ink-100 rounded-xl px-4 py-3 shadow-sm text-xs">
      <p className="font-medium text-ink-800 mb-2">{label}</p>
      {payload.map((p, i) => p.value != null && (
        <p key={i} style={{ color: p.color }} className="font-mono">
          {p.name}: {brl(p.value)}
        </p>
      ))}
    </div>
  );
};

export default function TabProjecao({
  data,
  tetosAjustados,
  mesAtual,
  comparacaoResultado,
  metaAnual,
}) {
  const getTeto = (d) =>
    tetosAjustados[d.cat] != null ? tetosAjustados[d.cat] : d.total;

  // Se há meta ativa, usa ela como teto total — senão soma os tetos ajustados
  const totalTeto = metaAnual != null
    ? metaAnual
    : data.reduce((s, d) => s + getTeto(d), 0);

  const {
    gastoAcumulado,
    projecaoFinal,
    ritmoMedio,
    mesesRestantes,
    limiteRestante,
    projecaoMensal,
    statusProjecao,
  } = useMemo(() => {
    const mesesComDados = mesAtual;
    let gastoAcumulado = 0;

    if (comparacaoResultado) {
      gastoAcumulado = comparacaoResultado.reduce((s, r) => {
        const gastoAte = r.real
          .slice(0, mesesComDados + 1)
          .reduce((a, v) => a + (v || 0), 0);
        return s + gastoAte;
      }, 0);
    } else {
      gastoAcumulado = data.reduce((s, d) => {
        const teto = getTeto(d);
        const fatorAjuste = d.total > 0 ? teto / d.total : 1;
        const gastoAte = d.vals
          .slice(0, mesesComDados + 1)
          .reduce((a, v) => a + (v || 0) * fatorAjuste, 0);
        return s + gastoAte;
      }, 0);
    }

    const mesesDecorridos = mesesComDados + 1;
    const mesesRestantes  = 12 - mesesDecorridos;
    const ritmoMedio      = mesesDecorridos > 0 ? gastoAcumulado / mesesDecorridos : 0;
    const projecaoFinal   = gastoAcumulado + ritmoMedio * mesesRestantes;
    const limiteRestante  = totalTeto - gastoAcumulado;
    const desvioPercent   = totalTeto > 0
      ? ((projecaoFinal - totalTeto) / totalTeto) * 100
      : 0;

    let statusProjecao;
    if (desvioPercent > 10)      statusProjecao = 'critico';
    else if (desvioPercent > 0)  statusProjecao = 'atencao';
    else if (desvioPercent > -5) statusProjecao = 'ok';
    else                         statusProjecao = 'otimo';

    const projecaoMensal = MESES.map((m, i) => {
      let gastoReal  = null;
      let projetado  = null;

      const limiteOriginal = data.reduce((s, d) => {
        const teto = getTeto(d);
        const lim  = d.limite2026[i];
        return s + (lim != null && d.total > 0 ? (teto / d.total) * lim : 0);
      }, 0);

      if (comparacaoResultado && i <= mesesComDados) {
        gastoReal = comparacaoResultado.reduce(
          (s, r) => s + (r.real[i] || 0), 0
        );
      } else if (i > mesesComDados) {
        const pesoMes = limiteOriginal > 0
          ? limiteOriginal / (totalTeto / 12)
          : 1;
        projetado = ritmoMedio * pesoMes;
      }

      return { mes: m, limiteOriginal, gastoReal, projetado };
    });

    return {
      gastoAcumulado,
      projecaoFinal,
      ritmoMedio,
      mesesRestantes,
      limiteRestante,
      projecaoMensal,
      statusProjecao,
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, tetosAjustados, mesAtual, comparacaoResultado, totalTeto]);

  const desvio        = projecaoFinal - totalTeto;
  const desvioPercent = totalTeto > 0
    ? ((projecaoFinal - totalTeto) / totalTeto * 100)
    : 0;

  const STATUS_CONFIG = {
    critico: {
      label: 'Projeção crítica',
      desc: `No ritmo atual, você vai ultrapassar o teto em ${brl(Math.abs(desvio))} (+${desvioPercent.toFixed(1)}%)`,
      color: 'bg-rose-50 border-rose-200 text-rose-800',
      badge: 'bg-rose-100 text-rose-700',
    },
    atencao: {
      label: 'Atenção',
      desc: `Projeção levemente acima do teto (+${desvioPercent.toFixed(1)}%). Monitore os meses seguintes.`,
      color: 'bg-amber-50 border-amber-200 text-amber-800',
      badge: 'bg-amber-100 text-amber-700',
    },
    ok: {
      label: 'Dentro do esperado',
      desc: `Projeção dentro do teto anual (${desvioPercent.toFixed(1)}% de variação).`,
      color: 'bg-jade-50 border-jade-200 text-jade-800',
      badge: 'bg-jade-100 text-jade-700',
    },
    otimo: {
      label: 'Abaixo do teto',
      desc: `Projeção ${Math.abs(desvioPercent).toFixed(1)}% abaixo do teto. Ótimo controle!`,
      color: 'bg-jade-50 border-jade-200 text-jade-800',
      badge: 'bg-jade-100 text-jade-700',
    },
  };

  const status = STATUS_CONFIG[statusProjecao];

  const topImpacto = [...data]
    .map(d => {
      const teto        = getTeto(d);
      const ritmoMes    = teto / 12;
      const projetadoRestante = ritmoMes * mesesRestantes;
      return { cat: d.cat, projetadoRestante, teto };
    })
    .sort((a, b) => b.projetadoRestante - a.projetadoRestante)
    .slice(0, 5);

  const chartData = projecaoMensal.map(row => ({
    mes:          row.mes,
    'Limite':     Math.round(row.limiteOriginal || 0),
    'Gasto real': row.gastoReal  != null ? Math.round(row.gastoReal)  : null,
    'Projeção':   row.projetado  != null ? Math.round(row.projetado)  : null,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-2xl text-ink-900 mb-1">
          Projeção de encerramento {ANO_ORCAMENTO}
        </h2>
        <p className="text-sm text-ink-500">
          {comparacaoResultado
            ? 'Baseado nos gastos reais carregados na aba "Comparação real".'
            : `Baseado no padrão histórico de ${ANO_BASE}. Carregue dados reais na aba "Comparação real" para maior precisão.`
          }
        </p>

        {/* Banner da meta ativa */}
        {metaAnual != null && (
          <div className="mt-3 inline-flex items-center gap-2 bg-jade-50 border
                          border-jade-200 rounded-xl px-4 py-2 text-xs text-jade-700">
            <svg className="w-4 h-4 text-jade-500 flex-shrink-0" fill="none"
                 viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>
              Meta anual ativa:{' '}
              <strong className="font-mono">{brl(metaAnual)}</strong>
              {' '}— projeção comparada com a meta, não com o total histórico.
            </span>
          </div>
        )}
      </div>

      {/* Banner de status */}
      <div className={`border rounded-2xl p-5 ${status.color}`}>
        <div className="flex items-start gap-3">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className={`text-xs font-mono px-2 py-0.5 rounded-full font-medium
                                ${status.badge}`}>
                {status.label}
              </span>
            </div>
            <p className="text-sm leading-relaxed">{status.desc}</p>
          </div>
          <div className="text-right flex-shrink-0">
            <p className="text-xs font-mono opacity-60 mb-0.5">Projeção final</p>
            <p className="text-2xl font-display">{brl(projecaoFinal)}</p>
            <p className="text-xs font-mono opacity-60 mt-0.5">
              {metaAnual != null ? 'Meta' : 'Teto'}: {brl(totalTeto)}
            </p>
          </div>
        </div>
      </div>

      {/* Cards de métricas */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white border border-ink-100 rounded-2xl p-4">
          <p className="text-xs font-mono text-ink-400 uppercase tracking-wider mb-1">
            Gasto acumulado
          </p>
          <p className="text-xl font-display text-ink-900">{brl(gastoAcumulado)}</p>
          <p className="text-xs text-ink-400 mt-0.5 font-mono">
            {totalTeto > 0
              ? `${(gastoAcumulado / totalTeto * 100).toFixed(1)}% do ${metaAnual != null ? 'meta' : 'teto'}`
              : '-'
            }
          </p>
        </div>
        <div className="bg-white border border-ink-100 rounded-2xl p-4">
          <p className="text-xs font-mono text-ink-400 uppercase tracking-wider mb-1">
            Ritmo médio/mês
          </p>
          <p className="text-xl font-display text-ink-900">{brl(ritmoMedio)}</p>
          <p className="text-xs text-ink-400 mt-0.5">baseado nos meses passados</p>
        </div>
        <div className="bg-white border border-ink-100 rounded-2xl p-4">
          <p className="text-xs font-mono text-ink-400 uppercase tracking-wider mb-1">
            {metaAnual != null ? 'Saldo da meta' : 'Limite restante'}
          </p>
          <p className={`text-xl font-display
            ${limiteRestante < 0 ? 'text-rose-600' : 'text-jade-600'}`}>
            {brl(limiteRestante)}
          </p>
          <p className="text-xs text-ink-400 mt-0.5">{mesesRestantes} meses pela frente</p>
        </div>
        <div className="bg-white border border-ink-100 rounded-2xl p-4">
          <p className="text-xs font-mono text-ink-400 uppercase tracking-wider mb-1">
            Limite médio/mês
          </p>
          <p className={`text-xl font-display
            ${ritmoMedio > limiteRestante / Math.max(mesesRestantes, 1)
              ? 'text-rose-600'
              : 'text-ink-900'
            }`}>
            {brl(mesesRestantes > 0 ? limiteRestante / mesesRestantes : 0)}
          </p>
          <p className="text-xs text-ink-400 mt-0.5">disponível por mês</p>
        </div>
      </div>

      {/* Gráfico */}
      <div className="bg-white border border-ink-100 rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-display text-xl text-ink-900">Evolução mensal</h3>
            <p className="text-xs text-ink-400 mt-0.5">
              Gastos reais + projeção dos meses futuros
              {metaAnual != null && (
                <span className="ml-1 text-jade-600 font-mono">
                  · linha de teto = meta ({brl(metaAnual)})
                </span>
              )}
            </p>
          </div>
          <div className="flex gap-4 text-xs text-ink-400 flex-wrap">
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm bg-ink-200 inline-block" />Limite
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm bg-jade-400 inline-block" />Gasto real
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm bg-amber-300 inline-block" />Projeção
            </span>
            {metaAnual != null && (
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-0.5 bg-jade-500 inline-block" />Meta/mês
              </span>
            )}
          </div>
        </div>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={chartData} barSize={18}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e8e6df" vertical={false} />
            <XAxis dataKey="mes" tick={{ fontSize: 11, fill: '#888278' }}
                   axisLine={false} tickLine={false} />
            <YAxis tickFormatter={brlShort} tick={{ fontSize: 11, fill: '#888278' }}
                   axisLine={false} tickLine={false} width={60} />
            <Tooltip content={<CustomTooltip />} />
            <ReferenceLine
              x={MESES[mesAtual]}
              stroke="#aaa49a"
              strokeDasharray="3 3"
              label={{ value: 'hoje', fill: '#aaa49a', fontSize: 9 }}
            />
            {/* Linha horizontal da meta mensal */}
            {metaAnual != null && (
              <ReferenceLine
                y={Math.round(metaAnual / 12)}
                stroke="#1d9e6a"
                strokeDasharray="4 2"
                strokeWidth={1.5}
                label={{
                  value: `Meta/mês: ${brlShort(metaAnual / 12)}`,
                  fill: '#1d9e6a',
                  fontSize: 9,
                  position: 'insideTopRight',
                }}
              />
            )}
            <Bar dataKey="Limite"     fill="#e8e6df" radius={[3,3,0,0]} />
            <Bar dataKey="Gasto real" fill="#3db984" radius={[3,3,0,0]} />
            <Bar dataKey="Projeção"   fill="#fec04d" radius={[3,3,0,0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Bottom grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white border border-ink-100 rounded-2xl p-5">
          <h3 className="font-display text-lg text-ink-900 mb-1">
            Maiores impactos nos próximos meses
          </h3>
          <p className="text-xs text-ink-400 mb-4">
            Categorias com maior peso projetado nos {mesesRestantes} meses restantes
          </p>
          <div className="space-y-3">
            {topImpacto.map((item, i) => {
              const pct = totalTeto > 0
                ? (item.projetadoRestante / totalTeto * 100).toFixed(1)
                : 0;
              const barPct = topImpacto[0].projetadoRestante > 0
                ? (item.projetadoRestante / topImpacto[0].projetadoRestante * 100)
                : 0;
              return (
                <div key={item.cat} className="flex items-center gap-3">
                  <span className="text-xs font-mono text-ink-400 w-4 flex-shrink-0">
                    {i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-ink-800 font-medium truncate mr-2">
                        {item.cat}
                      </span>
                      <span className="text-xs font-mono text-ink-500 flex-shrink-0">
                        {pct}% · {brl(item.projetadoRestante)}
                      </span>
                    </div>
                    <div className="h-1.5 bg-ink-100 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full bg-amber-400 transition-all duration-700"
                        style={{ width: `${barPct}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-white border border-ink-100 rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-ink-50">
            <h3 className="font-display text-lg text-ink-900">Detalhe por mês</h3>
            <p className="text-xs text-ink-400 mt-0.5">
              ● meses com dados reais · ◐ meses projetados
            </p>
          </div>
          <div className="overflow-auto max-h-72">
            <table className="w-full text-xs">
              <thead className="sticky top-0">
                <tr className="bg-ink-50">
                  <th className="text-left px-4 py-2.5 font-mono text-ink-400">Mês</th>
                  <th className="text-right px-4 py-2.5 font-mono text-ink-400">
                    {metaAnual != null ? 'Meta/mês' : 'Limite'}
                  </th>
                  <th className="text-right px-4 py-2.5 font-mono text-ink-400">
                    Real/Projeção
                  </th>
                  <th className="text-right px-4 py-2.5 font-mono text-ink-400">
                    Diferença
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-50">
                {projecaoMensal.map((row, i) => {
                  const isReal    = row.gastoReal != null;
                  const isFuturo  = row.projetado != null;
                  const isCurrent = i === mesAtual;
                  const valor     = isReal ? row.gastoReal : row.projetado;

                  // Se há meta, compara com meta/12; senão usa limiteOriginal
                  const referencia = metaAnual != null
                    ? metaAnual / 12
                    : row.limiteOriginal;

                  const dif = valor != null && referencia != null
                    ? valor - referencia
                    : null;

                  return (
                    <tr key={row.mes} className={`
                      ${isCurrent ? 'bg-jade-50/60 font-medium' : ''}
                      ${isReal && !isCurrent ? 'bg-jade-50/20' : ''}
                      ${isFuturo ? 'bg-amber-50/20' : ''}
                    `}>
                      <td className="px-4 py-2.5 font-mono text-ink-600">
                        <span className="flex items-center gap-1.5">
                          {isReal   && <span className="text-jade-500 text-xs">●</span>}
                          {isFuturo && <span className="text-amber-500 text-xs">◐</span>}
                          {!isReal && !isFuturo && (
                            <span className="text-ink-300 text-xs">○</span>
                          )}
                          {row.mes}
                          {isCurrent && (
                            <span className="text-jade-500 text-xs font-normal ml-1">
                              atual
                            </span>
                          )}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono text-ink-500">
                        {brl(referencia)}
                      </td>
                      <td className={`px-4 py-2.5 text-right font-mono font-medium
                        ${isReal
                          ? dif > 0 ? 'text-rose-600' : 'text-jade-700'
                          : 'text-amber-700'
                        }`}>
                        {valor != null ? brl(valor) : '—'}
                      </td>
                      <td className={`px-4 py-2.5 text-right font-mono
                        ${dif == null
                          ? 'text-ink-300'
                          : dif > 0 ? 'text-rose-500' : 'text-jade-600'
                        }`}>
                        {dif != null ? `${dif > 0 ? '+' : ''}${brl(dif)}` : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {!comparacaoResultado && (
        <div className="bg-ink-50 border border-ink-100 rounded-xl px-4 py-3 text-xs
                        text-ink-500 flex items-start gap-2">
          <svg className="w-4 h-4 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24"
               stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>
            A projeção está usando o padrão histórico de {ANO_BASE} como base.
            Para resultados mais precisos, carregue os gastos reais de {ANO_ORCAMENTO}{' '}
            na aba <strong>"Comparação real"</strong> e volte aqui.
          </span>
        </div>
      )}
    </div>
  );
}