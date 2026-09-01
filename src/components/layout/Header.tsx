import { Link, useNavigate, useLocation } from 'react-router-dom';
import {
  User, LogOut, Menu, Users, Calendar, X, Home as HomeIcon,
  UserPlus, Trophy, Network, Bell
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useState, useEffect, useCallback } from 'react';

interface NotificationCounts {
  friendRequests: number;    // Solicitações de amizade pendentes
  newEvents: number;         // Novos eventos criados desde a última visita
  groupRequests: number;     // Solicitações de entrada em grupo pendentes
  rankingChange: boolean;    // Houve mudança de posição no ranking recentemente
  finishedEvents: number;    // Eventos recém finalizados não vistos
  latestFinishedEventId?: string; // ID do último evento finalizado para ir direto ao resultado
}

const LAST_SEEN_EVENTS_KEY = 'goplay_last_seen_events';

export default function Header() {
  const navigate = useNavigate();
  const location = useLocation();
  const [userName, setUserName] = useState<string>('');
  const [userAvatar, setUserAvatar] = useState<string>('');
  const [userModalidades, setUserModalidades] = useState<string>('');
  const [userRating, setUserRating] = useState<number | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string>('');

  // Notificações
  const [notifs, setNotifs] = useState<NotificationCounts>({
    friendRequests: 0,
    newEvents: 0,
    groupRequests: 0,
    rankingChange: false,
    finishedEvents: 0,
  });
  const [showNotifPanel, setShowNotifPanel] = useState(false);

  const totalNotifs =
    notifs.friendRequests + notifs.newEvents + notifs.groupRequests + (notifs.rankingChange ? 1 : 0) + notifs.finishedEvents;

  useEffect(() => {
    async function getProfile() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data, error } = await supabase
          .from('usuarios')
          .select('id, nome, foto')
          .eq('email', user.email)
          .single();

        if (data && !error) {
          setUserName(data.nome);
          setUserAvatar(data.foto || '');
          setCurrentUserId(data.id);
          await fetchUserStats(data.nome, data.id);
          fetchNotifications(data.id);
        } else {
          const name = user.user_metadata?.nome || user.email?.split('@')[0] || 'Jogador';
          setUserName(name);
          await fetchUserStats(name, '');
        }
      }
    }
    getProfile();
  }, [location.pathname]);

  // Re-fetch notificações ao fechar o drawer (usuário pode ter visitado as telas)
  useEffect(() => {
    if (!drawerOpen && currentUserId) {
      fetchNotifications(currentUserId);
    }
  }, [drawerOpen]);

  const fetchNotifications = useCallback(async (userId: string) => {
    if (!userId) return;
    try {
      // 1. Solicitações de amizade pendentes (pedidos que outros fizeram para mim)
      const { count: friendCount } = await supabase
        .from('amigos')
        .select('id', { count: 'exact', head: true })
        .eq('amigo_id', userId)
        .eq('ativo', false);

      // 2. Novos eventos criados desde a última visita do usuário
      const lastSeenStr = localStorage.getItem(LAST_SEEN_EVENTS_KEY);
      const lastSeen = lastSeenStr ? new Date(lastSeenStr).toISOString() : null;

      let newEventsCount = 0;
      if (lastSeen) {
        // Buscar grupos do usuário para filtrar eventos relevantes
        const { data: myMemberships } = await supabase
          .from('membros_grupo')
          .select('grupo_id')
          .eq('usuario_id', userId)
          .eq('status', 'aprovado');

        const myGrupoIds = (myMemberships || []).map((m: any) => m.grupo_id);

        if (myGrupoIds.length > 0) {
          const { count: evCount } = await supabase
            .from('eventos')
            .select('id', { count: 'exact', head: true })
            .in('grupo_id', myGrupoIds)
            .neq('usuario_id', userId) // Não contar eventos que EU criei
            .gt('created_at', lastSeen);

          newEventsCount = evCount || 0;
        }
      } else {
        // Primeira vez: marcar agora como "visto"
        localStorage.setItem(LAST_SEEN_EVENTS_KEY, new Date().toISOString());
      }

      // 3. Solicitações de entrada em grupos que eu administro
      const { data: myAdminGroups } = await supabase
        .from('membros_grupo')
        .select('grupo_id')
        .eq('usuario_id', userId)
        .eq('tipo_perfil', 'A')
        .eq('status', 'aprovado');

      let groupRequestsCount = 0;
      if (myAdminGroups && myAdminGroups.length > 0) {
        const adminGrupoIds = myAdminGroups.map((g: any) => g.grupo_id);
        const { count: grpCount } = await supabase
          .from('membros_grupo')
          .select('id', { count: 'exact', head: true })
          .in('grupo_id', adminGrupoIds)
          .eq('status', 'pendente');
        groupRequestsCount = grpCount || 0;
      }

      // 4. Mudança de ranking: comparar posição atual vs. última salva
      let rankingChanged = false;
      const lastRankKey = `goplay_last_rank_${userId}`;
      const lastRankStr = localStorage.getItem(lastRankKey);

      if (lastRankStr) {
        const lastRank = parseInt(lastRankStr, 10);
        // Buscar posição atual no maior grupo do usuário
        const { data: myMbs } = await supabase
          .from('membros_grupo')
          .select('grupo_id')
          .eq('usuario_id', userId)
          .eq('status', 'aprovado')
          .limit(1);

        if (myMbs && myMbs.length > 0) {
          const gid = myMbs[0].grupo_id;
          const { data: rankings } = await supabase
            .from('ratings_jogador')
            .select('usuario_id, rating')
            .eq('grupo_id', gid)
            .order('rating', { ascending: false });

          if (rankings) {
            const currentPos = rankings.findIndex((r: any) => r.usuario_id === userId) + 1;
            if (currentPos > 0 && currentPos !== lastRank) {
              rankingChanged = true;
              localStorage.setItem(lastRankKey, String(currentPos));
            }
          }
        }
      } else {
        // Salvar posição inicial para próxima comparação
        const { data: myMbs } = await supabase
          .from('membros_grupo')
          .select('grupo_id')
          .eq('usuario_id', userId)
          .eq('status', 'aprovado')
          .limit(1);

        if (myMbs && myMbs.length > 0) {
          const gid = myMbs[0].grupo_id;
          const { data: rankings } = await supabase
            .from('ratings_jogador')
            .select('usuario_id')
            .eq('grupo_id', gid)
            .order('rating', { ascending: false });

          if (rankings) {
            const pos = rankings.findIndex((r: any) => r.usuario_id === userId) + 1;
            if (pos > 0) localStorage.setItem(lastRankKey, String(pos));
          }
        }
      }

      // 5. Eventos encerrados recentemente onde o usuário participou
      let finishedEventsCount = 0;
      let latestFinishedId: string | undefined = undefined;

      const lastSeenFinishedKey = `goplay_last_seen_finished_${userId}`;
      const lastSeenFinishedStr = localStorage.getItem(lastSeenFinishedKey);
      const lastSeenFinished = lastSeenFinishedStr ? new Date(lastSeenFinishedStr).toISOString() : null;

      if (lastSeenFinished) {
        const { data: allFinished } = await supabase
          .from('eventos')
          .select('id, participantes, configuracao, created_at')
          .neq('usuario_id', userId); // Eventos que outros encerraram

        if (allFinished) {
          const userFinishedEvents = allFinished.filter((ev: any) => {
            if (!ev.configuracao?.finalizado) return false;
            const ultimoSorteio = ev.configuracao?.ultimo_sorteio;
            // Checar se foi finalizado após o último visto
            const ts = ultimoSorteio?.timestamp || ev.created_at;
            if (ts && new Date(ts) <= new Date(lastSeenFinished)) return false;

            // Checar se o usuário participa deste evento
            return Array.isArray(ev.participantes) && ev.participantes.some((p: any) => p.id === userId);
          });
          finishedEventsCount = userFinishedEvents.length;
          if (userFinishedEvents.length > 0) {
            latestFinishedId = userFinishedEvents[0].id;
          }
        }
      } else {
        localStorage.setItem(lastSeenFinishedKey, new Date().toISOString());
      }

      setNotifs({
        friendRequests: friendCount || 0,
        newEvents: newEventsCount,
        groupRequests: groupRequestsCount,
        rankingChange: rankingChanged,
        finishedEvents: finishedEventsCount,
        latestFinishedEventId: latestFinishedId,
      });
    } catch (e) {
      console.error('Erro ao buscar notificações:', e);
    }
  }, []);

  const markEventsSeen = () => {
    localStorage.setItem(LAST_SEEN_EVENTS_KEY, new Date().toISOString());
    setNotifs(prev => ({ ...prev, newEvents: 0 }));
  };

  const markRankingSeen = () => {
    if (currentUserId) {
      localStorage.removeItem(`goplay_last_rank_${currentUserId}`);
    }
    setNotifs(prev => ({ ...prev, rankingChange: false }));
  };

  const fetchUserStats = async (name: string, uid: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: userData } = await supabase
        .from('usuarios')
        .select('id')
        .eq('email', user.email)
        .single();

      if (!userData) return;

      const { data: dbRatings } = await supabase
        .from('ratings_jogador')
        .select('rating, modalidade_id, modalidades:modalidade_id ( nome )')
        .eq('usuario_id', userData.id);

      const { data: events } = await supabase
        .from('eventos')
        .select('participantes, modalidades:modalidade_id ( nome )');

      const sports = new Set<string>();
      let totalRatingSum = 0;
      let ratingCount = 0;

      if (dbRatings && dbRatings.length > 0) {
        dbRatings.forEach((r: any) => {
          if (r.rating !== null) { totalRatingSum += Number(r.rating); ratingCount++; }
          const sportName = r.modalidades?.nome;
          if (sportName) sports.add(sportName);
        });
      }

      if (events) {
        events.forEach((event: any) => {
          if (Array.isArray(event.participantes)) {
            const p = event.participantes.find(
              (part: any) => part.nome?.trim().toLowerCase() === name.trim().toLowerCase()
            );
            if (p) {
              const sportName = event.modalidades?.nome;
              if (sportName) sports.add(sportName);
              if (!dbRatings || dbRatings.length === 0) {
                if (typeof p.avaliacao === 'number') { totalRatingSum += p.avaliacao; ratingCount++; }
              }
            }
          }
        });
      }

      setUserRating(ratingCount > 0 ? totalRatingSum / ratingCount : null);
      setUserModalidades(Array.from(sports).join(', '));
    } catch (e) {
      console.error('Erro ao buscar estatísticas do jogador no header:', e);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/login');
  };

  const showSidebar =
    location.pathname === '/' ||
    location.pathname === '/eventos' ||
    location.pathname === '/grupos' ||
    location.pathname === '/ranking' ||
    location.pathname === '/amigos' ||
    location.pathname === '/comunidades';

  if (!showSidebar) return null;

  // ─── Nav items com contadores de notificação ───────────────────────────
  const navItems = [
    { to: '/', icon: HomeIcon, label: 'Home', badge: 0 },
    { to: '/amigos', icon: UserPlus, label: 'Amigos', badge: notifs.friendRequests },
    { to: '/eventos', icon: Calendar, label: 'Eventos', badge: notifs.newEvents, onClickExtra: markEventsSeen },
    { to: '/torneios', icon: Trophy, label: 'Torneios', badge: 0 },
    { to: '/grupos', icon: Users, label: 'Grupos', badge: notifs.groupRequests },
    { to: '/comunidades', icon: Network, label: 'Comunidades', badge: 0 },
    { to: '/ranking', icon: Trophy, label: 'Ranking', badge: notifs.rankingChange ? 1 : 0, onClickExtra: markRankingSeen },
    { to: '/profile', icon: User, label: 'Meu Perfil', badge: 0 },
  ];

  return (
    <>
      {/* Drawer Container */}
      <div
        className={`fixed top-0 bottom-16 left-0 z-50 flex transition-transform duration-300 ease-out transform ${
          drawerOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Drawer Panel */}
        <div className="relative flex flex-col w-64 max-w-xs bg-white h-full shadow-2xl border-r border-slate-100 rounded-br-2xl">

          {/* Toggle Button — visível só com drawer fechado */}
          {!drawerOpen && (
            <button
              onClick={() => setDrawerOpen(true)}
              className="absolute left-full top-6 ml-3 p-2.5 bg-[#eb3237] hover:bg-red-650 text-white rounded-xl shadow-lg cursor-pointer transition-all duration-300 flex items-center justify-center border border-red-500/10 focus:outline-none"
              title="Abrir Menu"
            >
              <Menu size={20} />
              {/* Badge de notificação no botão do menu */}
              {totalNotifs > 0 && (
                <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] bg-amber-400 text-white text-[9px] font-black rounded-full flex items-center justify-center px-1 shadow-md animate-bounce">
                  {totalNotifs > 9 ? '9+' : totalNotifs}
                </span>
              )}
            </button>
          )}

          {/* Header: Logo + Perfil + Sino */}
          <div className="p-4 border-b border-slate-150 flex items-center gap-3 bg-slate-50">
            <img src="/goplay.png" alt="GoPlay Logo" className="h-10 w-auto object-contain rounded-xl flex-shrink-0" />
            <div className="h-8 w-[1px] bg-slate-200 flex-shrink-0" />

            {/* Avatar + Nome */}
            <button
              onClick={() => { setDrawerOpen(false); navigate('/profile'); }}
              className="flex items-center gap-2 flex-1 min-w-0 text-left hover:opacity-80 active:scale-95 transition-all cursor-pointer focus:outline-none"
              title="Meu Perfil"
            >
              {userAvatar ? (
                <img src={userAvatar} alt={userName} className="w-8 h-8 rounded-full object-cover ring-2 ring-red-500/20 flex-shrink-0" />
              ) : (
                <div className="w-8 h-8 rounded-full bg-[#eb3237] text-white flex items-center justify-center font-bold text-xs ring-2 ring-red-500/20 flex-shrink-0">
                  <User size={12} />
                </div>
              )}
              <div className="flex flex-col min-w-0 flex-1">
                <span className="font-bold text-slate-800 text-[11px] leading-tight line-clamp-1">{userName}</span>
                <div className="flex items-center gap-1.5 mt-0.5 min-w-0" title={userModalidades}>
                  <span className="text-[8px] font-bold text-red-500 uppercase tracking-wider truncate flex-1">
                    {userModalidades || 'Jogador'}
                  </span>
                  {userModalidades && userRating !== null && (
                    <span className="text-[8px] font-black text-amber-500 tracking-normal shrink-0">
                      {'★'.repeat(Math.min(5, Math.max(0, Math.round(userRating))))}
                      <span className="text-slate-350 font-normal">
                        {'☆'.repeat(5 - Math.min(5, Math.max(0, Math.round(userRating))))}
                      </span>
                    </span>
                  )}
                </div>
              </div>
            </button>

            {/* Sino de Notificações */}
            <button
              onClick={() => setShowNotifPanel(p => !p)}
              className="relative p-1.5 rounded-xl hover:bg-slate-100 text-slate-500 transition-all flex-shrink-0"
              title="Notificações"
            >
              <Bell size={16} className={totalNotifs > 0 ? 'text-amber-500' : 'text-slate-400'} />
              {totalNotifs > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[14px] h-[14px] bg-[#eb3237] text-white text-[8px] font-black rounded-full flex items-center justify-center px-0.5 shadow-sm">
                  {totalNotifs > 9 ? '9+' : totalNotifs}
                </span>
              )}
            </button>
          </div>

          {/* Painel de Notificações (expansível dentro do drawer) */}
          {showNotifPanel && (
            <div className="border-b border-slate-100 bg-amber-50/60 px-4 py-3 space-y-2">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 flex items-center gap-1">
                  <Bell size={10} className="text-amber-400" /> Notificações
                </span>
                <button onClick={() => setShowNotifPanel(false)} className="p-0.5 rounded text-slate-400 hover:text-slate-700">
                  <X size={12} />
                </button>
              </div>

              {totalNotifs === 0 ? (
                <p className="text-xs text-slate-400 text-center py-1">Tudo em dia! ✓</p>
              ) : (
                <div className="space-y-1.5">
                  {notifs.friendRequests > 0 && (
                    <button
                      onClick={() => { setShowNotifPanel(false); setDrawerOpen(false); navigate('/amigos'); }}
                      className="w-full flex items-center gap-2.5 p-2 bg-white rounded-xl border border-amber-200 hover:border-amber-400 transition-all text-left"
                    >
                      <div className="w-7 h-7 rounded-lg bg-violet-100 flex items-center justify-center flex-shrink-0">
                        <UserPlus size={13} className="text-violet-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] font-bold text-slate-700">Solicitação de Amizade</p>
                        <p className="text-[10px] text-slate-500">{notifs.friendRequests} pedido{notifs.friendRequests > 1 ? 's' : ''} pendente{notifs.friendRequests > 1 ? 's' : ''}</p>
                      </div>
                      <span className="flex-shrink-0 w-5 h-5 rounded-full bg-violet-500 text-white text-[9px] font-black flex items-center justify-center">
                        {notifs.friendRequests}
                      </span>
                    </button>
                  )}

                  {notifs.newEvents > 0 && (
                    <button
                      onClick={() => { setShowNotifPanel(false); setDrawerOpen(false); markEventsSeen(); navigate('/eventos'); }}
                      className="w-full flex items-center gap-2.5 p-2 bg-white rounded-xl border border-amber-200 hover:border-amber-400 transition-all text-left"
                    >
                      <div className="w-7 h-7 rounded-lg bg-red-100 flex items-center justify-center flex-shrink-0">
                        <Calendar size={13} className="text-red-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] font-bold text-slate-700">Novos Eventos</p>
                        <p className="text-[10px] text-slate-500">{notifs.newEvents} evento{notifs.newEvents > 1 ? 's' : ''} novo{notifs.newEvents > 1 ? 's' : ''} no seu grupo</p>
                      </div>
                      <span className="flex-shrink-0 w-5 h-5 rounded-full bg-red-500 text-white text-[9px] font-black flex items-center justify-center">
                        {notifs.newEvents}
                      </span>
                    </button>
                  )}

                  {notifs.groupRequests > 0 && (
                    <button
                      onClick={() => { setShowNotifPanel(false); setDrawerOpen(false); navigate('/grupos'); }}
                      className="w-full flex items-center gap-2.5 p-2 bg-white rounded-xl border border-amber-200 hover:border-amber-400 transition-all text-left"
                    >
                      <div className="w-7 h-7 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
                        <Users size={13} className="text-blue-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] font-bold text-slate-700">Solicitação de Grupo</p>
                        <p className="text-[10px] text-slate-500">{notifs.groupRequests} pedido{notifs.groupRequests > 1 ? 's' : ''} de acesso</p>
                      </div>
                      <span className="flex-shrink-0 w-5 h-5 rounded-full bg-blue-500 text-white text-[9px] font-black flex items-center justify-center">
                        {notifs.groupRequests}
                      </span>
                    </button>
                  )}

                  {notifs.finishedEvents > 0 && (
                    <button
                      onClick={() => {
                        const targetId = notifs.latestFinishedEventId;
                        setShowNotifPanel(false);
                        setDrawerOpen(false);
                        if (currentUserId) localStorage.setItem(`goplay_last_seen_finished_${currentUserId}`, new Date().toISOString());
                        setNotifs(prev => ({ ...prev, finishedEvents: 0 }));
                        if (targetId) {
                          navigate(`/eventos/${targetId}?show_result=true`);
                        } else {
                          navigate('/eventos');
                        }
                      }}
                      className="w-full flex items-center gap-2.5 p-2 bg-white rounded-xl border border-emerald-200 hover:border-emerald-400 transition-all text-left cursor-pointer"
                    >
                      <div className="w-7 h-7 rounded-lg bg-emerald-100 flex items-center justify-center flex-shrink-0">
                        <Trophy size={13} className="text-emerald-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] font-bold text-slate-700">Evento Encerrado!</p>
                        <p className="text-[10px] text-slate-500">Confira a classificação e pódio final</p>
                      </div>
                      <span className="flex-shrink-0 w-5 h-5 rounded-full bg-emerald-500 text-white text-[9px] font-black flex items-center justify-center">
                        {notifs.finishedEvents}
                      </span>
                    </button>
                  )}

                  {notifs.rankingChange && (
                    <button
                      onClick={() => { setShowNotifPanel(false); setDrawerOpen(false); markRankingSeen(); navigate('/ranking'); }}
                      className="w-full flex items-center gap-2.5 p-2 bg-white rounded-xl border border-amber-200 hover:border-amber-400 transition-all text-left"
                    >
                      <div className="w-7 h-7 rounded-lg bg-amber-100 flex items-center justify-center flex-shrink-0">
                        <Trophy size={13} className="text-amber-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] font-bold text-slate-700">Ranking Atualizado</p>
                        <p className="text-[10px] text-slate-500">Sua posição no grupo mudou!</p>
                      </div>
                      <span className="flex-shrink-0 w-5 h-5 rounded-full bg-amber-400 text-white text-[9px] font-black flex items-center justify-center">!</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Navigation links */}
          <div className="flex-1 py-4 px-3 space-y-0.5 overflow-y-auto">
            {navItems.map(({ to, icon: Icon, label, badge, onClickExtra }) => {
              const isActive = to === '/'
                ? location.pathname === '/'
                : location.pathname.startsWith(to);

              return (
                <Link
                  key={to}
                  to={to}
                  onClick={() => {
                    setDrawerOpen(false);
                    setShowNotifPanel(false);
                    onClickExtra?.();
                  }}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all relative ${
                    isActive
                      ? 'bg-[#eb3237]/10 text-[#eb3237] font-bold'
                      : 'text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {isActive && (
                    <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-[#eb3237] rounded-r-full" />
                  )}
                  <Icon size={18} className={isActive ? 'text-[#eb3237]' : 'text-slate-500'} />
                  <span className="flex-1">{label}</span>
                  {badge > 0 && (
                    <span className="min-w-[20px] h-5 bg-[#eb3237] text-white text-[9px] font-black rounded-full flex items-center justify-center px-1.5 shadow-sm shadow-red-500/20">
                      {badge > 9 ? '9+' : badge}
                    </span>
                  )}
                  {label === 'Ranking' && notifs.rankingChange && badge === 0 && (
                    <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                  )}
                </Link>
              );
            })}
          </div>

          {/* Bottom: Logout */}
          <div className="p-4 border-t border-slate-150 bg-slate-50">
            <button
              onClick={() => { setDrawerOpen(false); handleLogout(); }}
              className="w-full flex items-center gap-3 px-3 py-2.5 text-red-650 hover:bg-red-55 rounded-xl font-medium transition-colors cursor-pointer text-xs"
            >
              <LogOut size={16} />
              <span>Sair</span>
            </button>
          </div>
        </div>
      </div>

      {/* Backdrop */}
      {drawerOpen && (
        <div
          className="fixed inset-0 bg-black/30 backdrop-blur-xs z-40 transition-opacity duration-300"
          onClick={() => setDrawerOpen(false)}
        />
      )}
    </>
  );
}
