import { supabase } from '../lib/supabase';
import type { Parametro, GrupoParametro } from '../types';

export const PERMISSOES_PADRAO = [
  { nome: 'Criar Evento', tipo: 'EVENTO', defaultUsuario: true, defaultModerador: true },
  { nome: 'Alterar Evento', tipo: 'EVENTO', defaultUsuario: false, defaultModerador: true },
  { nome: 'Excluir Evento', tipo: 'EVENTO', defaultUsuario: false, defaultModerador: true },
  { nome: 'Incluir Usuario', tipo: 'USUARIO', defaultUsuario: false, defaultModerador: true },
  { nome: 'Excluir Usuario', tipo: 'USUARIO', defaultUsuario: false, defaultModerador: false },
] as const;

export type NomePermissao = (typeof PERMISSOES_PADRAO)[number]['nome'];

export interface PermissaoItem {
  parametroId: string;
  nome: string;
  tipoParametro: string;
  usuario: boolean;
  moderador: boolean;
}

/**
 * Busca a lista de parâmetros do banco e as configurações de um grupo.
 * Se algum parâmetro ainda não estiver salvo para o grupo, preenche com o default.
 */
export async function getPermissoesGrupo(grupoId: string): Promise<PermissaoItem[]> {
  try {
    // 1. Buscar parâmetros disponíveis
    const { data: dbParams, error: paramErr } = await supabase
      .from('parametros')
      .select('*')
      .order('created_at', { ascending: true });

    if (paramErr || !dbParams) {
      console.error('Erro ao buscar parametros:', paramErr);
      return [];
    }

    // 2. Buscar associações já configuradas para o grupo
    const { data: dbGrupoParams, error: gpErr } = await supabase
      .from('grupo_parametro')
      .select('*')
      .eq('grupo_id', grupoId);

    if (gpErr) {
      console.warn('Erro ao buscar grupo_parametro:', gpErr);
    }

    const gpMap = new Map<string, GrupoParametro>();
    (dbGrupoParams || []).forEach((gp: any) => {
      gpMap.set(gp.parametro_id, gp);
    });

    // 3. Montar a lista completa de permissões
    const resultado: PermissaoItem[] = dbParams.map((param: any) => {
      const existing = gpMap.get(param.id);
      const defaultDef = PERMISSOES_PADRAO.find((p) => p.nome.toLowerCase() === param.nome.toLowerCase());

      return {
        parametroId: param.id,
        nome: param.nome,
        tipoParametro: param.tipo_parametro,
        usuario: existing ? Boolean(existing.usuario) : Boolean(defaultDef?.defaultUsuario ?? false),
        moderador: existing ? Boolean(existing.moderador) : Boolean(defaultDef?.defaultModerador ?? true),
      };
    });

    return resultado;
  } catch (err) {
    console.error('Erro inesperado em getPermissoesGrupo:', err);
    return [];
  }
}

/**
 * Salva ou atualiza as permissões de um grupo na tabela grupo_parametro.
 */
export async function salvarPermissoesGrupo(
  grupoId: string,
  permissoes: PermissaoItem[]
): Promise<{ success: boolean; error?: string }> {
  try {
    const payload = permissoes.map((p) => ({
      grupo_id: grupoId,
      parametro_id: p.parametroId,
      usuario: p.usuario,
      moderador: p.moderador,
    }));

    // Realizar upsert na tabela grupo_parametro com base na chave única (grupo_id, parametro_id)
    const { error } = await supabase
      .from('grupo_parametro')
      .upsert(payload, { onConflict: 'grupo_id,parametro_id' });

    if (error) throw error;
    return { success: true };
  } catch (err: any) {
    console.error('Erro ao salvar permissoes do grupo:', err);
    return { success: false, error: err?.message || 'Erro ao salvar permissões' };
  }
}

/**
 * Verifica se um usuário possui uma permissão específica em um grupo.
 * Regras:
 * 1. Se o usuário for o PROPRIETÁRIO (Dono/Criador) do grupo -> Poder total (true sempre).
 * 2. Se for Moderador/Admin ('A') -> Verifica a coluna 'moderador'.
 * 3. Se for Usuário Padrão ('P') -> Verifica a coluna 'usuario'.
 * 4. Se não for membro ou estiver pendente -> false.
 */
export async function verificarPermissaoGrupo(
  grupoId: string,
  usuarioId: string,
  nomePermissao: NomePermissao
): Promise<boolean> {
  if (!grupoId || !usuarioId) return false;

  try {
    // 1. Buscar membros do grupo para determinar perfil e verificar se é o proprietário
    const { data: membroRow } = await supabase
      .from('membros_grupo')
      .select('id, tipo_perfil, status, created_at')
      .eq('grupo_id', grupoId)
      .eq('usuario_id', usuarioId)
      .maybeSingle();

    if (!membroRow || membroRow.status !== 'aprovado') {
      return false;
    }

    // Verificar se é o proprietário do grupo (criador ou primeiro admin registrado)
    const { data: grupoData } = await supabase
      .from('grupos')
      .select('*')
      .eq('id', grupoId)
      .single();

    const criadorId = (grupoData as any)?.criador_id;
    if (criadorId && criadorId === usuarioId) {
      return true; // Dono do grupo tem poder absoluto
    }

    // Se criador_id não estiver setado, buscar o primeiro Admin do grupo
    const { data: firstAdmin } = await supabase
      .from('membros_grupo')
      .select('usuario_id')
      .eq('grupo_id', grupoId)
      .eq('tipo_perfil', 'A')
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (firstAdmin && firstAdmin.usuario_id === usuarioId) {
      return true; // Primeiro admin é considerado o proprietário
    }

    // 2. Buscar o id do parâmetro correspondente
    const { data: paramRow } = await supabase
      .from('parametros')
      .select('id')
      .ilike('nome', nomePermissao)
      .maybeSingle();

    if (!paramRow) {
      // Se o parâmetro não foi encontrado no banco, usar o default
      const defaultDef = PERMISSOES_PADRAO.find((p) => p.nome.toLowerCase() === nomePermissao.toLowerCase());
      return membroRow.tipo_perfil === 'A' ? Boolean(defaultDef?.defaultModerador) : Boolean(defaultDef?.defaultUsuario);
    }

    // 3. Buscar a regra em grupo_parametro
    const { data: gpRow } = await supabase
      .from('grupo_parametro')
      .select('usuario, moderador')
      .eq('grupo_id', grupoId)
      .eq('parametro_id', paramRow.id)
      .maybeSingle();

    if (!gpRow) {
      // Se ainda não houver registro específico, aplicar o padrão
      const defaultDef = PERMISSOES_PADRAO.find((p) => p.nome.toLowerCase() === nomePermissao.toLowerCase());
      return membroRow.tipo_perfil === 'A' ? Boolean(defaultDef?.defaultModerador) : Boolean(defaultDef?.defaultUsuario);
    }

    // Retorna conforme o perfil do membro
    return membroRow.tipo_perfil === 'A' ? Boolean(gpRow.moderador) : Boolean(gpRow.usuario);
  } catch (err) {
    console.error(`Erro ao verificar permissao '${nomePermissao}':`, err);
    return false;
  }
}
