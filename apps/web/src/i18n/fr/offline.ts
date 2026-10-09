import type { offline as en } from '../en/offline';
import type { Translation } from '../types';

export const offline: Translation<typeof en> = {
  queuedTitle: 'Enregistré sur votre téléphone',
  queuedBody: 'Vous êtes hors ligne. Ce signalement sera envoyé dès que vous serez de nouveau en ligne.',
  chipOne: '{count} en attente',
  chipOther: '{count} en attente',
  listTitle: "Signalements en attente d'envoi",
  listBody: 'Ils partent tout seuls quand la connexion revient.',
  waiting: 'En attente de connexion',
  sendingPhotos: '{reference} créé, envoi des photos',
  failed: 'Non envoyé',
  retry: 'Réessayer',
  discard: 'Supprimer',
  sentToast: 'Signalement {reference} envoyé',
  signOutTitle: 'Se déconnecter et perdre les signalements en attente ?',
  signOutBody:
    "{count} signalement(s) n'ont pas encore été envoyés. Si vous vous déconnectez maintenant, ils sont supprimés.",
  signOutConfirm: 'Se déconnecter et supprimer',
};
