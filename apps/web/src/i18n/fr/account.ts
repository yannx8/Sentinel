import type { account as en } from '../en/account';
import type { Translation } from '../types';

export const account: Translation<typeof en> = {
  title: 'Compte',
  description: 'Votre profil, votre langue et la sécurité de votre connexion.',
  profile: {
    title: 'Profil',
    description: 'Affiché à vos collègues sur les incidents et les affectations.',
    email: 'Email',
    emailHint: 'Votre adresse de connexion. Demandez à votre organisation de la modifier.',
    firstName: 'Prénom',
    lastName: 'Nom',
    phone: 'Téléphone',
    language: 'Langue',
    saved: 'Profil enregistré',
  },
  appearance: { title: 'Apparence', description: "Choisissez l'apparence de Sentinel sur cet appareil." },
  availability: { title: 'Disponibilité', description: 'Les superviseurs la voient au moment d’assigner du travail.' },
  password: {
    title: 'Mot de passe',
    description: 'Le modifier vous déconnecte de tous les autres appareils.',
    current: 'Mot de passe actuel',
    next: 'Nouveau mot de passe',
    confirm: 'Confirmer le nouveau mot de passe',
    submit: 'Modifier le mot de passe',
    changed: 'Mot de passe modifié. Les autres appareils ont été déconnectés.',
  },
  sessions: {
    title: 'Sessions actives',
    description: 'Appareils sur lesquels vous êtes connecté.',
    thisDevice: 'Cet appareil',
    lastActive: 'Dernière activité {time}',
    signOut: 'Déconnecter',
    signedOut: 'Appareil déconnecté',
    unknown: 'Appareil inconnu',
  },
  organizations: {
    title: 'Organisations',
    description: 'Vous pouvez passer d’une organisation à l’autre.',
    current: 'Actuelle',
    switch: 'Passer à celle-ci',
  },
  signOut: 'Se déconnecter',
};
