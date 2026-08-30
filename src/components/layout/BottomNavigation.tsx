import { Link, useLocation } from 'react-router-dom';
import { Home as HomeIcon, Trophy, PlayCircle, Sparkles } from 'lucide-react';

export default function BottomNavigation() {
  const location = useLocation();
  const currentPath = location.pathname;

  const navItems = [
    { label: 'Home', path: '/', icon: HomeIcon, exact: true },
    { label: 'Jogo', path: '/eventos', icon: PlayCircle },
    { label: 'Sorteio', path: '/sorteio', icon: Sparkles },
    { label: 'Ranking', path: '/ranking', icon: Trophy },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 h-16 w-full max-w-md mx-auto glass-nav px-6 flex justify-between items-center rounded-t-2xl shadow-xl shadow-slate-200/30">
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = item.exact 
          ? currentPath === item.path 
          : currentPath.startsWith(item.path);

        return (
          <Link
            key={item.label}
            to={item.path}
            className="flex flex-col items-center justify-center w-14 h-full relative group transition-colors duration-200"
          >
            <div
              className={`p-1.5 rounded-xl transition-all duration-300 ${
                isActive
                  ? 'bg-[#eb3237]/20 text-[#eb3237] scale-110 shadow-lg shadow-[#eb3237]/10'
                  : 'text-slate-500 hover:text-slate-800 group-hover:scale-105'
              }`}
            >
              <Icon size={20} strokeWidth={isActive ? 2.5 : 2} />
            </div>
            <span
              className={`text-[10px] mt-0.5 font-medium transition-all duration-300 ${
                isActive ? 'text-[#eb3237] font-semibold' : 'text-slate-500 group-hover:text-slate-700'
              }`}
            >
              {item.label}
            </span>
            {isActive && (
              <span className="absolute top-0 w-8 h-[3px] bg-gradient-to-r from-[#eb3237] to-rose-600 rounded-full shadow-md shadow-[#eb3237]" />
            )}
          </Link>
        );
      })}
    </nav>
  );
}
