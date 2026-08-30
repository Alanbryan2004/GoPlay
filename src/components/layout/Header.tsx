import { Link, useNavigate, useLocation } from 'react-router-dom';
import { User, LogOut, Menu, Users, Calendar, X, Home as HomeIcon } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useState, useEffect } from 'react';

export default function Header() {
  const navigate = useNavigate();
  const location = useLocation();
  const [userName, setUserName] = useState<string>('');
  const [userAvatar, setUserAvatar] = useState<string>('');
  const [userModalidades, setUserModalidades] = useState<string>('');
  const [userRating, setUserRating] = useState<number | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    async function getProfile() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        // Query profile from database
        const { data, error } = await supabase
          .from('usuarios')
          .select('nome, foto')
          .eq('email', user.email)
          .single();

        if (data && !error) {
          setUserName(data.nome);
          setUserAvatar(data.foto || '');
          await fetchUserStats(data.nome);
        } else {
          const name = user.user_metadata?.nome || user.email?.split('@')[0] || 'Jogador';
          setUserName(name);
          await fetchUserStats(name);
        }
      }
    }
    getProfile();
  }, [location.pathname]);

  const fetchUserStats = async (name: string) => {
    try {
      // 1. Obter o ID do usuário logado
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: userData } = await supabase
        .from('usuarios')
        .select('id')
        .eq('email', user.email)
        .single();
      
      if (!userData) return;

      // 2. Buscar os ratings desse jogador em todos os grupos/modalidades
      const { data: dbRatings } = await supabase
        .from('ratings_jogador')
        .select('rating, modalidade_id, modalidades:modalidade_id ( nome )')
        .eq('usuario_id', userData.id);

      // 3. Buscar os eventos (para retrocompatibilidade/fallback de modalidades)
      const { data: events } = await supabase
        .from('eventos')
        .select(`
          participantes,
          modalidades:modalidade_id (
            nome
          )
        `);

      const sports = new Set<string>();
      let totalRatingSum = 0;
      let ratingCount = 0;

      // Adicionar as modalidades e ratings do ratings_jogador
      if (dbRatings && dbRatings.length > 0) {
        dbRatings.forEach((r: any) => {
          if (r.rating !== null) {
            totalRatingSum += Number(r.rating);
            ratingCount++;
          }
          const sportName = r.modalidades?.nome;
          if (sportName) {
            sports.add(sportName);
          }
        });
      }

      // Buscar também modalidades de eventos antigos em que ele participou (para retrocompatibilidade)
      if (events) {
        events.forEach((event: any) => {
          if (Array.isArray(event.participantes)) {
            const p = event.participantes.find(
              (part: any) => part.nome?.trim().toLowerCase() === name.trim().toLowerCase()
            );
            if (p) {
              const sportName = event.modalidades?.nome;
              if (sportName) {
                sports.add(sportName);
              }
              // Se ratings_jogador estava vazio, vamos preencher usando os eventos
              if (!dbRatings || dbRatings.length === 0) {
                if (typeof p.avaliacao === 'number') {
                  totalRatingSum += p.avaliacao;
                  ratingCount++;
                }
              }
            }
          }
        });
      }

      const avg = ratingCount > 0 ? totalRatingSum / ratingCount : null;
      setUserRating(avg);

      const sportsList = Array.from(sports).join(', ');
      setUserModalidades(sportsList);
    } catch (e) {
      console.error('Erro ao buscar estatísticas do jogador no header:', e);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/login');
  };

  // Exibir a Sidebar apenas nas rotas principais do menu
  const showSidebar = 
    location.pathname === '/' ||
    location.pathname === '/eventos' ||
    location.pathname === '/grupos' ||
    location.pathname === '/ranking' ||
    location.pathname === '/amigos';

  if (!showSidebar) return null;

  return (
    <>
      {/* Container principal do Drawer (Sidebar) */}
      <div 
        className={`fixed top-0 bottom-16 left-0 z-50 flex transition-transform duration-300 ease-out transform ${
          drawerOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Drawer Panel */}
        <div className="relative flex flex-col w-64 max-w-xs bg-white h-full shadow-2xl border-r border-slate-100 rounded-br-2xl">
          
          {/* Botão de Toggle Alça/Flutuante - só fica visível quando o drawer está FECHADO */}
          {!drawerOpen && (
            <button
              onClick={() => setDrawerOpen(true)}
              className="absolute left-full top-6 ml-3 p-2.5 bg-[#eb3237] hover:bg-red-650 text-white rounded-xl shadow-lg cursor-pointer transition-all duration-300 flex items-center justify-center border border-red-500/10 focus:outline-none"
              title="Abrir Menu"
            >
              <Menu size={20} />
            </button>
          )}

          {/* Header da Sidebar: Logo + Dados do Usuário */}
          <div className="p-4 border-b border-slate-150 flex items-center gap-3 bg-slate-50">
            {/* Logo do App */}
            <img src="/goplay.png" alt="GoPlay Logo" className="h-10 w-auto object-contain rounded-xl flex-shrink-0" />
            
            {/* Divisor vertical sutil */}
            <div className="h-8 w-[1px] bg-slate-200 flex-shrink-0" />

            {/* Dados do Usuário */}
            <button
              onClick={() => {
                setDrawerOpen(false);
                navigate('/profile');
              }}
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
          </div>

          {/* Navigation links */}
          <div className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
            <Link 
              to="/" 
              onClick={() => setDrawerOpen(false)}
              className="flex items-center gap-3 px-4 py-3 text-slate-700 hover:bg-slate-50 rounded-xl font-medium transition-colors"
            >
              <HomeIcon size={18} className="text-slate-500" />
              <span>Home</span>
            </Link>
            <Link 
              to="/eventos" 
              onClick={() => setDrawerOpen(false)}
              className="flex items-center gap-3 px-4 py-3 text-slate-700 hover:bg-slate-50 rounded-xl font-medium transition-colors"
            >
              <Calendar size={18} className="text-slate-500" />
              <span>Eventos</span>
            </Link>
            <Link 
              to="/grupos" 
              onClick={() => setDrawerOpen(false)}
              className="flex items-center gap-3 px-4 py-3 text-slate-700 hover:bg-slate-50 rounded-xl font-medium transition-colors"
            >
              <Users size={18} className="text-slate-500" />
              <span>Grupos</span>
            </Link>
            <Link 
              to="/grupos" 
              onClick={() => setDrawerOpen(false)}
              className="flex items-center gap-3 px-4 py-3 text-slate-700 hover:bg-slate-50 rounded-xl font-medium transition-colors"
            >
              <Users size={18} className="text-slate-500" />
              <span>Comunidades</span>
            </Link>
            <Link 
              to="/profile" 
              onClick={() => setDrawerOpen(false)}
              className="flex items-center gap-3 px-4 py-3 text-slate-700 hover:bg-slate-50 rounded-xl font-medium transition-colors"
            >
              <User size={18} className="text-slate-500" />
              <span>Meu Perfil</span>
            </Link>
          </div>

          {/* Bottom section: Only Logout button */}
          <div className="p-4 border-t border-slate-150 bg-slate-50">
            <button
              onClick={() => {
                setDrawerOpen(false);
                handleLogout();
              }}
              className="w-full flex items-center gap-3 px-3 py-2.5 text-red-650 hover:bg-red-55 rounded-xl font-medium transition-colors cursor-pointer text-xs"
            >
              <LogOut size={16} />
              <span>Sair</span>
            </button>
          </div>
        </div>
      </div>

      {/* Backdrop (Escurecimento da tela ao abrir o menu) */}
      {drawerOpen && (
        <div 
          className="fixed inset-0 bg-black/30 backdrop-blur-xs z-40 transition-opacity duration-300"
          onClick={() => setDrawerOpen(false)}
        />
      )}
    </>
  );
}
