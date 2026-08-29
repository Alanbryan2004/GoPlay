import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import type { Evento } from '../../types';
import { Plus, Trash2, Calendar, MapPin, Search, ChevronRight } from 'lucide-react';
import dayjs from 'dayjs';
import { motion, AnimatePresence } from 'framer-motion';

export default function EventosList() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const grupoId = searchParams.get('grupo_id');

  const [eventos, setEventos] = useState<Evento[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    fetchEventos();
  }, [grupoId]);

  const fetchEventos = async () => {
    setLoading(true);
    try {
      let query = supabase.from('eventos').select('*');
      if (grupoId) {
        query = query.eq('grupo_id', grupoId);
      }
      const { data, error } = await query.order('data', { ascending: true });

      if (!error && data) {
        const activeEventos = (data as Evento[]).filter(ev => !ev.configuracao?.finalizado);
        setEventos(activeEventos);
      } else {
        console.error('Error fetching events:', error);
      }
    } catch (e) {
      console.error('Failed to fetch events:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Avoid navigating to details
    setDeletingId(id);

    try {
      const { error } = await supabase.from('eventos').delete().eq('id', id);
      if (!error) {
        setEventos((prev) => prev.filter((ev) => ev.id !== id));
      } else {
        alert('Erro ao excluir evento: ' + error.message);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setDeletingId(null);
    }
  };

  const filteredEventos = eventos.filter((evento) =>
    evento.descricao.toLowerCase().includes(search.toLowerCase()) ||
    evento.local.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-6 pb-24 w-full max-w-md mx-auto relative min-h-[calc(100vh-8rem)]">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-extrabold text-slate-900">Eventos</h1>
        <button
          onClick={() => navigate(grupoId ? `/eventos/novo?grupo_id=${grupoId}` : '/eventos/novo')}
          className="p-3 bg-gradient-to-r from-[#eb3237] to-red-600 hover:from-red-500 hover:to-red-600 text-white rounded-xl shadow-lg shadow-[#eb3237]/20 active:scale-95 transition-all"
          title="Novo Evento"
        >
          <Plus size={20} strokeWidth={2.5} />
        </button>
      </div>

      {/* Barra de Pesquisa */}
      <div className="relative mb-5">
        <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-500">
          <Search size={18} />
        </span>
        <input
          type="text"
          placeholder="Buscar evento ou local..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 pl-10 pr-4 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-red-500/30 transition-all text-sm"
        />
      </div>

      {loading ? (
        <div className="flex justify-center items-center h-48">
          <div className="w-8 h-8 border-4 border-red-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filteredEventos.length === 0 ? (
        <div className="text-center py-12 glass rounded-2xl border border-slate-150">
          <Calendar size={48} className="mx-auto text-slate-600 mb-3" />
          <p className="text-slate-600 font-medium">Nenhum evento encontrado.</p>
          <p className="text-slate-600 text-xs mt-1">Crie um novo evento no botão superior direito!</p>
        </div>
      ) : (
        <div className="space-y-4">
          <AnimatePresence>
            {filteredEventos.map((evento, index) => (
              <motion.div
                key={evento.id}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -50 }}
                transition={{ duration: 0.2, delay: index * 0.05 }}
                onClick={() => navigate(`/eventos/${evento.id}`)}
                className="glass p-5 rounded-2xl border border-slate-200 hover:border-violet-600/30 cursor-pointer active:scale-[0.99] transition-all duration-200 flex items-center justify-between group shadow-md hover:shadow-violet-600/5"
              >
                <div className="space-y-2">
                  <h3 className="font-bold text-slate-900 group-hover:text-red-400 transition-colors text-base">
                    {evento.descricao}
                  </h3>
                  
                  <div className="flex items-center gap-1.5 text-xs text-slate-600">
                    <Calendar size={14} className="text-red-500" />
                    <span>{dayjs(evento.data).format('DD/MM/YYYY [-] HH:mm')}</span>
                  </div>

                  <div className="flex items-center gap-1.5 text-xs text-slate-600">
                    <MapPin size={14} className="text-cyan-500" />
                    <span>{evento.local}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    disabled={deletingId === evento.id}
                    onClick={(e) => {
                      if (confirm('Tem certeza que deseja excluir este evento?')) {
                        handleDelete(evento.id, e);
                      } else {
                        e.stopPropagation();
                      }
                    }}
                    className="p-2 text-slate-500 hover:text-red-400 hover:bg-red-50/80 rounded-xl transition-all"
                    title="Excluir evento"
                  >
                    {deletingId === evento.id ? (
                      <div className="w-4 h-4 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Trash2 size={16} />
                    )}
                  </button>
                  <ChevronRight size={18} className="text-slate-650 group-hover:text-slate-600 transition-colors" />
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
