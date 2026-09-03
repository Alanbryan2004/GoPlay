import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import type { Participante } from '../../types';
import { ActionAfterVictories } from '../../types';
import {
  sortearTimes,
  subirPrioridade,
  selecionarProximosJogadores
} from '../../utils/sorteioUtils';
import {
  Sparkles,
  RefreshCw,
  Share2,
  ArrowLeft,
  Check,
  Copy,
  Plus,
  X,
  Star,
  AlertTriangle,
  Minus,
  CheckCircle2,
  Users,
  Trophy,
  History,
  Settings
} from 'lucide-react';

interface QuickParticipante extends Participante {
  isAvulso?: boolean;
}

interface PartidaHistorico {
  numero: number;
  placarA: number;
  placarB: number;
  vencedor: 'A' | 'B';
  timeA: string[];
  timeB: string[];
}

export default function SorteioQuick() {
  const navigate = useNavigate();

  // Grupos opcionais
  const [grupos, setGrupos] = useState<any[]>([]);
  const [selectedGrupoId, setSelectedGrupoId] = useState<string>('avulso');
  const [loadingGrupos, setLoadingGrupos] = useState(true);

  // Lista unificada de participantes
  const [participantes, setParticipantes] = useState<QuickParticipante[]>([]);
  const [search, setSearch] = useState('');

  // Adicionar novo jogador
  const [novoNome, setNovoNome] = useState('');
  const [novaAvaliacao, setNovaAvaliacao] = useState(3.0);

  // Configurações da Partida (Idênticas ao Evento)
  const [numberOfPlayers, setNumberOfPlayers] = useState(6);
  const [maxNumberOfVictories, setMaxNumberOfVictories] = useState(3);
  const [actionAfterVictories, setActionAfterVictories] = useState<ActionAfterVictories>(
    ActionAfterVictories.Mesclar
  );
  const [useRating, setUseRating] = useState(true);
  const [showConfigModal, setShowConfigModal] = useState(false);

  // Estado da Partida Ativa
  const [timeA, setTimeA] = useState<QuickParticipante[]>([]);
  const [timeB, setTimeB] = useState<QuickParticipante[]>([]);
  const [placarA, setPlacarA] = useState(0);
  const [placarB, setPlacarB] = useState(0);
  const [vitoriasA, setVitoriasA] = useState(0);
  const [vitoriasB, setVitoriasB] = useState(0);
  const [numeroPartida, setNumeroPartida] = useState(1);
  const [historicoPartidas, setHistoricoPartidas] = useState<PartidaHistorico[]>([]);
  const [mensagemRodizio, setMensagemRodizio] = useState<string | null>(null);

  // Estados de controle
  const [isDrawing, setIsDrawing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showEncerrarModal, setShowEncerrarModal] = useState(false);

  // Verifica se a partida está ativa na quadra
  const isJogoAtivo = timeA.length > 0 && timeB.length > 0;

  useEffect(() => {
    fetchGrupos();
  }, []);

  useEffect(() => {
    if (selectedGrupoId && selectedGrupoId !== 'avulso') {
      fetchMembrosGrupo(selectedGrupoId);
    }
  }, [selectedGrupoId]);

  const fetchGrupos = async () => {
    setLoadingGrupos(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoadingGrupos(false);
        return;
      }

      const { data: userData } = await supabase
        .from('usuarios')
        .select('id')
        .eq('email', user.email)
        .single();
      
      const loggedId = userData?.id || user.id;

      const { data: userGroups, error } = await supabase
        .from('membros_grupo')
        .select('grupo_id, grupos(id, nome)')
        .eq('usuario_id', loggedId)
        .eq('status', 'aprovado');

      if (!error && userGroups) {
        const parsedGrupos = userGroups.map((ug: any) => ug.grupos).filter(Boolean);
        setGrupos(parsedGrupos);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingGrupos(false);
    }
  };

  const fetchMembrosGrupo = async (grupoId: string) => {
    try {
      const { data: membersData, error } = await supabase
        .from('membros_grupo')
        .select('usuario_id, usuarios(id, nome, foto)')
        .eq('grupo_id', grupoId)
        .eq('status', 'aprovado');

      if (!error && membersData) {
        const { data: ratingsData } = await supabase
          .from('ratings_jogador')
          .select('usuario_id, rating')
          .eq('grupo_id', grupoId);

        const ratingMap = new Map<string, number>();
        if (ratingsData) {
          ratingsData.forEach((r) => {
            ratingMap.set(r.usuario_id, Number(r.rating));
          });
        }

        const parsedMembros: QuickParticipante[] = (membersData
          .map((m: any) => {
            const u = m.usuarios;
            if (!u) return null;
            return {
              id: u.id,
              nome: u.nome,
              foto: u.foto || undefined,
              avaliacao: ratingMap.get(u.id) ?? 3.0,
              checked: true,
              prioridade: 0,
              isAvulso: false,
            };
          })
          .filter(Boolean) as QuickParticipante[])
          .sort((a, b) => a.nome.localeCompare(b.nome));

        setParticipantes((prev) => {
          const avulsos = prev.filter((m) => m.isAvulso);
          return [...parsedMembros, ...avulsos];
        });
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleAddJogadorAvulso = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const nomeLimpo = novoNome.trim();
    if (!nomeLimpo) return;

    const novoJogador: QuickParticipante = {
      id: `avulso_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      nome: nomeLimpo,
      avaliacao: novaAvaliacao,
      checked: true,
      prioridade: isJogoAtivo ? 1 : 0,
      isAvulso: true,
    };

    setParticipantes((prev) => [...prev, novoJogador]);
    setNovoNome('');
  };

  const handleRemoverJogador = (id: string) => {
    setParticipantes((prev) => prev.filter((m) => m.id !== id));
    setTimeA((prev) => prev.filter((m) => m.id !== id));
    setTimeB((prev) => prev.filter((m) => m.id !== id));
  };

  const toggleMemberChecked = (id: string) => {
    setParticipantes((prev) =>
      prev.map((m) => (m.id === id ? { ...m, checked: !m.checked } : m))
    );
  };

  const toggleAllMembers = (checked: boolean) => {
    setParticipantes((prev) => prev.map((m) => ({ ...m, checked })));
  };

  // Sorteio Inicial
  const handleSortear = () => {
    const presentes = participantes.filter((m) => m.checked);
    
    if (presentes.length < 2) {
      alert('Adicione ou selecione pelo menos 2 jogadores presentes para realizar o sorteio.');
      return;
    }

    setIsDrawing(true);
    setMensagemRodizio(null);

    setTimeout(() => {
      // Determina tamanho balanceado por time
      const tamanhoEfetivo = Math.min(numberOfPlayers, Math.floor(presentes.length / 2));

      // Aplica sortearTimes oficial do Evento
      const timesSorteados = sortearTimes(presentes, tamanhoEfetivo, 2, useRating);

      const tA = (timesSorteados[0] || []).map((p) => ({ ...p, prioridade: 0 }));
      const tB = (timesSorteados[1] || []).map((p) => ({ ...p, prioridade: 0 }));

      // Quem ficou de fora inicialmente recebe prioridade 1
      const jogandoIds = new Set([...tA.map((p) => p.id), ...tB.map((p) => p.id)]);
      const listaComPrioridade: QuickParticipante[] = participantes.map((p) => {
        if (p.checked) {
          return {
            ...p,
            prioridade: jogandoIds.has(p.id) ? 0 : 1,
          };
        }
        return p;
      });

      setTimeA(tA);
      setTimeB(tB);
      setParticipantes(listaComPrioridade);
      setPlacarA(0);
      setPlacarB(0);
      setVitoriasA(0);
      setVitoriasB(0);
      setNumeroPartida(1);
      setHistoricoPartidas([]);
      setIsDrawing(false);
    }, 1000);
  };

  // Finalizar a partida ativa aplicando exatamente a regra de vitórias (Mesclar / Remover)
  const handleFinalizarPartida = () => {
    if (placarA === placarB) {
      alert('A partida terminou empatada! Marque o ponto de desempate para finalizar.');
      return;
    }

    const time1Venceu = placarA > placarB;
    const timeVencedor = time1Venceu ? timeA : timeB;
    const timePerdedor = time1Venceu ? timeB : timeA;
    const novasVitoriasVencedor = (time1Venceu ? vitoriasA : vitoriasB) + 1;

    // 1. Grava no histórico
    const novaPartida: PartidaHistorico = {
      numero: numeroPartida,
      placarA,
      placarB,
      vencedor: time1Venceu ? 'A' : 'B',
      timeA: timeA.map((p) => p.nome),
      timeB: timeB.map((p) => p.nome),
    };
    setHistoricoPartidas((prev) => [...prev, novaPartida]);

    const tamanhoDoTime = timeVencedor.length;
    let novosParticipantes = [...participantes];

    // 2. VERIFICA SE ATINGIU O LIMITE DE VITÓRIAS CONSECUTIVAS
    if (novasVitoriasVencedor >= maxNumberOfVictories) {
      if (actionAfterVictories === ActionAfterVictories.Remover) {
        // REMOVER AMBOS: O vencedor e o perdedor vão para a fila, entram 2 novos times
        novosParticipantes = subirPrioridade(novosParticipantes, timeVencedor, timePerdedor);
        novosParticipantes = subirPrioridade(novosParticipantes, [], timeVencedor);

        const { selecionados: novoTime1, novosParticipantes: tempParticipantes } = selecionarProximosJogadores(
          novosParticipantes,
          [],
          tamanhoDoTime
        );
        const { selecionados: novoTime2, novosParticipantes: finalParticipantes } = selecionarProximosJogadores(
          tempParticipantes,
          novoTime1,
          tamanhoDoTime
        );

        const activeT1 = novoTime1.map((p) => ({ ...p, prioridade: 0 }));
        const activeT2 = novoTime2.map((p) => ({ ...p, prioridade: 0 }));
        activeT1.sort((a, b) => a.nome.localeCompare(b.nome));
        activeT2.sort((a, b) => a.nome.localeCompare(b.nome));

        setTimeA(activeT1);
        setTimeB(activeT2);
        setVitoriasA(0);
        setVitoriasB(0);
        setParticipantes(finalParticipantes as QuickParticipante[]);
        setMensagemRodizio(`👑 Limite de ${maxNumberOfVictories} vitórias atingido! Ambos os times saíram e novos times entraram.`);
      } else {
        // MESCLAR: O perdedor vai para a fila, seleciona os entrantes e MISTURA com o time vencedor
        novosParticipantes = subirPrioridade(novosParticipantes, timeVencedor, timePerdedor);

        const { selecionados: novoTime, novosParticipantes: finalParticipantes } = selecionarProximosJogadores(
          novosParticipantes,
          timeVencedor,
          tamanhoDoTime
        );

        const misturarFila = [...timeVencedor, ...novoTime];
        const novosTimesSorteados = sortearTimes(misturarFila, tamanhoDoTime, 2, useRating);

        const t1 = novosTimesSorteados[0].map((p) => ({ ...p, prioridade: 0 }));
        const t2 = novosTimesSorteados[1].map((p) => ({ ...p, prioridade: 0 }));
        t1.sort((a, b) => a.nome.localeCompare(b.nome));
        t2.sort((a, b) => a.nome.localeCompare(b.nome));

        setTimeA(t1);
        setTimeB(t2);
        setVitoriasA(0);
        setVitoriasB(0);
        setParticipantes(finalParticipantes as QuickParticipante[]);
        setMensagemRodizio(`🔀 Limite de ${maxNumberOfVictories} vitórias atingido! O time vencedor foi mesclado com os próximos da fila.`);
      }
    } else {
      // REGRA PADRÃO (QUEM GANHA FICA):
      novosParticipantes = subirPrioridade(novosParticipantes, timeVencedor, timePerdedor);

      const { selecionados: novoTime, novosParticipantes: finalParticipantes } = selecionarProximosJogadores(
        novosParticipantes,
        timeVencedor,
        tamanhoDoTime
      );

      const activeNovoTime = novoTime.map((p) => ({ ...p, prioridade: 0 }));
      activeNovoTime.sort((a, b) => a.nome.localeCompare(b.nome));

      const activeVencedor = timeVencedor.map((p) => ({ ...p, prioridade: 0 }));

      if (time1Venceu) {
        setTimeA(activeVencedor);
        setTimeB(activeNovoTime);
        setVitoriasA(novasVitoriasVencedor);
        setVitoriasB(0);
      } else {
        setTimeA(activeNovoTime);
        setTimeB(activeVencedor);
        setVitoriasA(0);
        setVitoriasB(novasVitoriasVencedor);
      }

      setParticipantes(finalParticipantes as QuickParticipante[]);
      setMensagemRodizio(null);
    }

    setPlacarA(0);
    setPlacarB(0);
    setNumeroPartida((n) => n + 1);
  };

  // Reequilibrar os times em quadra
  const handleReequilibrarEmQuadra = () => {
    const todosEmQuadra = [...timeA, ...timeB].sort((a, b) => b.avaliacao - a.avaliacao);
    const novoA: QuickParticipante[] = [];
    const novoB: QuickParticipante[] = [];

    todosEmQuadra.forEach((p, idx) => {
      if (idx % 2 === 0) novoA.push(p);
      else novoB.push(p);
    });

    setTimeA(novoA);
    setTimeB(novoB);
  };

  // Trocar jogador de time manualmente
  const handleTrocarDeTime = (jogador: QuickParticipante, deTime: 'A' | 'B') => {
    if (deTime === 'A') {
      setTimeA((prev) => prev.filter((p) => p.id !== jogador.id));
      setTimeB((prev) => [...prev, jogador]);
    } else {
      setTimeB((prev) => prev.filter((p) => p.id !== jogador.id));
      setTimeA((prev) => [...prev, jogador]);
    }
  };

  // Mover jogador da quadra para a fila
  const handleMoverParaFila = (jogador: QuickParticipante, deTime: 'A' | 'B') => {
    if (deTime === 'A') setTimeA((prev) => prev.filter((p) => p.id !== jogador.id));
    else setTimeB((prev) => prev.filter((p) => p.id !== jogador.id));

    setParticipantes((prev) =>
      prev.map((p) => (p.id === jogador.id ? { ...p, prioridade: 1 } : p))
    );
  };

  // Colocar jogador da fila no time
  const handleColocarEmQuadra = (jogador: QuickParticipante, paraTime: 'A' | 'B') => {
    setParticipantes((prev) =>
      prev.map((p) => (p.id === jogador.id ? { ...p, prioridade: 0 } : p))
    );
    if (paraTime === 'A') setTimeA((prev) => [...prev, { ...jogador, prioridade: 0 }]);
    else setTimeB((prev) => [...prev, { ...jogador, prioridade: 0 }]);
  };

  // Jogadores na fila de espera
  const jogandoIds = new Set([...timeA.map((p) => p.id), ...timeB.map((p) => p.id)]);
  const filaEspera = participantes.filter((p) => p.checked && !jogandoIds.has(p.id));

  // Estimativa do próximo time usando a regra oficial do Evento
  const { selecionados: proximoTimeEstimado } = selecionarProximosJogadores(
    participantes,
    [...timeA, ...timeB],
    timeA.length || numberOfPlayers
  );

  // Compartilhar placar atual
  const handleCopiarTextoPartida = () => {
    let text = `⚡ *PLACAR DO JOGO - GOPLAY (PARTIDA #${numeroPartida})* ⚡\n`;
    text += `⚠️ _Partida Avulsa (Não pontua no Ranking)_\n\n`;
    text += `🔴 *Time A (${placarA}):* ${timeA.map((p) => p.nome).join(', ')}\n`;
    text += `🔵 *Time B (${placarB}):* ${timeB.map((p) => p.nome).join(', ')}\n`;
    if (filaEspera.length > 0) {
      text += `\n⏳ *Próximos na Fila:* ${filaEspera.map((p) => p.nome).join(', ')}\n`;
    }

    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCompartilharImagem = async () => {
    const el = document.getElementById('painel-jogo-ativo-card');
    if (!el) return;

    try {
      const html2canvas = (await import('html2canvas-pro')).default;
      const canvas = await html2canvas(el, {
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        scale: 2
      });

      canvas.toBlob(async (blob) => {
        if (!blob) return;

        const filename = `Placar_Partida_${numeroPartida}.png`;
        const file = new File([blob], filename, { type: 'image/png' });

        if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({
            files: [file],
            title: `Partida #${numeroPartida} - GoPlay`,
            text: `Confira o placar do jogo de agora no GoPlay! ⚡`
          });
        } else {
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = filename;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        }
      });
    } catch (err) {
      console.error(err);
    }
  };

  const filteredMembros = participantes.filter((m) =>
    m.nome.toLowerCase().includes(search.toLowerCase())
  );

  // Médias de estrelas
  const totalStarsA = timeA.reduce((sum, p) => sum + p.avaliacao, 0);
  const avgStarsA = timeA.length > 0 ? (totalStarsA / timeA.length).toFixed(1) : '0.0';
  const totalStarsB = timeB.reduce((sum, p) => sum + p.avaliacao, 0);
  const avgStarsB = timeB.length > 0 ? (totalStarsB / timeB.length).toFixed(1) : '0.0';
  const starDiff = Math.abs(totalStarsA - totalStarsB).toFixed(1);

  return (
    <div className="px-4 py-3 pb-24 w-full max-w-md mx-auto relative min-h-[calc(100vh-8rem)]">
      {/* Header */}
      <div className="flex items-center justify-between mb-3 pl-14 h-11">
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => navigate(-1)}
            className="p-2 rounded-lg bg-slate-50 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer border-0"
            title="Voltar"
          >
            <ArrowLeft size={18} />
          </button>
          <div className="text-left">
            <h1 className="text-2xl font-black text-slate-900 leading-none">Sorteio Rápido</h1>
            <p className="text-[11px] text-slate-500 font-bold mt-0.5">
              {isJogoAtivo ? `Partida #${numeroPartida} em Andamento` : 'Pelada Sem Compromisso'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {/* Botão de Configurações */}
          <button
            type="button"
            onClick={() => setShowConfigModal(true)}
            className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-all cursor-pointer"
            title="Configurações da Partida"
          >
            <Settings size={18} />
          </button>

          {isJogoAtivo && (
            <button
              type="button"
              onClick={() => setShowEncerrarModal(true)}
              className="px-2.5 py-1.5 bg-slate-100 hover:bg-red-50 hover:text-red-650 text-slate-600 rounded-xl text-xs font-black transition-all cursor-pointer"
            >
              Encerrar
            </button>
          )}
        </div>
      </div>

      {/* AVISO DE RANKING (Sempre visível para transparência ao usuário) */}
      <div className="p-3 bg-amber-50/80 border border-amber-200 rounded-2xl flex items-start gap-2.5 text-left mb-4 shadow-xs">
        <AlertTriangle size={15} className="text-amber-600 shrink-0 mt-0.5" />
        <div className="space-y-0.5">
          <p className="text-xs font-black text-amber-900 leading-tight">
            Partida Rápida Avulsa (Não pontua no Ranking)
          </p>
          <p className="text-[10px] text-amber-800 leading-relaxed">
            Feita para jogar na hora sem precisar criar eventos. Os pontos e vitórias daqui não entram no Ranking oficial.
          </p>
        </div>
      </div>

      {/* BANNER DE AÇÃO AO ATINGIR LIMITE DE VITÓRIAS */}
      {mensagemRodizio && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-900 text-xs font-bold text-left mb-4 flex items-center gap-2 animate-in fade-in">
          <Sparkles size={16} className="text-emerald-600 shrink-0" />
          <span>{mensagemRodizio}</span>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SE O JOGO ESTIVER ATIVO: DINÂMICA IDÊNTICA AO EVENTO (PLACAR + PRÓXIMOS) */}
      {/* ========================================================================= */}
      {isJogoAtivo ? (
        <div className="space-y-4 text-left">
          {/* PAINEL DE JOGO ATIVO COM PLACAR NO TOPO */}
          <div id="painel-jogo-ativo-card" className="glass p-5 rounded-3xl border border-slate-200 shadow-xl space-y-4 relative overflow-hidden bg-white">
            <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-red-500 via-amber-500 to-blue-500" />

            <div className="flex justify-between items-center">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <h2 className="font-black text-xs uppercase tracking-widest text-slate-700">
                  Partida #{numeroPartida} em Quadra
                </h2>
              </div>

              <button
                type="button"
                onClick={handleReequilibrarEmQuadra}
                className="px-2.5 py-1 bg-slate-50 border border-slate-200 hover:bg-slate-100 text-slate-600 rounded-lg text-[10px] font-black uppercase tracking-wider flex items-center gap-1 cursor-pointer transition-all active:scale-95"
                title="Reequilibrar estrelas dos times atuais"
              >
                <RefreshCw size={11} className="text-red-500" />
                <span>Reequilibrar</span>
              </button>
            </div>

            {/* PLACAR INTERATIVO */}
            <div className="grid grid-cols-5 items-center">
              {/* Time A */}
              <div className="col-span-2 text-center space-y-1.5">
                <span className="font-black text-sm text-red-700 block truncate">Time A</span>

                {/* Rating Time A */}
                <div className="inline-flex items-center gap-1 bg-red-50 px-2 py-0.5 rounded-lg border border-red-200 text-amber-600 text-[10px] font-black">
                  <Star size={11} className="fill-amber-400 text-amber-400" />
                  <span>{avgStarsA}★</span>
                </div>

                {/* Botões do Placar Time A */}
                <div className="flex justify-center items-center gap-1 mt-1">
                  <button
                    type="button"
                    onClick={() => setPlacarA((p) => Math.max(0, p - 1))}
                    className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 active:scale-90 transition-all cursor-pointer"
                  >
                    <Minus size={14} />
                  </button>
                  <div className="w-12 h-12 rounded-xl bg-red-50 border-2 border-red-300 flex items-center justify-center text-2xl font-black text-red-700 shadow-inner">
                    {placarA}
                  </div>
                  <button
                    type="button"
                    onClick={() => setPlacarA((p) => p + 1)}
                    className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 active:scale-90 transition-all cursor-pointer"
                  >
                    <Plus size={14} />
                  </button>
                </div>
                <p className="text-[10px] font-bold text-slate-400">
                  Vitórias: {vitoriasA}/{maxNumberOfVictories}
                </p>
              </div>

              {/* Divisor X e Indicador de Equilíbrio */}
              <div className="col-span-1 text-center flex flex-col items-center justify-center space-y-1">
                <span className="font-black text-slate-300 text-xl">X</span>
                <span className="text-[9px] font-black text-slate-400 uppercase">
                  {Number(starDiff) <= 0.8 ? '⚖️ Justo' : `Δ ${starDiff}★`}
                </span>
              </div>

              {/* Time B */}
              <div className="col-span-2 text-center space-y-1.5">
                <span className="font-black text-sm text-blue-700 block truncate">Time B</span>

                {/* Rating Time B */}
                <div className="inline-flex items-center gap-1 bg-blue-50 px-2 py-0.5 rounded-lg border border-blue-200 text-amber-600 text-[10px] font-black">
                  <Star size={11} className="fill-amber-400 text-amber-400" />
                  <span>{avgStarsB}★</span>
                </div>

                {/* Botões do Placar Time B */}
                <div className="flex justify-center items-center gap-1 mt-1">
                  <button
                    type="button"
                    onClick={() => setPlacarB((p) => Math.max(0, p - 1))}
                    className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 active:scale-90 transition-all cursor-pointer"
                  >
                    <Minus size={14} />
                  </button>
                  <div className="w-12 h-12 rounded-xl bg-blue-50 border-2 border-blue-300 flex items-center justify-center text-2xl font-black text-blue-700 shadow-inner">
                    {placarB}
                  </div>
                  <button
                    type="button"
                    onClick={() => setPlacarB((p) => p + 1)}
                    className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 active:scale-90 transition-all cursor-pointer"
                  >
                    <Plus size={14} />
                  </button>
                </div>
                <p className="text-[10px] font-bold text-slate-400">
                  Vitórias: {vitoriasB}/{maxNumberOfVictories}
                </p>
              </div>
            </div>

            {/* Regra de Rodízio Ativa */}
            <div className="text-center bg-slate-50 py-1.5 px-3 rounded-xl border border-slate-150">
              <span className="text-[10px] font-extrabold text-slate-600">
                Regra: {maxNumberOfVictories} vitórias seguidas → {actionAfterVictories === ActionAfterVictories.Mesclar ? 'Mesclar Time' : 'Remover Ambos'}
              </span>
            </div>

            {/* ESCALAÇÃO DOS DOIS TIMES EM QUADRA */}
            <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-100">
              {/* Jogadores Time A */}
              <div className="space-y-1 bg-red-50/30 p-2.5 rounded-2xl border border-red-100">
                <span className="text-[10px] font-black text-red-700 uppercase tracking-wider block mb-1">
                  Atletas Time A ({timeA.length})
                </span>
                <div className="space-y-1 max-h-36 overflow-y-auto pr-0.5">
                  {timeA.map((p) => (
                    <div key={p.id} className="flex items-center justify-between text-xs bg-white p-1.5 rounded-xl border border-red-100 shadow-2xs">
                      <span className="font-bold text-slate-800 truncate text-[11px]">{p.nome}</span>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleTrocarDeTime(p, 'A')}
                          className="text-[9px] font-black text-blue-600 bg-blue-50 hover:bg-blue-100 px-1 py-0.5 rounded cursor-pointer"
                          title="Mover para Time B"
                        >
                          → B
                        </button>
                        <button
                          type="button"
                          onClick={() => handleMoverParaFila(p, 'A')}
                          className="text-[9px] font-black text-slate-400 hover:text-red-650 px-1 py-0.5 cursor-pointer"
                          title="Mover para Fila"
                        >
                          Fila
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Jogadores Time B */}
              <div className="space-y-1 bg-blue-50/30 p-2.5 rounded-2xl border border-blue-100">
                <span className="text-[10px] font-black text-blue-700 uppercase tracking-wider block mb-1">
                  Atletas Time B ({timeB.length})
                </span>
                <div className="space-y-1 max-h-36 overflow-y-auto pr-0.5">
                  {timeB.map((p) => (
                    <div key={p.id} className="flex items-center justify-between text-xs bg-white p-1.5 rounded-xl border border-blue-100 shadow-2xs">
                      <span className="font-bold text-slate-800 truncate text-[11px]">{p.nome}</span>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleTrocarDeTime(p, 'B')}
                          className="text-[9px] font-black text-red-600 bg-red-50 hover:bg-red-100 px-1 py-0.5 rounded cursor-pointer"
                          title="Mover para Time A"
                        >
                          ← A
                        </button>
                        <button
                          type="button"
                          onClick={() => handleMoverParaFila(p, 'B')}
                          className="text-[9px] font-black text-slate-400 hover:text-red-650 px-1 py-0.5 cursor-pointer"
                          title="Mover para Fila"
                        >
                          Fila
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* BOTÃO FINALIZAR PARTIDA */}
            <div className="pt-2 flex flex-col gap-2">
              <button
                type="button"
                onClick={handleFinalizarPartida}
                className="w-full py-3.5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-black rounded-2xl text-xs shadow-md active:scale-98 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <CheckCircle2 size={16} />
                <span>Finalizar Partida</span>
              </button>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleCopiarTextoPartida}
                  className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-all"
                >
                  {copied ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                  <span>{copied ? 'Copiado!' : 'Copiar Placar'}</span>
                </button>
                <button
                  type="button"
                  onClick={handleCompartilharImagem}
                  className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-all"
                >
                  <Share2 size={14} />
                  <span>Compartilhar</span>
                </button>
              </div>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* LISTA DE PRÓXIMOS / FILA DE ESPERA ABAIXO DO PLACAR */}
          {/* ========================================================================= */}
          <div className="glass p-4 rounded-3xl border border-slate-200 shadow-sm space-y-3 bg-white">
            <div className="flex justify-between items-center border-b border-slate-100 pb-2">
              <div>
                <h3 className="text-xs font-black text-slate-800 uppercase tracking-wide flex items-center gap-1.5">
                  <Users size={14} className="text-amber-500" />
                  <span>Próximos na Fila ({filaEspera.length})</span>
                </h3>
                <span className="text-[10px] font-bold text-slate-400">
                  {filaEspera.length >= timeA.length
                    ? `Próximo time completo (${timeA.length} atletas prontos para entrar)`
                    : `Aguardando na fila de revezamento`}
                </span>
              </div>

              {/* Botão de re-embaralhar fila */}
              {filaEspera.length > 1 && (
                <button
                  type="button"
                  onClick={() => {
                    const embaralhada = [...filaEspera].sort(() => Math.random() - 0.5);
                    const embIds = new Set(embaralhada.map((p) => p.id));
                    setParticipantes((prev) =>
                      prev.map((p) => {
                        if (embIds.has(p.id)) {
                          return { ...p, prioridade: 1 };
                        }
                        return p;
                      })
                    );
                  }}
                  className="text-[10px] font-bold text-slate-500 hover:text-slate-800 flex items-center gap-1 bg-slate-50 px-2 py-1 rounded-lg border border-slate-200 cursor-pointer"
                >
                  <RefreshCw size={10} />
                  <span>Sortear Fila</span>
                </button>
              )}
            </div>

            {/* Estimativa do Próximo Time */}
            {proximoTimeEstimado.length > 0 && (
              <div className="p-2.5 bg-amber-50/60 rounded-2xl border border-amber-200 space-y-1.5">
                <span className="text-[10px] font-black text-amber-900 uppercase tracking-wider block">
                  ⚡ Entram no Próximo Jogo ({proximoTimeEstimado.length}/{timeA.length})
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {proximoTimeEstimado.map((p, idx) => (
                    <span key={p.id} className="px-2 py-1 bg-white rounded-lg border border-amber-200 text-[10px] font-extrabold text-amber-950 flex items-center gap-1 shadow-2xs">
                      <span className="text-amber-600 font-black">{idx + 1}.</span>
                      <span>{p.nome}</span>
                      <span className="text-[9px] text-amber-500">({p.avaliacao}★)</span>
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Restante da Fila ou Mensagem Vazia */}
            {filaEspera.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-3">
                Não há ninguém na fila de espera no momento. Quem estiver fora de quadra aparecerá aqui!
              </p>
            ) : (
              <div className="space-y-1 max-h-40 overflow-y-auto pr-0.5">
                {filaEspera.map((p, idx) => (
                  <div key={p.id} className="flex items-center justify-between p-2 rounded-xl bg-slate-50 border border-slate-200 text-xs">
                    <span className="font-bold text-slate-700 text-[11px]">
                      {idx + 1}º. {p.nome} <span className="text-slate-400 text-[10px]">({p.avaliacao}★)</span>
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleColocarEmQuadra(p, 'A')}
                        className="text-[9px] font-bold text-red-650 bg-white border border-red-200 px-1.5 py-0.5 rounded cursor-pointer"
                      >
                        + Time A
                      </button>
                      <button
                        type="button"
                        onClick={() => handleColocarEmQuadra(p, 'B')}
                        className="text-[9px] font-bold text-blue-650 bg-white border border-blue-200 px-1.5 py-0.5 rounded cursor-pointer"
                      >
                        + Time B
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Adicionar Jogador que acabou de chegar direto na fila */}
            <form onSubmit={handleAddJogadorAvulso} className="pt-2 border-t border-slate-100 flex gap-2">
              <input
                type="text"
                placeholder="Chegou mais alguém? Digite o nome..."
                value={novoNome}
                onChange={(e) => setNovoNome(e.target.value)}
                className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-red-500/20"
              />
              <button
                type="submit"
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-black flex items-center gap-1 cursor-pointer"
              >
                <Plus size={14} />
                <span>Add Fila</span>
              </button>
            </form>
          </div>

          {/* HISTÓRICO DE PARTIDAS DESTA SESSÃO RÁPIDA */}
          {historicoPartidas.length > 0 && (
            <div className="glass p-4 rounded-3xl border border-slate-200 shadow-sm space-y-2 bg-white">
              <h3 className="text-xs font-black text-slate-700 uppercase tracking-wide flex items-center gap-1.5 border-b border-slate-100 pb-2">
                <History size={14} className="text-slate-500" />
                <span>Histórico Desta Sessão ({historicoPartidas.length} partidas)</span>
              </h3>
              <div className="space-y-1.5 max-h-36 overflow-y-auto pr-0.5">
                {historicoPartidas.map((hp) => (
                  <div key={hp.numero} className="flex items-center justify-between p-2 rounded-xl bg-slate-50 border border-slate-150 text-[11px] font-bold">
                    <span className="text-slate-500">Jogo #{hp.numero}</span>
                    <span className="text-slate-900 font-black">
                      🔴 {hp.placarA} x {hp.placarB} 🔵
                    </span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-md ${
                      hp.vencedor === 'A' ? 'bg-red-100 text-red-700 font-black' : 'bg-blue-100 text-blue-700 font-black'
                    }`}>
                      {hp.vencedor === 'A' ? 'Vitória Time A' : 'Vitória Time B'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        /* ========================================================================= */
        /* SE O JOGO NÃO ESTIVER ATIVO: FORMULÁRIO DE MONTAGEM E CONFIGURAÇÃO */
        /* ========================================================================= */
        <div className="space-y-4">
          {/* Origem dos Atletas: Grupo Opcional ou Lista Avulsa */}
          <div className="space-y-1.5 text-left">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block">
              Origem dos Jogadores (Opcional)
            </label>
            <select
              value={selectedGrupoId}
              onChange={(e) => setSelectedGrupoId(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-3.5 text-slate-900 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-red-500/20 transition-all cursor-pointer"
            >
              <option value="avulso">🎲 Lista Avulsa Livre (Sem Grupo)</option>
              {grupos.map((g) => (
                <option key={g.id} value={g.id}>
                  👥 Carregar Integrantes: {g.nome}
                </option>
              ))}
            </select>
          </div>

          {/* Formulário: Adicionar Nomes Avulsos na Hora */}
          <form onSubmit={handleAddJogadorAvulso} className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-left space-y-2.5 shadow-xs">
            <label className="text-[10px] font-black text-slate-600 uppercase tracking-wider block">
              + Adicionar Jogador Rápido
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Nome do amigo (ex: Carlos, Pedrinho...)"
                value={novoNome}
                onChange={(e) => setNovoNome(e.target.value)}
                className="flex-1 bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-red-500/20"
              />
              
              <select
                value={novaAvaliacao}
                onChange={(e) => setNovaAvaliacao(Number(e.target.value))}
                className="bg-white border border-slate-200 rounded-xl px-2 py-2 text-xs font-bold text-amber-600 cursor-pointer"
                title="Nível de estrelas"
              >
                <option value={1}>1.0 ★</option>
                <option value={2}>2.0 ★</option>
                <option value={3}>3.0 ★</option>
                <option value={4}>4.0 ★</option>
                <option value={5}>5.0 ★</option>
              </select>

              <button
                type="submit"
                className="px-3.5 py-2 bg-red-650 hover:bg-red-700 text-white rounded-xl text-xs font-black flex items-center gap-1 cursor-pointer active:scale-95 transition-all shadow-xs"
              >
                <Plus size={15} />
                <span>Add</span>
              </button>
            </div>
            <p className="text-[10px] text-slate-400">
              * Digite e pressione Enter para adicionar quantos atletas quiser.
            </p>
          </form>

          {/* Botão de Atalho para Configurações Pré-Sorteio */}
          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-left space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-xs font-black text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <Settings size={14} className="text-red-500" />
                Regras da Partida
              </span>
              <button
                type="button"
                onClick={() => setShowConfigModal(true)}
                className="text-xs font-bold text-red-650 hover:underline cursor-pointer"
              >
                Ajustar
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-600 font-semibold">
              <div>• {numberOfPlayers} jogadores por time</div>
              <div>• Máx. {maxNumberOfVictories} vitórias seguidas</div>
              <div>• Ação: {actionAfterVictories === ActionAfterVictories.Mesclar ? 'Mesclar' : 'Remover Ambos'}</div>
              <div>• {useRating ? 'Com Rating (Estrelas)' : 'Sorteio Puro'}</div>
            </div>
          </div>

          {/* Lista de Atletas para o Sorteio */}
          <div className="glass p-4 rounded-2xl border border-slate-200 text-left space-y-3 shadow-sm bg-white">
            <div className="flex justify-between items-center border-b border-slate-200 pb-2">
              <div>
                <h3 className="text-xs font-black text-slate-800 uppercase tracking-wide">
                  Lista de Atletas ({participantes.length})
                </h3>
                <span className="text-[10px] font-bold text-slate-400 block mt-0.5">
                  Presentes: {participantes.filter((m) => m.checked).length} (Necessários: {numberOfPlayers * 2})
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => toggleAllMembers(true)}
                  className="text-[10px] font-extrabold text-red-650 hover:underline cursor-pointer"
                >
                  Todos
                </button>
                <span className="text-slate-300 text-[10px]">|</span>
                <button
                  type="button"
                  onClick={() => toggleAllMembers(false)}
                  className="text-[10px] font-extrabold text-slate-500 hover:underline cursor-pointer"
                >
                  Nenhum
                </button>
                {participantes.length > 0 && (
                  <>
                    <span className="text-slate-300 text-[10px]">|</span>
                    <button
                      type="button"
                      onClick={() => setParticipantes([])}
                      className="text-[10px] font-extrabold text-red-500 hover:underline cursor-pointer"
                    >
                      Limpar
                    </button>
                  </>
                )}
              </div>
            </div>

            {participantes.length > 6 && (
              <input
                type="text"
                placeholder="Filtrar por nome..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl py-1.5 px-3 text-slate-800 placeholder-slate-400 text-xs"
              />
            )}

            {filteredMembros.length === 0 ? (
              <div className="text-center py-6 space-y-1">
                <p className="text-xs font-bold text-slate-600">Nenhum jogador na lista.</p>
                <p className="text-[11px] text-slate-400">
                  Adicione nomes acima ou selecione um grupo para preencher os atletas.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2 max-h-56 overflow-y-auto pr-0.5">
                {filteredMembros.map((m) => (
                  <div
                    key={m.id}
                    className={`flex items-center justify-between p-2 rounded-xl border transition-all text-left bg-white ${
                      m.checked ? 'border-emerald-500 bg-emerald-50/20' : 'border-slate-200 opacity-60'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => toggleMemberChecked(m.id)}
                      className="flex items-center gap-2 flex-1 min-w-0 cursor-pointer"
                    >
                      <div className={`w-4 h-4 rounded-md border flex items-center justify-center shrink-0 transition-all ${
                        m.checked ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-slate-300'
                      }`}>
                        {m.checked && <Check size={10} strokeWidth={4} />}
                      </div>

                      <div className="min-w-0 flex-1">
                        <p className="text-[10px] font-bold text-slate-800 truncate leading-tight">{m.nome}</p>
                        <span className="text-[8px] text-amber-600 font-bold block mt-0.5">
                          {m.avaliacao.toFixed(1)}★ {m.isAvulso && '• Avulso'}
                        </span>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleRemoverJogador(m.id)}
                      className="p-1 text-slate-400 hover:text-red-500 rounded-md transition-colors cursor-pointer"
                      title="Remover"
                    >
                      <X size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Botão de Sortear Inicial */}
          <button
            onClick={handleSortear}
            disabled={isDrawing || participantes.filter((m) => m.checked).length < 2}
            className="w-full py-3.5 bg-gradient-to-r from-red-600 to-amber-600 hover:from-red-700 hover:to-amber-700 text-white font-black rounded-2xl shadow-lg active:scale-98 disabled:opacity-50 disabled:cursor-not-allowed transition-all text-xs flex justify-center items-center gap-2 cursor-pointer shadow-red-500/20"
          >
            {isDrawing ? (
              <>
                <RefreshCw size={15} className="animate-spin" />
                <span>Embaralhando Atletas...</span>
              </>
            ) : (
              <>
                <Sparkles size={15} />
                <span>Sortear & Iniciar Placar</span>
              </>
            )}
          </button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL DE CONFIGURAÇÕES (IDÊNTICO AO EVENTO) */}
      {/* ========================================================================= */}
      {showConfigModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-5 max-w-sm w-full space-y-4 shadow-2xl border border-slate-100 text-left">
            <div className="flex justify-between items-center border-b border-slate-150 pb-3">
              <h3 className="font-black text-slate-900 text-base">Configurações</h3>
              <button
                type="button"
                onClick={() => setShowConfigModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4">
              {/* Slider: Número de Jogadores por Time */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">
                  Número de Jogadores por Time: {numberOfPlayers}
                </label>
                <input
                  type="range"
                  min="2"
                  max="15"
                  value={numberOfPlayers}
                  onChange={(e) => setNumberOfPlayers(parseInt(e.target.value))}
                  className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-red-600"
                />
              </div>

              {/* Slider: Limite de Vitórias Consecutivas */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">
                  Limite de Vitórias Consecutivas: {maxNumberOfVictories}
                </label>
                <input
                  type="range"
                  min="1"
                  max="10"
                  value={maxNumberOfVictories}
                  onChange={(e) => setMaxNumberOfVictories(parseInt(e.target.value))}
                  className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-red-600"
                />
              </div>

              {/* Botões: Ação ao Atingir Limite de Vitórias */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">
                  Ação ao Atingir Limite de Vitórias
                </label>
                <div className="grid grid-cols-2 gap-2 mt-1">
                  <button
                    type="button"
                    onClick={() => setActionAfterVictories(ActionAfterVictories.Mesclar)}
                    className={`py-2.5 px-3 rounded-xl border text-xs font-black transition-all cursor-pointer ${
                      actionAfterVictories === ActionAfterVictories.Mesclar
                        ? 'bg-red-600 border-red-600 text-white shadow-md'
                        : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    Mesclar
                  </button>
                  <button
                    type="button"
                    onClick={() => setActionAfterVictories(ActionAfterVictories.Remover)}
                    className={`py-2.5 px-3 rounded-xl border text-xs font-black transition-all cursor-pointer ${
                      actionAfterVictories === ActionAfterVictories.Remover
                        ? 'bg-red-600 border-red-600 text-white shadow-md'
                        : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    Remover Ambos
                  </button>
                </div>
              </div>

              {/* Checkbox: Equilibrar por Avaliação (Rating) */}
              <label className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200 cursor-pointer">
                <span className="text-xs font-bold text-slate-700">Equilibrar por Avaliação (Rating)</span>
                <input
                  type="checkbox"
                  checked={useRating}
                  onChange={(e) => setUseRating(e.target.checked)}
                  className="w-4 h-4 rounded text-red-600 border-slate-300 focus:ring-red-500 cursor-pointer"
                />
              </label>
            </div>

            <div className="pt-2 flex flex-col gap-2">
              <button
                type="button"
                onClick={() => setShowConfigModal(false)}
                className="w-full py-3.5 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white font-black rounded-xl shadow-lg active:scale-95 transition-all text-xs cursor-pointer text-center"
              >
                Salvar
              </button>

              {isJogoAtivo && (
                <button
                  type="button"
                  onClick={() => {
                    setShowConfigModal(false);
                    setShowEncerrarModal(true);
                  }}
                  className="w-full py-2.5 border border-emerald-300 bg-emerald-50/50 hover:bg-emerald-100/50 text-emerald-800 font-bold rounded-xl text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <CheckCircle2 size={14} className="text-emerald-600" />
                  <span>Encerrar Partida</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal de Confirmação para Encerrar Sessão Rápida */}
      {showEncerrarModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-5 max-w-xs w-full text-center space-y-4 shadow-2xl border border-slate-100">
            <div className="w-12 h-12 bg-amber-50 rounded-2xl flex items-center justify-center mx-auto text-amber-600 border border-amber-200">
              <Trophy size={24} />
            </div>

            <div className="space-y-1">
              <h3 className="font-black text-slate-900 text-base">Encerrar Partida Rápida?</h3>
              <p className="text-xs text-slate-500">
                Você jogou {historicoPartidas.length} partida(s) nesta sessão.
              </p>
            </div>

            <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-xl text-[11px] font-bold text-amber-900 text-left">
              ⚠️ <strong>Lembrete:</strong> Como esta foi uma partida rápida e avulsa, nenhum ponto ou estatística foi computado no Ranking Geral.
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowEncerrarModal(false)}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs cursor-pointer"
              >
                Voltar ao Jogo
              </button>
              <button
                type="button"
                onClick={() => {
                  setTimeA([]);
                  setTimeB([]);
                  setShowEncerrarModal(false);
                }}
                className="flex-1 py-2.5 bg-red-650 hover:bg-red-700 text-white font-black rounded-xl text-xs cursor-pointer shadow-sm"
              >
                Sim, Encerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
