import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import type { Modalidade, Grupo, Comunidade } from '../../types';
import type { TorneioConfronto } from '../../types/torneio';
import {
  Trophy,
  ArrowLeft,
  GitMerge,
  Award,
  Users,
  Shuffle,
  Lock,
  Globe,
  Calendar,
  Clock,
  Check,
  ChevronRight,
  ChevronLeft,
  Building2,
  ShieldCheck,
  Sparkles
} from 'lucide-react';

interface ModalityPreset {
  icon: string;
  defaultPlayers: number;
  presets: { count: number; label: string }[];
}

const MODALITY_CONFIGS: Record<string, ModalityPreset> = {
  volei: {
    icon: '🏐',
    defaultPlayers: 2,
    presets: [
      { count: 2, label: '2x2 (Dupla)' },
      { count: 4, label: '4x4 (Quarteto)' },
      { count: 6, label: '6x6 (Sexteto)' },
    ],
  },
  futebol: {
    icon: '⚽',
    defaultPlayers: 7,
    presets: [
      { count: 5, label: '5x5 (Futsal)' },
      { count: 7, label: '7x7 (Society)' },
      { count: 11, label: '11x11 (Campo)' },
    ],
  },
  basquete: {
    icon: '🏀',
    defaultPlayers: 5,
    presets: [
      { count: 3, label: '3x3 (Meia Quadra)' },
      { count: 5, label: '5x5 (Completo)' },
    ],
  },
  futevolei: {
    icon: '🏖️',
    defaultPlayers: 2,
    presets: [
      { count: 2, label: '2x2 (Dupla)' },
      { count: 4, label: '4x4 (Quarteto)' },
    ],
  },
  'beach tennis': {
    icon: '🎾',
    defaultPlayers: 2,
    presets: [
      { count: 1, label: '1x1 (Simples)' },
      { count: 2, label: '2x2 (Dupla)' },
    ],
  },
  tenis: {
    icon: '🎾',
    defaultPlayers: 2,
    presets: [
      { count: 1, label: '1x1 (Simples)' },
      { count: 2, label: '2x2 (Dupla)' },
    ],
  },
  'tenis de mesa': {
    icon: '🏓',
    defaultPlayers: 1,
    presets: [
      { count: 1, label: '1x1 (Individual)' },
      { count: 2, label: '2x2 (Dupla)' },
    ],
  },
};

const DEFAULT_MODALITY_CONFIG: ModalityPreset = {
  icon: '🏆',
  defaultPlayers: 2,
  presets: [
    { count: 2, label: '2x2' },
    { count: 4, label: '4x4' },
    { count: 6, label: '6x6' },
    { count: 11, label: '11x11' },
  ],
};

function getModalityConfig(modalityName: string): ModalityPreset {
  if (!modalityName) return DEFAULT_MODALITY_CONFIG;
  const normalized = modalityName.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  for (const [key, conf] of Object.entries(MODALITY_CONFIGS)) {
    if (normalized.includes(key)) return conf;
  }
  return DEFAULT_MODALITY_CONFIG;
}

const DIAS_SEMANA_NOMES = [
  { val: 0, label: 'Dom', nomeCompleto: 'Domingo' },
  { val: 1, label: 'Seg', nomeCompleto: 'Segunda' },
  { val: 2, label: 'Ter', nomeCompleto: 'Terça' },
  { val: 3, label: 'Qua', nomeCompleto: 'Quarta' },
  { val: 4, label: 'Qui', nomeCompleto: 'Quinta' },
  { val: 5, label: 'Sex', nomeCompleto: 'Sexta' },
  { val: 6, label: 'Sáb', nomeCompleto: 'Sábado' },
];

export default function NovoTorneio() {
  const navigate = useNavigate();
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [loading, setLoading] = useState(false);

  // Passo 1: Dados Gerais
  const [nome, setNome] = useState('');
  const [modalidadeId, setModalidadeId] = useState('');

  // Passo 2: Formato e Acesso
  const [formato, setFormato] = useState<'chaveamento' | 'pontos_corridos'>('chaveamento');
  const [publico, setPublico] = useState(true);
  const [tipoVinculo, setTipoVinculo] = useState<'nenhum' | 'grupo' | 'comunidade'>('nenhum');
  const [grupoId, setGrupoId] = useState('');
  const [comunidadeId, setComunidadeId] = useState('');

  // Passo 3: Times e Formação (Até 32 times)
  const [quantidadeTimes, setQuantidadeTimes] = useState<number>(4);
  const [jogadoresPorTime, setJogadoresPorTime] = useState<number>(2);
  const [tipoTimes, setTipoTimes] = useState<'sorteio' | 'fechado'>('sorteio');
  const [timesCustom, setTimesCustom] = useState<string[]>(['Time 1', 'Time 2', 'Time 3', 'Time 4']);

  // Passo 4: Datas e Agendamento de Jogos
  const [dataInicio, setDataInicio] = useState(new Date().toISOString().split('T')[0]);
  const [dataFim, setDataFim] = useState('');
  const [jogosPorDia, setJogosPorDia] = useState<number>(2);
  const [diasSemana, setDiasSemana] = useState<number[]>([0, 6]); // Sáb e Dom padrão
  const [horarioInicio, setHorarioInicio] = useState<string>('14:00');
  const [intervaloMinutos, setIntervaloMinutos] = useState<number>(60);

  // Auxiliares do banco
  const [modalidades, setModalidades] = useState<Modalidade[]>([]);
  const [grupos, setGrupos] = useState<Grupo[]>([]);
  const [comunidades, setComunidades] = useState<Comunidade[]>([]);

  useEffect(() => {
    fetchAuxData();
  }, []);

  const fetchAuxData = async () => {
    try {
      // 1. Buscar modalidades e deduplicar rigorosamente por nome normalizado
      const { data: dbMod, error: modError } = await supabase.from('modalidades').select('*');
      let modArr: Modalidade[] = [];
      if (!modError && dbMod && dbMod.length > 0) {
        const seen = new Set<string>();
        modArr = (dbMod as Modalidade[]).filter((m) => {
          const key = m.nome.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
        setModalidades(modArr);
      } else {
        const defaultNames = ['Vôlei', 'Futebol', 'Basquete', 'Beach Tennis', 'Futevôlei', 'Tênis de Mesa'];
        const seedModalidades = defaultNames.map((nome) => ({ nome }));
        const { data: inserted } = await supabase.from('modalidades').insert(seedModalidades).select();
        if (inserted) {
          modArr = inserted as Modalidade[];
          setModalidades(modArr);
        }
      }

      if (modArr.length > 0) {
        setModalidadeId(modArr[0].id);
        const conf = getModalityConfig(modArr[0].nome);
        setJogadoresPorTime(conf.defaultPlayers);
      }

      // 2. Buscar Grupos e Comunidades vinculadas ao usuário
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase.from('usuarios').select('id').eq('email', user.email).single();
        if (profile) {
          const { data: dbMembros } = await supabase
            .from('membros_grupo')
            .select('grupo_id, grupos(id, nome)')
            .eq('usuario_id', profile.id)
            .eq('status', 'aprovado');
          if (dbMembros) {
            setGrupos(dbMembros.map((m: any) => m.grupos).filter(Boolean));
          }

          // Comunidades
          const { data: dbCom } = await supabase.from('comunidades').select('id, nome');
          if (dbCom) {
            setComunidades(dbCom as Comunidade[]);
          }
        }
      }
    } catch (e) {
      console.error('Erro ao carregar dados auxiliares:', e);
    }
  };

  const handleSelectModalidade = (mId: string) => {
    setModalidadeId(mId);
    const found = modalidades.find((m) => m.id === mId);
    if (found) {
      const conf = getModalityConfig(found.nome);
      setJogadoresPorTime(conf.defaultPlayers);
    }
  };

  const handleQtyChange = (qty: number) => {
    setQuantidadeTimes(qty);
    const newArr = Array.from({ length: qty }, (_, i) => timesCustom[i] || `Time ${i + 1}`);
    setTimesCustom(newArr);
  };

  const handleTimeNameChange = (idx: number, val: string) => {
    const updated = [...timesCustom];
    updated[idx] = val;
    setTimesCustom(updated);
  };

  const toggleDiaSemana = (dia: number) => {
    if (diasSemana.includes(dia)) {
      if (diasSemana.length > 1) {
        setDiasSemana(diasSemana.filter((d) => d !== dia));
      }
    } else {
      setDiasSemana([...diasSemana, dia].sort());
    }
  };

  // Cálculo de partidas estimadas
  const totalJogosEstimados =
    formato === 'chaveamento'
      ? quantidadeTimes - 1
      : Math.floor((quantidadeTimes * (quantidadeTimes - 1)) / 2);

  const diasNecessarios = Math.ceil(totalJogosEstimados / Math.max(1, jogosPorDia));

  // Função para gerar slots automáticos de data e hora para os jogos
  const gerarSlotsDataHora = (): string[] => {
    const slots: string[] = [];
    const [startHour, startMin] = horarioInicio.split(':').map(Number);
    let current = new Date(dataInicio + 'T00:00:00');
    const maxDate = dataFim ? new Date(dataFim + 'T23:59:59') : null;

    let loopSafety = 0;
    while (slots.length < totalJogosEstimados && loopSafety < 365) {
      loopSafety++;
      const dayOfWeek = current.getDay();

      if (diasSemana.includes(dayOfWeek)) {
        for (let j = 0; j < jogosPorDia && slots.length < totalJogosEstimados; j++) {
          const gameTime = new Date(current);
          gameTime.setHours(startHour, startMin + j * intervaloMinutos, 0, 0);

          if (maxDate && gameTime > maxDate) break;

          const yyyy = gameTime.getFullYear();
          const mm = String(gameTime.getMonth() + 1).padStart(2, '0');
          const dd = String(gameTime.getDate()).padStart(2, '0');
          const hh = String(gameTime.getHours()).padStart(2, '0');
          const min = String(gameTime.getMinutes()).padStart(2, '0');
          slots.push(`${yyyy}-${mm}-${dd}T${hh}:${min}`);
        }
      }

      current.setDate(current.getDate() + 1);
      if (maxDate && current > maxDate && slots.length < totalJogosEstimados) {
        break;
      }
    }

    return slots;
  };

  // Validações por passo
  const handleAvancar = () => {
    if (step === 1) {
      if (!nome.trim()) {
        alert('Por favor, informe o nome do torneio.');
        return;
      }
      if (!modalidadeId) {
        alert('Por favor, selecione uma modalidade esportiva.');
        return;
      }
      setStep(2);
    } else if (step === 2) {
      setStep(3);
    } else if (step === 3) {
      if (quantidadeTimes < 2) {
        alert('O torneio precisa ter no mínimo 2 times.');
        return;
      }
      setStep(4);
    }
  };

  const handleSalvar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim()) return alert('Por favor, informe o nome do torneio.');

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return alert('Usuário não autenticado.');

      const { data: profile } = await supabase.from('usuarios').select('id, nome, foto').eq('email', user.email).single();
      const creatorId = profile?.id || user.id;

      // Monta times iniciais
      const initialTimes = timesCustom.map((tName, idx) => ({
        id: `t_${idx + 1}_${Date.now()}`,
        nome: tName || `Time ${idx + 1}`,
        jogadores: [],
      }));

      // Inscrição do criador
      const initialParticipantes = profile
        ? [{ id: profile.id, nome: profile.nome, foto: profile.foto || '' }]
        : [];

      // Gera slots de agendamento de jogos
      const scheduleSlots = gerarSlotsDataHora();

      // Monta estrutura de confrontos preliminares com datas atribuídas
      const confrontosIniciais: TorneioConfronto[] = [];
      if (formato === 'chaveamento') {
        const numTimes = quantidadeTimes;
        if (numTimes === 4) {
          confrontosIniciais.push({
            id: `match_semi_0_${Date.now()}`,
            fase: 'Semifinal',
            rodada: 1,
            timeA: initialTimes[0],
            timeB: initialTimes[1],
            placarA: 0,
            placarB: 0,
            dataHora: scheduleSlots[0] || undefined,
          });
          confrontosIniciais.push({
            id: `match_semi_1_${Date.now()}`,
            fase: 'Semifinal',
            rodada: 1,
            timeA: initialTimes[2],
            timeB: initialTimes[3],
            placarA: 0,
            placarB: 0,
            dataHora: scheduleSlots[1] || undefined,
          });
          confrontosIniciais.push({
            id: `match_final_0_${Date.now()}`,
            fase: 'Final',
            rodada: 2,
            timeA: { id: 'pending_semi_0', nome: 'Vencedor Semi 1' },
            timeB: { id: 'pending_semi_1', nome: 'Vencedor Semi 2' },
            placarA: 0,
            placarB: 0,
            dataHora: scheduleSlots[2] || undefined,
          });
        }
      }

      const configuracaoJogos = {
        jogosPorDia,
        diasSemana,
        horarioInicio,
        intervaloMinutos,
      };

      const novoTorneio = {
        criador_id: creatorId,
        nome: nome.trim(),
        modalidade_id: modalidadeId || null,
        grupo_id: !publico && tipoVinculo === 'grupo' && grupoId ? grupoId : null,
        comunidade_id: !publico && tipoVinculo === 'comunidade' && comunidadeId ? comunidadeId : null,
        formato,
        publico,
        quantidade_times: quantidadeTimes,
        jogadores_por_time: jogadoresPorTime,
        tipo_times: tipoTimes,
        data_inicio: dataInicio,
        data_fim: dataFim || null,
        participantes: initialParticipantes,
        times: initialTimes,
        chaveamento: confrontosIniciais,
        configuracao_jogos: configuracaoJogos,
        status: 'rascunho',
      };

      let { data, error } = await supabase
        .from('torneios')
        .insert(novoTorneio)
        .select('id')
        .single();

      // Fallback gracioso para tabelas que ainda não possuem comunidade_id ou configuracao_jogos
      if (error && error.message?.includes('column')) {
        const fallbackTorneio = {
          criador_id: creatorId,
          nome: nome.trim(),
          modalidade_id: modalidadeId || null,
          grupo_id: !publico && tipoVinculo === 'grupo' && grupoId ? grupoId : null,
          formato,
          publico,
          quantidade_times: quantidadeTimes,
          jogadores_por_time: jogadoresPorTime,
          tipo_times: tipoTimes,
          data_inicio: dataInicio,
          data_fim: dataFim || null,
          participantes: initialParticipantes,
          times: initialTimes,
          chaveamento: confrontosIniciais,
          status: 'rascunho',
        };
        const resFallback = await supabase
          .from('torneios')
          .insert(fallbackTorneio)
          .select('id')
          .single();
        data = resFallback.data;
        error = resFallback.error;
      }

      if (error) {
        alert('Erro ao criar torneio: ' + error.message);
      } else if (data) {
        navigate(`/torneios/${data.id}`);
      }
    } catch (err: any) {
      alert('Erro inesperado: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const currentModalityObj = modalidades.find((m) => m.id === modalidadeId);
  const currentModalityConfig = getModalityConfig(currentModalityObj?.nome || '');

  return (
    <div className="px-4 py-3 pb-24 w-full max-w-md mx-auto min-h-[calc(100vh-8rem)] space-y-4">
      {/* Topo com botão voltar e Stepper */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <button
            onClick={() => {
              if (step > 1) setStep((step - 1) as any);
              else navigate('/torneios');
            }}
            className="p-2 rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200 cursor-pointer"
          >
            <ArrowLeft size={18} />
          </button>
          <h1 className="text-lg font-black text-slate-900">Novo Torneio</h1>
          <span className="text-xs font-black px-2.5 py-1 bg-red-50 text-red-650 rounded-full border border-red-200">
            Passo {step} de 4
          </span>
        </div>

        {/* Indicador de Passos (Stepper) */}
        <div className="grid grid-cols-4 gap-1.5">
          {[
            { num: 1, label: 'Geral' },
            { num: 2, label: 'Acesso' },
            { num: 3, label: 'Times' },
            { num: 4, label: 'Jogos' },
          ].map((s) => (
            <div
              key={s.num}
              onClick={() => {
                // Permite voltar a passos anteriores já preenchidos
                if (s.num < step) setStep(s.num as any);
              }}
              className={`flex flex-col items-center py-1.5 rounded-xl border transition-all cursor-pointer ${
                step === s.num
                  ? 'bg-red-500 text-white border-red-500 shadow-xs'
                  : s.num < step
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                  : 'bg-slate-100 text-slate-400 border-slate-200 opacity-60'
              }`}
            >
              <span className="text-[11px] font-black">{s.num}. {s.label}</span>
            </div>
          ))}
        </div>
      </div>

      <form onSubmit={handleSalvar} className="space-y-4">
        {/* =========================================================================
            PASSO 1: NOME E MODALIDADE DO ESPORTE
        ========================================================================= */}
        {step === 1 && (
          <div className="space-y-4 animate-fade-in text-left">
            {/* Nome do Torneio */}
            <div className="glass p-4 rounded-2xl border border-slate-200 space-y-2">
              <label className="text-xs font-black text-slate-700 uppercase tracking-wider block">
                Nome do Torneio *
              </label>
              <input
                type="text"
                required
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Ex: 1º Torneio de Verão Imperial"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-500"
              />
            </div>

            {/* Modalidade do Esporte (Sem repetições) */}
            <div className="glass p-4 rounded-2xl border border-slate-200 space-y-2.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-black text-slate-700 uppercase tracking-wider block">
                  Modalidade do Esporte *
                </label>
                <span className="text-[10px] text-slate-400 font-semibold">
                  {currentModalityObj?.nome || 'Selecione uma modalidade'}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2">
                {modalidades.map((m) => {
                  const conf = getModalityConfig(m.nome);
                  const isSelected = modalidadeId === m.id;
                  return (
                    <button
                      type="button"
                      key={m.id}
                      onClick={() => handleSelectModalidade(m.id)}
                      className={`p-2.5 rounded-xl border flex flex-col items-center justify-center gap-1 transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-red-50 border-red-500 text-red-650 font-black shadow-xs ring-2 ring-red-500/20 scale-102'
                          : 'bg-slate-50 border-slate-200 text-slate-650 hover:bg-slate-100 font-semibold'
                      }`}
                    >
                      <span className="text-2xl">{conf.icon}</span>
                      <span className="text-[11px] truncate max-w-full">{m.nome}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* =========================================================================
            PASSO 2: FORMATO DO CAMPEONATO & PRIVACIDADE / ACESSO
        ========================================================================= */}
        {step === 2 && (
          <div className="space-y-4 animate-fade-in text-left">
            {/* Formato do Campeonato */}
            <div className="glass p-4 rounded-2xl border border-slate-200 space-y-2">
              <label className="text-xs font-black text-slate-700 uppercase tracking-wider block">
                Formato do Campeonato
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setFormato('chaveamento')}
                  className={`p-3 rounded-xl border flex flex-col items-center gap-1.5 transition-all cursor-pointer ${
                    formato === 'chaveamento'
                      ? 'bg-amber-50 border-amber-400 text-amber-900 font-bold shadow-sm'
                      : 'bg-slate-50 border-slate-200 text-slate-600'
                  }`}
                >
                  <GitMerge size={20} className={formato === 'chaveamento' ? 'text-amber-600' : ''} />
                  <span className="text-xs font-bold">Chaveamento</span>
                  <span className="text-[9px] text-slate-400 font-normal">Mata-Mata / Eliminatórias</span>
                </button>

                <button
                  type="button"
                  onClick={() => setFormato('pontos_corridos')}
                  className={`p-3 rounded-xl border flex flex-col items-center gap-1.5 transition-all cursor-pointer ${
                    formato === 'pontos_corridos'
                      ? 'bg-amber-50 border-amber-400 text-amber-900 font-bold shadow-sm'
                      : 'bg-slate-50 border-slate-200 text-slate-600'
                  }`}
                >
                  <Award size={20} className={formato === 'pontos_corridos' ? 'text-amber-600' : ''} />
                  <span className="text-xs font-bold">Pontos Corridos</span>
                  <span className="text-[9px] text-slate-400 font-normal">Todos contra todos</span>
                </button>
              </div>
            </div>

            {/* Privacidade */}
            <div className="glass p-4 rounded-2xl border border-slate-200 space-y-2">
              <label className="text-xs font-black text-slate-700 uppercase tracking-wider block">
                Privacidade do Torneio
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setPublico(true);
                    setTipoVinculo('nenhum');
                    setGrupoId('');
                    setComunidadeId('');
                  }}
                  className={`p-3 rounded-xl border flex flex-col items-center gap-1 transition-all cursor-pointer ${
                    publico
                      ? 'bg-emerald-50 border-emerald-400 text-emerald-900 font-bold shadow-xs'
                      : 'bg-slate-50 border-slate-200 text-slate-600'
                  }`}
                >
                  <Globe size={18} className={publico ? 'text-emerald-600' : ''} />
                  <span className="text-xs font-bold">Público</span>
                  <span className="text-[9px] text-slate-400">Aberto para todos</span>
                </button>

                <button
                  type="button"
                  onClick={() => setPublico(false)}
                  className={`p-3 rounded-xl border flex flex-col items-center gap-1 transition-all cursor-pointer ${
                    !publico
                      ? 'bg-amber-50 border-amber-400 text-amber-900 font-bold shadow-xs'
                      : 'bg-slate-50 border-slate-200 text-slate-600'
                  }`}
                >
                  <Lock size={18} className={!publico ? 'text-amber-600' : ''} />
                  <span className="text-xs font-bold">Privado</span>
                  <span className="text-[9px] text-slate-400">Restrito / Grupo / Comunidade</span>
                </button>
              </div>
            </div>

            {/* Vínculo de Grupo ou Comunidade (Desabilitado se for Público) */}
            <div className={`glass p-4 rounded-2xl border transition-all ${
              publico
                ? 'bg-slate-100/70 border-slate-200 opacity-60 pointer-events-none'
                : 'border-slate-200 space-y-3'
            }`}>
              <div className="flex items-center justify-between">
                <label className="text-xs font-black text-slate-700 uppercase tracking-wider block">
                  Restrição de Acesso (Privado)
                </label>
                {publico && (
                  <span className="text-[10px] text-amber-600 font-bold bg-amber-50 px-2 py-0.5 rounded-full">
                    Desabilitado em Torneios Públicos
                  </span>
                )}
              </div>

              {!publico && (
                <>
                  <div className="grid grid-cols-3 gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        setTipoVinculo('nenhum');
                        setGrupoId('');
                        setComunidadeId('');
                      }}
                      className={`py-2 px-1 rounded-xl text-xs font-bold border cursor-pointer transition-all ${
                        tipoVinculo === 'nenhum'
                          ? 'bg-red-50 text-red-650 border-red-300 font-black shadow-xs'
                          : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      Apenas Convite
                    </button>

                    <button
                      type="button"
                      onClick={() => setTipoVinculo('grupo')}
                      className={`py-2 px-1 rounded-xl text-xs font-bold border cursor-pointer transition-all flex items-center justify-center gap-1 ${
                        tipoVinculo === 'grupo'
                          ? 'bg-red-50 text-red-650 border-red-300 font-black shadow-xs'
                          : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      <Users size={12} />
                      <span>Grupo</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setTipoVinculo('comunidade')}
                      className={`py-2 px-1 rounded-xl text-xs font-bold border cursor-pointer transition-all flex items-center justify-center gap-1 ${
                        tipoVinculo === 'comunidade'
                          ? 'bg-red-50 text-red-650 border-red-300 font-black shadow-xs'
                          : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      <Building2 size={12} />
                      <span>Comunidade</span>
                    </button>
                  </div>

                  {tipoVinculo === 'grupo' && (
                    <div className="space-y-1 pt-1">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                        Selecione o Grupo
                      </label>
                      <select
                        value={grupoId}
                        onChange={(e) => setGrupoId(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-bold text-slate-900"
                      >
                        <option value="">Selecione um grupo...</option>
                        {grupos.map((g) => (
                          <option key={g.id} value={g.id}>{g.nome}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  {tipoVinculo === 'comunidade' && (
                    <div className="space-y-1 pt-1">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                        Selecione a Comunidade (Abrange todos os grupos)
                      </label>
                      <select
                        value={comunidadeId}
                        onChange={(e) => setComunidadeId(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-bold text-slate-900"
                      >
                        <option value="">Selecione uma comunidade...</option>
                        {comunidades.map((c) => (
                          <option key={c.id} value={c.id}>{c.nome}</option>
                        ))}
                      </select>
                      <p className="text-[10px] text-slate-400">
                        * Todos os atletas dos grupos pertencentes a esta comunidade poderão participar.
                      </p>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}

        {/* =========================================================================
            PASSO 3: QUANTIDADE DE TIMES (ATÉ 32) & FORMAÇÃO
        ========================================================================= */}
        {step === 3 && (
          <div className="space-y-4 animate-fade-in text-left">
            {/* Jogadores por time (livre + presets) */}
            <div className="glass p-4 rounded-2xl border border-slate-200 space-y-3">
              <div className="flex justify-between items-start gap-2">
                <div>
                  <label className="text-xs font-black text-slate-700 uppercase tracking-wider block">
                    Jogadores por Time
                  </label>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    Total: <strong className="text-slate-800">{quantidadeTimes * jogadoresPorTime} atletas</strong> ({quantidadeTimes} times de {jogadoresPorTime})
                  </p>
                </div>

                {/* Controle Livre: Botões - e + e Input Numérico */}
                <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl border border-slate-200 shrink-0">
                  <button
                    type="button"
                    onClick={() => setJogadoresPorTime(Math.max(1, jogadoresPorTime - 1))}
                    className="w-7 h-7 rounded-lg bg-white hover:bg-slate-200 text-slate-700 font-black text-sm flex items-center justify-center transition-all cursor-pointer shadow-xs active:scale-95"
                    title="Diminuir jogadores por time"
                  >
                    -
                  </button>

                  <div className="flex items-center justify-center min-w-[3.5rem] px-1">
                    <input
                      type="number"
                      min={1}
                      max={30}
                      value={jogadoresPorTime}
                      onChange={(e) => {
                        const val = parseInt(e.target.value, 10);
                        if (!isNaN(val) && val >= 1) {
                          setJogadoresPorTime(Math.min(30, val));
                        }
                      }}
                      className="w-7 text-center text-xs font-black text-slate-900 bg-transparent focus:outline-none"
                    />
                    <span className="text-[10px] font-bold text-slate-400 -ml-0.5">x</span>
                    <span className="text-xs font-black text-slate-900 ml-0.5">{jogadoresPorTime}</span>
                  </div>

                  <button
                    type="button"
                    onClick={() => setJogadoresPorTime(Math.min(30, jogadoresPorTime + 1))}
                    className="w-7 h-7 rounded-lg bg-white hover:bg-slate-200 text-slate-700 font-black text-sm flex items-center justify-center transition-all cursor-pointer shadow-xs active:scale-95"
                    title="Aumentar jogadores por time"
                  >
                    +
                  </button>
                </div>
              </div>

              {/* Formatos Recomendados */}
              <div className="pt-1">
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
                  Formatos recomendados ({currentModalityObj?.nome || 'Esporte'}):
                </span>
                <div className="flex flex-wrap gap-2">
                  {currentModalityConfig.presets.map((preset) => (
                    <button
                      type="button"
                      key={preset.count}
                      onClick={() => setJogadoresPorTime(preset.count)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer border transition-all active:scale-95 ${
                        jogadoresPorTime === preset.count
                          ? 'bg-[#eb3237] text-white border-[#eb3237] shadow-sm font-black'
                          : 'bg-slate-50 text-slate-650 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Quantidade de Times (Até 32 times) */}
            <div className="glass p-4 rounded-2xl border border-slate-200 space-y-3">
              <div className="flex justify-between items-center">
                <label className="text-xs font-black text-slate-700 uppercase tracking-wider">
                  Quantidade de Times ({quantidadeTimes})
                </label>
                <div className="flex items-center gap-1.5">
                  {[4, 8, 16, 32].map((qty) => (
                    <button
                      type="button"
                      key={qty}
                      onClick={() => handleQtyChange(qty)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-black cursor-pointer border transition-all ${
                        quantidadeTimes === qty
                          ? 'bg-amber-500 text-white border-amber-500 shadow-sm scale-105'
                          : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'
                      }`}
                    >
                      {qty}
                    </button>
                  ))}
                </div>
              </div>

              {/* Montagem dos Times */}
              <div className="space-y-1 pt-1 border-t border-slate-100">
                <label className="text-[10px] font-black text-slate-600 uppercase tracking-wider block">
                  Montagem dos Times
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setTipoTimes('sorteio')}
                    className={`p-2.5 rounded-xl border flex items-center justify-center gap-1.5 cursor-pointer text-xs font-bold ${
                      tipoTimes === 'sorteio'
                        ? 'bg-amber-50 border-amber-400 text-amber-900 font-black shadow-xs'
                        : 'bg-slate-50 border-slate-200 text-slate-600'
                    }`}
                  >
                    <Shuffle size={14} />
                    <span>Por Sorteio</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setTipoTimes('fechado')}
                    className={`p-2.5 rounded-xl border flex items-center justify-center gap-1.5 cursor-pointer text-xs font-bold ${
                      tipoTimes === 'fechado'
                        ? 'bg-amber-50 border-amber-400 text-amber-900 font-black shadow-xs'
                        : 'bg-slate-50 border-slate-200 text-slate-600'
                    }`}
                  >
                    <ShieldCheck size={14} />
                    <span>Times Fechados</span>
                  </button>
                </div>
              </div>

              {/* Lista dos nomes dos times */}
              <div className="pt-2 border-t border-slate-100">
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider block mb-2">
                  Nomes dos Times (Editáveis):
                </span>
                <div className="grid grid-cols-2 gap-1.5 max-h-48 overflow-y-auto pr-1 no-scrollbar">
                  {timesCustom.map((tName, idx) => (
                    <input
                      key={idx}
                      type="text"
                      value={tName}
                      onChange={(e) => handleTimeNameChange(idx, e.target.value)}
                      placeholder={`Time ${idx + 1}`}
                      className="bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-semibold text-slate-800"
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* =========================================================================
            PASSO 4: DATAS, AGENDAMENTO E GRADE DE JOGOS
        ========================================================================= */}
        {step === 4 && (
          <div className="space-y-4 animate-fade-in text-left">
            {/* Período do Torneio */}
            <div className="glass p-4 rounded-2xl border border-slate-200 space-y-3">
              <label className="text-xs font-black text-slate-700 uppercase tracking-wider block">
                Período do Campeonato
              </label>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-slate-500 block">Data de Início *</span>
                  <input
                    type="date"
                    required
                    value={dataInicio}
                    onChange={(e) => setDataInicio(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 text-xs font-bold text-slate-900"
                  />
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-slate-500 block">Data de Término (Opt)</span>
                  <input
                    type="date"
                    value={dataFim}
                    onChange={(e) => setDataFim(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 text-xs font-bold text-slate-900"
                  />
                </div>
              </div>
            </div>

            {/* Agendamento de Jogos */}
            <div className="glass p-4 rounded-2xl border border-slate-200 space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-black text-slate-700 uppercase tracking-wider block">
                  Programação dos Jogos
                </label>
                <span className="text-[10px] text-red-650 font-bold">
                  {totalJogosEstimados} partida{totalJogosEstimados > 1 ? 's' : ''} estimada{totalJogosEstimados > 1 ? 's' : ''}
                </span>
              </div>

              {/* Quantidade de jogos por dia */}
              <div className="space-y-1.5">
                <span className="text-[10px] font-black text-slate-600 uppercase tracking-wider block">
                  Quantos jogos por dia?
                </span>
                <div className="flex items-center gap-1.5">
                  {[1, 2, 3, 4, 6].map((num) => (
                    <button
                      type="button"
                      key={num}
                      onClick={() => setJogosPorDia(num)}
                      className={`flex-1 py-1.5 rounded-xl text-xs font-black border transition-all cursor-pointer ${
                        jogosPorDia === num
                          ? 'bg-[#eb3237] text-white border-[#eb3237] shadow-xs'
                          : 'bg-slate-50 text-slate-650 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {num}
                    </button>
                  ))}
                </div>
              </div>

              {/* Dias da semana preferenciais */}
              <div className="space-y-1.5 pt-1">
                <span className="text-[10px] font-black text-slate-600 uppercase tracking-wider block">
                  Dias da semana preferenciais:
                </span>
                <div className="grid grid-cols-7 gap-1">
                  {DIAS_SEMANA_NOMES.map((d) => {
                    const isSelected = diasSemana.includes(d.val);
                    return (
                      <button
                        type="button"
                        key={d.val}
                        onClick={() => toggleDiaSemana(d.val)}
                        className={`py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer flex flex-col items-center justify-center ${
                          isSelected
                            ? 'bg-amber-500 text-white border-amber-500 font-black shadow-xs'
                            : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100'
                        }`}
                        title={d.nomeCompleto}
                      >
                        <span>{d.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Horário e Intervalo */}
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div className="space-y-1">
                  <span className="text-[10px] font-black text-slate-600 uppercase tracking-wider block">
                    Horário de Início
                  </span>
                  <input
                    type="time"
                    value={horarioInicio}
                    onChange={(e) => setHorarioInicio(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 text-xs font-bold text-slate-900"
                  />
                </div>

                <div className="space-y-1">
                  <span className="text-[10px] font-black text-slate-600 uppercase tracking-wider block">
                    Intervalo / Jogo
                  </span>
                  <select
                    value={intervaloMinutos}
                    onChange={(e) => setIntervaloMinutos(Number(e.target.value))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 text-xs font-bold text-slate-900"
                  >
                    <option value={30}>30 minutos</option>
                    <option value={45}>45 minutos</option>
                    <option value={60}>1 hora (60m)</option>
                    <option value={90}>1h30 (90m)</option>
                    <option value={120}>2 horas</option>
                  </select>
                </div>
              </div>

              {/* Card Resumo do Agendamento */}
              <div className="p-3 bg-red-50/60 border border-red-200/60 rounded-xl text-xs text-slate-700 space-y-1">
                <p className="font-bold flex items-center gap-1.5 text-red-650">
                  <Clock size={14} />
                  <span>Estimativa da Grade:</span>
                </p>
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  Serão <strong>{totalJogosEstimados} jogos</strong> distribuídos em cerca de <strong>{diasNecessarios} dia(s) de rodada</strong> nos dias selecionados ({jogosPorDia} jogos/dia a partir das {horarioInicio}).
                </p>
                <p className="text-[10px] text-slate-400">
                  * Você poderá ajustar individualmente a data e o horário de qualquer jogo após criar o torneio.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Botões de Ação do Rodapé */}
        <div className="flex items-center gap-2 pt-2">
          {step > 1 && (
            <button
              type="button"
              onClick={() => setStep((step - 1) as any)}
              className="py-3.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-2xl text-xs active:scale-95 transition-all cursor-pointer flex items-center gap-1"
            >
              <ChevronLeft size={16} />
              <span>Voltar</span>
            </button>
          )}

          {step < 4 ? (
            <button
              type="button"
              onClick={handleAvancar}
              className="flex-1 py-3.5 bg-[#eb3237] hover:bg-red-650 text-white font-black rounded-2xl text-xs shadow-lg active:scale-98 transition-all cursor-pointer flex items-center justify-center gap-1.5"
            >
              <span>Continuar</span>
              <ChevronRight size={16} />
            </button>
          ) : (
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-3.5 bg-gradient-to-r from-[#eb3237] to-amber-600 hover:from-red-650 hover:to-amber-700 text-white font-black rounded-2xl text-xs shadow-xl active:scale-98 transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <Trophy size={16} />
                  <span>Criar Torneio</span>
                </>
              )}
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
