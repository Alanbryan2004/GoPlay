import { useNavigate } from 'react-router-dom';
import { Calendar, Users, Trophy, UserPlus, PlayCircle, ToggleRight, Sparkles } from 'lucide-react';

export default function Home() {
  const navigate = useNavigate();

  const cards = [
    { label: 'Eventos', icon: Calendar, path: '/eventos', color: 'text-red-500 bg-red-50' },
    { label: 'Grupos', icon: Users, path: '/grupos', color: 'text-blue-500 bg-blue-50' },
    { label: 'Comunidades', icon: Users, path: '/grupos', color: 'text-emerald-500 bg-emerald-50' },
    { label: 'Ranking', icon: Trophy, path: '/ranking', color: 'text-amber-500 bg-amber-50' },
    { label: 'Amigos', icon: UserPlus, path: '/amigos', color: 'text-violet-500 bg-violet-50' },
    { label: 'Placar', icon: ToggleRight, path: '/eventos', color: 'text-cyan-500 bg-cyan-50' },
    { label: 'Sorteio', icon: Sparkles, path: '/sorteio', color: 'text-pink-500 bg-pink-50' },
    { label: 'Jogo', icon: PlayCircle, path: '/eventos', color: 'text-indigo-500 bg-indigo-50' },
  ];

  return (
    <div className="flex flex-col items-center px-4 pt-4 pb-6 w-full max-w-md mx-auto bg-white min-h-[calc(100dvh-4rem)] justify-around">
      {/* Logo GoPlay no topo e super clean */}
      <div className="flex flex-col items-center justify-center my-1.5">
        <img 
          src="/goplay.png" 
          alt="GoPlay Logo" 
          className="w-18 h-18 object-contain rounded-xl drop-shadow-sm" 
        />
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
    </div>
  );
}
