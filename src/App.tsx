import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuth } from './hooks/useAuth';
import VersionGuard from './components/common/VersionGuard';

// Layout Components
import Header from './components/layout/Header';
import BottomNavigation from './components/layout/BottomNavigation';

// Auth Pages
import Login from './features/auth/Login';
import Profile from './features/auth/Profile';

// Eventos Pages
import EventosList from './features/eventos/EventosList';
import NovoEvento from './features/eventos/NovoEvento';
import EventoDetails from './features/eventos/EventoDetails';
import SorteioQuick from './features/eventos/SorteioQuick';

// Other Feature Pages
import GruposList from './features/grupos/GruposList';
import GrupoConfiguracoes from './features/grupos/GrupoConfiguracoes';
import RankingList from './features/ranking/RankingList';
import AmigosList from './features/amigos/AmigosList';
import MensagensPage from './features/mensagens/MensagensPage';
import Home from './features/home/Home';
import ComunidadesList from './features/comunidades/ComunidadesList';
import ComunidadeDetails from './features/comunidades/ComunidadeDetails';
import TorneiosList from './features/torneios/TorneiosList';
import NovoTorneio from './features/torneios/NovoTorneio';
import TorneioDetails from './features/torneios/TorneioDetails';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

function AppContent() {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex flex-col justify-center items-center min-h-screen bg-slate-950 text-slate-100">
        <div className="w-10 h-10 border-4 border-red-600 border-t-transparent rounded-full animate-spin mb-4" />
        <span className="text-sm font-semibold tracking-wide text-slate-400">Carregando o GoPlay...</span>
      </div>
    );
  }

  const isAuthRoute = location.pathname === '/login';

  if (!user && !isAuthRoute) {
    return <Navigate to="/login" replace />;
  }

  if (user && isAuthRoute) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="w-full max-w-md mx-auto min-h-screen bg-white text-slate-900 border-x border-slate-100 shadow-2xl flex flex-col relative pb-16">
      {/* Verificador de nova versão — recarrega automaticamente quando há deploy novo */}
      <VersionGuard />
      {/* Exibir Header em todas as rotas logadas */}
      {!isAuthRoute && <Header />}
      
      <main className="flex-1 overflow-y-auto pt-2">
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<Home />} />
          
          <Route path="/eventos" element={<EventosList />} />
          <Route path="/eventos/novo" element={<NovoEvento />} />
          <Route path="/eventos/:id" element={<EventoDetails />} />
          <Route path="/sorteio" element={<SorteioQuick />} />
          
          <Route path="/grupos" element={<GruposList />} />
          <Route path="/grupos/:id/configuracoes" element={<GrupoConfiguracoes />} />
          <Route path="/ranking" element={<RankingList />} />
          <Route path="/amigos" element={<AmigosList />} />
          <Route path="/mensagens" element={<MensagensPage />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/comunidades" element={<ComunidadesList />} />
          <Route path="/comunidades/:id" element={<ComunidadeDetails />} />

          {/* Rotas de Torneios */}
          <Route path="/torneios" element={<TorneiosList />} />
          <Route path="/torneios/novo" element={<NovoTorneio />} />
          <Route path="/torneios/:id" element={<TorneioDetails />} />
          
          {/* Rota Fallback */}
          <Route path="*" element={<Navigate to={user ? "/" : "/login"} replace />} />
        </Routes>
      </main>

      {/* Exibir Navegação Inferior apenas em rotas logadas */}
      {!isAuthRoute && <BottomNavigation />}
    </div>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        <AppContent />
      </Router>
    </QueryClientProvider>
  );
}
