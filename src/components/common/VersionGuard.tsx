import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { RefreshCw } from 'lucide-react';

/**
 * VersionGuard — Detecta novas versões do GoPlay e força reload automático.
 *
 * Como funciona:
 * 1. Ao montar, busca /version.json e salva a versão atual em memória
 * 2. A cada 60 segundos, busca /version.json novamente (com cache-bust via timestamp)
 * 3. Se a versão mudou → exibe banner animado por 3s e faz reload forçado
 *
 * Isso impede que usuários fiquem rodando código antigo sem perceber.
 */
export default function VersionGuard() {
  const currentVersion = useRef<string | null>(null);
  const [showBanner, setShowBanner] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    async function fetchVersion(): Promise<string | null> {
      try {
        // Cache-bust: adiciona timestamp para garantir resposta fresca do servidor
        const res = await fetch(`/version.json?t=${Date.now()}`, {
          cache: 'no-store',
          headers: { 'Cache-Control': 'no-cache' },
        });
        if (!res.ok) return null;
        const data = await res.json();
        return data.version || null;
      } catch {
        return null;
      }
    }

    // 1. Checagem inicial
    fetchVersion().then((v) => {
      if (v) currentVersion.current = v;
    });

    // Função para verificar se a versão mudou
    const checkVersion = async () => {
      const latest = await fetchVersion();
      if (!latest || !currentVersion.current) return;

      if (latest !== currentVersion.current) {
        console.log(
          `[VersionGuard] Nova versão detectada: ${currentVersion.current} → ${latest}. Recarregando...`
        );
        setShowBanner(true);

        // Aguarda 2.5 segundos para o usuário ver o aviso e força reload sem cache
        setTimeout(() => {
          window.location.reload();
        }, 2500);
      }
    };

    // 2. Verificação periódica a cada 15 segundos
    intervalRef.current = setInterval(checkVersion, 15 * 1000);

    // 3. Verificação instantânea quando a aba ou app no celular volta a ficar visível/focado
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkVersion();
      }
    };
    window.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', checkVersion);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      window.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', checkVersion);
    };
  }, []);

  return (
    <AnimatePresence>
      {showBanner && (
        <motion.div
          initial={{ y: -80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -80, opacity: 0 }}
          transition={{ duration: 0.35, ease: 'easeOut' }}
          className="fixed top-0 left-0 right-0 z-[99999] flex items-center justify-center gap-3 px-5 py-3.5"
          style={{
            background: 'linear-gradient(135deg, #eb3237 0%, #c0392b 100%)',
            borderBottom: '1px solid rgba(255,255,255,0.15)',
            boxShadow: '0 4px 24px rgba(235,50,55,0.4)',
          }}
        >
          <RefreshCw size={16} className="text-white animate-spin flex-shrink-0" />
          <span className="text-white text-xs font-black tracking-wide uppercase">
            🚀 GoPlay atualizado! Recarregando em instantes...
          </span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
