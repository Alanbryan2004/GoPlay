import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import type { Comunidade, Grupo } from '../../types';
import {
  ArrowLeft, Network, Users, Plus, Trash2, Calendar,
  Globe, Lock, Settings, X, Edit2, Check
} from 'lucide-react';
import Dialog from '../../components/common/Dialog';

export default function ComunidadeDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [comunidade, setComunidade] = useState<Comunidade | null>(null);
  const [gruposNaComunidade, setGruposNaComunidade] = useState<any[]>([]); // {id (cg row), grupo_id, grupos:{id,nome,foto}}
  const [membrosUnicos, setMembrosUnicos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);

  // Adicionar grupo
  const [myGrupos, setMyGrupos] = useState<Grupo[]>([]);
  const [showAddGrupoModal, setShowAddGrupoModal] = useState(false);
  const [addingGrupo, setAddingGrupo] = useState(false);

  // Edição
  const [showEditModal, setShowEditModal] = useState(false);
  const [editNome, setEditNome] = useState('');
  const [editDescricao, setEditDescricao] = useState('');
  const [editPublica, setEditPublica] = useState(true);
  const [editFoto, setEditFoto] = useState('');
  const [saving, setSaving] = useState(false);

  const [dialog, setDialog] = useState<{
    isOpen: boolean; title: string; message: string;
    type: 'alert' | 'confirm'; onConfirm: () => void; onCancel?: () => void;
  }>({ isOpen: false, title: '', message: '', type: 'alert', onConfirm: () => {} });

  useEffect(() => {
    init();
  }, [id]);

  const init = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: profile } = await supabase.from('usuarios').select('id').eq('email', user.email).single();
      if (!profile) return;
      setCurrentUserId(profile.id);

      await fetchComunidade(profile.id);
      await fetchMyGrupos(profile.id);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const fetchComunidade = async (userId: string) => {
    const { data: com } = await supabase
      .from('comunidades')
      .select('*')
      .eq('id', id)
      .single();

    if (!com) return;
    setComunidade(com);
    setIsAdmin(com.criador_id === userId);
    setEditNome(com.nome);
    setEditDescricao(com.descricao || '');
    setEditPublica(com.publica);
    setEditFoto(com.foto || '');

    // Buscar grupos vinculados
    const { data: cgRows } = await supabase
      .from('comunidade_grupos')
      .select('id, grupo_id, grupos(id, nome, foto)')
      .eq('comunidade_id', id);

    setGruposNaComunidade(cgRows || []);

    // Calcular membros únicos
    const grupoIds = (cgRows || []).map((cg: any) => cg.grupo_id);
    if (grupoIds.length > 0) {
      const { data: membros } = await supabase
        .from('membros_grupo')
        .select('usuario_id, usuarios(id, nome, foto)')
        .in('grupo_id', grupoIds)
        .eq('status', 'aprovado');

      const seen = new Set<string>();
      const uniqueMembros: any[] = [];
      (membros || []).forEach((m: any) => {
        if (m.usuarios && !seen.has(m.usuario_id)) {
          seen.add(m.usuario_id);
          uniqueMembros.push(m.usuarios);
        }
      });
      setMembrosUnicos(uniqueMembros);
    } else {
      setMembrosUnicos([]);
    }
  };

  const fetchMyGrupos = async (userId: string) => {
    const { data: memberships } = await supabase
      .from('membros_grupo')
      .select('grupo_id, grupos(id, nome, foto)')
      .eq('usuario_id', userId)
      .eq('status', 'aprovado');

    if (memberships) {
      const grupos = memberships.map((m: any) => m.grupos).filter(Boolean) as Grupo[];
      setMyGrupos(grupos);
    }
  };

  const handleAddGrupo = async (grupoId: string) => {
    setAddingGrupo(true);
    try {
      const { error } = await supabase.from('comunidade_grupos').insert({ comunidade_id: id, grupo_id: grupoId });
      if (error) throw error;
      setShowAddGrupoModal(false);
      await fetchComunidade(currentUserId);
    } catch (e: any) {
      setDialog({ isOpen: true, title: 'Erro', message: e.message || 'Erro ao adicionar grupo.', type: 'alert', onConfirm: () => setDialog(p => ({ ...p, isOpen: false })) });
    } finally { setAddingGrupo(false); }
  };

  const handleRemoveGrupo = (cgId: string, grupoNome: string) => {
    setDialog({
      isOpen: true,
      title: 'Remover Grupo',
      message: `Deseja remover "${grupoNome}" desta comunidade?`,
      type: 'confirm',
      onConfirm: async () => {
        setDialog(p => ({ ...p, isOpen: false }));
        await supabase.from('comunidade_grupos').delete().eq('id', cgId);
        await fetchComunidade(currentUserId);
      },
      onCancel: () => setDialog(p => ({ ...p, isOpen: false })),
    });
  };

  const handleSaveEdit = async () => {
    if (!editNome.trim()) return;
    setSaving(true);
    try {
      await supabase.from('comunidades').update({
        nome: editNome.trim(),
        descricao: editDescricao.trim() || null,
        publica: editPublica,
        foto: editFoto.trim() || null,
      }).eq('id', id);
      setShowEditModal(false);
      await fetchComunidade(currentUserId);
    } catch (e: any) {
      setDialog({ isOpen: true, title: 'Erro', message: e.message, type: 'alert', onConfirm: () => setDialog(p => ({ ...p, isOpen: false })) });
    } finally { setSaving(false); }
  };

  const handleDeleteComunidade = () => {
    setDialog({
      isOpen: true,
      title: '🗑️ Excluir Comunidade',
      message: 'Deseja excluir esta comunidade permanentemente? Os grupos não serão afetados.',
      type: 'confirm',
      onConfirm: async () => {
        setDialog(p => ({ ...p, isOpen: false }));
        await supabase.from('comunidades').delete().eq('id', id);
        navigate('/comunidades');
      },
      onCancel: () => setDialog(p => ({ ...p, isOpen: false })),
    });
  };

  const gruposJaNaComunidade = new Set(gruposNaComunidade.map((cg: any) => cg.grupo_id));
  const gruposDisponiveis = myGrupos.filter(g => !gruposJaNaComunidade.has(g.id));

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[calc(100vh-8rem)]">
        <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!comunidade) {
    return (
      <div className="p-6 text-center">
        <Network size={40} className="mx-auto text-slate-300 mb-3" />
        <p className="text-slate-600 font-semibold">Comunidade não encontrada.</p>
        <button onClick={() => navigate('/comunidades')} className="mt-4 text-emerald-500 font-bold underline text-sm">
          Voltar
        </button>
      </div>
    );
  }

  return (
    <div className="px-4 py-3 pb-28 w-full max-w-md mx-auto space-y-5">
      <Dialog
        isOpen={dialog.isOpen} title={dialog.title} message={dialog.message}
        type={dialog.type} onConfirm={dialog.onConfirm} onCancel={dialog.onCancel}
      />

      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/comunidades')}
            className="p-2 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200 transition-colors"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-black text-slate-900">{comunidade.nome}</h1>
              {comunidade.publica
                ? <Globe size={13} className="text-emerald-500" />
                : <Lock size={13} className="text-slate-400" />
              }
            </div>
            {comunidade.descricao && (
              <p className="text-xs text-slate-500 mt-0.5">{comunidade.descricao}</p>
            )}
          </div>
        </div>
        {isAdmin && (
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setShowEditModal(true)}
              className="p-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-500 hover:text-emerald-600 hover:border-emerald-200 transition-all"
            >
              <Edit2 size={15} />
            </button>
            <button
              onClick={handleDeleteComunidade}
              className="p-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-500 hover:text-red-500 hover:border-red-200 transition-all"
            >
              <Trash2 size={15} />
            </button>
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3">
        <div className="glass p-4 rounded-2xl border border-slate-100 text-center">
          <p className="text-2xl font-black text-emerald-500">{gruposNaComunidade.length}</p>
          <p className="text-xs text-slate-500 font-semibold mt-0.5">Grupos</p>
        </div>
        <div className="glass p-4 rounded-2xl border border-slate-100 text-center">
          <p className="text-2xl font-black text-teal-500">{membrosUnicos.length}</p>
          <p className="text-xs text-slate-500 font-semibold mt-0.5">Membros Únicos</p>
        </div>
      </div>

      {/* Botão Criar Evento para a Comunidade */}
      <button
        onClick={() => navigate(`/eventos/novo?comunidade_id=${id}`)}
        className="w-full py-3.5 bg-gradient-to-r from-[#eb3237] to-rose-600 text-white font-black rounded-2xl shadow-lg shadow-red-500/20 active:scale-[0.99] transition-all flex items-center justify-center gap-2 text-sm"
      >
        <Calendar size={16} />
        Criar Evento para esta Comunidade
      </button>

      {/* Grupos da Comunidade */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-black text-slate-900 flex items-center gap-2">
            <Users size={14} className="text-emerald-500" />
            Grupos ({gruposNaComunidade.length})
          </h2>
          {isAdmin && (
            <button
              onClick={() => setShowAddGrupoModal(true)}
              className="flex items-center gap-1 text-xs font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-xl hover:bg-emerald-100 transition-all"
            >
              <Plus size={12} /> Adicionar Grupo
            </button>
          )}
        </div>

        {gruposNaComunidade.length === 0 ? (
          <div className="text-center py-8 glass rounded-2xl border border-slate-100">
            <Users size={28} className="mx-auto text-slate-300 mb-2" />
            <p className="text-slate-500 text-xs font-medium">Nenhum grupo nesta comunidade ainda.</p>
            {isAdmin && (
              <button
                onClick={() => setShowAddGrupoModal(true)}
                className="mt-3 text-emerald-500 text-xs font-bold underline"
              >
                + Adicionar Grupo
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {gruposNaComunidade.map((cg: any) => {
              const g = cg.grupos;
              if (!g) return null;
              return (
                <div key={cg.id} className="glass p-3.5 rounded-xl border border-slate-150 flex items-center gap-3">
                  {g.foto ? (
                    <img src={g.foto} alt={g.nome} className="w-10 h-10 rounded-xl object-cover flex-shrink-0" />
                  ) : (
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center flex-shrink-0">
                      <Users size={16} className="text-slate-500" />
                    </div>
                  )}
                  <span className="flex-1 text-sm font-bold text-slate-800 truncate">{g.nome}</span>
                  {isAdmin && (
                    <button
                      onClick={() => handleRemoveGrupo(cg.id, g.nome)}
                      className="p-1.5 rounded-lg hover:bg-red-50 text-slate-300 hover:text-red-400 transition-all flex-shrink-0"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Membros Únicos */}
      {membrosUnicos.length > 0 && (
        <div>
          <h2 className="text-sm font-black text-slate-900 flex items-center gap-2 mb-3">
            <Users size={14} className="text-teal-500" />
            Membros Únicos ({membrosUnicos.length})
          </h2>
          <div className="flex flex-wrap gap-2">
            {membrosUnicos.slice(0, 20).map((m: any) => (
              <div key={m.id} className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-full pl-1 pr-2.5 py-1">
                {m.foto ? (
                  <img src={m.foto} alt={m.nome} className="w-5 h-5 rounded-full object-cover" />
                ) : (
                  <div className="w-5 h-5 rounded-full bg-slate-300 flex items-center justify-center text-[8px] font-bold text-slate-600">
                    {m.nome?.charAt(0)?.toUpperCase()}
                  </div>
                )}
                <span className="text-[11px] font-semibold text-slate-700">{m.nome?.split(' ')[0]}</span>
              </div>
            ))}
            {membrosUnicos.length > 20 && (
              <div className="flex items-center justify-center bg-slate-100 rounded-full px-2.5 py-1">
                <span className="text-[11px] font-bold text-slate-500">+{membrosUnicos.length - 20}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal: Adicionar Grupo */}
      {showAddGrupoModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center" onClick={() => setShowAddGrupoModal(false)}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <div
            className="relative w-full max-w-md bg-white rounded-t-3xl shadow-2xl p-6 space-y-4 max-h-[70vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            <div className="w-10 h-1 bg-slate-200 rounded-full mx-auto mb-2" />
            <div className="flex items-center justify-between">
              <h2 className="text-base font-black text-slate-900">Adicionar Grupo</h2>
              <button onClick={() => setShowAddGrupoModal(false)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500">
                <X size={16} />
              </button>
            </div>

            {gruposDisponiveis.length === 0 ? (
              <p className="text-center text-slate-500 text-sm py-6">Todos os seus grupos já foram adicionados.</p>
            ) : (
              <div className="space-y-2">
                {gruposDisponiveis.map(g => (
                  <button
                    key={g.id}
                    onClick={() => handleAddGrupo(g.id)}
                    disabled={addingGrupo}
                    className="w-full flex items-center gap-3 p-3 rounded-xl border border-slate-200 bg-slate-50 hover:bg-emerald-50 hover:border-emerald-200 transition-all text-left"
                  >
                    {g.foto ? (
                      <img src={g.foto} alt={g.nome} className="w-9 h-9 rounded-xl object-cover flex-shrink-0" />
                    ) : (
                      <div className="w-9 h-9 rounded-xl bg-slate-200 flex items-center justify-center flex-shrink-0">
                        <Users size={14} className="text-slate-500" />
                      </div>
                    )}
                    <span className="text-sm font-bold text-slate-800 flex-1 truncate">{g.nome}</span>
                    <Plus size={14} className="text-emerald-500 flex-shrink-0" />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal: Editar Comunidade */}
      {showEditModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center" onClick={() => setShowEditModal(false)}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <div
            className="relative w-full max-w-md bg-white rounded-t-3xl shadow-2xl p-6 space-y-4"
            onClick={e => e.stopPropagation()}
          >
            <div className="w-10 h-1 bg-slate-200 rounded-full mx-auto mb-2" />
            <div className="flex items-center justify-between">
              <h2 className="text-base font-black text-slate-900">Editar Comunidade</h2>
              <button onClick={() => setShowEditModal(false)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500">
                <X size={16} />
              </button>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Nome</label>
              <input type="text" value={editNome} onChange={e => setEditNome(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/40" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Descrição</label>
              <textarea value={editDescricao} onChange={e => setEditDescricao(e.target.value)} rows={2}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 resize-none" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setEditPublica(true)}
                className={`py-2.5 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${editPublica ? 'bg-emerald-500 border-emerald-500 text-white' : 'bg-slate-50 border-slate-200 text-slate-600'}`}>
                <Globe size={12} /> Pública
              </button>
              <button type="button" onClick={() => setEditPublica(false)}
                className={`py-2.5 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${!editPublica ? 'bg-emerald-500 border-emerald-500 text-white' : 'bg-slate-50 border-slate-200 text-slate-600'}`}>
                <Lock size={12} /> Privada
              </button>
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setShowEditModal(false)}
                className="flex-1 py-3 bg-slate-100 text-slate-600 font-bold rounded-xl text-sm">Cancelar</button>
              <button onClick={handleSaveEdit} disabled={saving || !editNome.trim()}
                className="flex-1 py-3 bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-bold rounded-xl shadow-lg shadow-emerald-500/20 text-sm disabled:opacity-50 flex justify-center items-center">
                {saving ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <><Check size={14} className="mr-1" />Salvar</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
