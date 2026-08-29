import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import type { Evento, Participante, EventoConfig } from '../../types';
import { ActionAfterVictories } from '../../types';
import {
  Settings,
  Trophy,
  UserPlus,
  Trash2,
  Play,
  CheckCircle,
  Plus,
  Minus,
  Sparkles,
  RefreshCw,
  X,
  Star,
  Users,
  AlertCircle,
  ArrowLeft
} from 'lucide-react';
import Dialog from '../../components/common/Dialog';
import {
  sortearTimes,
  construirFilaPrioridades,
  montarTime,
  subirPrioridade,
  getMaxPrioridade
} from '../../utils/sorteioUtils';
import { v4 as uuidv4 } from 'uuid';
import dayjs from 'dayjs';
import { motion, AnimatePresence } from 'framer-motion';

export default function EventoDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [evento, setEvento] = useState<Evento | null>(null);
  const [loading, setLoading] = useState(true);
  const [novoNome, setNovoNome] = useState('');
  const [erro, setErro] = useState<string | null>(null);

  // Estados locais sincronizados
  const [participantes, setParticipantes] = useState<Participante[]>([]);
  const [time1, setTime1] = useState<Participante[]>([]);
  const [time2, setTime2] = useState<Participante[]>([]);
  const [vitoriasTime1, setVitoriasTime1] = useState(0);
  const [vitoriasTime2, setVitoriasTime2] = useState(0);
  const [placarTime1, setPlacarTime1] = useState(0);
  const [placarTime2, setPlacarTime2] = useState(0);
  const [config, setConfig] = useState<EventoConfig>({
    numberOfTeams: 2,
    numberOfPlayers: 6,
    useRating: false,
    maxNumberOfVictories: 3,
    actionAfterVictories: ActionAfterVictories.Mesclar,
  });

  // Estados de modais
  const [showConfig, setShowConfig] = useState(false);
  const [showRanking, setShowRanking] = useState(false);
  const [showDrawResult, setShowDrawResult] = useState(false);
  const [drawTeamsResult, setDrawTeamsResult] = useState<Participante[][]>([]);
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

  // Referência para evitar loop infinito de salvamento
  const skipDbUpdate = useRef(false);

  // Buscar evento inicial
  useEffect(() => {
    fetchEvento();

    // Inscrição Supabase Realtime para sincronização multiplayer
    const channel = supabase
      .channel(`evento-changes-${id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'eventos',
          filter: `id=eq.${id}`,
        },
        (payload: any) => {
          if (payload.new && !skipDbUpdate.current) {
            const ev = payload.new as Evento;
            setEvento(ev);
            setParticipantes(ev.participantes || []);
            setTime1(ev.time1 || []);
            setTime2(ev.time2 || []);
            setVitoriasTime1(ev.vitorias_time1 || 0);
            setVitoriasTime2(ev.vitorias_time2 || 0);
            if (ev.configuracao) setConfig(ev.configuracao);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [id]);

  const fetchEvento = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('eventos')
        .select('*')
        .eq('id', id)
        .single();

      if (!error && data) {
        setEvento(data as Evento);
        setParticipantes(data.participantes || []);
        setTime1(data.time1 || []);
        setTime2(data.time2 || []);
        setVitoriasTime1(data.vitorias_time1 || 0);
        setVitoriasTime2(data.vitorias_time2 || 0);
        if (data.configuracao) setConfig(data.configuracao);
      } else {
        console.error('Error fetching event details:', error);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  // Atualizar banco de dados do Supabase
  const updateDatabase = async (updates: Partial<Evento>) => {
    skipDbUpdate.current = true;
    try {
      await supabase.from('eventos').update(updates).eq('id', id);
    } catch (e) {
      console.error('Database update failed:', e);
    } finally {
      // Pequeno delay para liberar a sincronização local após receber o próprio broadcast
      setTimeout(() => {
        skipDbUpdate.current = false;
      }, 500);
    }
  };

  // Adicionar jogador
  const handleAddJogador = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!novoNome.trim()) return;
    setErro(null);

    const existe = participantes.some(
      (p) => p.nome.toLowerCase() === novoNome.trim().toLowerCase()
    );
    if (existe) {
      setErro('Jogador já está na lista.');
      return;
    }

    const novoJogador: Participante = {
      id: uuidv4(),
      nome: novoNome.trim(),
      checked: true,
      avaliacao: 3,
      prioridade: 0,
      jogos: 0,
      jogosGanhos: 0,
    };

    const novosParticipantes = [...participantes, novoJogador].sort((a, b) =>
      a.nome.localeCompare(b.nome)
    );

    setParticipantes(novosParticipantes);
    setNovoNome('');
    updateDatabase({ participantes: novosParticipantes });
  };

  // Alternar presença
  const togglePresenca = (index: number) => {
    const novos = [...participantes];
    novos[index].checked = !novos[index].checked;
    setParticipantes(novos);
    updateDatabase({ participantes: novos });
  };

  // Atualizar avaliação (Rating)
  const handleRatingChange = (id: string, stars: number) => {
    const novos = participantes.map((p) => {
      if (p.id === id) {
        return { ...p, avaliacao: stars };
      }
      return p;
    });
    setParticipantes(novos);
    updateDatabase({ participantes: novos });
  };

  // Deletar jogador da lista geral do evento
  const handleDeleteJogador = (id: string) => {
    const novos = participantes.filter((p) => p.id !== id);
    setParticipantes(novos);
    updateDatabase({ participantes: novos });
  };

  // Toggle todos os checkboxes
  const toggleSelectAll = (checked: boolean) => {
    const novos = participantes.map((p) => ({ ...p, checked }));
    setParticipantes(novos);
    updateDatabase({ participantes: novos });
  };

  // Sorteio de times inicial
  const handleSortearClick = () => {
    const presentes = participantes.filter((p) => p.checked);
    if (presentes.length < config.numberOfPlayers) {
      setDialog({
        isOpen: true,
        title: 'Aviso',
        message: `Jogadores presentes insuficientes. Mínimo de ${config.numberOfPlayers} jogadores necessários.`,
        type: 'alert',
        onConfirm: () => setDialog((prev) => ({ ...prev, isOpen: false })),
      });
      return;
    }

    const resultado = sortearTimes(presentes, config.numberOfPlayers, config.numberOfTeams);
    setDrawTeamsResult(resultado);
    setShowDrawResult(true);
  };

  // Iniciar partida com os times sorteados
  const handleIniciarJogo = (t1: Participante[], t2: Participante[]) => {
    setTime1(t1);
    setTime2(t2);
    setPlacarTime1(0);
    setPlacarTime2(0);
    setVitoriasTime1(0);
    setVitoriasTime2(0);
    setShowDrawResult(false);

    // Resetar estatísticas de jogos recentes ao iniciar novo sorteio global
    const novosParticipantes = participantes.map((p) => ({
      ...p,
      prioridade: 0,
      jogos: 0,
      jogosGanhos: 0,
    }));
    setParticipantes(novosParticipantes);

    updateDatabase({
      time1: t1,
      time2: t2,
      vitorias_time1: 0,
      vitorias_time2: 0,
      participantes: novosParticipantes,
    });
  };

  // Remover jogador do time atual ativamente (onDeletar)
  // FIX CRÍTICO: Jogadores removidos manualmente agora sobem de prioridade e vão para o fim da fila
  const handleRemoverJogadorDoTimeAtivo = (timeIndex: 1 | 2, jogadorId: string) => {
    const timeAlvo = timeIndex === 1 ? time1 : time2;
    const jogadorRemovido = timeAlvo.find((p) => p.id === jogadorId);

    if (!jogadorRemovido) return;

    // Aumentar a prioridade do jogador na lista global para mandá-lo ao fim da fila
    const novosParticipantes = subirPrioridade(participantes, [jogadorRemovido]);
    setParticipantes(novosParticipantes);

    // Filtrar jogador do time ativo correspondente
    if (timeIndex === 1) {
      const novoTime1 = time1.filter((p) => p.id !== jogadorId);
      setTime1(novoTime1);
      updateDatabase({ time1: novoTime1, participantes: novosParticipantes });
    } else {
      const novoTime2 = time2.filter((p) => p.id !== jogadorId);
      setTime2(novoTime2);
      updateDatabase({ time2: novoTime2, participantes: novosParticipantes });
    }
  };

  // Finalizar Partida
  const handleFinalizarJogo = () => {
    if (placarTime1 === placarTime2) return;

    let novosParticipantes = [...participantes];
    let newVitoriasTime1 = vitoriasTime1;
    let newVitoriasTime2 = vitoriasTime2;

    const time1Venceu = placarTime1 > placarTime2;
    if (time1Venceu) {
      newVitoriasTime1++;
      newVitoriasTime2 = 0;
    } else {
      newVitoriasTime2++;
      newVitoriasTime1 = 0;
    }

    setVitoriasTime1(newVitoriasTime1);
    setVitoriasTime2(newVitoriasTime2);

    const timePerdedor = time1Venceu ? time2 : time1;
    const timeGanhador = time1Venceu ? time1 : time2;
    const todosJogando = [...timeGanhador, ...timePerdedor];

    // Registrar jogos jogados e jogos ganhos
    novosParticipantes = novosParticipantes.map((p) => {
      let jogos = p.jogos || 0;
      let jogosGanhos = p.jogosGanhos || 0;

      if (todosJogando.some((j) => j.id === p.id)) {
        jogos += 1;
      }
      if (timeGanhador.some((j) => j.id === p.id)) {
        jogosGanhos += 1;
      }

      return { ...p, jogos, jogosGanhos };
    });

    // Se o time vencedor atingir o limite de vitórias
    if (
      newVitoriasTime1 === config.maxNumberOfVictories ||
      newVitoriasTime2 === config.maxNumberOfVictories
    ) {
      if (config.actionAfterVictories === ActionAfterVictories.Remover) {
        // Remover: ambos os times vão para o fim da fila de prioridade
        // Subir prioridade do perdedor primeiro, depois do ganhador
        novosParticipantes = subirPrioridade(novosParticipantes, timePerdedor);
        novosParticipantes = subirPrioridade(novosParticipantes, timeGanhador);

        // Sortear dois novos times da fila
        let todosAguardando = novosParticipantes.filter((p) => p.checked);
        let fila = construirFilaPrioridades(todosAguardando);
        
        const novoTime1 = montarTime(fila, config.numberOfPlayers, novosParticipantes);
        
        todosAguardando = todosAguardando.filter((p) => !novoTime1.some((nt) => nt.id === p.id));
        fila = construirFilaPrioridades(todosAguardando);
        const novoTime2 = montarTime(fila, config.numberOfPlayers, novosParticipantes);

        novoTime1.sort((a, b) => a.nome.localeCompare(b.nome));
        novoTime2.sort((a, b) => a.nome.localeCompare(b.nome));

        setTime1(novoTime1);
        setTime2(novoTime2);
        setPlacarTime1(0);
        setPlacarTime2(0);
        setVitoriasTime1(0);
        setVitoriasTime2(0);
        setParticipantes(novosParticipantes);

        updateDatabase({
          time1: novoTime1,
          time2: novoTime2,
          vitorias_time1: 0,
          vitorias_time2: 0,
          participantes: novosParticipantes,
        });
        return;
      }
    }

    // Caso padrão: Apenas o time perdedor vai para a fila
    novosParticipantes = subirPrioridade(novosParticipantes, timePerdedor);

    // Obter os próximos jogadores da fila para compor o próximo time
    let todosAguardando = novosParticipantes.filter(
      (p) => p.checked && !todosJogando.some((tj) => tj.id === p.id)
    );

    // Se não houver jogadores aguardando suficientes, incluir os perdedores que acabaram de ir para a fila
    if (todosAguardando.length < config.numberOfPlayers) {
      todosAguardando = novosParticipantes.filter(
        (p) => p.checked && !timeGanhador.some((tg) => tg.id === p.id)
      );
    }

    const fila = construirFilaPrioridades(todosAguardando);
    const novoTime = montarTime(fila, config.numberOfPlayers, novosParticipantes);
    novoTime.sort((a, b) => a.nome.localeCompare(b.nome));

    // Se atingiu o limite de vitórias e a ação for Mesclar (Misturar vencedor com a fila)
    if (
      (newVitoriasTime1 === config.maxNumberOfVictories ||
        newVitoriasTime2 === config.maxNumberOfVictories) &&
      config.actionAfterVictories === ActionAfterVictories.Mesclar
    ) {
      const misturarFila = [...timeGanhador, ...novoTime];
      const novosTimesSorteados = sortearTimes(misturarFila, config.numberOfPlayers, config.numberOfTeams);
      
      const t1 = novosTimesSorteados[0];
      const t2 = novosTimesSorteados[1];

      setTime1(t1);
      setTime2(t2);
      setPlacarTime1(0);
      setPlacarTime2(0);
      setVitoriasTime1(0);
      setVitoriasTime2(0);
      setParticipantes(novosParticipantes);

      updateDatabase({
        time1: t1,
        time2: t2,
        vitorias_time1: 0,
        vitorias_time2: 0,
        participantes: novosParticipantes,
      });
    } else {
      // Jogo padrão: Mantém o vencedor e entra o novo time
      if (time1Venceu) {
        setTime2(novoTime);
        setPlacarTime1(0);
        setPlacarTime2(0);
        setParticipantes(novosParticipantes);
        updateDatabase({
          time2: novoTime,
          vitorias_time1: newVitoriasTime1,
          vitorias_time2: 0,
          participantes: novosParticipantes,
        });
      } else {
        setTime1(novoTime);
        setPlacarTime1(0);
        setPlacarTime2(0);
        setParticipantes(novosParticipantes);
        updateDatabase({
          time1: novoTime,
          vitorias_time1: 0,
          vitorias_time2: newVitoriasTime2,
          participantes: novosParticipantes,
        });
      }
    }
  };

  // Salvar configurações
  const handleSaveConfig = () => {
    updateDatabase({ configuracao: config });
    setShowConfig(false);
  };

  // Finalizar e arquivar o evento mantendo estatísticas
  const handleFinalizarEvento = () => {
    setDialog({
      isOpen: true,
      title: 'Encerrar Evento',
      message: 'Deseja realmente finalizar este evento? Ele será marcado como concluído e os dados de classificação (Ranking) serão consolidados permanentemente.',
      type: 'confirm',
      onConfirm: async () => {
        setDialog((prev) => ({ ...prev, isOpen: false }));
        try {
          const updatedConfig = { ...config, finalizado: true };
          const { error } = await supabase
            .from('eventos')
            .update({ configuracao: updatedConfig })
            .eq('id', id);
          if (error) throw error;
          
          setShowConfig(false);
          navigate('/'); // Voltar para a Dashboard inicial
        } catch (err: any) {
          setDialog({
            isOpen: true,
            title: 'Erro',
            message: 'Erro ao finalizar evento: ' + err.message,
            type: 'alert',
            onConfirm: () => setDialog((prev) => ({ ...prev, isOpen: false })),
          });
        }
      },
      onCancel: () => setDialog((prev) => ({ ...prev, isOpen: false })),
    });
  };

  // Obter jogadores na fila (Presentes que não estão no Time 1 nem no Time 2)
  const jogadoresFila = participantes.filter(
    (p) => p.checked && !time1.some((t) => t.id === p.id) && !time2.some((t) => t.id === p.id)
  );

  // Ordenar fila usando a prioridade real
  const filaOrdenada = construirFilaPrioridades(jogadoresFila).flat();

  // NOVO REQUISITO: Estimar o "Próximo Time" que vai jogar
  // É calculado de forma reativa a partir dos primeiros da fila
  const estimadoProximoTime = montarTime(
    construirFilaPrioridades(jogadoresFila),
    config.numberOfPlayers,
    participantes
  );

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[calc(100vh-8rem)]">
        <div className="w-8 h-8 border-4 border-red-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!evento) {
    return (
      <div className="p-6 text-center">
        <AlertCircle size={40} className="mx-auto text-red-500 mb-2" />
        <p className="text-slate-600">Evento não encontrado.</p>
        <button onClick={() => navigate('/eventos')} className="mt-4 text-red-400 font-bold underline">
          Voltar para Eventos
        </button>
      </div>
    );
  }

  const isJogoAtivo = time1.length > 0 || time2.length > 0;

  return (
    <div className="p-6 pb-28 w-full max-w-md mx-auto space-y-6">
      {/* Informações Básicas do Evento */}
      <div className="flex justify-between items-start gap-2">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="p-2 rounded-lg bg-slate-50 hover:bg-slate-200 text-slate-700 transition-colors border border-slate-200 cursor-pointer flex-shrink-0"
            title="Voltar"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="text-2xl font-black text-slate-900 leading-tight">{evento.descricao}</h1>
            <p className="text-xs text-slate-450 mt-1">
              {evento.local} • {dayjs(evento.data).format('DD/MM/YYYY [-] HH:mm')}
            </p>
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => setShowRanking(true)}
            className="p-2.5 bg-slate-50 border border-slate-200 hover:bg-slate-200 text-yellow-500 rounded-xl transition-all shadow-md"
            title="Ver classificação"
          >
            <Trophy size={18} />
          </button>
          <button
            onClick={() => setShowConfig(true)}
            className="p-2.5 bg-slate-50 border border-slate-200 hover:bg-slate-200 text-slate-600 rounded-xl transition-all shadow-md"
            title="Configurações do evento"
          >
            <Settings size={18} />
          </button>
        </div>
      </div>

      {/* PAINEL DE JOGO ATIVO */}
      {isJogoAtivo && (
        <div className="glass p-5 rounded-2xl border border-slate-200 shadow-xl space-y-5 relative overflow-hidden">
          {/* Fundo decorativo sutil com efeito gradiente de partida ativa */}
          <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-red-500 via-fuchsia-500 to-cyan-500" />
          
          <h2 className="text-center font-black text-xs uppercase tracking-widest text-red-400">
            Partida Ativa
          </h2>

          <div className="grid grid-cols-5 items-center">
            {/* Time 1 */}
            <div className="col-span-2 text-center space-y-3">
              <span className="font-black text-sm text-red-700 block">Time A</span>
              <div className="flex justify-center items-center gap-1">
                <button
                  onClick={() => setPlacarTime1((p) => Math.max(0, p - 1))}
                  className="p-1.5 rounded-lg bg-slate-50 text-slate-450 active:scale-90"
                >
                  <Minus size={14} />
                </button>
                <div className="w-12 h-12 rounded-xl bg-red-950/40 border border-violet-800/40 flex items-center justify-center text-xl font-black text-red-900">
                  {placarTime1}
                </div>
                <button
                  onClick={() => setPlacarTime1((p) => p + 1)}
                  className="p-1.5 rounded-lg bg-slate-50 text-slate-450 active:scale-90"
                >
                  <Plus size={14} />
                </button>
              </div>
              <p className="text-[10px] text-slate-500">Vitórias: {vitoriasTime1}</p>
            </div>

            {/* Divisor X */}
            <div className="text-center font-black text-slate-700 text-lg">X</div>

            {/* Time 2 */}
            <div className="col-span-2 text-center space-y-3">
              <span className="font-black text-sm text-blue-700 block">Time B</span>
              <div className="flex justify-center items-center gap-1">
                <button
                  onClick={() => setPlacarTime2((p) => Math.max(0, p - 1))}
                  className="p-1.5 rounded-lg bg-slate-50 text-slate-450 active:scale-90"
                >
                  <Minus size={14} />
                </button>
                <div className="w-12 h-12 rounded-xl bg-blue-950/20 border border-blue-200 flex items-center justify-center text-xl font-black text-blue-900">
                  {placarTime2}
                </div>
                <button
                  onClick={() => setPlacarTime2((p) => p + 1)}
                  className="p-1.5 rounded-lg bg-slate-50 text-slate-450 active:scale-90"
                >
                  <Plus size={14} />
                </button>
              </div>
              <p className="text-[10px] text-slate-500">Vitórias: {vitoriasTime2}</p>
            </div>
          </div>

          {/* Listagem de Jogadores dos Times */}
          <div className="grid grid-cols-2 gap-4 text-left">
            {/* Jogadores Time 1 */}
            <div className="space-y-1.5 p-3 rounded-xl bg-red-50 border border-red-200">
              {time1.map((p) => (
                <div key={p.id} className="flex justify-between items-center group/item">
                  <span className="text-xs font-semibold text-red-700 truncate pr-1">
                    {p.nome} <span className="text-[10px] text-slate-500">[{p.jogos || 0}]</span>
                  </span>
                  <button
                    onClick={() => handleRemoverJogadorDoTimeAtivo(1, p.id)}
                    className="opacity-0 group-hover/item:opacity-100 p-0.5 hover:text-red-400 transition-all text-slate-650"
                    title="Remover e mandar pra fila"
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>

            {/* Jogadores Time 2 */}
            <div className="space-y-1.5 p-3 rounded-xl bg-blue-50 border border-blue-200">
              {time2.map((p) => (
                <div key={p.id} className="flex justify-between items-center group/item">
                  <span className="text-xs font-semibold text-blue-700 truncate pr-1">
                    {p.nome} <span className="text-[10px] text-slate-500">[{p.jogos || 0}]</span>
                  </span>
                  <button
                    onClick={() => handleRemoverJogadorDoTimeAtivo(2, p.id)}
                    className="opacity-0 group-hover/item:opacity-100 p-0.5 hover:text-red-400 transition-all text-slate-650"
                    title="Remover e mandar pra fila"
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <button
            onClick={handleFinalizarJogo}
            disabled={placarTime1 === placarTime2}
            className="w-full py-3 bg-gradient-to-r from-red-600 to-red-750 hover:from-red-600 hover:to-indigo-600 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold rounded-xl shadow-lg active:scale-98 transition-all text-xs flex justify-center items-center gap-1.5"
          >
            <CheckCircle size={16} />
            <span>Finalizar Partida</span>
          </button>
        </div>
      )}

      {/* EXIBIÇÃO ESTIMADA DO PRÓXIMO TIME */}
      {isJogoAtivo && estimadoProximoTime.length > 0 && (
        <div className="glass p-4 rounded-xl border border-slate-150 space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-[11px] font-black uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <Sparkles size={12} className="text-red-400" />
              Estimativa do Próximo Time
            </span>
            <span className="text-[10px] text-slate-500">
              Aguardando: {jogadoresFila.length}
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {estimadoProximoTime.map((p) => (
              <span
                key={p.id}
                className="px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-700"
              >
                {p.nome} <span className="text-[9px] text-slate-500 font-normal">({p.prioridade})</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ADICIONAR JOGADOR AO EVENTO */}
      <form onSubmit={handleAddJogador} className="flex gap-2">
        <input
          type="text"
          placeholder="Nome do jogador..."
          value={novoNome}
          onChange={(e) => setNovoNome(e.target.value)}
          className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/30 placeholder-slate-600"
        />
        <button
          type="submit"
          className="p-3 bg-red-600 hover:bg-red-500 text-white rounded-xl active:scale-95 transition-all shadow-md"
        >
          <UserPlus size={18} />
        </button>
      </form>

      {/* LISTA GERAL DE JOGADORES PRESENTES/FILA */}
      <div className="glass p-5 rounded-2xl border border-slate-200 space-y-4">
        <div className="flex justify-between items-center border-b border-slate-200 pb-3">
          <span className="font-bold text-slate-800 text-sm">
            Jogadores ({participantes.length})
          </span>
          <div className="flex items-center gap-1 text-xs text-slate-600 font-semibold">
            <span>Todos:</span>
            <input
              type="checkbox"
              checked={participantes.length > 0 && participantes.every((p) => p.checked)}
              onChange={(e) => toggleSelectAll(e.target.checked)}
              className="w-4 h-4 rounded bg-slate-50 border-slate-200 text-red-600 focus:ring-red-500/50"
            />
          </div>
        </div>

        {participantes.length === 0 ? (
          <p className="text-center text-slate-600 text-sm py-4">Nenhum jogador na lista. Adicione acima!</p>
        ) : (
          <div className="space-y-3 max-h-72 overflow-y-auto no-scrollbar pr-1">
            {participantes.map((p, index) => (
              <div
                key={p.id}
                className={`flex justify-between items-center p-3 rounded-xl transition-all ${
                  p.checked ? 'bg-slate-50/80 border border-slate-200' : 'bg-slate-100/40 border border-slate-950 opacity-40'
                }`}
              >
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={p.checked}
                    onChange={() => togglePresenca(index)}
                    className="w-4 h-4 rounded bg-slate-50 border-slate-200 text-red-600 focus:ring-red-500"
                  />
                  <div>
                    <span className="text-sm font-bold text-slate-800 block leading-tight">{p.nome}</span>
                    <span className="text-[10px] text-slate-500">
                      Jogos: {p.jogos || 0} • Prio: {p.prioridade || 0}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {config.useRating && (
                    <div className="flex gap-0.5 text-amber-500">
                      {[1, 2, 3, 4, 5].map((stars) => (
                        <button
                          key={stars}
                          type="button"
                          onClick={() => handleRatingChange(p.id, stars)}
                        >
                          <Star
                            size={12}
                            className={stars <= p.avaliacao ? 'fill-amber-500' : 'text-slate-700'}
                          />
                        </button>
                      ))}
                    </div>
                  )}
                  <button
                    onClick={() => handleDeleteJogador(p.id)}
                    className="p-1 hover:text-red-400 text-slate-650 transition-colors"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* CONTROLE DE SUL SELEÇÃO E SORTEIO */}
        <div className="flex justify-between items-center text-xs text-slate-450 pt-2">
          <span>Presentes: {participantes.filter((p) => p.checked).length}</span>
          {!isJogoAtivo && (
            <button
              onClick={handleSortearClick}
              className="px-4 py-2.5 bg-gradient-to-r from-red-600 to-red-750 hover:from-red-600 hover:to-indigo-600 text-white font-bold rounded-xl shadow-md flex items-center gap-1 shadow-red-900/10 active:scale-95 transition-all text-xs"
            >
              <Play size={12} className="fill-white" />
              <span>Sortear</span>
            </button>
          )}
        </div>
      </div>

      {/* FILA DE ESPERA COMPLETA (Se houver jogo ativo) */}
      {isJogoAtivo && filaOrdenada.length > 0 && (
        <div className="glass p-5 rounded-2xl border border-slate-200 space-y-3">
          <h3 className="font-bold text-slate-800 text-sm border-b border-slate-200 pb-2 flex items-center gap-2">
            <Users size={16} className="text-red-400" />
            Fila de Espera ({filaOrdenada.length})
          </h3>
          <div className="space-y-2 max-h-40 overflow-y-auto no-scrollbar">
            {filaOrdenada.map((jogador, idx) => (
              <div
                key={jogador.id}
                className="flex justify-between items-center p-2 rounded-lg bg-slate-100/55 text-xs border border-slate-150/50"
              >
                <span className="font-bold text-slate-600">
                  {idx + 1}. {jogador.nome}{' '}
                  <span className="text-[10px] text-slate-500 font-normal">[{jogador.jogos || 0}]</span>
                </span>
                <span className="text-[10px] text-slate-500 bg-slate-50 px-1.5 py-0.5 rounded font-mono">
                  Prio: {jogador.prioridade || 0}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* MODAL CONFIGURAÇÃO */}
      {showConfig && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass p-6 rounded-2xl w-full max-w-sm space-y-4">
            <div className="flex justify-between items-center border-b border-slate-200 pb-3">
              <h2 className="text-xl font-bold text-slate-900">Configurações</h2>
              <button onClick={() => setShowConfig(false)} className="text-slate-500 hover:text-slate-700">
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4 text-left">
              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">
                  Número de Jogadores por Time: {config.numberOfPlayers}
                </label>
                <input
                  type="range"
                  min="2"
                  max="15"
                  value={config.numberOfPlayers}
                  onChange={(e) => setConfig({ ...config, numberOfPlayers: parseInt(e.target.value) })}
                  className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-red-650"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">
                  Limite de Vitórias Consecutivas: {config.maxNumberOfVictories}
                </label>
                <input
                  type="range"
                  min="1"
                  max="10"
                  value={config.maxNumberOfVictories}
                  onChange={(e) => setConfig({ ...config, maxNumberOfVictories: parseInt(e.target.value) })}
                  className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-red-650"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">
                  Ação ao Atingir Limite de Vitórias
                </label>
                <div className="grid grid-cols-2 gap-2 mt-1">
                  <button
                    type="button"
                    onClick={() => setConfig({ ...config, actionAfterVictories: ActionAfterVictories.Mesclar })}
                    className={`py-2 px-3 rounded-lg border text-xs font-bold transition-all ${
                      config.actionAfterVictories === ActionAfterVictories.Mesclar
                        ? 'bg-red-600 border-red-500 text-white'
                        : 'bg-slate-50 border-slate-200 text-slate-600'
                    }`}
                  >
                    Mesclar
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfig({ ...config, actionAfterVictories: ActionAfterVictories.Remover })}
                    className={`py-2 px-3 rounded-lg border text-xs font-bold transition-all ${
                      config.actionAfterVictories === ActionAfterVictories.Remover
                        ? 'bg-red-600 border-red-500 text-white'
                        : 'bg-slate-50 border-slate-200 text-slate-600'
                    }`}
                  >
                    Remover Ambos
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-200">
                <span className="text-xs font-bold text-slate-600">Equilibrar por Avaliação (Rating)</span>
                <input
                  type="checkbox"
                  checked={config.useRating}
                  onChange={(e) => setConfig({ ...config, useRating: e.target.checked })}
                  className="w-4 h-4 rounded text-red-600 bg-slate-800 border-slate-700"
                />
              </div>
            </div>

            <button
              onClick={handleSaveConfig}
              className="w-full py-3 bg-gradient-to-r from-[#eb3237] to-red-650 hover:from-red-500 hover:to-red-600 text-white font-bold rounded-xl shadow-lg active:scale-95 transition-all text-xs cursor-pointer"
            >
              Salvar
            </button>
            <button
              onClick={handleFinalizarEvento}
              className="w-full py-3 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 font-bold rounded-xl active:scale-95 transition-all text-xs mt-2 flex justify-center items-center gap-1.5 cursor-pointer"
            >
              <CheckCircle size={14} />
              <span>Encerrar Evento</span>
            </button>
          </div>
        </div>
      )}

      {/* MODAL CLASSIFICAÇÃO / RANKING DE VITÓRIAS */}
      {showRanking && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass p-6 rounded-2xl w-full max-w-sm space-y-4">
            <div className="flex justify-between items-center border-b border-slate-200 pb-3">
              <h2 className="text-xl font-bold text-slate-900 flex items-center gap-1.5">
                <Trophy size={20} className="text-yellow-500 fill-yellow-500" />
                Vitórias no Evento
              </h2>
              <button onClick={() => setShowRanking(false)} className="text-slate-500 hover:text-slate-700">
                <X size={20} />
              </button>
            </div>

            <div className="space-y-2 max-h-72 overflow-y-auto pr-1 no-scrollbar text-left">
              {[...participantes]
                .sort((a, b) => (b.jogosGanhos || 0) - (a.jogosGanhos || 0))
                .map((player, idx) => (
                  <div
                    key={player.id}
                    className="flex justify-between items-center p-3 bg-slate-50/80 border border-slate-200 rounded-xl"
                  >
                    <span className="font-bold text-sm text-slate-700">
                      {idx + 1}. {player.nome}
                    </span>
                    <div className="text-right">
                      <span className="font-black text-red-400 text-sm">{player.jogosGanhos || 0}</span>
                      <p className="text-[9px] text-slate-500 uppercase tracking-widest leading-none">Vitórias</p>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}

      {/* MODAL RESULTADO DO SORTEIO INICIAL */}
      {showDrawResult && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="glass p-6 rounded-2xl w-full max-w-sm space-y-5 my-8">
            <div className="flex justify-between items-center border-b border-slate-200 pb-3">
              <h2 className="text-xl font-bold text-slate-900 flex items-center gap-1.5">
                <Sparkles size={20} className="text-red-400" />
                Resultado do Sorteio
              </h2>
              <button onClick={() => setShowDrawResult(false)} className="text-slate-500 hover:text-slate-700">
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4 text-left">
              {/* Exibir Time 1 */}
              <div className="p-4 bg-red-50/80 border border-red-200 rounded-xl space-y-2">
                <h3 className="text-xs font-black text-red-400 uppercase tracking-wider">
                  Time A ({drawTeamsResult[0]?.reduce((acc, c) => acc + c.avaliacao, 0) || 0} pts)
                </h3>
                <div className="space-y-1">
                  {drawTeamsResult[0]?.map((p) => (
                    <div key={p.id} className="text-sm font-semibold text-slate-800">
                      • {p.nome} {config.useRating && ` (${p.avaliacao}★)`}
                    </div>
                  ))}
                </div>
              </div>

              {/* Exibir Time 2 */}
              <div className="p-4 bg-cyan-950/20 border border-cyan-850/50 rounded-xl space-y-2">
                <h3 className="text-xs font-black text-cyan-400 uppercase tracking-wider">
                  Time B ({drawTeamsResult[1]?.reduce((acc, c) => acc + c.avaliacao, 0) || 0} pts)
                </h3>
                <div className="space-y-1">
                  {drawTeamsResult[1]?.map((p) => (
                    <div key={p.id} className="text-sm font-semibold text-slate-800">
                      • {p.nome} {config.useRating && ` (${p.avaliacao}★)`}
                    </div>
                  ))}
                </div>
              </div>

              {/* Exibir Excedentes / Fila (Corrigido para "Próximos" no título) */}
              {drawTeamsResult[2] && drawTeamsResult[2].length > 0 && (
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                  <h3 className="text-xs font-black text-slate-600 uppercase tracking-wider">
                    Próximos (Fila de Espera)
                  </h3>
                  <div className="space-y-1">
                    {drawTeamsResult[2].map((p) => (
                      <div key={p.id} className="text-sm font-medium text-slate-600">
                        • {p.nome}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setShowDrawResult(false)}
                className="flex-1 py-3 bg-slate-800 hover:bg-slate-300 text-slate-600 rounded-xl font-bold text-xs"
              >
                Fechar
              </button>
              <button
                type="button"
                onClick={() => handleIniciarJogo(drawTeamsResult[0], drawTeamsResult[1])}
                className="flex-1 py-3 bg-gradient-to-r from-[#eb3237] to-red-650 hover:from-red-500 hover:to-red-600 text-white font-bold rounded-xl shadow-lg shadow-red-650/10 text-xs"
              >
                Iniciar Partida
              </button>
            </div>
          </div>
        </div>
      )}
      <Dialog {...dialog} />
    </div>
  );
}
