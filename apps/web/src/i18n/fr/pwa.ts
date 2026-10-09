import type { pwa as en } from '../en/pwa';
import type { Translation } from '../types';

export const pwa: Translation<typeof en> = {
  updateAvailable: 'Une nouvelle version est prête',
  reload: 'Recharger',
  install: {
    title: "Installer l'application",
    description: "Ouvrez Sentinel depuis votre écran d'accueil, comme n'importe quelle application.",
    button: 'Installer',
    ios: "Dans Safari, touchez le bouton Partager, puis Sur l'écran d'accueil.",
  },
};
