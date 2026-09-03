import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import type { Usuario } from '../../types';
import { UserPlus, UserCheck, MessageSquare, Search, Clock, X } from 'lucide-react';
import Dialog from '../../components/common/Dialog';

export default function AmigosList() {
  const navigate = useNavigate();
  const [users, setUsers] = useState<Usuario[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string>('');
  const [amizades, setAmizades] = useState<any[]>([]);
  const [unreadBySender, setUnreadBySender] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
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
    fetchUsersAndFriendships();

    const handleRefresh = () => {
      fetchUsersAndFriendships();
    };
    window.addEventListener('goplay:refresh-notifications', handleRefresh);
    return () => window.removeEventListener('goplay:refresh-notifications', handleRefresh);
  }, []);

  const fetchUsersAndFriendships = async () => {
    try {
      setLoading(true);
      // 1. Obter todos os usuários
      const { data: dbUsers, error: userError } = await supabase.from('usuarios').select('*');
      if (userError) throw userError;

      // 2. Obter o usuário logado atualmente
      const { data: { user: authUser } } = await supabase.auth.getUser();
      let loggedId = '';
      if (authUser) {
        const { data: profile } = await supabase
          .from('usuarios')
          .select('id')
          .eq('email', authUser.email)
          .single();
        if (profile) {
          loggedId = profile.id;
          setCurrentUserId(profile.id);
        }
      }

      if (dbUsers) {
        setUsers(dbUsers as Usuario[]);
      }

      // 3. Obter todas as amizades do usuário logado
      if (loggedId) {
        const { data: dbAmigos, error: amigosError } = await supabase
          .from('amigos')
          .select('*')
          .or(`usuario_id.eq.${loggedId},amigo_id.eq.${loggedId}`);
        if (!amigosError && dbAmigos) {
          setAmizades(dbAmigos);
        }

        // 4. Obter mensagens não lidas recebidas por remetente
        try {
          const { data: unreadData } = await supabase
            .from('mensagens')
            .select('remetente_id')
            .eq('destinatario_id', loggedId)
            .eq('lida', false);

          if (unreadData) {
            const counts: Record<string, number> = {};
            unreadData.forEach((m: any) => {
              counts[m.remetente_id] = (counts[m.remetente_id] || 0) + 1;
            });
            setUnreadBySender(counts);
          }
        } catch {
          // Tabela mensagens pode não ter sido criada ainda
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleAddAmigo = async (friendId: string, friendNome: string) => {
    if (!currentUserId) return;
    setDialog({
      isOpen: true,
      title: 'Enviar Solicitação',
      message: `Deseja enviar uma solicitação de amizade para ${friendNome}?`,
      type: 'confirm',
      onConfirm: async () => {
        setDialog((prev) => ({ ...prev, isOpen: false }));
        try {
          const { data, error } = await supabase
            .from('amigos')
            .insert({
              usuario_id: currentUserId,
              amigo_id: friendId,
              ativo: false, // Inicia pendente
            })
            .select()
            .single();
          if (!error && data) {
            setAmizades((prev) => [...prev, data]);
          } else if (error) {
            setDialog({
              isOpen: true,
              title: 'Erro',
              message: `Não foi possível enviar a solicitação: ${error.message}`,
              type: 'alert',
              onConfirm: () => setDialog((prev) => ({ ...prev, isOpen: false })),
            });
          }
        } catch (e: any) {
          setDialog({
            isOpen: true,
            title: 'Erro de Conexão',
            message: e.message || 'Erro inesperado ao enviar solicitação.',
            type: 'alert',
            onConfirm: () => setDialog((prev) => ({ ...prev, isOpen: false })),
          });
        }
      },
      onCancel: () => setDialog((prev) => ({ ...prev, isOpen: false })),
    });
  };

  const handleAcceptRequest = async (requestId: string) => {
    try {
      const { data, error } = await supabase
        .from('amigos')
        .update({ ativo: true })
        .eq('id', requestId)
        .select()
        .single();
      if (!error && data) {
        setAmizades((prev) => prev.map((a) => (a.id === requestId ? data : a)));
        window.dispatchEvent(new CustomEvent('goplay:refresh-notifications'));
      } else if (error) {
        setDialog({
          isOpen: true,
          title: 'Erro',
          message: `Erro ao aceitar solicitação: ${error.message}`,
          type: 'alert',
          onConfirm: () => setDialog((prev) => ({ ...prev, isOpen: false })),
        });
      }
    } catch (e: any) {
      console.error(e);
    }
  };

  const handleRejectRequest = async (requestId: string) => {
    try {
      const { error } = await supabase.from('amigos').delete().eq('id', requestId);
      if (!error) {
        setAmizades((prev) => prev.filter((a) => a.id !== requestId));
        window.dispatchEvent(new CustomEvent('goplay:refresh-notifications'));
      } else {
        setDialog({
          isOpen: true,
          title: 'Erro',
          message: `Erro ao recusar solicitação: ${error.message}`,
          type: 'alert',
          onConfirm: () => setDialog((prev) => ({ ...prev, isOpen: false })),
        });
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleRemoveAmigo = (friendId: string, friendNome: string) => {
    const amizadeRow = amizades.find(
      (a) =>
        (a.usuario_id === currentUserId && a.amigo_id === friendId) ||
        (a.usuario_id === friendId && a.amigo_id === currentUserId)
    );
    if (!amizadeRow) return;

    setDialog({
      isOpen: true,
      title: 'Remover Amigo',
      message: `Tem certeza que deseja remover ${friendNome} da sua rede de amigos?`,
      type: 'confirm',
      onConfirm: async () => {
        setDialog((prev) => ({ ...prev, isOpen: false }));
        try {
          const { error } = await supabase.from('amigos').delete().eq('id', amizadeRow.id);
          if (!error) {
            setAmizades((prev) => prev.filter((a) => a.id !== amizadeRow.id));
            window.dispatchEvent(new CustomEvent('goplay:refresh-notifications'));
          } else {
            setDialog({
              isOpen: true,
              title: 'Erro',
              message: `Não foi possível remover o amigo: ${error.message}`,
              type: 'alert',
              onConfirm: () => setDialog((prev) => ({ ...prev, isOpen: false })),
            });
          }
        } catch (e: any) {
          setDialog({
            isOpen: true,
            title: 'Erro de Conexão',
            message: e.message || 'Erro inesperado ao remover amigo.',
            type: 'alert',
            onConfirm: () => setDialog((prev) => ({ ...prev, isOpen: false })),
          });
        }
      },
      onCancel: () => setDialog((prev) => ({ ...prev, isOpen: false })),
    });
  };

  // Solicitações pendentes que OUTROS enviaram para mim
  const solicitacoesRecebidas = amizades.filter(
    (a) => a.amigo_id === currentUserId && a.ativo === false
  );

  // IDs dos usuários que me enviaram solicitação de amizade pendente (ficam apenas na seção superior)
  const remetenteSolicitacaoIds = new Set(solicitacoesRecebidas.map((a) => a.usuario_id));

  // Na lista inferior, removemos quem já está aguardando resposta na parte superior
  const filteredUsers = users
    .filter((u) => !remetenteSolicitacaoIds.has(u.id))
    .filter((u) => u.nome.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="px-4 py-3 pb-24 w-full max-w-md mx-auto min-h-[calc(100vh-8rem)]">
      {/* Alinha o título perfeitamente ao lado do botão de menu flutuante */}
      <div className="flex justify-between items-center mb-4 pl-14 h-11">
        <h1 className="text-2xl font-black text-slate-900 leading-none">Amigos</h1>
      </div>

      <div className="relative mb-5">
        <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-500">
          <Search size={18} />
        </span>
        <input
          type="text"
          placeholder="Buscar parceiros..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 pl-10 pr-4 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-red-500/30 transition-all text-sm"
        />
      </div>

      {/* Solicitações de Amizade Recebidas */}
      {solicitacoesRecebidas.length > 0 && (
        <div className="glass p-4 rounded-2xl border border-amber-200 bg-amber-50/20 mb-5 space-y-3">
          <h3 className="text-xs font-bold text-amber-800 uppercase tracking-wider flex items-center gap-1.5">
            <UserPlus size={14} className="text-amber-600" />
            Solicitações de Amizade ({solicitacoesRecebidas.length})
          </h3>
          <div className="space-y-2">
            {solicitacoesRecebidas.map((req) => {
              const remetente = users.find((u) => u.id === req.usuario_id);
              if (!remetente) return null;
              return (
                <div key={req.id} className="flex items-center justify-between bg-white p-3 rounded-xl border border-slate-100 shadow-xs">
                  <div className="flex items-center gap-2.5">
                    {remetente.foto ? (
                      <img src={remetente.foto} alt={remetente.nome} className="w-8 h-8 rounded-full object-cover" />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-slate-800 text-white flex items-center justify-center font-bold text-xs">
                        {remetente.nome.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-slate-800 truncate leading-tight">{remetente.nome}</p>
                      <p className="text-[10px] text-slate-450 truncate">{remetente.email}</p>
                    </div>
                  </div>
                  <div className="flex gap-1.5">
                    <button
                      onClick={() => handleAcceptRequest(req.id)}
                      className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg cursor-pointer transition-all active:scale-95"
                    >
                      Aceitar
                    </button>
                    <button
                      onClick={() => handleRejectRequest(req.id)}
                      className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-650 text-xs font-bold rounded-lg cursor-pointer transition-all active:scale-95"
                    >
                      Recusar
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center items-center h-48">
          <div className="w-8 h-8 border-4 border-red-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filteredUsers.length === 0 ? (
        <div className="text-center py-12 glass rounded-2xl">
          <p className="text-slate-650 text-sm">Nenhum jogador encontrado.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredUsers.map((user) => {
            const isMe = user.id === currentUserId;
            
            // Verifica o relacionamento
            const amizade = amizades.find(
              (a) =>
                (a.usuario_id === currentUserId && a.amigo_id === user.id) ||
                (a.usuario_id === user.id && a.amigo_id === currentUserId)
            );

            const ehAmigo = amizade && amizade.ativo === true;
            const solicitei = amizade && amizade.usuario_id === currentUserId && amizade.ativo === false;
            const recebiSolicitacao = amizade && amizade.amigo_id === currentUserId && amizade.ativo === false;

            return (
              <div
                key={user.id}
                className="glass p-4 rounded-2xl border border-slate-200 flex items-center justify-between shadow-xs animate-fade-in"
              >
                <div className="flex items-center gap-3">
                  {user.foto ? (
                    <img
                      src={user.foto}
                      alt={user.nome}
                      className="w-10 h-10 rounded-full object-cover ring-2 ring-red-500/10"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-slate-800 text-white flex items-center justify-center font-bold text-sm">
                      {user.nome.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div>
                    <h3 className="font-extrabold text-slate-850 text-sm flex items-center gap-1.5">
                      <span>{user.nome}</span>
                      {isMe && (
                        <span className="text-[9px] font-black uppercase bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-md">
                          Você
                        </span>
                      )}
                    </h3>
                    <p className="text-xs text-slate-450 leading-tight">{user.email}</p>
                  </div>
                </div>

                {!isMe && (
                  <div className="flex gap-2 items-center">
                    {(() => {
                      const unreadCount = unreadBySender[user.id] || 0;
                      return (
                        <button
                          onClick={() => navigate(`/mensagens?user=${user.id}`)}
                          className={`relative p-2.5 rounded-xl transition-all border shadow-xs cursor-pointer active:scale-95 ${
                            unreadCount > 0
                              ? 'bg-red-50 hover:bg-red-100 text-red-600 border-red-200'
                              : 'bg-slate-50 hover:bg-slate-200 text-slate-650 border-slate-200'
                          }`}
                          title={`Enviar mensagem para ${user.nome}${unreadCount > 0 ? ` (${unreadCount} nova${unreadCount > 1 ? 's' : ''})` : ''}`}
                        >
                          <MessageSquare size={16} />
                          {unreadCount > 0 && (
                            <span className="absolute -top-1 -right-1 min-w-[16px] h-[16px] bg-red-600 text-white text-[9px] font-black rounded-full flex items-center justify-center px-0.5 shadow-sm animate-pulse">
                              {unreadCount > 9 ? '9+' : unreadCount}
                            </span>
                          )}
                        </button>
                      );
                    })()}

                    {ehAmigo && (
                      <button
                        onClick={() => handleRemoveAmigo(user.id, user.nome)}
                        className="p-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-650 rounded-xl transition-all border border-emerald-250 shadow-xs cursor-pointer"
                        title="Remover Amigo"
                      >
                        <UserCheck size={16} />
                      </button>
                    )}

                    {solicitei && (
                      <button
                        onClick={() => handleRejectRequest(amizade.id)}
                        className="px-2.5 py-2 bg-amber-50 hover:bg-amber-100 hover:text-red-600 text-amber-600 rounded-xl transition-all border border-amber-200 shadow-xs cursor-pointer flex items-center gap-1 text-[10px] font-bold"
                        title="Clique para Cancelar Solicitação"
                      >
                        <Clock size={12} className="animate-spin" />
                        <span>Pendente</span>
                        <X size={10} className="ml-1 opacity-60" />
                      </button>
                    )}

                    {recebiSolicitacao && (
                      <div className="flex gap-1">
                        <button
                          onClick={() => handleAcceptRequest(amizade.id)}
                          className="px-2 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-black rounded-lg cursor-pointer transition-all active:scale-95"
                          title="Aceitar Solicitação"
                        >
                          Aceitar
                        </button>
                        <button
                          onClick={() => handleRejectRequest(amizade.id)}
                          className="px-2 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-650 text-[10px] font-black rounded-lg cursor-pointer transition-all active:scale-95"
                          title="Recusar Solicitação"
                        >
                          Recusar
                        </button>
                      </div>
                    )}

                    {!amizade && (
                      <button
                        onClick={() => handleAddAmigo(user.id, user.nome)}
                        className="p-2.5 bg-red-55/60 hover:bg-red-100 text-red-650 rounded-xl transition-all border border-red-150 shadow-xs cursor-pointer"
                        title="Adicionar Amigo"
                      >
                        <UserPlus size={16} />
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      <Dialog {...dialog} />
    </div>
  );
}
