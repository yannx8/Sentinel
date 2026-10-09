import { account } from './account';
import { audit } from './audit';
import { auth } from './auth';
import { common } from './common';
import { dashboard } from './dashboard';
import { field } from './field';
import { incidents } from './incidents';
import { notifications } from './notifications';
import { offline } from './offline';
import { platform } from './platform';
import { pwa } from './pwa';
import { setup } from './setup';
import { shell } from './shell';
import { team } from './team';
import { thread } from './thread';

export const en = {
  common,
  auth,
  shell,
  incidents,
  dashboard,
  team,
  setup,
  audit,
  notifications,
  offline,
  field,
  platform,
  pwa,
  account,
  thread,
};
export type Dictionary = typeof en;
