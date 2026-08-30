import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import type { Usuario } from '../../types';
import { UserPlus, UserCheck, MessageSquare, Search } from 'lucide-react';
import Dialog from '../../components/common/Dialog';

export default function AmigosList() {
  const [users, setUsers] = useState<Usuario[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string>('');
  const [amizades, setAmizades] = useState<any[]>([]);
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
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleAddAmigo = async (friendId: string) => {
    if (!currentUserId) return;
    try {
      const { data, error } = await supabase
        .from('amigos')
        .insert({
          usuario_id: currentUserId,
          amigo_id: friendId,
          aceito: true,
        })
        .select()
        .single();
      if (!error && data) {
        setAmizades((prev) => [...prev, data]);
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
          }
        } catch (e) {
          console.error(e);
        }
      },
      onCancel: () => setDialog((prev) => ({ ...prev, isOpen: false })),
    });
  };

  const filteredUsers = users.filter((u) =>
    u.nome.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-6 pb-24 w-full max-w-md mx-auto min-h-[calc(100vh-8rem)]">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-extrabold text-slate-900">Amigos</h1>
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
            const ehAmigo = amizades.some(
              (a) =>
                (a.usuario_id === currentUserId && a.amigo_id === user.id) ||
                (a.usuario_id === user.id && a.amigo_id === currentUserId)
            );

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
                  <div className="flex gap-2">
                    <button
                      onClick={() => setDialog({
                        isOpen: true,
                        title: 'Mensagens',
                        message: 'Mensagens diretas estarão disponíveis em breve!',
                        type: 'alert',
                        onConfirm: () => setDialog((prev) => ({ ...prev, isOpen: false })),
                      })}
                      className="p-2.5 bg-slate-50 hover:bg-slate-200 text-slate-650 rounded-xl transition-all border border-slate-200 shadow-xs cursor-pointer"
                      title="Enviar mensagem"
                    >
                      <MessageSquare size={16} />
                    </button>
                    {ehAmigo ? (
                      <button
                        onClick={() => handleRemoveAmigo(user.id, user.nome)}
                        className="p-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-650 rounded-xl transition-all border border-emerald-250 shadow-xs cursor-pointer"
                        title="Remover Amigo"
                      >
                        <UserCheck size={16} />
                      </button>
                    ) : (
                      <button
                        onClick={() => handleAddAmigo(user.id)}
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
