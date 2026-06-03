import * as XLSX from 'xlsx';

// Mapa completo de nomes de meses que serão reconhecidos
// Cobre: abreviações PT/EN, nomes completos PT/EN, formato "Jan-2025", "jan/2025", etc.
const MONTH_NAMES = {
  // Português abreviado
  'jan': 1, 'fev': 2, 'mar': 3, 'abr': 4, 'mai': 5, 'jun': 6,
  'jul': 7, 'ago': 8, 'set': 9, 'out': 10, 'nov': 11, 'dez': 12,
  // Inglês abreviado
  'feb': 2, 'apr': 4, 'may': 5, 'aug': 8, 'sep': 9, 'oct': 10, 'dec': 12,
  // Português completo
  'janeiro': 1, 'fevereiro': 2, 'março': 3, 'marco': 3, 'abril': 4,
  'maio': 5, 'junho': 6, 'julho': 7, 'agosto': 8, 'setembro': 9,
  'outubro': 10, 'novembro': 11, 'dezembro': 12,
  // Inglês completo
  'january': 1, 'february': 2, 'march': 3, 'april': 4,
  'june': 6, 'july': 7, 'august': 8, 'september': 9,
  'october': 10, 'november': 11, 'december': 12,
};

/**
 * Tenta extrair o número do mês (1-12) de uma célula.
 * Reconhece:
 *   - Número inteiro 1-12
 *   - "Jan", "Janeiro", "january", "JAN" (qualquer case)
 *   - "Jan-2025", "Jan/2025", "Jan 2025"
 *   - Data serial do Excel (ex: 45292 → janeiro/2024)
 *   - Objeto Date
 *   - "01/01/2025", "2025-01-01"
 */
function extractMonth(cell) {
  if (cell == null) return null;

  // Número inteiro simples 1-12
  if (typeof cell === 'number') {
    if (Number.isInteger(cell) && cell >= 1 && cell <= 12) return cell;

    // Data serial do Excel (números grandes)
    if (cell > 40000 && cell < 60000) {
      try {
        const date = XLSX.SSF.parse_date_code(cell);
        if (date && date.m >= 1 && date.m <= 12) return date.m;
      } catch (_) {}
    }
    return null;
  }

  // Objeto Date
  if (cell instanceof Date) {
    const m = cell.getMonth() + 1;
    return m >= 1 && m <= 12 ? m : null;
  }

  // String — normaliza e tenta extrair
  if (typeof cell === 'string') {
    const s = cell.trim();

    // Formato "01/01/2025" ou "01/01/25"
    const dmyMatch = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
    if (dmyMatch) {
      const m = parseInt(dmyMatch[2], 10); // DD/MM/YYYY
      if (m >= 1 && m <= 12) return m;
      const m2 = parseInt(dmyMatch[1], 10); // MM/DD/YYYY fallback
      if (m2 >= 1 && m2 <= 12) return m2;
    }

    // Formato "2025-01-01"
    const isoMatch = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (isoMatch) {
      const m = parseInt(isoMatch[2], 10);
      if (m >= 1 && m <= 12) return m;
    }

    // Pega apenas a parte textual antes de separadores: "Jan-2025" → "Jan"
    // Reconhece separadores: - / espaço .
    const textPart = s.split(/[-\/\s\.]/)[0].toLowerCase().trim();

    // Verifica no mapa de nomes
    if (MONTH_NAMES[textPart]) return MONTH_NAMES[textPart];

    // Tenta os primeiros 3 caracteres caso seja nome longo com separador
    const first3 = textPart.slice(0, 3);
    if (MONTH_NAMES[first3]) return MONTH_NAMES[first3];

    // Número como string "1" a "12"
    const num = parseInt(s, 10);
    if (!isNaN(num) && num >= 1 && num <= 12 && String(num) === s.trim()) return num;
  }

  return null;
}

export function parseExcel(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(e.target.result, { type: 'array', cellDates: true });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const raw = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, raw: false });
        const rawNums = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, raw: true });

        // ── 1. Encontrar a linha de cabeçalho ──────────────────────────────
        let headerRowIdx = 0;
        let monthColMap = {}; // monthNumber (1-12) -> colIndex

        for (let i = 0; i < Math.min(10, raw.length); i++) {
          const row = raw[i];
          if (!row) continue;
          const tmp = {};
          for (let c = 0; c < row.length; c++) {
            const m = extractMonth(row[c]);
            if (m && !tmp[m]) tmp[m] = c; // primeiro encontrado para cada mês
          }
          // Aceita se encontrou pelo menos 3 meses distintos
          if (Object.keys(tmp).length >= 3) {
            headerRowIdx = i;
            monthColMap = tmp;
            break;
          }
        }

        // ── 2. Identificar colunas de total a ignorar ──────────────────────
        const headerRow = raw[headerRowIdx] || [];
        const totalCols = new Set();
        headerRow.forEach((cell, c) => {
          const s = String(cell || '').toLowerCase();
          if (s.includes('total') || s.includes('grand') || s.includes('soma')) {
            totalCols.add(c);
          }
        });

        // ── 3. Determinar offset das colunas de dados ──────────────────────
        const monthKeys = Object.keys(monthColMap).map(Number);
        const dataColStart = monthColMap[Math.min(...monthKeys)];

        // ── 4. Ler categorias ──────────────────────────────────────────────
        const categories = [];
        for (let r = headerRowIdx + 1; r < rawNums.length; r++) {
          const row     = rawNums[r]; // valores numéricos brutos
          const rowText = raw[r];     // valores como string (para nomes)
          if (!row || row.every(v => v == null)) continue;

          // Encontrar o nome da categoria
          let cat = null;
          for (let c = 0; c < Math.min(dataColStart, row.length); c++) {
            const v = rowText ? rowText[c] : row[c];
            if (typeof v === 'string' && v.trim()) {
              const low = v.toLowerCase();
              if (low.includes('total') || low.includes('grand') || low.includes('soma')) continue;
              // Col 0 = grupo, Col 1 = categoria (quando há 2 colunas de texto)
              if (c === 0 && dataColStart >= 2) {
                const next = rowText ? rowText[1] : row[1];
                if (next && typeof next === 'string' && next.trim() &&
                    !next.toLowerCase().includes('total')) {
                  cat = next.trim();
                } else {
                  cat = v.trim();
                }
              } else {
                cat = v.trim();
              }
              break;
            }
          }
          if (!cat) continue;
          if (cat.toLowerCase().includes('total') || cat.toLowerCase().includes('grand')) continue;

          // Montar array de 12 posições usando o mapa de colunas
          const vals = Array(12).fill(null);
          let numCount = 0;

          if (Object.keys(monthColMap).length > 0) {
            for (const [monthNum, colIdx] of Object.entries(monthColMap)) {
              if (totalCols.has(colIdx)) continue;
              const v = row[colIdx];
              const num = typeof v === 'number' ? v : parseFloat(String(v || '').replace(',', '.'));
              if (!isNaN(num) && num > 0) {
                vals[Number(monthNum) - 1] = num;
                numCount++;
              }
            }
          } else {
            // Fallback sequencial
            let mIdx = 0;
            for (let c = dataColStart; c < row.length && mIdx < 12; c++) {
              if (totalCols.has(c)) continue;
              const v = row[c];
              const num = typeof v === 'number' ? v : parseFloat(String(v || '').replace(',', '.'));
              if (!isNaN(num)) {
                vals[mIdx] = num > 0 ? num : null;
                if (num > 0) numCount++;
              }
              mIdx++;
            }
          }

          if (numCount === 0) continue;
          const total = vals.reduce((s, v) => s + (v || 0), 0);
          if (total === 0) continue;

          categories.push({ cat, vals, total });
        }

        if (categories.length === 0) {
          reject(new Error(
            'Não foi possível identificar categorias na planilha. ' +
            'Verifique se o cabeçalho tem os meses e se há valores numéricos.'
          ));
          return;
        }

        resolve(enrichData(categories));
      } catch (err) {
        reject(new Error('Erro ao ler planilha: ' + err.message));
      }
    };
    reader.onerror = () => reject(new Error('Erro ao carregar o arquivo.'));
    reader.readAsArrayBuffer(file);
  });
}

function enrichData(categories) {
  return categories.map(d => {
    const { vals, total } = d;
    const activeMeses = vals.filter(v => v > 0).length || 1;
    const media = total / activeMeses;

    // Limite 2026 proporcional ao padrão histórico
    const limite2026 = vals.map(v => v ? (v / total) * total : null);

    // Mês de pico
    const maxVal = Math.max(...vals.map(v => v || 0));
    const pico_idx = vals.findIndex(v => v === maxVal);

    // Variação no pico vs mês anterior com valor
    let var_pico = null;
    if (pico_idx > 0) {
      const prev = vals.slice(0, pico_idx).filter(v => v > 0).slice(-1)[0];
      if (prev) var_pico = ((maxVal - prev) / prev) * 100;
    }

    // Variações mês a mês
    const variacoes = vals.map((v, i) => {
      if (i === 0 || !v) return null;
      const prev = vals.slice(0, i).filter(x => x > 0).slice(-1)[0];
      if (!prev) return null;
      return ((v - prev) / prev) * 100;
    });

    return { ...d, media, limite2026, pico_idx, var_pico, variacoes };
  });
}
