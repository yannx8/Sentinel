import type { Dictionary } from '../en';
import type { Translation } from '../types';
import { account } from './account';
import { audit } from './audit';
import { auth } from './auth';
import { common } from './common';
import { dashboard } from './dashboard';
import { field } from './field';
import { incidents } from './incidents';
import { notifications } from './notifications';
import { platform } from './platform';
import { pwa } from './pwa';
import { setup } from './setup';
import { shell } from './shell';
import { team } from './team';
import { thread } from './thread';

export const fr: Translation<Dictionary> = {
  common,
  auth,
  shell,
  incidents,
  dashboard,
  team,
  setup,
  audit,
  notifications,
  field,
  platform,
  pwa,
  account,
  thread,
};
