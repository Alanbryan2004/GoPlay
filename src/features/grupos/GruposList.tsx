import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import type { Grupo, Usuario } from '../../types';
import { Plus, Users, X, UserMinus, UserPlus, CalendarRange } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Dialog from '../../components/common/Dialog';

export default function GruposList() {
  const navigate = useNavigate();
  const [grupos, setGrupos] = useState<Grupo[]>([]);
  const [loading, setLoading] = useState(true);
  const [newGrupoName, setNewGrupoName] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [creating, setCreating] = useState(false);

  // Estados de Gerenciamento de Membros
  const [selectedGrupo, setSelectedGrupo] = useState<Grupo | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string>('');
  const [membros, setMembros] = useState<any[]>([]); // { id (membros_grupo row id), usuario: Usuario }
  const [amigosParaAdicionar, setAmigosParaAdicionar] = useState<Usuario[]>([]);
  const [loadingMembros, setLoadingMembros] = useState(false);

  // Estado do Dialog Customizado
  const [dialog, setDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type: 'alert' | 'confirm';
    onConfirm: () => void;
    onCancel?: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    type: 'alert',
    onConfirm: () => {},
  });

  useEffect(() => {
    fetchGrupos();
    fetchCurrentUser();
  }, []);

  const fetchCurrentUser = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from('usuarios')
          .select('id')
          .eq('email', user.email)
          .single();
        if (profile) {
          setCurrentUserId(profile.id);
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchGrupos = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase.from('grupos').select('*');
      if (!error && data) {
        setGrupos(data as Grupo[]);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateGrupo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGrupoName.trim()) return;
    setCreating(true);

    try {
      const { data: newGroup, error } = await supabase
        .from('grupos')
        .insert({ nome: newGrupoName.trim(), publico: true })
        .select()
        .single();

      if (!error && newGroup) {
        setGrupos((prev) => [...prev, newGroup as Grupo]);
        setNewGrupoName('');
        setShowAddModal(false);
      } else {
        setDialog({
          isOpen: true,
          title: 'Erro ao Criar Grupo',
          message: error?.message || 'Erro inesperado.',
          type: 'alert',
          onConfirm: () => setDialog((prev) => ({ ...prev, isOpen: false })),
        });
      }
    } catch (err) {
      console.error(err);
    } finally {
      setCreating(false);
    }
  };

  // Abrir Gerenciamento de Membros
  const openManageMembers = async (grupo: Grupo) => {
    setSelectedGrupo(grupo);
    setLoadingMembros(true);
    try {
      // 1. Buscar membros atuais do grupo
      // Obs: fazemos um join simples com a tabela usuarios
      const { data: dbMembros, error: membrosError } = await supabase
        .from('membros_grupo')
        .select(`
          id,
          usuario_id,
          usuarios:usuario_id (
            id,
            nome,
            foto,
            email
          )
        `)
        .eq('grupo_id', grupo.id);

      if (membrosError) {
        // Se a tabela membros_grupo não existir, sugere a criação
        if (membrosError.code === '42P01') {
          throw new Error('A tabela membros_grupo não foi encontrada no banco de dados. Por favor, execute o script SQL disponibilizado.');
        }
        throw membrosError;
      }

      const parsedMembros = (dbMembros || []).map((m: any) => {
        const userObj = Array.isArray(m.usuarios) ? m.usuarios[0] : m.usuarios;
        return {
          id: m.id,
          usuario_id: m.usuario_id,
          usuario: userObj as Usuario,
        };
      }).filter(m => m.usuario !== null && m.usuario !== undefined);

      setMembros(parsedMembros);

      // 2. Buscar amigos do usuário para saber quem ele pode adicionar
      if (currentUserId) {
        const { data: dbAmigos } = await supabase
          .from('amigos')
          .select('*')
          .or(`usuario_id.eq.${currentUserId},amigo_id.eq.${currentUserId}`)
          .eq('ativo', true);

        const amigoIds = (dbAmigos || []).map((a) =>
          a.usuario_id === currentUserId ? a.amigo_id : a.usuario_id
        );

        if (amigoIds.length > 0) {
          // Buscar detalhes dos amigos na tabela usuarios
          const { data: dbUsers } = await supabase
            .from('usuarios')
            .select('*')
            .in('id', amigoIds);

          if (dbUsers) {
            // Filtrar amigos que já NÃO sejam membros do grupo
            const filtrados = (dbUsers as Usuario[]).filter(
              (amigo) => !parsedMembros.some((m) => m.usuario_id === amigo.id)
            );
            setAmigosParaAdicionar(filtrados);
          }
        } else {
          setAmigosParaAdicionar([]);
        }
      }
    } catch (e: any) {
      setDialog({
        isOpen: true,
        title: 'Tabela Não Encontrada',
        message: e.message || 'Erro ao carregar membros do grupo.',
        type: 'alert',
        onConfirm: () => {
          setDialog((prev) => ({ ...prev, isOpen: false }));
          setSelectedGrupo(null);
        },
      });
    } finally {
      setLoadingMembros(false);
    }
  };

  // Adicionar Membro ao Grupo
  const handleAddMembro = async (friend: Usuario) => {
    if (!selectedGrupo) return;
    try {
      const { data, error } = await supabase
        .from('membros_grupo')
        .insert({
          grupo_id: selectedGrupo.id,
          usuario_id: friend.id,
        })
        .select(`
          id,
          usuario_id,
          usuarios:usuario_id (
            id,
            nome,
            foto,
            email
          )
        `)
        .single();

      if (!error && data) {
        const userObj = Array.isArray(data.usuarios) ? data.usuarios[0] : data.usuarios;
        const novoMembro = {
          id: data.id,
          usuario_id: data.usuario_id,
          usuario: userObj as Usuario,
        };
        setMembros((prev) => [...prev, novoMembro]);
        setAmigosParaAdicionar((prev) => prev.filter((a) => a.id !== friend.id));
      } else {
        console.error('Erro ao adicionar membro:', error);
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Remover Membro do Grupo
  const handleRemoveMembro = async (membroId: string, usuario: Usuario) => {
    setDialog({
      isOpen: true,
      title: 'Remover Membro',
      message: `Deseja realmente remover ${usuario.nome} do grupo?`,
      type: 'confirm',
      onConfirm: async () => {
        setDialog((prev) => ({ ...prev, isOpen: false }));
        try {
          const { error } = await supabase
            .from('membros_grupo')
            .delete()
            .eq('id', membroId);

          if (!error) {
            setMembros((prev) => prev.filter((m) => m.id !== membroId));
            setAmigosParaAdicionar((prev) => [...prev, usuario]);
          } else {
            console.error('Erro ao deletar:', error);
          }
        } catch (e) {
          console.error(e);
        }
      },
      onCancel: () => setDialog((prev) => ({ ...prev, isOpen: false })),
    });
  };

  return (
    <div className="px-4 py-3 pb-24 w-full max-w-md mx-auto min-h-[calc(100vh-8rem)]">
      <div className="flex justify-between items-center mb-4 pl-14 h-11">
        <h1 className="text-2xl font-black text-slate-900 leading-none">Grupos</h1>
        <button
          onClick={() => setShowAddModal(true)}
          className="p-2.5 bg-gradient-to-r from-[#eb3237] to-red-650 hover:from-red-500 hover:to-red-600 text-white rounded-xl shadow-lg active:scale-95 transition-all cursor-pointer"
        >
          <Plus size={18} />
        </button>
      </div>

      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass p-6 rounded-2xl w-full max-w-sm space-y-4">
            <h2 className="text-xl font-bold text-slate-900">Novo Grupo</h2>
            <form onSubmit={handleCreateGrupo} className="space-y-4">
              <input
                type="text"
                required
                placeholder="Nome do grupo..."
                value={newGrupoName}
                onChange={(e) => setNewGrupoName(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
              />
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-650 rounded-xl text-sm cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="flex-1 py-2.5 bg-red-600 hover:bg-red-500 text-white rounded-xl font-bold text-sm flex justify-center items-center cursor-pointer"
                >
                  {creating ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : 'Criar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center items-center h-48">
          <div className="w-8 h-8 border-4 border-red-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : grupos.length === 0 ? (
        <div className="text-center py-12 glass rounded-2xl border border-slate-150">
          <Users size={48} className="mx-auto text-slate-650 mb-3" />
          <p className="text-slate-600 font-medium">Nenhum grupo encontrado.</p>
          <p className="text-slate-600 text-xs mt-1">Crie um grupo para começar a convidar jogadores!</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {grupos.map((grupo) => (
            <div
              key={grupo.id}
              onClick={() => openManageMembers(grupo)}
              className="glass p-5 rounded-2xl border border-slate-200 hover:border-red-650/40 cursor-pointer active:scale-[0.99] transition-all flex items-center justify-between shadow-xs"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-red-600/10 text-red-500 flex items-center justify-center">
                  <Users size={20} />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-850 text-sm leading-tight">{grupo.nome}</h3>
                  <p className="text-[10px] font-semibold text-red-500 uppercase tracking-wider mt-1">Gerenciar Membros</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* MODAL DETALHADO DO GRUPO (GERENCIAR MEMBROS E REDIRECIONAMENTOS) */}
      {selectedGrupo && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="glass p-5 rounded-2xl w-full max-w-sm my-8 flex flex-col max-h-[85vh] text-left">
            
            {/* Header do Modal */}
            <div className="flex justify-between items-center border-b border-slate-200 pb-3 mb-4 flex-shrink-0">
              <div>
                <h2 className="text-lg font-black text-slate-900 leading-tight truncate max-w-[220px]">
                  {selectedGrupo.nome}
                </h2>
                <p className="text-[9px] font-bold text-slate-450 uppercase tracking-widest mt-0.5">Membros do Grupo</p>
              </div>
              <button 
                onClick={() => setSelectedGrupo(null)} 
                className="p-1 hover:bg-slate-100 rounded-lg text-slate-500 transition-colors cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            {loadingMembros ? (
              <div className="flex justify-center items-center h-48 flex-1">
                <div className="w-8 h-8 border-4 border-red-600 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto space-y-4 pr-1 no-scrollbar">
                
                {/* 1. Lista de Membros Atuais */}
                <div>
                  <h3 className="text-[10px] font-bold text-slate-450 uppercase tracking-wider mb-2">
                    Membros Ativos ({membros.length})
                  </h3>
                  {membros.length === 0 ? (
                    <p className="text-xs text-slate-650 py-2 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200">
                      Nenhum membro no grupo.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {membros.map((m) => (
                        <div key={m.id} className="flex items-center justify-between bg-slate-50 p-2.5 rounded-xl border border-slate-150">
                          <div className="flex items-center gap-2 min-w-0">
                            {m.usuario.foto ? (
                              <img src={m.usuario.foto} alt={m.usuario.nome} className="w-7 h-7 rounded-full object-cover" />
                            ) : (
                              <div className="w-7 h-7 rounded-full bg-slate-800 text-white flex items-center justify-center font-bold text-[10px]">
                                {m.usuario.nome.charAt(0).toUpperCase()}
                              </div>
                            )}
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-slate-800 truncate leading-tight">{m.usuario.nome}</p>
                              <p className="text-[9px] text-slate-450 truncate">{m.usuario.email}</p>
                            </div>
                          </div>
                          <button
                            onClick={() => handleRemoveMembro(m.id, m.usuario)}
                            className="p-1.5 hover:text-red-500 text-slate-600 rounded-lg cursor-pointer"
                            title="Remover do Grupo"
                          >
                            <UserMinus size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* 2. Lista de Amigos para Adicionar */}
                <div>
                  <h3 className="text-[10px] font-bold text-slate-450 uppercase tracking-wider mb-2">
                    Convidar Amigos da sua Rede
                  </h3>
                  {amigosParaAdicionar.length === 0 ? (
                    <p className="text-xs text-slate-450 py-3 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200">
                      Nenhum amigo pendente disponível.
                    </p>
                  ) : (
                    <div className="space-y-2 max-h-48 overflow-y-auto no-scrollbar">
                      {amigosParaAdicionar.map((amigo) => (
                        <div key={amigo.id} className="flex items-center justify-between bg-white p-2.5 rounded-xl border border-slate-150">
                          <div className="flex items-center gap-2 min-w-0">
                            {amigo.foto ? (
                              <img src={amigo.foto} alt={amigo.nome} className="w-7 h-7 rounded-full object-cover" />
                            ) : (
                              <div className="w-7 h-7 rounded-full bg-slate-800 text-white flex items-center justify-center font-bold text-[10px]">
                                {amigo.nome.charAt(0).toUpperCase()}
                              </div>
                            )}
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-slate-800 truncate leading-tight">{amigo.nome}</p>
                              <p className="text-[9px] text-slate-450 truncate">{amigo.email}</p>
                            </div>
                          </div>
                          <button
                            onClick={() => handleAddMembro(amigo)}
                            className="p-1.5 bg-red-50 hover:bg-red-100 text-red-650 rounded-lg cursor-pointer border border-red-200 shadow-xs"
                            title="Convidar para o Grupo"
                          >
                            <UserPlus size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

              </div>
            )}

            {/* Ações e Redirecionamentos */}
            <div className="border-t border-slate-200 pt-4 mt-4 space-y-2 flex-shrink-0">
              <button
                onClick={() => {
                  setSelectedGrupo(null);
                  navigate(`/eventos?grupo_id=${selectedGrupo.id}`);
                }}
                className="w-full py-2.5 bg-gradient-to-r from-[#eb3237] to-red-650 hover:from-red-500 hover:to-red-600 text-white font-bold rounded-xl text-xs flex justify-center items-center gap-2 cursor-pointer shadow-md shadow-red-500/10 active:scale-[0.98] transition-all"
              >
                <CalendarRange size={15} />
                <span>Ver Partidas do Grupo</span>
              </button>

              <button
                onClick={() => {
                  setSelectedGrupo(null);
                  navigate(`/eventos/novo?grupo_id=${selectedGrupo.id}`);
                }}
                className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs flex justify-center items-center gap-2 cursor-pointer shadow-md shadow-emerald-500/10 active:scale-[0.98] transition-all"
              >
                <Plus size={15} />
                <span>Criar Nova Partida</span>
              </button>
            </div>

          </div>
        </div>
      )}

      <Dialog {...dialog} />
    </div>
  );
}
