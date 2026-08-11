const MESES = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

function normalizarDeducao(ded) {
  if (!ded) return { recebido: 0, cedido: 0, pago: false, pagoValor: 0 };

  if (ded.tipo === 'receptora') {
    return { recebido: 0, cedido: ded.valor || 0, pago: false, pagoValor: 0 };
  }

  if (ded.tipo === 'pago') {
    return { recebido: ded.valor || 0, cedido: 0, pago: true, pagoValor: ded.valor || 0 };
  }

  return {
    recebido: ded.recebido || 0,
    cedido: ded.cedido || 0,
    pago: !!ded.pago,
    pagoValor: ded.pagoValor || 0,
  };
}

function distribuirNosMeses(valor, mesesFuturos, pesosHistoricos) {
  const distribuido = Array(12).fill(null);
  const somaPesos = pesosHistoricos.reduce((s, v) => s + v, 0);

  mesesFuturos.forEach((mesIdx, j) => {
    if (somaPesos === 0) {
      distribuido[mesIdx] = mesesFuturos.length ? valor / mesesFuturos.length : 0;
    } else {
      distribuido[mesIdx] = (pesosHistoricos[j] / somaPesos) * valor;
    }
  });

  return distribuido;
}

export function recalcularLimites(baseData, realData2026, tetosAjustados = {}, deducoesAplicadas = {}) {
  const realMap = {};
  realData2026.forEach(d => { realMap[d.cat] = d.vals; });

  // Conjunto de categorias que existem na base 2025
  const catsBase = new Set(baseData.map(d => d.cat));

  // ── Detecta categorias novas (existem em 2026 mas não em 2025) ──────────
  const catsNovas = realData2026.filter(d => !catsBase.has(d.cat));

  // Quais meses REALMENTE têm gasto lançado. Não é um bloco contínuo a partir
  // de janeiro: quem sobe só julho tem dados apenas em julho.
  const mesesComDados = Array.from({ length: 12 }, (_, i) =>
    Object.values(realMap).some(vals => vals[i] != null && vals[i] > 0)
  );
  const ultimoMesReal = mesesComDados.lastIndexOf(true);

  // ── Processa categorias normais (existem em 2025) ────────────────────────
  const resultadoBase = baseData.map(base => {
    const real = realMap[base.cat] || Array(12).fill(null);
    const gastoReal = real.reduce((s, v) => s + (v || 0), 0);

    const tetoBase = tetosAjustados[base.cat] != null ? tetosAjustados[base.cat] : base.total;

    const ded = normalizarDeducao(deducoesAplicadas[base.cat]);
    const ajusteLiquido = ded.recebido - ded.cedido;
    const isPago = ded.pago;
    const deducaoOrigem = ded.recebido;
    const deducaoReceptora = ded.cedido;
    const deducaoTotal = ajusteLiquido;

    const tetoEfetivo = Math.max(0, tetoBase + ajusteLiquido);

    const saldoBruto = Math.max(0, tetoEfetivo - gastoReal);
    const saldoRestante = saldoBruto;

    const mesesFuturos = Array.from({ length: 12 }, (_, i) => i)
      .filter(i => i > ultimoMesReal);

    const pesosHistoricos = mesesFuturos.map(i => base.vals[i] || 0);
    const limitesRecalculados = distribuirNosMeses(saldoRestante, mesesFuturos, pesosHistoricos);
    const deducoesMensais = distribuirNosMeses(ajusteLiquido, mesesFuturos, pesosHistoricos);

    const variacoesRecalc = Array(12).fill(null);
    for (let i = 1; i < 12; i++) {
      const cur = limitesRecalculados[i];
      if (cur == null) continue;
      const prevReal = real.slice(0, i).filter(v => v > 0).slice(-1)[0];
      const prevRecalc = limitesRecalculados.slice(0, i).filter(v => v != null).slice(-1)[0];
      const prev = i <= ultimoMesReal + 1 ? prevReal : prevRecalc;
      if (prev) variacoesRecalc[i] = ((cur - prev) / prev) * 100;
    }

    const diferencas = Array(12).fill(null);
    const limiteOriginal = base.limite2026;
    for (let i = 0; i <= ultimoMesReal; i++) {
      const r = real[i];
      const l = limiteOriginal[i];
      if (r != null && l != null) diferencas[i] = r - l;
      else if (r != null) diferencas[i] = r;
    }

    const percentualUsado = tetoEfetivo > 0 ? (gastoReal / tetoEfetivo) * 100 : 0;
    const estourou = gastoReal > tetoEfetivo;
    const atingiu100 = !estourou && percentualUsado >= 99.5;
    const pago = (isPago && !estourou) || atingiu100;

    return {
      cat: base.cat,
      teto: tetoBase,
      tetoEfetivo,
      deducaoOrigem,
      deducaoReceptora,
      deducaoTotal,
      deducoesMensais,
      gastoReal,
      saldoRestante,
      percentualUsado,
      estourou,
      pago,
      real,
      limiteOriginal,
      limitesRecalculados,
      variacoesRecalc,
      diferencas,
      ultimoMesReal,
      mesesComDados,
      mesesFuturos,
      valsBase: base.vals,
      variacoesBase: base.variacoes,
      isCategoriaNova: false,
    };
  });

  // ── Processa categorias novas (só existem em 2026) ───────────────────────
  const resultadoNovas = catsNovas.map(nova => {
    const real = nova.vals;
    const gastoReal = real.reduce((s, v) => s + (v || 0), 0);

    // Teto = 0 porque não havia previsão em 2025
    const tetoBase = 0;

    const ded = normalizarDeducao(deducoesAplicadas[nova.cat]);
    const ajusteLiquido = ded.recebido - ded.cedido;
    const deducaoOrigem = ded.recebido;
    const deducaoReceptora = ded.cedido;
    const deducaoTotal = ajusteLiquido;

    // Teto efetivo começa em 0, mas pode crescer se o usuário deduzir de outra categoria
    const tetoEfetivo = Math.max(0, tetoBase + ajusteLiquido);

    // Sempre estourada: gastou algo com teto zero
    // A não ser que o usuário já tenha aumentado o limite via deducao
    const estourou = gastoReal > tetoEfetivo;

    // Saldo restante: negativo se estourou, positivo se recebeu deducao suficiente
    const saldoRestante = Math.max(0, tetoEfetivo - gastoReal);

    const mesesFuturos = Array.from({ length: 12 }, (_, i) => i)
      .filter(i => i > ultimoMesReal);

    // Sem histórico 2025 → distribui igualmente nos meses futuros
    const pesosHistoricos = mesesFuturos.map(() => 1);
    const limitesRecalculados = distribuirNosMeses(saldoRestante, mesesFuturos, pesosHistoricos);
    const deducoesMensais = distribuirNosMeses(ajusteLiquido, mesesFuturos, pesosHistoricos);

    // limiteOriginal = tudo zero (não havia previsão)
    const limiteOriginal = Array(12).fill(null);

    // Diferença = tudo que gastou é "excesso" pois não havia limite
    const diferencas = Array(12).fill(null);
    for (let i = 0; i <= ultimoMesReal; i++) {
      if (real[i] != null && real[i] > 0) diferencas[i] = real[i];
    }

    const percentualUsado = tetoEfetivo > 0 ? (gastoReal / tetoEfetivo) * 100 : 100;

    return {
      cat: nova.cat,
      teto: tetoBase,
      tetoEfetivo,
      deducaoOrigem,
      deducaoReceptora,
      deducaoTotal,
      deducoesMensais,
      gastoReal,
      saldoRestante,
      percentualUsado,
      estourou,
      pago: false,
      real,
      limiteOriginal,
      limitesRecalculados,
      variacoesRecalc: Array(12).fill(null),
      diferencas,
      ultimoMesReal,
      mesesComDados,
      mesesFuturos,
      valsBase: Array(12).fill(0),
      variacoesBase: Array(12).fill(null),
      isCategoriaNova: true, // flag para usar na UI se quiser
    };
  });

  return [...resultadoBase, ...resultadoNovas];
}

export function aplicarDeducao(deducoesAplicadas, catOrigem, valorDeduzir, catsDestino, resultado) {
  const novas = { ...deducoesAplicadas };

  const catOrigemData = resultado.find(r => r.cat === catOrigem);
  const isEstourou = catOrigemData?.estourou;

  const dedOrigem = normalizarDeducao(novas[catOrigem]);
  novas[catOrigem] = {
    ...dedOrigem,
    recebido: dedOrigem.recebido + valorDeduzir,
    pago: dedOrigem.pago || isEstourou,
    pagoValor: dedOrigem.pagoValor + (isEstourou ? valorDeduzir : 0),
  };

  const totalTetos = catsDestino.reduce((s, c) => s + (c.tetoEfetivo || c.teto || 0), 0);

  catsDestino.forEach(c => {
    const proporcao = totalTetos > 0 ? (c.tetoEfetivo || c.teto || 0) / totalTetos : 1 / catsDestino.length;
    const valorParaEsta = valorDeduzir * proporcao;

    const dedAtual = normalizarDeducao(novas[c.cat]);
    novas[c.cat] = {
      ...dedAtual,
      cedido: dedAtual.cedido + valorParaEsta,
    };
  });

  return novas;
}

export function detectarUltimoMes(realData) {
  let ultimo = -1;
  realData.forEach(d => {
    d.vals.forEach((v, i) => {
      if (v != null && v > 0 && i > ultimo) ultimo = i;
    });
  });
  return ultimo;
}

export { MESES };