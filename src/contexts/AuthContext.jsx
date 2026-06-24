import { createContext, useContext, useEffect, useState } from 'react';
import { sb } from '../lib/supabase';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    _verificarExpiracao();

    const init = async () => {
      const { data: { session } } = await sb.auth.getSession();
      if (session) {
        const resultado = await _verificarAcesso(session.user.id);
        if (resultado.aprovado) {
          setUser(session.user);
          setIsAdmin(resultado.admin);
        } else {
          await sb.auth.signOut();
        }
      }
      setLoading(false);
    };

    init();

    const { data: { subscription } } = sb.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        setUser(null);
        setIsAdmin(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // ── Verifica aprovado + admin numa única query ──
  async function _verificarAcesso(userId) {
    const { data, error } = await sb
      .from('usuarios')
      .select('aprovado, admin')
      .eq('id', userId)
      .single();
    if (error || !data) return { aprovado: false, admin: false };
    return { aprovado: data.aprovado === true, admin: data.admin === true };
  }

  function _verificarExpiracao() {
    const exp = localStorage.getItem('orcamento_lembrar_exp');
    if (!exp) return;
    if (Date.now() > +exp) {
      localStorage.removeItem('orcamento_lembrar_exp');
      sb.auth.signOut();
    }
  }

  async function login(email, password, lembrar = false) {
    const { data, error } = await sb.auth.signInWithPassword({ email, password });
    if (error) return { ok: false, msg: 'E-mail ou senha incorretos.' };

    const resultado = await _verificarAcesso(data.user.id);
    if (!resultado.aprovado) {
      await sb.auth.signOut();
      return {
        ok: false,
        msg: 'Sua conta ainda não foi aprovada. Aguarde o administrador liberar o acesso.',
      };
    }

    if (lembrar) {
      localStorage.setItem('orcamento_lembrar_exp', String(Date.now() + 30 * 24 * 60 * 60 * 1000));
    } else {
      localStorage.removeItem('orcamento_lembrar_exp');
    }

    setUser(data.user);
    setIsAdmin(resultado.admin);
    return { ok: true };
  }

  async function cadastro(email, password) {
    const { error } = await sb.auth.signUp({ email, password });
    if (error) {
      if (error.message.includes('already registered')) {
        return { ok: false, msg: 'Este e-mail já possui uma conta.' };
      }
      return { ok: false, msg: 'Erro ao criar conta. Tente novamente.' };
    }
    // O trigger handle_new_user no Supabase insere automaticamente
    // na tabela usuarios com aprovado=false, admin=false
    await sb.auth.signOut();
    return { ok: true };
  }

  async function logout() {
    localStorage.removeItem('orcamento_lembrar_exp');
    await sb.auth.signOut();
    setUser(null);
    setIsAdmin(false);
  }

  return (
    <AuthContext.Provider value={{ user, isAdmin, loading, login, cadastro, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
