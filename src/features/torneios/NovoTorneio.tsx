import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import type { Modalidade, Grupo } from '../../types';
import { Trophy, ArrowLeft, GitMerge, Award, Users, Shuffle, ShieldCheck, Lock, Globe, Calendar } from 'lucide-react';

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

export default function NovoTorneio() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  // Form State
  const [nome, setNome] = useState('');
  const [modalidadeId, setModalidadeId] = useState('');
  const [formato, setFormato] = useState<'chaveamento' | 'pontos_corridos'>('chaveamento');
  const [publico, setPublico] = useState(true);
  const [quantidadeTimes, setQuantidadeTimes] = useState<number>(4);
  const [jogadoresPorTime, setJogadoresPorTime] = useState<number>(2);
  const [tipoTimes, setTipoTimes] = useState<'sorteio' | 'fechado'>('sorteio');
  const [dataInicio, setDataInicio] = useState(new Date().toISOString().split('T')[0]);
  const [dataFim, setDataFim] = useState('');
  const [grupoId, setGrupoId] = useState('');

  // Auxiliares
  const [modalidades, setModalidades] = useState<Modalidade[]>([]);
  const [grupos, setGrupos] = useState<Grupo[]>([]);
  const [timesCustom, setTimesCustom] = useState<string[]>(['Time 1', 'Time 2', 'Time 3', 'Time 4']);

  useEffect(() => {
    fetchAuxData();
  }, []);

  const fetchAuxData = async () => {
    try {
      const { data: dbMod, error: modError } = await supabase.from('modalidades').select('*');
      let modArr: Modalidade[] = [];
      if (!modError && dbMod && dbMod.length > 0) {
        modArr = dbMod as Modalidade[];
        setModalidades(modArr);
      } else {
        // Fallback: se a tabela estiver vazia, semear modalidades esportivas padrão
        const defaultNames = ['Vôlei', 'Futebol', 'Basquete', 'Beach Tennis', 'Futevôlei', 'Tênis de Mesa'];
        const seedModalidades = defaultNames.map((nome) => ({ nome }));
        const { data: inserted } = await supabase.from('modalidades').insert(seedModalidades).select();
        if (inserted) {
          modArr = inserted as Modalidade[];
          setModalidades(modArr);
        }
      }

      // Se houver modalidades, seleciona a primeira por padrão
      if (modArr.length > 0) {
        setModalidadeId(modArr[0].id);
        const conf = getModalityConfig(modArr[0].nome);
        setJogadoresPorTime(conf.defaultPlayers);
      }

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

  const handleSalvar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim()) return alert('Por favor, informe o nome do torneio.');

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return alert('Usuário não autenticado.');

      const { data: profile } = await supabase.from('usuarios').select('id, nome, foto').eq('email', user.email).single();
      const creatorId = profile?.id || user.id;

      // Monta objeto dos times iniciais (com array de jogadores por time)
      const initialTimes = timesCustom.map((tName, idx) => ({
        id: `t_${idx + 1}_${Date.now()}`,
        nome: tName || `Time ${idx + 1}`,
        jogadores: [],
      }));

      // Adiciona o criador à lista inicial de inscritos no torneio
      const initialParticipantes = profile
        ? [{ id: profile.id, nome: profile.nome, foto: profile.foto || '' }]
        : [];

      const novoTorneio = {
        criador_id: creatorId,
        nome: nome.trim(),
        modalidade_id: modalidadeId || null,
        grupo_id: grupoId || null,
        formato,
        publico,
        quantidade_times: quantidadeTimes,
        jogadores_por_time: jogadoresPorTime,
        tipo_times: tipoTimes,
        data_inicio: dataInicio,
        data_fim: dataFim || null,
        participantes: initialParticipantes,
        times: initialTimes,
        chaveamento: [],
        status: 'rascunho',
      };

      let { data, error } = await supabase
        .from('torneios')
        .insert(novoTorneio)
        .select('id')
        .single();

      // Fallback para bancos que ainda não rodaram as novas colunas
      if (error && error.message?.includes('column')) {
        const fallbackTorneio = {
          criador_id: creatorId,
          nome: nome.trim(),
          modalidade_id: modalidadeId || null,
          grupo_id: grupoId || null,
          formato,
          publico,
          quantidade_times: quantidadeTimes,
          tipo_times: tipoTimes,
          data_inicio: dataInicio,
          data_fim: dataFim || null,
          times: initialTimes,
          chaveamento: [],
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
    <div className="px-4 py-3 pb-24 w-full max-w-md mx-auto min-h-[calc(100vh-8rem)] space-y-5">
      {/* Topo */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate('/torneios')}
          className="p-2 rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200 cursor-pointer"
        >
          <ArrowLeft size={18} />
        </button>
        <h1 className="text-xl font-black text-slate-900">Novo Torneio</h1>
      </div>

      <form onSubmit={handleSalvar} className="space-y-4">
        {/* Nome do Torneio */}
        <div className="glass p-4 rounded-2xl border border-slate-200 space-y-2 text-left">
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

        {/* 1. SELEÇÃO DA MODALIDADE DO ESPORTE (NO TOPO) */}
        <div className="glass p-4 rounded-2xl border border-slate-200 space-y-2.5 text-left">
          <div className="flex items-center justify-between">
            <label className="text-xs font-black text-slate-700 uppercase tracking-wider block">
              Modalidade do Esporte *
            </label>
            <span className="text-[10px] text-slate-400 font-semibold">
              {currentModalityObj?.nome || 'Selecione o esporte'}
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
                      ? 'bg-red-50 border-red-500 text-red-650 font-black shadow-xs ring-2 ring-red-500/20'
                      : 'bg-slate-50 border-slate-200 text-slate-650 hover:bg-slate-100 font-semibold'
                  }`}
                >
                  <span className="text-xl">{conf.icon}</span>
                  <span className="text-[11px] truncate max-w-full">{m.nome}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Formato do Torneio */}
        <div className="glass p-4 rounded-2xl border border-slate-200 space-y-2 text-left">
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

        {/* Visibilidade e Tipo de Montagem dos Times */}
        <div className="grid grid-cols-2 gap-3 text-left">
          <div className="glass p-3.5 rounded-2xl border border-slate-200 space-y-1.5">
            <label className="text-[10px] font-black text-slate-600 uppercase tracking-wider block">Privacidade</label>
            <select
              value={publico ? 'pub' : 'priv'}
              onChange={(e) => setPublico(e.target.value === 'pub')}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 text-xs font-bold text-slate-900"
            >
              <option value="pub">🌐 Público</option>
              <option value="priv">🔒 Privado</option>
            </select>
          </div>

          <div className="glass p-3.5 rounded-2xl border border-slate-200 space-y-1.5">
            <label className="text-[10px] font-black text-slate-600 uppercase tracking-wider block">Montagem dos Times</label>
            <select
              value={tipoTimes}
              onChange={(e) => setTipoTimes(e.target.value as any)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 text-xs font-bold text-slate-900"
            >
              <option value="sorteio">🎲 Por Sorteio</option>
              <option value="fechado">🛡️ Times Fechados</option>
            </select>
          </div>
        </div>

        {/* 2. CONFIGURAÇÃO FLEXÍVEL DE JOGADORES POR TIME */}
        <div className="glass p-4 rounded-2xl border border-slate-200 space-y-3 text-left">
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

          {/* Formatos Rápidos Sugeridos para a Modalidade Atual */}
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

        {/* Quantidade de Times e Nomes */}
        <div className="glass p-4 rounded-2xl border border-slate-200 space-y-3 text-left">
          <div className="flex justify-between items-center">
            <label className="text-xs font-black text-slate-700 uppercase tracking-wider">
              Quantidade de Times ({quantidadeTimes})
            </label>
            <div className="flex items-center gap-1.5">
              {[4, 8, 16].map((qty) => (
                <button
                  type="button"
                  key={qty}
                  onClick={() => handleQtyChange(qty)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-black cursor-pointer border ${
                    quantidadeTimes === qty
                      ? 'bg-amber-500 text-white border-amber-500 shadow-sm'
                      : 'bg-slate-100 text-slate-600 border-slate-200'
                  }`}
                >
                  {qty}
                </button>
              ))}
            </div>
          </div>

          {/* Edição dos nomes dos times */}
          <div className="grid grid-cols-2 gap-2 pt-1">
            {timesCustom.map((tName, idx) => (
              <input
                key={idx}
                type="text"
                value={tName}
                onChange={(e) => handleTimeNameChange(idx, e.target.value)}
                placeholder={`Time ${idx + 1}`}
                className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-semibold text-slate-800"
              />
            ))}
          </div>
        </div>

        {/* Datas */}
        <div className="grid grid-cols-2 gap-3 text-left">
          <div className="glass p-3.5 rounded-2xl border border-slate-200 space-y-1">
            <label className="text-[10px] font-black text-slate-600 uppercase tracking-wider block">Data Início</label>
            <input
              type="date"
              required
              value={dataInicio}
              onChange={(e) => setDataInicio(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 text-xs font-bold text-slate-900"
            />
          </div>

          <div className="glass p-3.5 rounded-2xl border border-slate-200 space-y-1">
            <label className="text-[10px] font-black text-slate-600 uppercase tracking-wider block">Data Término (Opt)</label>
            <input
              type="date"
              value={dataFim}
              onChange={(e) => setDataFim(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 text-xs font-bold text-slate-900"
            />
          </div>
        </div>

        {/* Grupo Vinculado (Opcional) */}
        <div className="glass p-3.5 rounded-2xl border border-slate-200 space-y-1 text-left">
          <label className="text-[10px] font-black text-slate-600 uppercase tracking-wider block">
            Grupo Vinculado (Opcional)
          </label>
          <select
            value={grupoId}
            onChange={(e) => setGrupoId(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-bold text-slate-900"
          >
            <option value="">Nenhum / Torneio Aberto Geral</option>
            {grupos.map((g) => (
              <option key={g.id} value={g.id}>{g.nome}</option>
            ))}
          </select>
          <p className="text-[10px] text-slate-400">
            Se selecionado, apenas membros deste grupo verão e poderão participar.
          </p>
        </div>

        {/* Botão de Criação */}
        <button
          type="submit"
          disabled={loading}
          className="w-full py-4 bg-[#eb3237] hover:bg-red-650 text-white font-black rounded-2xl text-sm shadow-xl active:scale-98 transition-all cursor-pointer flex items-center justify-center gap-2"
        >
          {loading ? (
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <>
              <Trophy size={18} />
              <span>Criar Torneio</span>
            </>
          )}
        </button>
      </form>
    </div>
  );
}
