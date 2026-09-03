import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar, Users, Trophy, UserPlus, ToggleRight, Sparkles, Network, HelpCircle, BookOpen } from 'lucide-react';
import TutorialModal from '../../components/common/TutorialModal';

export default function Home() {
  const navigate = useNavigate();
  const [showTutorial, setShowTutorial] = useState(false);
  const [isFirstVisit, setIsFirstVisit] = useState(false);

  useEffect(() => {
    const seen = localStorage.getItem('goplay_tutorial_seen');
    if (!seen) {
      setIsFirstVisit(true);
    }

    const handleOpenTutorial = () => setShowTutorial(true);
    window.addEventListener('goplay:open-tutorial', handleOpenTutorial);
    return () => window.removeEventListener('goplay:open-tutorial', handleOpenTutorial);
  }, []);

  const cards = [
    { label: 'Eventos', icon: Calendar, path: '/eventos', color: 'text-red-500 bg-red-50' },
    { label: 'Grupos', icon: Users, path: '/grupos', color: 'text-blue-500 bg-blue-50' },
    { label: 'Comunidades', icon: Network, path: '/comunidades', color: 'text-emerald-500 bg-emerald-50' },
    { label: 'Ranking', icon: Trophy, path: '/ranking', color: 'text-amber-500 bg-amber-50' },
    { label: 'Amigos', icon: UserPlus, path: '/amigos', color: 'text-violet-500 bg-violet-50' },
    { label: 'Placar', icon: ToggleRight, path: '/eventos', color: 'text-cyan-500 bg-cyan-50' },
    { label: 'Sorteio', icon: Sparkles, path: '/sorteio', color: 'text-pink-500 bg-pink-50' },
    { label: 'Torneio', icon: Trophy, path: '/torneios', color: 'text-amber-600 bg-amber-100/60' },
  ];

  return (
    <div className="flex flex-col items-center px-4 pt-4 pb-6 w-full max-w-md mx-auto bg-white min-h-[calc(100dvh-4rem)] justify-around">
      {/* Logo GoPlay no topo e super clean */}
      <div className="flex flex-col items-center justify-center my-1.5 space-y-2">
        <img 
          src="/goplay.png" 
          alt="GoPlay Logo" 
          className="w-18 h-18 object-contain rounded-xl drop-shadow-sm" 
        />

        {/* Banner de Boas-Vindas para Novos Usuários */}
        {isFirstVisit && (
          <button
            onClick={() => setShowTutorial(true)}
            className="flex items-center gap-2 px-3.5 py-1.5 bg-gradient-to-r from-red-500/10 via-amber-500/10 to-red-500/10 border border-red-300 text-red-700 rounded-full text-xs font-bold shadow-xs active:scale-95 transition-all cursor-pointer animate-pulse"
          >
            <Sparkles size={13} className="text-red-500" />
            <span>Primeira vez aqui? Veja o Guia do GoPlay!</span>
          </button>
        )}
      </div>

      {/* Grid de Cards de Opções Ampliados e Ajustados */}
      <div className="grid grid-cols-2 gap-3.5 w-full">
        {cards.map((card, idx) => {
          const Icon = card.icon;
          return (
            <button
              key={idx}
              onClick={() => navigate(card.path)}
              className="flex flex-col items-center justify-center p-4 bg-slate-50 border border-slate-100 hover:border-red-500/20 rounded-2xl active:scale-[0.98] transition-all duration-200 shadow-sm hover:shadow-md cursor-pointer group"
            >
              <div className={`p-2.5 rounded-2xl ${card.color} mb-2 group-hover:scale-105 transition-transform`}>
                <Icon size={22} strokeWidth={2.2} />
              </div>
              <span className="text-xs font-bold text-slate-800 tracking-wide">
                {card.label}
              </span>
            </button>
          );
        })}
      </div>

      {/* Botão Inferior: Como Usar / Tutorial */}
      <div className="w-full pt-2">
        <button
          type="button"
          onClick={() => setShowTutorial(true)}
          className="w-full py-2.5 px-4 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-2xl flex items-center justify-center gap-2 text-xs font-bold text-slate-600 active:scale-98 transition-all cursor-pointer shadow-xs"
        >
          <BookOpen size={15} className="text-red-500" />
          <span>Como Funciona o GoPlay (Tutorial)</span>
        </button>
      </div>

      {/* Modal Interativo do Tutorial */}
      <TutorialModal
        isOpen={showTutorial}
        onClose={() => {
          setShowTutorial(false);
          setIsFirstVisit(false);
        }}
      />
    </div>
  );
}
