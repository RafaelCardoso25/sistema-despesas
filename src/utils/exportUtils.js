import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import { applyPlugin } from 'jspdf-autotable';

applyPlugin(jsPDF);

const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

function brl(v) {
  if (v == null || isNaN(v)) return '-';
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function n(v) {
  if (v == null || isNaN(v)) return 0;
  return v;
}

function getTeto(d, tetosAjustados) {
  return tetosAjustados[d.cat] != null ? tetosAjustados[d.cat] : d.total;
}

// ─── Excel ────────────────────────────────────────────────────────────────────

export function exportExcel(data, tetosAjustados = {}, metaAnual = null) {
  const wb = XLSX.utils.book_new();
  const sorted = [...data].sort((a, b) => getTeto(b, tetosAjustados) - getTeto(a, tetosAjustados));

  const totalAjustado = data.reduce((s, d) => s + getTeto(d, tetosAjustados), 0);

  // ── Aba 1: Limites 2026 ───────────────────────────────────────────────────
  const limHead = [
    ['Categoria', 'Total 2025', 'Teto 2026', 'Média mensal 2025', 'Limite médio/mês 2026', 'Mês de pico', 'Variação no pico (%)'],
  ];

  const limBody = sorted.map(d => {
    const teto = getTeto(d, tetosAjustados);
    const ativos = (d.limite2026 || []).filter(v => v != null);
    const mediaLim = ativos.length ? teto / ativos.length : 0;
    return [
      d.cat,
      n(d.total),
      teto,
      n(d.media),
      mediaLim,
      MESES[d.pico_idx] || '',
      d.var_pico != null ? parseFloat(d.var_pico.toFixed(1)) : '',
    ];
  });

  const wsLim = XLSX.utils.aoa_to_sheet([...limHead, ...limBody]);
  wsLim['!cols'] = [
    { wch: 40 }, { wch: 18 }, { wch: 18 },
    { wch: 20 }, { wch: 22 }, { wch: 14 }, { wch: 20 },
  ];
  XLSX.utils.book_append_sheet(wb, wsLim, 'Limites 2026');

  // ── Aba 2: Detalhe Mensal ─────────────────────────────────────────────────
  const varHead = [
    ['Categoria', ...MESES.map(m => `Gasto ${m}`), ...MESES.map(m => `Limite ${m}/2026`)],
  ];

  const varBody = data.map(d => {
    const teto = getTeto(d, tetosAjustados);
    return [
      d.cat,
      ...(d.vals || Array(12).fill(null)).map(v => v != null ? v : ''),
      ...(d.limite2026 || Array(12).fill(null)).map(v =>
        v != null && n(d.total) > 0
          ? parseFloat(((teto / d.total) * v).toFixed(2))
          : ''
      ),
    ];
  });

  const wsVar = XLSX.utils.aoa_to_sheet([...varHead, ...varBody]);
  wsVar['!cols'] = [{ wch: 40 }, ...Array(24).fill({ wch: 14 })];
  XLSX.utils.book_append_sheet(wb, wsVar, 'Detalhe Mensal');

  XLSX.writeFile(wb, 'orcamento_2026.xlsx');
}

// ─── PDF ──────────────────────────────────────────────────────────────────────

export function exportPDF(data, tetosAjustados = {}, metaAnual = null) {
  const doc = new jsPDF({ orientation: 'landscape', format: 'a4' });
  const sorted = [...data].sort((a, b) => getTeto(b, tetosAjustados) - getTeto(a, tetosAjustados));

  const totalBase = data.reduce((s, d) => s + n(d.total), 0);
  const totalAjustado = data.reduce((s, d) => s + getTeto(d, tetosAjustados), 0);
  const temMeta = metaAnual != null;

  const totalMensal = MESES.map((_, i) =>
    data.reduce((s, d) => s + n(d.vals[i]), 0)
  );
  const totalLimite = MESES.map((_, i) =>
    data.reduce((s, d) => {
      const teto = getTeto(d, tetosAjustados);
      const v = d.limite2026[i];
      return s + (v != null && n(d.total) > 0 ? (teto / d.total) * v : 0);
    }, 0)
  );

  // ── Página 1: Capa + tabela por categoria ─────────────────────────────────
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.setTextColor(29, 158, 106);
  doc.text('Orcamento 2026', 14, 18);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(80, 75, 65);
  doc.text('Analise de despesas baseada no historico de 2025', 14, 25);
  doc.text(`Gerado em: ${new Date().toLocaleDateString('pt-BR')}`, 14, 30);

  if (temMeta) {
    doc.setFillColor(220, 245, 235);
    doc.roundedRect(160, 22, 110, 10, 2, 2, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(20, 120, 80);
    doc.text(`META ANUAL ATIVA: ${brl(metaAnual)}`, 164, 28.5);
  }

  const economia = totalBase - totalAjustado;

  if (temMeta) {
    const boxes = [
      { label: 'META ANUAL 2026', value: brl(metaAnual), x: 14 },
      { label: 'TETO AJUSTADO', value: brl(totalAjustado), x: 78 },
      { label: 'HISTORICO 2025', value: brl(totalBase), x: 142 },
      {
        label: 'ECONOMIA PROJETADA',
        value: `${brl(economia)} (${totalBase > 0
          ? ((economia / totalBase) * 100).toFixed(1)
          : 0}%)`,
        x: 206, small: true,
      },
    ];
    boxes.forEach(b => {
      doc.setFillColor(245, 244, 240);
      doc.roundedRect(b.x, 34, 60, 18, 2, 2, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6.5);
      doc.setTextColor(120, 115, 105);
      doc.text(b.label, b.x + 3, 40);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(b.small ? 7.5 : 10);
      if (b.label === 'META ANUAL 2026') doc.setTextColor(29, 158, 106);
      else if (b.label === 'ECONOMIA PROJETADA' && economia < 0) doc.setTextColor(225, 29, 72);
      else doc.setTextColor(40, 38, 35);
      doc.text(b.value, b.x + 3, 48);
    });
  } else {
    const boxes = [
      { label: 'TETO ANUAL 2026', value: brl(totalAjustado), x: 14 },
      { label: 'CATEGORIAS', value: String(data.length), x: 100 },
      { label: 'MEDIA MENSAL', value: brl(totalAjustado / 12), x: 186 },
    ];
    boxes.forEach(b => {
      doc.setFillColor(245, 244, 240);
      doc.roundedRect(b.x, 34, 80, 18, 2, 2, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(120, 115, 105);
      doc.text(b.label, b.x + 4, 40);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(29, 158, 106);
      doc.text(b.value, b.x + 4, 48);
    });
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(40, 38, 35);
  doc.text('Limites por Categoria', 14, 60);

  const rows1 = sorted.map(d => {
    const teto = getTeto(d, tetosAjustados);
    const ajust = tetosAjustados[d.cat] != null;
    const ativos = (d.limite2026 || []).filter(v => v != null);
    const mediaLim = ativos.length ? teto / ativos.length : 0;
    const pctTotal = totalAjustado > 0
      ? (teto / totalAjustado * 100).toFixed(1) + '%'
      : '-';
    return [
      d.cat + (ajust ? ' *' : ''),
      brl(d.total),
      brl(teto),
      pctTotal,
      brl(d.media),
      brl(mediaLim),
      MESES[d.pico_idx] || '-',
      d.var_pico != null ? `+${d.var_pico.toFixed(0)}%` : 'n/a',
    ];
  });

  rows1.push([
    'TOTAL GERAL',
    brl(totalBase),
    brl(totalAjustado),
    '100%',
    brl(totalBase / 12),
    brl(totalAjustado / 12),
    '—',
    '—',
  ]);

  doc.autoTable({
    startY: 64,
    head: [['Categoria', 'Total 2025', 'Teto 2026', '% orcam.', 'Media/mes 2025', 'Limite/mes 2026', 'Mes pico', 'Var. pico']],
    body: rows1,
    styles: { fontSize: 7, cellPadding: 2.5, textColor: [40, 38, 35] },
    headStyles: { fillColor: [29, 158, 106], textColor: [255, 255, 255], fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [245, 244, 240] },
    columnStyles: { 0: { cellWidth: 65 } },
    didParseCell: (hook) => {
      if (hook.row.index === rows1.length - 1) {
        hook.cell.styles.fontStyle = 'bold';
        hook.cell.styles.fillColor = [220, 245, 235];
        hook.cell.styles.textColor = [20, 120, 80];
        return;
      }
      if (hook.column.index === 0 &&
        typeof hook.cell.raw === 'string' &&
        hook.cell.raw.endsWith(' *')) {
        hook.cell.styles.textColor = [180, 100, 0];
        hook.cell.styles.fontStyle = 'bold';
      }
    },
    didDrawPage: () => {
      if (Object.keys(tetosAjustados).length > 0) {
        doc.setFont('helvetica', 'italic');
        doc.setFontSize(6.5);
        doc.setTextColor(150, 140, 120);
        doc.text(
          '* Categoria com teto ajustado manualmente',
          14,
          doc.internal.pageSize.height - 8
        );
      }
    },
  });

  // ── Página 2: Distribuição mensal consolidada ─────────────────────────────
  doc.addPage();
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(40, 38, 35);
  doc.text('Distribuicao Mensal Consolidada', 14, 16);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(100, 95, 85);
  doc.text(
    temMeta
      ? `Limites baseados na meta de ${brl(metaAnual)} — distribuidos proporcionalmente ao historico 2025`
      : 'Soma de todas as categorias por mes — historico 2025 e limite proporcional 2026',
    14, 22
  );

  const mensalRows = MESES.map((m, i) => {
    const var_ = totalLimite[i] - totalMensal[i];
    return [
      m,
      brl(totalMensal[i]),
      brl(totalLimite[i]),
      brl(var_),
      totalAjustado > 0
        ? (totalLimite[i] / totalAjustado * 100).toFixed(1) + '%'
        : '-',
    ];
  });

  const somaGasto = totalMensal.reduce((s, v) => s + v, 0);
  const somaLimite = totalLimite.reduce((s, v) => s + v, 0);
  mensalRows.push([
    'TOTAL', brl(somaGasto), brl(somaLimite), brl(somaLimite - somaGasto), '100%',
  ]);

  doc.autoTable({
    startY: 26,
    head: [['Mes', 'Gasto 2025', 'Limite 2026', 'Variacao', '% do ano']],
    body: mensalRows,
    styles: { fontSize: 8, cellPadding: 3, textColor: [40, 38, 35] },
    headStyles: { fillColor: [29, 158, 106], textColor: [255, 255, 255], fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [245, 244, 240] },
    columnStyles: { 0: { cellWidth: 25 } },
    didParseCell: (hook) => {
      if (hook.row.index === mensalRows.length - 1) {
        hook.cell.styles.fontStyle = 'bold';
        hook.cell.styles.fillColor = [220, 245, 235];
        hook.cell.styles.textColor = [20, 120, 80];
        return;
      }
      if (hook.column.index === 3 && typeof hook.cell.raw === 'string') {
        if (hook.cell.raw.startsWith('-')) hook.cell.styles.textColor = [225, 29, 72];
        else hook.cell.styles.textColor = [29, 158, 106];
      }
    },
  });

  // ── Página 3: Detalhe mensal por categoria ────────────────────────────────
  doc.addPage();
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(40, 38, 35);
  doc.text('Detalhe Mensal por Categoria', 14, 16);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(100, 95, 85);
  doc.text(
    'Gasto historico 2025 (linha clara) e limite ajustado 2026 (linha verde) — valores em R$',
    14, 22
  );

  const detHead = [['Categoria', ...MESES]];
  const detBody = [];

  sorted.forEach(d => {
    const teto = getTeto(d, tetosAjustados);
    detBody.push([
      d.cat + ' (2025)',
      ...(d.vals || Array(12).fill(null)).map(v =>
        v != null ? v.toLocaleString('pt-BR', { maximumFractionDigits: 0 }) : '—'
      ),
    ]);
    detBody.push([
      d.cat + ' (lim.2026)',
      ...(d.limite2026 || Array(12).fill(null)).map(v =>
        v != null && n(d.total) > 0
          ? ((teto / d.total) * v).toLocaleString('pt-BR', { maximumFractionDigits: 0 })
          : '—'
      ),
    ]);
  });

  detBody.push([
    'TOTAL 2025',
    ...totalMensal.map(v => v.toLocaleString('pt-BR', { maximumFractionDigits: 0 })),
  ]);
  detBody.push([
    'TOTAL LIMITE 2026',
    ...totalLimite.map(v => v.toLocaleString('pt-BR', { maximumFractionDigits: 0 })),
  ]);

  doc.autoTable({
    startY: 26,
    head: detHead,
    body: detBody,
    styles: { fontSize: 5.5, cellPadding: 1.8, textColor: [40, 38, 35] },
    headStyles: { fillColor: [29, 158, 106], textColor: [255, 255, 255], fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [250, 249, 247] },
    columnStyles: { 0: { cellWidth: 48, fontStyle: 'bold' } },
    didParseCell: (hook) => {
      const raw = hook.cell.raw || '';
      if (typeof raw === 'string' && hook.column.index === 0 && raw.includes('lim.2026')) {
        hook.cell.styles.textColor = [29, 158, 106];
        hook.cell.styles.fontStyle = 'italic';
      }
      if (hook.row.index >= detBody.length - 2) {
        hook.cell.styles.fontStyle = 'bold';
        hook.cell.styles.fillColor = [220, 245, 235];
        hook.cell.styles.textColor = [20, 120, 80];
      }
    },
  });

  doc.save('orcamento_2026.pdf');
}

// ─── Alertas ──────────────────────────────────────────────────────────────────

export function buildAlertas(data) {
  const alertas = [];
  data.forEach(d => {
    for (let i = 1; i < 12; i++) {
      const b = d.vals[i];
      const prev = d.vals.slice(0, i).filter(x => x > 0).slice(-1)[0];
      if (!b || !prev) continue;
      const pct = ((b - prev) / prev) * 100;
      if (pct >= 50) {
        const prevIdx = d.vals.lastIndexOf(prev, i - 1);
        alertas.push({
          cat: d.cat,
          mes: MESES[i],
          mesPrev: MESES[prevIdx >= 0 ? prevIdx : i - 1],
          vPrev: prev,
          vCur: b,
          pct,
          lim: d.limite2026[i],
        });
      }
    }
  });
  return alertas.sort((a, b) => b.pct - a.pct);
}

// ─── Exportação da Comparação ─────────────────────────────────────────────────

export function exportComparacaoExcel(resultado) {
  const wb = XLSX.utils.book_new();

  const totalTeto = resultado.reduce((s, r) => s + n(r.teto), 0);
  const totalGasto = resultado.reduce((s, r) => s + n(r.gastoReal), 0);
  const totalSaldo = resultado.reduce((s, r) => s + n(r.saldoRestante), 0);

  // Sheet 1: Resumo por categoria
  const head1 = [[
    'Categoria', 'Teto anual', 'Gasto real 2026',
    'Saldo restante', '% usado', 'Status',
  ]];
  const body1 = resultado
    .sort((a, b) => n(b.percentualUsado) - n(a.percentualUsado))
    .map(r => [
      r.cat,
      n(r.teto),
      n(r.gastoReal),
      n(r.saldoRestante),
      parseFloat(n(r.percentualUsado).toFixed(1)),
      r.estourou ? 'ESTOUROU'
        : r.pago ? 'PAGO'
          : n(r.percentualUsado) >= 90 ? 'CRITICO'
            : n(r.percentualUsado) >= 70 ? 'ATENCAO'
              : 'OK',
    ]);

  body1.push([
    'TOTAL GERAL', totalTeto, totalGasto, totalSaldo,
    totalTeto > 0 ? parseFloat((totalGasto / totalTeto * 100).toFixed(1)) : 0,
    '',
  ]);

  const ws1 = XLSX.utils.aoa_to_sheet([...head1, ...body1]);
  ws1['!cols'] = [
    { wch: 40 }, { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 10 }, { wch: 12 },
  ];
  XLSX.utils.book_append_sheet(wb, ws1, 'Resumo Comparacao');

  // Sheet 2: Novos limites mensais recalculados
  const head2 = [[
    'Categoria',
    ...MESES.map(m => `Lim.Orig ${m}`),
    ...MESES.map(m => `Gasto ${m}`),
    ...MESES.map(m => `Novo Lim ${m}`),
  ]];
  const body2 = resultado.map(r => [
    r.cat,
    ...(r.limiteOriginal || Array(12).fill(null)).map(v => v ?? ''),
    ...(r.real || Array(12).fill(null)).map(v => v ?? ''),
    ...(r.limitesRecalculados || Array(12).fill(null)).map(v =>
      v != null ? parseFloat(n(v).toFixed(2)) : ''
    ),
  ]);
  const ws2 = XLSX.utils.aoa_to_sheet([...head2, ...body2]);
  ws2['!cols'] = [{ wch: 40 }, ...Array(36).fill({ wch: 13 })];
  XLSX.utils.book_append_sheet(wb, ws2, 'Novos Limites Mensais');

  // Sheet 3: Diferenças mês a mês
  const head3 = [['Categoria', ...MESES.map(m => `Dif ${m}`)]];
  const body3 = resultado.map(r => [
    r.cat,
    ...(r.diferencas || Array(12).fill(null)).map(v =>
      v != null ? parseFloat(n(v).toFixed(2)) : ''
    ),
  ]);
  const ws3 = XLSX.utils.aoa_to_sheet([...head3, ...body3]);
  ws3['!cols'] = [{ wch: 40 }, ...Array(12).fill({ wch: 14 })];
  XLSX.utils.book_append_sheet(wb, ws3, 'Diferencas');

  XLSX.writeFile(wb, 'comparacao_2026.xlsx');
}

export function exportComparacaoPDF(resultado) {
  const doc = new jsPDF({ orientation: 'landscape', format: 'a4' });

  const totalTeto = resultado.reduce((s, r) => s + n(r.teto), 0);
  const totalGasto = resultado.reduce((s, r) => s + n(r.gastoReal), 0);
  const totalSaldo = resultado.reduce((s, r) => s + n(r.saldoRestante), 0);
  const qtdEstourou = resultado.filter(r => r.estourou).length;
  const qtdPago = resultado.filter(r => r.pago).length;
  const qtdCritico = resultado.filter(
    r => !r.estourou && !r.pago && n(r.percentualUsado) >= 90
  ).length;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.setTextColor(29, 158, 106);
  doc.text('Comparacao de Gastos 2026', 14, 18);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(80, 75, 65);
  doc.text('Gastos reais versus limites orcados', 14, 25);
  doc.text(`Gerado em: ${new Date().toLocaleDateString('pt-BR')}`, 14, 30);

  const boxes = [
    { label: 'TETO ANUAL', value: brl(totalTeto), x: 14 },
    { label: 'GASTO REAL', value: brl(totalGasto), x: 82 },
    { label: 'SALDO RESTANTE', value: brl(totalSaldo), x: 150 },
    {
      label: 'ALERTAS',
      value: `${qtdEstourou} estouram · ${qtdCritico} criticos · ${qtdPago} pagos`,
      x: 218, small: true,
    },
  ];

  boxes.forEach(b => {
    doc.setFillColor(245, 244, 240);
    doc.roundedRect(b.x, 34, 64, 18, 2, 2, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(120, 115, 105);
    doc.text(b.label, b.x + 3, 40);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(b.small ? 8 : 10);
    if (totalSaldo < 0 && b.label === 'SALDO RESTANTE') doc.setTextColor(225, 29, 72);
    else doc.setTextColor(40, 38, 35);
    doc.text(b.value, b.x + 3, 48);
  });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(40, 38, 35);
  doc.text('Resumo por Categoria', 14, 60);

  const rows = resultado
    .sort((a, b) => n(b.percentualUsado) - n(a.percentualUsado))
    .map(r => [
      r.cat,
      brl(r.teto),
      brl(r.gastoReal),
      brl(r.saldoRestante),
      `${n(r.percentualUsado).toFixed(1)}%`,
      r.estourou ? 'ESTOUROU'
        : r.pago ? 'PAGO'
          : n(r.percentualUsado) >= 90 ? 'CRITICO'
            : n(r.percentualUsado) >= 70 ? 'ATENCAO'
              : 'OK',
    ]);

  rows.push([
    'TOTAL GERAL',
    brl(totalTeto),
    brl(totalGasto),
    brl(totalSaldo),
    totalTeto > 0 ? `${(totalGasto / totalTeto * 100).toFixed(1)}%` : '-',
    '',
  ]);

  doc.autoTable({
    startY: 64,
    head: [['Categoria', 'Teto anual', 'Gasto real', 'Saldo restante', '% usado', 'Status']],
    body: rows,
    styles: { fontSize: 7, cellPadding: 2.5, textColor: [40, 38, 35] },
    headStyles: { fillColor: [29, 158, 106], textColor: [255, 255, 255], fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [245, 244, 240] },
    columnStyles: { 0: { cellWidth: 68 } },
    didParseCell: (hook) => {
      if (hook.row.index === rows.length - 1) {
        hook.cell.styles.fontStyle = 'bold';
        hook.cell.styles.fillColor = [220, 245, 235];
        hook.cell.styles.textColor = [20, 120, 80];
        return;
      }
      if (hook.column.index === 5) {
        const v = hook.cell.raw;
        if (v === 'ESTOUROU') hook.cell.styles.textColor = [225, 29, 72];
        else if (v === 'PAGO') hook.cell.styles.textColor = [29, 158, 106];
        else if (v === 'CRITICO') hook.cell.styles.textColor = [248, 128, 7];
        else if (v === 'ATENCAO') hook.cell.styles.textColor = [180, 100, 0];
        else hook.cell.styles.textColor = [29, 158, 106];
        hook.cell.styles.fontStyle = 'bold';
      }
      if (hook.column.index === 3 &&
        typeof hook.cell.raw === 'string' &&
        hook.cell.raw.startsWith('-')) {
        hook.cell.styles.textColor = [225, 29, 72];
      }
    },
  });

  // Página 2
  doc.addPage();
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(40, 38, 35);
  doc.text('Novos Limites Mensais Recalculados', 14, 16);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(100, 95, 85);
  doc.text(
    'Saldo restante distribuido proporcionalmente nos meses futuros.',
    14, 22
  );

  const futureMeses = resultado.find(
    r => (r.mesesFuturos || []).length > 0
  )?.mesesFuturos || [];

  if (futureMeses.length > 0) {
    const rows2 = resultado
      .filter(r => (r.mesesFuturos || []).length > 0)
      .map(r => [
        r.cat,
        brl(r.gastoReal),
        brl(r.tetoEfetivo),
        brl(r.saldoRestante),
        ...futureMeses.map(i =>
          (r.limitesRecalculados || [])[i] != null
            ? brl(r.limitesRecalculados[i])
            : '—'
        ),
      ]);

    const totalNovoLim = futureMeses.map(i =>
      resultado.reduce((s, r) => s + n((r.limitesRecalculados || [])[i]), 0)
    );
    rows2.push([
      'TOTAL', brl(totalGasto), brl(totalTeto), brl(totalSaldo),
      ...totalNovoLim.map(v => brl(v)),
    ]);

    doc.autoTable({
      startY: 27,
      head: [['Categoria', 'Gasto real', 'Teto efetivo', 'Saldo',
        ...futureMeses.map(i => MESES[i])]],
      body: rows2,
      styles: { fontSize: 6.5, cellPadding: 2.2, textColor: [40, 38, 35] },
      headStyles: { fillColor: [248, 128, 7], textColor: [255, 255, 255], fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [245, 244, 240] },
      columnStyles: { 0: { cellWidth: 60 } },
      didParseCell: (hook) => {
        if (hook.row.index === rows2.length - 1) {
          hook.cell.styles.fontStyle = 'bold';
          hook.cell.styles.fillColor = [220, 245, 235];
          hook.cell.styles.textColor = [20, 120, 80];
        }
        if (hook.column.index === 3 &&
          typeof hook.cell.raw === 'string' &&
          hook.cell.raw.startsWith('-')) {
          hook.cell.styles.textColor = [225, 29, 72];
        }
      },
    });
  }

  // Página 3
  doc.addPage();
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(40, 38, 35);
  doc.text('Gasto Real vs Limite Original por Mes', 14, 16);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(100, 95, 85);
  doc.text(
    'Comparacao mes a mes entre o que foi gasto e o que estava orcado.',
    14, 22
  );

  const mesesComDados = resultado.find(
    r => n(r.ultimoMesReal) >= 0
  )?.ultimoMesReal ?? -1;
  const mesesReais = mesesComDados >= 0
    ? Array.from({ length: mesesComDados + 1 }, (_, i) => i)
    : [];

  if (mesesReais.length > 0) {
    const rows3 = resultado.map(r => [
      r.cat,
      ...mesesReais.flatMap(i => [
        (r.real || [])[i] != null ? brl(r.real[i]) : '—',
        (r.limiteOriginal || [])[i] != null ? brl(r.limiteOriginal[i]) : '—',
      ]),
    ]);

    rows3.push([
      'TOTAL',
      ...mesesReais.flatMap(i => [
        brl(resultado.reduce((s, r) => s + n((r.real || [])[i]), 0)),
        brl(resultado.reduce((s, r) => s + n((r.limiteOriginal || [])[i]), 0)),
      ]),
    ]);

    doc.autoTable({
      startY: 27,
      head: [['Categoria',
        ...mesesReais.flatMap(i => [`Real ${MESES[i]}`, `Lim ${MESES[i]}`])]],
      body: rows3,
      styles: { fontSize: 6, cellPadding: 2, textColor: [40, 38, 35] },
      headStyles: { fillColor: [29, 158, 106], textColor: [255, 255, 255], fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [245, 244, 240] },
      columnStyles: { 0: { cellWidth: 55 } },
      didParseCell: (hook) => {
        if (hook.row.index === rows3.length - 1) {
          hook.cell.styles.fontStyle = 'bold';
          hook.cell.styles.fillColor = [220, 245, 235];
          hook.cell.styles.textColor = [20, 120, 80];
        }
      },
    });
  }

  doc.save('comparacao_2026.pdf');
}