import { useState, useEffect } from 'react';
import { Info, Code2, Sparkles, Heart, ShieldCheck, Zap, Trophy, Users, Calendar, MessageSquare, Bell, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function Sobre() {
  const navigate = useNavigate();
  const [version, setVersion] = useState<string>('Carregando...');

  useEffect(() => {
    async function loadVersion() {
      try {
        const res = await fetch(`/version.json?t=${Date.now()}`);
        if (res.ok) {
          const data = await res.json();
          if (data.version) setVersion(data.version);
        }
      } catch {
        setVersion('v2026.09.16');
      }
    }
    loadVersion();
  }, []);

  return (
    <div className="p-6 w-full max-w-md mx-auto space-y-6 pb-24">
      {/* Botão Voltar + Título */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate('/')}
          className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-all cursor-pointer"
        >
          <ArrowLeft size={18} />
        </button>
        <h1 className="text-3xl font-extrabold text-slate-900">Sobre o GoPlay</h1>
      </div>

      {/* Hero Card do Aplicativo */}
      <div className="glass p-6 rounded-3xl shadow-xl text-center space-y-4 border border-red-500/10 relative overflow-hidden bg-gradient-to-b from-red-50/50 via-white to-white">
        <div className="w-20 h-20 mx-auto rounded-2xl bg-gradient-to-br from-[#eb3237] to-red-650 flex items-center justify-center text-white shadow-lg shadow-red-600/30 p-2">
          <img src="/goplay.png" alt="GoPlay" className="w-full h-full object-contain" />
        </div>

        <div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">GoPlay 🎮</h2>
          <p className="text-xs font-semibold text-slate-500 mt-1">Conectando Atletas & Organizando Partidas</p>
        </div>

        {/* Badge da Versão Atualizada */}
        <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-red-100/80 border border-red-200 rounded-full text-red-650 text-xs font-black shadow-xs">
          <Sparkles size={14} className="animate-spin" />
          <span>Versão: {version}</span>
        </div>
      </div>

      {/* Intuito do Aplicativo */}
      <div className="glass p-5 rounded-2xl shadow-lg space-y-3 border border-slate-150">
        <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
          <Info size={16} className="text-red-600" />
          <span>Qual é o intuito do GoPlay?</span>
        </h3>
        <p className="text-xs text-slate-600 leading-relaxed font-medium">
          O <strong>GoPlay</strong> nasceu com a missão de transformar a forma como atletas amadores e grupos esportivos organizam suas partidas. Chega de planilhas manuais ou grupos de mensagens bagunçados!
        </p>
        <p className="text-xs text-slate-600 leading-relaxed font-medium">
          Com o GoPlay você gerencia eventos, sorteia times equilibrados por rating, acompanha o ranking dinâmico em tempo real e compartilha os pódios finais direto no WhatsApp.
        </p>
      </div>

      {/* Recursos Principais */}
      <div className="glass p-5 rounded-2xl shadow-lg space-y-3 border border-slate-150">
        <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
          <Zap size={16} className="text-amber-500" />
          <span>Recursos Integrados</span>
        </h3>
        <div className="grid grid-cols-2 gap-2 text-xs font-semibold text-slate-700">
          <div className="flex items-center gap-2 p-2 bg-slate-50 rounded-xl border border-slate-100">
            <Calendar size={14} className="text-red-500 shrink-0" />
            <span>Eventos Públicos e Privados</span>
          </div>
          <div className="flex items-center gap-2 p-2 bg-slate-50 rounded-xl border border-slate-100">
            <Users size={14} className="text-blue-500 shrink-0" />
            <span>Sorteio Inteligente de Times</span>
          </div>
          <div className="flex items-center gap-2 p-2 bg-slate-50 rounded-xl border border-slate-100">
            <Trophy size={14} className="text-amber-500 shrink-0" />
            <span>Ranking & Pódio Dinâmico</span>
          </div>
          <div className="flex items-center gap-2 p-2 bg-slate-50 rounded-xl border border-slate-100">
            <Bell size={14} className="text-violet-500 shrink-0" />
            <span>Notificações Push FCM</span>
          </div>
          <div className="flex items-center gap-2 p-2 bg-slate-50 rounded-xl border border-slate-100">
            <MessageSquare size={14} className="text-emerald-500 shrink-0" />
            <span>Chat e Amizades</span>
          </div>
          <div className="flex items-center gap-2 p-2 bg-slate-50 rounded-xl border border-slate-100">
            <ShieldCheck size={14} className="text-cyan-500 shrink-0" />
            <span>Gestão de Grupos</span>
          </div>
        </div>
      </div>

      {/* Créditos do Desenvolvedor */}
      <div className="glass p-5 rounded-2xl shadow-lg space-y-2 border border-slate-150 text-center bg-slate-900 text-white">
        <div className="w-10 h-10 rounded-full bg-red-600/20 text-red-500 mx-auto flex items-center justify-center mb-1">
          <Code2 size={20} />
        </div>
        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Desenvolvido por</h4>
        <p className="text-sm font-black text-white tracking-wide">
          Alan Robert Carvalho Victoria
        </p>
        <p className="text-[10px] text-slate-400 flex items-center justify-center gap-1 mt-1">
          Feito com <Heart size={10} className="text-red-500 fill-red-500 inline" /> para apaixonados por esportes.
        </p>
      </div>
    </div>
  );
}
