import { brl, formatDate } from '../utils/formatters';

const TIPO_CONFIG = {
  deducao: { label: 'Redistribuição', color: 'bg-rose-50 border-rose-200 text-rose-800', badge: 'bg-rose-100 text-rose-700' },
  ajuste_teto: { label: 'Ajuste de teto', color: 'bg-amber-50 border-amber-200 text-amber-800', badge: 'bg-amber-100 text-amber-700' },
  comparacao_carregada: { label: 'Comparação carregada', color: 'bg-jade-50 border-jade-200 text-jade-800', badge: 'bg-jade-100 text-jade-700' },
};

export default function TabHistorico({ logAjustes, onClearLog }) {
  if (!logAjustes || logAjustes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="w-14 h-14 bg-ink-50 rounded-2xl flex items-center justify-center mb-4">
          <svg className="w-7 h-7 text-ink-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
        </div>
        <p className="font-display text-xl text-ink-600">Nenhum ajuste registrado</p>
        <p className="text-sm text-ink-400 mt-1 max-w-xs">
          Redistribuições e ajustes de teto feitos na aba "Comparação real" aparecerão aqui.
        </p>
      </div>
    );
  }

  const reversed = [...logAjustes].reverse();

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-2xl text-ink-900">Histórico de ajustes</h2>
          <p className="text-xs text-ink-400 font-mono mt-0.5">{logAjustes.length} registros · mais recente primeiro</p>
        </div>
        <button onClick={onClearLog}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono border border-rose-200 text-rose-600 hover:bg-rose-50 rounded-lg transition-colors">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
          Limpar histórico
        </button>
      </div>

      <div className="space-y-3">
        {reversed.map((entry) => {
          const cfg = TIPO_CONFIG[entry.tipo] || TIPO_CONFIG.deducao;
          return (
            <div key={entry.id} className={`border rounded-2xl p-5 ${cfg.color}`}>
              <div className="flex items-start justify-between gap-4 mb-3">
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-mono px-2 py-0.5 rounded-full ${cfg.badge}`}>{cfg.label}</span>
                  <span className="text-xs font-mono opacity-60">{formatDate(entry.timestamp)}</span>
                </div>
                <span className="text-sm font-display font-medium">{brl(entry.valor)}</span>
              </div>
              {entry.tipo === 'deducao' && (
                <>
                  <p className="text-sm font-medium mb-1">Origem: <span className="font-normal">{entry.catOrigem}</span></p>
                  {entry.catsDestino?.length > 0 && (
                    <div className="mt-2">
                      <p className="text-xs opacity-70 mb-1.5">Retirado de:</p>
                      <div className="space-y-1">
                        {entry.catsDestino.map((d, i) => (
                          <div key={i} className="flex justify-between text-xs font-mono">
                            <span className="opacity-80">{d.cat}</span>
                            <span className="font-medium">-{brl(d.valorDeduzido)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
              {entry.tipo === 'ajuste_teto' && (
                <p className="text-sm">
                  <span className="font-medium">{entry.catOrigem}</span>
                  {' '}— teto ajustado para <span className="font-medium">{brl(entry.valor)}</span>
                </p>
              )}
              {entry.tipo === 'comparacao_carregada' && (
                <p className="text-sm opacity-80">{entry.nota}</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}