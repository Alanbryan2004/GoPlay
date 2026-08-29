import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { User, Mail, ShieldAlert, CheckCircle2, Save } from 'lucide-react';

export default function Profile() {
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [foto, setFoto] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    async function loadProfile() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setEmail(user.email || '');
        const { data, error } = await supabase
          .from('usuarios')
          .select('nome, foto')
          .eq('email', user.email)
          .single();

        if (data && !error) {
          setNome(data.nome);
          setFoto(data.foto || '');
        } else {
          setNome(user.user_metadata?.nome || '');
          setFoto(user.user_metadata?.avatar_url || '');
        }
      }
      setLoading(false);
    }
    loadProfile();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome) return;
    setSaving(true);
    setErro(null);
    setSuccess(false);

    try {
      const { error } = await supabase
        .from('usuarios')
        .upsert(
          {
            email,
            nome: nome.trim(),
            foto: foto.trim(),
          },
          { onConflict: 'email' }
        );

      if (error) {
        setErro(error.message);
      } else {
        // Also update auth user metadata
        await supabase.auth.updateUser({
          data: {
            nome: nome.trim(),
            avatar_url: foto.trim(),
          }
        });
        setSuccess(true);
      }
    } catch (e: any) {
      setErro(e.message || 'Erro ao salvar perfil.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[calc(100vh-8rem)]">
        <div className="w-8 h-8 border-4 border-red-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6 w-full max-w-md mx-auto">
      <h1 className="text-3xl font-extrabold text-slate-900 mb-6">Meu Perfil</h1>

      <div className="glass p-6 rounded-2xl shadow-xl space-y-6">
        <div className="flex flex-col items-center gap-3">
          {foto ? (
            <img
              src={foto}
              alt={nome}
              className="w-24 h-24 rounded-full object-cover ring-4 ring-red-500/50 shadow-lg shadow-red-650/10"
            />
          ) : (
            <div className="w-24 h-24 rounded-full bg-red-600 flex items-center justify-center text-white ring-4 ring-red-500/50 text-4xl font-bold shadow-lg">
              {nome ? nome.charAt(0).toUpperCase() : <User size={40} />}
            </div>
          )}
          <h2 className="text-lg font-bold text-slate-800">{nome || 'Jogador'}</h2>
        </div>

        {erro && (
          <div className="flex items-center gap-2 p-3 bg-red-950/40 border border-red-500/30 text-red-700 rounded-xl text-sm">
            <ShieldAlert size={18} className="shrink-0 text-red-400" />
            <span>{erro}</span>
          </div>
        )}

        {success && (
          <div className="flex items-center gap-2 p-3 bg-emerald-950/40 border border-emerald-500/30 text-emerald-300 rounded-xl text-sm animate-pulse">
            <CheckCircle2 size={18} className="shrink-0 text-emerald-400" />
            <span>Perfil atualizado com sucesso!</span>
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">
              E-mail (Não editável)
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-650">
                <Mail size={18} />
              </span>
              <input
                type="email"
                disabled
                value={email}
                className="w-full bg-slate-100/30 border border-slate-150 rounded-xl py-3 pl-11 pr-4 text-slate-500 cursor-not-allowed text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">
              Nome
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-550">
                <User size={18} />
              </span>
              <input
                type="text"
                required
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Seu nome"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 pl-11 pr-4 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-red-500/50 focus:border-red-500 transition-all text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">
              URL da Foto de Perfil
            </label>
            <input
              type="url"
              value={foto}
              onChange={(e) => setFoto(e.target.value)}
              placeholder="https://linkdafoto.com/perfil.jpg"
              className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-red-500/50 focus:border-red-500 transition-all text-sm"
            />
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full py-3 bg-gradient-to-r from-[#eb3237] to-red-650 hover:from-red-500 hover:to-red-600 disabled:opacity-50 text-white font-bold rounded-xl shadow-lg shadow-red-600/20 active:scale-[0.98] transition-all text-sm mt-4 flex justify-center items-center gap-2"
          >
            {saving ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <Save size={18} />
                <span>Salvar Alterações</span>
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
