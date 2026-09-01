import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import type { Comunidade, Grupo } from '../../types';
import { useNavigate } from 'react-router-dom';
import { Plus, Globe, Lock, Users, ChevronRight, X, ImageIcon, Search, Network } from 'lucide-react';
import Dialog from '../../components/common/Dialog';

export default function ComunidadesList() {
  const navigate = useNavigate();
  const [comunidades, setComunidades] = useState<Comunidade[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState('');
  const [myGrupos, setMyGrupos] = useState<Grupo[]>([]);

  // Modal de criação
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newNome, setNewNome] = useState('');
  const [newDescricao, setNewDescricao] = useState('');
  const [newPublica, setNewPublica] = useState(true);
  const [newFoto, setNewFoto] = useState('');
  const [selectedGrupoIds, setSelectedGrupoIds] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  const [dialog, setDialog] = useState<{
    isOpen: boolean; title: string; message: string;
    type: 'alert' | 'confirm'; onConfirm: () => void; onCancel?: () => void;
  }>({ isOpen: false, title: '', message: '', type: 'alert', onConfirm: () => {} });

  useEffect(() => {
    init();
  }, []);

  const init = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: profile } = await supabase.from('usuarios').select('id').eq('email', user.email).single();
      if (!profile) return;
      setCurrentUserId(profile.id);

      // Grupos do usuário (como admin/moderador)
      const { data: memberships } = await supabase
        .from('membros_grupo')
        .select('grupo_id, grupos(id, nome, foto)')
        .eq('usuario_id', profile.id)
        .eq('status', 'aprovado');

      if (memberships) {
        const grupos = memberships.map((m: any) => m.grupos).filter(Boolean) as Grupo[];
        setMyGrupos(grupos);
      }

      await fetchComunidades(profile.id);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchComunidades = async (userId: string) => {
    setLoading(true);
    try {
      // Buscar comunidades que o usuário criou OU que tem grupos seus
      const { data: allComunidades } = await supabase
        .from('comunidades')
        .select('*, comunidade_grupos(id, grupo_id, grupos(id, nome, foto))')
        .order('created_at', { ascending: false });

      if (!allComunidades) { setComunidades([]); return; }

      // Filtrar comunidades onde o usuário é criador OU tem algum grupo seu
      const { data: memberships } = await supabase
        .from('membros_grupo')
        .select('grupo_id')
        .eq('usuario_id', userId)
        .eq('status', 'aprovado');

      const myGrupoIds = new Set((memberships || []).map((m: any) => m.grupo_id));

      const filtered = allComunidades.filter((c: any) =>
        c.criador_id === userId ||
        c.publica ||
        (c.comunidade_grupos || []).some((cg: any) => myGrupoIds.has(cg.grupo_id))
      );

      // Calcular total de membros únicos por comunidade
      const enriched: Comunidade[] = await Promise.all(
        filtered.map(async (c: any) => {
          const grupoIds = (c.comunidade_grupos || []).map((cg: any) => cg.grupo_id);
          let totalMembros = 0;
          if (grupoIds.length > 0) {
            const { data: membros } = await supabase
              .from('membros_grupo')
              .select('usuario_id')
              .in('grupo_id', grupoIds)
              .eq('status', 'aprovado');
            totalMembros = new Set((membros || []).map((m: any) => m.usuario_id)).size;
          }
          return {
            ...c,
            total_grupos: grupoIds.length,
            total_membros: totalMembros,
            grupos: c.comunidade_grupos,
          };
        })
      );

      setComunidades(enriched);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!newNome.trim()) return;
    setCreating(true);
    try {
      const { data: inserted, error } = await supabase
        .from('comunidades')
        .insert({ nome: newNome.trim(), descricao: newDescricao.trim() || null, publica: newPublica, foto: newFoto.trim() || null, criador_id: currentUserId })
        .select()
        .single();

      if (error) throw error;

      // Adicionar grupos selecionados
      if (selectedGrupoIds.length > 0) {
        await supabase.from('comunidade_grupos').insert(
          selectedGrupoIds.map(gid => ({ comunidade_id: inserted.id, grupo_id: gid }))
        );
      }

      setShowCreateModal(false);
      setNewNome(''); setNewDescricao(''); setNewFoto('');
      setSelectedGrupoIds([]);
      await fetchComunidades(currentUserId);
    } catch (e: any) {
      setDialog({ isOpen: true, title: 'Erro', message: e.message || 'Erro ao criar comunidade.', type: 'alert', onConfirm: () => setDialog(p => ({ ...p, isOpen: false })) });
    } finally {
      setCreating(false);
    }
  };

  const toggleGrupo = (id: string) => {
    setSelectedGrupoIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const filtered = comunidades.filter(c => c.nome.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div className="px-4 py-3 pb-24 w-full max-w-md mx-auto min-h-[calc(100vh-8rem)]">
      <Dialog
        isOpen={dialog.isOpen} title={dialog.title} message={dialog.message}
        type={dialog.type} onConfirm={dialog.onConfirm} onCancel={dialog.onCancel}
      />

      {/* Header */}
      <div className="flex items-center justify-between mb-5 h-11">
        <div className="flex items-center gap-3 pl-14">
          <div className="p-2 bg-emerald-500/10 text-emerald-600 rounded-xl">
            <Network size={18} />
          </div>
          <h1 className="text-2xl font-black text-slate-900 leading-none">Comunidades</h1>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-1.5 bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-xs font-bold px-3 py-2 rounded-xl shadow-lg shadow-emerald-500/20 active:scale-95 transition-all"
        >
          <Plus size={14} />
          Nova
        </button>
      </div>

      {/* Search */}
      <div className="relative mb-5">
        <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          placeholder="Buscar comunidade..."
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 pl-9 pr-4 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
        />
      </div>

      {/* Lista */}
      {loading ? (
        <div className="flex justify-center items-center h-48">
          <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 glass rounded-2xl border border-slate-100">
          <Network size={36} className="mx-auto text-slate-300 mb-3" />
          <p className="text-slate-600 font-semibold text-sm">Nenhuma comunidade encontrada</p>
          <p className="text-slate-400 text-xs mt-1">Crie uma comunidade para reunir seus grupos!</p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="mt-4 px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-emerald-500/20 active:scale-95 transition-all"
          >
            + Criar Comunidade
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(c => (
            <button
              key={c.id}
              onClick={() => navigate(`/comunidades/${c.id}`)}
              className="w-full glass p-4 rounded-2xl border border-slate-150 shadow-sm hover:shadow-md hover:border-emerald-200 active:scale-[0.99] transition-all text-left flex items-center gap-4"
            >
              {/* Avatar */}
              <div className="flex-shrink-0">
                {c.foto ? (
                  <img src={c.foto} alt={c.nome} className="w-14 h-14 rounded-2xl object-cover ring-2 ring-emerald-100" />
                ) : (
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center shadow-md">
                    <Network size={24} className="text-white" />
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="font-black text-slate-900 text-sm truncate">{c.nome}</span>
                  {c.publica ? (
                    <Globe size={11} className="text-emerald-500 flex-shrink-0" />
                  ) : (
                    <Lock size={11} className="text-slate-400 flex-shrink-0" />
                  )}
                  {c.criador_id === currentUserId && (
                    <span className="text-[9px] font-black uppercase tracking-wider text-emerald-600 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded-full flex-shrink-0">Admin</span>
                  )}
                </div>
                {c.descricao && (
                  <p className="text-xs text-slate-500 truncate mb-1">{c.descricao}</p>
                )}
                <div className="flex items-center gap-3 text-[11px] text-slate-500 font-medium">
                  <span className="flex items-center gap-1">
                    <Users size={10} className="text-emerald-500" />
                    {c.total_grupos || 0} grupo{(c.total_grupos || 0) !== 1 ? 's' : ''}
                  </span>
                  <span className="flex items-center gap-1">
                    <Users size={10} className="text-teal-500" />
                    {c.total_membros || 0} membro{(c.total_membros || 0) !== 1 ? 's' : ''}
                  </span>
                </div>
              </div>

              <ChevronRight size={16} className="text-slate-300 flex-shrink-0" />
            </button>
          ))}
        </div>
      )}

      {/* Modal de Criação */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center" onClick={() => setShowCreateModal(false)}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <div
            className="relative w-full max-w-md bg-white rounded-t-3xl shadow-2xl p-6 space-y-4 max-h-[90vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            {/* Handle */}
            <div className="w-10 h-1 bg-slate-200 rounded-full mx-auto mb-2" />

            <div className="flex items-center justify-between">
              <h2 className="text-lg font-black text-slate-900">Nova Comunidade</h2>
              <button onClick={() => setShowCreateModal(false)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors">
                <X size={18} />
              </button>
            </div>

            {/* Nome */}
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Nome *</label>
              <input
                type="text"
                placeholder="Ex: Garden, Conjunto Bela Vista..."
                value={newNome}
                onChange={e => setNewNome(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
              />
            </div>

            {/* Descrição */}
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Descrição</label>
              <textarea
                placeholder="Uma breve descrição da comunidade..."
                value={newDescricao}
                onChange={e => setNewDescricao(e.target.value)}
                rows={2}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 resize-none"
              />
            </div>

            {/* Foto URL */}
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                <ImageIcon size={11} className="inline mr-1" />
                Foto (URL opcional)
              </label>
              <input
                type="url"
                placeholder="https://..."
                value={newFoto}
                onChange={e => setNewFoto(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
              />
            </div>

            {/* Visibilidade */}
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Visibilidade</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setNewPublica(true)}
                  className={`py-2.5 px-3 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${newPublica ? 'bg-emerald-500 border-emerald-500 text-white shadow-md' : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'}`}
                >
                  <Globe size={12} /> Pública
                </button>
                <button
                  type="button"
                  onClick={() => setNewPublica(false)}
                  className={`py-2.5 px-3 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${!newPublica ? 'bg-emerald-500 border-emerald-500 text-white shadow-md' : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'}`}
                >
                  <Lock size={12} /> Privada
                </button>
              </div>
            </div>

            {/* Selecionar Grupos */}
            {myGrupos.length > 0 && (
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                  Adicionar Grupos ({selectedGrupoIds.length} selecionado{selectedGrupoIds.length !== 1 ? 's' : ''})
                </label>
                <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                  {myGrupos.map(g => (
                    <button
                      key={g.id}
                      type="button"
                      onClick={() => toggleGrupo(g.id)}
                      className={`w-full flex items-center gap-3 p-2.5 rounded-xl border transition-all text-left ${selectedGrupoIds.includes(g.id) ? 'bg-emerald-50 border-emerald-300 text-emerald-700' : 'bg-slate-50 border-slate-200 text-slate-700 hover:border-slate-300'}`}
                    >
                      {g.foto ? (
                        <img src={g.foto} alt={g.nome} className="w-8 h-8 rounded-lg object-cover flex-shrink-0" />
                      ) : (
                        <div className="w-8 h-8 rounded-lg bg-slate-200 flex items-center justify-center flex-shrink-0">
                          <Users size={14} className="text-slate-500" />
                        </div>
                      )}
                      <span className="text-xs font-bold truncate flex-1">{g.nome}</span>
                      {selectedGrupoIds.includes(g.id) && (
                        <div className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center flex-shrink-0">
                          <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                            <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Botões */}
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setShowCreateModal(false)}
                className="flex-1 py-3 bg-slate-100 text-slate-600 font-bold rounded-xl text-sm hover:bg-slate-200 transition-all"
              >
                Cancelar
              </button>
              <button
                onClick={handleCreate}
                disabled={creating || !newNome.trim()}
                className="flex-1 py-3 bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-bold rounded-xl shadow-lg shadow-emerald-500/20 text-sm disabled:opacity-50 active:scale-95 transition-all flex justify-center items-center"
              >
                {creating ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : 'Criar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
