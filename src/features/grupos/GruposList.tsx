import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import type { Grupo, Usuario } from '../../types';
import { Plus, Users, X, UserMinus, UserPlus, CalendarRange, Settings, Check, Shield, Trash2, LogOut, Search, Crown, Link2, Share2 } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Dialog from '../../components/common/Dialog';
import { getPermissoesGrupo, PERMISSOES_PADRAO } from '../../utils/permissoesGrupo';
import type { PermissaoItem } from '../../utils/permissoesGrupo';

export default function GruposList() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [grupos, setGrupos] = useState<Grupo[]>([]);
  const [myMemberships, setMyMemberships] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [newGrupoName, setNewGrupoName] = useState('');
  const [newGrupoPublico, setNewGrupoPublico] = useState(true);
  const [newGrupoFoto, setNewGrupoFoto] = useState<string>('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Estados de Gerenciamento de Membros e Permissões
  const [selectedGrupo, setSelectedGrupo] = useState<Grupo | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string>('');
  const [membros, setMembros] = useState<any[]>([]); // { id, usuario_id, tipo_perfil, status, usuario: Usuario, created_at }
  const [groupPermissions, setGroupPermissions] = useState<PermissaoItem[]>([]);
  const [amigosParaAdicionar, setAmigosParaAdicionar] = useState<Usuario[]>([]);
  const [loadingMembros, setLoadingMembros] = useState(false);
  // Mapa de grupo_id -> contagem de solicitações de entrada pendentes (para grupos que o usuário administra)
  const [pendingGroupRequests, setPendingGroupRequests] = useState<Record<string, number>>({});

  // Estados de Edição do Grupo
  const [isEditingGroup, setIsEditingGroup] = useState(false);
  const [editGroupName, setEditGroupName] = useState('');
  const [editGroupPublico, setEditGroupPublico] = useState(true);
  const [editGroupFoto, setEditGroupFoto] = useState<string>('');

  // Estado do Dialog Customizado
  const [dialog, setDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type: 'alert' | 'confirm';
    onConfirm: () => void;
    onCancel?: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    type: 'alert',
    onConfirm: () => {},
  });

  useEffect(() => {
    fetchCurrentUser();
  }, []);

  const fetchCurrentUser = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from('usuarios')
          .select('id')
          .eq('email', user.email)
          .single();
        if (profile) {
          setCurrentUserId(profile.id);
          await fetchGruposAndMemberships(profile.id);
        }
      }
    } catch (e) {
      console.error('Erro ao buscar usuário atual:', e);
    }
  };

  const fetchGruposAndMemberships = async (userId = currentUserId) => {
    try {
      setLoading(true);
      
      // 1. Buscar todos os grupos
      const { data: gruposData, error: gruposError } = await supabase
        .from('grupos')
        .select('*');
      
      if (gruposError) throw gruposError;
      setGrupos(gruposData as Grupo[]);

      // 2. Buscar associações de grupos do usuário logado
      const targetUserId = userId || currentUserId;
      if (targetUserId) {
        const { data: memData, error: memError } = await supabase
          .from('membros_grupo')
          .select('*')
          .eq('usuario_id', targetUserId);
        
        if (!memError && memData) {
          setMyMemberships(memData);

          // 3. Buscar solicitações de entrada pendentes para os grupos que este usuário administra
          const adminGrupoIds = memData
            .filter((m: any) => m.tipo_perfil === 'A' && m.status === 'aprovado')
            .map((m: any) => m.grupo_id);

          if (adminGrupoIds.length > 0) {
            const { data: pendingMembers, error: pendingError } = await supabase
              .from('membros_grupo')
              .select('grupo_id')
              .in('grupo_id', adminGrupoIds)
              .eq('status', 'pendente');

            if (!pendingError && pendingMembers) {
              const counts: Record<string, number> = {};
              pendingMembers.forEach((p: any) => {
                counts[p.grupo_id] = (counts[p.grupo_id] || 0) + 1;
              });
              setPendingGroupRequests(counts);
            } else {
              setPendingGroupRequests({});
            }
          } else {
            setPendingGroupRequests({});
          }

          // Checar se há convite de entrada na URL (?entrar=ID ou ?invite=ID)
          const inviteId = searchParams.get('entrar') || searchParams.get('invite') || searchParams.get('grupo_id');
          if (inviteId && gruposData) {
            checkInviteFromUrl(inviteId, gruposData as Grupo[], memData || [], targetUserId);
          }
        }
      }
    } catch (e) {
      console.error('Erro ao buscar grupos e associações:', e);
    } finally {
      setLoading(false);
    }
  };

  // Tratar entrada / solicitação via link de convite recebido na URL
  const checkInviteFromUrl = (
    inviteGrupoId: string,
    allGrupos: Grupo[],
    userMemberships: any[],
    _userId: string
  ) => {
    const targetGrupo = allGrupos.find((g) => g.id === inviteGrupoId);
    if (!targetGrupo) return;

    // Limpar o parâmetro da URL para não reabrir a cada reload
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete('entrar');
      next.delete('invite');
      next.delete('grupo_id');
      return next;
    }, { replace: true });

    const existingMem = userMemberships.find((m) => m.grupo_id === inviteGrupoId);

    if (existingMem) {
      if (existingMem.status === 'aprovado') {
        openManageMembers(targetGrupo);
      } else if (existingMem.status === 'pendente') {
        setDialog({
          isOpen: true,
          title: 'Solicitação em Análise ⏳',
          message: `Você já solicitou entrada no grupo "${targetGrupo.nome}". Aguarde a aprovação do Administrador!`,
          type: 'alert',
          onConfirm: () => setDialog((prev) => ({ ...prev, isOpen: false })),
        });
      } else if (existingMem.status === 'convidado') {
        setDialog({
          isOpen: true,
          title: 'Convite Recebido! 📩',
          message: `Você foi convidado para o grupo "${targetGrupo.nome}". Deseja aceitar a entrada agora?`,
          type: 'confirm',
          onConfirm: () => {
            setDialog((prev) => ({ ...prev, isOpen: false }));
            handleAcceptInvite(targetGrupo.id);
          },
          onCancel: () => setDialog((prev) => ({ ...prev, isOpen: false })),
        });
      }
      return;
    }

    // Se ainda não tiver nenhum vínculo com o grupo
    if (targetGrupo.publico) {
      setDialog({
        isOpen: true,
        title: 'Entrar no Grupo 👥',
        message: `Você recebeu um link para participar do grupo público "${targetGrupo.nome}". Deseja entrar agora?`,
        type: 'confirm',
        onConfirm: () => {
          setDialog((prev) => ({ ...prev, isOpen: false }));
          handleJoinPublicGroup(targetGrupo.id);
        },
        onCancel: () => setDialog((prev) => ({ ...prev, isOpen: false })),
      });
    } else {
      setDialog({
        isOpen: true,
        title: 'Solicitar Acesso ao Grupo 🔒',
        message: `Você recebeu um link de convite para o grupo privado "${targetGrupo.nome}". Deseja solicitar acesso para o Administrador aprovar?`,
        type: 'confirm',
        onConfirm: () => {
          setDialog((prev) => ({ ...prev, isOpen: false }));
          handleRequestPrivateGroup(targetGrupo.id);
        },
        onCancel: () => setDialog((prev) => ({ ...prev, isOpen: false })),
      });
    }
  };

  // Compartilhar Link de Convite do Grupo (via WhatsApp / Redes Sociais)
  const handleShareGrupo = async (grupo: Grupo) => {
    const inviteUrl = `${window.location.origin}/grupos?entrar=${grupo.id}`;
    const tipo = grupo.publico ? 'Público (Entrada direta)' : 'Privado (Requer aprovação do Administrador)';
    const texto = `👥 Convite para o Grupo *${grupo.nome}* no GoPlay!\n\nStatus: ${tipo}\n\nClique no link para entrar ou solicitar acesso ao grupo:\n${inviteUrl}`;

    try {
      if (navigator.share) {
        await navigator.share({
          title: `Grupo ${grupo.nome} - GoPlay`,
          text: texto,
          url: inviteUrl,
        });
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(texto);
        setDialog({
          isOpen: true,
          title: 'Link Copiado! 🔗',
          message: `O link de convite do grupo "${grupo.nome}" foi copiado para a área de transferência. Agora é só colar no WhatsApp ou redes sociais!`,
          type: 'alert',
          onConfirm: () => setDialog((prev) => ({ ...prev, isOpen: false })),
        });
      }
    } catch (e) {
      console.warn('Compartilhamento cancelado ou não suportado:', e);
    }
  };

  // Trata o arquivo local selecionado e o converte para Base64 (Criação)
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 1.5 * 1024 * 1024) {
        setDialog({
          isOpen: true,
          title: 'Arquivo Muito Grande',
          message: 'Por favor, selecione uma imagem de até 1.5MB.',
          type: 'alert',
          onConfirm: () => setDialog((prev) => ({ ...prev, isOpen: false })),
        });
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setNewGrupoFoto(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // Trata o arquivo local selecionado e o converte para Base64 (Edição)
  const handleEditFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 1.5 * 1024 * 1024) {
        setDialog({
          isOpen: true,
          title: 'Arquivo Muito Grande',
          message: 'Por favor, selecione uma imagem de até 1.5MB.',
          type: 'alert',
          onConfirm: () => setDialog((prev) => ({ ...prev, isOpen: false })),
        });
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setEditGroupFoto(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCreateGrupo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGrupoName.trim()) return;
    setCreating(true);

    try {
      // 1. Insere o grupo
      const { data: newGroup, error: groupError } = await supabase
        .from('grupos')
        .insert({ 
          nome: newGrupoName.trim(), 
          publico: newGrupoPublico,
          foto: newGrupoFoto || null
        })
        .select()
        .single();

      if (groupError) throw groupError;

      if (newGroup) {
        // 2. Insere o criador como Administrador ('A') e aprovado diretamente
        const { error: memberError } = await supabase
          .from('membros_grupo')
          .insert({
            grupo_id: newGroup.id,
            usuario_id: currentUserId,
            tipo_perfil: 'A',
            status: 'aprovado'
          });

        if (memberError) throw memberError;

        setNewGrupoName('');
        setNewGrupoPublico(true);
        setNewGrupoFoto('');
        setShowAddModal(false);
        await fetchGruposAndMemberships();
      }
    } catch (err: any) {
      console.error(err);
      setDialog({
        isOpen: true,
        title: 'Erro ao Criar Grupo',
        message: err?.message || 'Erro inesperado.',
        type: 'alert',
        onConfirm: () => setDialog((prev) => ({ ...prev, isOpen: false })),
      });
    } finally {
      setCreating(false);
    }
  };

  // Abrir Gerenciamento de Membros
  const openManageMembers = async (grupo: Grupo) => {
    setSelectedGrupo(grupo);
    setEditGroupName(grupo.nome);
    setEditGroupPublico(grupo.publico);
    setEditGroupFoto(grupo.foto || '');
    setIsEditingGroup(false);
    
    // Carregar permissões do grupo em segundo plano
    getPermissoesGrupo(grupo.id).then((perms) => {
      setGroupPermissions(perms);
    }).catch((err) => console.error('Erro ao carregar permissoes:', err));

    await fetchMembersOfSelectedGroup(grupo.id);
  };

  const fetchMembersOfSelectedGroup = async (grupoId: string) => {
    setLoadingMembros(true);
    try {
      // 1. Buscar membros do grupo (aprovados, pendentes e convidados)
      const { data: dbMembros, error: membrosError } = await supabase
        .from('membros_grupo')
        .select(`
          id,
          usuario_id,
          tipo_perfil,
          status,
          created_at,
          usuarios:usuario_id (
            id,
            nome,
            foto,
            email
          )
        `)
        .eq('grupo_id', grupoId);

      if (membrosError) {
        if (membrosError.code === '42P01') {
          throw new Error('A tabela membros_grupo não foi encontrada no banco de dados. Por favor, execute o script SQL.');
        }
        throw membrosError;
      }

      const parsedMembros = (dbMembros || []).map((m: any) => {
        const userObj = Array.isArray(m.usuarios) ? m.usuarios[0] : m.usuarios;
        return {
          id: m.id,
          usuario_id: m.usuario_id,
          tipo_perfil: m.tipo_perfil || 'P',
          status: m.status || 'aprovado',
          usuario: userObj as Usuario,
        };
      }).filter(m => m.usuario !== null && m.usuario !== undefined);

      setMembros(parsedMembros);

      // 2. Buscar amigos do usuário para saber quem ele pode adicionar
      if (currentUserId) {
        const { data: dbAmigos } = await supabase
          .from('amigos')
          .select('*')
          .or(`usuario_id.eq.${currentUserId},amigo_id.eq.${currentUserId}`)
          .eq('ativo', true);

        const amigoIds = (dbAmigos || []).map((a) =>
          a.usuario_id === currentUserId ? a.amigo_id : a.usuario_id
        );

        if (amigoIds.length > 0) {
          // Buscar detalhes dos amigos na tabela usuarios
          const { data: dbUsers } = await supabase
            .from('usuarios')
            .select('*')
            .in('id', amigoIds);

          if (dbUsers) {
            // Filtrar amigos que já NÃO sejam membros do grupo (ativos, pendentes ou convidados)
            const filtrados = (dbUsers as Usuario[]).filter(
              (amigo) => !parsedMembros.some((m) => m.usuario_id === amigo.id)
            );
            setAmigosParaAdicionar(filtrados);
          }
        } else {
          setAmigosParaAdicionar([]);
        }
      }
    } catch (e: any) {
      setDialog({
        isOpen: true,
        title: 'Erro ao Carregar Membros',
        message: e.message || 'Erro ao carregar membros do grupo.',
        type: 'alert',
        onConfirm: () => {
          setDialog((prev) => ({ ...prev, isOpen: false }));
          setSelectedGrupo(null);
        },
      });
    } finally {
      setLoadingMembros(false);
    }
  };

  // Enviar convite a amigo pelo Admin (status = 'convidado')
  const handleAddMembro = async (friend: Usuario) => {
    if (!selectedGrupo) return;
    try {
      const { data, error } = await supabase
        .from('membros_grupo')
        .insert({
          grupo_id: selectedGrupo.id,
          usuario_id: friend.id,
          tipo_perfil: 'P',
          status: 'convidado' // Alterado para convidar em vez de inserir direto
        })
        .select(`
          id,
          usuario_id,
          tipo_perfil,
          status,
          usuarios:usuario_id (
            id,
            nome,
            foto,
            email
          )
        `)
        .single();

      if (!error && data) {
        const userObj = Array.isArray(data.usuarios) ? data.usuarios[0] : data.usuarios;
        const novoMembro = {
          id: data.id,
          usuario_id: data.usuario_id,
          tipo_perfil: data.tipo_perfil || 'P',
          status: data.status || 'convidado',
          usuario: userObj as Usuario,
        };
        setMembros((prev) => [...prev, novoMembro]);
        setAmigosParaAdicionar((prev) => prev.filter((a) => a.id !== friend.id));
      } else {
        console.error('Erro ao enviar convite:', error);
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Remover Membro ou Cancelar Convite (Por Admin)
  const handleRemoveMembro = async (membroId: string, usuario: Usuario) => {
    const memObj = membros.find(m => m.id === membroId);
    const isInvite = memObj?.status === 'convidado';
    setDialog({
      isOpen: true,
      title: isInvite ? 'Cancelar Convite' : 'Remover Integrante',
      message: isInvite 
        ? `Deseja realmente cancelar o convite enviado para ${usuario.nome}?` 
        : `Deseja realmente remover ${usuario.nome} do grupo?`,
      type: 'confirm',
      onConfirm: async () => {
        setDialog((prev) => ({ ...prev, isOpen: false }));
        try {
          const { error } = await supabase
            .from('membros_grupo')
            .delete()
            .eq('id', membroId);

          if (!error) {
            setMembros((prev) => prev.filter((m) => m.id !== membroId));
            setAmigosParaAdicionar((prev) => [...prev, usuario]);
          } else {
            console.error('Erro ao deletar membro/convite:', error);
          }
        } catch (e) {
          console.error(e);
        }
      },
      onCancel: () => setDialog((prev) => ({ ...prev, isOpen: false })),
    });
  };

  // Entrar em um/ Aceitar Entrada em Grupo Público
  const handleJoinPublicGroup = async (grupoId: string) => {
    try {
      const { data: admins } = await supabase
        .from('membros_grupo')
        .select('id')
        .eq('grupo_id', grupoId)
        .eq('tipo_perfil', 'A')
        .eq('status', 'aprovado')
        .limit(1);

      const hasAdmin = admins && admins.length > 0;
      const roleToAssign = hasAdmin ? 'P' : 'A';

      const { error } = await supabase
        .from('membros_grupo')
        .insert({
          grupo_id: grupoId,
          usuario_id: currentUserId,
          tipo_perfil: roleToAssign,
          status: 'aprovado'
        });

      if (!error) {
        await fetchGruposAndMemberships();
      } else {
        console.error('Erro ao entrar no grupo:', error);
        setDialog({
          isOpen: true,
          title: 'Erro ao Entrar no Grupo',
          message: error.message || 'Erro inesperado.',
          type: 'alert',
          onConfirm: () => setDialog((prev) => ({ ...prev, isOpen: false })),
        });
      }
    } catch (e: any) {
      console.error(e);
      setDialog({
        isOpen: true,
        title: 'Erro inesperado',
        message: e.message || 'Erro de conexão.',
        type: 'alert',
        onConfirm: () => setDialog((prev) => ({ ...prev, isOpen: false })),
      });
    }
  };

  // Aceitar Convite Recebido (Membro)
  const handleAcceptInvite = async (grupoId: string) => {
    try {
      const { error } = await supabase
        .from('membros_grupo')
        .update({ status: 'aprovado' })
        .eq('grupo_id', grupoId)
        .eq('usuario_id', currentUserId);

      if (!error) {
        await fetchGruposAndMemberships();
      } else {
        console.error('Erro ao aceitar convite:', error);
        setDialog({
          isOpen: true,
          title: 'Erro ao Aceitar Convite',
          message: error.message || 'Erro inesperado.',
          type: 'alert',
          onConfirm: () => setDialog((prev) => ({ ...prev, isOpen: false })),
        });
      }
    } catch (e: any) {
      console.error(e);
    }
  };

  // Recusar Convite Recebido (Membro)
  const handleDeclineInvite = async (grupoId: string) => {
    try {
      const { error } = await supabase
        .from('membros_grupo')
        .delete()
        .eq('grupo_id', grupoId)
        .eq('usuario_id', currentUserId);

      if (!error) {
        await fetchGruposAndMemberships();
      } else {
        console.error('Erro ao recusar convite:', error);
        setDialog({
          isOpen: true,
          title: 'Erro ao Recusar Convite',
          message: error.message || 'Erro inesperado.',
          type: 'alert',
          onConfirm: () => setDialog((prev) => ({ ...prev, isOpen: false })),
        });
      }
    } catch (e: any) {
      console.error(e);
    }
  };

  // Solicitar Entrada em um Grupo Privado
  const handleRequestPrivateGroup = async (grupoId: string) => {
    try {
      const { error } = await supabase
        .from('membros_grupo')
        .insert({
          grupo_id: grupoId,
          usuario_id: currentUserId,
          tipo_perfil: 'P',
          status: 'pendente'
        });

      if (!error) {
        await fetchGruposAndMemberships();
      } else {
        console.error('Erro ao solicitar entrada:', error);
        setDialog({
          isOpen: true,
          title: 'Erro ao Solicitar Entrada',
          message: error.message || 'Erro inesperado.',
          type: 'alert',
          onConfirm: () => setDialog((prev) => ({ ...prev, isOpen: false })),
        });
      }
    } catch (e: any) {
      console.error(e);
      setDialog({
        isOpen: true,
        title: 'Erro inesperado',
        message: e.message || 'Erro de conexão.',
        type: 'alert',
        onConfirm: () => setDialog((prev) => ({ ...prev, isOpen: false })),
      });
    }
  };

  // Cancelar Solicitação Pendente (Pelo Usuário)
  const handleCancelRequest = async (grupoId: string) => {
    try {
      const { error } = await supabase
        .from('membros_grupo')
        .delete()
        .eq('grupo_id', grupoId)
        .eq('usuario_id', currentUserId)
        .eq('status', 'pendente');

      if (!error) {
        await fetchGruposAndMemberships();
      } else {
        console.error('Erro ao cancelar solicitação:', error);
        setDialog({
          isOpen: true,
          title: 'Erro ao Cancelar Solicitação',
          message: error.message || 'Erro inesperado.',
          type: 'alert',
          onConfirm: () => setDialog((prev) => ({ ...prev, isOpen: false })),
        });
      }
    } catch (e: any) {
      console.error(e);
      setDialog({
        isOpen: true,
        title: 'Erro inesperado',
        message: e.message || 'Erro de conexão.',
        type: 'alert',
        onConfirm: () => setDialog((prev) => ({ ...prev, isOpen: false })),
      });
    }
  };

  // Sair de um Grupo (Membro)
  const handleLeaveGroup = async (grupoId: string) => {
    setDialog({
      isOpen: true,
      title: 'Sair do Grupo',
      message: 'Deseja realmente sair deste grupo?',
      type: 'confirm',
      onConfirm: async () => {
        setDialog((prev) => ({ ...prev, isOpen: false }));
        try {
          const { error } = await supabase
            .from('membros_grupo')
            .delete()
            .eq('grupo_id', grupoId)
            .eq('usuario_id', currentUserId);

          if (!error) {
            setSelectedGrupo(null);
            await fetchGruposAndMemberships();
          } else {
            console.error('Erro ao sair do grupo:', error);
            setDialog({
              isOpen: true,
              title: 'Erro ao Sair do Grupo',
              message: error.message || 'Erro inesperado.',
              type: 'alert',
              onConfirm: () => setDialog((prev) => ({ ...prev, isOpen: false })),
            });
          }
        } catch (e: any) {
          console.error(e);
          setDialog({
            isOpen: true,
            title: 'Erro inesperado',
            message: e.message || 'Erro de conexão.',
            type: 'alert',
            onConfirm: () => setDialog((prev) => ({ ...prev, isOpen: false })),
          });
        }
      },
      onCancel: () => setDialog((prev) => ({ ...prev, isOpen: false })),
    });
  };

  // Excluir Grupo (Admin)
  const handleDeleteGroup = async (grupoId: string) => {
    setDialog({
      isOpen: true,
      title: 'Excluir Grupo',
      message: 'Deseja realmente excluir este grupo? Todas as partidas associadas e a lista de membros serão apagadas. Esta ação é irreversível.',
      type: 'confirm',
      onConfirm: async () => {
        setDialog((prev) => ({ ...prev, isOpen: false }));
        try {
          // Deleta todos os membros associados
          await supabase.from('membros_grupo').delete().eq('grupo_id', grupoId);
          // Deleta o grupo
          const { error } = await supabase.from('grupos').delete().eq('id', grupoId);

          if (!error) {
            setSelectedGrupo(null);
            await fetchGruposAndMemberships();
          } else {
            console.error('Erro ao deletar grupo:', error);
            setDialog({
              isOpen: true,
              title: 'Erro ao Deletar Grupo',
              message: error.message || 'Erro inesperado.',
              type: 'alert',
              onConfirm: () => setDialog((prev) => ({ ...prev, isOpen: false })),
            });
          }
        } catch (e: any) {
          console.error(e);
          setDialog({
            isOpen: true,
            title: 'Erro inesperado',
            message: e.message || 'Erro de conexão.',
            type: 'alert',
            onConfirm: () => setDialog((prev) => ({ ...prev, isOpen: false })),
          });
        }
      },
      onCancel: () => setDialog((prev) => ({ ...prev, isOpen: false })),
    });
  };

  // Atualizar Detalhes do Grupo (Admin)
  const handleUpdateGroupDetails = async () => {
    if (!selectedGrupo || !editGroupName.trim()) return;
    try {
      const { error } = await supabase
        .from('grupos')
        .update({
          nome: editGroupName.trim(),
          publico: editGroupPublico,
          foto: editGroupFoto || null
        })
        .eq('id', selectedGrupo.id);

      if (!error) {
        setSelectedGrupo((prev) => prev ? { ...prev, nome: editGroupName.trim(), publico: editGroupPublico, foto: editGroupFoto || undefined } : null);
        setIsEditingGroup(false);
        await fetchGruposAndMemberships();
      } else {
        console.error('Erro ao atualizar detalhes do grupo:', error);
        setDialog({
          isOpen: true,
          title: 'Erro ao Atualizar',
          message: error.message || 'Não foi possível salvar as alterações.',
          type: 'alert',
          onConfirm: () => setDialog((prev) => ({ ...prev, isOpen: false })),
        });
      }
    } catch (e: any) {
      console.error(e);
    }
  };

  // Aprovar Solicitação de Entrada (Admin)
  const handleApproveRequest = async (membroRowId: string) => {
    try {
      const { error } = await supabase
        .from('membros_grupo')
        .update({ status: 'aprovado' })
        .eq('id', membroRowId);

      if (!error && selectedGrupo) {
        await fetchMembersOfSelectedGroup(selectedGrupo.id);
        await fetchGruposAndMemberships();
        window.dispatchEvent(new CustomEvent('goplay:refresh-notifications'));
      } else {
        console.error('Erro ao aprovar solicitação:', error);
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Recusar/Deletar Solicitação de Entrada (Admin)
  const handleDeclineRequest = async (membroRowId: string) => {
    try {
      const { error } = await supabase
        .from('membros_grupo')
        .delete()
        .eq('id', membroRowId);

      if (!error && selectedGrupo) {
        await fetchMembersOfSelectedGroup(selectedGrupo.id);
        await fetchGruposAndMemberships();
        window.dispatchEvent(new CustomEvent('goplay:refresh-notifications'));
      } else {
        console.error('Erro ao recusar solicitação:', error);
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Alterar Cargo do Integrante (Admin <=> Membro)
  const handleToggleMemberRole = async (membroRowId: string, currentRole: 'A' | 'M' | 'P') => {
    const newRole = currentRole === 'A' ? 'P' : 'A';
    try {
      const { error } = await supabase
        .from('membros_grupo')
        .update({ tipo_perfil: newRole })
        .eq('id', membroRowId);

      if (!error && selectedGrupo) {
        await fetchMembersOfSelectedGroup(selectedGrupo.id);
      } else {
        console.error('Erro ao alterar cargo:', error);
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Filtro de pesquisa de grupos em tempo real
  const filteredAllGrupos = grupos.filter((g) =>
    g.nome.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Separação de grupos para exibição
  const meusGruposRaw = filteredAllGrupos.filter((g) =>
    myMemberships.some((m) => m.grupo_id === g.id && m.status === 'aprovado')
  );

  // Prioriza grupos que possuem solicitações pendentes no topo da lista
  const meusGrupos = [...meusGruposRaw].sort((a, b) => {
    const pendA = pendingGroupRequests[a.id] || 0;
    const pendB = pendingGroupRequests[b.id] || 0;
    if (pendA !== pendB) {
      return pendB - pendA; // Mais pendências primeiro
    }
    return a.nome.localeCompare(b.nome);
  });

  const convitesRecebidos = filteredAllGrupos.filter((g) =>
    myMemberships.some((m) => m.grupo_id === g.id && m.status === 'convidado')
  );

  const solicitacoesEnviadas = filteredAllGrupos.filter((g) =>
    myMemberships.some((m) => m.grupo_id === g.id && m.status === 'pendente')
  );

  const gruposDisponiveis = filteredAllGrupos.filter((g) =>
    !myMemberships.some((m) => m.grupo_id === g.id)
  );

  // Encontrar cargo do usuário logado no grupo selecionado
  const myMemSelected = selectedGrupo 
    ? membros.find((m) => m.usuario_id === currentUserId && m.status === 'aprovado') 
    : null;
  const isAdmin = myMemSelected?.tipo_perfil === 'A';

  // Identificar se o usuário logado é o Proprietário do Grupo
  const isOwner = selectedGrupo ? (
    ((selectedGrupo as any).criador_id && (selectedGrupo as any).criador_id === currentUserId) ||
    (membros
      .filter((m) => m.tipo_perfil === 'A' && m.status === 'aprovado')
      .sort((a, b) => new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime())[0]?.usuario_id === currentUserId)
  ) : false;

  // Checar se o usuário atual tem uma permissão específica no grupo selecionado
  const hasPermission = (nomePermissao: string) => {
    if (isOwner) return true; // Proprietário tem poder absoluto irrestrito
    if (!myMemSelected) return false;
    const p = groupPermissions.find((item) => item.nome.toLowerCase() === nomePermissao.toLowerCase());
    if (!p) {
      const def = PERMISSOES_PADRAO.find((item) => item.nome.toLowerCase() === nomePermissao.toLowerCase());
      return isAdmin ? Boolean(def?.defaultModerador) : Boolean(def?.defaultUsuario);
    }
    return isAdmin ? p.moderador : p.usuario;
  };

  const membrosAtivos = membros.filter((m) => m.status === 'aprovado');
  const membrosPendentes = membros.filter((m) => m.status === 'pendente');
  const membrosConvidados = membros.filter((m) => m.status === 'convidado');

  return (
    <div className="px-4 py-3 pb-24 w-full max-w-md mx-auto min-h-[calc(100vh-8rem)]">
      <div className="flex justify-between items-center mb-5 pl-14 h-11">
        <h1 className="text-2xl font-black text-slate-900 leading-none">Grupos</h1>
        <button
          onClick={() => setShowAddModal(true)}
          className="p-2.5 bg-gradient-to-r from-[#eb3237] to-red-650 hover:from-red-500 hover:to-red-600 text-white rounded-xl shadow-lg active:scale-95 transition-all cursor-pointer"
        >
          <Plus size={18} />
        </button>
      </div>

      {/* Barra de Pesquisa de Grupos */}
      <div className="relative mb-5 text-left">
        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
          <Search size={16} />
        </div>
        <input
          type="text"
          placeholder="Pesquisar grupos pelo nome..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 pl-10 pr-4 text-slate-950 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-red-500 placeholder:text-slate-400 transition-all shadow-xs"
        />
      </div>

      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass p-6 rounded-2xl w-full max-w-sm space-y-4 text-left">
            <h2 className="text-xl font-bold text-slate-900">Novo Grupo</h2>
            <form onSubmit={handleCreateGrupo} className="space-y-4">
              
              {/* Imagem do Grupo */}
              <div className="space-y-1.5 flex flex-col items-center">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider self-start">Foto do Grupo</label>
                <div className="relative group w-20 h-20 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center overflow-hidden transition-all shadow-xs">
                  {newGrupoFoto ? (
                    <>
                      <img src={newGrupoFoto} alt="Preview" className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => setNewGrupoFoto('')}
                        className="absolute top-1 right-1 p-1 bg-black/60 rounded-full text-white hover:bg-black transition-colors cursor-pointer"
                      >
                        <X size={10} />
                      </button>
                    </>
                  ) : (
                    <Users size={32} className="text-slate-400" />
                  )}
                </div>
                <label className="cursor-pointer py-1.5 px-3 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-bold rounded-xl transition-all border border-slate-200 shadow-xs">
                  <span>Selecionar Foto</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </label>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Nome do Grupo</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Futebol de Quarta..."
                  value={newGrupoName}
                  onChange={(e) => setNewGrupoName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Privacidade</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setNewGrupoPublico(true)}
                    className={`py-2.5 px-3 rounded-xl border text-xs font-bold transition-all cursor-pointer text-center ${
                      newGrupoPublico
                        ? 'bg-red-50 border-red-500 text-red-600'
                        : 'bg-slate-50 border-slate-200 text-slate-650 hover:bg-slate-100'
                    }`}
                  >
                    Público
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewGrupoPublico(false)}
                    className={`py-2.5 px-3 rounded-xl border text-xs font-bold transition-all cursor-pointer text-center ${
                      !newGrupoPublico
                        ? 'bg-red-50 border-red-500 text-red-600'
                        : 'bg-slate-50 border-slate-200 text-slate-650 hover:bg-slate-100'
                    }`}
                  >
                    Privado
                  </button>
                </div>
                <p className="text-[10px] text-slate-500 leading-tight">
                  {newGrupoPublico
                    ? 'Qualquer usuário poderá visualizar e entrar no grupo diretamente.'
                    : 'Novos membros devem solicitar a entrada, e o administrador precisa aprovar.'}
                </p>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-655 rounded-xl text-sm font-bold cursor-pointer text-center"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="flex-1 py-2.5 bg-red-600 hover:bg-red-500 text-white rounded-xl font-bold text-sm flex justify-center items-center cursor-pointer text-center"
                >
                  {creating ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : 'Criar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center items-center h-48">
          <div className="w-8 h-8 border-4 border-red-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="space-y-6 text-left">
          
          {/* 0. CONVITES RECEBIDOS */}
          {convitesRecebidos.length > 0 && (
            <div className="space-y-3 mb-6">
              <div className="flex items-center gap-2 mb-2">
                <h2 className="text-xs font-black text-[#eb3237] uppercase tracking-widest flex items-center gap-1.5 animate-pulse">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#eb3237]" />
                  Convites Recebidos
                </h2>
                <span className="bg-red-50 text-[#eb3237] text-[10px] font-bold px-2 py-0.5 rounded-full">
                  {convitesRecebidos.length}
                </span>
              </div>
              <div className="grid grid-cols-1 gap-3">
                {convitesRecebidos.map((grupo) => (
                  <div
                    key={grupo.id}
                    className="bg-red-50/10 p-4 rounded-2xl border border-red-200/40 flex items-center justify-between shadow-xs animate-fade-in"
                  >
                    <div className="flex items-center gap-3">
                      {grupo.foto ? (
                        <img src={grupo.foto} alt={grupo.nome} className="w-9 h-9 rounded-xl object-cover shrink-0 border border-red-100" />
                      ) : (
                        <div className="w-9 h-9 rounded-xl bg-red-600/10 text-red-500 flex items-center justify-center shrink-0">
                          <Users size={18} />
                        </div>
                      )}
                      <div>
                        <h3 className="font-extrabold text-slate-850 text-sm leading-tight">{grupo.nome}</h3>
                        <p className="text-[10px] text-slate-450 mt-0.5">Você foi convidado para o grupo</p>
                      </div>
                    </div>
                    
                    <div className="flex gap-1.5 shrink-0">
                      <button
                        onClick={() => handleAcceptInvite(grupo.id)}
                        className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl cursor-pointer transition-all shadow-xs"
                      >
                        Aceitar
                      </button>
                      <button
                        onClick={() => handleDeclineInvite(grupo.id)}
                        className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl cursor-pointer transition-all border border-slate-200"
                      >
                        Recusar
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 1. MEUS GRUPOS */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 mb-2">
              <h2 className="text-xs font-black text-slate-500 uppercase tracking-widest">Meus Grupos</h2>
              <span className="bg-slate-100 text-slate-600 text-[10px] font-bold px-2 py-0.5 rounded-full">
                {meusGrupos.length}
              </span>
            </div>
            {meusGrupos.length === 0 ? (
              <div className="text-center py-8 glass rounded-2xl border border-slate-150">
                <Users size={32} className="mx-auto text-slate-400 mb-2" />
                <p className="text-slate-600 text-xs font-medium">Você ainda não está em nenhum grupo.</p>
                <p className="text-[10px] text-slate-450 mt-1">Crie um grupo ou solicite entrada em um existente.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3">
                {meusGrupos.map((grupo) => {
                  const myMem = myMemberships.find((m) => m.grupo_id === grupo.id);
                  const isUserAdmin = myMem?.tipo_perfil === 'A';
                  const pendingCount = isUserAdmin ? (pendingGroupRequests[grupo.id] || 0) : 0;
                  const hasPending = pendingCount > 0;

                  return (
                    <div
                      key={grupo.id}
                      onClick={() => openManageMembers(grupo)}
                      className={`glass p-4 rounded-2xl border transition-all flex items-center justify-between shadow-xs cursor-pointer active:scale-[0.99] animate-fade-in ${
                        hasPending
                          ? 'border-red-400/80 bg-red-50/25 hover:border-red-500 hover:bg-red-50/35 ring-1 ring-red-400/30'
                          : 'border-slate-200 hover:border-red-650/40'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1 pr-2">
                        <div className="relative shrink-0">
                          {grupo.foto ? (
                            <img src={grupo.foto} alt={grupo.nome} className="w-10 h-10 rounded-xl object-cover shrink-0 border border-slate-150" />
                          ) : (
                            <div className="w-10 h-10 rounded-xl bg-red-600/10 text-red-500 flex items-center justify-center shrink-0">
                              <Users size={20} />
                            </div>
                          )}
                          {hasPending && (
                            <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-red-600 border-2 border-white rounded-full flex items-center justify-center animate-pulse" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-extrabold text-slate-850 text-sm leading-tight truncate">{grupo.nome}</h3>
                            {grupo.publico ? (
                              <span className="bg-emerald-50 text-emerald-600 border border-emerald-100 text-[8px] font-bold px-1.5 py-0.5 rounded uppercase">Público</span>
                            ) : (
                              <span className="bg-amber-50 text-amber-600 border border-amber-100 text-[8px] font-bold px-1.5 py-0.5 rounded uppercase">Privado</span>
                            )}
                          </div>
                          {hasPending ? (
                            <p className="text-[9px] font-black text-red-600 uppercase tracking-wider mt-1 flex items-center gap-1.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-red-600 animate-ping inline-block" />
                              Administrar Grupo • {pendingCount} nova{pendingCount > 1 ? 's' : ''} solicitação{pendingCount > 1 ? 'ões' : ''}
                            </p>
                          ) : (
                            <p className="text-[9px] font-bold text-red-500 uppercase tracking-wider mt-1">
                              {isUserAdmin ? 'Administrar Grupo' : 'Ver Integrantes'}
                            </p>
                          )}
                        </div>
                      </div>

                      {hasPending && (
                        <div className="shrink-0 pl-2">
                          <span className="bg-gradient-to-r from-red-600 to-rose-600 text-white text-[10px] font-black px-2.5 py-1 rounded-full shadow-xs flex items-center gap-1 animate-pulse">
                            <Users size={12} />
                            <span>{pendingCount} {pendingCount === 1 ? 'pendente' : 'pendentes'}</span>
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* 2. SOLICITAÇÕES ENVIADAS */}
          {solicitacoesEnviadas.length > 0 && (
            <div className="space-y-3 pt-2">
              <div className="flex items-center gap-2 mb-2">
                <h2 className="text-xs font-black text-amber-600 uppercase tracking-widest flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                  Solicitações de Entrada
                </h2>
                <span className="bg-amber-50 text-amber-600 text-[10px] font-bold px-2 py-0.5 rounded-full">
                  {solicitacoesEnviadas.length}
                </span>
              </div>
              <div className="grid grid-cols-1 gap-3">
                {solicitacoesEnviadas.map((grupo) => (
                  <div
                    key={grupo.id}
                    className="bg-amber-50/20 p-4 rounded-2xl border border-amber-100 flex items-center justify-between animate-fade-in"
                  >
                    <div className="flex items-center gap-3">
                      {grupo.foto ? (
                        <img src={grupo.foto} alt={grupo.nome} className="w-9 h-9 rounded-xl object-cover shrink-0 border border-amber-150" />
                      ) : (
                        <div className="w-9 h-9 rounded-xl bg-amber-150/40 text-amber-600 flex items-center justify-center shrink-0">
                          <Users size={18} />
                        </div>
                      )}
                      <div>
                        <h3 className="font-bold text-slate-800 text-sm leading-tight">{grupo.nome}</h3>
                        <p className="text-[10px] text-amber-600 font-semibold mt-0.5">Aguardando liberação do Admin</p>
                      </div>
                    </div>
                    <button
                      onClick={() => handleCancelRequest(grupo.id)}
                      className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl cursor-pointer transition-all border border-slate-200"
                    >
                      Cancelar
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 3. GRUPOS DISPONÍVEIS */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center gap-2 mb-2">
              <h2 className="text-xs font-black text-slate-500 uppercase tracking-widest">Grupos Disponíveis</h2>
              <span className="bg-slate-100 text-slate-600 text-[10px] font-bold px-2 py-0.5 rounded-full">
                {gruposDisponiveis.length}
              </span>
            </div>
            {gruposDisponiveis.length === 0 ? (
              <div className="text-center py-6 bg-slate-50 rounded-2xl border border-dashed border-slate-150">
                <p className="text-slate-555 text-xs font-medium">Nenhum outro grupo disponível no momento.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3">
                {gruposDisponiveis.map((grupo) => (
                  <div
                    key={grupo.id}
                    className="glass p-4 rounded-2xl border border-slate-200 flex items-center justify-between shadow-xs animate-fade-in"
                  >
                    <div className="flex items-center gap-3">
                      {grupo.foto ? (
                        <img src={grupo.foto} alt={grupo.nome} className="w-9 h-9 rounded-xl object-cover shrink-0 border border-slate-150" />
                      ) : (
                        <div className="w-9 h-9 rounded-xl bg-slate-100 text-slate-500 flex items-center justify-center shrink-0">
                          <Users size={18} />
                        </div>
                      )}
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-bold text-slate-800 text-sm leading-tight">{grupo.nome}</h3>
                          {grupo.publico ? (
                            <span className="bg-emerald-50 text-emerald-600 text-[8px] font-bold px-1.5 py-0.5 rounded uppercase">Público</span>
                          ) : (
                            <span className="bg-amber-50 text-amber-600 text-[8px] font-bold px-1.5 py-0.5 rounded uppercase">Privado</span>
                          )}
                        </div>
                        <p className="text-[10px] text-slate-450 mt-0.5">
                          {grupo.publico ? 'Entrada direta' : 'Requer aprovação'}
                        </p>
                      </div>
                    </div>
                    
                    <button
                      onClick={() => grupo.publico ? handleJoinPublicGroup(grupo.id) : handleRequestPrivateGroup(grupo.id)}
                      className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer shadow-xs active:scale-95 text-center ${
                        grupo.publico
                          ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                          : 'bg-amber-500 hover:bg-amber-450 text-white'
                      }`}
                    >
                      {grupo.publico ? 'Entrar' : 'Solicitar'}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL DETALHADO DO GRUPO (GERENCIAR MEMBROS E CONFIGURAÇÕES) */}
      {selectedGrupo && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="glass p-5 rounded-2xl w-full max-w-sm my-8 flex flex-col max-h-[85vh] text-left">
            
            {/* Header do Modal */}
            {isEditingGroup ? (
              <div className="space-y-3 w-full border-b border-slate-200 pb-3 mb-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-slate-450 uppercase tracking-widest">Configurações do Grupo</h3>
                  <button
                    onClick={() => setIsEditingGroup(false)}
                    className="p-1 hover:bg-slate-100 rounded-lg text-slate-500 transition-colors cursor-pointer"
                  >
                    <X size={16} />
                  </button>
                </div>

                {/* Edição da Foto */}
                <div className="space-y-1.5 flex flex-col items-center">
                  <label className="text-[10px] font-bold text-slate-700 uppercase tracking-wider self-start">Foto do Grupo</label>
                  <div className="relative group w-18 h-18 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center overflow-hidden transition-all shadow-xs">
                    {editGroupFoto ? (
                      <>
                        <img src={editGroupFoto} alt="Preview" className="w-full h-full object-cover" />
                        <button
                          type="button"
                          onClick={() => setEditGroupFoto('')}
                          className="absolute top-1 right-1 p-1 bg-black/60 rounded-full text-white hover:bg-black transition-colors cursor-pointer"
                        >
                          <X size={10} />
                        </button>
                      </>
                    ) : (
                      <Users size={28} className="text-slate-400" />
                    )}
                  </div>
                  <label className="cursor-pointer py-1 px-3 bg-slate-50 hover:bg-slate-100 text-slate-700 text-[10px] font-bold rounded-xl transition-all border border-slate-200 shadow-xs">
                    <span>Alterar Foto</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleEditFileChange}
                      className="hidden"
                    />
                  </label>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-700 uppercase tracking-wider">Nome do Grupo</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={editGroupName}
                      onChange={(e) => setEditGroupName(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 text-slate-900 text-xs focus:outline-none focus:ring-1 focus:ring-red-500 font-bold"
                      placeholder="Nome do grupo..."
                    />
                  </div>
                </div>
                
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-700 uppercase tracking-wider">Privacidade</label>
                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      type="button"
                      onClick={() => setEditGroupPublico(true)}
                      className={`py-2 px-3 rounded-xl border text-[10px] font-bold transition-all cursor-pointer text-center ${
                        editGroupPublico
                          ? 'bg-red-50 border-red-500 text-red-600'
                          : 'bg-white border-slate-200 text-slate-655 hover:bg-slate-50'
                      }`}
                    >
                      Público
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditGroupPublico(false)}
                      className={`py-2 px-3 rounded-xl border text-[10px] font-bold transition-all cursor-pointer text-center ${
                        !editGroupPublico
                          ? 'bg-red-50 border-red-500 text-red-600'
                          : 'bg-white border-slate-200 text-slate-655 hover:bg-slate-50'
                      }`}
                    >
                      Privado
                    </button>
                  </div>
                </div>
                
                <div className="flex gap-2 pt-2">
                  <button
                    onClick={handleUpdateGroupDetails}
                    className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-550 text-white rounded-xl active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-1.5 text-xs font-bold"
                  >
                    <Check size={14} />
                    <span>Salvar</span>
                  </button>
                  <button
                    onClick={() => setIsEditingGroup(false)}
                    className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-1.5 text-xs font-bold"
                  >
                    <X size={14} />
                    <span>Cancelar</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex justify-between items-start border-b border-slate-200 pb-3 mb-4 w-full">
                <div className="flex items-center gap-3 min-w-0 flex-1 pr-2">
                  {selectedGrupo.foto ? (
                    <img src={selectedGrupo.foto} alt={selectedGrupo.nome} className="w-10 h-10 rounded-xl object-cover shrink-0 border border-slate-150" />
                  ) : (
                    <div className="w-10 h-10 rounded-xl bg-red-600/10 text-red-500 flex items-center justify-center shrink-0">
                      <Users size={20} />
                    </div>
                  )}
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <h2 className="text-base font-black text-slate-900 leading-tight truncate">
                        {selectedGrupo.nome}
                      </h2>
                      {selectedGrupo.publico ? (
                        <span className="bg-emerald-50 text-emerald-600 border border-emerald-200 text-[8px] font-bold px-1.5 py-0.5 rounded uppercase shrink-0">
                          Público
                        </span>
                      ) : (
                        <span className="bg-amber-50 text-amber-600 border border-amber-200 text-[8px] font-bold px-1.5 py-0.5 rounded uppercase shrink-0">
                          Privado
                        </span>
                      )}
                    </div>
                    <p className="text-[9px] font-bold text-slate-450 uppercase tracking-widest mt-0.5">
                      {isOwner ? 'Proprietário do Grupo' : isAdmin ? 'Administrador' : 'Integrante do Grupo'}
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center gap-1 shrink-0">
                  {/* Botão Compartilhar Link do Grupo */}
                  <button
                    onClick={() => handleShareGrupo(selectedGrupo)}
                    className="p-1.5 hover:bg-slate-100 rounded-lg text-indigo-600 transition-colors cursor-pointer"
                    title="Copiar Link de Convite do Grupo"
                  >
                    <Link2 size={18} />
                  </button>

                  {isOwner && (
                    <button
                      onClick={() => {
                        const gid = selectedGrupo.id;
                        setSelectedGrupo(null);
                        navigate(`/grupos/${gid}/configuracoes`);
                      }}
                      className="p-1.5 hover:bg-red-50 text-red-600 rounded-lg transition-colors cursor-pointer"
                      title="Configurar Permissões de Usuário e Admin"
                    >
                      <Shield size={18} />
                    </button>
                  )}
                  {isAdmin && (
                    <button
                      onClick={() => setIsEditingGroup(true)}
                      className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
                      title="Editar Grupo"
                    >
                      <Settings size={18} />
                    </button>
                  )}
                  <button 
                    onClick={() => setSelectedGrupo(null)} 
                    className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 transition-colors cursor-pointer"
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>
            )}

            {loadingMembros ? (
              <div className="flex justify-center items-center h-48 flex-1">
                <div className="w-8 h-8 border-4 border-red-600 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto space-y-4 pr-1 no-scrollbar">
                
                {/* 1. SOLICITAÇÕES PENDENTES (Requer permissão de Incluir Usuário ou ser Proprietário) */}
                {hasPermission('Incluir Usuario') && membrosPendentes.length > 0 && (
                  <div className="bg-amber-50/40 p-3 rounded-2xl border border-amber-100 space-y-2">
                    <h3 className="text-[10px] font-bold text-amber-600 uppercase tracking-wider flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                      Solicitações de Entrada ({membrosPendentes.length})
                    </h3>
                    <div className="space-y-2 max-h-36 overflow-y-auto no-scrollbar">
                      {membrosPendentes.map((m) => (
                        <div key={m.id} className="flex items-center justify-between bg-white p-2.5 rounded-xl border border-amber-100">
                          <div className="flex items-center gap-2 min-w-0">
                            {m.usuario.foto ? (
                              <img src={m.usuario.foto} alt={m.usuario.nome} className="w-7 h-7 rounded-full object-cover" />
                            ) : (
                              <div className="w-7 h-7 rounded-full bg-slate-800 text-white flex items-center justify-center font-bold text-[10px]">
                                {m.usuario.nome.charAt(0).toUpperCase()}
                              </div>
                            )}
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-slate-850 truncate leading-tight">{m.usuario.nome}</p>
                              <p className="text-[9px] text-slate-450 truncate">{m.usuario.email}</p>
                            </div>
                          </div>
                          <div className="flex gap-1 shrink-0">
                            <button
                              onClick={() => handleApproveRequest(m.id)}
                              className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-bold rounded-lg cursor-pointer transition-colors"
                            >
                              Liberar
                            </button>
                            <button
                              onClick={() => handleDeclineRequest(m.id)}
                              className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-655 text-[10px] font-bold rounded-lg cursor-pointer transition-colors border border-slate-200"
                            >
                              Recusar
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 1.5. CONVITES ENVIADOS */}
                {hasPermission('Incluir Usuario') && membrosConvidados.length > 0 && (
                  <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200 space-y-2">
                    <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                      Convites Enviados ({membrosConvidados.length})
                    </h3>
                    <div className="space-y-2 max-h-36 overflow-y-auto no-scrollbar">
                      {membrosConvidados.map((m) => (
                        <div key={m.id} className="flex items-center justify-between bg-white p-2.5 rounded-xl border border-slate-150">
                          <div className="flex items-center gap-2 min-w-0">
                            {m.usuario.foto ? (
                              <img src={m.usuario.foto} alt={m.usuario.nome} className="w-7 h-7 rounded-full object-cover" />
                            ) : (
                              <div className="w-7 h-7 rounded-full bg-slate-800 text-white flex items-center justify-center font-bold text-[10px]">
                                {m.usuario.nome.charAt(0).toUpperCase()}
                              </div>
                            )}
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-slate-850 truncate leading-tight">{m.usuario.nome}</p>
                              <p className="text-[9px] text-slate-450 truncate">Aguardando aceitação</p>
                            </div>
                          </div>
                          <button
                            onClick={() => handleRemoveMembro(m.id, m.usuario)}
                            className="p-1.5 hover:bg-red-50 hover:text-red-600 rounded-lg text-slate-500 transition-colors cursor-pointer"
                            title="Cancelar Convite"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 2. INTEGRANTES DO GRUPO */}
                <div className="space-y-2">
                  <h3 className="text-[10px] font-bold text-slate-450 uppercase tracking-wider">
                    Integrantes ({membrosAtivos.length})
                  </h3>
                  {membrosAtivos.length === 0 ? (
                    <p className="text-xs text-slate-450 py-3 text-center bg-slate-50 rounded-xl">
                      Nenhum integrante ativo.
                    </p>
                  ) : (
                    <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1 no-scrollbar">
                      {membrosAtivos.map((m) => (
                        <div
                          key={m.id}
                          className="flex items-center justify-between bg-white p-2 rounded-xl border border-slate-150 shadow-2xs hover:border-slate-200 transition-all"
                        >
                          <div className="flex items-center gap-2.5 min-w-0 flex-1">
                            {m.usuario.foto ? (
                              <img src={m.usuario.foto} alt={m.usuario.nome} className="w-7 h-7 rounded-full object-cover shrink-0" />
                            ) : (
                              <div className="w-7 h-7 rounded-full bg-slate-800 text-white flex items-center justify-center font-bold text-[10px] shrink-0">
                                {m.usuario.nome.charAt(0).toUpperCase()}
                              </div>
                            )}
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-bold text-slate-850 truncate leading-tight">
                                {m.usuario.nome}
                                {m.usuario_id === currentUserId && <span className="text-[9px] text-slate-400 font-normal ml-1">(Você)</span>}
                              </p>
                              <p className="text-[9px] text-slate-400 font-semibold truncate flex items-center gap-1">
                                {m.tipo_perfil === 'A' ? (
                                  <span className="text-red-600 font-bold flex items-center gap-0.5">
                                    <Shield size={10} /> Admin
                                  </span>
                                ) : (
                                  'Membro'
                                )}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            {/* Alterar cargo (Apenas Proprietário) */}
                            {isOwner && m.usuario_id !== currentUserId && (
                              <button
                                onClick={() => handleToggleMemberRole(m.id, m.tipo_perfil)}
                                className="p-1.5 hover:bg-slate-200 rounded-lg text-slate-500 transition-colors cursor-pointer"
                                title={m.tipo_perfil === 'A' ? 'Mudar para Membro Comum' : 'Promover a Administrador'}
                              >
                                <Shield size={14} className={m.tipo_perfil === 'A' ? 'text-red-500' : 'text-slate-400'} />
                              </button>
                            )}
                            
                            {/* Remover Membro (Apenas quem tem permissão de Excluir Usuário) */}
                            {hasPermission('Excluir Usuario') && m.usuario_id !== currentUserId && (
                              <button
                                onClick={() => handleRemoveMembro(m.id, m.usuario)}
                                className="p-1.5 hover:bg-red-50 hover:text-red-600 rounded-lg text-slate-500 transition-colors cursor-pointer"
                                title="Remover do Grupo"
                              >
                                <UserMinus size={14} />
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* 3. CONVIDAR AMIGOS (Requer permissão de Incluir Usuário) */}
                {hasPermission('Incluir Usuario') && (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-[10px] font-bold text-slate-450 uppercase tracking-wider">
                        Convidar Amigos
                      </h3>
                      <button
                        type="button"
                        onClick={() => handleShareGrupo(selectedGrupo)}
                        className="text-[10px] font-extrabold text-indigo-600 hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        <Link2 size={12} />
                        <span>Copiar Link</span>
                      </button>
                    </div>

                    {/* Botão de Destaque: Compartilhar Link de Convite do Grupo */}
                    <button
                      type="button"
                      onClick={() => handleShareGrupo(selectedGrupo)}
                      className="w-full mb-3 py-2.5 px-3 bg-gradient-to-r from-indigo-50 to-blue-50 hover:from-indigo-100 hover:to-blue-100 text-indigo-700 border border-indigo-200 rounded-xl text-xs font-black flex items-center justify-center gap-2 transition-all cursor-pointer shadow-xs active:scale-[0.98]"
                    >
                      <Link2 size={16} className="text-indigo-600" />
                      <span>Compartilhar Link de Convite (WhatsApp / Redes)</span>
                    </button>
                    {amigosParaAdicionar.length === 0 ? (
                      <p className="text-xs text-slate-450 py-3 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200">
                        Nenhum amigo pendente disponível.
                      </p>
                    ) : (
                      <div className="space-y-2 max-h-36 overflow-y-auto no-scrollbar">
                        {amigosParaAdicionar.map((amigo) => (
                          <div key={amigo.id} className="flex items-center justify-between bg-white p-2.5 rounded-xl border border-slate-150">
                            <div className="flex items-center gap-2 min-w-0">
                              {amigo.foto ? (
                                <img src={amigo.foto} alt={amigo.nome} className="w-7 h-7 rounded-full object-cover" />
                              ) : (
                                <div className="w-7 h-7 rounded-full bg-slate-800 text-white flex items-center justify-center font-bold text-[10px]">
                                  {amigo.nome.charAt(0).toUpperCase()}
                                </div>
                              )}
                              <div className="min-w-0">
                                <p className="text-xs font-bold text-slate-800 truncate leading-tight">{amigo.nome}</p>
                                <p className="text-[9px] text-slate-450 truncate">{amigo.email}</p>
                              </div>
                            </div>
                            <button
                              onClick={() => handleAddMembro(amigo)}
                              className="p-1.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg cursor-pointer border border-red-100 shadow-xs"
                              title="Adicionar ao Grupo"
                            >
                              <UserPlus size={14} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

              </div>
            )}

            {/* Ações e Redirecionamentos */}
            <div className="border-t border-slate-200 pt-4 mt-4 space-y-2 flex-shrink-0">
              {/* Atalho para Configurações de Permissões para o Proprietário */}
              {isOwner && (
                <button
                  onClick={() => {
                    const gid = selectedGrupo.id;
                    setSelectedGrupo(null);
                    navigate(`/grupos/${gid}/configuracoes`);
                  }}
                  className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-extrabold rounded-xl text-xs flex justify-center items-center gap-2 cursor-pointer transition-all border border-slate-200"
                >
                  <Shield size={15} className="text-red-600" />
                  <span>Configurações de Permissões</span>
                </button>
              )}

              <button
                onClick={() => {
                  setSelectedGrupo(null);
                  navigate(`/eventos?grupo_id=${selectedGrupo.id}`);
                }}
                className="w-full py-2.5 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white font-bold rounded-xl text-xs flex justify-center items-center gap-2 cursor-pointer shadow-md shadow-red-500/10 active:scale-[0.98] transition-all"
              >
                <CalendarRange size={15} />
                <span>Ver Partidas do Grupo</span>
              </button>

              {/* Criar Novo Evento (Requer permissão de Criar Evento) */}
              {hasPermission('Criar Evento') && (
                <button
                  onClick={() => {
                    setSelectedGrupo(null);
                    navigate(`/eventos/novo?grupo_id=${selectedGrupo.id}`);
                  }}
                  className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs flex justify-center items-center gap-2 cursor-pointer shadow-md shadow-emerald-500/10 active:scale-[0.98] transition-all"
                >
                  <Plus size={15} />
                  <span>Criar Novo Evento</span>
                </button>
              )}

              <div className="pt-2 border-t border-dashed border-slate-200">
                {isAdmin ? (
                  <button
                    onClick={() => handleDeleteGroup(selectedGrupo.id)}
                    className="w-full py-2.5 bg-red-50 hover:bg-red-100 text-red-600 font-bold rounded-xl text-xs flex justify-center items-center gap-2 cursor-pointer active:scale-[0.98] transition-all border border-red-100"
                  >
                    <Trash2 size={15} />
                    <span>Excluir Grupo</span>
                  </button>
                ) : (
                  <button
                    onClick={() => handleLeaveGroup(selectedGrupo.id)}
                    className="w-full py-2.5 bg-slate-50 hover:bg-slate-100 text-slate-700 font-bold rounded-xl text-xs flex justify-center items-center gap-2 cursor-pointer active:scale-[0.98] transition-all border border-slate-200"
                  >
                    <LogOut size={15} />
                    <span>Sair do Grupo</span>
                  </button>
                )}
              </div>
            </div>

          </div>
        </div>
      )}

      <Dialog {...dialog} />
    </div>
  );
}
