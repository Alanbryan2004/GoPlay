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
  ArrowLeft,
  Share2,
  Skull,
  Crown,
  Link2,
  History
} from 'lucide-react';
import Dialog from '../../components/common/Dialog';
import {
  sortearTimes,
  subirPrioridade,
  selecionarProximosJogadores
} from '../../utils/sorteioUtils';
import { v4 as uuidv4 } from 'uuid';
import dayjs from 'dayjs';
import { motion, AnimatePresence } from 'framer-motion';
import { verificarPermissaoGrupo } from '../../utils/permissoesGrupo';

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
  const [isDrawing, setIsDrawing] = useState(false);
  const [shuffleName, setShuffleName] = useState('');
  const [showPodium, setShowPodium] = useState(false);
  const [podiumStep, setPodiumStep] = useState<1 | 2>(1);
  const [showSubstituirModal, setShowSubstituirModal] = useState(false);
  const [substituirTarget, setSubstituirTarget] = useState<{ timeIndex: 1 | 2; slotIndex: number } | null>(null);
  const [currentUserProfile, setCurrentUserProfile] = useState<any | null>(null);
  const [meusGruposDisponiveis, setMeusGruposDisponiveis] = useState<{ id: string; nome: string }[]>([]);
  const [selectedGrupoId, setSelectedGrupoId] = useState<string | null>(null);
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

  // Toast de atualização remota
  const [remoteUpdateToast, setRemoteUpdateToast] = useState<string | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showRemoteToast = (msg: string) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setRemoteUpdateToast(msg);
    toastTimerRef.current = setTimeout(() => setRemoteUpdateToast(null), 3500);
  };

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
          .select('id, nome, foto, email')
          .eq('email', authUser.email)
          .single();

        if (!profile) return;
        setCurrentUserProfile(profile);
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

        // 3. Buscar membros aprovados de TODOS os grupos que o usuário logado participa
        // (independente de o evento ter grupo_id ou não)
        let groupMemberIds: string[] = [];

        const { data: meusGrupos } = await supabase
          .from('membros_grupo')
          .select('grupo_id, grupos(id, nome)')
          .eq('usuario_id', loggedId)
          .eq('status', 'aprovado');

        if (meusGrupos && meusGrupos.length > 0) {
          const parsedGrupos = meusGrupos
            .map((mg: any) => mg.grupos)
            .filter(Boolean) as { id: string; nome: string }[];
          setMeusGruposDisponiveis(parsedGrupos);

          const grupoIds = meusGrupos.map((mg) => mg.grupo_id);

          const { data: dbMembros } = await supabase
            .from('membros_grupo')
            .select('usuario_id')
            .in('grupo_id', grupoIds)
            .eq('status', 'aprovado');

          if (dbMembros) {
            groupMemberIds = dbMembros.map((m) => m.usuario_id);
          }
        } else {
          // Fallback: se não achou grupos por status aprovado, tenta pelo grupo_id do evento
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
              groupMemberIds = dbMembros.map((m) => m.usuario_id);
            }
          }
        }

        // Unir todos os IDs permitidos (eu mesmo + amigos + membros dos grupos)
        let allowedIds = Array.from(new Set([loggedId, ...friendIds, ...groupMemberIds]));

        // Se o evento for de uma comunidade, adicionar todos os membros aprovados dos grupos da comunidade
        try {
          const { data: evWithConfig } = await supabase
            .from('eventos')
            .select('configuracao')
            .eq('id', id)
            .single();

          const comunidadeId = (evWithConfig?.configuracao as any)?.comunidade_id;
          if (comunidadeId) {
            const { data: cgRows } = await supabase
              .from('comunidade_grupos')
              .select('grupo_id')
              .eq('comunidade_id', comunidadeId);

            if (cgRows && cgRows.length > 0) {
              const cgIds = cgRows.map((cg: any) => cg.grupo_id);
              const { data: comMembros } = await supabase
                .from('membros_grupo')
                .select('usuario_id')
                .in('grupo_id', cgIds)
                .eq('status', 'aprovado');

              if (comMembros) {
                const comMemberIds = comMembros.map((m: any) => m.usuario_id);
                allowedIds = Array.from(new Set([...allowedIds, ...comMemberIds]));
              }
            }
          }
        } catch (e) {
          console.warn('Aviso: não foi possível carregar membros da comunidade:', e);
        }

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
        async (payload: any) => {
          if (payload.new) {
            const ev = payload.new as Evento;

            // Se a atualização foi feita por outro usuário (não eu), mostrar toast
            if (!skipDbUpdate.current) {
              const ultimoSorteio = (ev.configuracao as any)?.ultimo_sorteio;
              if (ultimoSorteio?.usuario_nome) {
                showRemoteToast(`🔄 ${ultimoSorteio.usuario_nome} atualizou o evento`);
              } else {
                showRemoteToast('🔄 Evento atualizado por outro usuário');
              }
            }

            // Só aplicar se não foi eu quem atualizou (evitar loop/piscar)
            if (!skipDbUpdate.current) {
              setEvento(ev);

              let loadedParticipantes = ev.participantes || [];
              if (!ev.configuracao?.finalizado && ev.grupo_id && ev.modalidade_id && loadedParticipantes.length > 0) {
                try {
                  const { data: dbRatings } = await supabase
                    .from('ratings_jogador')
                    .select('usuario_id, rating')
                    .eq('grupo_id', ev.grupo_id)
                    .eq('modalidade_id', ev.modalidade_id);

                  if (dbRatings) {
                    loadedParticipantes = loadedParticipantes.map((p: any) => {
                      const rRow = dbRatings.find((r) => r.usuario_id === p.id);
                      if (rRow) {
                        return { ...p, avaliacao: Number(rRow.rating) };
                      }
                      return p;
                    });
                  }
                } catch (e) {
                  console.error('Erro ao sincronizar estrelas dos participantes via realtime:', e);
                }
              }

              setParticipantes(loadedParticipantes);
              setTime1(ev.time1 || []);
              setTime2(ev.time2 || []);
              setVitoriasTime1(ev.vitorias_time1 || 0);
              setVitoriasTime2(ev.vitorias_time2 || 0);
              if (ev.configuracao) setConfig(ev.configuracao);

              // Se o evento foi finalizado remotamente, exibir a tela de resultado (Pódio) para este usuário também!
              if (ev.configuracao?.finalizado) {
                setPodiumStep(1);
                setShowPodium(true);
              }
            }
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

        let loadedParticipantes = data.participantes || [];
        if (!data.configuracao?.finalizado && data.grupo_id && data.modalidade_id && loadedParticipantes.length > 0) {
          try {
            const { data: dbRatings } = await supabase
              .from('ratings_jogador')
              .select('usuario_id, rating')
              .eq('grupo_id', data.grupo_id)
              .eq('modalidade_id', data.modalidade_id);

            if (dbRatings) {
              loadedParticipantes = loadedParticipantes.map((p: any) => {
                const rRow = dbRatings.find((r) => r.usuario_id === p.id);
                if (rRow) {
                  return { ...p, avaliacao: Number(rRow.rating) };
                }
                return p;
              });
            }
          } catch (e) {
            console.error('Erro ao sincronizar estrelas dos participantes no fetch:', e);
          }
        }

        // AUTO-ADICIONAR CRIADOR DO EVENTO se ainda não estiver na lista
        if (!data.configuracao?.finalizado) {
          try {
            const { data: { user: authUser } } = await supabase.auth.getUser();
            if (authUser) {
              const { data: creatorProfile } = await supabase
                .from('usuarios')
                .select('id, nome, foto')
                .eq('email', authUser.email)
                .single();

              // Verificar se o usuário é o criador do evento E ainda não está na lista
              if (
                creatorProfile &&
                data.usuario_id === creatorProfile.id &&
                !loadedParticipantes.some((p: any) => p.id === creatorProfile.id)
              ) {
                // Buscar rating se o evento tiver grupo e modalidade
                let rating = 3;
                if (data.grupo_id && data.modalidade_id) {
                  const { data: rRow } = await supabase
                    .from('ratings_jogador')
                    .select('rating')
                    .eq('usuario_id', creatorProfile.id)
                    .eq('grupo_id', data.grupo_id)
                    .eq('modalidade_id', data.modalidade_id)
                    .maybeSingle();
                  if (rRow) rating = Number(rRow.rating);
                }

                const criadorParticipante = {
                  id: creatorProfile.id,
                  nome: creatorProfile.nome,
                  foto: creatorProfile.foto || '',
                  checked: true,
                  avaliacao: rating,
                  prioridade: 0,
                  jogos: 0,
                  jogosGanhos: 0,
                };

                loadedParticipantes = [...loadedParticipantes, criadorParticipante].sort(
                  (a: any, b: any) => a.nome.localeCompare(b.nome)
                );

                // Persistir no banco
                await supabase.from('eventos').update({ participantes: loadedParticipantes }).eq('id', id);
              }
            }
          } catch (e) {
            console.error('Erro ao auto-adicionar criador do evento:', e);
          }
        }

        setParticipantes(loadedParticipantes);
        setTime1(data.time1 || []);
        setTime2(data.time2 || []);
        setVitoriasTime1(data.vitorias_time1 || 0);
        setVitoriasTime2(data.vitorias_time2 || 0);
        if (data.configuracao) setConfig(data.configuracao);
        setSelectedGrupoId(data.grupo_id || null);

        // Só abrir o modal do Pódio automaticamente se a URL contiver explicitamente ?show_result=true (ex: ao clicar na notificação)
        const searchParams = new URLSearchParams(window.location.search);
        if (searchParams.get('show_result') === 'true') {
          setPodiumStep(1);
          setShowPodium(true);
        }
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
  const handleSelectSugestao = async (user: any) => {
    let rating = 3;
    if (evento?.grupo_id && evento?.modalidade_id) {
      try {
        const { data: ratingRow } = await supabase
          .from('ratings_jogador')
          .select('rating')
          .eq('usuario_id', user.id)
          .eq('grupo_id', evento.grupo_id)
          .eq('modalidade_id', evento.modalidade_id)
          .maybeSingle();

        if (ratingRow) {
          rating = Number(ratingRow.rating);
        }
      } catch (e) {
        console.error('Erro ao buscar nota do jogador na tabela ratings_jogador:', e);
      }
    }

    const novoJogador: Participante = {
      id: user.id, // ID real do usuário no Supabase!
      nome: user.nome,
      foto: user.foto || '',
      checked: true,
      avaliacao: rating,
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
    const player = novos[index];
    player.checked = !player.checked;
    
    // Se o jogador foi desmarcado (checked = false), garantir que ele saia dos times ativos se estivesse jogando
    let novoTime1 = [...time1];
    let novoTime2 = [...time2];
    if (!player.checked) {
      novoTime1 = time1.filter((p) => p.id !== player.id);
      novoTime2 = time2.filter((p) => p.id !== player.id);
      setTime1(novoTime1);
      setTime2(novoTime2);
    }

    setParticipantes(novos);
    updateDatabase({ 
      participantes: novos,
      time1: novoTime1,
      time2: novoTime2
    });
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
    const novoTime1 = time1.filter((p) => p.id !== id);
    const novoTime2 = time2.filter((p) => p.id !== id);

    setTime1(novoTime1);
    setTime2(novoTime2);
    setParticipantes(novos);
    updateDatabase({ 
      participantes: novos,
      time1: novoTime1,
      time2: novoTime2
    });
  };

  // Toggle todos os checkboxes
  const toggleSelectAll = (checked: boolean) => {
    const novos = participantes.map((p) => ({ ...p, checked }));
    let novoTime1 = [...time1];
    let novoTime2 = [...time2];
    
    if (!checked) {
      // Se desmarcou todos, remove todo mundo das equipes ativas
      novoTime1 = [];
      novoTime2 = [];
      setTime1([]);
      setTime2([]);
    }

    setParticipantes(novos);
    updateDatabase({ 
      participantes: novos,
      time1: novoTime1,
      time2: novoTime2
    });
  };

  // Sorteio de times inicial (com trava anti-duplo)
  const handleSortearClick = async () => {
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

    // ---- TRAVA ANTI-SORTEIO DUPLO ----
    // Busca o estado mais recente do evento direto do banco para checar se alguém sorteou recentemente
    try {
      const { data: freshEvento } = await supabase
        .from('eventos')
        .select('configuracao')
        .eq('id', id)
        .single();

      if (freshEvento?.configuracao) {
        const ultimoSorteio = (freshEvento.configuracao as any).ultimo_sorteio;
        if (ultimoSorteio?.timestamp) {
          const segundosAtras = Math.floor(
            (Date.now() - new Date(ultimoSorteio.timestamp).getTime()) / 1000
          );
          if (segundosAtras < 15) {
            // Sorteio muito recente — perguntar ao usuário
            setDialog({
              isOpen: true,
              title: '⚠️ Sorteio Recente',
              message: `${ultimoSorteio.usuario_nome || 'Alguém'} realizou um sorteio há ${segundosAtras} segundo(s). Deseja sortear novamente mesmo assim?`,
              type: 'confirm',
              onConfirm: () => {
                setDialog((prev) => ({ ...prev, isOpen: false }));
                executarSorteio(presentes);
              },
              onCancel: () => setDialog((prev) => ({ ...prev, isOpen: false })),
            });
            return;
          }
        }
      }
    } catch (e) {
      // Se falhar a checagem, prossegue normalmente
      console.warn('Aviso: não foi possível verificar trava de sorteio:', e);
    }
    // ----------------------------------

    executarSorteio(presentes);
  };

  // Função interna que executa o sorteio + registra a trava
  const executarSorteio = (presentes: Participante[]) => {
    const resultado = sortearTimes(presentes, config.numberOfPlayers, config.numberOfTeams);
    setDrawTeamsResult(resultado);

    // Iniciar animação do sorteio!
    setIsDrawing(true);
    let count = 0;
    const interval = setInterval(() => {
      const randomPlayer = presentes[Math.floor(Math.random() * presentes.length)];
      if (randomPlayer) {
        setShuffleName(randomPlayer.nome);
      }
      count++;
      if (count >= 25) { // 2 segundos (25 * 80ms)
        clearInterval(interval);
        setIsDrawing(false);
        setShowDrawResult(true);

        // Registrar trava: quem sorteou e quando
        const ultimoSorteio = {
          usuario_id: currentUserProfile?.id || '',
          usuario_nome: currentUserProfile?.nome || 'Usuário',
          timestamp: new Date().toISOString(),
        };
        updateDatabase({
          configuracao: { ...config, ultimo_sorteio: ultimoSorteio } as any,
        });
      }
    }, 80);
  };

  // Reequilibrar os jogadores em quadra de forma equilibrada pelas estrelas (serpentina)
  const handleReequilibrarTimes = () => {
    const ativos = [...time1, ...time2];
    if (ativos.length === 0) return;

    // Sorteia os ativos em 2 times do tamanho configurado
    const resultado = sortearTimes(ativos, config.numberOfPlayers, 2);
    const t1 = resultado[0] || [];
    const t2 = resultado[1] || [];

    t1.sort((a, b) => a.nome.localeCompare(b.nome));
    t2.sort((a, b) => a.nome.localeCompare(b.nome));

    // Iniciar animação do reequilíbrio!
    setIsDrawing(true);
    let count = 0;
    const interval = setInterval(() => {
      const randomPlayer = ativos[Math.floor(Math.random() * ativos.length)];
      if (randomPlayer) {
        setShuffleName(randomPlayer.nome);
      }
      count++;
      if (count >= 25) { // 2 segundos (25 * 80ms)
        clearInterval(interval);
        setIsDrawing(false);

        // Garantir prioridades zeradas para os jogadores que continuam jogando
        const activeT1 = t1.map((p) => ({ ...p, prioridade: 0 }));
        const activeT2 = t2.map((p) => ({ ...p, prioridade: 0 }));

        setTime1(activeT1);
        setTime2(activeT2);
        setPlacarTime1(0);
        setPlacarTime2(0);
        // Zerar contão de vitórias ao reequilibrar
        setVitoriasTime1(0);
        setVitoriasTime2(0);

        updateDatabase({
          time1: activeT1,
          time2: activeT2,
          vitorias_time1: 0,
          vitorias_time2: 0,
        });
      }
    }, 80);
  };

  // Iniciar partida com os times sorteados
  const handleIniciarJogo = (t1: Participante[], t2: Participante[]) => {
    const activeT1 = t1.map((p) => ({ ...p, prioridade: 0 }));
    const activeT2 = t2.map((p) => ({ ...p, prioridade: 0 }));
    setTime1(activeT1);
    setTime2(activeT2);
    setPlacarTime1(0);
    setPlacarTime2(0);
    setVitoriasTime1(0);
    setVitoriasTime2(0);
    setShowDrawResult(false);

    // Resetar estatísticas de jogos recentes ao iniciar novo sorteio global
    const novosParticipantes = participantes.map((p) => {
      const isPlaying = t1.some((x) => x.id === p.id) || t2.some((x) => x.id === p.id);
      return {
        ...p,
        prioridade: isPlaying ? 0 : 1,
        jogos: 0,
        jogosGanhos: 0,
      };
    });
    setParticipantes(novosParticipantes);

    // Registrar trava: quem iniciou o jogo e quando
    const ultimoSorteio = {
      usuario_id: currentUserProfile?.id || '',
      usuario_nome: currentUserProfile?.nome || 'Usuário',
      timestamp: new Date().toISOString(),
    };

    updateDatabase({
      time1: activeT1,
      time2: activeT2,
      vitorias_time1: 0,
      vitorias_time2: 0,
      participantes: novosParticipantes,
      configuracao: { ...config, ultimo_sorteio: ultimoSorteio } as any,
    });
  };

  // Remover jogador do time atual ativamente (onDeletar)
  // FIX CRÍTICO: Jogadores removidos manualmente agora sobem de prioridade e vão para o fim da fila
  const handleRemoverJogadorDoTimeAtivo = (timeIndex: 1 | 2, jogadorId: string) => {
    const timeAlvo = timeIndex === 1 ? time1 : time2;
    const jogadorRemovido = timeAlvo.find((p) => p.id === jogadorId);

    if (!jogadorRemovido) return;

    // Aumentar a prioridade do jogador na lista global para mandá-lo ao fim da fila (N = maxN + 1)
    const ativosNoCampo = [...time1, ...time2].filter((p) => p.id !== jogadorId);
    const novosParticipantes = subirPrioridade(participantes, ativosNoCampo, [jogadorRemovido]);
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

  // Adicionar jogador da fila ao time ativo no campo (substituição)
  const handleAdicionarJogadorAoTimeAtivo = (timeIndex: 1 | 2, jogador: Participante) => {
    // 1. Garantir prioridade zero na lista global de participantes
    const novosParticipantes = participantes.map((p) => {
      if (p.id === jogador.id) {
        return { ...p, prioridade: 0 };
      }
      return p;
    });
    setParticipantes(novosParticipantes);

    const jogadorComPrio0 = { ...jogador, prioridade: 0 };

    if (timeIndex === 1) {
      const novoTime1 = [...time1, jogadorComPrio0];
      novoTime1.sort((a, b) => a.nome.localeCompare(b.nome));
      setTime1(novoTime1);
      updateDatabase({ time1: novoTime1, participantes: novosParticipantes });
    } else {
      const novoTime2 = [...time2, jogadorComPrio0];
      novoTime2.sort((a, b) => a.nome.localeCompare(b.nome));
      setTime2(novoTime2);
      updateDatabase({ time2: novoTime2, participantes: novosParticipantes });
    }

    setShowSubstituirModal(false);
    setSubstituirTarget(null);
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

    // Atualizar as referências de time1 e time2 com os novos dados estatísticos
    const updatedTime1 = time1.map((tp) => {
      const found = novosParticipantes.find((np) => np.id === tp.id);
      return found ? found : tp;
    });
    const updatedTime2 = time2.map((tp) => {
      const found = novosParticipantes.find((np) => np.id === tp.id);
      return found ? found : tp;
    });

    const updatedTimePerdedor = time1Venceu ? updatedTime2 : updatedTime1;
    const updatedTimeGanhador = time1Venceu ? updatedTime1 : updatedTime2;

    // Gravar histórico da partida no campo configuracao.historico_partidas
    const novaPartidaLog = {
      id: Date.now().toString(),
      data: new Date().toISOString(),
      placarTime1,
      placarTime2,
      time1: updatedTime1.map((p) => ({ id: p.id, nome: p.nome })),
      time2: updatedTime2.map((p) => ({ id: p.id, nome: p.nome })),
      vencedor: time1Venceu ? 1 : 2,
    };

    const historicoAtual = Array.isArray((config as any)?.historico_partidas)
      ? (config as any).historico_partidas
      : [];
    const novoHistorico = [...historicoAtual, novaPartidaLog];
    const updatedConfigWithHistory = { ...config, historico_partidas: novoHistorico };
    setConfig(updatedConfigWithHistory);

    // Se o time vencedor atingir o limite de vitórias
    if (
      newVitoriasTime1 === config.maxNumberOfVictories ||
      newVitoriasTime2 === config.maxNumberOfVictories
    ) {
      if (config.actionAfterVictories === ActionAfterVictories.Remover) {
        // Remover: ambos os times vão para o fim da fila de prioridade
        // Subir prioridade do perdedor primeiro (com o ganhador ainda jogando), depois do ganhador
        novosParticipantes = subirPrioridade(novosParticipantes, updatedTimeGanhador, updatedTimePerdedor);
        novosParticipantes = subirPrioridade(novosParticipantes, [], updatedTimeGanhador);

        // Selecionar dois novos times da fila usando as prioridades N
        const { selecionados: novoTime1, novosParticipantes: tempParticipantes } = selecionarProximosJogadores(
          novosParticipantes,
          [],
          config.numberOfPlayers
        );
        const { selecionados: novoTime2, novosParticipantes: finalParticipantes } = selecionarProximosJogadores(
          tempParticipantes,
          novoTime1,
          config.numberOfPlayers
        );
        novosParticipantes = finalParticipantes;

        const activeT1 = novoTime1.map((p) => ({ ...p, prioridade: 0 }));
        const activeT2 = novoTime2.map((p) => ({ ...p, prioridade: 0 }));
        activeT1.sort((a, b) => a.nome.localeCompare(b.nome));
        activeT2.sort((a, b) => a.nome.localeCompare(b.nome));

        setTime1(activeT1);
        setTime2(activeT2);
        setPlacarTime1(0);
        setPlacarTime2(0);
        setVitoriasTime1(0);
        setVitoriasTime2(0);
        setParticipantes(novosParticipantes);

        updateDatabase({
          time1: activeT1,
          time2: activeT2,
          vitorias_time1: 0,
          vitorias_time2: 0,
          participantes: novosParticipantes,
          configuracao: updatedConfigWithHistory,
        });
        return;
      }
    }

    // Caso padrão: Apenas o time perdedor vai para a fila (ganha prioridade N = maxN + 1)
    novosParticipantes = subirPrioridade(novosParticipantes, updatedTimeGanhador, updatedTimePerdedor);

    // Selecionar o próximo time de entrantes da fila
    const { selecionados: novoTime, novosParticipantes: finalParticipantes } = selecionarProximosJogadores(
      novosParticipantes,
      updatedTimeGanhador,
      config.numberOfPlayers
    );
    novosParticipantes = finalParticipantes;

    const activeNovoTime = novoTime.map((p) => ({ ...p, prioridade: 0 }));
    activeNovoTime.sort((a, b) => a.nome.localeCompare(b.nome));

    // Se atingiu o limite de vitórias e a ação for Mesclar (Misturar vencedor com a fila)
    if (
      (newVitoriasTime1 === config.maxNumberOfVictories ||
        newVitoriasTime2 === config.maxNumberOfVictories) &&
      config.actionAfterVictories === ActionAfterVictories.Mesclar
    ) {
      const misturarFila = [...updatedTimeGanhador, ...activeNovoTime];
      const novosTimesSorteados = sortearTimes(misturarFila, config.numberOfPlayers, config.numberOfTeams);
      
      const t1 = novosTimesSorteados[0].map((p) => ({ ...p, prioridade: 0 }));
      const t2 = novosTimesSorteados[1].map((p) => ({ ...p, prioridade: 0 }));

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
        configuracao: updatedConfigWithHistory,
      });
    } else {
      // Jogo padrão: Mantém o vencedor e entra o novo time
      if (time1Venceu) {
        const winnerTime1 = updatedTime1.map((p) => ({ ...p, prioridade: 0 }));
        setTime1(winnerTime1);
        setTime2(activeNovoTime);
        setPlacarTime1(0);
        setPlacarTime2(0);
        setParticipantes(novosParticipantes);
        updateDatabase({
          time1: winnerTime1,
          time2: activeNovoTime,
          vitorias_time1: newVitoriasTime1,
          vitorias_time2: 0,
          participantes: novosParticipantes,
          configuracao: updatedConfigWithHistory,
        });
      } else {
        const winnerTime2 = updatedTime2.map((p) => ({ ...p, prioridade: 0 }));
        setTime1(activeNovoTime);
        setTime2(winnerTime2);
        setPlacarTime1(0);
        setPlacarTime2(0);
        setParticipantes(novosParticipantes);
        updateDatabase({
          time1: activeNovoTime,
          time2: winnerTime2,
          vitorias_time1: 0,
          vitorias_time2: newVitoriasTime2,
          participantes: novosParticipantes,
          configuracao: updatedConfigWithHistory,
        });
      }
    }
  };

  // Salvar configurações
  const handleSaveConfig = () => {
    updateDatabase({ configuracao: config, grupo_id: selectedGrupoId || undefined } as any);
    setEvento((prev) => (prev ? { ...prev, grupo_id: selectedGrupoId || undefined } : null));
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
          // 1. Calcular e atualizar ratings dos jogadores
          let updatedParticipantes = [...participantes];
          if (evento?.grupo_id && evento?.modalidade_id) {
            const ranked = [...participantes].sort((a, b) => {
              const vA = a.jogosGanhos || 0;
              const vB = b.jogosGanhos || 0;
              const dA = (a.jogos || 0) - vA;
              const dB = (b.jogos || 0) - vB;
              if (vB !== vA) return vB - vA;
              return dA - dB;
            });

            const numGanhadores = Math.min(6, Math.floor(ranked.length / 3));
            const numPerdedores = numGanhadores;

            for (let i = 0; i < ranked.length; i++) {
              const p = ranked[i];
              // Verificar se o participante é um usuário cadastrado no sistema
              // (tem UUID válido de 36 caracteres, não é um convidado anônimo gerado por uuidv4 local)
              // Antes usávamos todasPessoas.some(), mas isso excluía novos usuários sem amigos ainda
              const isRegisteredUser = typeof p.id === 'string' && p.id.length === 36 && p.id.includes('-');
              if (!isRegisteredUser) continue;

              // Determinar o ajuste de rating
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

              // Salvar no banco (UPSERT)
              await supabase.from('ratings_jogador').upsert({
                usuario_id: p.id,
                grupo_id: evento.grupo_id,
                modalidade_id: evento.modalidade_id,
                rating: newRating,
              });

              // Atualizar na lista local também
              const pIndex = updatedParticipantes.findIndex((part) => part.id === p.id);
              if (pIndex !== -1) {
                updatedParticipantes[pIndex].avaliacao = newRating;
              }
            }
          }

          // 2. Finalizar evento e salvar participantes consolidados
          const updatedConfig = { ...config, finalizado: true };
          const { error } = await supabase
            .from('eventos')
            .update({ 
              configuracao: updatedConfig,
              participantes: updatedParticipantes
            })
            .eq('id', id);
          if (error) throw error;
          
          setParticipantes(updatedParticipantes);
          setShowConfig(false);
          setPodiumStep(1);
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

  // Copiar link do evento para o clipboard ou compartilhar nativo
  const handleCopiarLinkEvento = async () => {
    if (!evento) return;
    const url = window.location.href;
    const texto = `🏆 *${evento.descricao}*\n📅 ${dayjs(evento.data).format('DD/MM/YYYY [-] HH:mm')}\n📍 ${evento.local}\n\nConfirme sua presença pelo link:\n${url}`;

    try {
      if (navigator.share) {
        await navigator.share({
          title: evento.descricao,
          text: texto,
          url,
        });
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(texto);
        setDialog({
          isOpen: true,
          title: 'Link Copiado! 🔗',
          message: 'O link e os dados do evento foram copiados para a área de transferência. Agora é só colar no WhatsApp!',
          type: 'alert',
          onConfirm: () => setDialog((prev) => ({ ...prev, isOpen: false })),
        });
      }
    } catch (e) {
      console.warn('Compartilhamento cancelado ou não suportado:', e);
    }
  };

  // Confirmar presença de forma autônoma
  const handleSelfConfirmarPresenca = async () => {
    if (!currentUserProfile || !evento) return;
    
    try {
      // 1. Obter avaliação (rating) do usuário logado se existir
      let userRatingVal = 3.0;
      if (evento.grupo_id && evento.modalidade_id) {
        const { data: dbRating } = await supabase
          .from('ratings_jogador')
          .select('rating')
          .eq('usuario_id', currentUserProfile.id)
          .eq('grupo_id', evento.grupo_id)
          .eq('modalidade_id', evento.modalidade_id)
          .maybeSingle();
        if (dbRating) {
          userRatingVal = Number(dbRating.rating);
        }
      }

      // 2. Verificar limite de vagas se configurado
      const limiteVagas = (config as any)?.limite_vagas ?? (evento.configuracao as any)?.limite_vagas;
      const confirmadosCount = participantes.filter((p) => p.checked).length;
      const jaEstavaConfirmado = participantes.some((p) => p.id === currentUserProfile.id && p.checked);

      if (!jaEstavaConfirmado && limiteVagas && confirmadosCount >= Number(limiteVagas)) {
        setDialog({
          isOpen: true,
          title: 'Vagas Esgotadas! 🚫',
          message: `Desculpe, este evento atingiu o limite máximo de ${limiteVagas} vagas confirmadas. Fale com o organizador se precisar entrar na lista.`,
          type: 'alert',
          onConfirm: () => setDialog((prev) => ({ ...prev, isOpen: false })),
        });
        return;
      }

      // 3. Montar objeto participante
      const novoParticipante: Participante = {
        id: currentUserProfile.id,
        nome: currentUserProfile.nome,
        avaliacao: userRatingVal,
        checked: true,
        prioridade: 0,
        jogos: 0,
        jogosGanhos: 0,
        foto: currentUserProfile.foto || '',
        vitorias: 0,
        derrotas: 0
      };

      // 4. Atualizar lista de participantes
      let novosParticipantes = [...participantes];
      const index = novosParticipantes.findIndex(p => p.id === currentUserProfile.id);
      if (index >= 0) {
        novosParticipantes[index] = {
          ...novosParticipantes[index],
          checked: true,
          avaliacao: userRatingVal
        };
      } else {
        novosParticipantes.push(novoParticipante);
      }

      // 4. Salvar no Supabase
      const { error } = await supabase
        .from('eventos')
        .update({ participantes: novosParticipantes })
        .eq('id', id);

      if (error) throw error;
      
      setParticipantes(novosParticipantes);
      setDialog({
        isOpen: true,
        title: 'Presença Confirmada! ✅',
        message: 'Sua presença foi registrada com sucesso neste evento!',
        type: 'alert',
        onConfirm: () => setDialog((prev) => ({ ...prev, isOpen: false })),
      });
    } catch (err: any) {
      setDialog({
        isOpen: true,
        title: 'Erro',
        message: 'Não foi possível confirmar presença: ' + err.message,
        type: 'alert',
        onConfirm: () => setDialog((prev) => ({ ...prev, isOpen: false })),
      });
    }
  };

  // Cancelar presença de forma autônoma
  const handleSelfCancelarPresenca = async () => {
    if (!currentUserProfile || !evento) return;

    try {
      // 1. Marcar checked: false para o participante
      let novosParticipantes = participantes.map(p => {
        if (p.id === currentUserProfile.id) {
          return { ...p, checked: false };
        }
        return p;
      });

      // 2. Remover o jogador dos times ativos se ele estiver em campo
      const novoTime1 = time1.filter(p => p.id !== currentUserProfile.id);
      const novoTime2 = time2.filter(p => p.id !== currentUserProfile.id);

      // 3. Salvar no Supabase
      const { error } = await supabase
        .from('eventos')
        .update({
          participantes: novosParticipantes,
          time1: novoTime1,
          time2: novoTime2
        })
        .eq('id', id);

      if (error) throw error;

      setParticipantes(novosParticipantes);
      setTime1(novoTime1);
      setTime2(novoTime2);
      
      setDialog({
        isOpen: true,
        title: 'Presença Cancelada ❌',
        message: 'Você cancelou sua presença neste evento.',
        type: 'alert',
        onConfirm: () => setDialog((prev) => ({ ...prev, isOpen: false })),
      });
    } catch (err: any) {
      setDialog({
        isOpen: true,
        title: 'Erro',
        message: 'Não foi possível cancelar presença: ' + err.message,
        type: 'alert',
        onConfirm: () => setDialog((prev) => ({ ...prev, isOpen: false })),
      });
    }
  };

  // Compartilhar ranking final do evento ou destaques como imagem
  const handleCompartilharRanking = async () => {
    const elementId = podiumStep === 1 ? 'ranking-podium-content' : 'ranking-highlights-content';
    const el = document.getElementById(elementId);
    if (!el) return;

    try {
      // 1. Renderizar o elemento HTML em canvas usando html2canvas
      const html2canvas = (await import('html2canvas-pro')).default;
      const canvas = await html2canvas(el, {
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        scale: 2 // Alta definição
      });

      // 2. Converter o canvas para Blob
      canvas.toBlob(async (blob) => {
        if (!blob) {
          throw new Error('Falha ao gerar imagem');
        }

        const prefix = podiumStep === 1 ? 'Ranking' : 'Destaques';
        const filename = `${prefix}_${evento?.descricao || 'Evento'}.png`;
        const file = new File([blob], filename, { type: 'image/png' });

        const titleText = podiumStep === 1 
          ? `Ranking Final - ${evento?.descricao || 'GoPlay'}`
          : `Time dos Sonhos & Pesadelo - ${evento?.descricao || 'GoPlay'}`;
        const bodyText = podiumStep === 1
          ? 'Confira o pódio do nosso evento no GoPlay! 🏆'
          : 'Confira o Time dos Sonhos e o Time Pesadelo do nosso evento no GoPlay! 🏆💀';

        // 3. Tentar usar o Web Share API do navegador (comum em celulares)
        if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({
            files: [file],
            title: titleText,
            text: bodyText
          });
        } else {
          // 4. Fallback: Se não puder compartilhar direto, faz o download da imagem
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = filename;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
          
          setDialog({
            isOpen: true,
            title: 'Download Concluído',
            message: `Imagem de ${podiumStep === 1 ? 'ranking' : 'destaques'} baixada com sucesso! Você já pode compartilhá-la nas suas redes.`,
            type: 'alert',
            onConfirm: () => setDialog((prev) => ({ ...prev, isOpen: false })),
          });
        }
      }, 'image/png');
    } catch (err: any) {
      console.error(err);
      setDialog({
        isOpen: true,
        title: 'Erro',
        message: 'Não foi possível compartilhar: ' + err.message,
        type: 'alert',
        onConfirm: () => setDialog((prev) => ({ ...prev, isOpen: false })),
      });
    }
  };

  // Obter jogadores na fila (Presentes que não estão no Time 1 nem no Time 2)
  const jogadoresFila = participantes.filter(
    (p) => p.checked && !time1.some((t) => t.id === p.id) && !time2.some((t) => t.id === p.id)
  );

  const emptySlots1 = Math.max(0, config.numberOfPlayers - time1.length);
  const emptySlots2 = Math.max(0, config.numberOfPlayers - time2.length);

  // Ordenar fila usando a prioridade real (N menor primeiro, depois ordem alfabética)
  const filaOrdenada = [...jogadoresFila].sort((a, b) => {
    const pA = a.prioridade || 0;
    const pB = b.prioridade || 0;
    if (pA !== pB) return pA - pB;
    return a.nome.localeCompare(b.nome);
  });

  // Cálculo do equilíbrio de estrelas (rating total e média por time)
  const totalStarsTime1 = time1.reduce((sum, p) => sum + (p.avaliacao || 3), 0);
  const avgStarsTime1 = time1.length > 0 ? (totalStarsTime1 / time1.length).toFixed(1) : '0.0';
  
  const totalStarsTime2 = time2.reduce((sum, p) => sum + (p.avaliacao || 3), 0);
  const avgStarsTime2 = time2.length > 0 ? (totalStarsTime2 / time2.length).toFixed(1) : '0.0';
  
  const starDiff = Math.abs(totalStarsTime1 - totalStarsTime2).toFixed(1);

  // NOVO REQUISITO: Estimar o "Próximo Time" que vai jogar usando a prioridade N
  const { selecionados: estimadoProximoTime } = selecionarProximosJogadores(
    participantes,
    [...time1, ...time2],
    config.numberOfPlayers
  );

  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [selectedMatchIndex, setSelectedMatchIndex] = useState<number | null>(null);

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
      {/* Toast de Atualização Remota */}
      <AnimatePresence>
        {remoteUpdateToast && (
          <motion.div
            key="remote-toast"
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -16, scale: 0.95 }}
            transition={{ duration: 0.25 }}
            className="fixed top-[4.5rem] left-1/2 -translate-x-1/2 z-[999] bg-slate-900/95 text-white text-xs font-bold px-4 py-2.5 rounded-2xl shadow-xl flex items-center gap-2 max-w-[90vw] backdrop-blur-sm border border-white/10"
          >
            <span className="text-emerald-400 text-sm">●</span>
            <span>{remoteUpdateToast}</span>
          </motion.div>
        )}
      </AnimatePresence>
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
            {(() => {
              const limite = (config as any)?.limite_vagas ?? (evento.configuracao as any)?.limite_vagas;
              const confirmadosCount = participantes.filter((p) => p.checked).length;
              const isCheio = limite && confirmadosCount >= Number(limite);

              return (
                <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                  <span className="text-[11px] font-bold text-slate-600 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-lg flex items-center gap-1">
                    <Users size={12} className="text-amber-500" />
                    <span>
                      {limite ? `Vagas: ${confirmadosCount}/${limite}` : `${confirmadosCount} confirmados (Sem Limite)`}
                    </span>
                  </span>
                  {isCheio && (
                    <span className="text-[10px] font-black uppercase tracking-wider text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-lg animate-pulse">
                      🚫 Vagas Esgotadas
                    </span>
                  )}
                </div>
              );
            })()}
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={handleCopiarLinkEvento}
            className="p-2.5 bg-slate-50 border border-slate-200 hover:bg-slate-200 text-indigo-500 rounded-xl transition-all shadow-md cursor-pointer"
            title="Copiar link de convite"
          >
            <Link2 size={18} />
          </button>
          <button
            onClick={() => setShowHistoryModal(true)}
            className="p-2.5 bg-slate-50 border border-slate-200 hover:bg-slate-200 text-slate-600 rounded-xl transition-all shadow-md cursor-pointer"
            title="Histórico de Partidas"
          >
            <History size={18} />
          </button>
          <button
            onClick={() => setShowRanking(true)}
            className="p-2.5 bg-slate-50 border border-slate-200 hover:bg-slate-200 text-yellow-500 rounded-xl transition-all shadow-md cursor-pointer"
            title="Ver classificação"
          >
            <Trophy size={18} />
          </button>
          <button
            onClick={async () => {
              if (evento.grupo_id && currentUserProfile) {
                const canEdit = await verificarPermissaoGrupo(evento.grupo_id, currentUserProfile.id, 'Alterar Evento');
                if (!canEdit) {
                  setDialog({
                    isOpen: true,
                    title: 'Permissão Insuficiente 🚫',
                    message: 'Você não possui permissão para alterar as configurações deste evento. Consulte o Administrador ou Proprietário do Grupo.',
                    type: 'alert',
                    onConfirm: () => setDialog((prev) => ({ ...prev, isOpen: false })),
                  });
                  return;
                }
              }
              setShowConfig(true);
            }}
            className="p-2.5 bg-slate-50 border border-slate-200 hover:bg-slate-200 text-slate-600 rounded-xl transition-all shadow-md cursor-pointer"
            title="Configurações do evento"
          >
            <Settings size={18} />
          </button>
        </div>
      </div>

      {/* CARD DE CONFIRMAÇÃO DE PRESENÇA AUTÔNOMA */}
      {currentUserProfile && !evento.configuracao.finalizado && (
        (() => {
          const participanteLogado = participantes.find(p => p.id === currentUserProfile.id);
          const estaConfirmado = participanteLogado?.checked === true;
          const limite = (config as any)?.limite_vagas ?? (evento.configuracao as any)?.limite_vagas;
          const confirmadosCount = participantes.filter((p) => p.checked).length;
          const isCheio = !estaConfirmado && limite && confirmadosCount >= Number(limite);

          return (
            <div className={`p-4 rounded-2xl border transition-all shadow-md flex flex-col sm:flex-row justify-between items-center gap-4 ${
              estaConfirmado 
                ? 'bg-gradient-to-br from-emerald-50 to-teal-50/20 border-emerald-200 text-emerald-950'
                : isCheio
                ? 'bg-gradient-to-br from-rose-50/40 to-slate-50 border-rose-200'
                : 'bg-gradient-to-br from-indigo-50/50 to-slate-50 border-slate-200'
            }`}>
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg shadow-inner flex-shrink-0 ${
                  estaConfirmado ? 'bg-emerald-100 text-emerald-700' : isCheio ? 'bg-rose-100 text-rose-650' : 'bg-slate-100 text-slate-500'
                }`}>
                  {estaConfirmado ? '✅' : isCheio ? '🚫' : '❓'}
                </div>
                <div>
                  <h3 className="text-xs font-black uppercase tracking-wider text-slate-700">
                    Sua Presença no Evento
                  </h3>
                  <p className="text-[11px] font-bold text-slate-500 mt-0.5">
                    {estaConfirmado 
                      ? 'Confirmado! Você já está na fila/quadra de jogo.' 
                      : isCheio
                      ? `Vagas esgotadas (${confirmadosCount}/${limite} confirmados).`
                      : 'Ainda não confirmou. Clique no botão ao lado para confirmar!'
                    }
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                {estaConfirmado ? (
                  <button
                    onClick={handleSelfCancelarPresenca}
                    className="w-full sm:w-auto px-4 py-2 border border-rose-300 hover:border-rose-450 text-rose-650 hover:bg-rose-50 font-bold rounded-xl text-xs transition-all cursor-pointer bg-white"
                  >
                    Não vou jogar
                  </button>
                ) : isCheio ? (
                  <button
                    disabled
                    className="w-full sm:w-auto px-5 py-2.5 bg-slate-200 text-slate-400 font-extrabold rounded-xl text-xs cursor-not-allowed border-0 shadow-none"
                  >
                    Vagas Esgotadas
                  </button>
                ) : (
                  <button
                    onClick={handleSelfConfirmarPresenca}
                    className="w-full sm:w-auto px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-xl text-xs transition-all shadow-md active:scale-95 cursor-pointer border-0"
                  >
                    Confirmar Presença
                  </button>
                )}
              </div>
            </div>
          );
        })()
      )}

      {/* SE EVENTO FINALIZADO: EXIBIR NAVEGADOR DE PARTIDAS E SELETOR 1, 2, 3... */}
      {evento.configuracao?.finalizado ? (
        (() => {
          const historico: any[] = (config as any)?.historico_partidas || (evento.configuracao as any)?.historico_partidas || [];
          const totalPartidas = historico.length;
          const matchIdx = selectedMatchIndex !== null ? selectedMatchIndex : (totalPartidas > 0 ? totalPartidas - 1 : 0);
          const partidaSelecionada = historico[matchIdx];

          return (
            <div className="glass p-5 rounded-2xl border border-slate-200 shadow-xl space-y-4 relative overflow-hidden">
              <div className="flex items-center justify-between gap-2">
                <h2 className="font-black text-xs uppercase tracking-widest text-slate-500 flex items-center gap-1.5 min-w-0">
                  <History size={14} className="text-red-500 shrink-0" />
                  <span className="truncate">Histórico de Partidas ({totalPartidas})</span>
                </h2>
                
                <button
                  onClick={() => {
                    setPodiumStep(1);
                    setShowPodium(true);
                  }}
                  className="px-2.5 py-1 bg-yellow-50 hover:bg-yellow-100 border border-yellow-300 text-yellow-800 rounded-lg text-[10px] font-black uppercase tracking-wider flex items-center gap-1 shrink-0 transition-all cursor-pointer shadow-xs active:scale-95"
                  title="Ver Resultado e Ranking do Evento"
                >
                  <Trophy size={11} className="text-yellow-600" />
                  <span>Ver Pódio</span>
                </button>
              </div>

              {totalPartidas > 0 ? (
                <>
                  {/* Seletor horizontal de número de partidas: 1 2 3 4 5 ... */}
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                    {historico.map((_: any, idx: number) => (
                      <button
                        key={idx}
                        onClick={() => setSelectedMatchIndex(idx)}
                        className={`min-w-[2.25rem] h-9 rounded-xl font-black text-xs transition-all flex items-center justify-center cursor-pointer border ${
                          matchIdx === idx
                            ? 'bg-[#eb3237] text-white border-[#eb3237] shadow-md scale-105'
                            : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {idx + 1}
                      </button>
                    ))}
                  </div>

                  {/* Detalhe da Partida Selecionada */}
                  {partidaSelecionada && (
                    <div className="space-y-3 pt-1">
                      <div className="flex items-center justify-between text-xs font-bold text-slate-500 border-b border-slate-150 pb-2">
                        <span>Partida #{matchIdx + 1}</span>
                        <span>{dayjs(partidaSelecionada.data).format('HH:mm:ss')}</span>
                      </div>

                      {/* Card com Placar e Escalação dos dois times */}
                      <div className="grid grid-cols-2 gap-3 text-left">
                        {/* Time A */}
                        <div className={`p-3.5 rounded-2xl border ${partidaSelecionada.vencedor === 1 ? 'bg-red-50/80 border-red-200 text-red-950 ring-2 ring-red-500/20' : 'bg-slate-50 border-slate-200 text-slate-700'}`}>
                          <div className="flex justify-between items-center mb-2 pb-1.5 border-b border-red-200/50">
                            <span className="font-black text-xs uppercase tracking-wider text-red-600">Time A</span>
                            <span className="text-xl font-black">{partidaSelecionada.placarTime1}</span>
                          </div>
                          <div className="space-y-1 text-xs font-semibold">
                            {(partidaSelecionada.time1 || []).map((p: any) => (
                              <div key={p.id} className="truncate">
                                {p.nome}
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Time B */}
                        <div className={`p-3.5 rounded-2xl border ${partidaSelecionada.vencedor === 2 ? 'bg-blue-50/80 border-blue-200 text-blue-950 ring-2 ring-blue-500/20' : 'bg-slate-50 border-slate-200 text-slate-700'}`}>
                          <div className="flex justify-between items-center mb-2 pb-1.5 border-b border-blue-200/50">
                            <span className="font-black text-xs uppercase tracking-wider text-blue-600">Time B</span>
                            <span className="text-xl font-black">{partidaSelecionada.placarTime2}</span>
                          </div>
                          <div className="space-y-1 text-xs font-semibold">
                            {(partidaSelecionada.time2 || []).map((p: any) => (
                              <div key={p.id} className="truncate">
                                {p.nome}
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <p className="text-xs text-slate-400 text-center py-4">Nenhuma partida gravada para este evento.</p>
              )}
            </div>
          );
        })()
      ) : (
        <>
          {/* PAINEL DE JOGO ATIVO */}
          {isJogoAtivo && (
            <div className="glass p-5 rounded-2xl border border-slate-200 shadow-xl space-y-5 relative overflow-hidden">
              {/* Fundo decorativo sutil com efeito gradiente de partida ativa */}
              <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-red-500 via-fuchsia-500 to-cyan-500" />
              
              <div className="flex justify-between items-center">
                <h2 className="font-black text-xs uppercase tracking-widest text-red-400">
                  Partida Ativa
                </h2>
                <button
                  onClick={handleReequilibrarTimes}
                  className="px-2.5 py-1 bg-slate-50 border border-slate-200 hover:bg-slate-200 text-slate-650 rounded-lg transition-all active:scale-95 flex items-center gap-1.5 text-[9px] font-extrabold uppercase tracking-wider cursor-pointer shadow-sm"
                  title="Reequilibrar os jogadores em quadra pelas estrelas"
                >
                  <RefreshCw size={10} className="text-red-500" />
                  <span>Reequilibrar</span>
                </button>
              </div>

              <div className="grid grid-cols-5 items-center">
                {/* Time 1 */}
                <div className="col-span-2 text-center space-y-2">
                  <span className="font-black text-sm text-red-700 block">Time A</span>
                  
                  {/* Badge de Estrelas / Rating do Time A */}
                  <div className="flex flex-col items-center justify-center bg-red-50/80 border border-red-200/80 py-1 px-2 rounded-xl">
                    <div className="flex items-center gap-1 text-amber-500 text-xs font-black">
                      <Star size={13} className="fill-amber-400 text-amber-400" />
                      <span>{totalStarsTime1.toFixed(1)} ★</span>
                    </div>
                    <span className="text-[9px] font-bold text-slate-500 mt-0.5">
                      Média: {avgStarsTime1}
                    </span>
                  </div>

                  <div className="flex justify-center items-center gap-1 mt-1">
                    <button
                      onClick={() => setPlacarTime1((p) => Math.max(0, p - 1))}
                      className="p-1.5 rounded-lg bg-slate-50 text-slate-450 active:scale-90"
                    >
                      <Minus size={14} />
                    </button>
                    <div className="w-12 h-12 rounded-xl bg-red-950/20 border border-red-200 flex items-center justify-center text-xl font-black text-red-900">
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

                {/* Divisor X + Badge de Indicador de Equilíbrio */}
                <div className="col-span-1 text-center flex flex-col items-center justify-center space-y-1">
                  <span className="font-black text-slate-400 text-lg">X</span>
                  {time1.length > 0 && time2.length > 0 && (
                    <div
                      className={`px-1.5 py-0.5 rounded-md text-[8px] font-black uppercase tracking-tight flex items-center gap-0.5 border ${
                        Number(starDiff) <= 1.0
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : 'bg-amber-50 text-amber-700 border-amber-200'
                      }`}
                      title={`Diferença de ${starDiff} estrela(s) entre os times`}
                    >
                      <span>{Number(starDiff) <= 1.0 ? '⚖️ Equilibrado' : `Δ ${starDiff}★`}</span>
                    </div>
                  )}
                </div>

                {/* Time 2 */}
                <div className="col-span-2 text-center space-y-2">
                  <span className="font-black text-sm text-blue-700 block">Time B</span>
                  
                  {/* Badge de Estrelas / Rating do Time B */}
                  <div className="flex flex-col items-center justify-center bg-blue-50/80 border border-blue-200/80 py-1 px-2 rounded-xl">
                    <div className="flex items-center gap-1 text-amber-500 text-xs font-black">
                      <Star size={13} className="fill-amber-400 text-amber-400" />
                      <span>{totalStarsTime2.toFixed(1)} ★</span>
                    </div>
                    <span className="text-[9px] font-bold text-slate-500 mt-0.5">
                      Média: {avgStarsTime2}
                    </span>
                  </div>

                  <div className="flex justify-center items-center gap-1 mt-1">
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
                    <div key={p.id} className="flex justify-between items-center">
                      <span className="text-xs font-semibold text-red-700 truncate pr-1">
                        {p.nome} <span className="text-[10px] text-slate-500">[{p.prioridade || 0}]</span>
                      </span>
                      <button
                        onClick={() => handleRemoverJogadorDoTimeAtivo(1, p.id)}
                        className="flex-shrink-0 p-1 rounded-lg hover:bg-red-100 text-red-300 hover:text-red-500 transition-all cursor-pointer"
                        title="Remover e mandar pra fila"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))}
                  {Array.from({ length: emptySlots1 }).map((_, idx) => (
                    <button
                      key={`empty-t1-${idx}`}
                      onClick={() => {
                        setSubstituirTarget({ timeIndex: 1, slotIndex: idx });
                        setShowSubstituirModal(true);
                      }}
                      className="w-full py-1.5 px-2 border border-dashed border-red-300 rounded-lg text-left text-[10px] font-bold text-red-500 hover:bg-red-100/50 transition-all flex items-center gap-1 cursor-pointer"
                    >
                      <UserPlus size={10} />
                      <span>Vaga Disponível</span>
                    </button>
                  ))}
                </div>

                {/* Jogadores Time 2 */}
                <div className="space-y-1.5 p-3 rounded-xl bg-blue-50 border border-blue-200">
                  {time2.map((p) => (
                    <div key={p.id} className="flex justify-between items-center">
                      <span className="text-xs font-semibold text-blue-700 truncate pr-1">
                        {p.nome} <span className="text-[10px] text-slate-500">[{p.prioridade || 0}]</span>
                      </span>
                      <button
                        onClick={() => handleRemoverJogadorDoTimeAtivo(2, p.id)}
                        className="flex-shrink-0 p-1 rounded-lg hover:bg-blue-100 text-blue-300 hover:text-blue-500 transition-all cursor-pointer"
                        title="Remover e mandar pra fila"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))}
                  {Array.from({ length: emptySlots2 }).map((_, idx) => (
                    <button
                      key={`empty-t2-${idx}`}
                      onClick={() => {
                        setSubstituirTarget({ timeIndex: 2, slotIndex: idx });
                        setShowSubstituirModal(true);
                      }}
                      className="w-full py-1.5 px-2 border border-dashed border-blue-300 rounded-lg text-left text-[10px] font-bold text-blue-500 hover:bg-blue-100/50 transition-all flex items-center gap-1 cursor-pointer"
                    >
                      <UserPlus size={10} />
                      <span>Vaga Disponível</span>
                    </button>
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
              {jogadoresFila.length > config.numberOfPlayers && (
                <div className="pt-2.5 border-t border-dashed border-slate-150 space-y-1.5">
                  <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 block">
                    Restante da Fila ({jogadoresFila.length - config.numberOfPlayers})
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {filaOrdenada.slice(config.numberOfPlayers).map((p) => (
                      <span
                        key={p.id}
                        className="px-2 py-0.5 rounded-md bg-slate-100/40 border border-slate-150 text-[10px] text-slate-500 font-medium"
                      >
                        {p.nome} <span className="text-[8px] text-slate-450">({p.prioridade})</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}
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
        </>
      )}

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

              {/* Ajuste de Vagas no Modal de Configurações */}
              <div className="space-y-2 p-3 bg-slate-50 border border-slate-200 rounded-xl text-left">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-slate-700 uppercase">Limite de Vagas</span>
                  <span className="text-[10px] font-bold text-slate-500">
                    {(config as any)?.limite_vagas ? `${(config as any).limite_vagas} vagas` : 'Ilimitado'}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setConfig({ ...config, limite_vagas: null, tem_limite_vagas: false } as any)}
                    className={`py-1.5 px-2 rounded-lg border text-xs font-bold transition-all cursor-pointer ${
                      !(config as any)?.limite_vagas
                        ? 'bg-red-600 border-red-600 text-white shadow-xs'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    ♾️ Ilimitado
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfig({ ...config, limite_vagas: (config as any)?.limite_vagas || 12, tem_limite_vagas: true } as any)}
                    className={`py-1.5 px-2 rounded-lg border text-xs font-bold transition-all cursor-pointer ${
                      (config as any)?.limite_vagas
                        ? 'bg-red-600 border-red-600 text-white shadow-xs'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    🎯 Limitar Vagas
                  </button>
                </div>
                {(config as any)?.limite_vagas && (
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-xs text-slate-600 font-semibold">Total de Vagas:</span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setConfig({ ...config, limite_vagas: Math.max(2, ((config as any)?.limite_vagas || 12) - 1) } as any)}
                        className="w-7 h-7 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-750 flex items-center justify-center font-bold text-sm cursor-pointer"
                      >
                        -
                      </button>
                      <span className="text-sm font-black text-slate-900 w-8 text-center">
                        {(config as any)?.limite_vagas}
                      </span>
                      <button
                        type="button"
                        onClick={() => setConfig({ ...config, limite_vagas: ((config as any)?.limite_vagas || 12) + 1 } as any)}
                        className="w-7 h-7 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-750 flex items-center justify-center font-bold text-sm cursor-pointer"
                      >
                        +
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Vincular a um Grupo */}
              <div className="space-y-1.5 p-3 bg-slate-50 border border-slate-200 rounded-xl text-left">
                <label className="text-xs font-bold text-slate-700 uppercase flex items-center justify-between">
                  <span>Grupo Vinculado</span>
                  {selectedGrupoId && (
                    <span className="text-[9px] font-bold text-emerald-650 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                      Pontua no Ranking
                    </span>
                  )}
                </label>
                <select
                  value={selectedGrupoId || ''}
                  onChange={(e) => setSelectedGrupoId(e.target.value || null)}
                  className="w-full bg-white border border-slate-250 rounded-xl py-2 px-3 text-xs text-slate-800 font-bold focus:outline-none focus:ring-2 focus:ring-red-500/30 shadow-2xs"
                >
                  <option value="">Nenhum (Evento Público / Avulso)</option>
                  {meusGruposDisponiveis.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.nome}
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-slate-450 leading-tight">
                  Ao vincular o evento a um grupo, as vitórias disputadas aqui serão contabilizadas na Classificação do grupo!
                </p>
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

      {/* Modal de Animação de Sorteio */}
      {isDrawing && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-6 animate-fade-in">
          <div className="bg-white/10 border border-white/20 rounded-3xl w-full max-w-sm shadow-2xl p-8 flex flex-col items-center justify-center space-y-6 text-center text-white relative overflow-hidden">
            <style>{`
              @keyframes loadingProgress {
                0% { width: 0%; }
                100% { width: 100%; }
              }
            `}</style>
            
            {/* Efeitos de Luz de Fundo */}
            <div className="absolute -top-12 -left-12 w-32 h-32 bg-red-500/25 rounded-full blur-2xl animate-pulse" />
            <div className="absolute -bottom-12 -right-12 w-32 h-32 bg-cyan-500/25 rounded-full blur-2xl animate-pulse" />

            {/* Ícone Principal Girando/Pulsando */}
            <div className="relative flex items-center justify-center w-24 h-24 bg-gradient-to-tr from-[#eb3237] to-red-500 rounded-full shadow-lg shadow-red-500/30 animate-bounce">
              <Trophy size={42} className="text-white animate-pulse" />
              <div className="absolute inset-0 border-4 border-dashed border-white/40 rounded-full animate-spin [animation-duration:8s]" />
            </div>

            {/* Textos */}
            <div className="space-y-2">
              <h2 className="text-xl font-black tracking-widest uppercase bg-gradient-to-r from-white via-slate-100 to-slate-350 bg-clip-text text-transparent">
                Sorteando Times
              </h2>
              <p className="text-xs text-slate-350 font-bold uppercase tracking-widest">
                Definindo os confrontos...
              </p>
            </div>

            {/* Efeito de Shuffle do Jogador Atual Sendo "Processado" */}
            <div className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 min-h-[70px] flex flex-col items-center justify-center relative overflow-hidden">
              <span className="text-[10px] font-black text-red-400 uppercase tracking-widest mb-1 animate-pulse">
                Selecionando
              </span>
              <span className="text-base font-extrabold tracking-wide truncate max-w-full animate-fade-in text-white">
                {shuffleName}
              </span>
            </div>

            {/* Barra de Progresso Animada */}
            <div className="w-full bg-white/15 h-1.5 rounded-full overflow-hidden">
              <div 
                className="bg-gradient-to-r from-red-500 via-amber-500 to-cyan-500 h-full rounded-full"
                style={{
                  animation: 'loadingProgress 2s linear forwards'
                }}
              />
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

      {/* Modal de Substituição */}
      {showSubstituirModal && substituirTarget && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl p-6 flex flex-col space-y-4 max-h-[80vh] overflow-hidden">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                <UserPlus size={16} className="text-red-500" />
                Preencher Vaga - {substituirTarget.timeIndex === 1 ? 'Time A' : 'Time B'}
              </h3>
              <button 
                onClick={() => {
                  setShowSubstituirModal(false);
                  setSubstituirTarget(null);
                }} 
                className="text-slate-450 hover:text-slate-650 cursor-pointer border-0 bg-transparent"
              >
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 pr-1">
              {jogadoresFila.length === 0 ? (
                <p className="text-xs text-slate-500 text-center py-4">
                  Nenhum jogador disponível na fila de espera. Marque novos jogadores na lista de presentes.
                </p>
              ) : (
                <>
                  {/* Opção Recomendada (Próximo da fila por prioridade N) */}
                  {filaOrdenada.length > 0 && (
                    <div className="space-y-1">
                      <span className="text-[10px] font-black uppercase text-red-500 tracking-wider">
                        Próximo da fila (Recomendado)
                      </span>
                      <button
                        onClick={() => handleAdicionarJogadorAoTimeAtivo(substituirTarget.timeIndex, filaOrdenada[0])}
                        className="w-full p-3 rounded-xl border border-red-200 bg-red-50/50 hover:bg-red-50 text-left transition-all flex items-center justify-between cursor-pointer"
                      >
                        <span className="text-xs font-bold text-red-700">
                          {filaOrdenada[0].nome}
                        </span>
                        <span className="text-[10px] bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-bold">
                          Prio {filaOrdenada[0].prioridade || 0}
                        </span>
                      </button>
                    </div>
                  )}

                  {/* Lista de Seleção Manual */}
                  <div className="space-y-1">
                    <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider">
                      Selecionar jogador manualmente
                    </span>
                    <div className="grid gap-1.5">
                      {filaOrdenada.map((jogador) => (
                        <button
                          key={jogador.id}
                          onClick={() => handleAdicionarJogadorAoTimeAtivo(substituirTarget.timeIndex, jogador)}
                          className="w-full p-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-left transition-all flex items-center justify-between cursor-pointer text-slate-800"
                        >
                          <span className="text-xs font-semibold">{jogador.nome}</span>
                          <span className="text-[10px] text-slate-500">
                            Prio {jogador.prioridade || 0}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>

            <button
              onClick={() => {
                setShowSubstituirModal(false);
                setSubstituirTarget(null);
              }}
              className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all cursor-pointer border-0"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Modal de Pódio/Ranking Final */}
      {showPodium && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-6 animate-fade-in">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl p-6 flex flex-col space-y-4 max-h-[90vh] overflow-y-auto animate-slide-in relative">
            {/* Botão de voltar (apenas no passo 2) */}
            {podiumStep === 2 && (
              <button
                onClick={() => setPodiumStep(1)}
                className="absolute top-4 left-4 p-1 text-slate-400 hover:text-slate-650 rounded-lg hover:bg-slate-100 transition-all border-0 bg-transparent cursor-pointer"
                title="Voltar para o Pódio"
              >
                <ArrowLeft size={16} />
              </button>
            )}

            {podiumStep === 1 ? (
              /* PASSO 1: PÓDIO E RANKING COMPLETO */
              <div id="ranking-podium-content" className="flex flex-col space-y-4 w-full">
                {/* Header */}
                <div className="text-center">
                  <span className="text-2xl">🏆</span>
                  <h2 className="text-lg font-black text-slate-900 uppercase mt-1">Ranking Final</h2>
                  <p className="text-[10px] font-bold text-slate-450 uppercase tracking-widest">{evento?.descricao}</p>
                </div>

                {/* Render 3D Podium */}
                {(() => {
                  const ranked = [...participantes].sort((a, b) => {
                    const vA = a.jogosGanhos || 0;
                    const vB = b.jogosGanhos || 0;
                    const dA = (a.jogos || 0) - vA;
                    const dB = (b.jogos || 0) - vB;
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
                            <span className="text-[9px] font-semibold text-slate-500">{p2.jogosGanhos || 0} Vit.</span>
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
                            <span className="text-[10px] font-black text-amber-600">{p1.jogosGanhos || 0} Vit.</span>
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
                            <span className="text-[9px] font-semibold text-slate-500">{p3.jogosGanhos || 0} Vit.</span>
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
                              <span className="font-extrabold text-slate-500 text-[10px]">{player.jogosGanhos || 0} vitórias</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>
            ) : (
              /* PASSO 2: TIME DOS SONHOS E TIME PESADELO */
              <div id="ranking-highlights-content" className="flex flex-col space-y-4 text-center w-full">
                {/* Header */}
                <div>
                  <span className="text-2xl">✨</span>
                  <h2 className="text-lg font-black text-slate-900 uppercase mt-1">Destaques do Evento</h2>
                  <p className="text-[10px] font-bold text-slate-450 uppercase tracking-widest">{evento?.descricao}</p>
                </div>

                {/* Content columns */}
                {(() => {
                  const ranked = [...participantes].sort((a, b) => {
                    const vA = a.jogosGanhos || 0;
                    const vB = b.jogosGanhos || 0;
                    const dA = (a.jogos || 0) - vA;
                    const dB = (b.jogos || 0) - vB;
                    if (vB !== vA) return vB - vA;
                    return dA - dB;
                  });

                  // Dream Team: top 6 (ou metade dos jogadores se total < 12)
                  const limit = Math.min(6, Math.ceil(ranked.length / 2));
                  const dreamTeam = ranked.slice(0, limit);

                  // Nightmare Team: bottom 6 (ou metade de baixo)
                  const nightmareLimit = Math.min(6, Math.floor(ranked.length / 2));
                  const nightmareTeam = [...ranked].reverse().slice(0, nightmareLimit);

                  return (
                    <div className="space-y-4">
                      {/* Time dos Sonhos */}
                      <div className="p-3.5 bg-gradient-to-br from-amber-50 to-amber-100/35 border border-amber-300 rounded-2xl text-left space-y-2 shadow-sm">
                        <h3 className="text-xs font-black text-amber-600 uppercase tracking-wider flex items-center gap-1.5 border-b border-amber-200 pb-1.5">
                          <Crown size={14} className="text-amber-500" />
                          Time dos Sonhos
                        </h3>
                        <div className="grid grid-cols-2 gap-1.5">
                          {dreamTeam.map((p, idx) => (
                            <div key={p.id} className="flex justify-between items-center bg-white/80 py-1.5 px-2 rounded-lg text-[10px] border border-amber-150">
                              <div className="flex items-center gap-1.5 min-w-0 flex-1">
                                <span className="font-bold text-slate-400 flex-shrink-0">#{idx + 1}</span>
                                {p.foto ? (
                                  <img src={p.foto} alt={p.nome} className="w-5 h-5 rounded-full object-cover ring-1 ring-amber-300/50 flex-shrink-0" />
                                ) : (
                                  <div className="w-5 h-5 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center font-black text-[9px] border border-amber-250 flex-shrink-0">
                                    {p.nome[0]}
                                  </div>
                                )}
                                <span className="font-bold text-slate-700 truncate pr-1">
                                  {p.nome}
                                </span>
                              </div>
                              <span className="text-amber-600 font-extrabold flex-shrink-0">
                                {p.jogosGanhos || 0} Vit.
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Time Pesadelo */}
                      <div className="p-3.5 bg-gradient-to-br from-slate-100 to-slate-200/50 border border-slate-355 rounded-2xl text-left space-y-2 shadow-sm">
                        <h3 className="text-xs font-black text-slate-550 uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-300 pb-1.5">
                          <Skull size={14} className="text-slate-500" />
                          Time Pesadelo
                        </h3>
                        <div className="grid grid-cols-2 gap-1.5">
                          {nightmareTeam.map((p, idx) => (
                            <div key={p.id} className="flex justify-between items-center bg-white/80 py-1.5 px-2 rounded-lg text-[10px] border border-slate-200">
                              <div className="flex items-center gap-1.5 min-w-0 flex-1">
                                <span className="font-bold text-slate-400 flex-shrink-0">#{ranked.length - idx}</span>
                                {p.foto ? (
                                  <img src={p.foto} alt={p.nome} className="w-5 h-5 rounded-full object-cover ring-1 ring-slate-300 flex-shrink-0" />
                                ) : (
                                  <div className="w-5 h-5 rounded-full bg-slate-150 text-slate-650 flex items-center justify-center font-bold text-[9px] border border-slate-250 flex-shrink-0">
                                    {p.nome[0]}
                                  </div>
                                )}
                                <span className="font-bold text-slate-700 truncate pr-1">
                                  {p.nome}
                                </span>
                              </div>
                              <span className="text-slate-550 font-semibold flex-shrink-0">
                                {p.jogosGanhos || 0} Vit.
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}

            {/* Botões de Ação */}
            <div className="flex gap-2 w-full pt-1.5">
              <button
                onClick={handleCompartilharRanking}
                className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-md active:scale-95 transition-all text-xs flex justify-center items-center gap-1.5 cursor-pointer border-0"
              >
                <Share2 size={15} />
                <span>Compartilhar</span>
              </button>

              {podiumStep === 1 ? (
                <button
                  onClick={() => setPodiumStep(2)}
                  className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-lg active:scale-95 transition-all text-xs cursor-pointer text-center border-0"
                >
                  Avançar
                </button>
              ) : (
                <button
                  onClick={() => {
                    setShowPodium(false);
                    navigate('/');
                  }}
                  className="flex-1 py-3 bg-[#eb3237] hover:bg-red-650 text-white font-bold rounded-xl shadow-lg active:scale-95 transition-all text-xs cursor-pointer text-center border-0"
                >
                  Ir para a Home
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE HISTÓRICO DE PARTIDAS DO EVENTO */}
      {showHistoryModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center" onClick={() => setShowHistoryModal(false)}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <div
            className="relative w-full max-w-md bg-white rounded-t-3xl shadow-2xl p-6 space-y-4 max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-10 h-1 bg-slate-200 rounded-full mx-auto mb-2" />
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <History size={18} className="text-red-500" />
                <h2 className="text-base font-black text-slate-900">Histórico de Partidas</h2>
              </div>
              <button onClick={() => setShowHistoryModal(false)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500">
                <X size={18} />
              </button>
            </div>

            {(() => {
              const historico = (config as any)?.historico_partidas || [];
              if (!Array.isArray(historico) || historico.length === 0) {
                return (
                  <div className="text-center py-8 text-slate-400">
                    <History size={32} className="mx-auto mb-2 opacity-50" />
                    <p className="text-xs font-semibold">Nenhuma partida finalizada neste evento ainda.</p>
                  </div>
                );
              }

              return (
                <div className="space-y-3">
                  {historico.map((partida: any, idx: number) => (
                    <div key={partida.id || idx} className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                      <div className="flex items-center justify-between text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                        <span>Partida #{idx + 1}</span>
                        <span>{dayjs(partida.data).format('HH:mm:ss')}</span>
                      </div>

                      {/* Placar e Times */}
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        {/* Time 1 */}
                        <div className={`p-2.5 rounded-xl border ${partida.vencedor === 1 ? 'bg-red-50 border-red-200 text-red-900 font-black' : 'bg-white border-slate-200 text-slate-600'}`}>
                          <div className="flex justify-between items-center mb-1">
                            <span className="font-bold">Time A</span>
                            <span className="text-sm font-black">{partida.placarTime1}</span>
                          </div>
                          <div className="text-[10px] space-y-0.5 opacity-80 font-normal">
                            {(partida.time1 || []).map((p: any) => (
                              <div key={p.id}>{p.nome}</div>
                            ))}
                          </div>
                        </div>

                        {/* Time 2 */}
                        <div className={`p-2.5 rounded-xl border ${partida.vencedor === 2 ? 'bg-blue-50 border-blue-200 text-blue-900 font-black' : 'bg-white border-slate-200 text-slate-600'}`}>
                          <div className="flex justify-between items-center mb-1">
                            <span className="font-bold">Time B</span>
                            <span className="text-sm font-black">{partida.placarTime2}</span>
                          </div>
                          <div className="text-[10px] space-y-0.5 opacity-80 font-normal">
                            {(partida.time2 || []).map((p: any) => (
                              <div key={p.id}>{p.nome}</div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>
        </div>
      )}
      <Dialog {...dialog} />
    </div>
  );
}
