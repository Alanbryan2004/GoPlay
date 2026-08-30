import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import type { Grupo } from '../../types';
import { Plus, Users, Shield, PlusCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function GruposList() {
  const navigate = useNavigate();
  const [grupos, setGrupos] = useState<Grupo[]>([]);
  const [loading, setLoading] = useState(true);
  const [newGrupoName, setNewGrupoName] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    fetchGrupos();
  }, []);

  const fetchGrupos = async () => {
    try {
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
        alert('Erro ao criar grupo: ' + error?.message);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setCreating(false);
    }
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
                  className="flex-1 py-2.5 bg-slate-800 text-slate-700 rounded-xl text-sm"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="flex-1 py-2.5 bg-red-600 hover:bg-red-500 text-white rounded-xl font-bold text-sm flex justify-center items-center"
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
              onClick={() => navigate(`/eventos?grupo_id=${grupo.id}`)}
              className="glass p-5 rounded-2xl border border-slate-200 hover:border-red-600/30 cursor-pointer active:scale-[0.99] transition-all flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-red-600/20 text-red-400 flex items-center justify-center">
                  <Users size={20} />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900">{grupo.nome}</h3>
                  <p className="text-xs text-slate-500">Toque para ver eventos do grupo</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
