export interface TorneioTime {
  id: string;
  nome: string;
  criador_id?: string; // ID do usuário que cadastrou este time (Capitão)
  cor?: string; // Cor do card do time
  jogadores?: { id: string; nome: string }[];
}

export interface TorneioConfronto {
  id: string;
  fase: string; // Ex: 'Oitavas', 'Quartas', 'Semifinal', 'Final' ou 'Rodada 1'
  rodada: number;
  timeA: TorneioTime;
  timeB: TorneioTime;
  placarA?: number;
  placarB?: number;
  vencedorId?: string;
  dataHora?: string;
}

export interface Torneio {
  id: string;
  criador_id: string;
  nome: string;
  modalidade_id?: string;
  grupo_id?: string;
  formato: 'pontos_corridos' | 'chaveamento'; // Ponto Corrido ou Mata-Mata (Chaveamento)
  publico: boolean;
  quantidade_times: number;
  jogadores_por_time?: number; // Quantidade de jogadores em cada time
  tipo_times: 'sorteio' | 'fechado';
  data_inicio: string;
  data_fim?: string;
  participantes?: { id: string; nome: string; foto?: string }[]; // Lista de inscritos no torneio
  times: TorneioTime[];
  chaveamento: TorneioConfronto[];
  status: 'rascunho' | 'sorteado' | 'em_andamento' | 'finalizado' | 'encerrado';
  campeao_id?: string;
  comunidade_id?: string;
  comunidade?: { id: string; nome: string };
  comunidades?: { id: string; nome: string };
  configuracao_jogos?: {
    jogosPorDia: number;
    diasSemana: number[]; // 0 = Domingo, 1 = Segunda, ..., 6 = Sábado
    horarioInicio: string; // Ex: '14:00'
    intervaloMinutos: number; // Ex: 60
  };
  modalidade?: { id: string; nome: string };
  modalidades?: { id: string; nome: string };
}
