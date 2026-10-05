import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Plus, Search, ClipboardList, MoreHorizontal } from 'lucide-react';
import { useI18n } from '../../i18n';
import { Drawer } from '../drawer/IncidentDrawer';
import { api } from '../../api/client';

const priorityColors: Record<string, string> = {
  CRITICAL: 'bg-red-100 text-red-800 border border-red-200',
  HIGH: 'bg-orange-100 text-orange-800 border border-orange-200',
  MEDIUM: 'bg-yellow-100 text-yellow-800 border border-yellow-200',
  LOW: 'bg-green-100 text-green-800 border border-green-200'
};

const statusColors: Record<string, string> = {
  NEW: 'bg-red-100 text-red-800',
  ASSIGNED: 'bg-blue-100 text-blue-800',
  IN_PROGRESS: 'bg-blue-100 text-blue-800',
  RESOLVED: 'bg-yellow-100 text-yellow-800',
  CLOSED: 'bg-green-100 text-green-800'
};

export function Incidents() {
  const t = useI18n((s) => s.t);
  const [selectedTab, setSelectedTab] = useState('Nouveaux');
  const [search, setSearch] = useState('');
  const [drawerId, setDrawerId] = useState<string | null>(null);
  const [incidents, setIncidents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchIncidents = () => {
    setLoading(true);
    api<any>('/incidents?limit=50').then(res => {
      setIncidents(res.items || []);
    }).catch(console.error).finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchIncidents();
  }, []);

  const filteredIncidents = useMemo(() => {
    return incidents.filter(inc => {
      const locationName = inc.site?.name || 'Localisation inconnue';
      const matchSearch = inc.title.toLowerCase().includes(search.toLowerCase()) || locationName.toLowerCase().includes(search.toLowerCase());
      if (!matchSearch) return false;
      if (selectedTab === 'Nouveaux') return inc.status === 'NEW' || inc.status === 'ASSIGNED';
      if (selectedTab === 'En cours') return inc.status === 'IN_PROGRESS';
      if (selectedTab === 'A cloturer') return inc.status === 'RESOLVED';
      return true;
    }).map(inc => {
      const activeAssignment = inc.assignments?.find((a: any) => a.isActive);
      return {
        ...inc,
        location: inc.site?.name || 'Localisation inconnue',
        assignee: activeAssignment?.responsable?.user?.name || null
      };
    });
  }, [selectedTab, search, incidents]);

  return (
    <div className="flex flex-col h-full bg-slate-50">
      <div className="px-6 py-8 bg-white border-b border-slate-200 flex justify-between items-center">
        <div>
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-blue-500" />
            À traiter
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mb-1">Gestion des incidents</h1>
          <p className="text-sm text-slate-500">Consultez, assignez et résolvez les incidents signalés sur vos sites.</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm font-medium">
          <Plus size={18} />
          Nouveau signalement
        </button>
      </div>

      <div className="flex-1 p-6 overflow-hidden flex flex-col">
        <div className="bg-white rounded-lg border border-slate-200 shadow-sm flex flex-col h-full overflow-hidden">
          <div className="flex justify-between items-center p-4 border-b border-slate-200 bg-slate-50">
            <div className="flex gap-4">
              {['Nouveaux', 'En cours', 'A cloturer'].map(tab => (
                <button
                  key={tab}
                  onClick={() => setSelectedTab(tab)}
                  className={`pb-2 px-1 text-sm font-medium border-b-2 transition-colors ${
                    selectedTab === tab 
                      ? 'border-blue-600 text-blue-600' 
                      : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input
                type="text"
                placeholder="Rechercher..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 pr-4 py-2 border border-slate-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent w-64"
              />
            </div>
          </div>

          <div className="flex-1 overflow-auto">
            {loading ? (
              <div className="p-12 text-center text-slate-500">Chargement...</div>
            ) : filteredIncidents.length === 0 ? (
              <div className="p-12 text-center text-slate-500 flex flex-col items-center">
                <ClipboardList size={48} className="opacity-50 mb-4" />
                <h3 className="text-lg font-medium text-slate-900 mb-1">Aucun incident</h3>
                <p className="text-sm">Aucun incident ne correspond à vos critères.</p>
              </div>
            ) : (
              <table className="w-full text-left text-sm text-slate-600">
                <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200 sticky top-0 z-10">
                  <tr>
                    <th className="px-6 py-3 font-medium">Incident</th>
                    <th className="px-6 py-3 font-medium">Localisation</th>
                    <th className="px-6 py-3 font-medium">Statut</th>
                    <th className="px-6 py-3 font-medium">Priorité</th>
                    <th className="px-6 py-3 font-medium">Intervenant</th>
                    <th className="px-6 py-3 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  {filteredIncidents.map(item => (
                    <tr 
                      key={item.id} 
                      onClick={() => setDrawerId(item.id)}
                      className="hover:bg-slate-50 cursor-pointer transition-colors"
                    >
                      <td className="px-6 py-4">
                        <div className="font-medium text-slate-900">{item.title}</div>
                        <div className="text-xs text-slate-500 mt-0.5">{item.category}</div>
                      </td>
                      <td className="px-6 py-4">{item.location}</td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColors[item.status] || 'bg-slate-100 text-slate-800'}`}>
                          {item.status}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${priorityColors[item.priority] || 'bg-slate-100 text-slate-800 border border-slate-200'}`}>
                          {item.priority}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        {item.assignee ? (
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-medium">
                              {item.assignee.charAt(0)}
                            </div>
                            <span>{item.assignee}</span>
                          </div>
                        ) : (
                          <span className="text-slate-400 italic">Non assigné</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <IncidentActionsDropdown onOpen={() => setDrawerId(item.id)} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
      
      {drawerId && <Drawer id={drawerId} onClose={() => setDrawerId(null)} onUpdate={fetchIncidents} />}
    </div>
  );
}

function IncidentActionsDropdown({ onOpen }: { onOpen: () => void }) {
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      <button 
        onClick={(e) => { e.stopPropagation(); setOpen(!open); }}
        className="p-1.5 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
      >
        <MoreHorizontal size={18} />
      </button>
      {open && (
        <div className="absolute right-0 mt-1 w-48 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 z-20">
          <div className="py-1" role="menu">
            <button
              onClick={(e) => { e.stopPropagation(); setOpen(false); onOpen(); }}
              className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-100"
              role="menuitem"
            >
              Voir les détails
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
