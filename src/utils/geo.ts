/**
 * Utilitário de Geolocalização para o GoPlay
 * Suporta o cálculo de distância em linha reta pela fórmula de Haversine
 */

export interface GeoLocation {
  latitude: number;
  longitude: number;
}

/**
 * Calcula a distância em Kilômetros (km) entre dois pontos geográficos (latitude e longitude)
 */
export function calcularDistanciaKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Raio da Terra em km
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const d = R * c;
  return Math.round(d * 10) / 10; // Retorna com 1 casa decimal (ex: 2.4 km)
}

/**
 * Busca sugestões de endereço via OpenStreetMap Nominatim (Grátis, sem API key)
 * Prioriza a região atual do usuário caso latitude/longitude sejam passadas
 */
export async function buscarEnderecosNominatim(
  query: string,
  userLat?: number | null,
  userLon?: number | null
): Promise<Array<{ display_name: string; lat: number; lon: number }>> {
  if (!query || query.trim().length < 3) return [];
  try {
    let url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&countrycodes=br&limit=8`;
    
    // Se tiver a localização do usuário, define a viewbox de prioridade (~0.5 grau ao redor do usuário, ex: Campinas)
    if (userLat != null && userLon != null) {
      const viewbox = `${userLon - 0.5},${userLat + 0.5},${userLon + 0.5},${userLat - 0.5}`;
      url += `&viewbox=${viewbox}&bounded=0`; // bounded=0 dá preferência à região sem esconder outros locais se necessário
    }

    const res = await fetch(url, {
      headers: {
        'Accept-Language': 'pt-BR,pt;q=0.9',
        'User-Agent': 'GoPlay-App/1.0',
      },
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data.map((item: any) => ({
      display_name: item.display_name,
      lat: parseFloat(item.lat),
      lon: parseFloat(item.lon),
    }));
  } catch (e) {
    console.error('Erro ao buscar endereço via Nominatim:', e);
    return [];
  }
}

/**
 * Obtém a localização GPS atual do usuário do navegador/celular
 */
export function getLocalizacaoAtual(): Promise<GeoLocation> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocalização não é suportada neste navegador.'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
      },
      (error) => {
        let msg = 'Não foi possível capturar sua localização.';
        if (error.code === error.PERMISSION_DENIED) {
          msg = 'Permissão de localização negada pelo usuário.';
        }
        reject(new Error(msg));
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  });
}
