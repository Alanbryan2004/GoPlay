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
  const [showPodium, setShowPodium] = useState(false);
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

  // Autocomplete de usuários
  const [todasPessoas, setTodasPessoas] = useState<any[]>([]);
  const [sugestoes, setSugestoes] = useState<any[]>([]);

  // Buscar evento inicial
  useEffect(() => {
    fetchEvento();
    loadUsuarios();

    async function loadUsuarios() {
      try {
        // 1. Obter o usuário logado
        const { data: { user: authUser } } = await supabase.auth.getUser();
        if (!authUser) return;

        const { data: profile } = await supabase
          .from('usuarios')
          .select('id')
          .eq('email', authUser.email)
          .single();
        
        if (!profile) return;
        const loggedId = profile.id;

        // 2. Buscar amigos ativos
        const { data: dbAmigos } = await supabase
          .from('amigos')
          .select('*')
          .or(`usuario_id.eq.${loggedId},amigo_id.eq.${loggedId}`)
          .eq('ativo', true);

        const friendIds = (dbAmigos || []).map((a) =>
          a.usuario_id === loggedId ? a.amigo_id : a.usuario_id
        );

        // 3. Buscar membros do grupo (se o evento pertencer a um grupo)
        let groupMemberIds: string[] = [];
        const { data: evData } = await supabase
          .from('eventos')
          .select('grupo_id')
          .eq('id', id)
          .single();

        if (evData && evData.grupo_id) {
          const { data: dbMembros } = await supabase
            .from('membros_grupo')
            .select('usuario_id')
            .eq('grupo_id', evData.grupo_id);
          
          if (dbMembros) {
            groupMemberIds = dbMembros.map(m => m.usuario_id);
          }
        }

        // Unir todos os IDs permitidos (eu mesmo + amigos + membros do grupo)
        const allowedIds = Array.from(new Set([loggedId, ...friendIds, ...groupMemberIds]));

        if (allowedIds.length > 0) {
          const { data: allowedUsers, error: usersError } = await supabase
            .from('usuarios')
            .select('id, nome, foto, email')
            .in('id', allowedIds);

          if (!usersError && allowedUsers) {
            setTodasPessoas(allowedUsers);
          }
        } else {
          // Fallback: Eu mesmo
          const { data: selfUser } = await supabase
            .from('usuarios')
            .select('id, nome, foto, email')
            .eq('id', loggedId);
          if (selfUser) {
            setTodasPessoas(selfUser);
          }
        }
      } catch (err) {
        console.error('Erro ao carregar usuários permitidos:', err);
      }
    }

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

  // Adicionar jogador offline (convidado)
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
    setSugestoes([]);
    updateDatabase({ participantes: novosParticipantes });
  };

  // Lógica de digitação e filtragem de cadastrados com suporte a acentos
  const handleInputChange = (value: string) => {
    setNovoNome(value);
    
    // Função auxiliar para remover acentos e deixar em minúsculo
    const normalizeStr = (str: string) =>
      str ? str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase() : '';

    if (value.trim().length >= 2) {
      const normalizedValue = normalizeStr(value);
      const filtered = todasPessoas.filter((u) => {
        const normalizedUserName = normalizeStr(u.nome);
        const matchText = normalizedUserName.includes(normalizedValue);
        const alreadyInList = participantes.some(
          (p) => normalizeStr(p.nome) === normalizedUserName || p.id === u.id
        );
        return matchText && !alreadyInList;
      });
      setSugestoes(filtered.slice(0, 5));
    } else {
      setSugestoes([]);
    }
  };

  // Adicionar jogador a partir do autocomplete (cadastrado)
  const handleSelectSugestao = (user: any) => {
    const novoJogador: Participante = {
      id: user.id, // ID real do usuário no Supabase!
      nome: user.nome,
      foto: user.foto || '',
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
    setSugestoes([]);
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
          setShowPodium(true); // Exibe o Pódio antes de ir embora!
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
      <form onSubmit={handleAddJogador} className="flex gap-2 relative">
        <div className="flex-1 relative">
          <input
            type="text"
            placeholder="Nome do jogador..."
            value={novoNome}
            onChange={(e) => handleInputChange(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/30 placeholder-slate-650"
          />

          {/* Lista de Sugestões Auto-complete */}
          {sugestoes.length > 0 && (
            <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-150 rounded-xl shadow-xl z-50 overflow-hidden max-h-48 overflow-y-auto">
              {sugestoes.map((user) => (
                <button
                  key={user.id}
                  type="button"
                  onClick={() => handleSelectSugestao(user)}
                  className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 transition-colors text-left border-b border-slate-50 last:border-0 cursor-pointer"
                >
                  {user.foto ? (
                    <img src={user.foto} alt={user.nome} className="w-8 h-8 rounded-full object-cover flex-shrink-0 ring-1 ring-slate-200" />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-slate-800 text-white flex items-center justify-center font-bold text-xs flex-shrink-0">
                      {user.nome[0].toUpperCase()}
                    </div>
                  )}
                  <div className="flex flex-col min-w-0">
                    <span className="text-xs font-bold text-slate-800 truncate">{user.nome}</span>
                    <span className="text-[10px] text-slate-450 truncate">{user.email}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
        <button
          type="submit"
          className="p-3 bg-red-600 hover:bg-red-500 text-white rounded-xl active:scale-95 transition-all shadow-md flex-shrink-0 cursor-pointer flex items-center justify-center"
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
            {participantes.map((p, index) => {
              const isCadastrado = todasPessoas.some((u) => u.id === p.id);
              return (
                <div
                  key={p.id}
                  className={`flex justify-between items-center p-3 rounded-xl transition-all ${
                    p.checked ? 'bg-slate-50/80 border border-slate-200 shadow-xs' : 'bg-slate-100/40 border border-slate-150 opacity-40'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <input
                      type="checkbox"
                      checked={p.checked}
                      onChange={() => togglePresenca(index)}
                      className="w-4 h-4 rounded bg-slate-50 border-slate-200 text-red-600 focus:ring-red-500 cursor-pointer flex-shrink-0"
                    />

                    {/* Avatar do Jogador */}
                    {p.foto ? (
                      <img 
                        src={p.foto} 
                        alt={p.nome} 
                        className="w-8 h-8 rounded-full object-cover ring-2 ring-red-500/10 flex-shrink-0" 
                      />
                    ) : isCadastrado ? (
                      <div className="w-8 h-8 rounded-full bg-slate-800 text-white flex items-center justify-center font-bold text-xs ring-2 ring-slate-800/10 flex-shrink-0">
                        {p.nome.charAt(0).toUpperCase()}
                      </div>
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-450 border border-slate-200 flex items-center justify-center font-bold text-xs flex-shrink-0">
                        {p.nome.charAt(0).toUpperCase()}
                      </div>
                    )}

                    {/* Nome e Info */}
                    <div className="flex flex-col min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-bold text-slate-850 truncate">{p.nome}</span>
                        {isCadastrado && (
                          <span 
                            className="inline-flex items-center justify-center bg-emerald-50 text-emerald-600 rounded-full p-0.5" 
                            title="Jogador Cadastrado"
                          >
                            <svg className="w-2.5 h-2.5 fill-current" viewBox="0 0 24 24">
                              <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
                            </svg>
                          </span>
                        )}
                      </div>
                      <span className="text-[9px] text-slate-450 font-medium">
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
            );
          })}
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

      {/* Modal de Pódio/Ranking Final */}
      {showPodium && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-6 animate-fade-in">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl p-6 flex flex-col space-y-4 max-h-[90vh] overflow-y-auto animate-slide-in">
            {/* Header */}
            <div className="text-center">
              <span className="text-2xl">🏆</span>
              <h2 className="text-lg font-black text-slate-900 uppercase mt-1">Ranking Final</h2>
              <p className="text-[10px] font-bold text-slate-450 uppercase tracking-widest">{evento?.descricao}</p>
            </div>

            {/* Render 3D Podium */}
            {(() => {
              const ranked = [...participantes].sort((a, b) => {
                const vA = a.vitorias || 0;
                const vB = b.vitorias || 0;
                const dA = a.derrotas || 0;
                const dB = b.derrotas || 0;
                if (vB !== vA) return vB - vA;
                return dA - dB;
              });
              const p1 = ranked[0];
              const p2 = ranked[1];
              const p3 = ranked[2];
              const rest = ranked.slice(3);

              return (
                <>
                  <div className="flex items-end justify-center gap-3 pt-6 pb-2 min-h-[190px]">
                    {/* 2º Lugar (Esquerda) */}
                    {p2 ? (
                      <div className="flex flex-col items-center flex-1 min-w-0">
                        <div className="relative mb-2">
                          {p2.foto ? (
                            <img src={p2.foto} alt={p2.nome} className="w-12 h-12 rounded-full object-cover border-2 border-slate-300 ring-2 ring-slate-300/25" />
                          ) : (
                            <div className="w-12 h-12 rounded-full bg-slate-200 text-slate-650 flex items-center justify-center font-bold text-sm border-2 border-slate-300">
                              {p2.nome[0]}
                            </div>
                          )}
                          <div className="absolute -top-3 -right-2 bg-slate-300 text-slate-800 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black shadow-sm">2</div>
                        </div>
                        <span className="text-[10px] font-bold text-slate-700 truncate w-full text-center px-1">{p2.nome}</span>
                        <span className="text-[9px] font-semibold text-slate-500">{p2.vitorias} Vit.</span>
                        <div className="w-full bg-gradient-to-t from-slate-100 to-slate-50 border-t border-slate-300 h-12 rounded-t-lg mt-2 flex items-center justify-center">
                          <span className="text-xl">🥈</span>
                        </div>
                      </div>
                    ) : (
                      <div className="flex-1" />
                    )}

                    {/* 1º Lugar (Centro) */}
                    {p1 ? (
                      <div className="flex flex-col items-center flex-1 min-w-0 z-10">
                        <div className="relative mb-2">
                          {p1.foto ? (
                            <img src={p1.foto} alt={p1.nome} className="w-16 h-16 rounded-full object-cover border-4 border-amber-400 ring-4 ring-amber-400/30" />
                          ) : (
                            <div className="w-16 h-16 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center font-black text-xl border-4 border-amber-400">
                              {p1.nome[0]}
                            </div>
                          )}
                          <div className="absolute -top-4 -right-1.5 bg-amber-400 text-slate-900 w-6 h-6 rounded-full flex items-center justify-center text-xs font-black shadow-md">1</div>
                        </div>
                        <span className="text-xs font-black text-slate-950 truncate w-full text-center px-1">{p1.nome}</span>
                        <span className="text-[10px] font-black text-amber-600">{p1.vitorias} Vit.</span>
                        <div className="w-full bg-gradient-to-t from-amber-50 to-amber-100/60 border-t-2 border-amber-400 h-16 rounded-t-xl mt-2 flex items-center justify-center shadow-lg shadow-amber-300/10">
                          <span className="text-2xl">👑</span>
                        </div>
                      </div>
                    ) : (
                      <div className="flex-1" />
                    )}

                    {/* 3º Lugar (Direita) */}
                    {p3 ? (
                      <div className="flex flex-col items-center flex-1 min-w-0">
                        <div className="relative mb-2">
                          {p3.foto ? (
                            <img src={p3.foto} alt={p3.nome} className="w-10 h-10 rounded-full object-cover border-2 border-amber-700 ring-2 ring-amber-700/25" />
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-amber-50 text-amber-900 flex items-center justify-center font-bold text-xs border-2 border-amber-700">
                              {p3.nome[0]}
                            </div>
                          )}
                          <div className="absolute -top-3 -right-2 bg-amber-700 text-white w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black shadow-sm">3</div>
                        </div>
                        <span className="text-[10px] font-bold text-slate-700 truncate w-full text-center px-1">{p3.nome}</span>
                        <span className="text-[9px] font-semibold text-slate-500">{p3.vitorias} Vit.</span>
                        <div className="w-full bg-gradient-to-t from-amber-900/10 to-amber-900/5 border-t border-amber-700 h-8 rounded-t-lg mt-2 flex items-center justify-center">
                          <span className="text-lg">🥉</span>
                        </div>
                      </div>
                    ) : (
                      <div className="flex-1" />
                    )}
                  </div>

                  {/* Restante da Tabela */}
                  {rest.length > 0 && (
                    <div className="bg-slate-50 rounded-xl p-3 max-h-[160px] overflow-y-auto space-y-1.5 border border-slate-100 w-full">
                      {rest.map((player, idx) => (
                        <div key={player.id} className="flex items-center justify-between py-1.5 px-2.5 bg-white rounded-lg border border-slate-100 text-xs">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-400">#{idx + 4}</span>
                            <span className="font-bold text-slate-700">{player.nome}</span>
                          </div>
                          <span className="font-extrabold text-slate-500 text-[10px]">{player.vitorias} vitórias</span>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              );
            })()}

            {/* Botão de Fechar e Voltar para Home */}
            <button
              onClick={() => {
                setShowPodium(false);
                navigate('/');
              }}
              className="w-full py-3 bg-[#eb3237] hover:bg-red-650 text-white font-bold rounded-xl shadow-lg active:scale-95 transition-all text-xs cursor-pointer text-center"
            >
              Confirmar e Ir para a Home
            </button>
          </div>
        </div>
      )}
      <Dialog {...dialog} />
    </div>
  );
}
