import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  Trophy,
  Calendar,
  Users,
  Share2,
  Shuffle,
  Sparkles,
  ChevronRight,
  ChevronLeft,
  X,
  Globe,
  Lock,
  UserPlus,
  CheckCircle2,
  ArrowRight
} from 'lucide-react';

interface TutorialModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialStep?: number;
}

export default function TutorialModal({ isOpen, onClose, initialStep = 1 }: TutorialModalProps) {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState<number>(initialStep);

  if (!isOpen) return null;

  const totalSteps = 5;

  const handleFinish = () => {
    localStorage.setItem('goplay_tutorial_seen', 'true');
    onClose();
  };

  const handleGoToNovoEvento = () => {
    handleFinish();
    navigate('/eventos/novo');
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 bg-slate-900/75 backdrop-blur-xs flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col border border-slate-100 max-h-[90vh]"
        >
          {/* Topo do Modal com barra de progresso e botão fechar */}
          <div className="p-4 pb-2 flex items-center justify-between border-b border-slate-100">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-xl bg-red-50 text-red-650 font-black text-xs flex items-center gap-1 border border-red-200">
                <Sparkles size={13} />
                <span>Guia GoPlay</span>
              </span>
              <span className="text-xs font-bold text-slate-400">
                {currentStep} de {totalSteps}
              </span>
            </div>

            <button
              onClick={handleFinish}
              className="p-2 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
              title="Pular Tutorial"
            >
              <X size={18} />
            </button>
          </div>

          {/* Barra de Progresso Visual */}
          <div className="w-full bg-slate-100 h-1">
            <div
              className="bg-gradient-to-r from-red-500 to-amber-500 h-1 transition-all duration-300"
              style={{ width: `${(currentStep / totalSteps) * 100}%` }}
            />
          </div>

          {/* Conteúdo Central da Etapa */}
          <div className="p-6 overflow-y-auto flex-1 space-y-4 text-left">
            {/* ETAPA 1: BEM-VINDO AO GOPLAY */}
            {currentStep === 1 && (
              <div className="space-y-4 animate-fade-in text-center">
                <div className="w-16 h-16 rounded-3xl bg-gradient-to-tr from-red-500 to-amber-500 text-white flex items-center justify-center mx-auto shadow-lg shadow-red-500/20">
                  <Trophy size={32} />
                </div>

                <div className="space-y-2">
                  <h2 className="text-xl font-black text-slate-900 leading-tight">
                    Bem-vindo ao GoPlay! 🏆
                  </h2>
                  <p className="text-xs text-slate-600 leading-relaxed max-w-xs mx-auto">
                    A plataforma completa para organizar suas <strong>peladas, treinos, sorteios de times e torneios</strong> sem dor de cabeça no WhatsApp!
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2 text-left pt-2">
                  <div className="p-3 bg-red-50/60 rounded-2xl border border-red-100 space-y-1">
                    <span className="text-xs font-black text-red-650 flex items-center gap-1">
                      <Calendar size={14} /> Eventos
                    </span>
                    <p className="text-[10px] text-slate-500 leading-tight">
                      Crie partidas com lista de chamada e confirmação de presença automática.
                    </p>
                  </div>

                  <div className="p-3 bg-amber-50/60 rounded-2xl border border-amber-100 space-y-1">
                    <span className="text-xs font-black text-amber-700 flex items-center gap-1">
                      <Shuffle size={14} /> Sorteio Equilibrado
                    </span>
                    <p className="text-[10px] text-slate-500 leading-tight">
                      Times justos e balanceados por estrelas e posições em segundos!
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* ETAPA 2: CRIANDO SEU EVENTO (PÚBLICO VS PRIVADO) */}
            {currentStep === 2 && (
              <div className="space-y-3.5 animate-fade-in">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-red-50 text-red-650 flex items-center justify-center shrink-0 border border-red-100">
                    <Calendar size={24} />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-slate-900 leading-tight">
                      Criando seu Evento 📅
                    </h3>
                    <p className="text-xs text-slate-500">
                      Escolha a visibilidade ideal para o seu jogo
                    </p>
                  </div>
                </div>

                <div className="space-y-2.5 pt-1">
                  {/* Evento Público */}
                  <div className="p-3.5 bg-emerald-50/60 rounded-2xl border border-emerald-200 space-y-1.5">
                    <div className="flex items-center gap-2 text-emerald-800 font-black text-xs">
                      <Globe size={16} className="text-emerald-600" />
                      <span>Evento Público</span>
                      <span className="text-[9px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full uppercase">
                        Aberto
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-600 leading-relaxed">
                      Qualquer atleta do GoPlay na sua região pode encontrar o evento no aplicativo e solicitar participação. Ótimo para completar o time ou jogos abertos!
                    </p>
                  </div>

                  {/* Evento Privado */}
                  <div className="p-3.5 bg-amber-50/60 rounded-2xl border border-amber-200 space-y-1.5">
                    <div className="flex items-center gap-2 text-amber-800 font-black text-xs">
                      <Lock size={16} className="text-amber-600" />
                      <span>Evento Privado</span>
                      <span className="text-[9px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full uppercase">
                        Restrito
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-600 leading-relaxed">
                      Fica visível apenas para os membros do seu <strong>Grupo</strong> ou <strong>Comunidade</strong>, ou para quem você enviar o link exclusivo.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* ETAPA 3: ADICIONANDO JOGADORES NO SORTEIO */}
            {currentStep === 3 && (
              <div className="space-y-3.5 animate-fade-in">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-violet-50 text-violet-600 flex items-center justify-center shrink-0 border border-violet-100">
                    <Users size={24} />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-slate-900 leading-tight">
                      Adicionando Jogadores 👥
                    </h3>
                    <p className="text-xs text-slate-500">
                      Cadastrados e convidados sem conta no app
                    </p>
                  </div>
                </div>

                <div className="space-y-2.5 pt-1">
                  {/* Jogador Cadastrado */}
                  <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 space-y-1">
                    <div className="flex items-center gap-2 text-slate-800 font-black text-xs">
                      <CheckCircle2 size={15} className="text-emerald-500" />
                      <span>Atletas Cadastrados</span>
                    </div>
                    <p className="text-[11px] text-slate-600 leading-relaxed">
                      Basta buscar pelo nome do seu amigo cadastrado. A foto, posição e nível de estrelas dele já entram automaticamente para o sorteio!
                    </p>
                  </div>

                  {/* Convidado Avulso */}
                  <div className="p-3.5 bg-red-50/60 rounded-2xl border border-red-200 space-y-1">
                    <div className="flex items-center gap-2 text-red-700 font-black text-xs">
                      <UserPlus size={15} className="text-red-500" />
                      <span>Convidado Avulso (Não Inscrito)</span>
                    </div>
                    <p className="text-[11px] text-slate-600 leading-relaxed">
                      Seu amigo não tem o GoPlay instalado? Não tem problema! Digite o nome dele e clique em <strong>"+ Adicionar Convidado"</strong>. Ele participará normalmente do sorteio dos times!
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* ETAPA 4: COMPARTILHANDO O LINK DO EVENTO */}
            {currentStep === 4 && (
              <div className="space-y-3.5 animate-fade-in">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 border border-blue-100">
                    <Share2 size={24} />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-slate-900 leading-tight">
                      Convite por Link no WhatsApp 🔗
                    </h3>
                    <p className="text-xs text-slate-500">
                      Confirmação instantânea sem complicação
                    </p>
                  </div>
                </div>

                <div className="p-4 bg-blue-50/50 rounded-2xl border border-blue-200 space-y-3">
                  <p className="text-xs text-slate-700 leading-relaxed">
                    Dentro da página do evento, você encontrará o botão <strong>"Compartilhar Convite"</strong>.
                  </p>

                  <div className="p-3 bg-white rounded-xl border border-blue-100 shadow-xs space-y-1 text-slate-800 text-[11px]">
                    <span className="font-black text-blue-600 block">Exemplo da mensagem gerada:</span>
                    <p className="italic text-slate-600">
                      "⚽ Pelada dos Amigos - Sábado às 16:00 na Arena Gol.<br />
                      Confirme sua presença pelo link: goplay.app/eventos/..."
                    </p>
                  </div>

                  <p className="text-[11px] text-slate-600 leading-relaxed">
                    Ao clicar no link, seus amigos entram direto na página do evento e confirmam presença com apenas um toque!
                  </p>
                </div>
              </div>
            )}

            {/* ETAPA 5: SORTEIO DOS TIMES INTELIGENTE */}
            {currentStep === 5 && (
              <div className="space-y-3.5 animate-fade-in text-center">
                <div className="w-16 h-16 rounded-3xl bg-gradient-to-tr from-amber-500 to-red-500 text-white flex items-center justify-center mx-auto shadow-lg shadow-amber-500/20">
                  <Shuffle size={32} />
                </div>

                <div className="space-y-1.5">
                  <h3 className="text-lg font-black text-slate-900 leading-tight">
                    Sorteio Inteligente de Times 🎲
                  </h3>
                  <p className="text-xs text-slate-600 leading-relaxed max-w-xs mx-auto">
                    Chega de discussão na hora de montar os times!
                  </p>
                </div>

                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 text-left space-y-2 text-xs text-slate-700">
                  <div className="flex items-start gap-2">
                    <span className="w-5 h-5 rounded-full bg-red-100 text-red-650 font-black text-[10px] flex items-center justify-center shrink-0 mt-0.5">
                      1
                    </span>
                    <p className="text-[11px]">Escolha a quantidade de times e quantos atletas por equipe.</p>
                  </div>

                  <div className="flex items-start gap-2">
                    <span className="w-5 h-5 rounded-full bg-red-100 text-red-650 font-black text-[10px] flex items-center justify-center shrink-0 mt-0.5">
                      2
                    </span>
                    <p className="text-[11px]">O GoPlay balanceia automaticamente o nível técnico e distribui goleiros/defensores/atacantes uniformemente.</p>
                  </div>

                  <div className="flex items-start gap-2">
                    <span className="w-5 h-5 rounded-full bg-red-100 text-red-650 font-black text-[10px] flex items-center justify-center shrink-0 mt-0.5">
                      3
                    </span>
                    <p className="text-[11px]">Exporte a imagem da escalação para enviar no grupo da galera!</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Rodapé com Navegação */}
          <div className="p-4 pt-2 border-t border-slate-100 flex items-center gap-2 bg-slate-50/50">
            {currentStep > 1 && (
              <button
                type="button"
                onClick={() => setCurrentStep((prev) => Math.max(1, prev - 1))}
                className="py-3 px-4 rounded-2xl bg-white border border-slate-200 text-slate-700 font-bold text-xs hover:bg-slate-50 active:scale-95 transition-all cursor-pointer flex items-center gap-1"
              >
                <ChevronLeft size={16} />
                <span>Voltar</span>
              </button>
            )}

            {currentStep < totalSteps ? (
              <button
                type="button"
                onClick={() => setCurrentStep((prev) => Math.min(totalSteps, prev + 1))}
                className="flex-1 py-3 px-4 rounded-2xl bg-[#eb3237] hover:bg-red-650 text-white font-black text-xs shadow-md active:scale-98 transition-all cursor-pointer flex items-center justify-center gap-1.5"
              >
                <span>Próximo</span>
                <ChevronRight size={16} />
              </button>
            ) : (
              <div className="flex-1 flex gap-2">
                <button
                  type="button"
                  onClick={handleFinish}
                  className="flex-1 py-3 px-3 rounded-2xl bg-slate-800 hover:bg-slate-900 text-white font-black text-xs shadow-md active:scale-98 transition-all cursor-pointer text-center"
                >
                  Concluir Tour
                </button>
                <button
                  type="button"
                  onClick={handleGoToNovoEvento}
                  className="flex-1 py-3 px-3 rounded-2xl bg-gradient-to-r from-[#eb3237] to-amber-600 hover:from-red-650 hover:to-amber-700 text-white font-black text-xs shadow-md active:scale-98 transition-all cursor-pointer flex items-center justify-center gap-1"
                >
                  <span>Criar Evento</span>
                  <ArrowRight size={14} />
                </button>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
