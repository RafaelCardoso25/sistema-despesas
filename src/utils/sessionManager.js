/**
 * Gerenciador de sessão — salva e restaura o estado completo do sistema
 * como um arquivo .json que o usuário pode guardar e recarregar.
 */

const SESSION_VERSION = '1.1'; // bump de versão para refletir o novo campo

export function buildSession({
  baseData,
  tetosAjustados,
  deducoesAplicadas,
  comparacaoState,
  logAjustes,
  mesAtual,
  fileName,
  metaAnual,        // ← novo campo
}) {
  return {
    version: SESSION_VERSION,
    savedAt: new Date().toISOString(),
    fileName,
    mesAtual,
    baseData,
    tetosAjustados,    // { [cat]: novoTeto }
    deducoesAplicadas,
    comparacaoState,   // { realData, realFileName, resultado }
    logAjustes,
    metaAnual: metaAnual ?? null,  // ← novo campo
  };
}

export function saveSession(sessionObj) {
  const json = JSON.stringify(sessionObj, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  const date = new Date().toISOString().slice(0, 10);
  a.href     = url;
  a.download = `sessao_orcamento_${date}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export function loadSession(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const obj = JSON.parse(e.target.result);
        if (!obj.version || !obj.baseData) {
          reject(new Error('Arquivo de sessão inválido ou corrompido.'));
          return;
        }
        // Compatibilidade com sessões salvas na versão 1.0 (sem metaAnual)
        if (obj.metaAnual === undefined) {
          obj.metaAnual = null;
        }
        resolve(obj);
      } catch {
        reject(new Error('Não foi possível ler o arquivo de sessão.'));
      }
    };
    reader.onerror = () => reject(new Error('Erro ao carregar sessão.'));
    reader.readAsText(file);
  });
}

export function formatLogEntry({ tipo, catOrigem, valor, catsDestino, nota }) {
  return {
    id: Date.now() + Math.random(),
    timestamp: new Date().toISOString(),
    tipo,        // 'deducao' | 'ajuste_teto' | 'comparacao_carregada' | 'meta_definida' | 'meta_ajustada' | 'meta_removida'
    catOrigem,
    valor,
    catsDestino, // [{ cat, valorDeduzido }]
    nota,
  };
}