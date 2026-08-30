import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import type { Usuario, Grupo, Modalidade } from '../../types';
import { Trophy, Star, Medal } from 'lucide-react';

interface PlayerRank extends Usuario {
  vitorias: number;
  rating: number;
}

export default function RankingList() {
  const [ranking, setRanking] = useState<PlayerRank[]>([]);
  const [loading, setLoading] = useState(true);

  // Estados dos Filtros
  const [grupos, setGrupos] = useState<Grupo[]>([]);
  const [modalidades, setModalidades] = useState<Modalidade[]>([]);
  const [selectedGrupoId, setSelectedGrupoId] = useState<string>('');
  const [selectedModalidadeId, setSelectedModalidadeId] = useState<string>('');

  useEffect(() => {
    fetchFilters();
  }, []);

  useEffect(() => {
    fetchRanking();
  }, [selectedGrupoId, selectedModalidadeId]);

  const fetchFilters = async () => {
    try {
      // 1. Buscar Grupos
      const { data: dbGrupos } = await supabase.from('grupos').select('*');
      if (dbGrupos) setGrupos(dbGrupos);

      // 2. Buscar Modalidades
      const { data: dbModalidades } = await supabase.from('modalidades').select('*');
      if (dbModalidades) setModalidades(dbModalidades);
    } catch (e) {
      console.error('Erro ao carregar filtros de classificação:', e);
    }
  };

  const fetchRanking = async () => {
    try {
      setLoading(true);

      // 1. Obter todos os usuários cadastrados
      const { data: users, error: userError } = await supabase.from('usuarios').select('*');
      if (userError) throw userError;

      // 2. Obter eventos com base nos filtros selecionados
      let query = supabase.from('eventos').select('grupo_id, modalidade_id, participantes');
      if (selectedGrupoId) {
        query = query.eq('grupo_id', selectedGrupoId);
      }
      if (selectedModalidadeId) {
        query = query.eq('modalidade_id', selectedModalidadeId);
      }

      const { data: events, error: eventError } = await query;
      if (eventError) throw eventError;

      if (users && events) {
        // Encontrar nomes de jogadores que participaram de pelo menos uma partida nos eventos filtrados
        const participatedPlayerNames = new Set<string>();
        events.forEach((event: any) => {
          if (Array.isArray(event.participantes)) {
            event.participantes.forEach((p: any) => {
              if (p.nome) {
                participatedPlayerNames.add(p.nome.trim().toLowerCase());
              }
            });
          }
        });

        // Filtrar usuários que participaram e mapear suas estatísticas de vitórias/rating nos eventos correspondentes
        const ranked: PlayerRank[] = users
          .filter((user) => participatedPlayerNames.has(user.nome?.trim().toLowerCase()))
          .map((user) => {
            let totalVitorias = 0;
            const ratings: number[] = [];

            // Percorre os eventos filtrados para somar as vitórias e avaliações do jogador
            events.forEach((event: any) => {
              const participantes = event.participantes;
              if (Array.isArray(participantes)) {
                const p = participantes.find(
                  (part) => part.nome?.trim().toLowerCase() === user.nome?.trim().toLowerCase()
                );
                if (p) {
                  totalVitorias += p.jogosGanhos || 0;
                  if (typeof p.avaliacao === 'number') {
                    ratings.push(p.avaliacao);
                  }
                }
              }
            });

            // Calcula a média de rating do jogador naquele contexto (padrão 3.0 se não tiver rating registrado)
            const mediaRating =
              ratings.length > 0
                ? ratings.reduce((sum, r) => sum + r, 0) / ratings.length
                : 3.0;

            return {
              ...user,
              vitorias: totalVitorias,
              rating: mediaRating,
            };
          });

        // Ordena por número de vitórias decrescente, depois por rating e por fim nome alfabético
        ranked.sort((a, b) => {
          if (b.vitorias !== a.vitorias) {
            return b.vitorias - a.vitorias;
          }
          if (b.rating !== a.rating) {
            return b.rating - a.rating;
          }
          return a.nome.localeCompare(b.nome);
        });

        setRanking(ranked);
      }
    } catch (e) {
      console.error('Erro ao buscar ranking:', e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="px-4 py-3 pb-24 w-full max-w-md mx-auto min-h-[calc(100vh-8rem)]">
      {/* Header do Ranking */}
      <div className="flex items-center gap-3 mb-5 pl-14 h-11">
        <div className="p-2 bg-yellow-500/10 text-yellow-500 rounded-xl flex items-center justify-center">
          <Trophy size={18} />
        </div>
        <h1 className="text-2xl font-black text-slate-900 leading-none">Classificação</h1>
      </div>

      {/* Seletor de Filtros */}
      <div className="grid grid-cols-2 gap-3 mb-6 text-left">
        <div className="space-y-1">
          <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Grupo</label>
          <select
            value={selectedGrupoId}
            onChange={(e) => setSelectedGrupoId(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-3 text-slate-900 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-red-500 cursor-pointer shadow-xs"
          >
            <option value="">Todos os Grupos</option>
            {grupos.map((g) => (
              <option key={g.id} value={g.id}>
                {g.nome}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Modalidade</label>
          <select
            value={selectedModalidadeId}
            onChange={(e) => setSelectedModalidadeId(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-3 text-slate-900 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-red-500 cursor-pointer shadow-xs"
          >
            <option value="">Todas as Modalidades</option>
            {modalidades.map((m) => (
              <option key={m.id} value={m.id}>
                {m.nome}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Lista Classificatória */}
      {loading ? (
        <div className="flex justify-center items-center h-48">
          <div className="w-8 h-8 border-4 border-red-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : ranking.length === 0 ? (
        <div className="text-center py-12 glass rounded-2xl border border-slate-150 text-left">
          <Trophy size={32} className="mx-auto text-slate-400 mb-2" />
          <p className="text-slate-600 text-xs font-medium text-center">Nenhuma classificação para este filtro.</p>
          <p className="text-[10px] text-slate-450 mt-1 text-center font-bold">Dispute partidas para pontuar no ranking!</p>
        </div>
      ) : (
        <div className="space-y-3">
          {ranking.map((player, index) => {
            const isTop3 = index < 3;
            const medalColors = ['text-yellow-400', 'text-slate-600', 'text-amber-600'];

            return (
              <div
                key={player.id}
                className="glass p-4 rounded-xl border border-slate-200 flex items-center justify-between shadow-xs animate-fade-in"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 flex items-center justify-center font-bold text-sm">
                    {isTop3 ? (
                      <Medal className={medalColors[index]} size={24} />
                    ) : (
                      <span className="text-slate-500">{index + 1}</span>
                    )}
                  </div>
                  
                  {player.foto ? (
                    <img
                      src={player.foto}
                      alt={player.nome}
                      className="w-10 h-10 rounded-full object-cover ring-1 ring-slate-800"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-slate-800 text-slate-100 flex items-center justify-center font-bold text-xs uppercase">
                      {player.nome.charAt(0)}
                    </div>
                  )}
                  
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm">{player.nome}</h3>
                    <div className="flex items-center gap-1 text-[11px] text-slate-600">
                      <Star size={11} className="text-amber-500 fill-amber-500" />
                      <span>{player.rating.toFixed(1)} de Rating</span>
                    </div>
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-sm font-black text-red-400">{player.vitorias}</span>
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider">Vitórias</p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
