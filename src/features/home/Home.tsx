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
    { label: 'Sorteio', icon: Sparkles, path: '/eventos', color: 'text-pink-500 bg-pink-50' },
    { label: 'Jogo', icon: PlayCircle, path: '/eventos', color: 'text-indigo-500 bg-indigo-50' },
  ];

  return (
    <div className="flex flex-col items-center p-6 w-full max-w-md mx-auto bg-white min-h-[calc(100vh-4rem)]">
      {/* Logo GoPlay Centralizada */}
      <div className="flex flex-col items-center justify-center my-6">
        <img 
          src="/goplay.png" 
          alt="GoPlay Logo" 
          className="w-32 h-32 object-contain rounded-2xl drop-shadow-md" 
        />
      </div>

      {/* Grid de Cards de Opções */}
      <div className="grid grid-cols-2 gap-4 w-full mt-4">
        {cards.map((card, idx) => {
          const Icon = card.icon;
          return (
            <button
              key={idx}
              onClick={() => navigate(card.path)}
              className="flex flex-col items-center justify-center p-5 bg-slate-50 border border-slate-100 hover:border-red-500/20 rounded-2xl active:scale-[0.98] transition-all duration-200 shadow-sm hover:shadow-md cursor-pointer group"
            >
              <div className={`p-3 rounded-2xl ${card.color} mb-3 group-hover:scale-110 transition-transform`}>
                <Icon size={24} strokeWidth={2} />
              </div>
              <span className="text-sm font-semibold text-slate-800 tracking-wide">
                {card.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
