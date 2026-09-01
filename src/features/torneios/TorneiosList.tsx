import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import type { Torneio } from '../../types/torneio';
import { Trophy, Plus, Calendar, Users, GitMerge, Award, ChevronRight, Lock, Globe } from 'lucide-react';
import dayjs from 'dayjs';

export default function TorneiosList() {
  const navigate = useNavigate();
  const [torneios, setTorneios] = useState<Torneio[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTorneios();
  }, []);

  const fetchTorneios = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('torneios')
        .select('*')
        .order('created_at', { ascending: false });

      if (!error && data) {
        setTorneios(data as Torneio[]);
      } else {
        // Se a tabela ainda não existir no banco, mantém lista vazia para visualização suave
        console.warn('Busca de torneios (tabela torneios):', error);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="px-4 py-3 pb-24 w-full max-w-md mx-auto min-h-[calc(100vh-8rem)]">
      {/* Header */}
      <div className="flex items-center justify-between mb-5 pl-14 pr-2 h-11">
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

      {/* Lista de Torneios */}
      {loading ? (
        <div className="flex justify-center items-center h-48">
          <div className="w-8 h-8 border-4 border-red-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : torneios.length === 0 ? (
        <div className="text-center py-12 glass rounded-2xl border border-slate-200 p-6 space-y-4">
          <div className="w-14 h-14 bg-amber-50 rounded-2xl flex items-center justify-center mx-auto text-amber-500 border border-amber-200">
            <Trophy size={28} />
          </div>
          <div className="space-y-1">
            <h3 className="font-black text-slate-800 text-base">Nenhum torneio ativo</h3>
            <p className="text-slate-500 text-xs">Organize campeonatos por Ponto Corrido ou Chaveamento com seus amigos!</p>
          </div>
          <button
            onClick={() => navigate('/torneios/novo')}
            className="w-full py-3 bg-[#eb3237] text-white font-black rounded-xl text-xs shadow-md active:scale-95 transition-all cursor-pointer"
          >
            Criar Primeiro Torneio
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {torneios.map((t) => (
            <div
              key={t.id}
              onClick={() => navigate(`/torneios/${t.id}`)}
              className="glass p-4 rounded-2xl border border-slate-200 hover:border-amber-400 transition-all shadow-sm active:scale-[0.99] cursor-pointer space-y-3"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="p-1.5 rounded-lg bg-amber-100 text-amber-700 font-bold text-xs flex items-center gap-1">
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
                <div className="flex items-center gap-4 text-xs text-slate-500 mt-1">
                  <span className="flex items-center gap-1">
                    <Users size={12} /> {t.quantidade_times} Times ({t.tipo_times === 'sorteio' ? 'Sorteados' : 'Fechados'})
                  </span>
                  <span className="flex items-center gap-1">
                    <Calendar size={12} /> {dayjs(t.data_inicio).format('DD/MM/YYYY')}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
