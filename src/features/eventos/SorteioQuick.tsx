import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { Sparkles, Users, RefreshCw, Share2, ArrowLeft, Check, Copy, Plus, X, Star, Info, AlertTriangle } from 'lucide-react';

interface Member {
  id: string;
  nome: string;
  foto?: string;
  avaliacao: number;
  checked: boolean;
  isAvulso?: boolean;
}

export default function SorteioQuick() {
  const navigate = useNavigate();

  // Estados dos Filtros e Grupos
  const [grupos, setGrupos] = useState<any[]>([]);
  const [selectedGrupoId, setSelectedGrupoId] = useState<string>('avulso');
  const [loadingGrupos, setLoadingGrupos] = useState(true);

  // Membros do sorteio (podem vir de grupo ou adicionados manualmente)
  const [membros, setMembros] = useState<Member[]>([]);
  const [loadingMembros, setLoadingMembros] = useState(false);
  const [search, setSearch] = useState('');

  // Adição de jogador avulso
  const [novoNome, setNovoNome] = useState('');
  const [novaAvaliacao, setNovaAvaliacao] = useState(3.0);

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
    if (selectedGrupoId && selectedGrupoId !== 'avulso') {
      fetchMembrosGrupo(selectedGrupoId);
      setShowResult(false);
      setTimeA([]);
      setTimeB([]);
      setExcluidos([]);
    }
  }, [selectedGrupoId]);

  const fetchGrupos = async () => {
    setLoadingGrupos(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoadingGrupos(false);
        return;
      }

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
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingGrupos(false);
    }
  };

  const fetchMembrosGrupo = async (grupoId: string) => {
    setLoadingMembros(true);
    try {
      const { data: membersData, error } = await supabase
        .from('membros_grupo')
        .select('usuario_id, usuarios(id, nome, foto)')
        .eq('grupo_id', grupoId)
        .eq('status', 'aprovado');

      if (!error && membersData) {
        // Buscar ratings do grupo se existirem
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
              checked: true,
              isAvulso: false,
            };
          })
          .filter(Boolean) as Member[])
          .sort((a, b) => a.nome.localeCompare(b.nome));

        // Preserva jogadores avulsos que o usuário já havia digitado manualmente
        setMembros((prev) => {
          const avulsos = prev.filter((m) => m.isAvulso);
          return [...parsedMembros, ...avulsos];
        });
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingMembros(false);
    }
  };

  const handleAddJogadorAvulso = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const nomeLimpo = novoNome.trim();
    if (!nomeLimpo) return;

    const novoJogador: Member = {
      id: `avulso_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      nome: nomeLimpo,
      avaliacao: novaAvaliacao,
      checked: true,
      isAvulso: true,
    };

    setMembros((prev) => [...prev, novoJogador]);
    setNovoNome('');
  };

  const handleRemoverJogador = (id: string) => {
    setMembros((prev) => prev.filter((m) => m.id !== id));
  };

  const toggleMemberChecked = (id: string) => {
    setMembros((prev) =>
      prev.map((m) => (m.id === id ? { ...m, checked: !m.checked } : m))
    );
  };

  const toggleAllMembers = (checked: boolean) => {
    setMembros((prev) => prev.map((m) => ({ ...m, checked })));
  };

  const handleLimparLista = () => {
    setMembros([]);
    setShowResult(false);
    setTimeA([]);
    setTimeB([]);
    setExcluidos([]);
  };

  const handleSortear = () => {
    const presentes = membros.filter((m) => m.checked);
    
    if (presentes.length < 2) {
      alert('Adicione ou selecione pelo menos 2 jogadores presentes para realizar o sorteio.');
      return;
    }

    setIsDrawing(true);
    setShowResult(false);

    setTimeout(() => {
      let candidates = [...presentes];

      if (sortMode === 'balanced') {
        candidates.sort((a, b) => b.avaliacao - a.avaliacao);
      } else {
        candidates.sort(() => Math.random() - 0.5);
      }

      const maxPlayers = playersPerTeam * 2;
      const sortingPool = candidates.slice(0, Math.min(candidates.length, maxPlayers));
      const poolExcluidos = candidates.slice(sortingPool.length);

      const localTimeA: Member[] = [];
      const localTimeB: Member[] = [];

      if (sortMode === 'balanced') {
        // Snake Draft para balancear nivel de estrelas
        sortingPool.forEach((player, index) => {
          const round = Math.floor(index / 2);
          if (round % 2 === 0) {
            if (index % 2 === 0) localTimeA.push(player);
            else localTimeB.push(player);
          } else {
            if (index % 2 === 0) localTimeB.push(player);
            else localTimeA.push(player);
          }
        });
      } else {
        // Sorteio puramente aleatório
        sortingPool.forEach((player, index) => {
          if (index % 2 === 0) localTimeA.push(player);
          else localTimeB.push(player);
        });
      }

      setTimeA(localTimeA);
      setTimeB(localTimeB);
      setExcluidos(poolExcluidos);
      setIsDrawing(false);
      setShowResult(true);
    }, 1200);
  };

  const handleCopiarSorteioTexto = () => {
    let text = `⚡ *SORTEIO RÁPIDO - GOPLAY* ⚡\n`;
    text += `⚠️ _Partida avulsa (Não pontua no Ranking)_\n\n`;
    
    text += `🔴 *TIME A:*\n`;
    timeA.forEach((p, idx) => {
      text += `${idx + 1}. ${p.nome} (${p.avaliacao.toFixed(1)}★)\n`;
    });
    text += `Média: ${(timeA.reduce((sum, p) => sum + p.avaliacao, 0) / (timeA.length || 1)).toFixed(1)}★\n\n`;

    text += `🔵 *TIME B:*\n`;
    timeB.forEach((p, idx) => {
      text += `${idx + 1}. ${p.nome} (${p.avaliacao.toFixed(1)}★)\n`;
    });
    text += `Média: ${(timeB.reduce((sum, p) => sum + p.avaliacao, 0) / (timeB.length || 1)).toFixed(1)}★\n\n`;

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

        const filename = 'Sorteio_Rapido_GoPlay.png';
        const file = new File([blob], filename, { type: 'image/png' });

        if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({
            files: [file],
            title: 'Sorteio Rápido - GoPlay',
            text: 'Confira a escalação dos times do nosso jogo! ⚡ (Partida Avulsa)'
          });
        } else {
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
      <div className="flex items-center gap-3 mb-4 pl-14 h-11">
        <button
          onClick={() => navigate(-1)}
          className="p-2 rounded-lg bg-slate-50 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer border-0"
          title="Voltar"
        >
          <ArrowLeft size={18} />
        </button>
        <div>
          <h1 className="text-2xl font-black text-slate-900 leading-none">Sorteio Rápido</h1>
          <p className="text-[11px] text-slate-500 font-bold mt-0.5">Partidas Avulsas e Imediatas</p>
        </div>
      </div>

      {/* AVISO IMPORTANTE: Não Pontua no Ranking */}
      <div className="p-3 bg-amber-50 border border-amber-200 rounded-2xl flex items-start gap-2.5 text-left mb-4 shadow-xs">
        <Info size={16} className="text-amber-600 shrink-0 mt-0.5" />
        <div className="space-y-0.5">
          <p className="text-xs font-black text-amber-900 leading-tight">
            Partida Rápida Sem Vínculo de Ranking
          </p>
          <p className="text-[11px] text-amber-800/90 leading-relaxed">
            Feita para quem quer jogar agora sem criar eventos ou cadastros. <strong>Os jogos deste sorteio não alteram o Ranking oficial.</strong>
          </p>
        </div>
      </div>

      <div className="space-y-4">
        {/* Origem dos Atletas: Grupo Opcional ou Lista Avulsa */}
        <div className="space-y-1.5 text-left">
          <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block">
            Origem dos Jogadores
          </label>
          <select
            value={selectedGrupoId}
            onChange={(e) => setSelectedGrupoId(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-3.5 text-slate-900 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-red-500/20 transition-all cursor-pointer"
          >
            <option value="avulso">🎲 Lista Avulsa Livre (Sem Grupo)</option>
            {grupos.map((g) => (
              <option key={g.id} value={g.id}>
                👥 Carregar Integrantes: {g.nome}
              </option>
            ))}
          </select>
        </div>

        {/* Formulário: Adicionar Nomes Avulsos na Hora */}
        <form onSubmit={handleAddJogadorAvulso} className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-left space-y-2.5 shadow-xs">
          <label className="text-[10px] font-black text-slate-600 uppercase tracking-wider block">
            + Adicionar Jogador Rápido
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Nome do atleta (ex: Carlos, Pedrinho...)"
              value={novoNome}
              onChange={(e) => setNovoNome(e.target.value)}
              className="flex-1 bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-red-500/20"
            />
            
            {/* Seletor de Nível/Estrelas */}
            <select
              value={novaAvaliacao}
              onChange={(e) => setNovaAvaliacao(Number(e.target.value))}
              className="bg-white border border-slate-200 rounded-xl px-2 py-2 text-xs font-bold text-amber-600 cursor-pointer"
              title="Nível de habilidade"
            >
              <option value={1}>1.0 ★</option>
              <option value={2}>2.0 ★</option>
              <option value={3}>3.0 ★</option>
              <option value={4}>4.0 ★</option>
              <option value={5}>5.0 ★</option>
            </select>

            <button
              type="submit"
              className="px-3.5 py-2 bg-red-650 hover:bg-red-700 text-white rounded-xl text-xs font-black flex items-center gap-1 cursor-pointer active:scale-95 transition-all shadow-xs"
            >
              <Plus size={15} />
              <span>Add</span>
            </button>
          </div>
          <p className="text-[10px] text-slate-400">
            * Pressione Enter para adicionar rapidamente quantos amigos quiser.
          </p>
        </form>

        {/* Configurações do Sorteio */}
        <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl text-left space-y-3 shadow-xs">
          <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1.5 border-b border-slate-200 pb-2">
            <Sparkles size={14} className="text-red-500" />
            Configurações da Partida
          </h3>
          
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase">Jogadores / Time</label>
              <select
                value={playersPerTeam}
                onChange={(e) => setPlayersPerTeam(Number(e.target.value))}
                className="w-full bg-white border border-slate-200 rounded-xl py-2 px-3 text-slate-900 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-red-500/20 cursor-pointer"
              >
                {[2, 3, 4, 5, 6, 7, 8, 11].map((n) => (
                  <option key={n} value={n}>
                    {n} vs {n} ({n * 2} em campo)
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase">Tipo de Sorteio</label>
              <select
                value={sortMode}
                onChange={(e) => setSortMode(e.target.value as 'balanced' | 'random')}
                className="w-full bg-white border border-slate-200 rounded-xl py-2 px-3 text-slate-900 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-red-500/20 cursor-pointer"
              >
                <option value="balanced">⚖️ Equilibrado (Estrelas)</option>
                <option value="random">🎲 Aleatório (Sorte Pura)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Lista de Atletas no Sorteio */}
        <div className="glass p-4 rounded-2xl border border-slate-200 text-left space-y-3 shadow-sm">
          <div className="flex justify-between items-center border-b border-slate-200 pb-2">
            <div>
              <h3 className="text-xs font-black text-slate-800 uppercase tracking-wide">
                Lista de Atletas ({membros.length})
              </h3>
              <span className="text-[10px] font-bold text-slate-400 block mt-0.5">
                Confirmados: {membros.filter((m) => m.checked).length} de {playersPerTeam * 2} necessários
              </span>
            </div>

            {/* Ações Rápidas */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => toggleAllMembers(true)}
                className="text-[10px] font-extrabold text-red-650 hover:underline cursor-pointer"
              >
                Todos
              </button>
              <span className="text-slate-300 text-[10px]">|</span>
              <button
                type="button"
                onClick={() => toggleAllMembers(false)}
                className="text-[10px] font-extrabold text-slate-500 hover:underline cursor-pointer"
              >
                Nenhum
              </button>
              {membros.length > 0 && (
                <>
                  <span className="text-slate-300 text-[10px]">|</span>
                  <button
                    type="button"
                    onClick={handleLimparLista}
                    className="text-[10px] font-extrabold text-red-500 hover:underline cursor-pointer"
                  >
                    Limpar
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Filtro de Busca rápida se houver muitos jogadores */}
          {membros.length > 6 && (
            <input
              type="text"
              placeholder="Filtrar por nome..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl py-1.5 px-3 text-slate-800 placeholder-slate-400 text-xs"
            />
          )}

          {loadingMembros ? (
            <div className="flex justify-center items-center py-6">
              <div className="w-6 h-6 border-3 border-red-600 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : filteredMembros.length === 0 ? (
            <div className="text-center py-6 space-y-1">
              <p className="text-xs font-bold text-slate-600">Nenhum jogador na lista.</p>
              <p className="text-[11px] text-slate-400">
                Digite os nomes no formulário acima ou selecione um grupo para carregar os membros.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2 max-h-56 overflow-y-auto pr-0.5">
              {filteredMembros.map((m) => (
                <div
                  key={m.id}
                  className={`flex items-center justify-between p-2 rounded-xl border transition-all text-left bg-white ${
                    m.checked
                      ? 'border-emerald-500 bg-emerald-50/20'
                      : 'border-slate-200 opacity-60'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => toggleMemberChecked(m.id)}
                    className="flex items-center gap-2 flex-1 min-w-0 cursor-pointer"
                  >
                    <div className={`w-4 h-4 rounded-md border flex items-center justify-center shrink-0 transition-all ${
                      m.checked ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-slate-300'
                    }`}>
                      {m.checked && <Check size={10} strokeWidth={4} />}
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] font-bold text-slate-800 truncate leading-tight">
                        {m.nome}
                      </p>
                      <span className="text-[8px] text-amber-600 font-bold block mt-0.5">
                        {m.avaliacao.toFixed(1)}★ {m.isAvulso && '• Avulso'}
                      </span>
                    </div>
                  </button>

                  {/* Botão de excluir jogador */}
                  <button
                    type="button"
                    onClick={() => handleRemoverJogador(m.id)}
                    className="p-1 text-slate-400 hover:text-red-500 rounded-md transition-colors cursor-pointer"
                    title="Remover jogador"
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Botão de Sortear */}
        <button
          onClick={handleSortear}
          disabled={isDrawing || membros.filter((m) => m.checked).length < 2}
          className="w-full py-3.5 bg-gradient-to-r from-red-600 to-amber-600 hover:from-red-700 hover:to-amber-700 text-white font-black rounded-2xl shadow-lg active:scale-98 disabled:opacity-50 disabled:cursor-not-allowed transition-all text-xs flex justify-center items-center gap-2 cursor-pointer shadow-red-500/20"
        >
          {isDrawing ? (
            <>
              <RefreshCw size={15} className="animate-spin" />
              <span>Embaralhando Atletas...</span>
            </>
          ) : (
            <>
              <Sparkles size={15} />
              <span>Sortear Times Equilibrados</span>
            </>
          )}
        </button>

        {/* RESULTADO DO SORTEIO */}
        {showResult && (
          <div id="sorteio-quick-result-card" className="p-4 bg-white border border-slate-200 rounded-3xl space-y-4 text-left shadow-lg animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <div>
                <h3 className="text-xs font-black text-slate-800 uppercase tracking-wide">
                  Times Sorteados
                </h3>
                <span className="text-[9px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full inline-block mt-0.5">
                  ⚡ Partida Avulsa • Sem Pontuação no Ranking
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {/* Time A */}
              <div className="p-3 bg-red-50/50 border border-red-200 rounded-2xl space-y-2">
                <div className="border-b border-red-100 pb-1">
                  <h4 className="text-[11px] font-black text-red-650 uppercase">
                    🔴 Time A
                  </h4>
                  <span className="text-[9px] font-bold text-slate-500">
                    Média: {(timeA.reduce((sum, p) => sum + p.avaliacao, 0) / (timeA.length || 1)).toFixed(1)}★
                  </span>
                </div>
                <div className="space-y-1.5">
                  {timeA.map((p, idx) => (
                    <div key={p.id} className="flex items-center justify-between text-xs bg-white p-1.5 rounded-lg border border-red-100/70">
                      <span className="font-bold text-slate-800 truncate text-[11px]">
                        {idx + 1}. {p.nome}
                      </span>
                      <span className="text-[9px] font-black text-amber-600 shrink-0">
                        {p.avaliacao.toFixed(1)}★
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Time B */}
              <div className="p-3 bg-blue-50/50 border border-blue-200 rounded-2xl space-y-2">
                <div className="border-b border-blue-100 pb-1">
                  <h4 className="text-[11px] font-black text-blue-650 uppercase">
                    🔵 Time B
                  </h4>
                  <span className="text-[9px] font-bold text-slate-500">
                    Média: {(timeB.reduce((sum, p) => sum + p.avaliacao, 0) / (timeB.length || 1)).toFixed(1)}★
                  </span>
                </div>
                <div className="space-y-1.5">
                  {timeB.map((p, idx) => (
                    <div key={p.id} className="flex items-center justify-between text-xs bg-white p-1.5 rounded-lg border border-blue-100/70">
                      <span className="font-bold text-slate-800 truncate text-[11px]">
                        {idx + 1}. {p.nome}
                      </span>
                      <span className="text-[9px] font-black text-amber-600 shrink-0">
                        {p.avaliacao.toFixed(1)}★
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Reservas / Próximos da Fila */}
            {excluidos.length > 0 && (
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5">
                <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-wider">
                  ⏳ Reservas ({excluidos.length})
                </h4>
                <div className="flex flex-wrap gap-1.5">
                  {excluidos.map((p) => (
                    <span key={p.id} className="px-2 py-0.5 rounded-md bg-white border border-slate-200 text-[10px] font-bold text-slate-700">
                      {p.nome}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* AVISO FINAL AO USUÁRIO */}
            <div className="p-2.5 bg-slate-50 border border-slate-250 rounded-xl flex items-center gap-2 text-slate-600 text-[10px] font-bold">
              <AlertTriangle size={14} className="text-amber-500 shrink-0" />
              <span>Lembrete: Esta partida rápida é avulsa e não altera as pontuações do Ranking Geral.</span>
            </div>

            {/* Botões de Compartilhar Sorteio */}
            <div className="flex gap-2 border-t border-slate-100 pt-3">
              <button
                type="button"
                onClick={handleCopiarSorteioTexto}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs flex justify-center items-center gap-1.5 cursor-pointer border-0 active:scale-95 transition-all"
              >
                {copied ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                <span>{copied ? 'Copiado!' : 'Copiar Texto'}</span>
              </button>

              <button
                type="button"
                onClick={handleCompartilharSorteio}
                className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs flex justify-center items-center gap-1.5 cursor-pointer border-0 active:scale-95 transition-all shadow-sm"
              >
                <Share2 size={14} />
                <span>Compartilhar Imagem</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
