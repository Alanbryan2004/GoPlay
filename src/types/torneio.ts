export interface TorneioTime {
  id: string;
  nome: string;
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
  tipo_times: 'sorteio' | 'fechado';
  data_inicio: string;
  data_fim?: string;
  times: TorneioTime[];
  chaveamento: TorneioConfronto[];
  status: 'rascunho' | 'sorteado' | 'em_andamento' | 'finalizado';
  created_at?: string;
}
