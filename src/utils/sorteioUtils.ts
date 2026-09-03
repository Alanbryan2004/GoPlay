import type { Participante } from '../types';

export function sortearTimes(
  participantes: Participante[],
  numberOfPlayers: number,
  numberOfTeams: number,
  useRating: boolean = true
): Participante[][] {
  const jogadoresRandomizados = randomizarJogadores(participantes);

  if (numberOfTeams === 1) {
    const time = jogadoresRandomizados.slice(0, numberOfPlayers);
    time.sort((a, b) => a.nome.localeCompare(b.nome));
    return [time];
  }

  const totalPlayersToSort = numberOfTeams * numberOfPlayers;
  const sortedByRanking = jogadoresRandomizados.slice(0, totalPlayersToSort);
  const remaining = jogadoresRandomizados.slice(totalPlayersToSort);
  
  // Ordena por avaliação (rating) de forma decrescente se useRating for true
  if (useRating) {
    sortedByRanking.sort((a, b) => b.avaliacao - a.avaliacao);
  }

  const teams: Participante[][] = Array.from({ length: numberOfTeams }, () => []);
  
  // Distribuição equilibrada (Snake / Serpentina ou Round-Robin)
  let index = 0;
  let ascending = true;

  while (sortedByRanking.length > 0) {
    const proximo = sortedByRanking.shift();
    if (proximo) {
      teams[index].push(proximo);
    }
    
    if (ascending) {
      if (index === numberOfTeams - 1) {
        ascending = false;
      } else {
        index++;
      }
    } else {
      if (index === 0) {
        ascending = true;
      } else {
        index--;
      }
    }
  }

  // Adiciona os excedentes no final do array de times
  if (remaining.length > 0) {
    teams.push(remaining);
  }

  return teams;
}

export function randomizarJogadores(participantes: Participante[]): Participante[] {
  const shuffled = [...participantes];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

// Retorna a prioridade máxima (N) entre os jogadores na fila
export function getMaxPrioridade(todosParticipantes: Participante[], ativosNoCampo: Participante[]): number {
  const jogandoIds = new Set(ativosNoCampo.map((p) => p.id));
  const filaEspera = todosParticipantes.filter((p) => p.checked && !jogandoIds.has(p.id));
  
  return filaEspera.length > 0
    ? Math.max(...filaEspera.map((p) => p.prioridade || 0))
    : 0;
}

// Eleva a prioridade do time que está saindo baseado no maior N da fila que fica
export function subirPrioridade(
  todosParticipantes: Participante[],
  ativosNoCampo: Participante[],
  timeSaindo: Participante[]
): Participante[] {
  const timeSaindoIds = new Set(timeSaindo.map((p) => p.id));
  const jogandoIds = new Set(ativosNoCampo.map((p) => p.id));
  
  // Fila que permanece esperando (exclui quem estava jogando e quem está saindo)
  const filaQueFica = todosParticipantes.filter(
    (p) => p.checked && !jogandoIds.has(p.id) && !timeSaindoIds.has(p.id)
  );

  const maxN = filaQueFica.length > 0
    ? Math.max(...filaQueFica.map((p) => p.prioridade || 0))
    : 0;

  const novoN = maxN + 1;

  return todosParticipantes.map((p) => {
    if (timeSaindoIds.has(p.id)) {
      return { ...p, prioridade: novoN };
    }
    return p;
  });
}

// Algoritmo de seleção prioritária por níveis (N=0, N=1, N=2...)
export function selecionarProximosJogadores(
  todosParticipantes: Participante[],
  ativosNoCampo: Participante[],
  quantidadeNecessaria: number
): { selecionados: Participante[]; novosParticipantes: Participante[] } {
  let lista = todosParticipantes.map((p) => ({ ...p }));
  const jogandoIds = new Set(ativosNoCampo.map((p) => p.id));
  const filaEspera = lista.filter((p) => p.checked && !jogandoIds.has(p.id));

  // Agrupar fila por nível de prioridade (N)
  const gruposPorN: { [n: number]: Participante[] } = {};
  filaEspera.forEach((p) => {
    const n = p.prioridade || 0;
    if (!gruposPorN[n]) {
      gruposPorN[n] = [];
    }
    gruposPorN[n].push(p);
  });

  // Ordenar níveis de prioridade de forma crescente (0, 1, 2, 3...)
  const niveisOrdenados = Object.keys(gruposPorN)
    .map(Number)
    .sort((a, b) => a - b);

  const selecionados: Participante[] = [];
  let slotsFaltantes = quantidadeNecessaria;

  for (const n of niveisOrdenados) {
    if (slotsFaltantes <= 0) break;

    const grupo = gruposPorN[n];
    if (grupo.length <= slotsFaltantes) {
      // Todos desse nível entram
      selecionados.push(...grupo);
      slotsFaltantes -= grupo.length;
    } else {
      // Sorteio dentro do mesmo nível de prioridade
      const shuffleGrupo = [...grupo].sort(() => Math.random() - 0.5);
      const escolhidos = shuffleGrupo.slice(0, slotsFaltantes);
      selecionados.push(...escolhidos);
      slotsFaltantes = 0;
    }
  }

  const selecionadosIds = new Set(selecionados.map((p) => p.id));

  // Resetar a prioridade para 0 dos que entram em quadra
  lista = lista.map((p) => {
    if (selecionadosIds.has(p.id) || jogandoIds.has(p.id)) {
      return { ...p, prioridade: 0 };
    }
    return p;
  });

  // Normalizar a fila (shift-down): Se as prioridades mais baixas (como N=1) foram esvaziadas,
  // deslocamos as prioridades remanescentes para baixo, de modo que o menor nível de espera comece em 1.
  const restantesNaFilaComN = lista.filter(
    (p) => p.checked && !selecionadosIds.has(p.id) && !jogandoIds.has(p.id) && (p.prioridade || 0) > 0
  );

  if (restantesNaFilaComN.length > 0) {
    const minN = Math.min(...restantesNaFilaComN.map((p) => p.prioridade || 0));
    if (minN > 1) {
      const shiftAmount = minN - 1;
      lista = lista.map((p) => {
        if (p.checked && !selecionadosIds.has(p.id) && !jogandoIds.has(p.id) && (p.prioridade || 0) > 0) {
          return { ...p, prioridade: (p.prioridade || 0) - shiftAmount };
        }
        return p;
      });
    }
  }

  return { selecionados, novosParticipantes: lista };
}
