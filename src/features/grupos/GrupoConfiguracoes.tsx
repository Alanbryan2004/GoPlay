import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { ArrowLeft, Check, Shield, User, Save, Crown, AlertCircle } from 'lucide-react';
import { getPermissoesGrupo, salvarPermissoesGrupo } from '../../utils/permissoesGrupo';
import type { PermissaoItem } from '../../utils/permissoesGrupo';
import Dialog from '../../components/common/Dialog';

export default function GrupoConfiguracoes() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [grupoNome, setGrupoNome] = useState<string>('');
  const [grupoFoto, setGrupoFoto] = useState<string | null>(null);
  const [isOwner, setIsOwner] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [permissoes, setPermissoes] = useState<PermissaoItem[]>([]);

  const [dialog, setDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type: 'alert' | 'confirm';
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    type: 'alert',
    onConfirm: () => {},
  });

  useEffect(() => {
    if (id) {
      loadData(id);
    }
  }, [id]);

  const loadData = async (grupoId: string) => {
    setLoading(true);
    try {
      // 1. Obter usuário logado
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate('/login');
        return;
      }

      const { data: userData } = await supabase
        .from('usuarios')
        .select('id')
        .eq('email', user.email)
        .single();

      const currentUserId = userData?.id || user.id;

      // 2. Buscar detalhes do grupo
      const { data: grupoData, error: gError } = await supabase
        .from('grupos')
        .select('*')
        .eq('id', grupoId)
        .single();

      if (gError || !grupoData) {
        throw new Error('Grupo não encontrado.');
      }

      setGrupoNome(grupoData.nome);
      setGrupoFoto(grupoData.foto || null);

      // 3. Verificar se é o proprietário (dono) do grupo
      let owner = false;
      const criadorId = (grupoData as any)?.criador_id;
      if (criadorId && criadorId === currentUserId) {
        owner = true;
      } else {
        // Fallback: verificar se é o primeiro Admin cadastrado no grupo
        const { data: firstAdmin } = await supabase
          .from('membros_grupo')
          .select('usuario_id')
          .eq('grupo_id', grupoId)
          .eq('tipo_perfil', 'A')
          .order('created_at', { ascending: true })
          .limit(1)
          .maybeSingle();

        if (firstAdmin && firstAdmin.usuario_id === currentUserId) {
          owner = true;
        }
      }

      setIsOwner(owner);

      // 4. Carregar permissões atuais do grupo
      const items = await getPermissoesGrupo(grupoId);
      setPermissoes(items);
    } catch (err: any) {
      console.error(err);
      setDialog({
        isOpen: true,
        title: 'Erro ao Carregar',
        message: err?.message || 'Falha ao carregar configurações do grupo.',
        type: 'alert',
        onConfirm: () => {
          setDialog((prev) => ({ ...prev, isOpen: false }));
          navigate(-1);
        },
      });
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = (parametroId: string, tipoPerfil: 'usuario' | 'moderador') => {
    if (!isOwner) return; // Apenas o proprietário pode alterar

    setPermissoes((prev) =>
      prev.map((item) => {
        if (item.parametroId === parametroId) {
          return {
            ...item,
            [tipoPerfil]: !item[tipoPerfil],
          };
        }
        return item;
      })
    );
  };

  const handleSalvar = async () => {
    if (!id || !isOwner) return;
    setSaving(true);
    try {
      const res = await salvarPermissoesGrupo(id, permissoes);
      if (res.success) {
        setDialog({
          isOpen: true,
          title: 'Configurações Salvas! ✅',
          message: 'As permissões dos perfis de Usuário e Admin foram atualizadas com sucesso para este grupo.',
          type: 'alert',
          onConfirm: () => {
            setDialog((prev) => ({ ...prev, isOpen: false }));
            navigate(-1);
          },
        });
      } else {
        throw new Error(res.error || 'Erro ao salvar permissões');
      }
    } catch (err: any) {
      setDialog({
        isOpen: true,
        title: 'Erro ao Salvar',
        message: err?.message || 'Não foi possível salvar as configurações.',
        type: 'alert',
        onConfirm: () => setDialog((prev) => ({ ...prev, isOpen: false })),
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-20">
      {/* Topo Vermelho conforme o print */}
      <div className="bg-gradient-to-r from-red-600 to-red-700 text-white shadow-md">
        <div className="max-w-md mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate(-1)}
              className="p-1.5 hover:bg-white/20 rounded-xl transition-all cursor-pointer"
              title="Voltar"
            >
              <ArrowLeft size={20} />
            </button>
            <div>
              <span className="text-[10px] font-black uppercase tracking-widest text-red-200 block">
                Grupos
              </span>
              <h1 className="text-lg font-black leading-tight">Configurações</h1>
            </div>
          </div>

          <div className="flex items-center gap-1.5 bg-black/20 px-2.5 py-1 rounded-xl text-xs font-bold border border-white/10">
            <Crown size={14} className="text-amber-300" />
            <span className="text-[11px] text-amber-200">Proprietário</span>
          </div>
        </div>
      </div>

      <div className="max-w-md mx-auto px-4 py-4 space-y-4">
        {/* Identificação do Grupo */}
        <div className="glass p-3.5 rounded-2xl border border-slate-200 bg-white flex items-center gap-3 shadow-xs">
          {grupoFoto ? (
            <img src={grupoFoto} alt={grupoNome} className="w-11 h-11 rounded-xl object-cover border border-slate-200" />
          ) : (
            <div className="w-11 h-11 rounded-xl bg-red-50 text-red-600 flex items-center justify-center font-black text-base border border-red-100">
              {grupoNome.charAt(0).toUpperCase()}
            </div>
          )}
          <div className="min-w-0 flex-1 text-left">
            <h2 className="text-sm font-black text-slate-800 truncate">{grupoNome}</h2>
            <p className="text-[11px] text-slate-400 font-semibold">
              Defina o que cada perfil pode realizar neste grupo.
            </p>
          </div>
        </div>

        {/* Aviso de Proprietário */}
        {!isOwner && (
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-2xl text-xs text-amber-800 flex items-start gap-2 text-left">
            <AlertCircle size={16} className="text-amber-600 shrink-0 mt-0.5" />
            <div>
              <strong>Atenção:</strong> Apenas o <strong>Proprietário do Grupo</strong> pode alterar estas permissões. Você está em modo de visualização.
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex justify-center items-center h-48">
            <div className="w-8 h-8 border-4 border-red-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          /* Tabela de Permissões fiel ao desenho do usuário */
          <div className="glass rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            {/* Cabeçalho das Colunas */}
            <div className="grid grid-cols-12 items-center px-4 py-3 bg-slate-50 border-b border-slate-200 text-xs font-black text-slate-700">
              <div className="col-span-6 text-left">
                <span className="uppercase text-[10px] tracking-wider text-slate-500">Ação</span>
              </div>
              <div className="col-span-3 flex flex-col items-center justify-center">
                <div className="w-7 h-7 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center shadow-2xs mb-0.5" title="Usuário Padrão">
                  <User size={15} />
                </div>
                <span className="text-[10px] font-bold text-slate-600">Usuário</span>
              </div>
              <div className="col-span-3 flex flex-col items-center justify-center">
                <div className="w-7 h-7 rounded-full bg-red-100 text-red-600 flex items-center justify-center shadow-2xs mb-0.5" title="Admin / Moderador">
                  <Shield size={15} />
                </div>
                <span className="text-[10px] font-bold text-red-600">Admin</span>
              </div>
            </div>

            {/* Linhas de Permissões */}
            <div className="divide-y divide-slate-100">
              {permissoes.map((p) => (
                <div
                  key={p.parametroId}
                  className="grid grid-cols-12 items-center px-4 py-3.5 hover:bg-slate-50/60 transition-colors"
                >
                  <div className="col-span-6 text-left pr-2">
                    <span className="text-xs font-black text-slate-800 block leading-tight">
                      {p.nome}
                    </span>
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">
                      {p.tipoParametro}
                    </span>
                  </div>

                  {/* Checkbox Usuário */}
                  <div className="col-span-3 flex justify-center items-center">
                    <button
                      type="button"
                      disabled={!isOwner}
                      onClick={() => handleToggle(p.parametroId, 'usuario')}
                      className={`w-6 h-6 rounded-lg flex items-center justify-center transition-all cursor-pointer ${
                        p.usuario
                          ? 'bg-red-600 text-white shadow-xs'
                          : 'bg-slate-100 border border-slate-300 text-transparent hover:border-slate-400'
                      } ${!isOwner ? 'opacity-60 cursor-not-allowed' : 'active:scale-90'}`}
                      title={p.usuario ? 'Permitido para Usuário' : 'Bloqueado para Usuário'}
                    >
                      <Check size={14} strokeWidth={3.5} className={p.usuario ? 'opacity-100' : 'opacity-0'} />
                    </button>
                  </div>

                  {/* Checkbox Admin */}
                  <div className="col-span-3 flex justify-center items-center">
                    <button
                      type="button"
                      disabled={!isOwner}
                      onClick={() => handleToggle(p.parametroId, 'moderador')}
                      className={`w-6 h-6 rounded-lg flex items-center justify-center transition-all cursor-pointer ${
                        p.moderador
                          ? 'bg-red-600 text-white shadow-xs'
                          : 'bg-slate-100 border border-slate-300 text-transparent hover:border-slate-400'
                      } ${!isOwner ? 'opacity-60 cursor-not-allowed' : 'active:scale-90'}`}
                      title={p.moderador ? 'Permitido para Admin' : 'Bloqueado para Admin'}
                    >
                      <Check size={14} strokeWidth={3.5} className={p.moderador ? 'opacity-100' : 'opacity-0'} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Lembrete de Poder do Proprietário */}
        <div className="p-3 bg-slate-100 rounded-xl border border-slate-200 text-left space-y-1">
          <p className="text-[11px] text-slate-600 font-bold flex items-center gap-1.5">
            <Crown size={13} className="text-amber-500" />
            <span>Regra do Proprietário:</span>
          </p>
          <p className="text-[10px] text-slate-500 leading-relaxed">
            O criador do grupo possui <strong>poder total e irrestrito</strong> para qualquer ação, independentemente das marcações acima.
          </p>
        </div>

        {/* Botão de Salvar Permissões */}
        {isOwner && (
          <div className="pt-2">
            <button
              type="button"
              disabled={saving || loading}
              onClick={handleSalvar}
              className="w-full py-3.5 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white font-black rounded-2xl shadow-lg active:scale-95 transition-all text-xs flex items-center justify-center gap-2 cursor-pointer border-0"
            >
              {saving ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <Save size={16} />
                  <span>Salvar Configurações de Permissões</span>
                </>
              )}
            </button>
          </div>
        )}
      </div>

      <Dialog
        isOpen={dialog.isOpen}
        title={dialog.title}
        message={dialog.message}
        type={dialog.type}
        onConfirm={dialog.onConfirm}
      />
    </div>
  );
}
