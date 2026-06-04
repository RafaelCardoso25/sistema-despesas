import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine
} from 'recharts';
import { brl } from '../utils/formatters';
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

export default function TabVariacao({ data, tetosAjustados = {}, selected, onSelectChange }) {
  const sorted = [...data].sort((a, b) => a.cat.localeCompare(b.cat, 'pt'));

  // Usa o selected do pai; se vier vazio inicializa com a primeira categoria
  const selectedCat = selected || sorted[0]?.cat || '';

  const handleChange = (e) => {
    onSelectChange(e.target.value);
  };

  const cat = data.find(d => d.cat === selectedCat);

  // ── Teto ajustado (respeita meta e ajustes manuais) ───────────────────────
  const teto = cat
    ? (tetosAjustados[cat.cat] != null ? tetosAjustados[cat.cat] : cat.total)
    : 0;

  // ── Limite mensal proporcional ao teto ajustado ───────────────────────────
  const getLimiteAjustado = (i) => {
    if (!cat) return null;
    const limOriginal = cat.limite2026[i];
    if (limOriginal == null) return null;
    if (cat.total === 0) return null;
    return (teto / cat.total) * limOriginal;
  };

  const chartData = MESES.map((m, i) => ({
    mes: m,
    'Gasto 2025': cat?.vals[i] || null,
    'Limite 2026': getLimiteAjustado(i),
  }));

  const tableRows = MESES.map((m, i) => {
    const v    = cat?.vals[i];
    const prev = cat?.vals.slice(0, i).filter(x => x > 0).slice(-1)[0];
    const vr   = v && prev ? ((v - prev) / prev * 100) : null;
    const lim  = getLimiteAjustado(i);
    return { mes: m, v, prev, vr, lim, isPico: i === cat?.pico_idx };
  });

  const getVrEl = (vr) => {
    if (vr == null) return <span className="text-ink-300 font-mono text-xs">—</span>;
    const cls = vr > 50 ? 'text-rose-600' : vr > 20 ? 'text-amber-600' : vr > 0 ? 'text-ink-600' : 'text-jade-600';
    return (
      <span className={`font-mono text-xs ${cls}`}>
        {vr > 0 ? '+' : ''}{vr.toFixed(1)}%
      </span>
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <label className="block text-xs font-mono text-ink-400 uppercase tracking-wider mb-2">
          Selecionar categoria
        </label>
        <select
          value={selectedCat}
          onChange={handleChange}
          className="w-full md:w-auto min-w-[320px] px-4 py-2.5 text-sm border border-ink-200 rounded-xl bg-white text-ink-800 focus:outline-none focus:border-jade-400"
        >
          {sorted.map(d => (
            <option key={d.cat} value={d.cat}>{d.cat}</option>
          ))}
        </select>
      </div>

      {cat && (
        <>
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-white border border-ink-100 rounded-2xl p-4">
              <p className="text-xs font-mono text-ink-400 uppercase tracking-wider mb-1">Total 2025</p>
              <p className="text-xl font-display text-ink-900">{brl(cat.total)}</p>
            </div>
            <div className="bg-white border border-ink-100 rounded-2xl p-4">
              <p className="text-xs font-mono text-ink-400 uppercase tracking-wider mb-1">Mês de pico</p>
              <p className="text-xl font-display text-rose-600">{MESES[cat.pico_idx]}</p>
              <p className="text-xs text-ink-400 font-mono">{brl(cat.vals[cat.pico_idx])}</p>
            </div>
            <div className="bg-white border border-ink-100 rounded-2xl p-4">
              <p className="text-xs font-mono text-ink-400 uppercase tracking-wider mb-1">
                Teto 2026
              </p>
              <p className={`text-xl font-display ${tetosAjustados[cat.cat] != null ? 'text-jade-600' : 'text-ink-900'}`}>
                {brl(teto)}
              </p>
              {tetosAjustados[cat.cat] != null && (
                <p className="text-xs text-jade-500 font-mono">ajustado</p>
              )}
            </div>
          </div>

          <div className="bg-white border border-ink-100 rounded-2xl p-6">
            <h3 className="font-display text-lg text-ink-900 mb-1">Evolução mensal</h3>
            <p className="text-xs text-ink-400 mb-5">
              Linha vermelha = limite proporcional 2026 baseado no padrão histórico de {cat.cat}
            </p>
            <div className="flex gap-4 text-xs text-ink-400 mb-4">
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-0.5 bg-jade-500 inline-block rounded" />
                Gasto 2025
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-0.5 bg-rose-400 inline-block rounded" />
                Limite 2026
              </span>
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e8e6df" vertical={false} />
                <XAxis
                  dataKey="mes"
                  tick={{ fontSize: 11, fill: '#888278' }}
                  axisLine={false} tickLine={false}
                />
                <YAxis
                  tickFormatter={v => v >= 1000 ? `R$${(v / 1000).toFixed(0)}k` : `R$${v}`}
                  tick={{ fontSize: 11, fill: '#888278' }}
                  axisLine={false} tickLine={false} width={60}
                />
                <Tooltip content={<CustomTooltip />} />
                <ReferenceLine
                  x={MESES[cat.pico_idx]}
                  stroke="#fca5a5"
                  strokeDasharray="4 4"
                  label={{ value: 'pico', fill: '#f87171', fontSize: 10 }}
                />
                <Line
                  type="monotone" dataKey="Gasto 2025"
                  stroke="#1d9e6a" strokeWidth={2}
                  dot={{ r: 3, fill: '#1d9e6a' }} connectNulls={false}
                />
                <Line
                  type="monotone" dataKey="Limite 2026"
                  stroke="#e11d48" strokeWidth={1.5} strokeDasharray="5 5"
                  dot={{ r: 2, fill: '#e11d48' }} connectNulls={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-white border border-ink-100 rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-ink-50">
              <h3 className="font-display text-lg text-ink-900">Detalhe por mês</h3>
              <p className="text-xs text-ink-400 mt-0.5">
                Variação calculada em relação ao último mês com gasto registrado
              </p>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-ink-50">
                  <th className="text-left px-5 py-3 text-xs font-mono text-ink-400">Mês</th>
                  <th className="text-right px-5 py-3 text-xs font-mono text-ink-400">Gasto 2025</th>
                  <th className="text-right px-5 py-3 text-xs font-mono text-ink-400">Var. vs anterior</th>
                  <th className="text-right px-5 py-3 text-xs font-mono text-ink-400">Limite 2026</th>
                  <th className="text-center px-5 py-3 text-xs font-mono text-ink-400">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-50">
                {tableRows.map((row, i) => (
                  <tr key={i} className={`tbl-row ${row.isPico ? 'bg-rose-50' : ''}`}>
                    <td className="px-5 py-3 font-mono text-ink-700">{row.mes}</td>
                    <td className="px-5 py-3 text-right font-mono text-ink-700">{brl(row.v)}</td>
                    <td className="px-5 py-3 text-right">{getVrEl(row.vr)}</td>
                    <td className="px-5 py-3 text-right font-mono text-jade-700">{brl(row.lim)}</td>
                    <td className="px-5 py-3 text-center">
                      {row.isPico
                        ? <span className="text-xs bg-rose-100 text-rose-700 px-2 py-0.5 rounded-full font-mono">Pico anual</span>
                        : row.vr > 50
                        ? <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-mono">Alta</span>
                        : row.v
                        ? <span className="text-xs bg-jade-50 text-jade-600 px-2 py-0.5 rounded-full font-mono">Normal</span>
                        : <span className="text-xs text-ink-300 font-mono">Sem gasto</span>
                      }
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}