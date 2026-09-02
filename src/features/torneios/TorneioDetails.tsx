import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import type { Torneio, TorneioConfronto } from '../../types/torneio';
import { Trophy, ArrowLeft, Shuffle, Calendar, GitMerge, Award, CheckCircle2, Clock, Edit3, Save, Trash2, UserPlus, UserCheck, Plus, UserMinus, Users, Link, Share2, Lock } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import dayjs from 'dayjs';
import Dialog from '../../components/common/Dialog';

export default function TorneioDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [torneio, setTorneio] = useState<Torneio | null>(null);
  const [loading, setLoading] = useState(true);
  const [sorteando, setSorteando] = useState(false);
  const [showDrawAnimation, setShowDrawAnimation] = useState(false);
  const [editDateModal, setEditDateModal] = useState(false);
  
  // Modal de Avisos e Confirmações elegante (Dialog)
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

  const [todasPessoas, setTodasPessoas] = useState<any[]>([]);
  const [currentUser, setCurrentUser] = useState<any | null>(null);
  const [expandedTeamId, setExpandedTeamId] = useState<string | null>(null);
  const [showParticipantesModal, setShowParticipantesModal] = useState(false);

  // Modal para Inscrever Time Fechado completo (Nome do Time + Jogadores)
  const [showInscreverTimeModal, setShowInscreverTimeModal] = useState(false);
  const [nomeNovoTime, setNomeNovoTime] = useState('');
  const [jogadoresTimeFechado, setJogadoresTimeFechado] = useState<{ id: string; nome: string }[]>([]);
  const [buscaJogadorTime, setBuscaJogadorTime] = useState('');
  const [sugestoesJogadorTime, setSugestoesJogadorTime] = useState<any[]>([]);

  // Modal para Adicionar Jogadores aos Inscritos (Sorteio)
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [targetTeamId, setTargetTeamId] = useState<string | null>(null);
  const [buscaAtleta, setBuscaAtleta] = useState('');
  const [sugestoesAtletas, setSugestoesAtletas] = useState<any[]>([]);

  // Edição de data/hora
  const [editInicio, setEditInicio] = useState('');
  const [editFim, setEditFim] = useState('');

  useEffect(() => {
    fetchTorneio();
    loadTodasPessoas();
  }, [id]);

  const loadTodasPessoas = async () => {
    try {
      const { data: dbUsers } = await supabase.from('usuarios').select('id, nome, foto, email');
      if (dbUsers) setTodasPessoas(dbUsers);

      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const myProfile = dbUsers?.find((u) => u.email === user.email) || { id: user.id, email: user.email, nome: user.user_metadata?.name || 'Eu' };
        setCurrentUser(myProfile);
      }
    } catch (e) {
      console.error('Erro ao carregar usuários:', e);
    }
  };

  const fetchTorneio = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('torneios')
        .select('*')
        .eq('id', id)
        .single();

      if (!error && data) {
        setTorneio(data as Torneio);
        setEditInicio(data.data_inicio || '');
        setEditFim(data.data_fim || '');
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleExcluirTorneio = () => {
    if (!torneio) return;
    setDialog({
      isOpen: true,
      title: 'Excluir Torneio',
      message: `Tem certeza que deseja excluir o torneio "${torneio.nome}"? Esta ação não poderá ser desfeita.`,
      type: 'confirm',
      onCancel: () => setDialog((prev) => ({ ...prev, isOpen: false })),
      onConfirm: async () => {
        setDialog((prev) => ({ ...prev, isOpen: false }));
        try {
          await supabase.from('torneios').delete().eq('id', torneio.id);
          navigate('/torneios');
        } catch (e: any) {
          setDialog({
            isOpen: true,
            title: 'Erro ao Excluir',
            message: e.message || 'Não foi possível excluir o torneio.',
            type: 'alert',
            onConfirm: () => setDialog((prev) => ({ ...prev, isOpen: false })),
          });
        }
      },
    });
  };

  // Buscar sugestões ao digitar no campo de atleta
  const handleBuscaChange = (txt: string) => {
    setBuscaAtleta(txt);
    if (!txt.trim()) {
      setSugestoesAtletas([]);
      return;
    }

    const filtrados = todasPessoas.filter((p) =>
      p.nome.toLowerCase().includes(txt.toLowerCase()) ||
      p.email?.toLowerCase().includes(txt.toLowerCase())
    );
    setSugestoesAtletas(filtrados.slice(0, 5));
  };

  // Adicionar Atleta (Geral ou para um Time Específico)
  const handleAdicionarAtleta = async (atleta: any) => {
    if (!torneio) return;

    if (targetTeamId) {
      // Adicionar a um Time Fechado Específico
      const novosTimes = torneio.times.map((t) => {
        if (t.id === targetTeamId) {
          const jogadores = t.jogadores || [];
          if (jogadores.some((j) => j.id === atleta.id)) return t;
          return { ...t, jogadores: [...jogadores, { id: atleta.id, nome: atleta.nome }] };
        }
        return t;
      });

      // Também inclui na lista geral de participantes inscritos caso não esteja
      const participantes = torneio.participantes || [];
      const novosParticipantes = participantes.some((p) => p.id === atleta.id)
        ? participantes
        : [...participantes, { id: atleta.id, nome: atleta.nome, foto: atleta.foto || '' }];

      const updates = { times: novosTimes, participantes: novosParticipantes };
      setTorneio({ ...torneio, ...updates });
      await supabase.from('torneios').update(updates).eq('id', torneio.id);
    } else {
      // Adicionar aos Inscritos Gerais
      const participantes = torneio.participantes || [];
      if (participantes.some((p) => p.id === atleta.id)) {
        setDialog({
          isOpen: true,
          title: 'Aviso',
          message: `${atleta.nome} já está inscrito neste torneio.`,
          type: 'alert',
          onConfirm: () => setDialog((prev) => ({ ...prev, isOpen: false })),
        });
        return;
      }

      const novosParticipantes = [...participantes, { id: atleta.id, nome: atleta.nome, foto: atleta.foto || '' }];
      const updates = { participantes: novosParticipantes };
      setTorneio({ ...torneio, ...updates });
      await supabase.from('torneios').update(updates).eq('id', torneio.id);
    }

    setBuscaAtleta('');
    setSugestoesAtletas([]);
    setShowAddUserModal(false);
  };

  // Remover Atleta dos Inscritos Gerais
  const handleRemoverParticipante = async (participanteId: string) => {
    if (!torneio) return;
    const novosParticipantes = (torneio.participantes || []).filter((p) => p.id !== participanteId);
    
    // Também limpa dos times fechados se tiver
    const novosTimes = torneio.times.map((t) => ({
      ...t,
      jogadores: (t.jogadores || []).filter((j) => j.id !== participanteId),
    }));

    const updates = { participantes: novosParticipantes, times: novosTimes };
    setTorneio({ ...torneio, ...updates });
    await supabase.from('torneios').update(updates).eq('id', torneio.id);
  };

  // Remover Atleta de um Time Fechado específico
  const handleRemoverAtletaDoTime = async (teamId: string, jogadorId: string) => {
    if (!torneio) return;
    const novosTimes = torneio.times.map((t) => {
      if (t.id === teamId) {
        return { ...t, jogadores: (t.jogadores || []).filter((j) => j.id !== jogadorId) };
      }
      return t;
    });

    const updates = { times: novosTimes };
    setTorneio({ ...torneio, ...updates });
    await supabase.from('torneios').update(updates).eq('id', torneio.id);
  };

  // Salvar um Time Fechado completo (Nome + Elenco de Atletas)
  const handleSalvarTimeFechado = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!torneio) return;

    if (!nomeNovoTime.trim()) {
      setDialog({
        isOpen: true,
        title: 'Nome Obrigatório',
        message: 'Por favor, informe o nome do seu time.',
        type: 'alert',
        onConfirm: () => setDialog((prev) => ({ ...prev, isOpen: false })),
      });
      return;
    }

    const minAtletas = torneio.jogadores_por_time || 2;
    if (jogadoresTimeFechado.length < minAtletas) {
      setDialog({
        isOpen: true,
        title: 'Mínimo de Jogadores',
        message: `O time precisa ter no mínimo ${minAtletas} jogadores cadastrados (opção ${minAtletas}x${minAtletas}).`,
        type: 'alert',
        onConfirm: () => setDialog((prev) => ({ ...prev, isOpen: false })),
      });
      return;
    }

    // Paleta de cores vibrantes para distinguir os cards dos times
    const teamColors = [
      'bg-amber-500/10 border-amber-300 text-amber-950',
      'bg-blue-500/10 border-blue-300 text-blue-950',
      'bg-emerald-500/10 border-emerald-300 text-emerald-950',
      'bg-purple-500/10 border-purple-300 text-purple-950',
      'bg-rose-500/10 border-rose-300 text-rose-950',
      'bg-cyan-500/10 border-cyan-300 text-cyan-950',
      'bg-orange-500/10 border-orange-300 text-orange-950',
      'bg-indigo-500/10 border-indigo-300 text-indigo-950',
    ];

    // Procura o primeiro slot de time vago ou atualiza o slot alvo
    let timeSubstituido = false;
    const novosTimes = torneio.times.map((t, idx) => {
      if (!timeSubstituido && (targetTeamId ? t.id === targetTeamId : (!t.jogadores || t.jogadores.length === 0))) {
        timeSubstituido = true;
        return {
          ...t,
          nome: nomeNovoTime.trim(),
          criador_id: currentUser?.id || t.criador_id,
          cor: t.cor || teamColors[idx % teamColors.length],
          jogadores: jogadoresTimeFechado,
        };
      }
      return t;
    });

    if (!timeSubstituido) {
      setDialog({
        isOpen: true,
        title: 'Torneio Lotado',
        message: 'Todos os slots de times para este torneio já foram preenchidos!',
        type: 'alert',
        onConfirm: () => setDialog((prev) => ({ ...prev, isOpen: false })),
      });
      return;
    }

    // Adiciona todos os atletas à lista geral de inscritos do torneio
    const participantes = torneio.participantes || [];
    const novosParticipantes = [...participantes];
    jogadoresTimeFechado.forEach((j) => {
      if (!novosParticipantes.some((p) => p.id === j.id)) {
        const userObj = todasPessoas.find((u) => u.id === j.id);
        novosParticipantes.push({ id: j.id, nome: j.nome, foto: userObj?.foto || '' });
      }
    });

    const updates = { times: novosTimes, participantes: novosParticipantes };
    setTorneio({ ...torneio, ...updates });
    await supabase.from('torneios').update(updates).eq('id', torneio.id);

    // Reseta formulário do modal
    setNomeNovoTime('');
    setJogadoresTimeFechado([]);
    setBuscaJogadorTime('');
    setSugestoesJogadorTime([]);
    setShowInscreverTimeModal(false);

    setDialog({
      isOpen: true,
      title: 'Time Cadastrado! 🎉',
      message: `O time "${nomeNovoTime.trim()}" foi inscrito com sucesso no torneio com ${jogadoresTimeFechado.length} jogadores!`,
      type: 'alert',
      onConfirm: () => setDialog((prev) => ({ ...prev, isOpen: false })),
    });
  };

  // Excluir / Cancelar Inscrição do Time
  const handleExcluirTime = (teamId: string, teamNome: string) => {
    if (!torneio) return;
    setDialog({
      isOpen: true,
      title: 'Excluir Time',
      message: `Tem certeza que deseja cancelar a inscrição do time "${teamNome}"?`,
      type: 'confirm',
      onCancel: () => setDialog((prev) => ({ ...prev, isOpen: false })),
      onConfirm: async () => {
        setDialog((prev) => ({ ...prev, isOpen: false }));

        const timeRemovido = torneio.times.find((t) => t.id === teamId);
        const idsRemovidos = timeRemovido?.jogadores?.map((j) => j.id) || [];

        const novosTimes = torneio.times.map((t) => {
          if (t.id === teamId) {
            return {
              id: t.id,
              nome: `Time ${t.id.replace('t_', '').split('_')[0]}`,
              jogadores: [],
            };
          }
          return t;
        });

        // Limpa também dos participantes gerais
        const novosParticipantes = (torneio.participantes || []).filter((p) => !idsRemovidos.includes(p.id));

        const updates = { times: novosTimes, participantes: novosParticipantes };
        setTorneio({ ...torneio, ...updates });
        await supabase.from('torneios').update(updates).eq('id', torneio.id);
      },
    });
  };

  // Participar Individualmente (Quando for por Sorteio)
  const handleParticiparIndividual = async () => {
    if (!torneio) return;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setDialog({
          isOpen: true,
          title: 'Login Necessário',
          message: 'Você precisa estar logado para se inscrever no torneio.',
          type: 'alert',
          onConfirm: () => setDialog((prev) => ({ ...prev, isOpen: false })),
        });
        return;
      }

      const { data: profile } = await supabase.from('usuarios').select('id, nome, foto').eq('email', user.email).single();
      const me = profile || { id: user.id, nome: user.user_metadata?.name || 'Jogador', foto: '' };

      const participantes = torneio.participantes || [];
      if (participantes.some((p) => p.id === me.id)) {
        setDialog({
          isOpen: true,
          title: 'Já Inscrito',
          message: 'Você já está inscrito neste torneio!',
          type: 'alert',
          onConfirm: () => setDialog((prev) => ({ ...prev, isOpen: false })),
        });
        return;
      }

      const totalVagas = (torneio.quantidade_times || 4) * (torneio.jogadores_por_time || 2);
      if (participantes.length >= totalVagas) {
        setDialog({
          isOpen: true,
          title: 'Vagas Esgotadas',
          message: 'Todas as vagas para este torneio já foram preenchidas.',
          type: 'alert',
          onConfirm: () => setDialog((prev) => ({ ...prev, isOpen: false })),
        });
        return;
      }

      const novosParticipantes = [...participantes, { id: me.id, nome: me.nome, foto: me.foto || '' }];
      const updates = { participantes: novosParticipantes };
      setTorneio({ ...torneio, ...updates });
      await supabase.from('torneios').update(updates).eq('id', torneio.id);

      setDialog({
        isOpen: true,
        title: 'Inscrição Confirmada! 🎉',
        message: 'Sua inscrição no torneio foi realizada com sucesso!',
        type: 'alert',
        onConfirm: () => setDialog((prev) => ({ ...prev, isOpen: false })),
      });
    } catch (e: any) {
      console.error(e);
    }
  };

  // Algoritmo de Sorteio de Chaveamento / Pontos Corridos
  const handleSortearChaveamento = async () => {
    if (!torneio) return;

    const totalTimes = torneio.quantidade_times || 4;
    const porTime = torneio.jogadores_por_time || 2;
    const minJogadoresNecessarios = totalTimes * porTime;
    const inscritos = torneio.participantes || [];

    // Se os times forem por sorteio, valida se a lista completa de atletas foi preenchida
    if (torneio.tipo_times === 'sorteio' && inscritos.length < minJogadoresNecessarios) {
      setDialog({
        isOpen: true,
        title: 'Jogadores Insuficientes',
        message: `Não é possível sortear o chaveamento ainda!\n\nO torneio necessita de no mínimo ${minJogadoresNecessarios} atletas inscritos (${porTime} por time em ${totalTimes} times).\nAtualmente existem apenas ${inscritos.length} atleta(s) inscrito(s).`,
        type: 'alert',
        onConfirm: () => setDialog((prev) => ({ ...prev, isOpen: false })),
      });
      return;
    }

    // Se for times fechados, valida se todos os times já tem seus jogadores definidos
    if (torneio.tipo_times === 'fechado') {
      const timeIncompleto = torneio.times.find((t) => (t.jogadores?.length || 0) < porTime);
      if (timeIncompleto) {
        setDialog({
          isOpen: true,
          title: 'Times Incompletos',
          message: `Não é possível sortear o chaveamento ainda!\n\nO time "${timeIncompleto.nome}" possui apenas ${timeIncompleto.jogadores?.length || 0} de ${porTime} jogadores definidos. Monte todos os times antes de realizar o sorteio.`,
          type: 'alert',
          onConfirm: () => setDialog((prev) => ({ ...prev, isOpen: false })),
        });
        return;
      }
    }

    setSorteando(true);
    setShowDrawAnimation(true);

    let finalTimes = [...torneio.times];
    if (torneio.tipo_times === 'sorteio' && inscritos.length >= minJogadoresNecessarios) {
      const inscritosEmbaralhados = [...inscritos].sort(() => Math.random() - 0.5);
      finalTimes = finalTimes.map((t, idx) => {
        const timeJogadores = inscritosEmbaralhados.slice(idx * porTime, (idx + 1) * porTime);
        return {
          ...t,
          jogadores: timeJogadores.map((j) => ({ id: j.id, nome: j.nome })),
        };
      });
    }

    // Embaralha a ordem dos times aleatoriamente para montar as chaves
    const timesEmbaralhados = [...finalTimes].sort(() => Math.random() - 0.5);
    const novosConfrontos: TorneioConfronto[] = [];

    if (torneio.formato === 'chaveamento') {
      const numTimes = timesEmbaralhados.length;
      let faseNome = 'Quartas de Final';
      if (numTimes <= 4) faseNome = 'Semifinal';
      if (numTimes <= 2) faseNome = 'Final';

      for (let i = 0; i < numTimes; i += 2) {
        const timeA = timesEmbaralhados[i];
        const timeB = timesEmbaralhados[i + 1] || { id: 'bye', nome: 'Aguardando' };
        novosConfrontos.push({
          id: `match_${i / 2}_${Date.now()}`,
          fase: faseNome,
          rodada: 1,
          timeA,
          timeB,
          placarA: 0,
          placarB: 0,
        });
      }
    } else {
      const n = timesEmbaralhados.length;
      let matchCounter = 1;
      for (let i = 0; i < n; i++) {
        for (let j = i + 1; j < n; j++) {
          novosConfrontos.push({
            id: `match_pc_${matchCounter}_${Date.now()}`,
            fase: `Rodada ${Math.ceil(matchCounter / Math.floor(n / 2))}`,
            rodada: matchCounter,
            timeA: timesEmbaralhados[i],
            timeB: timesEmbaralhados[j],
            placarA: 0,
            placarB: 0,
          });
          matchCounter++;
        }
      }
    }

    setTimeout(async () => {
      try {
        const updates = {
          times: finalTimes,
          chaveamento: novosConfrontos,
          status: 'sorteado' as const,
        };

        await supabase.from('torneios').update(updates).eq('id', torneio.id);
        setTorneio((prev) => (prev ? ({ ...prev, ...updates } as Torneio) : null));
      } catch (e) {
        console.error('Erro ao salvar sorteio:', e);
      } finally {
        setSorteando(false);
        setShowDrawAnimation(false);
      }
    }, 2500);
  };

  const handleSalvarDatas = async () => {
    if (!torneio) return;
    try {
      const updates = {
        data_inicio: editInicio,
        data_fim: editFim || undefined,
      };
      await supabase.from('torneios').update(updates).eq('id', torneio.id);
      setTorneio((prev) => (prev ? ({ ...prev, ...updates } as Torneio) : null));
      setEditDateModal(false);
    } catch (e) {
      console.error(e);
    }
  };

  const handleAtualizarPlacar = async (matchId: string, pA: number, pB: number) => {
    if (!torneio) return;
    const novosConfrontos = torneio.chaveamento.map((c) => {
      if (c.id === matchId) {
        let vencedorId: string | undefined = undefined;
        if (pA > pB) vencedorId = c.timeA.id;
        if (pB > pA) vencedorId = c.timeB.id;
        return { ...c, placarA: pA, placarB: pB, vencedorId };
      }
      return c;
    });

    setTorneio({ ...torneio, chaveamento: novosConfrontos });
    await supabase.from('torneios').update({ chaveamento: novosConfrontos }).eq('id', torneio.id);
  };

  const handleCopiarLink = () => {
    if (!torneio) return;

    // Checa se as vagas de times ou atletas já estão 100% preenchidas
    const timesPreenchidos = torneio.times.filter((t) => (t.jogadores?.length || 0) > 0).length;
    const isTorneioLotado = timesPreenchidos >= torneio.quantidade_times;

    if (isTorneioLotado) {
      setDialog({
        isOpen: true,
        title: 'Inscrições Encerradas! 🔒',
        message: `As inscrições para o torneio "${torneio.nome}" foram encerradas pois a quantidade limite de ${torneio.quantidade_times} times já foi atingida! O torneio está prestes a começar.`,
        type: 'alert',
        onConfirm: () => setDialog((prev) => ({ ...prev, isOpen: false })),
      });
      return;
    }

    const shareUrl = window.location.href;
    const shareText = `🏆 Venha participar do torneio "${torneio.nome}" no GoPlay!\n\nAcesse o link para ver o chaveamento e se inscrever:\n${shareUrl}`;

    if (navigator.share) {
      navigator.share({
        title: torneio.nome,
        text: shareText,
        url: shareUrl,
      }).catch(() => {});
    } else {
      navigator.clipboard.writeText(shareUrl);
      setDialog({
        isOpen: true,
        title: 'Link Copiado! 🔗',
        message: 'O link de convite do torneio foi copiado para a sua área de transferência. Compartilhe com quem quiser!',
        type: 'alert',
        onConfirm: () => setDialog((prev) => ({ ...prev, isOpen: false })),
      });
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[calc(100vh-8rem)]">
        <div className="w-8 h-8 border-4 border-red-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!torneio) {
    return (
      <div className="p-6 text-center">
        <p className="text-slate-600">Torneio não encontrado.</p>
        <button onClick={() => navigate('/torneios')} className="mt-4 text-red-500 font-bold underline">
          Voltar para Torneios
        </button>
      </div>
    );
  }

  return (
    <div className="px-4 py-3 pb-24 w-full max-w-md mx-auto min-h-[calc(100vh-8rem)] space-y-5 relative">
      {/* Overlay de Animação Magnífica do Sorteio */}
      <AnimatePresence>
        {showDrawAnimation && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[999] bg-slate-950/90 backdrop-blur-md flex flex-col items-center justify-center p-6 text-white text-center space-y-6"
          >
            <motion.div
              animate={{ rotate: 360, scale: [1, 1.2, 1] }}
              transition={{ repeat: Infinity, duration: 1.5, ease: 'easeInOut' }}
              className="w-24 h-24 rounded-full bg-gradient-to-tr from-amber-500 to-red-600 p-1 flex items-center justify-center shadow-2xl shadow-amber-500/30"
            >
              <div className="w-full h-full bg-slate-900 rounded-full flex items-center justify-center">
                <Shuffle size={40} className="text-amber-400" />
              </div>
            </motion.div>

            <div className="space-y-2">
              <h2 className="text-2xl font-black tracking-tight">Sorteando Chaveamento...</h2>
              <p className="text-xs text-slate-400">Embaralhando os times e definindo os confrontos da 1ª Rodada!</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/torneios')}
            className="p-2 rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200 cursor-pointer"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="text-xl font-black text-slate-900 leading-tight">{torneio.nome}</h1>
            <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full uppercase tracking-wider">
              {torneio.formato === 'chaveamento' ? 'Chaveamento Eliminatório' : 'Pontos Corridos'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {/* Botão Compartilhar Link */}
          <button
            onClick={handleCopiarLink}
            className="p-2.5 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-xl border border-blue-200 active:scale-95 transition-all cursor-pointer flex items-center gap-1 text-xs font-bold"
            title="Compartilhar Link do Torneio"
          >
            <Share2 size={15} />
            <span>Convite</span>
          </button>

          {/* Botão Excluir Torneio */}
          <button
            onClick={handleExcluirTorneio}
            className="p-2.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl border border-red-200 active:scale-95 transition-all cursor-pointer"
            title="Excluir Torneio"
          >
            <Trash2 size={15} />
          </button>

          {/* Botão de Sortear Chaveamento */}
          <button
            onClick={handleSortearChaveamento}
            disabled={sorteando}
            className="p-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl shadow-md active:scale-95 transition-all flex items-center gap-1 text-xs font-black cursor-pointer"
            title="Realizar Sorteio do Chaveamento"
          >
            <Shuffle size={14} />
            <span>Sortear</span>
          </button>
        </div>
      </div>

      {/* Card de Informações e Datas */}
      <div className="glass p-4 rounded-2xl border border-slate-200 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-slate-600">
            <Calendar size={14} className="text-red-500" />
            <span className="font-bold">
              {dayjs(torneio.data_inicio).format('DD/MM/YYYY')}
              {torneio.data_fim ? ` até ${dayjs(torneio.data_fim).format('DD/MM/YYYY')}` : ''}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* Regras para exibição do botão de inscrição e aviso de Inscrições Encerradas */}
            {(() => {
              const timesComIntegrantes = torneio.times.filter((t) => (t.jogadores?.length || 0) > 0).length;
              const isTorneioLotado = timesComIntegrantes >= torneio.quantidade_times;
              const isAdmin = currentUser && torneio.criador_id === currentUser.id;
              const meuTime = currentUser && torneio.times.find((t) => t.jogadores?.some((j) => j.id === currentUser.id));

              if (meuTime) {
                // O usuário já está em um time!
                return (
                  <button
                    onClick={() => {
                      setTargetTeamId(meuTime.id);
                      setNomeNovoTime(meuTime.nome);
                      setJogadoresTimeFechado(meuTime.jogadores || []);
                      setShowInscreverTimeModal(true);
                    }}
                    className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-xs font-black shadow-md active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    <UserCheck size={14} />
                    <span>Meu Time ({meuTime.nome})</span>
                  </button>
                );
              }

              if (isTorneioLotado) {
                // TORNEIO LOTADO: Mostra Badge de Inscrições Encerradas!
                return (
                  <span className="px-3 py-1.5 bg-red-100 border border-red-200 text-red-700 rounded-xl text-xs font-black flex items-center gap-1.5 shadow-xs">
                    <Lock size={13} />
                    <span>Inscrições Encerradas</span>
                  </span>
                );
              }

              if (torneio.tipo_times === 'fechado') {
                return (
                  <button
                    onClick={() => {
                      setTargetTeamId(null);
                      setNomeNovoTime('');
                      setJogadoresTimeFechado([]);
                      setShowInscreverTimeModal(true);
                    }}
                    className="px-3 py-1.5 bg-gradient-to-r from-red-600 to-amber-600 hover:from-red-700 hover:to-amber-700 text-white rounded-xl text-xs font-black shadow-md active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    <UserPlus size={14} />
                    <span>{isAdmin ? 'Inscrever Time' : 'Inscrever Meu Time'}</span>
                  </button>
                );
              } else {
                return (
                  <button
                    onClick={handleParticiparIndividual}
                    className="px-3 py-1.5 bg-gradient-to-r from-red-600 to-amber-600 hover:from-red-700 hover:to-amber-700 text-white rounded-xl text-xs font-black shadow-md active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    <UserPlus size={14} />
                    <span>Quero Participar</span>
                  </button>
                );
              }
            })()}

            <button
              onClick={() => setEditDateModal(true)}
              className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-all cursor-pointer"
              title="Alterar Datas"
            >
              <Edit3 size={14} />
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between text-xs font-semibold text-slate-600 pt-2 border-t border-slate-100">
          <span>👥 {torneio.quantidade_times} Times ({torneio.jogadores_por_time || 2}x{torneio.jogadores_por_time || 2})</span>
          <span>🎲 {torneio.tipo_times === 'sorteio' ? 'Por Sorteio' : 'Fechados'}</span>
          <span>{torneio.publico ? '🌐 Público' : '🔒 Privado'}</span>
        </div>
      </div>

      {/* BANNER VISÍVEL DE INSCRIÇÕES ENCERRADAS */}
      {torneio.times.filter((t) => (t.jogadores?.length || 0) > 0).length >= torneio.quantidade_times && (
        <div className="bg-gradient-to-r from-amber-500/10 via-red-500/10 to-amber-500/10 border border-amber-300 rounded-2xl p-3.5 flex items-center gap-3 text-left shadow-sm">
          <div className="p-2 rounded-xl bg-amber-500 text-white shrink-0 shadow-xs">
            <Lock size={18} />
          </div>
          <div>
            <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider">Inscrições Encerradas! 🏆</h4>
            <p className="text-[11px] font-semibold text-slate-600 leading-snug">
              Todos os {torneio.quantidade_times} times já foram confirmados. O torneio está prestes a começar!
            </p>
          </div>
        </div>
      )}

      {/* Card de Resumo dos Jogadores Inscritos (Compacto e Clicável para Visualização) */}
      <div
        onClick={() => {
          if (torneio.participantes && torneio.participantes.length > 0) {
            setShowParticipantesModal(true);
          }
        }}
        className={`glass p-4 rounded-2xl border border-slate-200 shadow-sm transition-all text-left ${
          torneio.participantes && torneio.participantes.length > 0 ? 'cursor-pointer hover:border-emerald-300 hover:shadow-md' : ''
        }`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <UserCheck size={16} className="text-emerald-500" />
            <div>
              <h3 className="font-black text-xs uppercase tracking-wider text-slate-800">
                Jogadores Inscritos
              </h3>
              <p className="text-[10px] text-slate-500 font-medium">
                {torneio.participantes?.length || 0} de {(torneio.quantidade_times || 4) * (torneio.jogadores_por_time || 2)} atletas confirmados
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-black text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-xl border border-emerald-200">
              {torneio.participantes?.length || 0}/{(torneio.quantidade_times || 4) * (torneio.jogadores_por_time || 2)}
            </span>

            {/* Apenas no modo sorteio individual exibe o botão de adicionar atleta */}
            {torneio.tipo_times === 'sorteio' && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setTargetTeamId(null);
                  setShowAddUserModal(true);
                }}
                className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-300 rounded-lg text-[10px] font-black uppercase tracking-wider flex items-center gap-1 transition-all cursor-pointer shadow-xs active:scale-95"
              >
                <Plus size={12} />
                <span>Adicionar</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* SE FOR TIMES FECHADOS: Painel de Escalação de Cada Time */}
      {torneio.tipo_times === 'fechado' && (
        <div className="glass p-4 rounded-2xl border border-slate-200 shadow-sm space-y-4 text-left">
          <h3 className="font-black text-xs uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
            <Users size={14} className="text-amber-500" />
            Times Confirmados ({torneio.jogadores_por_time || 2} atletas por time)
          </h3>

          <div className="grid grid-cols-2 gap-3">
            {torneio.times.map((time, idx) => {
              const jogadoresCount = time.jogadores?.length || 0;
              const maxJogadores = torneio.jogadores_por_time || 2;
              const isCompleto = jogadoresCount >= maxJogadores;
              const isExpanded = expandedTeamId === time.id;
              const temJogadores = (time.jogadores?.length || 0) > 0;
              
              const isAdmin = currentUser && torneio.criador_id === currentUser.id;
              // Somente quem incluiu o time (Capitão) ou o Admin do Torneio pode editar/excluir o time
              const isCriadorDoTime = currentUser && time.criador_id && time.criador_id === currentUser.id;
              const podeGerenciarTime = isAdmin || isCriadorDoTime;

              // Paleta de cores distintas para os cards dos times
              const cardColors = [
                { bg: 'bg-amber-500/10', border: 'border-amber-300', text: 'text-amber-950', badge: 'bg-amber-100 text-amber-900' },
                { bg: 'bg-blue-500/10', border: 'border-blue-300', text: 'text-blue-950', badge: 'bg-blue-100 text-blue-900' },
                { bg: 'bg-emerald-500/10', border: 'border-emerald-300', text: 'text-emerald-950', badge: 'bg-emerald-100 text-emerald-900' },
                { bg: 'bg-purple-500/10', border: 'border-purple-300', text: 'text-purple-950', badge: 'bg-purple-100 text-purple-900' },
                { bg: 'bg-rose-500/10', border: 'border-rose-300', text: 'text-rose-950', badge: 'bg-rose-100 text-rose-900' },
                { bg: 'bg-cyan-500/10', border: 'border-cyan-300', text: 'text-cyan-950', badge: 'bg-cyan-100 text-cyan-900' },
                { bg: 'bg-orange-500/10', border: 'border-orange-300', text: 'text-orange-950', badge: 'bg-orange-100 text-orange-900' },
                { bg: 'bg-indigo-500/10', border: 'border-indigo-300', text: 'text-indigo-950', badge: 'bg-indigo-100 text-indigo-900' },
              ];

              const currentColor = cardColors[idx % cardColors.length];

              return (
                <div
                  key={time.id}
                  onClick={() => {
                    if (temJogadores) {
                      setExpandedTeamId(isExpanded ? null : time.id);
                    }
                  }}
                  className={`p-3 rounded-2xl border transition-all cursor-pointer space-y-2 ${
                    temJogadores
                      ? `${currentColor.bg} ${currentColor.border} ${isExpanded ? 'shadow-md ring-2 ring-amber-400/30' : 'hover:opacity-90'}`
                      : 'bg-slate-50/50 border-dashed border-slate-200'
                  }`}
                >
                  <div className="flex justify-between items-center pb-1 border-b border-slate-200/80">
                    <span className="font-black text-xs text-slate-900 truncate">{time.nome}</span>
                    <span
                      className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full shrink-0 ${
                        isCompleto ? 'bg-emerald-200/80 text-emerald-950' : currentColor.badge
                      }`}
                    >
                      {jogadoresCount}/{maxJogadores}
                    </span>
                  </div>

                  {/* Se tiver jogadores: exibe retraído ou expandido ao clicar */}
                  {temJogadores ? (
                    <div className="space-y-1.5 pt-1">
                      {isExpanded ? (
                        <div className="space-y-1">
                          {(time.jogadores || []).map((j) => (
                            <div
                              key={j.id}
                              className="flex justify-between items-center text-xs font-semibold text-slate-800 bg-white/90 p-1.5 rounded-lg border border-slate-200/60 shadow-2xs"
                            >
                              <span className="truncate">👤 {j.nome}</span>
                            </div>
                          ))}

                          {/* Botão de edição do elenco completo (Apenas para quem incluiu o time ou Admin) */}
                          {podeGerenciarTime && (
                            <div className="flex gap-1 pt-2">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setTargetTeamId(time.id);
                                  setNomeNovoTime(time.nome);
                                  setJogadoresTimeFechado(time.jogadores || []);
                                  setShowInscreverTimeModal(true);
                                }}
                                className="flex-1 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-[10px] font-black transition-all shadow-xs cursor-pointer"
                              >
                                Editar Elenco
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleExcluirTime(time.id, time.nome);
                                }}
                                className="p-1.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl text-[10px] font-bold border border-red-200 cursor-pointer"
                                title="Excluir Time"
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="text-[10px] font-bold text-slate-600 flex items-center justify-between">
                          <span>{jogadoresCount} atletas</span>
                          <span className="text-slate-400 font-bold text-[9px]">▼ Clique para ver</span>
                        </div>
                      )}
                    </div>
                  ) : (
                    /* Slot Vago */
                    <div>
                      {(isAdmin || !currentUser || !torneio.times.some((t) => t.jogadores?.some((j) => j.id === currentUser?.id))) && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setTargetTeamId(time.id);
                            setNomeNovoTime('');
                            setJogadoresTimeFechado([]);
                            setShowInscreverTimeModal(true);
                          }}
                          className="w-full py-2 border border-dashed border-amber-300 rounded-lg text-center text-[10px] font-bold text-amber-700 hover:bg-amber-50 transition-all flex items-center justify-center gap-1 cursor-pointer"
                        >
                          <Plus size={11} />
                          <span>Inscrever Time</span>
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Visualização das Chaves / Confrontos */}
      {torneio.chaveamento.length === 0 ? (
        <div className="text-center py-10 glass rounded-2xl border border-slate-200 p-6 space-y-4">
          <Shuffle size={36} className="mx-auto text-amber-500" />
          <div>
            <h3 className="font-black text-slate-800 text-sm">Chaveamento ainda não realizado</h3>
            <p className="text-xs text-slate-500 mt-1">Clique no botão "Sortear" acima a qualquer momento para gerar as chaves do torneio!</p>
          </div>
          <button
            onClick={handleSortearChaveamento}
            className="w-full py-3 bg-amber-500 text-white font-black rounded-xl text-xs shadow-md active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-2"
          >
            <Shuffle size={14} />
            <span>Sortear Chaveamento Agora</span>
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          <h2 className="font-black text-xs uppercase tracking-widest text-slate-500 flex items-center gap-1.5">
            <GitMerge size={14} className="text-amber-500" />
            Confrontos do Torneio
          </h2>

          <div className="space-y-3">
            {torneio.chaveamento.map((match) => (
              <div
                key={match.id}
                className="glass p-4 rounded-2xl border border-slate-200 shadow-sm space-y-3"
              >
                <div className="flex justify-between items-center text-[10px] font-black uppercase text-slate-400">
                  <span>{match.fase}</span>
                  <span className="text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">Partida Ativa</span>
                </div>

                <div className="grid grid-cols-5 items-center gap-2">
                  {/* Time A */}
                  <div
                    onClick={() => {
                      if (match.timeA.jogadores && match.timeA.jogadores.length > 0) {
                        const nomes = match.timeA.jogadores.map((j) => `• ${j.nome}`).join('\n');
                        setDialog({
                          isOpen: true,
                          title: match.timeA.nome,
                          message: `Integrantes do time:\n\n${nomes}`,
                          type: 'alert',
                          onConfirm: () => setDialog((prev) => ({ ...prev, isOpen: false })),
                        });
                      }
                    }}
                    className={`col-span-2 p-2.5 rounded-xl border text-center font-bold text-xs cursor-pointer transition-all ${
                      match.vencedorId === match.timeA.id
                        ? 'bg-emerald-50 border-emerald-300 text-emerald-950 font-black shadow-xs'
                        : match.timeA.jogadores && match.timeA.jogadores.length > 0
                        ? 'bg-amber-50/70 border-amber-300 text-amber-950'
                        : 'bg-slate-50 border-slate-200 text-slate-800'
                    }`}
                  >
                    <span className="block truncate font-extrabold">{match.timeA.nome}</span>
                    <input
                      type="number"
                      min={0}
                      value={match.placarA || 0}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => handleAtualizarPlacar(match.id, parseInt(e.target.value) || 0, match.placarB || 0)}
                      className="w-12 text-center mt-1 bg-white border border-slate-300 rounded-lg py-0.5 font-black text-sm"
                    />
                  </div>

                  <div className="col-span-1 text-center font-black text-slate-400 text-sm">
                    X
                  </div>

                  {/* Time B */}
                  <div
                    onClick={() => {
                      if (match.timeB.jogadores && match.timeB.jogadores.length > 0) {
                        const nomes = match.timeB.jogadores.map((j) => `• ${j.nome}`).join('\n');
                        setDialog({
                          isOpen: true,
                          title: match.timeB.nome,
                          message: `Integrantes do time:\n\n${nomes}`,
                          type: 'alert',
                          onConfirm: () => setDialog((prev) => ({ ...prev, isOpen: false })),
                        });
                      }
                    }}
                    className={`col-span-2 p-2.5 rounded-xl border text-center font-bold text-xs cursor-pointer transition-all ${
                      match.vencedorId === match.timeB.id
                        ? 'bg-emerald-50 border-emerald-300 text-emerald-950 font-black shadow-xs'
                        : match.timeB.jogadores && match.timeB.jogadores.length > 0
                        ? 'bg-amber-50/70 border-amber-300 text-amber-950'
                        : 'bg-slate-50 border-slate-200 text-slate-800'
                    }`}
                  >
                    <span className="block truncate font-extrabold">{match.timeB.nome}</span>
                    <input
                      type="number"
                      min={0}
                      value={match.placarB || 0}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => handleAtualizarPlacar(match.id, match.placarA || 0, parseInt(e.target.value) || 0)}
                      className="w-12 text-center mt-1 bg-white border border-slate-300 rounded-lg py-0.5 font-black text-sm"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal de Edição de Datas */}
      <AnimatePresence>
        {editDateModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4"
          >
            <div className="bg-white p-5 rounded-2xl w-full max-w-xs space-y-4 shadow-2xl">
              <h3 className="font-black text-slate-900 text-base">Alterar Datas do Torneio</h3>

              <div className="space-y-3 text-left">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-500 uppercase">Data Início</label>
                  <input
                    type="date"
                    value={editInicio}
                    onChange={(e) => setEditInicio(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-bold text-slate-900"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-500 uppercase">Data Término</label>
                  <input
                    type="date"
                    value={editFim}
                    onChange={(e) => setEditFim(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-bold text-slate-900"
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => setEditDateModal(false)}
                  className="flex-1 py-2.5 bg-slate-100 text-slate-700 font-bold rounded-xl text-xs cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSalvarDatas}
                  className="flex-1 py-2.5 bg-amber-500 text-white font-bold rounded-xl text-xs cursor-pointer flex items-center justify-center gap-1"
                >
                  <Save size={14} />
                  <span>Salvar</span>
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal para Inscrever Time Fechado completo (Nome do Time + Jogadores) */}
      <AnimatePresence>
        {showInscreverTimeModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4"
          >
            <div className="bg-white p-5 rounded-2xl w-full max-w-sm space-y-4 shadow-2xl text-left max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                <h3 className="font-black text-slate-900 text-base flex items-center gap-2">
                  <Users className="text-amber-500" size={18} />
                  Inscrever Time Fechado
                </h3>
                <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full">
                  Mín. {torneio?.jogadores_por_time || 2} atletas
                </span>
              </div>

              <form onSubmit={handleSalvarTimeFechado} className="space-y-4">
                {/* Nome do Time */}
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-600 uppercase tracking-wider block">
                    Nome do Seu Time *
                  </label>
                  <input
                    type="text"
                    required
                    value={nomeNovoTime}
                    onChange={(e) => setNomeNovoTime(e.target.value)}
                    placeholder="Ex: Garden Club FC, Vôlei Arte..."
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-900 focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  />
                </div>

                {/* Escalação de Jogadores */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <label className="text-[10px] font-black text-slate-600 uppercase tracking-wider block">
                      Integrantes do Time ({jogadoresTimeFechado.length}/{torneio?.jogadores_por_time || 2})
                    </label>
                    <span className="text-[10px] font-bold text-slate-400">Pode incluir reservas</span>
                  </div>

                  {/* Lista de Atletas Adicionados ao Time */}
                  {jogadoresTimeFechado.length > 0 && (
                    <div className="space-y-1.5 max-h-36 overflow-y-auto p-1 border border-slate-100 rounded-xl">
                      {jogadoresTimeFechado.map((j) => (
                        <div key={j.id} className="p-2 rounded-xl bg-slate-50 border border-slate-200 flex justify-between items-center text-xs font-bold text-slate-800">
                          <span className="truncate">👤 {j.nome}</span>
                          <button
                            type="button"
                            onClick={() => setJogadoresTimeFechado(jogadoresTimeFechado.filter((x) => x.id !== j.id))}
                            className="text-slate-400 hover:text-red-500 transition-colors p-1"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Campo de Busca e Inclusão Livre de Jogadores (Nome cadastrado ou Nome digitado) */}
                  <div className="space-y-1 relative">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={buscaJogadorTime}
                        onChange={(e) => {
                          const txt = e.target.value;
                          setBuscaJogadorTime(txt);
                          if (!txt.trim() || !torneio) {
                            setSugestoesJogadorTime([]);
                            return;
                          }
                          const idsJaEmTime = torneio.times.flatMap((t) => (t.jogadores || []).map((j) => j.id));

                          const filtrados = todasPessoas.filter((p) => {
                            const jaEstaEmUmTime = idsJaEmTime.includes(p.id);
                            const jaEstaNoDraftModal = jogadoresTimeFechado.some((j) => j.id === p.id);
                            if (jaEstaEmUmTime || jaEstaNoDraftModal) return false;

                            return (
                              p.nome.toLowerCase().includes(txt.toLowerCase()) ||
                              p.email?.toLowerCase().includes(txt.toLowerCase())
                            );
                          });
                          setSugestoesJogadorTime(filtrados.slice(0, 5));
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            if (buscaJogadorTime.trim()) {
                              const customName = buscaJogadorTime.trim();
                              if (!jogadoresTimeFechado.some((j) => j.nome.toLowerCase() === customName.toLowerCase())) {
                                setJogadoresTimeFechado([
                                  ...jogadoresTimeFechado,
                                  { id: `custom_${Date.now()}_${Math.random()}`, nome: customName },
                                ]);
                              }
                              setBuscaJogadorTime('');
                              setSugestoesJogadorTime([]);
                            }
                          }
                        }}
                        placeholder="Digite o nome do jogador e aperte Enter..."
                        className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-900 focus:outline-none focus:ring-1 focus:ring-amber-500"
                      />

                      <button
                        type="button"
                        onClick={() => {
                          if (buscaJogadorTime.trim()) {
                            const customName = buscaJogadorTime.trim();
                            if (!jogadoresTimeFechado.some((j) => j.nome.toLowerCase() === customName.toLowerCase())) {
                              setJogadoresTimeFechado([
                                ...jogadoresTimeFechado,
                                { id: `custom_${Date.now()}_${Math.random()}`, nome: customName },
                              ]);
                            }
                            setBuscaJogadorTime('');
                            setSugestoesJogadorTime([]);
                          }
                        }}
                        className="px-3 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold shrink-0 transition-all cursor-pointer"
                      >
                        + Adicionar
                      </button>
                    </div>

                    {sugestoesJogadorTime.length > 0 && (
                      <div className="border border-slate-200 rounded-xl overflow-hidden shadow-lg bg-white divide-y divide-slate-100 max-h-36 overflow-y-auto z-50 absolute left-0 right-0 top-full mt-1">
                        {sugestoesJogadorTime.map((p) => (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => {
                              if (!jogadoresTimeFechado.some((j) => j.id === p.id)) {
                                setJogadoresTimeFechado([...jogadoresTimeFechado, { id: p.id, nome: p.nome }]);
                              }
                              setBuscaJogadorTime('');
                              setSugestoesJogadorTime([]);
                            }}
                            className="w-full p-2.5 text-left text-xs font-bold text-slate-800 hover:bg-amber-50 flex items-center gap-2 transition-colors cursor-pointer"
                          >
                            {p.foto ? (
                              <img src={p.foto} alt={p.nome} className="w-5 h-5 rounded-full object-cover shrink-0" />
                            ) : (
                              <div className="w-5 h-5 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center font-bold text-[9px] shrink-0">
                                {p.nome.charAt(0)}
                              </div>
                            )}
                            <span className="truncate">{p.nome}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Botões de Ação */}
                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowInscreverTimeModal(false)}
                    className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs cursor-pointer transition-all"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-2.5 bg-gradient-to-r from-red-600 to-amber-600 text-white font-bold rounded-xl text-xs cursor-pointer shadow-md transition-all active:scale-95 flex items-center justify-center gap-1"
                  >
                    <Save size={14} />
                    <span>Confirmar Time</span>
                  </button>
                </div>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal para Adicionar Jogadores aos Inscritos ou aos Times Fechados */}
      <AnimatePresence>
        {showAddUserModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4"
          >
            <div className="bg-white p-5 rounded-2xl w-full max-w-xs space-y-4 shadow-2xl text-left">
              <h3 className="font-black text-slate-900 text-base">
                {targetTeamId ? 'Adicionar ao Time' : 'Inscrever Atleta'}
              </h3>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase">Nome do Jogador</label>
                <div className="flex gap-2 relative">
                  <input
                    type="text"
                    value={buscaAtleta}
                    onChange={(e) => handleBuscaChange(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        if (buscaAtleta.trim()) {
                          handleAdicionarAtleta({
                            id: `custom_${Date.now()}_${Math.random()}`,
                            nome: buscaAtleta.trim(),
                          });
                        }
                      }
                    }}
                    placeholder="Digite o nome e aperte Enter..."
                    className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />

                  <button
                    type="button"
                    onClick={() => {
                      if (buscaAtleta.trim()) {
                        handleAdicionarAtleta({
                          id: `custom_${Date.now()}_${Math.random()}`,
                          nome: buscaAtleta.trim(),
                        });
                      }
                    }}
                    className="px-3 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold shrink-0 transition-all cursor-pointer"
                  >
                    + Adicionar
                  </button>

                  {/* Autocomplete de sugestões */}
                  {sugestoesAtletas.length > 0 && (
                    <div className="border border-slate-200 rounded-xl overflow-hidden shadow-lg bg-white divide-y divide-slate-100 max-h-40 overflow-y-auto absolute left-0 right-0 top-full mt-1 z-50">
                      {sugestoesAtletas.map((p) => (
                        <button
                          key={p.id}
                          onClick={() => handleAdicionarAtleta(p)}
                          className="w-full p-2.5 text-left text-xs font-bold text-slate-800 hover:bg-amber-50 flex items-center gap-2 transition-colors cursor-pointer"
                        >
                          {p.foto ? (
                            <img src={p.foto} alt={p.nome} className="w-6 h-6 rounded-full object-cover shrink-0" />
                          ) : (
                            <div className="w-6 h-6 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center font-bold text-[10px] shrink-0">
                              {p.nome.charAt(0)}
                            </div>
                          )}
                          <span className="truncate">{p.nome}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => setShowAddUserModal(false)}
                  className="w-full py-2.5 bg-slate-100 text-slate-700 font-bold rounded-xl text-xs cursor-pointer"
                >
                  Fechar
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal Somente Leitura de Jogadores Inscritos */}
      <AnimatePresence>
        {showParticipantesModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4"
          >
            <div className="bg-white p-5 rounded-2xl w-full max-w-sm space-y-4 shadow-2xl text-left max-h-[85vh] flex flex-col">
              <div className="flex justify-between items-center pb-2 border-b border-slate-100 shrink-0">
                <h3 className="font-black text-slate-900 text-base flex items-center gap-2">
                  <UserCheck className="text-emerald-500" size={18} />
                  Atletas Inscritos
                </h3>
                <span className="text-xs font-bold text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                  {torneio?.participantes?.length || 0} confirmados
                </span>
              </div>

              <div className="overflow-y-auto space-y-2 flex-1 pr-1">
                {torneio?.participantes && torneio.participantes.length > 0 ? (
                  <div className="grid grid-cols-2 gap-2">
                    {torneio.participantes.map((p) => (
                      <div key={p.id} className="p-2.5 rounded-xl bg-slate-50 border border-slate-150 flex items-center gap-2 truncate">
                        {p.foto ? (
                          <img src={p.foto} alt={p.nome} className="w-6 h-6 rounded-full object-cover shrink-0" />
                        ) : (
                          <div className="w-6 h-6 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center font-bold text-[10px] shrink-0">
                            {p.nome.charAt(0)}
                          </div>
                        )}
                        <span className="text-xs font-bold text-slate-800 truncate">{p.nome}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 py-4 text-center">Nenhum jogador cadastrado ainda.</p>
                )}
              </div>

              <div className="pt-2 shrink-0 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowParticipantesModal(false)}
                  className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-all cursor-pointer"
                >
                  Fechar
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal de Diálogo Personalizado (Dialog) */}
      <Dialog
        isOpen={dialog.isOpen}
        title={dialog.title}
        message={dialog.message}
        type={dialog.type}
        onConfirm={dialog.onConfirm}
        onCancel={dialog.onCancel}
      />
    </div>
  );
}
