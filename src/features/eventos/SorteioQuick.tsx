import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { Sparkles, Users, RefreshCw, Share2, ArrowLeft, Check, Copy } from 'lucide-react';

interface Member {
  id: string;
  nome: string;
  foto?: string;
  avaliacao: number;
  checked: boolean;
}

export default function SorteioQuick() {
  const navigate = useNavigate();

  // Estados dos Filtros e Grupos
  const [grupos, setGrupos] = useState<any[]>([]);
  const [selectedGrupoId, setSelectedGrupoId] = useState('');
  const [loadingGrupos, setLoadingGrupos] = useState(true);

  // Membros do grupo selecionado
  const [membros, setMembros] = useState<Member[]>([]);
  const [loadingMembros, setLoadingMembros] = useState(false);
  const [search, setSearch] = useState('');

  // Configurações do Sorteio
  const [playersPerTeam, setPlayersPerTeam] = useState(6);
  const [sortMode, setSortMode] = useState<'balanced' | 'random'>('balanced');

  // Resultado do Sorteio
  const [timeA, setTimeA] = useState<Member[]>([]);
  const [timeB, setTimeB] = useState<Member[]>([]);
  const [excluidos, setExcluidos] = useState<Member[]>([]);
  const [showResult, setShowResult] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);

  // Dialog / Dialog de Copiar
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetchGrupos();
  }, []);

  useEffect(() => {
    if (selectedGrupoId) {
      fetchMembros(selectedGrupoId);
      setShowResult(false);
      setTimeA([]);
      setTimeB([]);
      setExcluidos([]);
    } else {
      setMembros([]);
    }
  }, [selectedGrupoId]);

  const fetchGrupos = async () => {
    setLoadingGrupos(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: userData } = await supabase
        .from('usuarios')
        .select('id')
        .eq('email', user.email)
        .single();
      
      const loggedId = userData?.id || user.id;

      // Buscar os grupos do usuário
      const { data: userGroups, error } = await supabase
        .from('membros_grupo')
        .select('grupo_id, grupos(id, nome)')
        .eq('usuario_id', loggedId)
        .eq('status', 'aprovado');

      if (!error && userGroups) {
        const parsedGrupos = userGroups
          .map((ug: any) => ug.grupos)
          .filter(Boolean);
        setGrupos(parsedGrupos);
        if (parsedGrupos.length > 0) {
          setSelectedGrupoId(parsedGrupos[0].id);
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingGrupos(false);
    }
  };

  const fetchMembros = async (grupoId: string) => {
    setLoadingMembros(true);
    try {
      // 1. Buscar membros do grupo aprovados
      const { data: membersData, error } = await supabase
        .from('membros_grupo')
        .select('usuario_id, usuarios(id, nome, foto)')
        .eq('grupo_id', grupoId)
        .eq('status', 'aprovado');

      if (!error && membersData) {
        const userIds = membersData.map((m: any) => m.usuario_id);

        // 2. Buscar avaliações/ratings consolidadas se existirem
        const { data: ratingsData } = await supabase
          .from('ratings_jogador')
          .select('usuario_id, rating')
          .eq('grupo_id', grupoId);

        const ratingMap = new Map<string, number>();
        if (ratingsData) {
          ratingsData.forEach((r) => {
            ratingMap.set(r.usuario_id, Number(r.rating));
          });
        }

        const parsedMembros: Member[] = (membersData
          .map((m: any) => {
            const u = m.usuarios;
            if (!u) return null;
            return {
              id: u.id,
              nome: u.nome,
              foto: u.foto || undefined,
              avaliacao: ratingMap.get(u.id) ?? 3.0,
              checked: true
            };
          })
          .filter(Boolean) as Member[])
          .sort((a, b) => a.nome.localeCompare(b.nome));

        setMembros(parsedMembros);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingMembros(false);
    }
  };

  const toggleMemberChecked = (id: string) => {
    setMembros((prev) =>
      prev.map((m) => (m.id === id ? { ...m, checked: !m.checked } : m))
    );
  };

  const toggleAllMembers = (checked: boolean) => {
    setMembros((prev) => prev.map((m) => ({ ...m, checked })));
  };

  const handleSortear = () => {
    const presentes = membros.filter((m) => m.checked);
    
    if (presentes.length < 2) {
      alert('Selecione pelo menos 2 jogadores presentes para realizar o sorteio.');
      return;
    }

    setIsDrawing(true);
    setShowResult(false);

    setTimeout(() => {
      // 1. Clonar a lista de presentes
      let candidates = [...presentes];

      // 2. Ordenar candidatos de acordo com o modo
      if (sortMode === 'balanced') {
        // Ordenação por estrelas (descrescente)
        candidates.sort((a, b) => b.avaliacao - a.avaliacao);
      } else {
        // Aleatório
        candidates.sort(() => Math.random() - 0.5);
      }

      // Limitar a quantidade de jogadores para os times (2 * playersPerTeam)
      const maxPlayers = playersPerTeam * 2;
      const sortingPool = candidates.slice(0, Math.min(candidates.length, maxPlayers));
      const poolExcluidos = candidates.slice(sortingPool.length);

      const localTimeA: Member[] = [];
      const localTimeB: Member[] = [];

      if (sortMode === 'balanced') {
        // Distribuição Serpentina (Snake Draft) para balancear forças
        sortingPool.forEach((player, index) => {
          const round = Math.floor(index / 2);
          if (round % 2 === 0) {
            // Rodada par (0, 2...): Time A pega primeiro jogador, Time B pega segundo
            if (index % 2 === 0) {
              localTimeA.push(player);
            } else {
              localTimeB.push(player);
            }
          } else {
            // Rodada ímpar (1, 3...): Time B pega primeiro jogador, Time A pega segundo
            if (index % 2 === 0) {
              localTimeB.push(player);
            } else {
              localTimeA.push(player);
            }
          }
        });
      } else {
        // Sorteio Aleatório Simples
        sortingPool.forEach((player, index) => {
          if (index % 2 === 0) {
            localTimeA.push(player);
          } else {
            localTimeB.push(player);
          }
        });
      }

      setTimeA(localTimeA);
      setTimeB(localTimeB);
      setExcluidos(poolExcluidos);
      setIsDrawing(false);
      setShowResult(true);
    }, 1500); // 1.5s de suspense
  };

  const handleCopiarSorteioTexto = () => {
    const grupo = grupos.find((g) => g.id === selectedGrupoId);
    const grupoNome = grupo ? grupo.nome : 'GoPlay';

    let text = `🏆 *SORTEIO DE TIMES - ${grupoNome.toUpperCase()}* 🏆\n\n`;
    
    text += `🔴 *TIME A:*\n`;
    timeA.forEach((p, idx) => {
      text += `${idx + 1}. ${p.nome} (${p.avaliacao.toFixed(1)}★)\n`;
    });
    text += `Total: ${(timeA.reduce((sum, p) => sum + p.avaliacao, 0)).toFixed(1)} pts\n\n`;

    text += `🔵 *TIME B:*\n`;
    timeB.forEach((p, idx) => {
      text += `${idx + 1}. ${p.nome} (${p.avaliacao.toFixed(1)}★)\n`;
    });
    text += `Total: ${(timeB.reduce((sum, p) => sum + p.avaliacao, 0)).toFixed(1)} pts\n\n`;

    if (excluidos.length > 0) {
      text += `⏳ *RESERVAS:*\n`;
      excluidos.forEach((p, idx) => {
        text += `${idx + 1}. ${p.nome}\n`;
      });
    }

    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCompartilharSorteio = async () => {
    const el = document.getElementById('sorteio-quick-result-card');
    if (!el) return;

    try {
      const html2canvas = (await import('html2canvas-pro')).default;
      const canvas = await html2canvas(el, {
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        scale: 2
      });

      canvas.toBlob(async (blob) => {
        if (!blob) return;

        const filename = 'Sorteio_GoPlay.png';
        const file = new File([blob], filename, { type: 'image/png' });

        if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({
            files: [file],
            title: 'Sorteio Rápido - GoPlay',
            text: 'Confira os times do nosso jogo de hoje! ⚽🏐'
          });
        } else {
          // Fallback Download
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = filename;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        }
      });
    } catch (err) {
      console.error(err);
    }
  };

  const filteredMembros = membros.filter((m) =>
    m.nome.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="px-4 py-3 pb-24 w-full max-w-md mx-auto relative min-h-[calc(100vh-8rem)]">
      {/* Header */}
      <div className="flex items-center gap-3 mb-5 pl-14 h-11">
        <button
          onClick={() => navigate(-1)}
          className="p-2 rounded-lg bg-slate-50 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer border-0"
        >
          <ArrowLeft size={18} />
        </button>
        <h1 className="text-2xl font-black text-slate-900 leading-none">Sorteio Rápido</h1>
      </div>

      {loadingGrupos ? (
        <div className="flex justify-center items-center h-48">
          <div className="w-8 h-8 border-4 border-red-650 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : grupos.length === 0 ? (
        <div className="text-center py-12 glass rounded-2xl border border-slate-150">
          <Users size={48} className="mx-auto text-slate-650 mb-3" />
          <p className="text-slate-650 font-medium">Você não participa de nenhum grupo.</p>
          <p className="text-slate-650 text-xs mt-1">Crie ou junte-se a um grupo para fazer sorteios!</p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Seletor de Grupo */}
          <div className="space-y-1.5 text-left">
            <label className="text-[10px] font-black text-slate-555 uppercase tracking-widest block">
              Selecione o Grupo
            </label>
            <select
              value={selectedGrupoId}
              onChange={(e) => setSelectedGrupoId(e.target.value)}
              className="w-full bg-slate-50 border border-slate-250 rounded-xl py-3 px-4 text-slate-900 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-red-500/30 transition-all cursor-pointer appearance-none"
            >
              {grupos.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.nome}
                </option>
              ))}
            </select>
          </div>

          {/* Configurações do Sorteio */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl text-left space-y-4 shadow-xs">
            <h3 className="text-[10px] font-black text-slate-555 uppercase tracking-widest flex items-center gap-1.5 border-b border-slate-200 pb-2">
              <Sparkles size={14} className="text-red-400" />
              Configurações
            </h3>
            
            <div className="grid grid-cols-2 gap-3.5">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-555 uppercase">Jogadores / Time</label>
                <select
                  value={playersPerTeam}
                  onChange={(e) => setPlayersPerTeam(Number(e.target.value))}
                  className="w-full bg-white border border-slate-250 rounded-xl py-2 px-3 text-slate-900 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-red-500/20 cursor-pointer"
                >
                  {[3, 4, 5, 6, 7, 8].map((n) => (
                    <option key={n} value={n}>
                      {n} vs {n}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-555 uppercase">Tipo de Sorteio</label>
                <select
                  value={sortMode}
                  onChange={(e) => setSortMode(e.target.value as 'balanced' | 'random')}
                  className="w-full bg-white border border-slate-250 rounded-xl py-2 px-3 text-slate-900 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-red-500/20 cursor-pointer"
                >
                  <option value="balanced">⚖️ Equilibrado (Estrelas)</option>
                  <option value="random">🎲 Aleatório (Sorte)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Lista de Jogadores para Presença */}
          <div className="glass p-4 rounded-2xl border border-slate-200 text-left space-y-3.5 shadow-sm">
            <div className="flex justify-between items-center border-b border-slate-200 pb-2.5">
              <div>
                <h3 className="text-xs font-black text-slate-700 uppercase tracking-wide">
                  Jogadores do Grupo ({membros.length})
                </h3>
                <span className="text-[10px] font-bold text-slate-450 uppercase block mt-0.5">
                  Presentes: {membros.filter((m) => m.checked).length}
                </span>
              </div>

              {/* Botões de marcar/desmarcar todos */}
              <div className="flex gap-2">
                <button
                  onClick={() => toggleAllMembers(true)}
                  className="text-[10px] font-extrabold text-indigo-600 hover:text-indigo-700 bg-transparent border-0 cursor-pointer"
                >
                  Todos
                </button>
                <span className="text-slate-350 text-[10px]">|</span>
                <button
                  onClick={() => toggleAllMembers(false)}
                  className="text-[10px] font-extrabold text-slate-500 hover:text-slate-700 bg-transparent border-0 cursor-pointer"
                >
                  Nenhum
                </button>
              </div>
            </div>

            {/* Filtro de Busca */}
            <input
              type="text"
              placeholder="Buscar jogador..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-3.5 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-red-500/20 transition-all text-xs"
            />

            {loadingMembros ? (
              <div className="flex justify-center items-center py-8">
                <div className="w-6 h-6 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : filteredMembros.length === 0 ? (
              <p className="text-slate-650 text-xs text-center py-6">Nenhum jogador encontrado.</p>
            ) : (
              <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto no-scrollbar pr-0.5">
                {filteredMembros.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => toggleMemberChecked(m.id)}
                    className={`flex items-center gap-2 p-2 rounded-xl border transition-all text-left cursor-pointer bg-white ${
                      m.checked
                        ? 'border-emerald-500 bg-emerald-50/15'
                        : 'border-slate-200 opacity-60'
                    }`}
                  >
                    <div className={`w-4 h-4 rounded-md border flex items-center justify-center flex-shrink-0 transition-all ${
                      m.checked ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-slate-300'
                    }`}>
                      {m.checked && <Check size={10} strokeWidth={4} />}
                    </div>

                    {m.foto ? (
                      <img src={m.foto} alt={m.nome} className="w-5 h-5 rounded-full object-cover flex-shrink-0" />
                    ) : (
                      <div className="w-5 h-5 rounded-full bg-slate-800 text-slate-100 flex items-center justify-center font-black text-[9px] flex-shrink-0">
                        {m.nome[0]}
                      </div>
                    )}

                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] font-bold text-slate-800 truncate leading-tight">
                        {m.nome}
                      </p>
                      <span className="text-[8px] text-slate-500 font-bold block mt-0.5">
                        {m.avaliacao.toFixed(1)}★
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Botão de Sortear */}
          <button
            onClick={handleSortear}
            disabled={isDrawing || membros.filter((m) => m.checked).length < 2}
            className="w-full py-3.5 bg-gradient-to-r from-red-600 to-red-750 hover:from-red-600 hover:to-indigo-600 text-white font-black rounded-2xl shadow-lg active:scale-98 disabled:opacity-50 disabled:cursor-not-allowed transition-all text-xs flex justify-center items-center gap-2 border-0 cursor-pointer shadow-red-500/10"
          >
            {isDrawing ? (
              <>
                <RefreshCw size={15} className="animate-spin" />
                <span>Embaralhando Jogadores...</span>
              </>
            ) : (
              <>
                <Sparkles size={15} />
                <span>Sortear Times</span>
              </>
            )}
          </button>

          {/* RESULTADO DO SORTEIO */}
          {showResult && (
            <div id="sorteio-quick-result-card" className="p-4 bg-white border border-slate-200 rounded-2xl space-y-4 text-left shadow-md">
              <h3 className="text-xs font-black text-slate-700 uppercase tracking-wide border-b border-slate-200 pb-2">
                Times Sorteados
              </h3>

              <div className="grid grid-cols-2 gap-3.5">
                {/* Time A */}
                <div className="p-3 bg-red-50/40 border border-red-200 rounded-xl space-y-2">
                  <h4 className="text-[10px] font-black text-red-500 uppercase tracking-wider">
                    🔴 Time A ({timeA.reduce((sum, p) => sum + p.avaliacao, 0).toFixed(1)} pts)
                  </h4>
                  <div className="space-y-1.5">
                    {timeA.map((p) => (
                      <div key={p.id} className="flex items-center gap-1.5">
                        {p.foto ? (
                          <img src={p.foto} alt={p.nome} className="w-4 h-4 rounded-full object-cover flex-shrink-0" />
                        ) : (
                          <div className="w-4 h-4 rounded-full bg-slate-800 text-slate-100 flex items-center justify-center font-bold text-[8px] flex-shrink-0">
                            {p.nome[0]}
                          </div>
                        )}
                        <span className="text-[10px] font-bold text-slate-750 truncate">{p.nome}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Time B */}
                <div className="p-3 bg-indigo-50/40 border border-indigo-200 rounded-xl space-y-2">
                  <h4 className="text-[10px] font-black text-indigo-500 uppercase tracking-wider">
                    🔵 Time B ({timeB.reduce((sum, p) => sum + p.avaliacao, 0).toFixed(1)} pts)
                  </h4>
                  <div className="space-y-1.5">
                    {timeB.map((p) => (
                      <div key={p.id} className="flex items-center gap-1.5">
                        {p.foto ? (
                          <img src={p.foto} alt={p.nome} className="w-4 h-4 rounded-full object-cover flex-shrink-0" />
                        ) : (
                          <div className="w-4 h-4 rounded-full bg-slate-800 text-slate-100 flex items-center justify-center font-bold text-[8px] flex-shrink-0">
                            {p.nome[0]}
                          </div>
                        )}
                        <span className="text-[10px] font-bold text-slate-750 truncate">{p.nome}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Reservas */}
              {excluidos.length > 0 && (
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                  <h4 className="text-[10px] font-black text-slate-550 uppercase tracking-wider">
                    ⏳ Reservas Fila ({excluidos.length})
                  </h4>
                  <div className="flex flex-wrap gap-1.5">
                    {excluidos.map((p) => (
                      <span key={p.id} className="px-2 py-0.5 rounded bg-white border border-slate-200 text-[9px] font-semibold text-slate-650">
                        {p.nome}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Botões de Compartilhar Sorteio */}
              <div className="flex gap-2 border-t border-slate-250 pt-3">
                <button
                  onClick={handleCopiarSorteioTexto}
                  className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs flex justify-center items-center gap-1.5 cursor-pointer border-0 active:scale-95 transition-all"
                >
                  {copied ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                  <span>{copied ? 'Copiado!' : 'Copiar Texto'}</span>
                </button>

                <button
                  onClick={handleCompartilharSorteio}
                  className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs flex justify-center items-center gap-1.5 cursor-pointer border-0 active:scale-95 transition-all shadow-sm"
                >
                  <Share2 size={14} />
                  <span>Compartilhar</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
