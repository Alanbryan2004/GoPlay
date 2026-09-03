import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
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
  Info,
  AlertTriangle,
  Minus,
  CheckCircle2,
  Users,
  Trophy,
  History,
  ArrowRight
} from 'lucide-react';

interface Member {
  id: string;
  nome: string;
  foto?: string;
  avaliacao: number;
  checked: boolean;
  isAvulso?: boolean;
}

interface PartidaHistorico {
  numero: number;
  placarA: number;
  placarB: number;
  vencedor: 'A' | 'B' | 'empate';
  timeA: string[];
  timeB: string[];
}

export default function SorteioQuick() {
  const navigate = useNavigate();

  // Grupos opcionais
  const [grupos, setGrupos] = useState<any[]>([]);
  const [selectedGrupoId, setSelectedGrupoId] = useState<string>('avulso');
  const [loadingGrupos, setLoadingGrupos] = useState(true);

  // Lista de membros do sorteio
  const [membros, setMembros] = useState<Member[]>([]);
  const [search, setSearch] = useState('');

  // Adicionar novo jogador
  const [novoNome, setNovoNome] = useState('');
  const [novaAvaliacao, setNovaAvaliacao] = useState(3.0);

  // Configurações
  const [playersPerTeam, setPlayersPerTeam] = useState(6);
  const [sortMode, setSortMode] = useState<'balanced' | 'random'>('balanced');

  // Estado da Partida Ativa (Estilo Evento)
  const [timeA, setTimeA] = useState<Member[]>([]);
  const [timeB, setTimeB] = useState<Member[]>([]);
  const [filaEspera, setFilaEspera] = useState<Member[]>([]);
  const [placarA, setPlacarA] = useState(0);
  const [placarB, setPlacarB] = useState(0);
  const [vitoriasA, setVitoriasA] = useState(0);
  const [vitoriasB, setVitoriasB] = useState(0);
  const [numeroPartida, setNumeroPartida] = useState(1);
  const [historicoPartidas, setHistoricoPartidas] = useState<PartidaHistorico[]>([]);

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

        const parsedMembros: Member[] = (membersData
          .map((m: any) => {
            const u = m.usuarios;
            if (!u) return null;
            return {
              id: u.id,
              nome: u.nome,
              foto: u.foto || undefined,
              avaliacao: ratingMap.get(u.id) ?? 3.0,
              checked: true,
              isAvulso: false,
            };
          })
          .filter(Boolean) as Member[])
          .sort((a, b) => a.nome.localeCompare(b.nome));

        setMembros((prev) => {
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

    const novoJogador: Member = {
      id: `avulso_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      nome: nomeLimpo,
      avaliacao: novaAvaliacao,
      checked: true,
      isAvulso: true,
    };

    if (isJogoAtivo) {
      // Se o jogo já está rolando, adiciona direto na fila de espera
      setFilaEspera((prev) => [...prev, novoJogador]);
    }

    setMembros((prev) => [...prev, novoJogador]);
    setNovoNome('');
  };

  const handleRemoverJogador = (id: string) => {
    setMembros((prev) => prev.filter((m) => m.id !== id));
    setFilaEspera((prev) => prev.filter((m) => m.id !== id));
    setTimeA((prev) => prev.filter((m) => m.id !== id));
    setTimeB((prev) => prev.filter((m) => m.id !== id));
  };

  const toggleMemberChecked = (id: string) => {
    setMembros((prev) =>
      prev.map((m) => (m.id === id ? { ...m, checked: !m.checked } : m))
    );
  };

  const toggleAllMembers = (checked: boolean) => {
    setMembros((prev) => prev.map((m) => ({ ...m, checked })));
  };

  // Realiza o Sorteio Inicial dos Times
  const handleSortear = () => {
    const presentes = membros.filter((m) => m.checked);
    
    if (presentes.length < 2) {
      alert('Adicione pelo menos 2 jogadores presentes para realizar o sorteio.');
      return;
    }

    setIsDrawing(true);

    setTimeout(() => {
      let candidates = [...presentes];

      if (sortMode === 'balanced') {
        candidates.sort((a, b) => b.avaliacao - a.avaliacao);
      } else {
        candidates.sort(() => Math.random() - 0.5);
      }

      const maxPlayers = playersPerTeam * 2;
      const sortingPool = candidates.slice(0, Math.min(candidates.length, maxPlayers));
      const poolExcluidos = candidates.slice(sortingPool.length);

      const localTimeA: Member[] = [];
      const localTimeB: Member[] = [];

      if (sortMode === 'balanced') {
        sortingPool.forEach((player, index) => {
          const round = Math.floor(index / 2);
          if (round % 2 === 0) {
            if (index % 2 === 0) localTimeA.push(player);
            else localTimeB.push(player);
          } else {
            if (index % 2 === 0) localTimeB.push(player);
            else localTimeA.push(player);
          }
        });
      } else {
        sortingPool.forEach((player, index) => {
          if (index % 2 === 0) localTimeA.push(player);
          else localTimeB.push(player);
        });
      }

      setTimeA(localTimeA);
      setTimeB(localTimeB);
      setFilaEspera(poolExcluidos);
      setPlacarA(0);
      setPlacarB(0);
      setVitoriasA(0);
      setVitoriasB(0);
      setNumeroPartida(1);
      setHistoricoPartidas([]);
      setIsDrawing(false);
    }, 1000);
  };

  // Finalizar a partida ativa e aplicar a dinâmica do rodízio (Quem ganha fica)
  const handleFinalizarPartida = () => {
    let vencedor: 'A' | 'B' | 'empate' = 'empate';
    if (placarA > placarB) vencedor = 'A';
    if (placarB > placarA) vencedor = 'B';

    // Grava no histórico
    const novaPartida: PartidaHistorico = {
      numero: numeroPartida,
      placarA,
      placarB,
      vencedor,
      timeA: timeA.map((p) => p.nome),
      timeB: timeB.map((p) => p.nome),
    };

    setHistoricoPartidas((prev) => [...prev, novaPartida]);

    // Se houver fila de espera, faz o rodízio
    if (filaEspera.length > 0) {
      const quantidadeNecessaria = playersPerTeam;
      const novosEntrantes = filaEspera.slice(0, quantidadeNecessaria);
      const restanteFila = filaEspera.slice(quantidadeNecessaria);

      if (vencedor === 'A') {
        // Time A venceu: Time A fica, Time B vai para o final da fila, novos entrantes formam o Time B
        setVitoriasA((v) => v + 1);
        setVitoriasB(0);
        setTimeB(novosEntrantes);
        setFilaEspera([...restanteFila, ...timeB]);
      } else if (vencedor === 'B') {
        // Time B venceu: Time B fica, Time A vai para o final da fila, novos entrantes formam o Time A
        setVitoriasB((v) => v + 1);
        setVitoriasA(0);
        setTimeA(novosEntrantes);
        setFilaEspera([...restanteFila, ...timeA]);
      } else {
        // Empate: Time A fica (ou o que tinha mais vitórias) e Time B vai para a fila
        if (vitoriasB > vitoriasA) {
          setTimeA(novosEntrantes);
          setFilaEspera([...restanteFila, ...timeA]);
        } else {
          setTimeB(novosEntrantes);
          setFilaEspera([...restanteFila, ...timeB]);
        }
      }
    } else {
      // Sem fila de espera: apenas atualiza o contador de vitórias
      if (vencedor === 'A') {
        setVitoriasA((v) => v + 1);
        setVitoriasB(0);
      } else if (vencedor === 'B') {
        setVitoriasB((v) => v + 1);
        setVitoriasA(0);
      }
    }

    // Zera os placares para o próximo confronto e avança a rodada
    setPlacarA(0);
    setPlacarB(0);
    setNumeroPartida((n) => n + 1);
  };

  // Reequilibrar os times em quadra
  const handleReequilibrarEmQuadra = () => {
    const todosEmQuadra = [...timeA, ...timeB].sort((a, b) => b.avaliacao - a.avaliacao);
    const novoA: Member[] = [];
    const novoB: Member[] = [];

    todosEmQuadra.forEach((p, idx) => {
      if (idx % 2 === 0) novoA.push(p);
      else novoB.push(p);
    });

    setTimeA(novoA);
    setTimeB(novoB);
  };

  // Trocar jogador de time manualmente
  const handleTrocarDeTime = (jogador: Member, deTime: 'A' | 'B') => {
    if (deTime === 'A') {
      setTimeA((prev) => prev.filter((p) => p.id !== jogador.id));
      setTimeB((prev) => [...prev, jogador]);
    } else {
      setTimeB((prev) => prev.filter((p) => p.id !== jogador.id));
      setTimeA((prev) => [...prev, jogador]);
    }
  };

  // Mover jogador da quadra para a fila
  const handleMoverParaFila = (jogador: Member, deTime: 'A' | 'B') => {
    if (deTime === 'A') setTimeA((prev) => prev.filter((p) => p.id !== jogador.id));
    else setTimeB((prev) => prev.filter((p) => p.id !== jogador.id));
    setFilaEspera((prev) => [...prev, jogador]);
  };

  // Colocar jogador da fila no time
  const handleColocarEmQuadra = (jogador: Member, paraTime: 'A' | 'B') => {
    setFilaEspera((prev) => prev.filter((p) => p.id !== jogador.id));
    if (paraTime === 'A') setTimeA((prev) => [...prev, jogador]);
    else setTimeB((prev) => [...prev, jogador]);
  };

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

  const filteredMembros = membros.filter((m) =>
    m.nome.toLowerCase().includes(search.toLowerCase())
  );

  // Médias de estrelas
  const totalStarsA = timeA.reduce((sum, p) => sum + p.avaliacao, 0);
  const avgStarsA = timeA.length > 0 ? (totalStarsA / timeA.length).toFixed(1) : '0.0';
  const totalStarsB = timeB.reduce((sum, p) => sum + p.avaliacao, 0);
  const avgStarsB = timeB.length > 0 ? (totalStarsB / timeB.length).toFixed(1) : '0.0';
  const starDiff = Math.abs(totalStarsA - totalStarsB).toFixed(1);

  // Próximo time estimado da fila
  const proximoTimeEstimado = filaEspera.slice(0, playersPerTeam);

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
                <p className="text-[10px] font-bold text-slate-400">Vitórias seguidas: {vitoriasA}</p>
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
                <p className="text-[10px] font-bold text-slate-400">Vitórias seguidas: {vitoriasB}</p>
              </div>
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

            {/* BOTÃO FINALIZAR PARTIDA E RODAR A QUADRA */}
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
                  {filaEspera.length >= playersPerTeam
                    ? `Próximo time completo (${playersPerTeam} atletas prontos para entrar)`
                    : `Faltam ${playersPerTeam - filaEspera.length} para fechar o próximo time`}
                </span>
              </div>

              {/* Botão de re-embaralhar fila */}
              {filaEspera.length > 1 && (
                <button
                  type="button"
                  onClick={() => setFilaEspera((prev) => [...prev].sort(() => Math.random() - 0.5))}
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
                  ⚡ Entram no Próximo Jogo ({proximoTimeEstimado.length}/{playersPerTeam})
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
                      hp.vencedor === 'A' ? 'bg-red-100 text-red-700 font-black' :
                      hp.vencedor === 'B' ? 'bg-blue-100 text-blue-700 font-black' : 'bg-slate-200 text-slate-700 font-bold'
                    }`}>
                      {hp.vencedor === 'A' ? 'Vitória Time A' : hp.vencedor === 'B' ? 'Vitória Time B' : 'Empate'}
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

          {/* Configurações do Sorteio */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl text-left space-y-3 shadow-xs">
            <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1.5 border-b border-slate-200 pb-2">
              <Sparkles size={14} className="text-red-500" />
              Configurações da Partida
            </h3>
            
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">Jogadores / Time</label>
                <select
                  value={playersPerTeam}
                  onChange={(e) => setPlayersPerTeam(Number(e.target.value))}
                  className="w-full bg-white border border-slate-200 rounded-xl py-2 px-3 text-slate-900 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-red-500/20 cursor-pointer"
                >
                  {[2, 3, 4, 5, 6, 7, 8, 11].map((n) => (
                    <option key={n} value={n}>
                      {n} vs {n} ({n * 2} em quadra)
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">Tipo de Sorteio</label>
                <select
                  value={sortMode}
                  onChange={(e) => setSortMode(e.target.value as 'balanced' | 'random')}
                  className="w-full bg-white border border-slate-200 rounded-xl py-2 px-3 text-slate-900 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-red-500/20 cursor-pointer"
                >
                  <option value="balanced">⚖️ Equilibrado (Estrelas)</option>
                  <option value="random">🎲 Aleatório (Sorte Pura)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Lista de Atletas para o Sorteio */}
          <div className="glass p-4 rounded-2xl border border-slate-200 text-left space-y-3 shadow-sm bg-white">
            <div className="flex justify-between items-center border-b border-slate-200 pb-2">
              <div>
                <h3 className="text-xs font-black text-slate-800 uppercase tracking-wide">
                  Lista de Atletas ({membros.length})
                </h3>
                <span className="text-[10px] font-bold text-slate-400 block mt-0.5">
                  Presentes: {membros.filter((m) => m.checked).length} (Necessários: {playersPerTeam * 2})
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
                {membros.length > 0 && (
                  <>
                    <span className="text-slate-300 text-[10px]">|</span>
                    <button
                      type="button"
                      onClick={() => setMembros([])}
                      className="text-[10px] font-extrabold text-red-500 hover:underline cursor-pointer"
                    >
                      Limpar
                    </button>
                  </>
                )}
              </div>
            </div>

            {membros.length > 6 && (
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
            disabled={isDrawing || membros.filter((m) => m.checked).length < 2}
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
                  setFilaEspera([]);
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
