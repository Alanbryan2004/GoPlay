import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import type { Torneio } from '../../types/torneio';
import { Trophy, Plus, Calendar, Users, GitMerge, Award, ChevronRight, Lock, Globe, History, CheckCircle2, Filter } from 'lucide-react';
import dayjs from 'dayjs';

const getModalityIcon = (name?: string) => {
  if (!name) return '🏆';
  const n = name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (n.includes('volei')) return '🏐';
  if (n.includes('futebol') || n.includes('futsal') || n.includes('society')) return '⚽';
  if (n.includes('basquete')) return '🏀';
  if (n.includes('beach') || n.includes('tenis')) return '🎾';
  if (n.includes('futevolei')) return '🏖️';
  if (n.includes('mesa') || n.includes('ping')) return '🏓';
  return '🏆';
};

export default function TorneiosList() {
  const navigate = useNavigate();
  const [torneios, setTorneios] = useState<Torneio[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'ativos' | 'historico'>('ativos');
  const [filtroHistorico, setFiltroHistorico] = useState<'participados' | 'todos'>('participados');

  useEffect(() => {
    fetchCurrentUser();
    fetchTorneios();
  }, []);

  const fetchCurrentUser = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: dbUser } = await supabase
          .from('usuarios')
          .select('id')
          .eq('email', user.email)
          .single();
        if (dbUser) setCurrentUserId(dbUser.id);
        else setCurrentUserId(user.id);
      }
    } catch (e) {
      console.error('Erro ao buscar usuário atual:', e);
    }
  };

  const fetchTorneios = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('torneios')
        .select('*, modalidades:modalidade_id(id, nome)')
        .order('created_at', { ascending: false });

      if (!error && data) {
        setTorneios(data as Torneio[]);
      } else {
        console.warn('Busca de torneios:', error);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  // Verifica se um torneio está encerrado
  const isTorneioEncerrado = (t: Torneio) => {
    return t.status === 'encerrado' || t.status === 'finalizado' || Boolean(t.campeao_id);
  };

  // Verifica se o usuário atual participou ou criou o torneio
  const usuarioParticipou = (t: Torneio) => {
    if (!currentUserId) return false;
    if (t.criador_id === currentUserId) return true;
    if (t.participantes?.some((p) => p.id === currentUserId)) return true;
    if (t.times?.some((time) => time.criador_id === currentUserId || time.jogadores?.some((j) => j.id === currentUserId))) {
      return true;
    }
    return false;
  };

  // Torneios Ativos (NUNCA exibe encerrados nesta aba)
  const torneiosAtivos = torneios.filter((t) => !isTorneioEncerrado(t));

  // Torneios do Histórico (Apenas os encerrados)
  const todosEncerrados = torneios.filter((t) => isTorneioEncerrado(t));
  const torneiosHistorico = filtroHistorico === 'participados'
    ? todosEncerrados.filter((t) => usuarioParticipou(t))
    : todosEncerrados;

  return (
    <div className="px-4 py-3 pb-24 w-full max-w-md mx-auto min-h-[calc(100vh-8rem)]">
      {/* Header Principal */}
      <div className="flex items-center justify-between mb-4 pl-14 pr-2 h-11">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-amber-500/10 text-amber-500 rounded-xl flex items-center justify-center">
            <Trophy size={20} />
          </div>
          <h1 className="text-2xl font-black text-slate-900 leading-none">Torneios</h1>
        </div>

        <button
          onClick={() => navigate('/torneios/novo')}
          className="p-2 bg-[#eb3237] hover:bg-red-650 text-white rounded-xl shadow-lg active:scale-95 transition-all flex items-center gap-1.5 text-xs font-black cursor-pointer border border-red-500/10"
        >
          <Plus size={16} />
          <span>Criar</span>
        </button>
      </div>

      {/* Tabs de Navegação: Ativos vs Histórico */}
      <div className="flex bg-slate-100 p-1 rounded-xl mb-4">
        <button
          type="button"
          onClick={() => setActiveTab('ativos')}
          className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
            activeTab === 'ativos'
              ? 'bg-white text-red-650 shadow-xs font-black'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <Trophy size={14} />
          <span>Ativos ({torneiosAtivos.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('historico')}
          className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
            activeTab === 'historico'
              ? 'bg-white text-slate-900 shadow-xs font-black'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <History size={14} />
          <span>Histórico ({todosEncerrados.length})</span>
        </button>
      </div>

      {/* Subfiltro dentro do Histórico (Meus Torneios vs Todos Encerrados) */}
      {activeTab === 'historico' && todosEncerrados.length > 0 && (
        <div className="flex items-center justify-between mb-3 px-1">
          <span className="text-[11px] font-bold text-slate-500 flex items-center gap-1">
            <Filter size={12} />
            <span>Exibir:</span>
          </span>
          <div className="flex gap-1.5">
            <button
              type="button"
              onClick={() => setFiltroHistorico('participados')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                filtroHistorico === 'participados'
                  ? 'bg-amber-100 text-amber-900 border border-amber-300'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Que Participei
            </button>
            <button
              type="button"
              onClick={() => setFiltroHistorico('todos')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                filtroHistorico === 'todos'
                  ? 'bg-amber-100 text-amber-900 border border-amber-300'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Todos Encerrados
            </button>
          </div>
        </div>
      )}

      {/* Conteúdo das Listas */}
      {loading ? (
        <div className="flex justify-center items-center h-48">
          <div className="w-8 h-8 border-4 border-red-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : activeTab === 'ativos' ? (
        /* ABA ATIVOS */
        torneiosAtivos.length === 0 ? (
          <div className="text-center py-12 glass rounded-2xl border border-slate-200 p-6 space-y-4">
            <div className="w-14 h-14 bg-amber-50 rounded-2xl flex items-center justify-center mx-auto text-amber-500 border border-amber-200">
              <Trophy size={28} />
            </div>
            <div className="space-y-1">
              <h3 className="font-black text-slate-800 text-base">Nenhum torneio ativo</h3>
              <p className="text-slate-500 text-xs">
                Não há campeonatos em andamento no momento. Crie um novo torneio ou consulte os já encerrados no Histórico!
              </p>
            </div>
            <button
              onClick={() => navigate('/torneios/novo')}
              className="w-full py-3 bg-[#eb3237] hover:bg-red-650 text-white font-black rounded-xl text-xs shadow-md active:scale-95 transition-all cursor-pointer"
            >
              Criar Novo Torneio
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {torneiosAtivos.map((t) => (
              <div
                key={t.id}
                onClick={() => navigate(`/torneios/${t.id}`)}
                className="glass p-4 rounded-2xl border border-slate-200 hover:border-amber-400 transition-all shadow-xs hover:shadow-md active:scale-[0.99] cursor-pointer space-y-3"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {t.modalidades?.nome && (
                      <span className="text-[10px] text-red-650 bg-red-50 border border-red-200/60 px-2 py-0.5 rounded-md font-bold flex items-center gap-1">
                        <span>{getModalityIcon(t.modalidades.nome)}</span>
                        <span>{t.modalidades.nome}</span>
                      </span>
                    )}
                    <span className="p-1 rounded-lg bg-amber-100 text-amber-700 font-bold text-xs flex items-center gap-1">
                      {t.formato === 'chaveamento' ? <GitMerge size={12} /> : <Award size={12} />}
                      {t.formato === 'chaveamento' ? 'Chaveamento' : 'Pontos Corridos'}
                    </span>
                    {t.publico ? (
                      <span className="text-[10px] text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md font-bold flex items-center gap-1">
                        <Globe size={10} /> Público
                      </span>
                    ) : (
                      <span className="text-[10px] text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md font-bold flex items-center gap-1">
                        <Lock size={10} /> Privado
                      </span>
                    )}
                  </div>

                  <ChevronRight size={16} className="text-slate-400" />
                </div>

                <div>
                  <h3 className="font-black text-slate-900 text-base">{t.nome}</h3>
                  <div className="flex items-center gap-3 text-xs text-slate-500 mt-1 flex-wrap">
                    <span className="flex items-center gap-1 font-medium">
                      <Users size={12} className="text-slate-450" /> {t.quantidade_times} Times ({t.jogadores_por_time || 2}x{t.jogadores_por_time || 2})
                    </span>
                    <span className="flex items-center gap-1 font-medium">
                      <Calendar size={12} className="text-slate-450" /> {dayjs(t.data_inicio).format('DD/MM/YYYY')}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )
      ) : (
        /* ABA HISTÓRICO */
        torneiosHistorico.length === 0 ? (
          <div className="text-center py-12 glass rounded-2xl border border-slate-200 p-6 space-y-4">
            <div className="w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto text-slate-400 border border-slate-200">
              <History size={28} />
            </div>
            <div className="space-y-1">
              <h3 className="font-black text-slate-800 text-base">Nenhum torneio no histórico</h3>
              <p className="text-slate-500 text-xs">
                {filtroHistorico === 'participados'
                  ? 'Você ainda não participou de nenhum torneio encerrado.'
                  : 'Nenhum torneio foi encerrado ainda.'}
              </p>
            </div>
            {filtroHistorico === 'participados' && todosEncerrados.length > 0 && (
              <button
                type="button"
                onClick={() => setFiltroHistorico('todos')}
                className="px-4 py-2.5 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-xl text-xs transition-all cursor-pointer shadow-sm"
              >
                Ver Todos os Torneios Encerrados ({todosEncerrados.length})
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {torneiosHistorico.map((t) => {
              const campeaoTime = t.times?.find((time) => time.id === t.campeao_id);

              return (
                <div
                  key={t.id}
                  onClick={() => navigate(`/torneios/${t.id}`)}
                  className="glass p-4 rounded-2xl border border-slate-200 hover:border-emerald-300 transition-all shadow-xs hover:shadow-md active:scale-[0.99] cursor-pointer space-y-3 bg-slate-50/50"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[10px] text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full font-black flex items-center gap-1">
                        <CheckCircle2 size={11} />
                        <span>Encerrado</span>
                      </span>

                      {t.modalidades?.nome && (
                        <span className="text-[10px] text-slate-600 bg-white border border-slate-200 px-2 py-0.5 rounded-md font-bold flex items-center gap-1">
                          <span>{getModalityIcon(t.modalidades.nome)}</span>
                          <span>{t.modalidades.nome}</span>
                        </span>
                      )}

                      <span className="text-[10px] text-slate-500 bg-white border border-slate-200 px-2 py-0.5 rounded-md font-bold">
                        {t.formato === 'chaveamento' ? 'Mata-Mata' : 'Pontos Corridos'}
                      </span>
                    </div>

                    <ChevronRight size={16} className="text-slate-400" />
                  </div>

                  <div>
                    <h3 className="font-black text-slate-900 text-base">{t.nome}</h3>
                    
                    {/* Exibição do Campeão se houver */}
                    {campeaoTime && (
                      <div className="mt-1.5 p-2 bg-amber-50 border border-amber-200 rounded-xl flex items-center gap-2">
                        <span className="text-base">👑</span>
                        <div>
                          <p className="text-[10px] font-black text-amber-700 uppercase tracking-wider">Campeão do Torneio</p>
                          <p className="text-xs font-black text-slate-900">{campeaoTime.nome}</p>
                        </div>
                      </div>
                    )}

                    <div className="flex items-center gap-3 text-xs text-slate-500 mt-2 flex-wrap">
                      <span className="flex items-center gap-1 font-medium">
                        <Users size={12} className="text-slate-450" /> {t.quantidade_times} Times
                      </span>
                      <span className="flex items-center gap-1 font-medium">
                        <Calendar size={12} className="text-slate-450" /> {dayjs(t.data_inicio).format('DD/MM/YYYY')}
                      </span>
                      {usuarioParticipou(t) && (
                        <span className="text-[10px] font-bold text-red-650 bg-red-50 border border-red-200 px-2 py-0.5 rounded-md">
                          Você Participou
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )
      )}
    </div>
  );
}
