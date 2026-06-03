const KEY = 'orcamento_autosave';

export function saveAutoSession(session) {
  try {
    localStorage.setItem(KEY, JSON.stringify(session));
  } catch (e) {
    console.warn('AutoSave falhou:', e);
  }
}

export function loadAutoSession() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

export function clearAutoSession() {
  try {
    localStorage.removeItem(KEY);
  } catch (e) {
    console.warn('Erro ao limpar autosave:', e);
  }
}