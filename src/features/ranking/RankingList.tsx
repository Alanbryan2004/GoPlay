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
  // IDs dos grupos que o usuário participa (usado para filtrar ranking geral)
  const [allowedGroupIds, setAllowedGroupIds] = useState<string[]>([]);

  useEffect(() => {
    initFiltersAndContext();
  }, []);

  useEffect(() => {
    fetchRanking();
  }, [selectedGrupoId, selectedModalidadeId, allowedGroupIds]);

  const initFiltersAndContext = async () => {
    try {
      // 1. Buscar o usuário logado
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: userData } = await supabase
        .from('usuarios')
        .select('id, nome')
        .eq('email', user.email)
        .single();
      if (!userData) return;
      const loggedId = userData.id;

      // 2. Buscar apenas os grupos em que o usuário é membro aprovado
      const { data: membroData } = await supabase
        .from('membros_grupo')
        .select('grupo_id, grupos(id, nome)')
        .eq('usuario_id', loggedId)
        .eq('status', 'aprovado');

      let userGroupIds: string[] = [];
      if (membroData) {
        const parsedGrupos = membroData
          .map((m: any) => m.grupos)
          .filter(Boolean) as Grupo[];
        setGrupos(parsedGrupos);
        userGroupIds = parsedGrupos.map((g) => g.id);
        setAllowedGroupIds(userGroupIds);
      }

      // 3. Buscar apenas as modalidades em que o usuário possui rating (participação real)
      const { data: ratingData } = await supabase
        .from('ratings_jogador')
        .select('modalidade_id, modalidades(id, nome)')
        .eq('usuario_id', loggedId);

      if (ratingData && ratingData.length > 0) {
        const modalidadeMap = new Map<string, Modalidade>();
        ratingData.forEach((r: any) => {
          if (r.modalidades) {
            modalidadeMap.set(r.modalidades.id, r.modalidades as Modalidade);
          }
        });
        setModalidades(Array.from(modalidadeMap.values()));
      } else {
        const { data: dbModalidades } = await supabase.from('modalidades').select('*');
        if (dbModalidades) setModalidades(dbModalidades as Modalidade[]);
      }

      // 4. Buscar o último evento em que o usuário participou para definir grupo e modalidade padrão
      const { data: events } = await supabase
        .from('eventos')
        .select('grupo_id, modalidade_id, participantes')
        .order('data', { ascending: false })
        .limit(100);

      if (events) {
        const lastEvent = events.find((event: any) => {
          if (Array.isArray(event.participantes)) {
            return event.participantes.some(
              (p: any) => p.id === loggedId || p.nome?.trim().toLowerCase() === userData.nome?.trim().toLowerCase()
            );
          }
          return false;
        });

        if (lastEvent) {
          if (lastEvent.grupo_id) setSelectedGrupoId(lastEvent.grupo_id);
          if (lastEvent.modalidade_id) setSelectedModalidadeId(lastEvent.modalidade_id);
        } else if (userGroupIds.length > 0) {
          // Se não jogou em nenhum evento ainda, seleciona o primeiro grupo que ele pertence
          setSelectedGrupoId(userGroupIds[0]);
        }
      }
    } catch (e) {
      console.error('Erro ao inicializar filtros do ranking:', e);
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
        // Filtro por grupo específico selecionado
        query = query.eq('grupo_id', selectedGrupoId);
      } else if (allowedGroupIds.length > 0) {
        // Sem grupo específico: filtrar apenas pelos grupos que o usuário participa
        query = query.in('grupo_id', allowedGroupIds);
      }
      if (selectedModalidadeId) {
        query = query.eq('modalidade_id', selectedModalidadeId);
      }

      const { data: events, error: eventError } = await query;
      if (eventError) throw eventError;

      // 3. Obter ratings_jogador se estiver totalmente filtrado (por grupo e modalidade)
      let ratingRows: any[] = [];
      if (selectedGrupoId && selectedModalidadeId) {
        try {
          const { data: dbRatings } = await supabase
            .from('ratings_jogador')
            .select('usuario_id, rating')
            .eq('grupo_id', selectedGrupoId)
            .eq('modalidade_id', selectedModalidadeId);
          if (dbRatings) ratingRows = dbRatings;
        } catch (e) {
          console.error('Erro ao buscar notas consolidadas da tabela ratings_jogador:', e);
        }
      }

      if (users && events) {
        // Criar um Set de IDs E nomes dos participantes para matching duplo
        const participatedPlayerIds = new Set<string>();
        const participatedPlayerNames = new Set<string>();
        events.forEach((event: any) => {
          if (Array.isArray(event.participantes)) {
            event.participantes.forEach((p: any) => {
              if (p.id) participatedPlayerIds.add(p.id);
              if (p.nome) participatedPlayerNames.add(p.nome.trim().toLowerCase());
            });
          }
        });

        // Filtrar usuários que participaram — primeiro por ID (preciso), depois por nome (fallback)
        const ranked: PlayerRank[] = users
          .filter((user) =>
            participatedPlayerIds.has(user.id) ||
            participatedPlayerNames.has(user.nome?.trim().toLowerCase())
          )
          .map((user) => {
            let totalVitorias = 0;
            const ratings: number[] = [];

            // Percorre os eventos filtrados para somar as vitórias e avaliações do jogador
            events.forEach((event: any) => {
              const participantes = event.participantes;
              if (Array.isArray(participantes)) {
                // Busca por ID primeiro (mais confiável), depois por nome como fallback
                const p =
                  participantes.find((part) => part.id === user.id) ||
                  participantes.find(
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

            // Calcula a nota (se estiver totalmente filtrado por Grupo + Modalidade, usar a tabela consolidada;
            // caso contrário, calcula a média histórica das avaliações das partidas como fallback)
            let mediaRating = 3.0;
            if (selectedGrupoId && selectedModalidadeId) {
              const rRow = ratingRows.find((r) => r.usuario_id === user.id);
              if (rRow) {
                mediaRating = Number(rRow.rating);
              }
            } else {
              mediaRating =
                ratings.length > 0
                  ? ratings.reduce((sum, r) => sum + r, 0) / ratings.length
                  : 3.0;
            }

            return {
              ...user,
              vitorias: totalVitorias,
              rating: mediaRating,
            };
          })
          // Remover usuários sem nenhuma vitória E sem rating registrado (evitar fantasmas no ranking)
          .filter((u) => u.vitorias > 0 || ratingRows.some((r) => r.usuario_id === u.id));

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
