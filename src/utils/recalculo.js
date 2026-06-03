const MESES = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

function normalizarDeducao(ded) {
  if (!ded) return { recebido: 0, cedido: 0, pago: false, pagoValor: 0 };

  // Compatibilidade com sessões salvas antes da separação entre origem e receptora.
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

/**
 * Recalcula limites 2026.
 *
 * deducoesAplicadas: { [cat]: valorDescontado }
 *   - para a ORIGEM (estourou): o teto efetivo sobe para igualar o gasto real,
 *     marcando como "pago" — não cai para zero
 *   - para as RECEPTORAS: o limite futuro é reduzido pelo valor proporcional recebido
 */
export function recalcularLimites(baseData, realData2026, tetosAjustados = {}, deducoesAplicadas = {}) {
  const realMap = {};
  realData2026.forEach(d => { realMap[d.cat] = d.vals; });

  const mesesComDados = Array.from({ length: 12 }, (_, i) =>
    Object.values(realMap).some(vals => vals[i] != null && vals[i] > 0)
  );
  const ultimoMesReal = mesesComDados.lastIndexOf(true);

  return baseData.map(base => {
    const real = realMap[base.cat] || Array(12).fill(null);
    const gastoReal = real.reduce((s, v) => s + (v || 0), 0);

    // Teto base: ajustado manualmente ou total 2025
    const tetoBase = tetosAjustados[base.cat] != null ? tetosAjustados[base.cat] : base.total;

    // Dedução desta categoria
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

    // ── Status ──────────────────────────────────────────────────────────────
    const percentualUsado = tetoEfetivo > 0 ? (gastoReal / tetoEfetivo) * 100 : 0;
    const estourou = gastoReal > tetoEfetivo;

    // Pago = redistribuído via modal OU chegou naturalmente em 100%
    // Usa margem de 0.5% para evitar problemas de arredondamento de float
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
      mesesFuturos,
      valsBase: base.vals,
      variacoesBase: base.variacoes,
    };
  });
}

/**
 * Aplica uma redistribuição:
 *
 * ORIGEM (estourou):
 *   - Marca como "pago" → teto efetivo = gastoReal (100%, status Pago)
 *
 * ORIGEM (não estourou, ajuste manual):
 *   - Reduz o saldo futuro dela pelo valorDeduzir
 *
 * RECEPTORAS:
 *   - Recebem um desconto proporcional ao seu tetoEfetivo no saldo futuro
 */
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