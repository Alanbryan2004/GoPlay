import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import type { Usuario } from '../../types';
import { UserPlus, UserCheck, MessageSquare, Search } from 'lucide-react';

export default function AmigosList() {
  const [users, setUsers] = useState<Usuario[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const { data, error } = await supabase.from('usuarios').select('*');
      if (!error && data) {
        setUsers(data as Usuario[]);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
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
          placeholder="Buscar novos parceiros..."
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
          <p className="text-slate-600">Nenhum jogador encontrado.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredUsers.map((user) => (
            <div
              key={user.id}
              className="glass p-4 rounded-xl border border-slate-200 flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                {user.foto ? (
                  <img
                    src={user.foto}
                    alt={user.nome}
                    className="w-10 h-10 rounded-full object-cover ring-1 ring-slate-800"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-slate-800 text-slate-600 flex items-center justify-center font-bold">
                    {user.nome.charAt(0).toUpperCase()}
                  </div>
                )}
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">{user.nome}</h3>
                  <p className="text-xs text-slate-500">{user.email}</p>
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => alert('Conversas serão ativadas em breve!')}
                  className="p-2 bg-slate-800 hover:bg-slate-300 text-slate-700 rounded-lg transition-all"
                  title="Enviar mensagem"
                >
                  <MessageSquare size={16} />
                </button>
                <button
                  className="p-2 bg-red-600/20 text-red-400 hover:bg-red-600/30 rounded-lg transition-all"
                  title="Conectar"
                >
                  <UserCheck size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
