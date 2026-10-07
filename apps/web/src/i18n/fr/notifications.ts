import type { notifications as en } from '../en/notifications';
import type { Translation } from '../types';

export const notifications: Translation<typeof en> = {
  title: 'Notifications',
  description: 'Ce qui a changé sur les incidents que vous suivez.',
  all: 'Toutes',
  unread: 'Non lues',
  markAllRead: 'Tout marquer comme lu',
  viewAll: 'Voir toutes les notifications',
  empty: 'Tout est à jour.',
  emptyUnread: 'Aucune notification non lue.',
  loadMore: 'Afficher plus',
  unreadCount: 'Notifications non lues',
  types: {
    INCIDENT_CREATED: '{actor} a signalé un nouvel incident',
    ASSIGNED: '{actor} vous a assigné un incident',
    ASSIGNED_REPORTER: 'Un technicien a été assigné à votre incident',
    ACCEPTED: "{actor} a accepté et commencé l'intervention",
    DECLINED: '{actor} a refusé une intervention',
    REASSIGNMENT_REQUESTED: '{actor} a demandé une réaffectation',
    REASSIGNMENT_REJECTED: '{actor} vous a maintenu sur cet incident',
    UNASSIGNED: '{actor} vous a retiré un incident',
    PROGRESS_POSTED: '{actor} a publié un point',
    RESOLVED: '{actor} a résolu un incident',
    SENT_BACK: '{actor} a renvoyé un incident pour reprise',
    CLOSED: 'Un incident a été clôturé',
    COMMENT_ADDED: '{actor} a commenté',
    INVITATION_ACCEPTED: '{actor} a rejoint votre organisation',
  },
};
