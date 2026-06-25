import { useState, useMemo } from 'react';
import { brl } from '../utils/formatters';
import { MESES } from '../config';

function TetoBadge(vp) {
  if (vp == null)  return <span className="text-xs font-mono text-ink-300">n/a</span>;
  if (vp > 100)    return <span className="bg-rose-50 text-rose-700 border border-rose-200 text-xs font-mono px-2 py-0.5 rounded-full">+{vp.toFixed(0)}% ⚠</span>;
  if (vp > 40)     return <span className="bg-amber-50 text-amber-700 border border-amber-200 text-xs font-mono px-2 py-0.5 rounded-full">+{vp.toFixed(0)}%</span>;
  if (vp > 0)      return <span className="bg-jade-50 text-jade-700 border border-jade-200 text-xs font-mono px-2 py-0.5 rounded-full">+{vp.toFixed(0)}%</span>;
  return <span className="text-xs font-mono text-jade-600">{vp.toFixed(0)}%</span>;
}

function AjusteModal({ cat, delta, temMeta, resultado, onCompensar, onClose }) {
  const [busca, setBusca]               = useState('');
  const [selecionadas, setSelecionadas] = useState([]);
  const isAumento = delta > 0;

  // ── Corrigido: filtra apenas para exibição, seleção é independente ────────
  const disponiveis = resultado
    .filter(r => r.cat !== cat)
    .sort((a, b) => b.teto - a.teto);

  const visiveis = disponiveis
    .filter(r => r.cat.toLowerCase().includes(busca.toLowerCase()));

  const toggle = (c) =>
    setSelecionadas(prev =>
      prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c]
    );

  // Preview usa TODAS as selecionadas (não só as visíveis)
  const totalTetosSel = disponiveis
    .filter(r => selecionadas.includes(r.cat))
    .reduce((s, r) => s + r.teto, 0);

  const preview = disponiveis
    .filter(r => selecionadas.includes(r.cat))
    .map(r => ({
      cat: r.cat,
      valor: totalTetosSel > 0
        ? (r.teto / totalTetosSel) * Math.abs(delta)
        : Math.abs(delta) / selecionadas.length,
    }));

  const canCompensar = selecionadas.length > 0;

  // Contador de selecionadas fora do filtro atual
  const selForaDoFiltro = selecionadas.filter(
    c => !visiveis.find(r => r.cat === c)
  ).length;

  return (
    <div className="fixed inset-0 bg-ink-900/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="px-6 py-4 border-b border-ink-100 flex items-start justify-between">
          <div>
            <h3 className="font-display text-lg text-ink-900">
              {isAumento ? 'Limite aumentado' : 'Limite reduzido'}
            </h3>
            <p className="text-xs text-ink-400 font-mono mt-0.5">{cat}</p>
          </div>
          <button onClick={onClose} className="text-ink-400 hover:text-ink-700">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-auto px-6 py-4 space-y-4">
          <div className={`rounded-xl px-4 py-3 text-sm border
            ${isAumento
              ? 'bg-rose-50 border-rose-200 text-rose-800'
              : 'bg-jade-50 border-jade-200 text-jade-800'
            }`}>
            {isAumento ? (
              <>Você <strong>aumentou</strong> o limite de <strong>{cat}</strong> em{' '}
                <strong>{brl(delta)}</strong>
                {temMeta
                  ? <> e a meta anual já subiu junto automaticamente.</>
                  : <>.</>}{' '}
                Se preferir, compense esse valor reduzindo outras categorias
                {temMeta ? <> (a meta volta ao valor anterior).</> : <> para manter o total.</>}</>
            ) : (
              <>Você <strong>reduziu</strong> o limite de <strong>{cat}</strong> em{' '}
                <strong>{brl(Math.abs(delta))}</strong>
                {temMeta
                  ? <> e a meta anual já caiu junto automaticamente.</>
                  : <>.</>}{' '}
                Se preferir, distribua esse saldo para outras categorias
                {temMeta ? <> (a meta volta ao valor anterior).</> : <> para manter o total.</>}</>
            )}
          </div>

          {/* Opção: Compensar em outra categoria */}
          <div className="border-2 border-ink-200 rounded-xl overflow-hidden">
            <div className="px-4 py-3 bg-ink-50 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center
                              justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-amber-600" fill="none" viewBox="0 0 24 24"
                     stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                </svg>
              </div>
              <div>
                <p className="font-medium text-ink-800 text-sm">
                  {isAumento ? 'Compensar em outra categoria' : 'Distribuir para outra categoria'}
                </p>
                <p className="text-xs text-ink-400">
                  {isAumento
                    ? `Reduz ${brl(delta)} de outras categorias. A meta não muda.`
                    : `Distribui ${brl(Math.abs(delta))} para outras categorias. A meta não muda.`
                  }
                </p>
              </div>
            </div>

            <div className="px-4 py-3 space-y-2">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="Buscar categoria..."
                  value={busca}
                  onChange={e => setBusca(e.target.value)}
                  className="flex-1 px-3 py-2 text-xs border border-ink-200 rounded-lg
                             font-mono focus:outline-none focus:border-jade-400"
                />
                {/* Aviso de selecionadas fora do filtro */}
                {selForaDoFiltro > 0 && (
                  <span className="text-xs font-mono bg-amber-100 text-amber-700
                                   px-2 py-1 rounded-lg whitespace-nowrap">
                    +{selForaDoFiltro} oculta{selForaDoFiltro > 1 ? 's' : ''}
                  </span>
                )}
              </div>

              {/* Contador geral de selecionadas */}
              {selecionadas.length > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-ink-500 font-mono">
                    {selecionadas.length} categoria{selecionadas.length > 1 ? 's' : ''} selecionada{selecionadas.length > 1 ? 's' : ''}
                  </span>
                  <button
                    onClick={() => setSelecionadas([])}
                    className="text-xs text-rose-500 hover:text-rose-700 font-mono underline"
                  >
                    Limpar seleção
                  </button>
                </div>
              )}

              <div className="max-h-44 overflow-y-auto border border-ink-100 rounded-lg">
                {visiveis.length === 0 && (
                  <p className="text-xs text-ink-400 font-mono text-center py-4">
                    Nenhuma categoria encontrada
                  </p>
                )}
                {visiveis.map(r => {
                  const sel  = selecionadas.includes(r.cat);
                  const prev = preview.find(p => p.cat === r.cat);
                  return (
                    <button key={r.cat} onClick={() => toggle(r.cat)}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 border-b
                                  border-ink-50 text-left transition-colors
                        ${sel ? 'bg-amber-50' : 'bg-white hover:bg-ink-50'}`}>
                      <div className={`w-4 h-4 rounded border-2 flex items-center
                                      justify-center flex-shrink-0
                        ${sel ? 'bg-amber-500 border-amber-500' : 'border-ink-300'}`}>
                        {sel && (
                          <svg className="w-2.5 h-2.5 text-white" fill="none"
                               viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round"
                              strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>
                      <span className="flex-1 text-xs text-ink-800 font-medium">
                        {r.cat}
                      </span>
                      <span className="text-xs font-mono text-ink-400">
                        {brl(r.teto)}
                      </span>
                      {sel && prev && (
                        <span className={`text-xs font-mono font-medium ml-1
                          ${isAumento ? 'text-rose-600' : 'text-jade-600'}`}>
                          {isAumento ? '-' : '+'}{brl(prev.valor)}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Preview de todas as selecionadas (com ou sem filtro) */}
            {preview.length > 0 && (
              <div className="px-4 pb-3">
                <p className="text-xs font-mono text-ink-400 mb-1.5 uppercase tracking-wider">
                  Resumo do ajuste
                </p>
                <div className="bg-ink-50 rounded-lg p-3 space-y-1 max-h-32 overflow-y-auto">
                  {preview.map(p => (
                    <div key={p.cat} className="flex justify-between text-xs font-mono">
                      <span className="text-ink-600 truncate mr-4">{p.cat}</span>
                      <span className={isAumento
                        ? 'text-rose-600 font-medium'
                        : 'text-jade-600 font-medium'}>
                        {isAumento ? '-' : '+'}{brl(p.valor)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="px-4 pb-3">
              <button
                disabled={!canCompensar}
                onClick={() => onCompensar(selecionadas, preview)}
                className="w-full py-2.5 text-sm bg-amber-500 text-white rounded-xl
                           hover:bg-amber-600 disabled:opacity-40
                           disabled:cursor-not-allowed font-medium transition-colors"
              >
                {isAumento ? 'Confirmar compensação' : 'Confirmar distribuição'}
                {selecionadas.length > 0 && ` (${selecionadas.length})`}
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-ink-100">
          <button onClick={onClose}
            className="w-full py-2 text-sm border border-ink-200 text-ink-500
                       rounded-xl hover:bg-ink-50">
            {temMeta
              ? 'Manter assim (a meta já foi ajustada)'
              : 'Manter apenas o ajuste desta categoria'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function TabLimites({
  data,
  tetosAjustados,
  metaAnual,
  onEditarTeto,
  onCompensarTetos,
}) {
  const [search,      setSearch]      = useState('');
  const [sort,        setSort]        = useState('total_desc');
  const [expanded,    setExpanded]    = useState(null);
  const [editando,    setEditando]    = useState(null);
  const [editVal,     setEditVal]     = useState('');
  const [modalAjuste, setModalAjuste] = useState(null);

  const getTeto = (cat) => {
    const d = data.find(x => x.cat === cat);
    if (!d) return 0;
    return tetosAjustados[cat] != null ? tetosAjustados[cat] : d.total;
  };

  const resultadoSimples = useMemo(() =>
    data.map(d => ({
      cat: d.cat,
      teto: tetosAjustados[d.cat] != null ? tetosAjustados[d.cat] : d.total,
    })),
    [data, tetosAjustados]
  );

  const somaTetoAtual = data.reduce((s, d) =>
    s + (tetosAjustados[d.cat] != null ? tetosAjustados[d.cat] : d.total), 0
  );

  const filtered = useMemo(() => {
    let list = data.filter(d =>
      d.cat.toLowerCase().includes(search.toLowerCase())
    );
    if (sort === 'total_desc')     list.sort((a, b) => b.total - a.total);
    else if (sort === 'total_asc') list.sort((a, b) => a.total - b.total);
    else                           list.sort((a, b) => a.cat.localeCompare(b.cat, 'pt'));
    return list;
  }, [data, search, sort]);

  const startEdit = (d) => {
    const tetoAtual = tetosAjustados[d.cat] != null ? tetosAjustados[d.cat] : d.total;
    setEditando(d.cat);
    setEditVal(tetoAtual.toFixed(2).replace('.', ','));
  };

  const confirmEdit = (cat) => {
    const num = parseFloat(editVal.replace(',', '.'));
    if (isNaN(num) || num < 0) { setEditando(null); return; }

    const tetoAnterior = getTeto(cat);
    const delta        = num - tetoAnterior;

    // Aplica o teto e a meta já acompanha automaticamente
    onEditarTeto(cat, num, delta);
    setEditando(null);

    if (Math.abs(delta) < 0.01) return;

    // O modal aparece apenas para oferecer a compensação em outras categorias
    setModalAjuste({ cat, novoValor: num, delta, tetoAnterior });
  };

  // ── Compensar: distribui o ajuste em outras categorias e mantém a meta ────
  const handleCompensar = (catsDestino, preview) => {
    if (!modalAjuste) return;
    const isAumento = modalAjuste.delta > 0;

    const ajustes = preview.map(p => {
      const tetoAtual = getTeto(p.cat);
      const novoTeto  = isAumento
        ? Math.max(0, tetoAtual - p.valor)
        : tetoAtual + p.valor;
      return { cat: p.cat, novoTeto };
    });

    // deltaRevert desfaz o ajuste automático que a meta sofreu na edição
    onCompensarTetos(ajustes, modalAjuste.delta);
    setModalAjuste(null);
  };

  return (
    <div>
      {modalAjuste && (
        <AjusteModal
          cat={modalAjuste.cat}
          delta={modalAjuste.delta}
          temMeta={metaAnual != null}
          resultado={resultadoSimples.filter(r => r.cat !== modalAjuste.cat)}
          onCompensar={handleCompensar}
          onClose={() => setModalAjuste(null)}
        />
      )}

      {/* Banner de meta ativa */}
      {metaAnual != null && (
        <div className="mb-4 bg-jade-50 border border-jade-200 rounded-xl px-4 py-3
                        flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-jade-600 flex-shrink-0" fill="none"
                 viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <p className="text-xs font-medium text-jade-800">Meta anual ativa</p>
              <p className="text-xs text-jade-600 font-mono">
                {brl(metaAnual)} · soma atual dos tetos:{' '}
                <strong>{brl(somaTetoAtual)}</strong>
              </p>
            </div>
          </div>
          <span className={`text-xs font-mono font-medium px-2 py-1 rounded-lg
            ${Math.abs(somaTetoAtual - metaAnual) < 1
              ? 'bg-jade-100 text-jade-700'
              : 'bg-amber-100 text-amber-700'
            }`}>
            {Math.abs(somaTetoAtual - metaAnual) < 1
              ? '✓ Alinhada'
              : 'Diverge por ajustes manuais'
            }
          </span>
        </div>
      )}

      <div className="flex gap-3 mb-4 flex-wrap items-center">
        <div className="flex-1 relative min-w-[180px]">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-300 w-4 h-4"
               fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input type="text" placeholder="Buscar categoria..." value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 text-sm border border-ink-200 rounded-xl
                       bg-white text-ink-800 focus:outline-none focus:border-jade-400
                       font-mono" />
        </div>
        <select value={sort} onChange={e => setSort(e.target.value)}
          className="px-4 py-2.5 text-sm border border-ink-200 rounded-xl bg-white
                     text-ink-700 focus:outline-none focus:border-jade-400">
          <option value="total_desc">Maior gasto</option>
          <option value="total_asc">Menor gasto</option>
          <option value="nome">Alfabética</option>
        </select>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5 text-xs
                      text-amber-800 mb-4 flex items-center gap-2">
        <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24"
             stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5
               m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
        </svg>
        Clique no ícone de edição para ajustar o teto anual. Ao alterar, o sistema pergunta
        se você quer ajustar a meta ou compensar em outra categoria.
      </div>

      <p className="text-xs text-ink-400 font-mono mb-3">
        {filtered.length} categorias · clique em uma linha para ver detalhe mensal
      </p>

      <div className="border border-ink-100 rounded-2xl overflow-hidden">
        <div className="overflow-auto max-h-[560px]">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10">
              <tr className="bg-ink-50 border-b border-ink-100">
                <th className="text-left px-5 py-3 text-xs font-mono text-ink-400
                               uppercase tracking-wider w-[30%]">Categoria</th>
                <th className="text-right px-5 py-3 text-xs font-mono text-ink-400
                               uppercase tracking-wider">Total 2025</th>
                <th className="text-right px-5 py-3 text-xs font-mono text-ink-400
                               uppercase tracking-wider">Teto 2026</th>
                <th className="text-right px-5 py-3 text-xs font-mono text-ink-400
                               uppercase tracking-wider">Média/mês</th>
                <th className="text-right px-5 py-3 text-xs font-mono text-ink-400
                               uppercase tracking-wider">Limite/mês</th>
                <th className="text-center px-5 py-3 text-xs font-mono text-ink-400
                               uppercase tracking-wider">Pico</th>
                <th className="text-center px-5 py-3 text-xs font-mono text-ink-400
                               uppercase tracking-wider">Var.</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-ink-50">
              {filtered.map((d) => {
                const tetoAjustado = tetosAjustados[d.cat] != null
                  ? tetosAjustados[d.cat]
                  : d.total;
                const foiAjustado = tetosAjustados[d.cat] != null;
                const ativos      = d.limite2026.filter(v => v != null);
                const mediaLim    = ativos.length ? tetoAjustado / ativos.length : 0;
                const isOpen      = expanded === d.cat;

                return [
                  <tr key={d.cat} className="tbl-row cursor-pointer"
                      onClick={() => setExpanded(isOpen ? null : d.cat)}>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2">
                        <svg className={`w-3.5 h-3.5 text-ink-300 transition-transform
                                        flex-shrink-0 ${isOpen ? 'rotate-90' : ''}`}
                             fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round"
                            strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                        <span className="font-medium text-ink-800">{d.cat}</span>
                        {foiAjustado && (
                          <span className="text-xs bg-amber-100 text-amber-700
                                           px-1.5 py-0.5 rounded font-mono">
                            ajustado
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-right font-mono text-ink-500">
                      {brl(d.total)}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      {editando === d.cat ? (
                        <div className="flex items-center gap-1 justify-end"
                             onClick={e => e.stopPropagation()}>
                          <span className="text-xs font-mono text-ink-400">R$</span>
                          <input
                            autoFocus
                            value={editVal}
                            onChange={e => setEditVal(e.target.value)}
                            onKeyDown={e => {
                              if (e.key === 'Enter')  confirmEdit(d.cat);
                              if (e.key === 'Escape') setEditando(null);
                            }}
                            className="w-28 px-2 py-1 text-xs font-mono border
                                       border-jade-400 rounded text-right
                                       focus:outline-none"
                          />
                          <button onClick={() => confirmEdit(d.cat)}
                            className="text-jade-600 hover:text-jade-700">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24"
                                 stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round"
                                strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                          </button>
                          <button onClick={() => setEditando(null)}
                            className="text-ink-400 hover:text-ink-600">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24"
                                 stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round"
                                strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 justify-end"
                             onClick={e => { e.stopPropagation(); startEdit(d); }}>
                          <span className={`font-mono
                            ${foiAjustado ? 'text-amber-700 font-medium' : 'text-ink-700'}`}>
                            {brl(tetoAjustado)}
                          </span>
                          <svg className="w-3.5 h-3.5 text-ink-300 hover:text-ink-500
                                         cursor-pointer"
                               fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round"
                              strokeWidth={2}
                              d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0
                                 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828
                                 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </div>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-right font-mono text-ink-500">
                      {brl(d.media)}
                    </td>
                    <td className="px-5 py-3.5 text-right font-mono text-jade-700 font-medium">
                      {brl(mediaLim)}
                    </td>
                    <td className="px-5 py-3.5 text-center text-xs font-mono
                                   text-ink-600 bg-ink-50">
                      {MESES[d.pico_idx]}
                    </td>
                    <td className="px-5 py-3.5 text-center">
                      {TetoBadge(d.var_pico)}
                    </td>
                  </tr>,

                  isOpen && (
                    <tr key={d.cat + '_detail'} className="bg-jade-50">
                      <td colSpan={7} className="px-5 py-4">
                        <p className="text-xs font-mono text-jade-700 mb-3
                                      uppercase tracking-wider">
                          Detalhe mensal — {d.cat}
                        </p>
                        <div className="overflow-auto">
                          <table className="w-full text-xs">
                            <thead>
                              <tr>
                                {MESES.map(m => (
                                  <th key={m} className="text-center px-2 py-1
                                                         font-mono text-ink-400">
                                    {m}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              <tr>
                                {d.vals.map((v, mi) => (
                                  <td key={mi} className={`text-center px-2 py-1 font-mono
                                    ${mi === d.pico_idx
                                      ? 'text-rose-600 font-medium'
                                      : 'text-ink-600'
                                    }`}>
                                    {v
                                      ? v.toLocaleString('pt-BR', { maximumFractionDigits: 0 })
                                      : '—'
                                    }
                                  </td>
                                ))}
                              </tr>
                              <tr className="border-t border-jade-200">
                                {d.limite2026.map((v, mi) => (
                                  <td key={mi} className="text-center px-2 py-1
                                                          font-mono text-jade-700">
                                    {v
                                      ? (tetoAjustado / d.total * v).toLocaleString(
                                          'pt-BR', { maximumFractionDigits: 0 }
                                        )
                                      : '—'
                                    }
                                  </td>
                                ))}
                              </tr>
                            </tbody>
                          </table>
                        </div>
                        <div className="flex gap-4 mt-2">
                          <span className="flex items-center gap-1 text-xs text-ink-400">
                            <span className="w-2 h-2 bg-ink-300 rounded-sm inline-block" />
                            2025
                          </span>
                          <span className="flex items-center gap-1 text-xs text-jade-600">
                            <span className="w-2 h-2 bg-jade-400 rounded-sm inline-block" />
                            Limite 2026
                          </span>
                        </div>
                      </td>
                    </tr>
                  ),
                ];
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}