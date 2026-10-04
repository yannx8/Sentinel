import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import L from 'leaflet';
import { Layers, Navigation, AlertTriangle, MapPin } from 'lucide-react';
import { useI18n } from '../../i18n';
import { Drawer } from '../drawer/IncidentDrawer';
import { api } from '../../api/client';

interface MapIncident {
  id: string;
  title: string;
  latitude: number;
  longitude: number;
  priority: string;
  status: string;
  category: string;
  location: string;
  assignee?: string | null;
}

const PRIORITY_COLORS_MAP: Record<string, string> = {
  CRITICAL: '#dc2626', HIGH: '#ea580c', MEDIUM: '#d97706', LOW: '#16a34a',
};

const badgeStatusMap: Record<string, string> = {
  NEW: 'bg-red-100 text-red-800',
  ASSIGNED: 'bg-blue-100 text-blue-800',
  IN_PROGRESS: 'bg-blue-100 text-blue-800',
  RESOLVED: 'bg-yellow-100 text-yellow-800',
  CLOSED: 'bg-green-100 text-green-800'
};

function createIncidentIcon(priority: string): L.DivIcon {
  const color = PRIORITY_COLORS_MAP[priority] || '#6b7280';
  return L.divIcon({
    className: '',
    html: `<div style="width:28px;height:28px;background:${color};border:3px solid white;border-radius:50%;box-shadow:0 2px 8px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
    </div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    popupAnchor: [0, -16],
  });
}

export function MapPage() {
  const t = useI18n((s) => s.t);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [priorityFilter, setPriorityFilter] = useState('ALL');
  const [drawerId, setDrawerId] = useState<string | null>(null);
  const [mapLayer, setMapLayer] = useState<'standard' | 'satellite'>('standard');
  const [visibleIncidents, setVisibleIncidents] = useState<MapIncident[]>([]);
  const [incidents, setIncidents] = useState<MapIncident[]>([]);

  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<Map<string, L.Marker>>(new Map());
  const tileRef = useRef<L.TileLayer | null>(null);

  const fetchIncidents = () => {
    api<any>('/incidents?limit=100').then(res => {
      const items = res.items || [];
      const mapped = items.map((inc: any) => ({
        id: inc.id,
        title: inc.title,
        latitude: inc.latitude || 48.8566 + (Math.random() - 0.5) * 0.05, // fallback for local testing
        longitude: inc.longitude || 2.3522 + (Math.random() - 0.5) * 0.05, // fallback for local testing
        priority: inc.priority,
        status: inc.status,
        category: inc.category,
        location: inc.site?.name || 'Localisation inconnue',
        assignee: inc.assignments?.find((a: any) => a.isActive)?.responsable?.user?.name || null
      }));
      setIncidents(mapped);
    }).catch(console.error);
  };

  useEffect(() => {
    fetchIncidents();
  }, []);

  const filteredIncidents = useMemo(() => {
    return incidents.filter(inc => {
      if (statusFilter !== 'ALL' && inc.status !== statusFilter) return false;
      if (priorityFilter !== 'ALL' && inc.priority !== priorityFilter) return false;
      return true;
    });
  }, [statusFilter, priorityFilter, incidents]);

  const updateVisibleIncidents = useCallback(() => {
    if (!mapRef.current) return;
    const bounds = mapRef.current.getBounds();
    const visible = filteredIncidents.filter(inc => bounds.contains([inc.latitude, inc.longitude]));
    setVisibleIncidents(visible);
  }, [filteredIncidents]);

  const initMap = useCallback(() => {
    if (!ref.current || mapRef.current) return;
    const map = L.map(ref.current, { zoomControl: false }).setView([48.8566, 2.3522], 14);
    
    tileRef.current = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);
    L.control.zoom({ position: 'bottomleft' }).addTo(map);
    mapRef.current = map;
    
    map.on('moveend', updateVisibleIncidents);
    map.on('zoomend', updateVisibleIncidents);
  }, [updateVisibleIncidents]);

  useEffect(() => { 
    initMap(); 
    return () => {
      // cleanup on unmount
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [initMap]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    markersRef.current.forEach((layer) => map.removeLayer(layer));
    markersRef.current.clear();

    filteredIncidents.forEach((i) => {
      if (i.latitude && i.longitude) {
        const cm = L.marker([i.latitude, i.longitude], { icon: createIncidentIcon(i.priority) }).addTo(map);
        cm.on('click', () => setDrawerId(i.id));
        markersRef.current.set(i.id, cm);
      }
    });
    
    updateVisibleIncidents();
  }, [filteredIncidents, updateVisibleIncidents]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !tileRef.current) return;
    map.removeLayer(tileRef.current);
    const layer = mapLayer === 'satellite'
      ? L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}')
      : L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png');
    layer.addTo(map);
    tileRef.current = layer;
  }, [mapLayer]);

  const myLocation = () => {
    if (!mapRef.current) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => mapRef.current!.setView([pos.coords.latitude, pos.coords.longitude], 15),
      () => {}, { timeout: 8000 }
    );
  };

  return (
    <div className="flex h-[calc(100vh-54px)] bg-slate-50">
      
      {/* MAP AREA */}
      <div className="flex-1 relative">
        <div ref={ref} className="w-full h-full z-0" />
        
        <button 
          onClick={() => setMapLayer(mapLayer === 'standard' ? 'satellite' : 'standard')}
          className="absolute top-4 right-4 z-[400] bg-white p-2.5 rounded-md shadow-md border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors"
          title={mapLayer === 'satellite' ? 'Vue standard' : 'Vue satellite'}
        >
          <Layers size={18} />
        </button>
        <button 
          onClick={myLocation}
          className="absolute bottom-8 right-4 z-[400] bg-white p-2.5 rounded-md shadow-md border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors"
          title="Ma position"
        >
          <Navigation size={18} />
        </button>
      </div>

      {/* RIGHT PANEL */}
      <div className="w-[340px] bg-white border-l border-slate-200 flex flex-col z-10">
        <div className="p-4 border-b border-slate-200">
          <h2 className="m-0 mb-4 text-base font-semibold text-slate-900">Filtres</h2>
          <div className="flex flex-col gap-3">
            <select 
              value={statusFilter} 
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full p-2 border border-slate-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
            >
              <option value="ALL">Tous les statuts</option>
              <option value="NEW">Nouveau</option>
              <option value="ASSIGNED">Assigné</option>
              <option value="IN_PROGRESS">En cours</option>
              <option value="RESOLVED">A clôturer</option>
              <option value="CLOSED">Clôturé</option>
            </select>
            <select 
              value={priorityFilter} 
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="w-full p-2 border border-slate-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
            >
              <option value="ALL">Toutes les priorités</option>
              <option value="CRITICAL">Critique</option>
              <option value="HIGH">Haute</option>
              <option value="MEDIUM">Moyenne</option>
              <option value="LOW">Basse</option>
            </select>
          </div>
        </div>
        
        <div className="px-4 py-3 border-b border-slate-200 bg-slate-50">
          <h3 className="m-0 text-sm font-semibold text-slate-900">Incidents visibles ({visibleIncidents.length})</h3>
        </div>

        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
          {visibleIncidents.map(inc => (
            <div 
              key={inc.id} 
              onClick={() => setDrawerId(inc.id)} 
              className="bg-white border border-slate-200 rounded-lg p-3 cursor-pointer hover:border-blue-300 hover:shadow-sm transition-all"
            >
              <div className="text-xs text-slate-500 flex justify-between items-center">
                INC-{inc.id.substring(0, 4)}
                <AlertTriangle size={14} color={PRIORITY_COLORS_MAP[inc.priority]} />
              </div>
              <strong className="block text-sm text-slate-900 my-1">{inc.title}</strong>
              <div className="text-xs text-slate-500 flex items-center gap-1 mb-2">
                <MapPin size={12} /> {inc.location}
              </div>
              <div>
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${badgeStatusMap[inc.status] || 'bg-slate-100 text-slate-800'}`}>
                  {inc.status}
                </span>
              </div>
            </div>
          ))}
          {visibleIncidents.length === 0 && (
            <div className="text-center text-slate-400 mt-10 text-sm">
              Aucun incident visible dans cette zone.
            </div>
          )}
        </div>
      </div>
      
      {drawerId && <Drawer id={drawerId} onClose={() => setDrawerId(null)} onUpdate={fetchIncidents} />}
    </div>
  );
}
