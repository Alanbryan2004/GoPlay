import type { Participante } from '../types';

export function sortearTimes(
  participantes: Participante[],
  numberOfPlayers: number,
  numberOfTeams: number
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
  
  // Ordena por avaliação (rating) de forma decrescente para equilibrar os times
  sortedByRanking.sort((a, b) => b.avaliacao - a.avaliacao);

  const teams: Participante[][] = Array.from({ length: numberOfTeams }, () => []);
  
  // Distribuição equilibrada (Snake / Serpentina ou Round-Robin)
  // Vamos usar Serpentina (Snake Draft) para melhor equilíbrio:
  // Ex: Time 1, Time 2, Time 2, Time 1...
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

export function sortParticipanteByMenosJogos(a: Participante, b: Participante) {
  const jogosA = a.jogos || 0;
  const jogosB = b.jogos || 0;
  
  if (jogosA !== jogosB) {
    return jogosA - jogosB;
  }
  
  return Math.random() - 0.5;
}

export function construirFilaPrioridades(todosParticipantes: Participante[]) {
  const fila: Participante[][] = [];
  
  for (const jogador of todosParticipantes) {
    if (!jogador.checked) continue;
    
    const prio = jogador.prioridade || 0;
    if (!fila[prio]) {
      fila[prio] = [];
    }
    fila[prio].push(jogador);
  }
  
  return fila.filter((grupo) => !!grupo);
}

export function montarTime(fila: Participante[][], qtde: number, todosParticipantes: Participante[]): Participante[] {
  if (fila.length === 0) return [];

  const novoTime: Participante[] = [];
  
  while (novoTime.length < qtde) {
    let playersAddedThisIteration = false;
    
    for (const grupo of fila) {
      // Filtrar apenas os que estão presentes no evento geral
      const presentes = grupo.filter((p) =>
        todosParticipantes.some((tp) => tp.id === p.id && tp.checked)
      );
      
      // Filtrar apenas os que já não foram escalados para este time
      const habilitados = presentes.filter(
        (p) => !novoTime.some((jt) => jt.id === p.id)
      );
      
      // Ordenar por menos jogos dentro do mesmo nível de prioridade
      habilitados.sort(sortParticipanteByMenosJogos);

      while (habilitados.length > 0) {
        novoTime.push(habilitados.shift() as Participante);
        playersAddedThisIteration = true;

        if (novoTime.length >= qtde) {
          return novoTime;
        }
      }
    }
    
    // Evitar loop infinito se não houver jogadores suficientes na fila
    if (!playersAddedThisIteration) {
      break;
    }
  }

  return novoTime;
}

export function getMaxPrioridade(todosParticipantes: Participante[]): number {
  return todosParticipantes.reduce((acc, p) => {
    return (p.prioridade || 0) > acc ? p.prioridade : acc;
  }, 0);
}

export function subirPrioridade(todosParticipantes: Participante[], grupo: Participante[]): Participante[] {
  const newPrioridade = getMaxPrioridade(todosParticipantes) + 1;

  return todosParticipantes.map((p) => {
    if (grupo.some((gp) => gp.id === p.id)) {
      return { ...p, prioridade: newPrioridade };
    }
    return p;
  });
}
