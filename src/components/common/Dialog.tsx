import { CheckCircle2, AlertTriangle, HelpCircle } from 'lucide-react';

interface DialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  type: 'alert' | 'confirm';
  onConfirm: () => void;
  onCancel?: () => void;
}

export default function Dialog({ isOpen, title, message, type, onConfirm, onCancel }: DialogProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-xs flex items-center justify-center p-6 animate-fade-in">
      <div className="bg-white rounded-2xl w-full max-w-xs shadow-2xl border border-slate-100 p-5 flex flex-col items-center text-center space-y-4 animate-slide-in">
        
        {/* Ícone Indicativo */}
        <div className="p-3 rounded-full bg-slate-50">
          {type === 'confirm' ? (
            <HelpCircle size={28} className="text-[#eb3237]" />
          ) : title.toLowerCase().includes('erro') ? (
            <AlertTriangle size={28} className="text-red-500" />
          ) : (
            <CheckCircle2 size={28} className="text-emerald-500" />
          )}
        </div>

        {/* Textos */}
        <div className="space-y-1">
          <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">{title}</h3>
          <p className="text-xs text-slate-650 leading-relaxed">{message}</p>
        </div>

        {/* Botões */}
        <div className="flex gap-2 w-full pt-1">
          {type === 'confirm' && (
            <button
              onClick={onCancel}
              className="flex-1 py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-all cursor-pointer"
            >
              Cancelar
            </button>
          )}
          <button
            onClick={onConfirm}
            className={`flex-1 py-2 px-3 text-white text-xs font-semibold rounded-xl transition-all cursor-pointer ${
              type === 'confirm' || title.toLowerCase().includes('erro')
                ? 'bg-[#eb3237] hover:bg-red-600'
                : 'bg-emerald-600 hover:bg-emerald-700'
            }`}
          >
            OK
          </button>
        </div>
      </div>
    </div>
  );
}
