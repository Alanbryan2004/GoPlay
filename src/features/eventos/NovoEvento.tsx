import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import type { Modalidade } from '../../types';
import { Calendar, MapPin, AlignLeft, Activity, ArrowLeft } from 'lucide-react';
import dayjs from 'dayjs';
import timezone from 'dayjs/plugin/timezone';
import utc from 'dayjs/plugin/utc';

dayjs.extend(utc);
dayjs.extend(timezone);

export default function NovoEvento() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const grupoId = searchParams.get('grupo_id');

  const [descricao, setDescricao] = useState('');
  const [local, setLocal] = useState('');
  const [modalidadeId, setModalidadeId] = useState('');
  const [data, setData] = useState('');
  const [hora, setHora] = useState('');
  const [modalidades, setModalidades] = useState<Modalidade[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingModalidades, setLoadingModalidades] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  // Estados de Privacidade e Grupo
  const [isPublico, setIsPublico] = useState(true);
  const [selectedGrupoId, setSelectedGrupoId] = useState('');
  const [grupoNome, setGrupoNome] = useState('');

  useEffect(() => {
    fetchModalidades().then(() => {
      // Após carregar modalidades, buscar a padrão com base no último evento
      if (grupoId) {
        setIsPublico(false);
        setSelectedGrupoId(grupoId);
        fetchGrupoNome(grupoId);
        fetchDefaultModality(grupoId);
      } else {
        fetchDefaultModality(null);
      }
    });
  }, [grupoId]);

  const fetchGrupoNome = async (gid: string) => {
    try {
      const { data, error } = await supabase
        .from('grupos')
        .select('nome')
        .eq('id', gid)
        .single();
      if (data && !error) {
        setGrupoNome(data.nome);
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Busca a modalidade do último evento criado no grupo (ou geral) e define como padrão
  const fetchDefaultModality = async (gid: string | null) => {
    try {
      let query = supabase
        .from('eventos')
        .select('modalidade_id')
        .order('created_at', { ascending: false })
        .limit(1);

      if (gid) {
        query = query.eq('grupo_id', gid);
      }

      const { data } = await query;
      if (data && data.length > 0 && data[0].modalidade_id) {
        setModalidadeId(data[0].modalidade_id);
      }
    } catch (e) {
      console.error('Erro ao buscar modalidade padrão:', e);
    }
  };

  const fetchModalidades = async () => {
    try {
      const { data: dbModalidades, error } = await supabase
        .from('modalidades')
        .select('*');

      if (!error && dbModalidades && dbModalidades.length > 0) {
        setModalidades(dbModalidades as Modalidade[]);
        setModalidadeId(dbModalidades[0].id);
      } else {
        // Fallback: Se a tabela de modalidades estiver vazia, vamos semear as básicas!
        const defaultNames = ['Futebol', 'Vôlei', 'Basquete', 'Beach Tennis', 'Tênis de Mesa', 'Futevôlei'];
        const seedModalidades = defaultNames.map((nome) => ({ nome }));
        
        const { data: inserted, error: insertError } = await supabase
          .from('modalidades')
          .insert(seedModalidades)
          .select();
        
        if (!insertError && inserted) {
          setModalidades(inserted as Modalidade[]);
          setModalidadeId(inserted[0].id);
        } else {
          console.error('Error seeding/fetching modalities:', insertError || error);
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingModalidades(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!descricao || !local || !modalidadeId || !data || !hora) {
      setErro('Por favor, preencha todos os campos obrigatórios.');
      return;
    }
    setLoading(true);
    setErro(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setErro('Você precisa estar autenticado para criar um evento.');
        setLoading(false);
        return;
      }

      // Query the user's uuid from the public table (or direct supabase user.id if mapped)
      const { data: userData } = await supabase
        .from('usuarios')
        .select('id')
        .eq('email', user.email)
        .single();

      const resolvedUserId = userData?.id || user.id;

      // Combinar data e hora no fuso horário do Brasil e converter para UTC
      const fusoBrasil = 'America/Sao_Paulo';
      const dataHoraStr = `${data}T${hora}:00`;
      const utcDate = dayjs.tz(dataHoraStr, fusoBrasil).utc().format();

      // Configuração padrão do sorteio
      const defaultConfig = {
        numberOfTeams: 2,
        numberOfPlayers: 6,
        useRating: false,
        maxNumberOfVictories: 3,
        actionAfterVictories: 1, // Mesclar por padrão
      };

      const newEvento = {
        usuario_id: resolvedUserId,
        grupo_id: isPublico ? null : (selectedGrupoId || null),
        descricao: descricao.trim(),
        local: local.trim(),
        modalidade_id: modalidadeId,
        data: utcDate,
        participantes: [],
        configuracao: defaultConfig,
        time1: [],
        time2: [],
        vitorias_time1: 0,
        vitorias_time2: 0,
      };

      const { error } = await supabase.from('eventos').insert(newEvento);

      if (!error) {
        navigate(grupoId ? `/eventos?grupo_id=${grupoId}` : '/eventos');
      } else {
        setErro(error.message);
      }
    } catch (err: any) {
      setErro(err.message || 'Ocorreu um erro ao salvar o evento.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="px-4 py-2 pb-20 w-full max-w-md mx-auto">
      <div className="flex items-center gap-3 mb-3">
        <button
          onClick={() => navigate(-1)}
          className="p-2 rounded-lg bg-slate-50 hover:bg-slate-200 text-slate-700 transition-colors"
        >
          <ArrowLeft size={18} />
        </button>
        <h1 className="text-2xl font-extrabold text-slate-900">Novo Evento</h1>
      </div>

      <div className="glass p-4 rounded-2xl shadow-md">
        {erro && (
          <div className="flex items-center gap-2 mb-4 p-3 bg-red-950/40 border border-red-500/30 text-red-700 rounded-xl text-sm">
            <span>{erro}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div>
            <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">
              Descrição / Nome da Partida
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-500">
                <AlignLeft size={18} />
              </span>
              <input
                type="text"
                required
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                placeholder="Ex: Pelada dos Amigos"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 pl-11 pr-4 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-red-500/50 transition-all text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">
              Local
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-500">
                <MapPin size={18} />
              </span>
              <input
                type="text"
                required
                value={local}
                onChange={(e) => setLocal(e.target.value)}
                placeholder="Ex: Arena Soccer Beach"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 pl-11 pr-4 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-red-500/50 transition-all text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">
              Modalidade
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-500">
                <Activity size={18} />
              </span>
              <select
                disabled={loadingModalidades}
                value={modalidadeId}
                onChange={(e) => setModalidadeId(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 pl-11 pr-4 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-red-500/50 transition-all text-sm appearance-none"
              >
                {loadingModalidades ? (
                  <option>Carregando modalidades...</option>
                ) : (
                  modalidades.map((m) => (
                    <option key={m.id} value={m.id} className="bg-slate-50 text-slate-900">
                      {m.nome}
                    </option>
                  ))
                )}
              </select>
            </div>
          </div>

          {/* Visibilidade do Evento (Somente se criado a partir de um Grupo) */}
          {!!grupoId && (
            <>
              <div>
                <label className="block text-xs font-semibold text-slate-650 uppercase tracking-wider mb-2">
                  Visibilidade da Partida
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setIsPublico(true)}
                    className={`py-2.5 px-4 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                      isPublico
                        ? 'bg-red-650 border-red-500 text-white shadow-md'
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <span>🌍 Público</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsPublico(false)}
                    className={`py-2.5 px-4 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                      !isPublico
                        ? 'bg-red-650 border-red-500 text-white shadow-md'
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <span>🔒 Privado (Grupo)</span>
                  </button>
                </div>
              </div>

              {/* Nome do Grupo estático se for Privado */}
              {!isPublico && (
                <div>
                  <label className="block text-xs font-semibold text-slate-650 uppercase tracking-wider mb-2">
                    Grupo do Evento
                  </label>
                  <div className="w-full bg-slate-100 border border-slate-200 rounded-xl py-3 px-4 text-slate-600 text-sm font-bold shadow-inner">
                    {grupoNome || 'Carregando nome do grupo...'}
                  </div>
                </div>
              )}
            </>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">
                Data
              </label>
              <div className="relative">
                <input
                  type="date"
                  required
                  value={data}
                  onChange={(e) => setData(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-500/50 transition-all text-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">
                Hora
              </label>
              <div className="relative">
                <input
                  type="time"
                  required
                  value={hora}
                  onChange={(e) => setHora(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-500/50 transition-all text-sm"
                />
              </div>
            </div>
          </div>

          <div className="flex gap-4 mt-6">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="flex-1 py-3 bg-slate-50 hover:bg-slate-200 text-slate-600 border border-slate-200 font-bold rounded-xl transition-all text-sm"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-3 bg-gradient-to-r from-[#eb3237] to-red-650 hover:from-red-500 hover:to-red-600 text-white font-bold rounded-xl shadow-lg shadow-[#eb3237]/20 active:scale-95 transition-all text-sm flex justify-center items-center"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                'Criar'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
