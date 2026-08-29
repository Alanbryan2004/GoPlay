export interface Usuario {
  id: string;
  nome: string;
  email: string;
  senha?: string;
  foto?: string;
  created_at?: string;
}

export interface Modalidade {
  id: string;
  nome: string;
  created_at?: string;
}

export interface Grupo {
  id: string;
  nome: string;
  publico: boolean;
  quantidade_participantes?: number;
  created_at?: string;
}

export interface GrupoUsuario {
  id: string;
  grupo_id: string;
  usuario_id: string;
  tipo_perfil: 'A' | 'M' | 'P'; // A = Admin, M = Moderator, P = Participant
  nome?: string;
  email?: string;
  foto?: string;
  created_at?: string;
}

export interface Parametro {
  id: string;
  nome: string;
  tipo_parametro: string;
}

export interface GrupoParametro {
  id: string;
  grupo_id: string;
  parametro_id: string;
  usuario: boolean;
  moderador: boolean;
}

export interface EventoConfig {
  numberOfTeams: number;
  numberOfPlayers: number;
  useRating: boolean;
  maxNumberOfVictories: number;
  actionAfterVictories: ActionAfterVictories;
  finalizado?: boolean;
}

export enum ActionAfterVictories {
  Remover = 0,
  Mesclar = 1
}

export interface Participante {
  id: string;
  nome: string;
  avaliacao: number;
  checked: boolean;
  prioridade: number;
  jogosGanhos?: number;
  jogos?: number;
}

export interface Evento {
  id: string;
  usuario_id: string;
  grupo_id?: string;
  descricao: string;
  local: string;
  modalidade_id?: string;
  data: string;
  participantes: Participante[];
  configuracao: EventoConfig;
  time1: Participante[];
  time2: Participante[];
  vitorias_time1: number;
  vitorias_time2: number;
  created_at?: string;
}

export interface Amigo {
  id: string;
  usuario_id: string;
  amigo_id: string;
  ativo: boolean;
  nome?: string;
  email?: string;
  foto?: string;
  created_at?: string;
}
