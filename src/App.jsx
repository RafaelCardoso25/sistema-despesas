import { useState, useEffect } from 'react';
import UploadPage from './components/UploadPage';
import Dashboard from './components/Dashboard';
import { saveAutoSession, loadAutoSession } from './utils/autoSave';

export default function App() {
  const [session, setSession] = useState(null);

  useEffect(() => {
    if (session) {
      saveAutoSession(session);
    }
  }, [session]);

  const handleData = (baseData, fileName) => {
    setSession({
      baseData,
      fileName,
      tetosAjustados: {},
      deducoesAplicadas: {},
      logAjustes: [],
      mesAtual: new Date().getMonth(),
      comparacaoState: null,
      metaAnual: null,
    });
  };

  const handleLoadSession = (savedSession) => {
    setSession({
      baseData: savedSession.baseData,
      fileName: savedSession.fileName,
      tetosAjustados: savedSession.tetosAjustados || {},
      deducoesAplicadas: savedSession.deducoesAplicadas || {},
      logAjustes: savedSession.logAjustes || [],
      mesAtual: savedSession.mesAtual ?? new Date().getMonth(),
      comparacaoState: savedSession.comparacaoState || null,
      metaAnual: savedSession.metaAnual ?? null,
    });
  };

  const handleReset = () => setSession(null);

  const updateSession = (patch) =>
    setSession(prev => ({ ...prev, ...patch }));

  return session ? (
    <Dashboard
      session={session}
      updateSession={updateSession}
      onReset={handleReset}
    />
  ) : (
    <UploadPage
      onData={handleData}
      onLoadSession={handleLoadSession}
      autoSavedSession={loadAutoSession()}
    />
  );
}