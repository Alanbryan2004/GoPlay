import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import type { Usuario, Mensagem } from '../../types';
import {
  Send,
  ArrowLeft,
  Search,
  MessageSquare,
  Check,
  CheckCheck,
  Users,
  Clock,
  Smile,
  X
} from 'lucide-react';

interface ConversaResumo {
  partner: Usuario;
  lastMessage: Mensagem;
  unreadCount: number;
}

const EMOJI_CATEGORIES = [
  {
    id: 'esportes',
    label: 'Esportes',
    icon: '🏐',
    emojis: [
      '🏐', '⚽', '🏀', '🎾', '🏈', '🏓', '🏸', '🥊', '🥋',
      '🏆', '🥇', '🥈', '🥉', '🎯', '🏋️', '🏃', '🏊', '👟',
      '🏅', '🎖️', '🎮', '🎲', '🎳', '🚴', '🛹', '⛳'
    ]
  },
  {
    id: 'torcida',
    label: 'Torcida',
    icon: '🔥',
    emojis: [
      '🔥', '👏', '💪', '🙌', '🚀', '⚡', '💯', '✨', '🎉',
      '🥳', '😎', '👊', '✌️', '🤝', '🫡', '👍', '👎', '🤙',
      '🙏', '👀', '💥', '⭐', '🌟', '🔝'
    ]
  },
  {
    id: 'emocoes',
    label: 'Expressões',
    icon: '😀',
    emojis: [
      '😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '😉',
      '😊', '😇', '🥰', '😍', '🤩', '😋', '😜', '🤔', '🤫',
      '🥱', '😴', '🤤', '😵', '😱', '🤪', '😬', '🤭'
    ]
  },
  {
    id: 'coracoes',
    label: 'Corações',
    icon: '❤️',
    emojis: [
      '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎',
      '💔', '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝'
    ]
  }
];

const QUICK_EMOJIS = ['🏐', '⚽', '🔥', '👏', '💪', '🏆', '❤️', '😂'];

// Detecta se o texto contém apenas de 1 a 4 emojis (sem palavras ou letras)
function isOnlyEmojis(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return false;
  // Regex moderna para detecção de caracteres emoji
  const emojiRegex = /^(\p{Extended_Pictographic}|\p{Emoji_Presentation}|\s)+$/u;
  const count = Array.from(trimmed.replace(/\s+/g, '')).length;
  return emojiRegex.test(trimmed) && count <= 4;
}

export default function MensagensPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const partnerIdFromUrl = searchParams.get('user');

  const [currentUserId, setCurrentUserId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [conversas, setConversas] = useState<ConversaResumo[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  // Conversa ativa
  const [activePartner, setActivePartner] = useState<Usuario | null>(null);
  const [messages, setMessages] = useState<Mensagem[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [activeEmojiCategory, setActiveEmojiCategory] = useState('esportes');

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // 1. Obter usuário logado atual
  useEffect(() => {
    async function loadCurrentUser() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: profile } = await supabase
            .from('usuarios')
            .select('*')
            .eq('email', user.email)
            .single();

          if (profile) {
            setCurrentUserId(profile.id);
          }
        }
      } catch (err) {
        console.error('Erro ao buscar usuário logado:', err);
      }
    }
    loadCurrentUser();
  }, []);

  // 2. Quando souber o currentUserId, carregar conversas e parceiro da URL se houver
  useEffect(() => {
    if (!currentUserId) return;
    loadConversas();

    if (partnerIdFromUrl) {
      loadPartnerFromUrl(partnerIdFromUrl);
    } else {
      setActivePartner(null);
    }
  }, [currentUserId, partnerIdFromUrl]);

  // Carregar dados do parceiro caso venha via URL (?user=...)
  const loadPartnerFromUrl = async (partnerId: string) => {
    try {
      const { data: partnerUser, error } = await supabase
        .from('usuarios')
        .select('*')
        .eq('id', partnerId)
        .single();

      if (!error && partnerUser) {
        setActivePartner(partnerUser as Usuario);
      }
    } catch (e) {
      console.error('Erro ao carregar parceiro da URL:', e);
    }
  };

  // Carregar resumo das conversas
  const loadConversas = async () => {
    if (!currentUserId) return;
    try {
      setLoading(true);
      // Busca todas as mensagens onde o usuário participou
      const { data: msgs, error } = await supabase
        .from('mensagens')
        .select('*')
        .or(`remetente_id.eq.${currentUserId},destinatario_id.eq.${currentUserId}`)
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (!msgs || msgs.length === 0) {
        setConversas([]);
        setLoading(false);
        return;
      }

      // Agrupa mensagens pelo parceiro de conversa
      const partnerMap = new Map<string, { lastMessage: Mensagem; unreadCount: number }>();

      msgs.forEach((m: Mensagem) => {
        const partnerId = m.remetente_id === currentUserId ? m.destinatario_id : m.remetente_id;
        if (!partnerMap.has(partnerId)) {
          partnerMap.set(partnerId, {
            lastMessage: m,
            unreadCount: m.destinatario_id === currentUserId && !m.lida ? 1 : 0,
          });
        } else {
          if (m.destinatario_id === currentUserId && !m.lida) {
            const current = partnerMap.get(partnerId)!;
            current.unreadCount += 1;
          }
        }
      });

      const partnerIds = Array.from(partnerMap.keys());
      if (partnerIds.length === 0) {
        setConversas([]);
        setLoading(false);
        return;
      }

      // Buscar os perfis dos parceiros
      const { data: partnersData } = await supabase
        .from('usuarios')
        .select('*')
        .in('id', partnerIds);

      const conversasSummary: ConversaResumo[] = [];
      (partnersData || []).forEach((p: Usuario) => {
        const entry = partnerMap.get(p.id);
        if (entry) {
          conversasSummary.push({
            partner: p,
            lastMessage: entry.lastMessage,
            unreadCount: entry.unreadCount,
          });
        }
      });

      // Ordena pelas mensagens mais recentes
      conversasSummary.sort(
        (a, b) => new Date(b.lastMessage.created_at).getTime() - new Date(a.lastMessage.created_at).getTime()
      );

      setConversas(conversasSummary);
    } catch (e) {
      console.error('Erro ao carregar conversas:', e);
    } finally {
      setLoading(false);
    }
  };

  // 3. Carregar mensagens da conversa ativa e marcar como lidas
  useEffect(() => {
    if (!currentUserId || !activePartner) return;

    let isSubscribed = true;

    const fetchActiveMessages = async () => {
      try {
        const { data, error } = await supabase
          .from('mensagens')
          .select('*')
          .or(
            `and(remetente_id.eq.${currentUserId},destinatario_id.eq.${activePartner.id}),and(remetente_id.eq.${activePartner.id},destinatario_id.eq.${currentUserId})`
          )
          .order('created_at', { ascending: true });

        if (!error && isSubscribed) {
          setMessages(data as Mensagem[]);
          markActiveMessagesAsRead(activePartner.id);
        }
      } catch (err) {
        console.error('Erro ao buscar mensagens:', err);
      }
    };

    fetchActiveMessages();

    // Inscrição Realtime no Supabase para receber mensagens instantâneas
    const channel = supabase
      .channel(`chat_${currentUserId}_${activePartner.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'mensagens',
        },
        (payload) => {
          if (!isSubscribed) return;

          if (payload.eventType === 'INSERT') {
            const newMsg = payload.new as Mensagem;
            const isRelevant =
              (newMsg.remetente_id === currentUserId && newMsg.destinatario_id === activePartner.id) ||
              (newMsg.remetente_id === activePartner.id && newMsg.destinatario_id === currentUserId);

            if (isRelevant) {
              setMessages((prev) => {
                // Evita duplicatas se já inserido localmente
                if (prev.some((m) => m.id === newMsg.id)) return prev;
                return [...prev, newMsg];
              });

              if (newMsg.destinatario_id === currentUserId) {
                markActiveMessagesAsRead(activePartner.id);
              }
            }
          } else if (payload.eventType === 'UPDATE') {
            const updated = payload.new as Mensagem;
            setMessages((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
          }
        }
      )
      .subscribe();

    return () => {
      isSubscribed = false;
      supabase.removeChannel(channel);
    };
  }, [currentUserId, activePartner]);

  // Marcar mensagens recebidas do parceiro ativo como lidas
  const markActiveMessagesAsRead = async (partnerId: string) => {
    if (!currentUserId) return;
    try {
      const { error } = await supabase
        .from('mensagens')
        .update({ lida: true })
        .eq('destinatario_id', currentUserId)
        .eq('remetente_id', partnerId)
        .eq('lida', false);

      if (!error) {
        window.dispatchEvent(new CustomEvent('goplay:refresh-notifications'));
        // Atualiza contagem local de não lidas na lista de conversas
        setConversas((prev) =>
          prev.map((c) => (c.partner.id === partnerId ? { ...c, unreadCount: 0 } : c))
        );
      }
    } catch (e) {
      console.error('Erro ao marcar mensagens como lidas:', e);
    }
  };

  // Scroll automático para a última mensagem
  useEffect(() => {
    if (activePartner && messages.length > 0) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, activePartner]);

  // Enviar mensagem
  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!newMessage.trim() || !activePartner || !currentUserId || sending) return;

    const textToSend = newMessage.trim();
    setNewMessage('');
    setSending(true);
    setShowEmojiPicker(false);

    try {
      const { data, error } = await supabase
        .from('mensagens')
        .insert({
          remetente_id: currentUserId,
          destinatario_id: activePartner.id,
          conteudo: textToSend,
          lida: false,
        })
        .select()
        .single();

      if (!error && data) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === data.id)) return prev;
          return [...prev, data as Mensagem];
        });

        // Atualiza a lista de conversas recente
        setConversas((prev) => {
          const filtered = prev.filter((c) => c.partner.id !== activePartner.id);
          return [
            {
              partner: activePartner,
              lastMessage: data as Mensagem,
              unreadCount: 0,
            },
            ...filtered,
          ];
        });

        window.dispatchEvent(new CustomEvent('goplay:refresh-notifications'));
      } else if (error) {
        console.error('Erro ao enviar mensagem:', error);
        setNewMessage(textToSend); // Restaura em caso de erro
      }
    } catch (e) {
      console.error('Erro de envio:', e);
      setNewMessage(textToSend);
    } finally {
      setSending(false);
    }
  };

  // Inserir emoji na posição atual do cursor
  const handleInsertEmoji = (emoji: string) => {
    setNewMessage((prev) => {
      if (!inputRef.current) return prev + emoji;
      const start = inputRef.current.selectionStart ?? prev.length;
      const end = inputRef.current.selectionEnd ?? prev.length;
      return prev.substring(0, start) + emoji + prev.substring(end);
    });
    setTimeout(() => {
      inputRef.current?.focus();
    }, 10);
  };

  const handleSelectConversation = (partner: Usuario) => {
    setActivePartner(partner);
    setSearchParams({ user: partner.id });
  };

  const handleBackToList = () => {
    setActivePartner(null);
    setSearchParams({});
    loadConversas();
  };

  // Formatação amigável de horários
  const formatMessageTime = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  const formatConversationDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      const now = new Date();
      const isToday = d.toDateString() === now.toDateString();
      if (isToday) {
        return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      }
      return d.toLocaleDateString([], { day: '2-digit', month: '2-digit' });
    } catch {
      return '';
    }
  };

  const filteredConversas = useMemo(() => {
    return conversas.filter((c) =>
      c.partner.nome.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [conversas, searchTerm]);

  // Se houver conversa ativa, renderiza a tela de chat direto
  if (activePartner) {
    return (
      <div className="flex flex-col h-[calc(100vh-4.5rem)] w-full max-w-md mx-auto bg-slate-50 text-left">
        {/* Header do Chat */}
        <div className="flex items-center gap-3 px-4 py-3 bg-white border-b border-slate-200 shadow-xs z-10">
          <button
            onClick={handleBackToList}
            className="p-2 -ml-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
            title="Voltar às conversas"
          >
            <ArrowLeft size={20} />
          </button>

          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            {activePartner.foto ? (
              <img
                src={activePartner.foto}
                alt={activePartner.nome}
                className="w-9 h-9 rounded-full object-cover ring-2 ring-red-500/10 shrink-0"
              />
            ) : (
              <div className="w-9 h-9 rounded-full bg-slate-800 text-white flex items-center justify-center font-bold text-xs shrink-0">
                {activePartner.nome.charAt(0).toUpperCase()}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <h2 className="text-sm font-extrabold text-slate-900 truncate leading-tight">
                {activePartner.nome}
              </h2>
              <p className="text-[10px] text-slate-400 truncate">
                {activePartner.email}
              </p>
            </div>
          </div>
        </div>

        {/* Área de Mensagens */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center py-12 text-slate-400">
              <div className="w-12 h-12 rounded-2xl bg-red-50 text-red-500 flex items-center justify-center mb-3">
                <MessageSquare size={24} />
              </div>
              <p className="text-xs font-semibold text-slate-600">Nenhuma mensagem ainda.</p>
              <p className="text-[10px] text-slate-400 mt-0.5">Diga "Olá!" ou envie um emoji para começar.</p>
            </div>
          ) : (
            messages.map((m) => {
              const isMe = m.remetente_id === currentUserId;
              const onlyEmoji = isOnlyEmojis(m.conteudo);

              return (
                <div
                  key={m.id}
                  className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
                >
                  <div
                    className={`max-w-[78%] text-xs shadow-xs break-words ${
                      onlyEmoji
                        ? 'bg-transparent shadow-none px-1 py-0.5'
                        : isMe
                        ? 'bg-gradient-to-r from-[#eb3237] to-red-650 text-white rounded-2xl rounded-tr-xs px-3.5 py-2.5'
                        : 'bg-white text-slate-850 border border-slate-200/70 rounded-2xl rounded-tl-xs px-3.5 py-2.5'
                    }`}
                  >
                    <p
                      className={`whitespace-pre-wrap leading-relaxed ${
                        onlyEmoji ? 'text-3xl tracking-wider py-1 select-none' : ''
                      }`}
                    >
                      {m.conteudo}
                    </p>
                    <div
                      className={`flex items-center justify-end gap-1 mt-1 text-[9px] ${
                        onlyEmoji
                          ? 'text-slate-400'
                          : isMe
                          ? 'text-red-100'
                          : 'text-slate-400'
                      }`}
                    >
                      <span>{formatMessageTime(m.created_at)}</span>
                      {isMe && (
                        <span>
                          {m.lida ? (
                            <CheckCheck size={12} className={onlyEmoji ? "text-emerald-500" : "text-white"} />
                          ) : (
                            <Check size={12} className={onlyEmoji ? "text-slate-400" : "text-red-200"} />
                          )}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Barra de Emojis Rápidos */}
        <div className="px-3 py-1.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-1 overflow-x-auto no-scrollbar">
          <div className="flex items-center gap-1.5 flex-1 min-w-0 overflow-x-auto no-scrollbar py-0.5">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider pl-1 shrink-0">
              Rápidos:
            </span>
            {QUICK_EMOJIS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => handleInsertEmoji(emoji)}
                className="w-7 h-7 rounded-lg hover:bg-white hover:shadow-xs active:scale-125 transition-all text-base flex items-center justify-center cursor-pointer shrink-0"
              >
                {emoji}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setShowEmojiPicker((prev) => !prev)}
            className={`px-2 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1 shrink-0 cursor-pointer ${
              showEmojiPicker
                ? 'bg-red-600 text-white shadow-xs'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
            }`}
          >
            <span>😀</span>
            <span className="text-[10px]">{showEmojiPicker ? 'Fechar' : 'Mais'}</span>
          </button>
        </div>

        {/* Popover / Painel Completo de Emojis */}
        {showEmojiPicker && (
          <div className="bg-white border-t border-slate-200 p-3 shadow-inner max-h-56 flex flex-col z-20 animate-fade-in">
            {/* Categorias de Emojis */}
            <div className="flex items-center gap-1 border-b border-slate-100 pb-2 mb-2 overflow-x-auto no-scrollbar">
              {EMOJI_CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setActiveEmojiCategory(cat.id)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shrink-0 ${
                    activeEmojiCategory === cat.id
                      ? 'bg-red-50 text-red-600 border border-red-200'
                      : 'text-slate-500 hover:bg-slate-100'
                  }`}
                >
                  <span>{cat.icon}</span>
                  <span className="text-[10px]">{cat.label}</span>
                </button>
              ))}
            </div>

            {/* Grid de Emojis da Categoria Selecionada */}
            <div className="grid grid-cols-8 gap-1.5 overflow-y-auto max-h-36 pr-1 no-scrollbar text-center py-1">
              {EMOJI_CATEGORIES.find((c) => c.id === activeEmojiCategory)?.emojis.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => handleInsertEmoji(emoji)}
                  className="w-8 h-8 rounded-xl hover:bg-slate-100 hover:scale-125 active:scale-95 transition-all text-xl flex items-center justify-center cursor-pointer"
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Input de envio */}
        <form
          onSubmit={handleSendMessage}
          className="p-3 bg-white border-t border-slate-200 flex items-center gap-2"
        >
          <button
            type="button"
            onClick={() => setShowEmojiPicker((prev) => !prev)}
            className={`p-2.5 rounded-xl border transition-all cursor-pointer ${
              showEmojiPicker
                ? 'bg-red-50 border-red-300 text-red-600'
                : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100'
            }`}
            title="Escolher Emoji"
          >
            <Smile size={18} />
          </button>

          <input
            ref={inputRef}
            type="text"
            placeholder="Digite sua mensagem..."
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage();
              }
            }}
            className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-500/40 transition-all placeholder:text-slate-400"
          />
          <button
            type="submit"
            disabled={!newMessage.trim() || sending}
            className={`p-2.5 rounded-xl transition-all shadow-xs flex items-center justify-center cursor-pointer ${
              newMessage.trim() && !sending
                ? 'bg-[#eb3237] hover:bg-red-650 text-white active:scale-95'
                : 'bg-slate-100 text-slate-400 cursor-not-allowed'
            }`}
          >
            <Send size={16} />
          </button>
        </form>
      </div>
    );
  }

  // Se nenhuma conversa estiver ativa, renderiza a lista de conversas
  return (
    <div className="px-4 py-3 pb-24 w-full max-w-md mx-auto min-h-[calc(100vh-8rem)] text-left">
      {/* Título com alinhamento ao botão de menu flutuante */}
      <div className="flex justify-between items-center mb-4 pl-14 h-11">
        <h1 className="text-2xl font-black text-slate-900 leading-none">Mensagens</h1>
        <button
          onClick={() => navigate('/amigos')}
          className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-all flex items-center gap-1.5 text-xs font-bold shadow-xs cursor-pointer"
          title="Nova Conversa com Amigos"
        >
          <Users size={15} />
          <span>Amigos</span>
        </button>
      </div>

      {/* Barra de Pesquisa de Conversas */}
      <div className="relative mb-4">
        <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400 pointer-events-none">
          <Search size={16} />
        </span>
        <input
          type="text"
          placeholder="Pesquisar conversa..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 pl-10 pr-4 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-red-500/30 transition-all text-xs font-medium"
        />
      </div>

      {/* Lista de Conversas Recentes */}
      {loading ? (
        <div className="flex justify-center items-center h-48">
          <div className="w-8 h-8 border-4 border-red-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filteredConversas.length === 0 ? (
        <div className="text-center py-12 glass rounded-2xl border border-slate-200 p-6 space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-red-50 text-red-500 flex items-center justify-center mx-auto">
            <MessageSquare size={24} />
          </div>
          <p className="text-slate-700 text-sm font-bold">Nenhuma conversa encontrada.</p>
          <p className="text-slate-450 text-xs">
            Acesse seus amigos para iniciar um bate-papo direto.
          </p>
          <button
            onClick={() => navigate('/amigos')}
            className="mt-2 px-4 py-2 bg-gradient-to-r from-[#eb3237] to-red-650 hover:from-red-500 hover:to-red-600 text-white text-xs font-bold rounded-xl shadow-md transition-all active:scale-95 cursor-pointer"
          >
            Ver Lista de Amigos
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredConversas.map((c) => {
            const hasUnread = c.unreadCount > 0;
            return (
              <div
                key={c.partner.id}
                onClick={() => handleSelectConversation(c.partner)}
                className={`glass p-3.5 rounded-2xl border transition-all flex items-center justify-between shadow-xs cursor-pointer active:scale-[0.99] ${
                  hasUnread
                    ? 'border-red-300 bg-red-50/20 hover:border-red-400 hover:bg-red-50/30 ring-1 ring-red-400/20'
                    : 'border-slate-200 hover:border-red-500/30 hover:bg-slate-50/50'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0 flex-1 pr-3">
                  <div className="relative shrink-0">
                    {c.partner.foto ? (
                      <img
                        src={c.partner.foto}
                        alt={c.partner.nome}
                        className="w-11 h-11 rounded-full object-cover ring-2 ring-red-500/10"
                      />
                    ) : (
                      <div className="w-11 h-11 rounded-full bg-slate-800 text-white flex items-center justify-center font-bold text-sm">
                        {c.partner.nome.charAt(0).toUpperCase()}
                      </div>
                    )}
                    {hasUnread && (
                      <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 bg-red-600 border-2 border-white rounded-full animate-pulse" />
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2 mb-0.5">
                      <h3 className="font-extrabold text-slate-850 text-sm truncate leading-tight">
                        {c.partner.nome}
                      </h3>
                      <span className="text-[10px] text-slate-400 shrink-0 font-medium flex items-center gap-0.5">
                        <Clock size={10} />
                        {formatConversationDate(c.lastMessage.created_at)}
                      </span>
                    </div>
                    <p
                      className={`text-xs truncate ${
                        hasUnread
                          ? 'text-slate-900 font-bold'
                          : 'text-slate-500 font-normal'
                      }`}
                    >
                      {c.lastMessage.remetente_id === currentUserId && (
                        <span className="text-slate-400 font-normal">Você: </span>
                      )}
                      {c.lastMessage.conteudo}
                    </p>
                  </div>
                </div>

                {hasUnread && (
                  <span className="shrink-0 w-5 h-5 rounded-full bg-red-600 text-white text-[10px] font-black flex items-center justify-center shadow-xs animate-bounce">
                    {c.unreadCount > 9 ? '9+' : c.unreadCount}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
