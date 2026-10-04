export interface GeocodingResult {
  latitude: number;
  longitude: number;
  displayName: string;
  address?: {
    city?: string;
    town?: string;
    village?: string;
    state?: string;
    country?: string;
    postcode?: string;
    road?: string;
    house_number?: string;
  };
}

const NOMINATIM_BASE = 'https://nominatim.openstreetmap.org';
const USER_AGENT = 'NexusIncidents/1.0';

let searchAbort: AbortController | null = null;

export async function searchLocations(query: string, locale = 'en'): Promise<GeocodingResult[]> {
  if (!query.trim() || query.trim().length < 2) return [];

  if (searchAbort) searchAbort.abort();
  searchAbort = new AbortController();

  try {
    const params = new URLSearchParams({
      q: query.trim(),
      format: 'json',
      addressdetails: '1',
      limit: '6',
      'accept-language': locale
    });

    const res = await fetch(`${NOMINATIM_BASE}/search?${params}`, {
      headers: { 'User-Agent': USER_AGENT },
      signal: searchAbort.signal
    });

    if (!res.ok) return [];

    const data = await res.json();
    return data.map((item: any) => ({
      latitude: parseFloat(item.lat),
      longitude: parseFloat(item.lon),
      displayName: item.display_name,
      address: item.address
    }));
  } catch {
    return [];
  }
}

export async function reverseGeocode(lat: number, lng: number, locale = 'en'): Promise<GeocodingResult | null> {
  try {
    const params = new URLSearchParams({
      lat: String(lat),
      lon: String(lng),
      format: 'json',
      addressdetails: '1',
      'accept-language': locale
    });

    const res = await fetch(`${NOMINATIM_BASE}/reverse?${params}`, {
      headers: { 'User-Agent': USER_AGENT }
    });

    if (!res.ok) return null;

    const item = await res.json();
    if (!item || item.error) return null;

    return {
      latitude: parseFloat(item.lat),
      longitude: parseFloat(item.lon),
      displayName: item.display_name,
      address: item.address
    };
  } catch {
    return null;
  }
}

export function debounce<T extends (...args: any[]) => any>(fn: T, ms: number): T {
  let timer: ReturnType<typeof setTimeout>;
  return ((...args: any[]) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  }) as T;
}
