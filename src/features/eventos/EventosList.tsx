import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import type { Evento } from '../../types';
import { Plus, Trash2, Calendar, MapPin, Search, ChevronRight } from 'lucide-react';
import dayjs from 'dayjs';
import { motion, AnimatePresence } from 'framer-motion';
import Dialog from '../../components/common/Dialog';

export default function EventosList() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const grupoId = searchParams.get('grupo_id');

  const [eventos, setEventos] = useState<Evento[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);
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
    fetchEventos();
  }, [grupoId]);

  const handleAutoFinalizeEvents = async (pastEvents: Evento[]) => {
    try {
      // 1. Obter todos os IDs de usuários registrados no sistema
      const { data: dbUsers } = await supabase.from('usuarios').select('id');
      const registeredUserIds = new Set<string>(dbUsers ? dbUsers.map((u) => u.id) : []);

      // 2. Finalizar cada evento em segundo plano
      for (const ev of pastEvents) {
        await autoFinalizarSingleEvent(ev, registeredUserIds);
      }
    } catch (e) {
      console.error('Erro ao auto-finalizar eventos do passado:', e);
    }
  };

  const autoFinalizarSingleEvent = async (evento: Evento, registeredUserIds: Set<string>) => {
    try {
      const ranked = [...(evento.participantes || [])].sort((a, b) => {
        const vA = a.jogosGanhos || 0;
        const vB = b.jogosGanhos || 0;
        const dA = (a.jogos || 0) - vA;
        const dB = (b.jogos || 0) - vB;
        if (vB !== vA) return vB - vA;
        return dA - dB;
      });

      const numGanhadores = Math.min(6, Math.floor(ranked.length / 3));
      const numPerdedores = numGanhadores;

      const updatedParticipantes = [...(evento.participantes || [])];

      if (evento.grupo_id && evento.modalidade_id) {
        for (let i = 0; i < ranked.length; i++) {
          const p = ranked[i];
          const isCadastrado = registeredUserIds.has(p.id);
          if (!isCadastrado) continue;

          let delta = 0;
          if (i < numGanhadores) {
            delta = 0.5;
          } else if (i >= ranked.length - numPerdedores) {
            delta = -0.5;
          }

          // Buscar o rating atual dele para este grupo e esporte
          const { data: ratingRow } = await supabase
            .from('ratings_jogador')
            .select('rating')
            .eq('usuario_id', p.id)
            .eq('grupo_id', evento.grupo_id)
            .eq('modalidade_id', evento.modalidade_id)
            .maybeSingle();

          let currentRating = ratingRow ? Number(ratingRow.rating) : 3.0;
          let newRating = currentRating + delta;
          newRating = Math.min(5.0, Math.max(1.0, newRating));

          // Upsert no Supabase
          await supabase.from('ratings_jogador').upsert({
            usuario_id: p.id,
            grupo_id: evento.grupo_id,
            modalidade_id: evento.modalidade_id,
            rating: newRating,
          });

          // Atualizar no participante correspondente
          const pIndex = updatedParticipantes.findIndex((part) => part.id === p.id);
          if (pIndex !== -1) {
            updatedParticipantes[pIndex].avaliacao = newRating;
          }
        }
      }

      // Marcar evento como finalizado no Supabase
      const updatedConfig = { ...(evento.configuracao || {}), finalizado: true };
      await supabase
        .from('eventos')
        .update({
          configuracao: updatedConfig,
          participantes: updatedParticipantes,
        })
        .eq('id', evento.id);

      console.log(`Evento ${evento.id} ("${evento.descricao}") encerrado automaticamente.`);
    } catch (e) {
      console.error(`Erro ao processar finalização automática do evento ${evento.id}:`, e);
    }
  };

  const fetchEventos = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      // Buscar perfil do usuário para ter seu ID do banco
      const { data: userData } = await supabase
        .from('usuarios')
        .select('id')
        .eq('email', user.email)
        .single();
      
      const resolvedUserId = userData?.id || user.id;

      let query = supabase.from('eventos').select('*');

      if (grupoId) {
        // Filtro específico vindo da URL/parâmetro
        query = query.eq('grupo_id', grupoId);
      } else {
        // Obter os grupos onde o usuário está aprovado
        const { data: userGroups } = await supabase
          .from('membros_grupo')
          .select('grupo_id')
          .eq('usuario_id', resolvedUserId)
          .eq('status', 'aprovado');

        const groupIds = userGroups ? userGroups.map((g) => g.grupo_id).filter(Boolean) : [];

        if (groupIds.length > 0) {
          // Trazer eventos sem grupo OU vinculados aos grupos do usuário
          query = query.or(`grupo_id.is.null,grupo_id.in.(${JSON.stringify(groupIds).slice(1, -1)})`);
        } else {
          // Apenas eventos públicos/sem grupo
          query = query.is('grupo_id', null);
        }
      }

      const { data, error } = await query.order('data', { ascending: true });

      if (!error && data) {
        const activeEventos = (data as Evento[]).filter(ev => !ev.configuracao?.finalizado);
        
        // Separar eventos ativos de hoje ou do futuro, e eventos do passado não finalizados
        const startOfToday = dayjs().startOf('day');
        
        const todayOrFutureEvents: Evento[] = [];
        const pastActiveEvents: Evento[] = [];

        activeEventos.forEach((ev) => {
          const evDate = dayjs(ev.data);
          if (evDate.isSame(startOfToday, 'day') || evDate.isAfter(startOfToday)) {
            todayOrFutureEvents.push(ev);
          } else {
            pastActiveEvents.push(ev);
          }
        });

        // Set de hoje ou futuros na UI instantaneamente
        setEventos(todayOrFutureEvents);

        // Se houver algum evento ativo do passado, realizar o encerramento em segundo plano!
        if (pastActiveEvents.length > 0) {
          handleAutoFinalizeEvents(pastActiveEvents);
        }
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
        setDialog({
          isOpen: true,
          title: 'Erro',
          message: 'Erro ao excluir evento: ' + error.message,
          type: 'alert',
          onConfirm: () => setDialog((prev) => ({ ...prev, isOpen: false })),
        });
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
    <div className="px-4 py-3 pb-24 w-full max-w-md mx-auto relative min-h-[calc(100vh-8rem)]">
      <div className="flex justify-between items-center mb-4 pl-14 h-11">
        <h1 className="text-2xl font-black text-slate-900 leading-none">Eventos</h1>
        <button
          onClick={() => navigate(grupoId ? `/eventos/novo?grupo_id=${grupoId}` : '/eventos/novo')}
          className="p-2.5 bg-gradient-to-r from-[#eb3237] to-red-650 hover:from-red-500 hover:to-red-600 text-white rounded-xl shadow-lg shadow-[#eb3237]/20 active:scale-95 transition-all cursor-pointer"
          title="Novo Evento"
        >
          <Plus size={18} strokeWidth={2.5} />
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
                      e.stopPropagation();
                      setDialog({
                        isOpen: true,
                        title: 'Excluir Evento',
                        message: 'Tem certeza que deseja excluir permanentemente este evento?',
                        type: 'confirm',
                        onConfirm: () => {
                          setDialog((prev) => ({ ...prev, isOpen: false }));
                          handleDelete(evento.id, e);
                        },
                        onCancel: () => setDialog((prev) => ({ ...prev, isOpen: false })),
                      });
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
      <Dialog {...dialog} />
    </div>
  );
}
