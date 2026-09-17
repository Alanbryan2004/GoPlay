import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import type { Modalidade } from '../../types';
import {
  Calendar,
  MapPin,
  AlignLeft,
  Activity,
  ArrowLeft,
  BookOpen,
  Users,
  Lock,
  Globe,
  Plus,
  Minus,
  Navigation,
  Compass
} from 'lucide-react';
import dayjs from 'dayjs';
import timezone from 'dayjs/plugin/timezone';
import utc from 'dayjs/plugin/utc';
import { verificarPermissaoGrupo } from '../../utils/permissoesGrupo';
import { buscarEnderecosNominatim, getLocalizacaoAtual } from '../../utils/geo';

dayjs.extend(utc);
dayjs.extend(timezone);

export default function NovoEvento() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const grupoId = searchParams.get('grupo_id');
  const comunidadeId = searchParams.get('comunidade_id');

  const [descricao, setDescricao] = useState('');
  const [local, setLocal] = useState('');
  const [modalidadeId, setModalidadeId] = useState('');
  // Estados de Localização e Autocompletar
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [sugestoesEnderecos, setSugestoesEnderecos] = useState<Array<{ display_name: string; lat: number; lon: number }>>([]);
  const [buscandoEnderecos, setBuscandoEnderecos] = useState(false);
  const [showSugestoes, setShowSugestoes] = useState(false);
  const [obtendoGps, setObtendoGps] = useState(false);

  // Tenta capturar a localização atual silenciosamente para priorizar a busca de endereços da região do usuário (ex: Campinas)
  useEffect(() => {
    getLocalizacaoAtual()
      .then((pos) => {
        setLatitude(pos.latitude);
        setLongitude(pos.longitude);
      })
      .catch(() => {});
  }, []);

  // Efeito debounce para buscar sugestões de endereço enquanto digita
  useEffect(() => {
    if (!local || local.trim().length < 3) {
      setSugestoesEnderecos([]);
      setShowSugestoes(false);
      return;
    }

    const timer = setTimeout(async () => {
      setBuscandoEnderecos(true);
      const results = await buscarEnderecosNominatim(local, latitude, longitude);
      setSugestoesEnderecos(results);
      setShowSugestoes(results.length > 0);
      setBuscandoEnderecos(false);
    }, 400);

    return () => clearTimeout(timer);
  }, [local, latitude, longitude]);

  const handleSelectEndereco = (item: { display_name: string; lat: number; lon: number }) => {
    setLocal(item.display_name);
    setLatitude(item.lat);
    setLongitude(item.lon);
    setShowSugestoes(false);
  };

  const handleGetGPSLocation = async () => {
    setObtendoGps(true);
    try {
      const pos = await getLocalizacaoAtual();
      setLatitude(pos.latitude);
      setLongitude(pos.longitude);
      
      // Tentar buscar o nome do endereço a partir do GPS (reverse geocoding)
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/reverse?format=json&lat=${pos.latitude}&lon=${pos.longitude}`,
          { headers: { 'Accept-Language': 'pt-BR,pt;q=0.9', 'User-Agent': 'GoPlay-App/1.0' } }
        );
        if (res.ok) {
          const data = await res.json();
          if (data?.display_name) {
            setLocal(data.display_name);
          }
        }
      } catch {
        if (!local) setLocal(`Localização via GPS (${pos.latitude.toFixed(4)}, ${pos.longitude.toFixed(4)})`);
      }
    } catch (err: any) {
      alert(err.message || 'Não foi possível obter sua localização GPS.');
    } finally {
      setObtendoGps(false);
    }
  };
  const [dataEvento, setDataEvento] = useState('');
  const [hora, setHora] = useState('');
  const [modalidades, setModalidades] = useState<Modalidade[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingModalidades, setLoadingModalidades] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  // Estados de Privacidade e Grupo
  const [isPublico, setIsPublico] = useState(true);
  const [userGrupos, setUserGrupos] = useState<any[]>([]);
  const [selectedGrupoId, setSelectedGrupoId] = useState('');
  const [grupoNome, setGrupoNome] = useState('');
  const [comunidadeNome, setComunidadeNome] = useState('');

  // Estados de Limite de Vagas
  const [temLimiteVagas, setTemLimiteVagas] = useState(false);
  const [limiteVagas, setLimiteVagas] = useState(12);

  useEffect(() => {
    fetchUserGrupos();
    fetchModalidades().then(() => {
      if (comunidadeId) {
        setIsPublico(true); // Evento de comunidade é público
        fetchComunidadeNome(comunidadeId);
        fetchDefaultModality(null);
      } else if (grupoId) {
        setIsPublico(false);
        setSelectedGrupoId(grupoId);
        fetchGrupoNome(grupoId);
        fetchDefaultModality(grupoId);
      } else {
        fetchDefaultModality(null);
      }
    });
  }, [grupoId, comunidadeId]);

  const fetchUserGrupos = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: userData } = await supabase
        .from('usuarios')
        .select('id')
        .eq('email', user.email)
        .single();

      const resolvedUserId = userData?.id || user.id;

      const { data } = await supabase
        .from('membros_grupo')
        .select('grupo_id, grupos(id, nome)')
        .eq('usuario_id', resolvedUserId)
        .eq('status', 'aprovado');

      if (data) {
        const parsed = data.map((d: any) => d.grupos).filter(Boolean);
        setUserGrupos(parsed);
        if (parsed.length > 0 && !selectedGrupoId && !grupoId) {
          setSelectedGrupoId(parsed[0].id);
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchComunidadeNome = async (cid: string) => {
    try {
      const { data } = await supabase.from('comunidades').select('nome').eq('id', cid).single();
      if (data) setComunidadeNome(data.nome);
    } catch (e) { console.error(e); }
  };

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
        const defaultNames = ['Futebol', 'Vôlei', 'Basquete', 'Beach Tennis', 'Tênis de Mesa', 'Futevôlei'];
        const seedModalidades = defaultNames.map((nome) => ({ nome }));
        
        const { data: inserted, error: insertError } = await supabase
          .from('modalidades')
          .insert(seedModalidades)
          .select();
        
        if (!insertError && inserted) {
          setModalidades(inserted as Modalidade[]);
          setModalidadeId(inserted[0].id);
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
    if (!descricao || !local || !modalidadeId || !dataEvento || !hora) {
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

      const { data: userData } = await supabase
        .from('usuarios')
        .select('id')
        .eq('email', user.email)
        .single();

      const resolvedUserId = userData?.id || user.id;

      // Combinar data e hora no fuso horário do Brasil e converter para UTC
      const fusoBrasil = 'America/Sao_Paulo';
      const dataHoraStr = `${dataEvento}T${hora}:00`;
      const utcDate = dayjs.tz(dataHoraStr, fusoBrasil).utc().format();

      // Configuração padrão do sorteio e vagas
      const defaultConfig: Record<string, any> = {
        numberOfTeams: 2,
        numberOfPlayers: 6,
        useRating: false,
        maxNumberOfVictories: 3,
        actionAfterVictories: 1, // Mesclar por padrão
        tem_limite_vagas: temLimiteVagas,
        limite_vagas: temLimiteVagas ? Math.max(2, Number(limiteVagas)) : null,
      };

      const targetGrupoId = isPublico ? null : (selectedGrupoId || grupoId || null);

      // Se for evento vinculado a grupo, validar permissão
      if (targetGrupoId) {
        const canCreate = await verificarPermissaoGrupo(targetGrupoId, resolvedUserId, 'Criar Evento');
        if (!canCreate) {
          setErro('Você não possui permissão para criar eventos neste grupo. Consulte o Proprietário ou Administrador.');
          setLoading(false);
          return;
        }
      }

      const newEvento: Record<string, any> = {
        usuario_id: resolvedUserId,
        grupo_id: targetGrupoId,
        descricao: descricao.trim(),
        local: local.trim(),
        latitude: latitude,
        longitude: longitude,
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
        navigate(comunidadeId ? `/comunidades/${comunidadeId}` : grupoId ? `/eventos?grupo_id=${grupoId}` : '/eventos');
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
    <div className="px-4 py-2 pb-20 w-full max-w-md mx-auto text-left">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="p-2 rounded-lg bg-slate-50 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer border-0"
          >
            <ArrowLeft size={18} />
          </button>
          <h1 className="text-2xl font-extrabold text-slate-900">Novo Evento</h1>
        </div>

        <button
          type="button"
          onClick={() => window.dispatchEvent(new CustomEvent('goplay:open-tutorial'))}
          className="px-2.5 py-1.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-700 hover:bg-amber-100 transition-all flex items-center gap-1 text-xs font-bold cursor-pointer shadow-xs"
          title="Ver Guia de Criação"
        >
          <BookOpen size={14} />
          <span>Ajuda</span>
        </button>
      </div>

      <div className="glass p-5 rounded-2xl border border-slate-200 shadow-xl">
        {erro && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-700 text-xs font-bold">
            {erro}
          </div>
        )}

        {/* Indicador de Origem (Grupo ou Comunidade) */}
        {comunidadeId && comunidadeNome && (
          <div className="mb-4 p-3 rounded-xl bg-indigo-50 border border-indigo-200 flex items-center gap-2">
            <span className="text-base">🌐</span>
            <div className="text-xs">
              <span className="font-bold text-indigo-900">Vinculado à Comunidade:</span>
              <p className="font-extrabold text-indigo-700">{comunidadeNome}</p>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">
              Descrição / Nome da Partida
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400">
                <AlignLeft size={18} />
              </span>
              <input
                type="text"
                required
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                placeholder="Ex: Pelada dos Amigos"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 pl-11 pr-4 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-red-500/30 text-sm font-semibold"
              />
            </div>
          </div>

          <div>
            <div className="flex justify-between items-center mb-1.5">
              <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider">
                Local / Endereço
              </label>
              <button
                type="button"
                onClick={handleGetGPSLocation}
                disabled={obtendoGps}
                className="text-[11px] font-bold text-red-600 hover:text-red-700 flex items-center gap-1 bg-red-50 hover:bg-red-100 px-2.5 py-1 rounded-lg border border-red-200 transition-all cursor-pointer"
                title="Preencher com localização GPS atual"
              >
                {obtendoGps ? (
                  <div className="w-3 h-3 border-2 border-red-600 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Navigation size={12} />
                )}
                <span>{obtendoGps ? 'Buscando GPS...' : 'Usar meu GPS'}</span>
              </button>
            </div>

            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400">
                <MapPin size={18} className={latitude ? 'text-red-600' : 'text-slate-400'} />
              </span>
              <input
                type="text"
                required
                value={local}
                onChange={(e) => {
                  setLocal(e.target.value);
                  setLatitude(null);
                  setLongitude(null);
                }}
                onFocus={() => { if (sugestoesEnderecos.length > 0) setShowSugestoes(true); }}
                placeholder="Digite a rua, quadra ou arena..."
                className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 pl-11 pr-8 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-red-500/30 text-sm font-semibold"
              />

              {buscandoEnderecos && (
                <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                  <div className="w-4 h-4 border-2 border-red-600 border-t-transparent rounded-full animate-spin" />
                </div>
              )}

              {/* Lista Flutuante de Sugestões de Endereço */}
              {showSugestoes && sugestoesEnderecos.length > 0 && (
                <div className="absolute left-0 right-0 top-full mt-1.5 z-50 bg-white rounded-2xl shadow-2xl border border-slate-200 max-h-56 overflow-y-auto divide-y divide-slate-100 animate-in fade-in">
                  {sugestoesEnderecos.map((item, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleSelectEndereco(item)}
                      className="w-full text-left p-3 hover:bg-red-50/60 transition-colors flex items-start gap-2.5 cursor-pointer text-xs group"
                    >
                      <MapPin size={14} className="text-red-500 shrink-0 mt-0.5" />
                      <div className="min-w-0 flex-1">
                        <p className="font-bold text-slate-800 group-hover:text-red-600 leading-snug truncate">
                          {item.display_name.split(',')[0]}
                        </p>
                        <p className="text-[10px] text-slate-500 truncate leading-normal">
                          {item.display_name}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {latitude && longitude && (
              <div className="mt-1.5 flex items-center gap-1.5 text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
                <Compass size={12} />
                <span>Coordenadas prontas para filtro por raio! ({latitude.toFixed(4)}, {longitude.toFixed(4)})</span>
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">
              Modalidade
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400">
                <Activity size={18} />
              </span>
              <select
                disabled={loadingModalidades}
                value={modalidadeId}
                onChange={(e) => setModalidadeId(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 pl-11 pr-4 text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-500/30 text-sm font-semibold cursor-pointer"
              >
                {loadingModalidades ? (
                  <option>Carregando modalidades...</option>
                ) : (
                  modalidades.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.nome}
                    </option>
                  ))
                )}
              </select>
            </div>
          </div>

          {/* ========================================================= */}
          {/* VISIBILIDADE DO EVENTO (PÚBLICO OU PRIVADO) */}
          {/* ========================================================= */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">
              Privacidade do Evento
            </label>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => setIsPublico(true)}
                className={`py-2.5 px-3 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  isPublico
                    ? 'bg-red-600 border-red-600 text-white shadow-md'
                    : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                }`}
              >
                <Globe size={14} />
                <span>🌍 Público</span>
              </button>
              <button
                type="button"
                onClick={() => setIsPublico(false)}
                className={`py-2.5 px-3 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  !isPublico
                    ? 'bg-red-600 border-red-600 text-white shadow-md'
                    : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                }`}
              >
                <Lock size={14} />
                <span>🔒 Privado</span>
              </button>
            </div>

            {/* Se for privado e o usuário possuir grupos */}
            {!isPublico && (
              <div className="mt-2.5 space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">
                  Vincular a um Grupo (Opcional)
                </label>
                {grupoNome ? (
                  <div className="w-full bg-slate-100 border border-slate-200 rounded-xl py-2 px-3 text-slate-700 text-xs font-bold">
                    👥 Grupo: {grupoNome}
                  </div>
                ) : userGrupos.length > 0 ? (
                  <select
                    value={selectedGrupoId}
                    onChange={(e) => setSelectedGrupoId(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 text-slate-800 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-red-500/20 cursor-pointer"
                  >
                    <option value="">Apenas convidados com link (Sem grupo)</option>
                    {userGrupos.map((g) => (
                      <option key={g.id} value={g.id}>
                        👥 Grupo: {g.nome}
                      </option>
                    ))}
                  </select>
                ) : (
                  <p className="text-[11px] text-slate-400">
                    * Evento restrito. Apenas quem receber o link de convite poderá acessar.
                  </p>
                )}
              </div>
            )}
          </div>

          {/* ========================================================= */}
          {/* LIMITE DE VAGAS (ILIMITADO OU QUANTIDADE ESPECÍFICA) */}
          {/* ========================================================= */}
          <div className="p-3.5 bg-slate-50/80 border border-slate-200 rounded-2xl space-y-2.5">
            <div className="flex justify-between items-center">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <Users size={14} className="text-red-500" />
                <span>Vagas de Jogadores</span>
              </label>
              <span className="text-[10px] font-bold text-slate-500">
                {temLimiteVagas ? `Limite: ${limiteVagas} atletas` : 'Ilimitado'}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setTemLimiteVagas(false)}
                className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                  !temLimiteVagas
                    ? 'bg-red-600 border-red-600 text-white shadow-sm'
                    : 'bg-white border-slate-200 text-slate-650 hover:bg-slate-100'
                }`}
              >
                ♾️ Vagas Ilimitadas
              </button>
              <button
                type="button"
                onClick={() => setTemLimiteVagas(true)}
                className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                  temLimiteVagas
                    ? 'bg-red-600 border-red-600 text-white shadow-sm'
                    : 'bg-white border-slate-200 text-slate-650 hover:bg-slate-100'
                }`}
              >
                🎯 Limitar Vagas
              </button>
            </div>

            {temLimiteVagas && (
              <div className="pt-2 space-y-2 animate-in fade-in">
                <div className="flex items-center justify-between bg-white p-2 rounded-xl border border-slate-200">
                  <span className="text-xs font-bold text-slate-700">Quantidade de Vagas:</span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setLimiteVagas((v) => Math.max(2, v - 1))}
                      className="p-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer"
                    >
                      <Minus size={14} />
                    </button>
                    <input
                      type="number"
                      min="2"
                      max="100"
                      value={limiteVagas}
                      onChange={(e) => setLimiteVagas(Math.max(2, parseInt(e.target.value) || 2))}
                      className="w-12 text-center font-black text-sm text-slate-900 border-0 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setLimiteVagas((v) => v + 1)}
                      className="p-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer"
                    >
                      <Plus size={14} />
                    </button>
                  </div>
                </div>

                {/* Atalhos Rápidos */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[10px] font-bold text-slate-400">Atalhos:</span>
                  {[8, 10, 12, 14, 16, 20, 24].map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setLimiteVagas(n)}
                      className={`px-2 py-0.5 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                        limiteVagas === n
                          ? 'bg-red-600 text-white font-black'
                          : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-slate-400">
                  * Ao atingir {limiteVagas} confirmações, o sistema bloqueará novas entradas automaticamente.
                </p>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">
                Data
              </label>
              <input
                type="date"
                required
                value={dataEvento}
                onChange={(e) => setDataEvento(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-500/30 text-xs font-bold"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">
                Hora
              </label>
              <input
                type="time"
                required
                value={hora}
                onChange={(e) => setHora(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-500/30 text-xs font-bold"
              />
            </div>
          </div>

          <div className="flex gap-3 pt-3">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-all text-xs cursor-pointer border-0"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-3 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white font-black rounded-xl shadow-lg active:scale-95 transition-all text-xs flex justify-center items-center cursor-pointer border-0"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                'Criar Evento'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
