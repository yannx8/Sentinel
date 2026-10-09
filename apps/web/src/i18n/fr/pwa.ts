import type { pwa as en } from '../en/pwa';
import type { Translation } from '../types';

export const pwa: Translation<typeof en> = {
  updateAvailable: 'Une nouvelle version est prête',
  reload: 'Recharger',
  push: {
    title: 'Notifications sur cet appareil',
    description: "Recevez une notification quand un de vos incidents change, même lorsque l'application est fermée.",
    enable: 'Activer les notifications',
    disable: 'Désactiver les notifications',
    enabled: 'Notifications activées',
    disabled: 'Notifications désactivées',
    denied: 'Les notifications sont bloquées pour ce site. Autorisez-les dans les réglages du navigateur.',
    unsupported: 'Ce navigateur ne peut pas recevoir de notifications.',
    iosHint:
      "Sur iPhone, ajoutez d'abord l'application à l'écran d'accueil, puis ouvrez-la depuis là pour activer les notifications.",
  },
  install: {
    title: "Installer l'application",
    description: "Ouvrez Sentinel depuis votre écran d'accueil, comme n'importe quelle application.",
    button: 'Installer',
    ios: "Dans Safari, touchez le bouton Partager, puis Sur l'écran d'accueil.",
  },
};
