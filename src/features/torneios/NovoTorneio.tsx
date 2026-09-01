import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import type { Modalidade, Grupo } from '../../types';
import { Trophy, ArrowLeft, GitMerge, Award, Users, Shuffle, ShieldCheck, Lock, Globe, Calendar } from 'lucide-react';

export default function NovoTorneio() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  // Form State
  const [nome, setNome] = useState('');
  const [formato, setFormato] = useState<'chaveamento' | 'pontos_corridos'>('chaveamento');
  const [publico, setPublico] = useState(true);
  const [quantidadeTimes, setQuantidadeTimes] = useState<number>(4);
  const [jogadoresPorTime, setJogadoresPorTime] = useState<number>(2);
  const [tipoTimes, setTipoTimes] = useState<'sorteio' | 'fechado'>('sorteio');
  const [dataInicio, setDataInicio] = useState(new Date().toISOString().split('T')[0]);
  const [dataFim, setDataFim] = useState('');
  const [modalidadeId, setModalidadeId] = useState('');
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
      const { data: dbMod } = await supabase.from('modalidades').select('*');
      if (dbMod) setModalidades(dbMod as Modalidade[]);

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
      console.error(e);
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

      const { data, error } = await supabase
        .from('torneios')
        .insert(novoTorneio)
        .select('id')
        .single();

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

        {/* Formato do Torneio */}
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
              <span className="text-xs">Chaveamento</span>
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
              <span className="text-xs">Pontos Corridos</span>
              <span className="text-[9px] text-slate-400 font-normal">Todos contra todos</span>
            </button>
          </div>
        </div>

        {/* Visibilidade e Tipo de Montagem dos Times */}
        <div className="grid grid-cols-2 gap-3">
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

        {/* Configuração de Tamanho do Time */}
        <div className="glass p-4 rounded-2xl border border-slate-200 flex items-center justify-between">
          <div>
            <label className="text-xs font-black text-slate-700 uppercase tracking-wider block">
              Jogadores por Time
            </label>
            <p className="text-[10px] text-slate-400">Total necessário: {quantidadeTimes * jogadoresPorTime} atletas</p>
          </div>

          <div className="flex items-center gap-2">
            {[2, 4, 6].map((num) => (
              <button
                type="button"
                key={num}
                onClick={() => setJogadoresPorTime(num)}
                className={`px-3 py-1.5 rounded-xl text-xs font-black cursor-pointer border ${
                  jogadoresPorTime === num
                    ? 'bg-[#eb3237] text-white border-[#eb3237] shadow-sm'
                    : 'bg-slate-100 text-slate-600 border-slate-200'
                }`}
              >
                {num}x{num}
              </button>
            ))}
          </div>
        </div>

        {/* Quantidade de Times e Nomes */}
        <div className="glass p-4 rounded-2xl border border-slate-200 space-y-3">
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
        <div className="grid grid-cols-2 gap-3">
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

        {/* Modalidade / Grupo (Opcional) */}
        <div className="grid grid-cols-2 gap-3">
          <div className="glass p-3.5 rounded-2xl border border-slate-200 space-y-1">
            <label className="text-[10px] font-black text-slate-600 uppercase tracking-wider block">Modalidade</label>
            <select
              value={modalidadeId}
              onChange={(e) => setModalidadeId(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 text-xs font-bold text-slate-900"
            >
              <option value="">Geral / Todas</option>
              {modalidades.map((m) => (
                <option key={m.id} value={m.id}>{m.nome}</option>
              ))}
            </select>
          </div>

          <div className="glass p-3.5 rounded-2xl border border-slate-200 space-y-1">
            <label className="text-[10px] font-black text-slate-600 uppercase tracking-wider block">Grupo Vinculado</label>
            <select
              value={grupoId}
              onChange={(e) => setGrupoId(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 text-xs font-bold text-slate-900"
            >
              <option value="">Nenhum / Aberto</option>
              {grupos.map((g) => (
                <option key={g.id} value={g.id}>{g.nome}</option>
              ))}
            </select>
          </div>
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
