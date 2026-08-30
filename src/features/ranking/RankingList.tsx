import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import type { Usuario } from '../../types';
import { Trophy, Star, Medal } from 'lucide-react';

interface PlayerRank extends Usuario {
  vitorias: number;
  rating: number;
}

export default function RankingList() {
  const [ranking, setRanking] = useState<PlayerRank[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRanking();
  }, []);

  const fetchRanking = async () => {
    try {
      // 1. Obter todos os usuários cadastrados
      const { data: users, error: userError } = await supabase.from('usuarios').select('*');
      if (userError) throw userError;

      // 2. Obter todos os eventos cadastrados (incluindo ativos e finalizados)
      const { data: events, error: eventError } = await supabase.from('eventos').select('participantes');
      if (eventError) throw eventError;

      if (users) {
        const ranked: PlayerRank[] = users.map((user) => {
          let totalVitorias = 0;
          const ratings: number[] = [];

          // Percorre todos os eventos para somar as vitórias e avaliações do jogador
          events?.forEach((event: any) => {
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

          // Calcula a média de rating do jogador (se não tiver jogado nenhum, inicia com 3.0)
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
      <div className="flex items-center gap-3 mb-4 pl-14 h-11">
        <div className="p-2 bg-yellow-500/10 text-yellow-500 rounded-xl flex items-center justify-center">
          <Trophy size={18} />
        </div>
        <h1 className="text-2xl font-black text-slate-900 leading-none">Classificação</h1>
      </div>

      {loading ? (
        <div className="flex justify-center items-center h-48">
          <div className="w-8 h-8 border-4 border-red-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : ranking.length === 0 ? (
        <div className="text-center py-12 glass rounded-2xl">
          <p className="text-slate-600">Nenhum jogador cadastrado.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {ranking.map((player, index) => {
            const isTop3 = index < 3;
            const medalColors = ['text-yellow-400', 'text-slate-600', 'text-amber-600'];

            return (
              <div
                key={player.id}
                className="glass p-4 rounded-xl border border-slate-200 flex items-center justify-between"
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
                    <div className="w-10 h-10 rounded-full bg-slate-800 text-slate-600 flex items-center justify-center font-bold">
                      {player.nome.charAt(0).toUpperCase()}
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
