import { useMemo, useState } from 'react';
import { buildAlertas } from '../utils/exportUtils';
import { brl } from '../utils/formatters';
import { ANO_ORCAMENTO } from '../config';

export default function TabAlertas({ data }) {
  const [threshold, setThreshold] = useState(50);
  const [search, setSearch] = useState('');

  const alertas = useMemo(() => {
    return buildAlertas(data).filter(a => {
      const matchPct = a.pct >= threshold;
      const matchSearch = a.cat.toLowerCase().includes(search.toLowerCase());
      return matchPct && matchSearch;
    });
  }, [data, threshold, search]);

  const criticos = alertas.filter(a => a.pct >= 100).length;
  const altos = alertas.filter(a => a.pct >= 50 && a.pct < 100).length;

  const getSeverity = (pct) => {
    if (pct >= 100) return { label: 'Crítico', cls: 'bg-rose-50 border-rose-200 text-rose-800', badge: 'bg-rose-100 text-rose-700' };
    if (pct >= 75) return { label: 'Alto', cls: 'bg-amber-50 border-amber-200 text-amber-800', badge: 'bg-amber-100 text-amber-700' };
    return { label: 'Moderado', cls: 'bg-ink-50 border-ink-200 text-ink-800', badge: 'bg-ink-100 text-ink-600' };
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-rose-50 border border-rose-100 rounded-2xl p-4">
          <p className="text-xs font-mono text-rose-500 uppercase tracking-wider mb-1">Críticos (+100%)</p>
          <p className="text-3xl font-display text-rose-700">{criticos}</p>
        </div>
        <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4">
          <p className="text-xs font-mono text-amber-600 uppercase tracking-wider mb-1">Altos (+50%)</p>
          <p className="text-3xl font-display text-amber-700">{altos}</p>
        </div>
        <div className="bg-white border border-ink-100 rounded-2xl p-4">
          <p className="text-xs font-mono text-ink-400 uppercase tracking-wider mb-1">Total alertas</p>
          <p className="text-3xl font-display text-ink-800">{alertas.length}</p>
        </div>
      </div>

      <div className="flex gap-3 flex-wrap items-end">
        <div className="flex-1 min-w-[200px]">
          <label className="block text-xs font-mono text-ink-400 mb-1">Buscar categoria</label>
          <input
            type="text"
            placeholder="ex: Brindes..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full px-4 py-2.5 text-sm border border-ink-200 rounded-xl bg-white text-ink-800 focus:outline-none focus:border-jade-400 font-mono"
          />
        </div>
        <div>
          <label className="block text-xs font-mono text-ink-400 mb-1">
            Variação mínima: <strong>{threshold}%</strong>
          </label>
          <input
            type="range" min={20} max={200} step={5}
            value={threshold}
            onChange={e => setThreshold(Number(e.target.value))}
            className="w-40"
          />
        </div>
      </div>

      {alertas.length === 0 ? (
        <div className="text-center py-16 text-ink-400">
          <p className="text-4xl mb-3">✓</p>
          <p className="font-display text-xl text-ink-600">Nenhum alerta encontrado</p>
          <p className="text-sm mt-1">Tente reduzir o filtro de variação mínima</p>
        </div>
      ) : (
        <div className="space-y-3">
          {alertas.map((a, i) => {
            const sev = getSeverity(a.pct);
            return (
              <div key={i} className={`border rounded-2xl p-5 ${sev.cls}`}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`text-xs font-mono px-2 py-0.5 rounded-full ${sev.badge}`}>{sev.label}</span>
                      <span className="text-xs font-mono text-ink-400">{a.mesPrev} → {a.mes}</span>
                    </div>
                    <p className="font-medium text-sm">{a.cat}</p>
                    <p className="text-sm mt-1 opacity-80">
                      Em <strong>{a.mes}</strong>, o gasto subiu <strong>+{a.pct.toFixed(0)}%</strong> em relação a {a.mesPrev}
                      &nbsp;({brl(a.vPrev)} → {brl(a.vCur)})
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-xs font-mono opacity-60 mb-0.5">Limite sugerido {a.mes}/{ANO_ORCAMENTO}</p>
                    <p className="text-lg font-display">{brl(a.lim)}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}