import React, { useEffect, useRef, useState, useCallback } from 'react';
import L from 'leaflet';
import { Search, Crosshair, MapPin, ChevronDown, ChevronUp, AlertTriangle } from 'lucide-react';
import { searchLocations, reverseGeocode, debounce, GeocodingResult } from '../../lib/geocoding';
import { useI18n } from '../../i18n';
import { Spinner } from '../shared/Spinner';

const DEFAULT_CENTER: [number, number] = [4.052, 9.768]; // Douala, Cameroon
const DEFAULT_ZOOM = 13;

function createSiteIcon(): L.DivIcon {
  return L.divIcon({
    className: '',
    html: `<div style="width:32px;height:32px;border-radius:50%;background:#2563eb;box-shadow:0 3px 10px rgba(0,0,0,.3);display:grid;place-items:center;border:3px solid white">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>
      </svg>
    </div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -32]
  });
}

interface LocationValue {
  latitude: number;
  longitude: number;
  address?: string;
}

interface MapLocationPickerProps {
  value: LocationValue | null;
  onChange: (location: LocationValue) => void;
  height?: number;
  showSearch?: boolean;
  showCurrentLocation?: boolean;
  draggable?: boolean;
  defaultCenter?: [number, number];
  defaultZoom?: number;
}

/**
 * Interactive map picker with search, geolocation, and reverse geocoding.
 * Uses raw Leaflet (not react-leaflet) to avoid SSR hydration issues and to
 * have fine-grained control over marker drag events and map cleanup.
 */
export function MapLocationPicker({
  value,
  onChange,
  height = 300,
  showSearch = true,
  showCurrentLocation = true,
  draggable = true,
  defaultCenter = DEFAULT_CENTER,
  defaultZoom = DEFAULT_ZOOM
}: MapLocationPickerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const t = useI18n((s) => s.t);
  const locale = useI18n((s) => s.locale);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<GeocodingResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [geoLoading, setGeoLoading] = useState(false);
  const [geoError, setGeoError] = useState('');
  const [addressExpanded, setAddressExpanded] = useState(false);
  const [resolvedAddress, setResolvedAddress] = useState('');

  /* Debounced geocoding search to avoid hammering the Nominatim API on every keystroke. */
  const debouncedSearch = useRef(
    debounce(async (q: string) => {
      if (!q.trim()) { setSearchResults([]); setSearching(false); return; }
      setSearching(true);
      const results = await searchLocations(q, locale);
      setSearchResults(results);
      setSearching(false);
    }, 400)
  ).current;

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const initialCenter = value ? [value.latitude, value.longitude] as [number, number] : defaultCenter;
    const initialZoom = value ? 15 : defaultZoom;

    const map = L.map(containerRef.current, {
      center: initialCenter,
      zoom: initialZoom,
      zoomControl: true
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19
    }).addTo(map);

    map.zoomControl.setPosition('topright');

    if (draggable) {
      map.on('click', (e: L.LeafletMouseEvent) => {
        const { lat, lng } = e.latlng;
        updateMarker(lat, lng);
        reverseResolve(lat, lng);
        onChange({ latitude: lat, longitude: lng, address: undefined });
      });
    }

    if (value) {
      updateMarker(value.latitude, value.longitude);
    }

    mapRef.current = map;

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        map.invalidateSize();
      });
    });

    return () => { map.remove(); mapRef.current = null; markerRef.current = null; };
  }, []);

  useEffect(() => {
    if (!mapRef.current) return;
    if (value && markerRef.current) {
      markerRef.current.setLatLng([value.latitude, value.longitude]);
    } else if (value && !markerRef.current) {
      updateMarker(value.latitude, value.longitude);
    }
  }, [value?.latitude, value?.longitude]);

  const updateMarker = useCallback((lat: number, lng: number) => {
    const map = mapRef.current;
    if (!map) return;

    if (markerRef.current) {
      markerRef.current.setLatLng([lat, lng]);
    } else {
      markerRef.current = L.marker([lat, lng], {
        draggable,
        icon: createSiteIcon()
      }).addTo(map);

      if (draggable) {
        markerRef.current.on('dragend', () => {
          const pos = markerRef.current?.getLatLng();
          if (pos) {
            reverseResolve(pos.lat, pos.lng);
            onChange({ latitude: pos.lat, longitude: pos.lng, address: undefined });
          }
        });
      }
    }

    map.setView([lat, lng], Math.max(map.getZoom(), 15)); // Zoom in at least to 15 to ensure marker visibility
  }, [draggable, onChange]);

  const reverseResolve = useCallback(async (lat: number, lng: number) => {
    const result = await reverseGeocode(lat, lng, locale);
    if (result) {
      setResolvedAddress(result.displayName);
    } else {
      setResolvedAddress('');
    }
  }, [locale]);

  const handleSearchSelect = (result: GeocodingResult) => {
    updateMarker(result.latitude, result.longitude);
    setResolvedAddress(result.displayName);
    onChange({ latitude: result.latitude, longitude: result.longitude, address: result.displayName });
    setSearchQuery('');
    setSearchResults([]);
    setSearchOpen(false);
  };

  const handleCurrentLocation = () => {
    if (!navigator.geolocation) {
      setGeoError(t('mapPicker.notSupported'));
      return;
    }

    setGeoLoading(true);
    setGeoError('');

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        updateMarker(latitude, longitude);
        reverseResolve(latitude, longitude);
        onChange({ latitude, longitude, address: undefined });
        setGeoLoading(false);
      },
      (err) => {
        setGeoLoading(false);
        if (err.code === 1) {
          setGeoError(t('mapPicker.geoDenied'));
        } else if (err.code === 2) {
          setGeoError(t('mapPicker.geoUnavailable'));
        } else {
          setGeoError(t('mapPicker.geoTimeout'));
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  };

  return (
    <div className="map-location-picker">
      {showSearch && (
        <div className="mlp-search-wrap">
          <div className="mlp-search-input">
            <Search size={15} />
            <input
              placeholder={t('mapPicker.searchPlaceholder')}
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setSearchOpen(true);
                debouncedSearch(e.target.value);
              }}
              onFocus={() => setSearchOpen(true)}
            />
            {searching && <Spinner size={14} />}
          </div>
          {searchOpen && searchResults.length > 0 && (
            <div className="mlp-search-results">
              {searchResults.map((r, i) => (
                <button key={i} className="mlp-search-result" onClick={() => handleSearchSelect(r)}>
                  <MapPin size={13} />
                  <span>{r.displayName}</span>
                </button>
              ))}
            </div>
          )}
          {searchOpen && searchQuery.length >= 2 && !searching && searchResults.length === 0 && (
            <div className="mlp-search-empty">{t('mapPicker.noResults')}</div>
          )}
        </div>
      )}

      <div className="mlp-toolbar">
        {showCurrentLocation && (
          <button type="button" className="mlp-tool-btn" onClick={handleCurrentLocation} disabled={geoLoading}>
            {geoLoading ? <Spinner size={12} /> : <Crosshair size={13} />}
            <span>{t('map.myLocation')}</span>
          </button>
        )}
        {value && (
          <div className="mlp-coords">
            {value.latitude.toFixed(5)}, {value.longitude.toFixed(5)}
          </div>
        )}
      </div>

      <div ref={containerRef} className="mlp-map" style={{ height }} />

      {geoError && (
        <div className="mlp-error">
          <AlertTriangle size={13} />
          <span>{geoError}</span>
        </div>
      )}

      {value && (
        <div className="mlp-location-info">
          <div className="mlp-location-check">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
            <span>{t('mapPicker.locationSelected')}</span>
          </div>
          {resolvedAddress && <div className="mlp-location-address">{resolvedAddress}</div>}
          {!resolvedAddress && <div className="mlp-location-coords">{t('mapPicker.locationUnavailable')}</div>}
          <button type="button" className="mlp-expand-btn" onClick={() => setAddressExpanded(!addressExpanded)}>
            {t('mapPicker.advancedDetails')} {addressExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </button>
          {addressExpanded && (
            <div className="mlp-details">
              <div className="mlp-detail-row">
                <span>{t('mapPicker.latitude')}</span><span>{value.latitude.toFixed(6)}</span>
              </div>
              <div className="mlp-detail-row">
                <span>{t('mapPicker.longitude')}</span><span>{value.longitude.toFixed(6)}</span>
              </div>
              {resolvedAddress && (
                <div className="mlp-detail-row">
                  <span>{t('mapPicker.address')}</span><span>{resolvedAddress}</span>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {!value && (
        <div className="mlp-placeholder">
          <MapPin size={16} />
          <span>{t('mapPicker.placeholder')}</span>
        </div>
      )}
    </div>
  );
}
