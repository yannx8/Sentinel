import React, { useState, useEffect } from 'react';
import { X, MapPin, Calendar, CheckCircle, AlertTriangle, MessageSquare, Clock, Paperclip } from 'lucide-react';
import { api } from '../../api/client';
import { useAuth } from '../../store/authStore';
import { useI18n } from '../../i18n';

const priorityColors: Record<string, string> = {
  CRITICAL: 'bg-red-100 text-red-800 border-red-200',
  HIGH: 'bg-orange-100 text-orange-800 border-orange-200',
  MEDIUM: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  LOW: 'bg-green-100 text-green-800 border-green-200'
};

const statusColors: Record<string, string> = {
  NEW: 'bg-red-100 text-red-800',
  ASSIGNED: 'bg-blue-100 text-blue-800',
  IN_PROGRESS: 'bg-blue-100 text-blue-800',
  RESOLVED: 'bg-yellow-100 text-yellow-800',
  CLOSED: 'bg-green-100 text-green-800'
};

export function Drawer({ id, onClose, onUpdate }: { id: string; onClose: () => void, onUpdate?: () => void }) {
  const [incident, setIncident] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'timeline' | 'evidence'>('overview');
  
  const u = useAuth((s) => s.user)!;
  const t = useI18n((s) => s.t);

  const [showReassign, setShowReassign] = useState(false);
  const [reassignReason, setReassignReason] = useState('');
  const [showResolve, setShowResolve] = useState(false);
  const [resolveText, setResolveText] = useState('');
  const [showReject, setShowReject] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  const fetchIncident = () => {
    setLoading(true);
    api<any>(`/incidents/${id}`)
      .then(res => setIncident(res))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchIncident();
  }, [id]);

  if (!incident && loading) {
    return (
      <div className="fixed inset-0 z-50 flex justify-end">
        <div className="absolute inset-0 bg-slate-900/20 backdrop-blur-sm" onClick={onClose} />
        <div className="relative w-full max-w-xl bg-white shadow-2xl h-full flex items-center justify-center">
          <span className="text-slate-500">Chargement...</span>
        </div>
      </div>
    );
  }

  if (!incident) return null;

  const activeAssignment = incident.assignments?.find((a: any) => a.isActive);
  const isAssignedToMe = activeAssignment?.responsable?.userId === u.id;
  const isAdmin = u.roles.includes('ADMINISTRATOR') || u.roles.includes('PLATFORM_ADMIN');

  const executeAction = async (action: () => Promise<void>) => {
    setActionLoading(true);
    try {
      await action();
      fetchIncident();
      if (onUpdate) onUpdate();
    } catch (e) {
      console.error(e);
      alert('Action failed');
    } finally {
      setActionLoading(false);
    }
  };

  const handleAccept = () => executeAction(() => api(`/assignments/${activeAssignment.id}/accept`, { method: 'POST' }));
  const handleReassign = () => executeAction(() => {
    setShowReassign(false);
    return api(`/assignments/${activeAssignment.id}/reassignment-request`, { method: 'POST', body: JSON.stringify({ reason: reassignReason }) });
  });
  const handleResolve = () => executeAction(() => {
    setShowResolve(false);
    return api(`/incidents/${incident.id}/resolution`, { method: 'POST', body: JSON.stringify({ resolutionText: resolveText }) });
  });
  const handleClose = () => executeAction(() => api(`/incidents/${incident.id}/closure`, { method: 'POST' }));
  const handleReject = () => executeAction(() => {
    setShowReject(false);
    return api(`/incidents/${incident.id}/reject-resolution`, { method: 'POST', body: JSON.stringify({ reason: rejectReason }) });
  });

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-slate-900/20 backdrop-blur-sm transition-opacity" onClick={onClose} />
      
      {/* Slide-over panel */}
      <div className="relative w-full max-w-xl bg-white shadow-2xl h-full flex flex-col animate-in slide-in-from-right duration-300">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-start bg-slate-50">
          <div>
            <div className="text-xs text-slate-500 font-medium mb-1">INC-{incident.id.substring(0,6)}</div>
            <h2 className="text-xl font-bold text-slate-900">{incident.title}</h2>
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-full transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Status Badges Row */}
        <div className="px-6 py-3 border-b border-slate-200 flex gap-2 flex-wrap">
          <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColors[incident.status] || 'bg-slate-100 text-slate-800'}`}>
            {incident.status}
          </span>
          <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium border ${priorityColors[incident.priority] || 'bg-slate-100 text-slate-800 border-slate-200'}`}>
            {incident.priority}
          </span>
          <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600 border border-slate-200">
            {incident.category}
          </span>
        </div>

        {/* Tabs */}
        <div className="flex px-6 border-b border-slate-200">
          {[
            { id: 'overview', label: 'Aperçu', icon: <MessageSquare size={16} /> },
            { id: 'timeline', label: 'Historique', icon: <Clock size={16} /> },
            { id: 'evidence', label: 'Preuves', icon: <Paperclip size={16} /> }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 py-3 px-4 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id 
                  ? 'border-blue-600 text-blue-600' 
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 bg-white">
          
          {activeTab === 'overview' && (
            <div className="flex flex-col gap-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-xs text-slate-500 flex items-center gap-1.5 mb-1">
                    <MapPin size={14} /> Localisation
                  </div>
                  <div className="font-medium text-slate-900">{incident.site?.name || 'Inconnue'}</div>
                </div>
                <div>
                  <div className="text-xs text-slate-500 flex items-center gap-1.5 mb-1">
                    <Calendar size={14} /> Date de signalement
                  </div>
                  <div className="font-medium text-slate-900">{new Date(incident.createdAt).toLocaleString('fr-FR')}</div>
                </div>
              </div>

              <div className="bg-slate-50 rounded-lg p-4 border border-slate-100">
                <h3 className="text-sm font-semibold text-slate-900 mb-2">Description</h3>
                <p className="text-sm text-slate-600 whitespace-pre-wrap leading-relaxed">
                  {incident.description}
                </p>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-slate-900 mb-3">Assignation</h3>
                {activeAssignment ? (
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-semibold text-sm">
                      {activeAssignment.responsable?.user?.name?.charAt(0) || '?'}
                    </div>
                    <div>
                      <div className="font-medium text-slate-900 text-sm">{activeAssignment.responsable?.user?.name}</div>
                      <div className="text-xs text-slate-500">{activeAssignment.status}</div>
                    </div>
                  </div>
                ) : (
                  <div className="text-sm text-slate-500 italic">Aucun intervenant assigné</div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'timeline' && (
            <div className="text-sm text-slate-500 text-center py-8 italic">
              L'historique des événements sera affiché ici.
            </div>
          )}

          {activeTab === 'evidence' && (
            <div className="text-sm text-slate-500 text-center py-8 italic">
              Les photos et documents joints seront affichés ici.
            </div>
          )}

        </div>

        {/* Footer / Actions */}
        <div className="p-6 border-t border-slate-200 bg-slate-50 flex flex-col gap-4">
          {incident.status === 'ASSIGNED' && isAssignedToMe && !showReassign && (
            <div className="flex justify-end gap-3">
              <button 
                onClick={() => setShowReassign(true)} 
                disabled={actionLoading}
                className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 transition-colors"
              >
                Demander réassignation
              </button>
              <button 
                onClick={handleAccept} 
                disabled={actionLoading}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors"
              >
                Accepter l'intervention
              </button>
            </div>
          )}

          {showReassign && (
            <div className="bg-white p-4 rounded-lg border border-slate-200 flex flex-col gap-3">
              <label className="text-sm font-medium text-slate-900 flex flex-col gap-1">
                Raison de la réassignation
                <textarea 
                  value={reassignReason} 
                  onChange={(e) => setReassignReason(e.target.value)} 
                  maxLength={500}
                  className="w-full p-2 border border-slate-300 rounded-md text-sm mt-1 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  rows={3}
                />
              </label>
              <div className="flex justify-end gap-2">
                <button 
                  onClick={() => setShowReassign(false)}
                  className="px-3 py-1.5 text-sm font-medium text-slate-600 hover:text-slate-900"
                >
                  Annuler
                </button>
                <button 
                  onClick={handleReassign} 
                  disabled={actionLoading || reassignReason.length < 5}
                  className="px-3 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
                >
                  Envoyer
                </button>
              </div>
            </div>
          )}

          {incident.status === 'IN_PROGRESS' && isAssignedToMe && !showResolve && (
            <div className="flex justify-end gap-3">
              <button 
                onClick={() => setShowResolve(true)} 
                disabled={actionLoading}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors"
              >
                Soumettre résolution
              </button>
            </div>
          )}

          {showResolve && (
            <div className="bg-white p-4 rounded-lg border border-slate-200 flex flex-col gap-3">
              <label className="text-sm font-medium text-slate-900 flex flex-col gap-1">
                Rapport de résolution
                <textarea 
                  value={resolveText} 
                  onChange={(e) => setResolveText(e.target.value)} 
                  maxLength={3000}
                  className="w-full p-2 border border-slate-300 rounded-md text-sm mt-1 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  rows={4}
                />
              </label>
              <div className="flex justify-end gap-2">
                <button 
                  onClick={() => setShowResolve(false)}
                  className="px-3 py-1.5 text-sm font-medium text-slate-600 hover:text-slate-900"
                >
                  Annuler
                </button>
                <button 
                  onClick={handleResolve} 
                  disabled={actionLoading || resolveText.length < 10}
                  className="px-3 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
                >
                  Soumettre
                </button>
              </div>
            </div>
          )}

          {incident.status === 'RESOLVED' && isAdmin && !showReject && (
            <div className="flex justify-end gap-3">
              <button 
                onClick={() => setShowReject(true)} 
                disabled={actionLoading}
                className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 transition-colors"
              >
                Rejeter
              </button>
              <button 
                onClick={handleClose} 
                disabled={actionLoading}
                className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700 transition-colors"
              >
                Clôturer l'incident
              </button>
            </div>
          )}

          {showReject && (
            <div className="bg-red-50 p-4 rounded-lg border border-red-200 flex flex-col gap-3">
              <label className="text-sm font-medium text-red-900 flex flex-col gap-1">
                Raison du rejet
                <textarea 
                  value={rejectReason} 
                  onChange={(e) => setRejectReason(e.target.value)} 
                  maxLength={500}
                  className="w-full p-2 border border-red-300 rounded-md text-sm mt-1 focus:ring-2 focus:ring-red-500 focus:outline-none"
                  rows={3}
                />
              </label>
              <div className="flex justify-end gap-2">
                <button 
                  onClick={() => setShowReject(false)}
                  className="px-3 py-1.5 text-sm font-medium text-slate-600 hover:text-slate-900"
                >
                  Annuler
                </button>
                <button 
                  onClick={handleReject} 
                  disabled={actionLoading || rejectReason.length < 5}
                  className="px-3 py-1.5 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 disabled:opacity-50"
                >
                  Rejeter la résolution
                </button>
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
