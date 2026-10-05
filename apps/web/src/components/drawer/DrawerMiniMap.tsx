import { useEffect, useRef } from 'react';
import L from 'leaflet';

interface DrawerMiniMapProps {
  latitude: number;
  longitude: number;
  siteName: string;
}

/**
 * Lightweight read-only Leaflet map for the incident drawer.
 * Uses raw Leaflet (not react-leaflet) to avoid the library's SSR hydration issues
 * and keep the drawer lightweight without an extra dependency.
 */
export function DrawerMiniMap({ latitude, longitude, siteName }: DrawerMiniMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<L.Map | null>(null);

  useEffect(() => {
    if (!mapRef.current || mapInstance.current) return;

    const map = L.map(mapRef.current, {
      center: [latitude, longitude],
      zoom: 15,
      zoomControl: false,
      attributionControl: false
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19
    }).addTo(map);

    const icon = L.divIcon({
      className: 'mini-map-marker',
      html: `<div style="width:12px;height:12px;background:#ef4444;border:2px solid white;border-radius:50%;box-shadow:0 1px 3px rgba(0,0,0,0.3)"></div>`,
      iconSize: [12, 12],
      iconAnchor: [6, 6]
    });

    L.marker([latitude, longitude], { icon }).addTo(map).bindPopup(siteName);
    mapInstance.current = map;

    return () => {
      /* Cleanup: remove() destroys the Leaflet instance and frees its DOM/canvas resources. */
      map.remove();
      mapInstance.current = null;
    };
  }, [latitude, longitude, siteName]);

  return (
    <div
      ref={mapRef}
      style={{ width: '100%', height: 120, borderRadius: 6, overflow: 'hidden', border: '1px solid #e5e7eb' }}
    />
  );
}
