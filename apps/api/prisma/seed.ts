/**
 * Demo dataset for local development, screenshots and manual QA:
 * `pnpm --filter @sentinel/api db:seed`. It empties every application table first.
 *
 * Incidents are played step by step under the rules of the incident service
 * (transitions, versions, timestamps, Thread payloads, notifications) and then
 * inserted once in their final state: closed incidents are read-only (I8) and
 * audit rows are append-only (I7), so nothing is updated after insert. Random
 * choices come from a fixed seed, so every run gives the same dataset relative
 * to the current time.
 */
import { randomUUID } from 'node:crypto';
import type { Prisma } from '@prisma/client';
import {
  formatReference,
  incidentActions,
  isLiveAssignment,
  nextStatus,
  statusForAssignment,
  type AssignmentStatus,
  type AuditEventType,
  type Availability,
  type CommentVisibility,
  type DismissReason,
  type IncidentStatus,
  type IncidentTrigger,
  type Industry,
  type LiveAssignmentStatus,
  type Locale,
  type MembershipRole,
  type NotificationType,
  type OrganizationStatus,
  type Plan,
  type PlatformEventType,
  type Priority,
  type ProgressType,
  type ReassignmentReason,
  type registerCompanySchema,
  type SizeBand,
  type ThreadEventType,
  type ThreadPayloads,
} from '@sentinel/shared';
import type { z } from 'zod';
import { isProduction } from '../src/env';
import { hashPassword, hashToken, newToken } from '../src/lib/crypto';
import { prisma, type Tx } from '../src/lib/prisma';
import { acceptUrl, INVITATION_TTL_MS } from '../src/modules/people/service';
import { seedCatalog } from '../src/modules/registration';

if (isProduction) {
  console.error('The demo seed empties every table. It does not run when NODE_ENV is production.');
  process.exit(1);
}

const DEMO_PASSWORD = 'sentinel-demo';
const PLATFORM_TOTP_SECRET = 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP';
// Same version as the registration flow, so demo owners are not asked to accept the terms again.
const TERMS_VERSION = '2026-10';

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const REGISTRATION_TTL_MS = DAY;
const ATLAS_SUSPENDED_DAYS_AGO = 12;

const now = Date.now();
const startOfDay = (at: number) => Math.floor(at / DAY) * DAY;

/* Deterministic randomness */

function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const random = mulberry32(20261006);
const between = (min: number, max: number) => min + random() * (max - min);
const int = (min: number, max: number) => Math.floor(between(min, max + 1));

/** A delay of about `minutes`, never shorter than a minute. */
const jitter = (minutes: number) =>
  Math.max(MINUTE, Math.round(minutes * between(0.75, 1.25) * MINUTE) + int(0, 59) * 1000);

/* People */

type UserSpec = { firstName: string; lastName: string; email: string; phone?: string; locale?: Locale };

const people = {
  admin: { firstName: 'Nora', lastName: 'Vidal', email: 'admin@sentinel.test' },
  claire: { firstName: 'Claire', lastName: 'Dubois', email: 'claire@northwind.test', phone: '+33 6 12 48 30 71' },
  marc: { firstName: 'Marc', lastName: 'Lefevre', email: 'marc@northwind.test', phone: '+33 6 31 77 05 42' },
  karim: { firstName: 'Karim', lastName: 'Benali', email: 'karim@rhone-plomberie.test', phone: '+33 6 72 14 90 33' },
  anna: { firstName: 'Anna', lastName: 'Roussel', email: 'anna@voltec.test', phone: '+33 6 45 02 18 66' },
  joel: { firstName: 'Joel', lastName: 'Martin', email: 'joel@northwind.test', phone: '+33 6 88 23 41 07' },
  mia: { firstName: 'Mia', lastName: 'Duval', email: 'mia@clim-sud.test', phone: '+33 6 19 56 72 84' },
  theo: { firstName: 'Theo', lastName: 'Garnier', email: 'theo@northwind.test', phone: '+33 6 52 90 37 15' },
  sarah: { firstName: 'Sarah', lastName: 'Kone', email: 'sarah@securipro.test', phone: '+33 6 27 64 81 59' },
  lea: { firstName: 'Lea', lastName: 'Moreau', email: 'lea@northwind.test', phone: '+33 4 72 00 10 10' },
  hugo: { firstName: 'Hugo', lastName: 'Petit', email: 'hugo@northwind.test', phone: '+33 6 03 85 26 41' },
  ines: { firstName: 'Ines', lastName: 'Laurent', email: 'ines@northwind.test' },
  paul: { firstName: 'Paul', lastName: 'Girard', email: 'paul@northwind.test', phone: '+33 6 74 31 09 52' },
  chloe: { firstName: 'Chloe', lastName: 'Bernard', email: 'chloe@northwind.test' },
  yanis: { firstName: 'Yanis', lastName: 'Haddad', email: 'yanis@northwind.test' },
  emma: { firstName: 'Emma', lastName: 'Fontaine', email: 'emma@northwind.test' },
  nathan: { firstName: 'Nathan', lastName: 'Roux', email: 'nathan@northwind.test', phone: '+33 6 40 12 77 93' },
  jade: { firstName: 'Jade', lastName: 'Mercier', email: 'jade@northwind.test' },
  louis: { firstName: 'Louis', lastName: 'Blanc', email: 'louis@northwind.test' },
  lucas: {
    firstName: 'Lucas',
    lastName: 'Peeters',
    email: 'lucas@helios.test',
    phone: '+32 470 12 34 56',
    locale: 'fr',
  },
  camille: { firstName: 'Camille', lastName: 'Dupont', email: 'camille@helios.test', locale: 'fr' },
  nadia: {
    firstName: 'Nadia',
    lastName: 'Ferreira',
    email: 'atlas-owner@atlas.test',
    phone: '+33 6 91 08 44 20',
    locale: 'fr',
  },
} satisfies Record<string, UserSpec>;

type PersonKey = keyof typeof people;

/* Organization specs */

type SiteSpec = {
  code: string;
  name: string;
  address: string;
  city: string;
  contactName?: string;
  contactPhone?: string;
  /** Used to place incidents reported from a phone on the map. */
  lat: number;
  lng: number;
  closedDaysAgo?: number;
};

type MemberSpec =
  | { person: PersonKey; role: 'SUPERVISOR'; owner: true }
  | { person: PersonKey; role: 'SUPERVISOR'; invitedBy: PersonKey; joinedDaysAgo: number }
  | {
      person: PersonKey;
      role: 'INTERVENANT';
      invitedBy: PersonKey;
      joinedDaysAgo: number;
      company: string;
      availability: Availability;
      specialties: string[];
      sites: string[] | 'all';
    }
  | {
      person: PersonKey;
      role: 'REPORTER';
      invitedBy: PersonKey;
      joinedDaysAgo: number;
      code: string;
      jobTitle: string;
      department: string;
      homeSite: string;
    };

type InvitationSpec = {
  firstName: string;
  lastName: string;
  email: string;
  invitedBy: PersonKey;
  sentHoursAgo: number;
} & (
  | { role: 'REPORTER'; code: string; jobTitle: string; department: string; homeSite: string }
  | { role: 'INTERVENANT'; company: string; specialties: string[]; sites: string[] }
);

type Step =
  | { kind: 'triage'; by: PersonKey; after: number; priority?: Priority; category?: string }
  | {
      kind: 'assign';
      by: PersonKey;
      to: PersonKey;
      after: number;
      note?: string;
      priority?: Priority;
      category?: string;
    }
  | { kind: 'accept'; after: number }
  | { kind: 'decline'; after: number; reason: string }
  | { kind: 'request-reassignment'; after: number; reasonCode: ReassignmentReason; note: string | null }
  | { kind: 'progress'; after: number; progressType: ProgressType; note: string }
  | { kind: 'comment'; by: PersonKey; after: number; visibility: CommentVisibility; body: string }
  | { kind: 'resolve'; after: number; note: string }
  | { kind: 'send-back'; by: PersonKey; after: number; reason: string }
  | { kind: 'close'; by: PersonKey; after: number }
  | { kind: 'dismiss'; by: PersonKey; after: number; reason: DismissReason; note: string | null };

type IncidentSpec = {
  title: string;
  description: string;
  site: string;
  reporter: PersonKey;
  /** A supervisor who typed the report on the employee's behalf. */
  onBehalfBy?: PersonKey;
  category: string;
  /** Defaults to the category's default priority. */
  priority?: Priority;
  location?: string;
  daysAgo: number;
  /** Fixed report time (UTC hour and minute), when the story needs it. */
  at?: [number, number];
  steps: Step[];
};

type OrgSpec = {
  slug: string;
  legalName: string;
  displayName: string;
  registrationNumber: string | null;
  industry: Industry;
  sizeBand: SizeBand;
  country: string;
  city: string;
  timezone: string;
  locale: Locale;
  website: string | null;
  billingEmail: string;
  plan: Plan;
  trialEndsAt: number | null;
  status: OrganizationStatus;
  createdDaysAgo: number;
  /** The last change made from the platform console, recorded as a platform event. */
  platformChange: { type: PlatformEventType; daysAgo: number; reason: string; payload?: Prisma.InputJsonObject } | null;
  sites: SiteSpec[];
  members: MemberSpec[];
  invitations: InvitationSpec[];
  incidents: IncidentSpec[];
};

/* Step builders. Delays are in minutes after the previous step. */

const triage = (by: PersonKey, after: number, change: { priority?: Priority; category?: string }): Step => ({
  kind: 'triage',
  by,
  after,
  ...change,
});
const assign = (
  by: PersonKey,
  to: PersonKey,
  after: number,
  extra: { note?: string; priority?: Priority; category?: string } = {},
): Step => ({ kind: 'assign', by, to, after, ...extra });
const accept = (after: number): Step => ({ kind: 'accept', after });
const decline = (after: number, reason: string): Step => ({ kind: 'decline', after, reason });
const askReassignment = (after: number, reasonCode: ReassignmentReason, note: string | null): Step => ({
  kind: 'request-reassignment',
  after,
  reasonCode,
  note,
});
const progress = (after: number, progressType: ProgressType, note: string): Step => ({
  kind: 'progress',
  after,
  progressType,
  note,
});
const comment = (by: PersonKey, after: number, visibility: CommentVisibility, body: string): Step => ({
  kind: 'comment',
  by,
  after,
  visibility,
  body,
});
const resolve = (after: number, note: string): Step => ({ kind: 'resolve', after, note });
const sendBack = (by: PersonKey, after: number, reason: string): Step => ({ kind: 'send-back', by, after, reason });
const close = (by: PersonKey, after: number): Step => ({ kind: 'close', by, after });
const dismiss = (by: PersonKey, after: number, reason: DismissReason, note: string | null): Step => ({
  kind: 'dismiss',
  by,
  after,
  reason,
  note,
});

/* Northwind Facilities: the main demo tenant */

const northwindIncidents: IncidentSpec[] = [
  // Closed
  {
    title: 'Water leaking under the reception sink',
    description:
      'There is water pooling under the sink behind the reception desk. I put a bucket down but it fills up in about an hour.',
    site: 'LYON-HQ',
    reporter: 'lea',
    category: 'Water leak',
    location: 'Reception, behind the desk',
    daysAgo: 29,
    steps: [
      assign('claire', 'karim', 25),
      accept(20),
      progress(
        95,
        'ON_SITE',
        'On site. The seal on the sink trap has failed, water runs down the wall into the cabinet.',
      ),
      resolve(
        50,
        'Replaced the trap and the worn seal under the reception sink. Ran the tap for 20 minutes, no more leak.',
      ),
      comment('lea', 40, 'PUBLIC', 'Thank you, all dry now. I left the bucket in the cleaning cupboard.'),
      close('claire', 1100),
    ],
  },
  {
    title: 'Loading dock door 3 stuck half open',
    description:
      'The roller door on dock 3 stopped halfway up this morning and will not move either way. We are sending trucks to docks 1 and 2 for now but it slows everything down.',
    site: 'LYON-WH',
    reporter: 'hugo',
    category: 'Door, lock or access',
    priority: 'HIGH',
    location: 'Dock 3',
    daysAgo: 28,
    steps: [
      assign('marc', 'joel', 35, {
        note: 'Sarah has no access to the warehouse. Can you check the motor and the safety edge first?',
      }),
      accept(15),
      progress(
        70,
        'ON_SITE',
        'On site. The motor cut out on overheating, the safety edge sensor gives false readings.',
      ),
      resolve(
        85,
        'Cleaned and realigned the safety edge sensor, the motor had overheated from repeated retries. Door cycled 15 times without a fault.',
      ),
      close('marc', 900),
    ],
  },
  {
    title: 'Meeting room Belleville way too hot',
    description:
      'The air conditioning in Belleville blows warm air. It was 28 degrees during the 10am meeting and we had to open the windows.',
    site: 'PARIS-11',
    reporter: 'ines',
    category: 'Heating or cooling',
    location: 'Meeting room Belleville, 4th floor',
    daysAgo: 27,
    steps: [
      assign('marc', 'mia', 60),
      accept(120),
      progress(1300, 'ON_SITE', 'On site this morning. Refrigerant pressure is low on the split unit.'),
      resolve(
        90,
        'Found a small leak on a flare joint, remade the joint and recharged the refrigerant. Room down to 21 degrees after 30 minutes.',
      ),
      close('marc', 400),
    ],
  },
  {
    title: 'No power in the depot office',
    description:
      'All the sockets and lights in the depot office went off at 7:40. The warehouse side still has power. We cannot print delivery notes.',
    site: 'MRS-PORT',
    reporter: 'paul',
    category: 'Power outage',
    location: 'Depot office, ground floor',
    daysAgo: 26,
    at: [5, 41],
    steps: [
      assign('claire', 'anna', 12, { note: 'Urgent, the depot cannot print delivery notes and drivers are waiting.' }),
      accept(6),
      progress(55, 'ON_SITE', 'On site. The breaker for the office circuit has tripped and trips again when reset.'),
      comment(
        'anna',
        20,
        'INTERNAL',
        'Found it: the kettle in the kitchenette shorts the circuit. Unplugged and set aside.',
      ),
      resolve(
        25,
        'A faulty kettle tripped the office circuit breaker. Kettle removed, breaker reset, every socket tested.',
      ),
      comment(
        'claire',
        30,
        'INTERNAL',
        'Thanks Anna. I will remind the depot that personal appliances need a safety check.',
      ),
      close('claire', 240),
    ],
  },
  {
    title: 'Lights out in the depot office',
    description: 'All the lights went off in the office and the computers too. Nothing works.',
    site: 'MRS-PORT',
    reporter: 'louis',
    category: 'Power outage',
    location: 'Depot office',
    daysAgo: 26,
    at: [5, 52],
    steps: [
      dismiss(
        'claire',
        14,
        'DUPLICATE',
        'Already reported by Paul Girard a few minutes earlier. Anna Roussel is on her way.',
      ),
    ],
  },
  {
    title: 'Wi-Fi in the lab drops every few minutes',
    description:
      'Since Monday the Wi-Fi in lab 2 disconnects every 5 to 10 minutes. It breaks the data uploads from the analysers and we have to restart them by hand.',
    site: 'GRE-LAB',
    reporter: 'chloe',
    category: 'IT or network',
    location: 'Lab 2',
    daysAgo: 25,
    steps: [
      triage('marc', 50, { priority: 'HIGH' }),
      assign('marc', 'theo', 30),
      accept(25),
      progress(
        180,
        'UPDATE',
        'The access point in lab 2 runs an old firmware and reboots in a loop. I will update it tonight so the analysers are not cut during the day.',
      ),
      progress(
        720,
        'UPDATE',
        'Firmware updated last night and the channel moved away from the analysers. Monitoring today.',
      ),
      resolve(
        480,
        'Updated the access point firmware and moved it to a channel clear of the analysers. No disconnection since last night.',
      ),
      comment('chloe', 60, 'PUBLIC', 'Uploads ran all morning without a single cut. Thanks.'),
      close('marc', 200),
    ],
  },
  {
    title: 'Broken office chair in HR',
    description:
      'The backrest of one of the chairs in the HR office snapped this morning. Nobody was hurt but someone could fall leaning on it.',
    site: 'LYON-HQ',
    reporter: 'emma',
    category: 'Damage or repair',
    priority: 'LOW',
    location: 'HR office, 3rd floor',
    daysAgo: 24,
    steps: [
      assign('claire', 'joel', 180),
      accept(60),
      resolve(
        120,
        'Took the broken chair out of service and replaced it with a spare from the 2nd floor storage room. The broken one goes back to the supplier under warranty.',
      ),
      close('claire', 1300),
    ],
  },
  {
    title: 'Oil spill in aisle 4',
    description:
      'Big oil patch on the floor in aisle 4 near the charging station. I put cones around it but forklifts still have to go through there.',
    site: 'LYON-WH',
    reporter: 'yanis',
    category: 'Safety hazard',
    location: 'Aisle 4, next to the charging station',
    daysAgo: 23,
    steps: [
      assign('claire', 'joel', 10, { note: 'The absorbent kit is in the cage next to dock 1.' }),
      accept(5),
      progress(30, 'ON_SITE', 'On site, absorbent down. The oil comes from forklift 2, its hydraulic hose is weeping.'),
      comment(
        'claire',
        25,
        'INTERNAL',
        'Called the forklift rental company, a technician comes tomorrow for forklift 2.',
      ),
      resolve(
        70,
        'Spill absorbed and the floor degreased. Forklift 2 is tagged out until the rental company replaces the hydraulic hose.',
      ),
      close('claire', 1500),
    ],
  },
  {
    title: 'Visitor badge printer not working',
    description:
      'The badge printer at reception shows a red light and prints blank badges. We have a group of visitors coming at 2pm.',
    site: 'LYON-HQ',
    reporter: 'lea',
    category: 'IT or network',
    location: 'Reception desk',
    daysAgo: 22,
    steps: [
      assign('marc', 'theo', 20),
      accept(10),
      resolve(
        55,
        'The printhead was dirty and the ribbon had been loaded backwards. Cleaned the head, reloaded the ribbon, test badges print fine.',
      ),
      comment('lea', 15, 'PUBLIC', 'Works again, just in time for the visitors.'),
      close('marc', 1400),
    ],
  },
  {
    title: 'Toilet on the 2nd floor keeps running',
    description:
      "The toilet in the 2nd floor women's restroom keeps running after you flush. You can hear it from the open space and it must waste a lot of water.",
    site: 'PARIS-11',
    reporter: 'ines',
    category: 'Water leak',
    location: '2nd floor restrooms',
    daysAgo: 21,
    steps: [
      assign('marc', 'karim', 45, { priority: 'MEDIUM' }),
      decline(70, 'I am on a job in Lyon all week and cannot get to Paris before Monday.'),
      assign('marc', 'joel', 25, {
        note: 'Karim cannot come before Monday. Joel, you are in Paris later this week, can you take it?',
      }),
      accept(40),
      resolve(
        2700,
        'Replaced the fill valve and the flapper in the cistern. Flushed ten times, it stops properly now.',
      ),
      close('marc', 600),
    ],
  },
  {
    title: 'Second monitor for my desk',
    description:
      'Could I get a second monitor? I work on client reports all day and switching windows on a laptop screen is painful.',
    site: 'PARIS-11',
    reporter: 'nathan',
    category: 'Other',
    daysAgo: 20,
    steps: [
      dismiss(
        'marc',
        95,
        'NOT_AN_INCIDENT',
        'Equipment requests go through the IT request form on the intranet. I sent you the link by email.',
      ),
    ],
  },
  {
    title: 'Cold room B temperature alarm',
    description:
      'The temperature alarm on cold room B went off twice this morning. The display shows 9 degrees instead of 4. We moved the most sensitive stock to cold room A.',
    site: 'MRS-PORT',
    reporter: 'paul',
    category: 'Heating or cooling',
    priority: 'HIGH',
    location: 'Cold room B',
    daysAgo: 19,
    steps: [
      assign('claire', 'mia', 20, { priority: 'CRITICAL' }),
      accept(15),
      progress(90, 'ON_SITE', 'On site. The compressor runs but the evaporator fan is dead.'),
      askReassignment(
        40,
        'UNAVAILABLE',
        'The replacement fan motor is on back order for 10 days with my supplier. Someone with a local part would be faster.',
      ),
      assign('claire', 'joel', 25, {
        note: 'There is a spare evaporator fan in the depot technical room. Can you fit it today?',
      }),
      accept(10),
      progress(120, 'ON_SITE', 'On site with the spare fan from the technical room.'),
      resolve(75, 'Fitted the spare evaporator fan motor. Cold room B was back at 4 degrees within the hour.'),
      close('claire', 900),
    ],
  },
  {
    title: 'Radiators cold on the 3rd floor',
    description: 'All the radiators on the east side of the 3rd floor are cold. People are working in their coats.',
    site: 'LYON-HQ',
    reporter: 'emma',
    category: 'Heating or cooling',
    location: '3rd floor, east side',
    daysAgo: 17,
    steps: [
      assign('claire', 'joel', 40),
      accept(30),
      resolve(150, 'Bled the radiators on the east side, there was a lot of air in the circuit. They are warming up.'),
      comment('emma', 1000, 'PUBLIC', 'Better, but the two radiators near the windows are still cold this morning.'),
      sendBack('claire', 25, 'Emma says the two radiators near the windows are still cold. Please check their valves.'),
      progress(120, 'ON_SITE', 'Back on site. Two thermostatic valves are stuck closed.'),
      resolve(
        60,
        'Freed both stuck thermostatic valves and replaced one valve head. All radiators on the east side are warm.',
      ),
      comment('emma', 200, 'PUBLIC', 'All warm now, thank you.'),
      close('claire', 120),
    ],
  },
  {
    title: 'Sparks from a bench socket in lab 1',
    description:
      'There was a spark and a burning smell when I plugged in the centrifuge on the bench socket by the window. I have not used it since and put tape over it.',
    site: 'GRE-LAB',
    reporter: 'jade',
    category: 'Electrical fault',
    location: 'Lab 1, bench by the window',
    daysAgo: 15,
    steps: [
      assign('marc', 'joel', 15, {
        priority: 'CRITICAL',
        note: 'Nobody from Voltec covers Grenoble. Please isolate the circuit and tell us if we need an electrician.',
      }),
      accept(10),
      progress(60, 'ON_SITE', 'Circuit isolated at the board. The terminal block behind the socket is scorched.'),
      progress(
        30,
        'BLOCKED',
        'Waiting for a replacement socket and terminal block, delivery tomorrow morning. The bench stays off until then.',
      ),
      progress(1150, 'UPDATE', 'Parts arrived, replacing them now.'),
      resolve(
        90,
        'Replaced the socket and the scorched terminal block, tightened every connection on the bench circuit. Insulation test passed.',
      ),
      close('marc', 1300),
    ],
  },
  {
    title: 'Rack upright bent after a forklift hit it',
    description:
      'A forklift hit the upright of rack B12 this morning, it is visibly bent at the bottom. We emptied the top two levels and taped off the aisle.',
    site: 'LYON-WH',
    reporter: 'hugo',
    category: 'Damage or repair',
    location: 'Rack B12',
    daysAgo: 12,
    steps: [
      triage('claire', 20, { category: 'Safety hazard', priority: 'HIGH' }),
      assign('claire', 'joel', 15),
      accept(25),
      progress(
        90,
        'BLOCKED',
        'The upright must be replaced, not straightened. Ordered one from the rack supplier, 2 days.',
      ),
      progress(2900, 'ON_SITE', 'Upright delivered, replacing it now.'),
      resolve(
        180,
        'Replaced the damaged upright and its base plate, checked the beam locks on both sides. Rack inspected and back in service.',
      ),
      close('claire', 1100),
    ],
  },
  {
    title: 'Meeting room screen does not detect laptops',
    description:
      'The screen in room Oberkampf does not pick up any laptop, neither with the HDMI cable nor with the wireless dongle. I have two client meetings in there tomorrow.',
    site: 'PARIS-11',
    reporter: 'nathan',
    category: 'IT or network',
    location: 'Meeting room Oberkampf',
    daysAgo: 10,
    steps: [
      assign('marc', 'theo', 50),
      accept(20),
      resolve(
        240,
        'The HDMI switch had a faulty power supply. Replaced it and paired the wireless dongle again. Tested with a Windows laptop and a Mac.',
      ),
      close('marc', 900),
    ],
  },
  {
    title: 'Main entrance door does not close fully',
    description:
      'The automatic door at the main entrance stays open about 20 cm after people go through. It lets the cold in and the night alarm cannot be set.',
    site: 'LYON-HQ',
    reporter: 'lea',
    category: 'Door, lock or access',
    location: 'Main entrance',
    daysAgo: 8,
    steps: [
      triage('claire', 20, { priority: 'HIGH' }),
      assign('claire', 'sarah', 15),
      accept(30),
      progress(200, 'ON_SITE', 'On site. The floor guide is worn and the closing speed is set too low.'),
      resolve(
        80,
        'Adjusted the closing speed and replaced the worn floor guide. The door closes and locks normally, alarm test done with Lea.',
      ),
      close('claire', 1000),
    ],
  },
  {
    title: 'Flickering lights over loading bay 2',
    description:
      'Louis called: the lights above bay 2 have been flickering since this morning. Hard to read the labels and it gives the team headaches.',
    site: 'MRS-PORT',
    reporter: 'louis',
    onBehalfBy: 'claire',
    category: 'Electrical fault',
    priority: 'MEDIUM',
    location: 'Loading bay 2',
    daysAgo: 6,
    steps: [
      assign('claire', 'anna', 20),
      accept(40),
      resolve(300, 'Two LED drivers were failing. Replaced both and checked the other fittings on the same line.'),
      close('claire', 1200),
    ],
  },
  {
    title: 'Fume hood 2 airflow alarm',
    description:
      "The low airflow alarm on fume hood 2 keeps beeping. We stopped using it but we need it for this week's tests.",
    site: 'GRE-LAB',
    reporter: 'chloe',
    category: 'Safety hazard',
    location: 'Lab 2, fume hood 2',
    daysAgo: 4,
    steps: [
      triage('marc', 30, { category: 'Heating or cooling', priority: 'HIGH' }),
      assign('marc', 'joel', 20),
      accept(30),
      resolve(
        200,
        'The extract fan belt was slipping. Replaced the belt and measured the face velocity at 0.5 m/s, the alarm has cleared.',
      ),
      close('marc', 400),
    ],
  },

  // Resolved, waiting for review
  {
    title: 'Forklift 3 charger not charging',
    description:
      'The charger for forklift 3 shows error E4 and the battery stays at 20 percent. We are down to two forklifts.',
    site: 'LYON-WH',
    reporter: 'yanis',
    category: 'Electrical fault',
    location: 'Charging station, aisle 4',
    daysAgo: 3,
    steps: [
      assign('marc', 'anna', 30),
      accept(45),
      progress(110, 'ON_SITE', 'On site. The charger fuse has blown and the output connector is corroded.'),
      resolve(
        70,
        'Replaced the charger fuse and the corroded output connector. The charger runs a full cycle again, battery at 45 percent and climbing.',
      ),
    ],
  },
  {
    title: 'Coffee machine leaking in the kitchen',
    description:
      'The coffee machine in the 3rd floor kitchen leaks onto the counter every time it runs. The water drips into the cupboard underneath.',
    site: 'PARIS-11',
    reporter: 'ines',
    category: 'Water leak',
    location: '3rd floor kitchen',
    daysAgo: 2,
    steps: [
      assign('marc', 'karim', 60),
      accept(90),
      progress(1000, 'ON_SITE', 'On site. The inlet hose under the counter is cracked.'),
      resolve(
        45,
        'Replaced the cracked inlet hose and added a shut-off valve under the counter so it can be isolated next time.',
      ),
      comment('ines', 300, 'PUBLIC', 'No water on the counter this morning. Thanks Karim.'),
    ],
  },
  {
    title: 'Printer on floor 2 jams on every page',
    description:
      'The big printer on the 2nd floor jams on almost every page. We are walking to the 1st floor to print.',
    site: 'LYON-HQ',
    reporter: 'emma',
    category: 'IT or network',
    location: '2nd floor printer area',
    daysAgo: 2,
    steps: [
      assign('claire', 'theo', 90),
      accept(30),
      progress(60, 'UPDATE', 'The fuser unit is worn. New fuser kit ordered, it arrives tomorrow.'),
      progress(1200, 'UPDATE', 'Fuser kit delivered, installing it this afternoon.'),
      resolve(150, 'Replaced the fuser kit and the pickup rollers. Printed 200 test pages without a jam.'),
    ],
  },
  {
    title: 'Truck gate barrier stays up',
    description:
      'The barrier at the truck entrance stays up after each truck goes through, so anyone can drive in. Louis is checking vehicles by hand for now.',
    site: 'MRS-PORT',
    reporter: 'paul',
    category: 'Door, lock or access',
    location: 'Truck gate',
    daysAgo: 1,
    steps: [
      assign('claire', 'joel', 25, { priority: 'HIGH' }),
      accept(20),
      progress(150, 'ON_SITE', 'On site. The loop detector cable is cut, probably by a truck.'),
      resolve(
        120,
        'Replaced the damaged loop detector cable and reset the barrier controller. The barrier closes after every passage.',
      ),
    ],
  },

  // In progress
  {
    title: 'Reception area too cold in the morning',
    description:
      'The heating in the reception area only seems to start around 10. Until then it is about 16 degrees at the desk.',
    site: 'LYON-HQ',
    reporter: 'lea',
    category: 'Heating or cooling',
    location: 'Reception area',
    daysAgo: 6,
    steps: [
      assign('marc', 'joel', 90),
      accept(60),
      progress(
        1000,
        'ON_SITE',
        'Checked the boiler schedule. The reception zone runs on its own timer and the controller does not keep its settings.',
      ),
      progress(
        60,
        'BLOCKED',
        'The zone controller needs a replacement board. Ordered from the supplier, expected in a few days.',
      ),
      comment(
        'marc',
        30,
        'PUBLIC',
        'Joel has ordered a part for the heating controller, it should arrive in a few days. A portable heater is on its way to reception in the meantime.',
      ),
      comment('lea', 45, 'PUBLIC', 'Thanks, the heater helps a lot.'),
    ],
  },
  {
    title: 'Badge reader at the side entrance rejects badges',
    description:
      'The badge reader on the side door rejects every badge since this morning, the light just blinks red. Everyone has to go around to the main entrance.',
    site: 'PARIS-11',
    reporter: 'nathan',
    category: 'Door, lock or access',
    location: 'Side entrance, Rue Oberkampf',
    daysAgo: 3,
    steps: [
      assign('marc', 'sarah', 50),
      accept(30),
      progress(180, 'ON_SITE', 'On site. The reader has power but does not talk to the access controller.'),
      askReassignment(
        40,
        'UNAVAILABLE',
        'I am on leave from tomorrow for two weeks. The controller needs a firmware reset that Theo can probably do remotely.',
      ),
    ],
  },
  {
    title: 'Roof leak above aisle 7',
    description:
      'Rain is dripping from the roof above aisle 7 onto pallets of cardboard. We covered them with plastic sheets but it is getting worse.',
    site: 'LYON-WH',
    reporter: 'hugo',
    category: 'Water leak',
    location: 'Aisle 7, under the skylight',
    daysAgo: 5,
    steps: [
      assign('claire', 'karim', 40),
      accept(35),
      progress(100, 'ON_SITE', 'On site. The seal around the skylight frame is cracked.'),
      resolve(150, 'Resealed the whole skylight frame above aisle 7. No water came through during the hose test.'),
      comment(
        'hugo',
        1600,
        'PUBLIC',
        'It rained again last night and it is still dripping, about 3 metres further along the aisle.',
      ),
      sendBack(
        'marc',
        40,
        "Hugo reports it still leaks after last night's rain, about 3 metres from the skylight. Please check the gutter as well.",
      ),
      progress(
        120,
        'UPDATE',
        'Coming back tomorrow morning with a roofer to check the gutter joint. Pallets moved out of aisle 7 in the meantime.',
      ),
    ],
  },
  {
    title: 'Shared drive very slow from the lab',
    description: 'Opening files on the shared drive from the lab takes minutes. From the office next door it is fine.',
    site: 'GRE-LAB',
    reporter: 'jade',
    category: 'IT or network',
    location: 'Lab 1',
    daysAgo: 2,
    steps: [
      assign('marc', 'theo', 120),
      accept(25),
      progress(
        140,
        'UPDATE',
        'The lab switch uplink runs at 100 Mb/s instead of 1 Gb/s. Replacing the patch cable first, then I will test the port.',
      ),
      comment(
        'theo',
        60,
        'INTERNAL',
        'If the switch port is faulty we need a new switch, around 400 euros. Can you approve?',
      ),
      comment('marc', 50, 'INTERNAL', 'Approved, go ahead if the cable does not fix it.'),
    ],
  },
  {
    title: 'Air conditioning leaking in the drivers rest room',
    description:
      "Water drips from the air conditioning unit in the drivers' rest room onto the sofa. We put a bin underneath.",
    site: 'MRS-PORT',
    reporter: 'louis',
    category: 'Heating or cooling',
    location: "Drivers' rest room",
    daysAgo: 2,
    steps: [
      assign('claire', 'mia', 80, {
        note: 'Probably the condensate drain. Mia, can you fit it in between your other jobs?',
      }),
      accept(200),
      progress(900, 'ON_SITE', 'On site. The condensate drain is blocked, cleaning it and checking the pump.'),
    ],
  },
  {
    title: 'Half the lights out in the open space',
    description: 'Half of the ceiling lights in the 3rd floor open space went off after lunch. The other half works.',
    site: 'LYON-HQ',
    reporter: 'emma',
    category: 'Electrical fault',
    location: '3rd floor open space',
    daysAgo: 1,
    steps: [
      assign('claire', 'anna', 30),
      accept(25),
      progress(110, 'ON_SITE', 'On site. One lighting circuit has tripped, looking for the faulty fitting.'),
    ],
  },
  {
    title: 'Kitchen sink blocked and smelly',
    description: 'The kitchen sink on the 2nd floor does not drain any more and there is a bad smell coming from it.',
    site: 'PARIS-11',
    reporter: 'ines',
    category: 'Cleaning',
    location: '2nd floor kitchen',
    daysAgo: 1,
    steps: [
      triage('marc', 30, { category: 'Water leak', priority: 'MEDIUM' }),
      assign('marc', 'karim', 20),
      accept(60),
      progress(
        200,
        'UPDATE',
        'Cleared the drain with a snake, there was a lot of grease. Flushing the line now to check the flow.',
      ),
    ],
  },
  {
    title: 'Dock leveller on bay 5 does not lift',
    description:
      'The dock leveller on bay 5 does not lift any more when we press the button. We cannot load trucks on that bay.',
    site: 'LYON-WH',
    reporter: 'yanis',
    category: 'Damage or repair',
    location: 'Bay 5',
    daysAgo: 4,
    steps: [
      triage('claire', 25, { priority: 'HIGH' }),
      assign('claire', 'joel', 30),
      accept(40),
      progress(90, 'ON_SITE', 'On site. The hydraulic pump runs but the pressure drops, the cylinder seal is leaking.'),
      progress(
        45,
        'BLOCKED',
        'Seal kit ordered from the manufacturer, delivery in 3 to 5 days. Bay 5 stays closed until then.',
      ),
    ],
  },
  {
    title: 'Handheld scanners lose connection in the yard',
    description:
      'The handheld scanners lose the connection as soon as we go past bay 4. We have to walk back to the office to sync the deliveries.',
    site: 'MRS-PORT',
    reporter: 'paul',
    category: 'IT or network',
    location: 'Yard, bays 4 to 6',
    daysAgo: 3,
    steps: [
      assign('claire', 'theo', 60),
      accept(120),
      progress(400, 'UPDATE', 'Coverage test done. We need an outdoor access point near bay 4, I am ordering one.'),
      comment('paul', 600, 'PUBLIC', 'Any idea when the new access point will be installed? The drivers are asking.'),
      comment(
        'claire',
        40,
        'PUBLIC',
        'Theo expects the access point early next week and will install it the same day.',
      ),
    ],
  },

  // Assigned, waiting for acceptance
  {
    title: 'Ceiling tile fell in the corridor',
    description:
      'A ceiling tile fell in the ground floor corridor near the lifts. Nobody was hurt. The tile above it has a brown water stain.',
    site: 'LYON-HQ',
    reporter: 'lea',
    category: 'Damage or repair',
    location: 'Ground floor corridor, near the lifts',
    daysAgo: 0,
    steps: [
      assign('claire', 'joel', 35, {
        note: 'Check whether the stain comes from a leak above before replacing the tile.',
      }),
    ],
  },
  {
    title: 'Loud banging from the office heating',
    description:
      'The heating in the depot office makes a loud banging noise every few minutes, it is hard to take phone calls.',
    site: 'MRS-PORT',
    reporter: 'louis',
    category: 'Heating or cooling',
    location: 'Depot office',
    daysAgo: 1,
    steps: [
      assign('claire', 'mia', 60),
      decline(150, 'I am fully booked on another site this week and cannot get there before next week.'),
      assign('claire', 'joel', 30, { note: 'Mia cannot come this week. Probably air in the pipes.' }),
    ],
  },
  {
    title: 'Emergency exit sign not lit',
    description: 'The emergency exit sign above the dock side exit is off. The test button does nothing.',
    site: 'LYON-WH',
    reporter: 'hugo',
    category: 'Safety hazard',
    location: 'Emergency exit, dock side',
    daysAgo: 2,
    steps: [
      assign('marc', 'joel', 45),
      accept(30),
      progress(
        120,
        'ON_SITE',
        'The sign needs a new battery pack and a certified check of the emergency lighting circuit.',
      ),
      askReassignment(
        10,
        'WRONG_SPECIALTY',
        'Emergency lighting has to be signed off by a certified electrician. Anna can do it.',
      ),
      assign('marc', 'anna', 50, {
        note: 'Joel checked it: the battery pack needs replacing. Please bring one and sign off the circuit.',
      }),
    ],
  },
  {
    title: 'Air conditioning far too cold in the open space',
    description:
      'The air conditioning in the 4th floor open space is set very cold, people near the vents are wearing scarves. The wall panel does not change anything.',
    site: 'PARIS-11',
    reporter: 'nathan',
    category: 'Heating or cooling',
    location: 'Open space, 4th floor',
    daysAgo: 0,
    steps: [assign('marc', 'mia', 70)],
  },
  {
    title: 'Label printer offline',
    description:
      'The label printer at sample reception shows offline on every computer. We are writing labels by hand.',
    site: 'GRE-LAB',
    reporter: 'chloe',
    category: 'IT or network',
    location: 'Sample reception',
    daysAgo: 0,
    steps: [assign('marc', 'theo', 25)],
  },

  // New
  {
    title: 'Coffee spilled on the staircase carpet',
    description:
      'Someone spilled coffee on the carpet of the main staircase between floors 1 and 2. It is sticky and starting to smell.',
    site: 'LYON-HQ',
    reporter: 'emma',
    category: 'Cleaning',
    location: 'Main staircase, between floors 1 and 2',
    daysAgo: 0,
    steps: [],
  },
  {
    title: 'Fire extinguisher missing at dock 2',
    description: 'The fire extinguisher next to dock 2 is gone, only the bracket is left. No idea since when.',
    site: 'LYON-WH',
    reporter: 'yanis',
    category: 'Safety hazard',
    priority: 'HIGH',
    location: 'Dock 2',
    daysAgo: 0,
    steps: [],
  },
  {
    title: 'Window does not close in meeting room Charonne',
    description:
      'The window handle in Charonne turns but the window stays slightly open. It is noisy and cold during meetings.',
    site: 'PARIS-11',
    reporter: 'ines',
    category: 'Damage or repair',
    location: 'Meeting room Charonne',
    daysAgo: 1,
    steps: [
      assign('marc', 'joel', 90),
      decline(120, 'I am at the Grenoble lab until the end of the week. Someone based in Paris would be faster.'),
    ],
  },
  {
    title: 'Pothole at the yard entrance',
    description: 'A pothole is forming at the yard entrance. Trucks swerve around it and it gets bigger every day.',
    site: 'MRS-PORT',
    reporter: 'paul',
    category: 'Damage or repair',
    location: 'Yard entrance',
    daysAgo: 1,
    steps: [
      triage('claire', 120, { priority: 'HIGH' }),
      comment(
        'claire',
        10,
        'INTERNAL',
        'Needs a road works contractor, not one of our intervenants. Asking for quotes.',
      ),
    ],
  },
  {
    title: 'Rattling noise in the ventilation',
    description:
      'Since yesterday there is a loud rattling noise in the ventilation duct above the lab 1 entrance. It comes and goes.',
    site: 'GRE-LAB',
    reporter: 'jade',
    category: 'Other',
    location: 'Lab 1 entrance',
    daysAgo: 2,
    steps: [triage('marc', 240, { category: 'Heating or cooling', priority: 'MEDIUM' })],
  },
  {
    title: 'Guest Wi-Fi password not accepted',
    description:
      'Visitors cannot connect to the guest Wi-Fi, the password is refused. Two visitors complained this morning.',
    site: 'LYON-HQ',
    reporter: 'lea',
    category: 'IT or network',
    location: 'Reception',
    daysAgo: 0,
    steps: [
      triage('claire', 40, { priority: 'LOW' }),
      comment(
        'claire',
        5,
        'PUBLIC',
        'Is it the password printed on the reception card or the one in the welcome email?',
      ),
      comment('lea', 20, 'PUBLIC', 'The one on the reception card.'),
    ],
  },
  {
    title: 'No soap in the 3rd floor restrooms',
    description: 'All the soap dispensers in the 3rd floor restrooms are empty since yesterday.',
    site: 'PARIS-11',
    reporter: 'nathan',
    category: 'Cleaning',
    location: '3rd floor restrooms',
    daysAgo: 1,
    steps: [triage('marc', 300, { priority: 'MEDIUM' })],
  },
  {
    title: 'Heaters not working near the docks',
    description:
      'The overhead heaters near docks 1 to 3 do not come on any more. With the doors open all day it is really cold for the team.',
    site: 'LYON-WH',
    reporter: 'hugo',
    category: 'Heating or cooling',
    location: 'Docks 1 to 3',
    daysAgo: 3,
    steps: [
      triage('marc', 50, { priority: 'HIGH' }),
      comment(
        'marc',
        15,
        'INTERNAL',
        'Only Joel does heating at the warehouse and his week is full. Assigning as soon as he has a slot.',
      ),
      comment('hugo', 1500, 'PUBLIC', 'Any news? It was 9 degrees at the docks this morning.'),
    ],
  },
];

const northwindTrialEndsAt = now + 21 * DAY;

const northwind: OrgSpec = {
  slug: 'northwind-facilities',
  legalName: 'Northwind Facilities Management SAS',
  displayName: 'Northwind Facilities',
  registrationNumber: '852 456 791',
  industry: 'FACILITIES',
  sizeBand: 'M',
  country: 'FR',
  city: 'Lyon',
  timezone: 'Europe/Paris',
  locale: 'en',
  website: 'https://northwind.test',
  billingEmail: 'claire@northwind.test',
  plan: 'TRIAL',
  trialEndsAt: northwindTrialEndsAt,
  status: 'ACTIVE',
  createdDaysAgo: 45,
  // Longer than the usual 30 day trial: the platform team extended it for the pilot.
  platformChange: {
    type: 'PLAN_CHANGED',
    daysAgo: 10,
    reason: 'Trial extended to cover the six-site pilot until the budget review.',
    payload: { from: 'TRIAL', to: 'TRIAL', trialEndsAt: new Date(northwindTrialEndsAt).toISOString() },
  },
  sites: [
    {
      code: 'LYON-HQ',
      name: 'Lyon headquarters',
      address: '25 Rue de la Villette',
      city: 'Lyon',
      contactName: 'Lea Moreau',
      contactPhone: '+33 4 72 00 10 10',
      lat: 45.7606,
      lng: 4.8594,
    },
    {
      code: 'LYON-WH',
      name: 'Venissieux warehouse',
      address: '8 Boulevard Ambroise Croizat',
      city: 'Vénissieux',
      contactName: 'Hugo Petit',
      contactPhone: '+33 6 03 85 26 41',
      lat: 45.7044,
      lng: 4.8741,
    },
    {
      code: 'PARIS-11',
      name: 'Paris Oberkampf office',
      address: '112 Rue Oberkampf',
      city: 'Paris',
      contactName: 'Ines Laurent',
      lat: 48.8657,
      lng: 2.3786,
    },
    {
      code: 'MRS-PORT',
      name: 'Marseille port depot',
      address: '210 Chemin du Littoral',
      city: 'Marseille',
      contactName: 'Paul Girard',
      contactPhone: '+33 6 74 31 09 52',
      lat: 43.3489,
      lng: 5.3523,
    },
    {
      code: 'GRE-LAB',
      name: 'Grenoble lab',
      address: '17 Avenue des Martyrs',
      city: 'Grenoble',
      contactName: 'Chloe Bernard',
      lat: 45.2003,
      lng: 5.7058,
    },
    {
      code: 'ANN-POP',
      name: 'Annecy pop-up store',
      address: '1 Rue Jean Jaurès',
      city: 'Annecy',
      lat: 45.9009,
      lng: 6.1264,
      closedDaysAgo: 33,
    },
  ],
  members: [
    { person: 'claire', role: 'SUPERVISOR', owner: true },
    { person: 'marc', role: 'SUPERVISOR', invitedBy: 'claire', joinedDaysAgo: 44 },
    {
      person: 'joel',
      role: 'INTERVENANT',
      invitedBy: 'claire',
      joinedDaysAgo: 44,
      company: 'Northwind maintenance',
      availability: 'AVAILABLE',
      specialties: ['General maintenance', 'Heating and cooling'],
      sites: 'all',
    },
    {
      person: 'theo',
      role: 'INTERVENANT',
      invitedBy: 'claire',
      joinedDaysAgo: 44,
      company: 'Northwind IT',
      availability: 'AVAILABLE',
      specialties: ['IT and network'],
      sites: 'all',
    },
    {
      person: 'karim',
      role: 'INTERVENANT',
      invitedBy: 'claire',
      joinedDaysAgo: 43,
      company: 'Rhone Plomberie',
      availability: 'AVAILABLE',
      specialties: ['Plumbing'],
      sites: ['LYON-HQ', 'LYON-WH', 'PARIS-11'],
    },
    {
      person: 'anna',
      role: 'INTERVENANT',
      invitedBy: 'claire',
      joinedDaysAgo: 43,
      company: 'Voltec Services',
      availability: 'AVAILABLE',
      specialties: ['Electrical'],
      sites: ['LYON-HQ', 'LYON-WH', 'MRS-PORT'],
    },
    {
      person: 'mia',
      role: 'INTERVENANT',
      invitedBy: 'marc',
      joinedDaysAgo: 41,
      company: 'Clim Sud',
      availability: 'BUSY',
      specialties: ['Heating and cooling'],
      sites: ['MRS-PORT', 'PARIS-11'],
    },
    {
      person: 'sarah',
      role: 'INTERVENANT',
      invitedBy: 'marc',
      joinedDaysAgo: 40,
      company: 'SecuriPro',
      availability: 'OFF',
      specialties: ['Health and safety', 'Doors and access'],
      sites: ['LYON-HQ', 'PARIS-11'],
    },
    {
      person: 'lea',
      role: 'REPORTER',
      invitedBy: 'claire',
      joinedDaysAgo: 42,
      code: 'NW-1001',
      jobTitle: 'Receptionist',
      department: 'Front office',
      homeSite: 'LYON-HQ',
    },
    {
      person: 'hugo',
      role: 'REPORTER',
      invitedBy: 'marc',
      joinedDaysAgo: 42,
      code: 'NW-1002',
      jobTitle: 'Warehouse team lead',
      department: 'Logistics',
      homeSite: 'LYON-WH',
    },
    {
      person: 'ines',
      role: 'REPORTER',
      invitedBy: 'marc',
      joinedDaysAgo: 41,
      code: 'NW-1003',
      jobTitle: 'Office manager',
      department: 'Administration',
      homeSite: 'PARIS-11',
    },
    {
      person: 'paul',
      role: 'REPORTER',
      invitedBy: 'claire',
      joinedDaysAgo: 41,
      code: 'NW-1004',
      jobTitle: 'Depot coordinator',
      department: 'Operations',
      homeSite: 'MRS-PORT',
    },
    {
      person: 'chloe',
      role: 'REPORTER',
      invitedBy: 'marc',
      joinedDaysAgo: 40,
      code: 'NW-1005',
      jobTitle: 'Lab technician',
      department: 'Research and development',
      homeSite: 'GRE-LAB',
    },
    {
      person: 'yanis',
      role: 'REPORTER',
      invitedBy: 'marc',
      joinedDaysAgo: 39,
      code: 'NW-1006',
      jobTitle: 'Forklift operator',
      department: 'Logistics',
      homeSite: 'LYON-WH',
    },
    {
      person: 'emma',
      role: 'REPORTER',
      invitedBy: 'claire',
      joinedDaysAgo: 39,
      code: 'NW-1007',
      jobTitle: 'HR business partner',
      department: 'Human resources',
      homeSite: 'LYON-HQ',
    },
    {
      person: 'nathan',
      role: 'REPORTER',
      invitedBy: 'marc',
      joinedDaysAgo: 38,
      code: 'NW-1008',
      jobTitle: 'Account manager',
      department: 'Sales',
      homeSite: 'PARIS-11',
    },
    {
      person: 'jade',
      role: 'REPORTER',
      invitedBy: 'marc',
      joinedDaysAgo: 37,
      code: 'NW-1009',
      jobTitle: 'Quality analyst',
      department: 'Research and development',
      homeSite: 'GRE-LAB',
    },
    {
      person: 'louis',
      role: 'REPORTER',
      invitedBy: 'claire',
      joinedDaysAgo: 36,
      code: 'NW-1010',
      jobTitle: 'Dock agent',
      department: 'Operations',
      homeSite: 'MRS-PORT',
    },
  ],
  invitations: [
    {
      firstName: 'Sofia',
      lastName: 'Martins',
      email: 'sofia@northwind.test',
      invitedBy: 'marc',
      sentHoursAgo: 50,
      role: 'REPORTER',
      code: 'NW-1011',
      jobTitle: 'Logistics assistant',
      department: 'Logistics',
      homeSite: 'LYON-WH',
    },
    {
      firstName: 'Lucie',
      lastName: 'Fabre',
      email: 'lucie@nettoyage-pro.test',
      invitedBy: 'claire',
      sentHoursAgo: 20,
      role: 'INTERVENANT',
      company: 'Nettoyage Pro',
      specialties: ['Cleaning'],
      sites: ['LYON-HQ', 'LYON-WH'],
    },
    {
      firstName: 'Thomas',
      lastName: 'Robert',
      email: 'thomas@northwind.test',
      invitedBy: 'claire',
      sentHoursAgo: 12 * 24,
      role: 'REPORTER',
      code: 'NW-1012',
      jobTitle: 'Sales assistant',
      department: 'Sales',
      homeSite: 'PARIS-11',
    },
  ],
  incidents: northwindIncidents,
};

/* Helios Retail: a second tenant in French, sharing Karim with Northwind */

const helios: OrgSpec = {
  slug: 'helios-retail',
  legalName: 'Helios Retail SA',
  displayName: 'Helios Retail',
  registrationNumber: 'BE 0712.345.678',
  industry: 'RETAIL',
  sizeBand: 'S',
  country: 'BE',
  city: 'Brussels',
  timezone: 'Europe/Brussels',
  locale: 'fr',
  website: 'https://helios-retail.test',
  billingEmail: 'lucas@helios.test',
  plan: 'STARTER',
  trialEndsAt: null,
  status: 'ACTIVE',
  createdDaysAgo: 120,
  platformChange: null,
  sites: [
    {
      code: 'BXL-01',
      name: 'Bruxelles Louise',
      address: 'Avenue Louise 54',
      city: 'Bruxelles',
      contactName: 'Camille Dupont',
      lat: 50.8327,
      lng: 4.3601,
    },
    {
      code: 'ANT-01',
      name: 'Anvers Meir',
      address: 'Meir 78',
      city: 'Anvers',
      contactName: 'Lucas Peeters',
      contactPhone: '+32 470 12 34 56',
      lat: 51.2183,
      lng: 4.4085,
    },
  ],
  members: [
    { person: 'lucas', role: 'SUPERVISOR', owner: true },
    {
      person: 'camille',
      role: 'REPORTER',
      invitedBy: 'lucas',
      joinedDaysAgo: 110,
      code: 'HEL-014',
      jobTitle: 'Conseillère de vente',
      department: 'Magasin',
      homeSite: 'BXL-01',
    },
    {
      person: 'karim',
      role: 'INTERVENANT',
      invitedBy: 'lucas',
      joinedDaysAgo: 25,
      company: 'Rhone Plomberie',
      availability: 'AVAILABLE',
      specialties: ['Plomberie'],
      sites: ['BXL-01', 'ANT-01'],
    },
  ],
  invitations: [],
  incidents: [
    {
      title: "Fuite sous l'évier de la réserve",
      description:
        "Il y a de l'eau sous l'évier de la réserve depuis ce matin. J'ai mis une serpillière mais ça continue de goutter.",
      site: 'BXL-01',
      reporter: 'camille',
      category: "Fuite d'eau",
      location: 'Réserve',
      daysAgo: 20,
      steps: [
        assign('lucas', 'karim', 40),
        accept(60),
        resolve(240, "Joint du siphon remplacé. Aucune fuite après 15 minutes d'essai."),
        close('lucas', 1000),
      ],
    },
    {
      title: "La caisse 2 ne s'allume plus",
      description:
        "La caisse 2 ne démarre plus depuis l'ouverture. On travaille avec une seule caisse et la file s'allonge.",
      site: 'ANT-01',
      reporter: 'lucas',
      category: 'Caisse',
      location: 'Caisse 2',
      daysAgo: 15,
      steps: [
        dismiss(
          'lucas',
          180,
          'NO_ACTION_NEEDED',
          'Le prestataire caisse est intervenu sous contrat, rien à faire de notre côté.',
        ),
      ],
    },
    {
      title: "Gouttes au plafond de l'arrière-boutique",
      description:
        "De l'eau goutte du plafond de l'arrière-boutique, sûrement depuis l'appartement du dessus. Une tache s'agrandit.",
      site: 'ANT-01',
      reporter: 'lucas',
      category: "Fuite d'eau",
      location: 'Arrière-boutique',
      daysAgo: 9,
      steps: [
        assign('lucas', 'karim', 120),
        accept(300),
        progress(1300, 'ON_SITE', "La fuite vient d'un raccord dans l'appartement du dessus. J'ai prévenu le syndic."),
        resolve(
          1500,
          'Le syndic a fait réparer le raccord du dessus. Plafond sec, plus aucun écoulement depuis 24 heures.',
        ),
        close('lucas', 600),
      ],
    },
    {
      title: "Chasse d'eau qui coule en continu",
      description:
        "La chasse d'eau des toilettes du personnel coule sans arrêt. On entend l'eau couler toute la journée.",
      site: 'BXL-01',
      reporter: 'camille',
      category: "Fuite d'eau",
      location: 'Toilettes du personnel',
      daysAgo: 2,
      steps: [
        triage('lucas', 30, { priority: 'MEDIUM' }),
        assign('lucas', 'karim', 20),
        accept(90),
        progress(
          1200,
          'ON_SITE',
          'Sur place. Le mécanisme de chasse est à remplacer, je repasse demain avec la pièce.',
        ),
      ],
    },
    {
      title: 'Éclairage de la vitrine en panne',
      description:
        "Les spots de la vitrine principale ne s'allument plus depuis hier soir. La vitrine reste dans le noir après 17 h.",
      site: 'ANT-01',
      reporter: 'lucas',
      category: 'Panne électrique',
      location: 'Vitrine principale',
      daysAgo: 1,
      steps: [
        triage('lucas', 60, { priority: 'MEDIUM' }),
        comment('lucas', 5, 'INTERNAL', 'Je cherche un électricien sur Anvers, Karim ne fait que la plomberie.'),
      ],
    },
    {
      title: 'La porte de la réserve ferme mal',
      description:
        "La porte de la réserve ne se verrouille plus, il faut la pousser fort pour que la serrure s'enclenche.",
      site: 'BXL-01',
      reporter: 'camille',
      category: 'Porte, serrure ou accès',
      location: 'Porte de la réserve',
      daysAgo: 0,
      steps: [],
    },
  ],
};

/* Atlas Logistics: suspended by the platform team */

const atlas: OrgSpec = {
  slug: 'atlas-logistics',
  legalName: 'Atlas Logistics SAS',
  displayName: 'Atlas Logistics',
  registrationNumber: '791 234 560',
  industry: 'LOGISTICS',
  sizeBand: 'L',
  country: 'FR',
  city: 'Le Havre',
  timezone: 'Europe/Paris',
  locale: 'fr',
  website: null,
  billingEmail: 'atlas-owner@atlas.test',
  plan: 'BUSINESS',
  trialEndsAt: null,
  status: 'SUSPENDED',
  createdDaysAgo: 200,
  platformChange: {
    type: 'ORG_SUSPENDED',
    daysAgo: ATLAS_SUSPENDED_DAYS_AGO,
    reason: 'Invoices unpaid for 60 days. Reactivate once finance confirms the payment.',
  },
  sites: [
    {
      code: 'HAV-01',
      name: 'Terminal du Havre',
      address: "Quai de l'Europe",
      city: 'Le Havre',
      lat: 49.4826,
      lng: 0.1312,
    },
    {
      code: 'ROU-01',
      name: 'Plateforme de Rouen',
      address: 'Rue du Madrillet 12',
      city: 'Saint-Étienne-du-Rouvray',
      lat: 49.3833,
      lng: 1.0731,
    },
  ],
  members: [{ person: 'nadia', role: 'SUPERVISOR', owner: true }],
  invitations: [],
  incidents: [],
};

// Oldest first, so organizations, accounts and memberships are created in the order they happened.
const organizations = [atlas, helios, northwind];

/* Runtime records */

type User = { id: string; createdAt: number };
type Member = { person: PersonKey; membershipId: string; userId: string; role: MembershipRole; name: string };
type Category = { id: string; name: string; defaultPriority: Priority };
type Site = { id: string; code: string; lat: number; lng: number };

type Org = {
  id: string;
  spec: OrgSpec;
  createdAt: number;
  members: Map<PersonKey, Member>;
  sites: Map<string, Site>;
  categories: Map<string, Category>;
  specialties: Map<string, string>;
  /** Site ids each intervenant membership may be assigned on (I10). */
  access: Map<string, Set<string>>;
  supervisors: string[];
};

type AccountRow = { email: string; role: string; organization: string };

const roleLabel: Record<MembershipRole, string> = {
  SUPERVISOR: 'Supervisor',
  INTERVENANT: 'Intervenant',
  REPORTER: 'Employee',
};

const nameOf = (person: PersonKey) => `${people[person].firstName} ${people[person].lastName}`;

function lookup<K, V>(map: Map<K, V>, key: K, what: string): V {
  const value = map.get(key);
  if (value === undefined) throw new Error(`Seed data refers to an unknown ${what}: ${String(key)}`);
  return value;
}

const orgCreatedAt = (spec: OrgSpec) => startOfDay(now - spec.createdDaysAgo * DAY) + 8 * HOUR + 12 * MINUTE;

/** Deterministic join time, so an account's creation date is known before any organization exists. */
function joinedAt(spec: OrgSpec, member: MemberSpec, index: number): number {
  if (!('joinedDaysAgo' in member)) return orgCreatedAt(spec);
  return startOfDay(now - member.joinedDaysAgo * DAY) + 7 * HOUR + index * 23 * MINUTE;
}

/* Users */

async function createUsers(tx: Tx, passwordHash: string): Promise<Map<PersonKey, User>> {
  const firstSeen = new Map<PersonKey, number>([['admin', now - 300 * DAY]]);
  for (const spec of organizations) {
    spec.members.forEach((member, index) => {
      const at = joinedAt(spec, member, index);
      const seen = firstSeen.get(member.person);
      if (seen === undefined || at < seen) firstSeen.set(member.person, at);
    });
  }

  const users = new Map<PersonKey, User>();
  const rows: Prisma.UserCreateManyInput[] = [];
  for (const [person, createdAt] of firstSeen) {
    const spec: UserSpec = people[person];
    const id = randomUUID();
    users.set(person, { id, createdAt });
    // Members of the suspended organization have not signed in since the suspension.
    const lastLoginAt = person === 'nadia' ? now - (ATLAS_SUSPENDED_DAYS_AGO + 2) * DAY : now - between(1, 72) * HOUR;
    rows.push({
      id,
      email: spec.email,
      passwordHash,
      firstName: spec.firstName,
      lastName: spec.lastName,
      phone: spec.phone ?? null,
      locale: spec.locale ?? 'en',
      emailVerifiedAt: new Date(createdAt),
      lastLoginAt: new Date(lastLoginAt),
      createdAt: new Date(createdAt),
    });
  }
  await tx.user.createMany({ data: rows });

  const admin = lookup(users, 'admin', 'person');
  await tx.platformAdmin.create({
    data: { userId: admin.id, totpSecret: PLATFORM_TOTP_SECRET, createdAt: new Date(admin.createdAt) },
  });
  return users;
}

/* Organizations */

/** Recent notifications stay unread more often, so every inbox has something new. */
function readAt(createdAt: number): Date | null {
  const age = now - createdAt;
  if (age < 8 * HOUR && random() < 0.75) return null;
  if (age < 3 * DAY && random() < 0.35) return null;
  return new Date(Math.min(now - MINUTE, createdAt + between(4, 600) * MINUTE));
}

async function createOrganization(
  tx: Tx,
  spec: OrgSpec,
  users: Map<PersonKey, User>,
  accounts: AccountRow[],
  pendingLinks: string[],
): Promise<Org> {
  const createdAt = orgCreatedAt(spec);
  const owner = spec.members.find((m) => 'owner' in m);
  if (!owner) throw new Error(`${spec.displayName} needs an owner`);
  const ownerUser = lookup(users, owner.person, 'person');

  const organization = await tx.organization.create({
    data: {
      slug: spec.slug,
      legalName: spec.legalName,
      displayName: spec.displayName,
      registrationNumber: spec.registrationNumber,
      industry: spec.industry,
      sizeBand: spec.sizeBand,
      country: spec.country,
      city: spec.city,
      timezone: spec.timezone,
      defaultLocale: spec.locale,
      website: spec.website,
      billingEmail: spec.billingEmail,
      status: spec.status,
      plan: spec.plan,
      trialEndsAt: spec.trialEndsAt === null ? null : new Date(spec.trialEndsAt),
      termsVersion: TERMS_VERSION,
      termsAcceptedAt: new Date(createdAt),
      termsAcceptedByUserId: ownerUser.id,
      createdAt: new Date(createdAt),
      updatedAt: new Date(spec.platformChange ? now - spec.platformChange.daysAgo * DAY : createdAt),
    },
  });
  const orgId = organization.id;

  // Default catalog in the organization's language, dated from the registration.
  await seedCatalog(tx, orgId, spec.industry, spec.locale);
  await tx.specialty.updateMany({ where: { organizationId: orgId }, data: { createdAt: new Date(createdAt) } });
  await tx.incidentCategory.updateMany({ where: { organizationId: orgId }, data: { createdAt: new Date(createdAt) } });
  const [specialtyRows, categoryRows] = await Promise.all([
    tx.specialty.findMany({ where: { organizationId: orgId }, select: { id: true, name: true } }),
    tx.incidentCategory.findMany({
      where: { organizationId: orgId },
      select: { id: true, name: true, defaultPriority: true },
    }),
  ]);

  const org: Org = {
    id: orgId,
    spec,
    createdAt,
    members: new Map(),
    sites: new Map(),
    categories: new Map(categoryRows.map((c) => [c.name, c])),
    specialties: new Map(specialtyRows.map((s) => [s.name, s.id])),
    access: new Map(),
    supervisors: [],
  };

  const events: Prisma.AuditEventCreateManyInput[] = [];
  const notifications: Prisma.NotificationCreateManyInput[] = [];
  const orgEvent = (type: AuditEventType, actor: Member, at: number, payload: Prisma.InputJsonObject) =>
    events.push({
      organizationId: orgId,
      actorMembershipId: actor.membershipId,
      actorUserId: actor.userId,
      type,
      payload,
      createdAt: new Date(at),
    });

  // Members first: sites are created by the owner, invitations by supervisors.
  for (const [index, member] of spec.members.entries()) {
    const user = lookup(users, member.person, 'person');
    const inviter = 'invitedBy' in member ? lookup(org.members, member.invitedBy, 'inviter') : null;
    const at = joinedAt(spec, member, index);
    const membership = await tx.membership.create({
      data: {
        organizationId: orgId,
        userId: user.id,
        role: member.role,
        isOwner: 'owner' in member,
        invitedByMembershipId: inviter?.membershipId ?? null,
        joinedAt: new Date(at),
      },
    });
    const record: Member = {
      person: member.person,
      membershipId: membership.id,
      userId: user.id,
      role: member.role,
      name: nameOf(member.person),
    };
    org.members.set(member.person, record);
    if (member.role === 'SUPERVISOR') org.supervisors.push(membership.id);
    accounts.push({
      email: people[member.person].email,
      role: 'owner' in member ? 'Supervisor, owner' : roleLabel[member.role],
      organization: spec.displayName,
    });

    if (inviter) {
      const invitedAt = at - between(3, 20) * HOUR;
      orgEvent('MEMBER_INVITED', inviter, Math.max(createdAt + HOUR, invitedAt), {
        email: people[member.person].email,
        role: member.role,
        name: record.name,
      });
      orgEvent('MEMBER_JOINED', record, at, { memberId: record.membershipId, name: record.name, role: member.role });
      notifications.push({
        organizationId: orgId,
        recipientMembershipId: inviter.membershipId,
        type: 'INVITATION_ACCEPTED',
        incidentId: null,
        actorName: record.name,
        dedupeKey: `INVITATION_ACCEPTED:-:${record.membershipId}`,
        readAt: readAt(at),
        createdAt: new Date(at),
      });
    }
  }

  const ownerMember = lookup(org.members, owner.person, 'owner');
  const siteRows: Prisma.SiteCreateManyInput[] = spec.sites.map((site, index) => {
    const id = randomUUID();
    const siteCreatedAt = createdAt + (index + 1) * 6 * MINUTE;
    org.sites.set(site.code, { id, code: site.code, lat: site.lat, lng: site.lng });
    orgEvent('SITE_CREATED', ownerMember, siteCreatedAt, { siteId: id, name: site.name, code: site.code });
    const closedAt = site.closedDaysAgo === undefined ? null : now - site.closedDaysAgo * DAY + 2 * HOUR;
    if (closedAt !== null) {
      orgEvent('SITE_UPDATED', ownerMember, closedAt, { siteId: id, name: site.name, fields: ['isActive'] });
    }
    return {
      id,
      organizationId: orgId,
      code: site.code,
      name: site.name,
      address: site.address,
      city: site.city,
      contactName: site.contactName ?? null,
      contactPhone: site.contactPhone ?? null,
      isActive: closedAt === null,
      createdAt: new Date(siteCreatedAt),
      updatedAt: new Date(closedAt ?? siteCreatedAt),
    };
  });
  await tx.site.createMany({ data: siteRows });

  const siteIds = (sites: string[] | 'all') =>
    sites === 'all'
      ? [...org.sites.values()].map((s) => s.id)
      : sites.map((code) => lookup(org.sites, code, 'site').id);
  const specialtyIds = (names: string[]) => names.map((name) => lookup(org.specialties, name, 'specialty'));

  const employeeRows: Prisma.EmployeeProfileCreateManyInput[] = [];
  const intervenantRows: Prisma.IntervenantProfileCreateManyInput[] = [];
  const specialtyLinks: Prisma.IntervenantSpecialtyCreateManyInput[] = [];
  const accessRows: Prisma.SiteAccessCreateManyInput[] = [];
  for (const [index, member] of spec.members.entries()) {
    const { membershipId } = lookup(org.members, member.person, 'member');
    if (member.role === 'REPORTER') {
      employeeRows.push({
        membershipId,
        organizationId: orgId,
        employeeCode: member.code,
        jobTitle: member.jobTitle,
        department: member.department,
        homeSiteId: lookup(org.sites, member.homeSite, 'site').id,
      });
    }
    if (member.role === 'INTERVENANT') {
      intervenantRows.push({
        membershipId,
        organizationId: orgId,
        companyName: member.company,
        availability: member.availability,
      });
      for (const specialtyId of specialtyIds(member.specialties)) {
        specialtyLinks.push({ membershipId, specialtyId, organizationId: orgId });
      }
      const ids = siteIds(member.sites);
      org.access.set(membershipId, new Set(ids));
      for (const siteId of ids) {
        accessRows.push({
          membershipId,
          siteId,
          organizationId: orgId,
          createdAt: new Date(joinedAt(spec, member, index)),
        });
      }
    }
  }
  await tx.employeeProfile.createMany({ data: employeeRows });
  await tx.intervenantProfile.createMany({ data: intervenantRows });
  await tx.intervenantSpecialty.createMany({ data: specialtyLinks });
  await tx.siteAccess.createMany({ data: accessRows });

  // Open and expired invitations. Only the hash of each token is stored.
  const invitationRows: Prisma.InvitationCreateManyInput[] = [];
  for (const invitation of spec.invitations) {
    const inviter = lookup(org.members, invitation.invitedBy, 'inviter');
    const sentAt = now - invitation.sentHoursAgo * HOUR;
    const expiresAt = sentAt + INVITATION_TTL_MS;
    const token = newToken();
    const profile: Prisma.InputJsonObject =
      invitation.role === 'REPORTER'
        ? {
            employeeCode: invitation.code,
            jobTitle: invitation.jobTitle,
            department: invitation.department,
            homeSiteId: lookup(org.sites, invitation.homeSite, 'site').id,
          }
        : {
            companyName: invitation.company,
            specialtyIds: specialtyIds(invitation.specialties),
            siteIds: siteIds(invitation.sites),
          };
    invitationRows.push({
      organizationId: orgId,
      email: invitation.email,
      firstName: invitation.firstName,
      lastName: invitation.lastName,
      role: invitation.role,
      profile,
      tokenHash: hashToken(token),
      invitedByMembershipId: inviter.membershipId,
      createdAt: new Date(sentAt),
      expiresAt: new Date(expiresAt),
    });
    const name = `${invitation.firstName} ${invitation.lastName}`;
    orgEvent('MEMBER_INVITED', inviter, sentAt, { email: invitation.email, role: invitation.role, name });
    if (expiresAt > now) pendingLinks.push(`${invitation.email.padEnd(28)} ${acceptUrl(token)}`);
  }
  await tx.invitation.createMany({ data: invitationRows });

  await tx.auditEvent.createMany({ data: events });
  await tx.notification.createMany({ data: notifications });
  return org;
}

/* Incident simulation. Times are offsets in milliseconds from the report. */

type SimAssignment = {
  id: string;
  intervenant: Member;
  assignedBy: Member;
  status: AssignmentStatus;
  note: string | null;
  declineReason: string | null;
  reassignmentReason: ReassignmentReason | null;
  reassignmentNote: string | null;
  reassignmentRequestedAt: number | null;
  assignedAt: number;
  respondedAt: number | null;
  endedAt: number | null;
};

type SimEvent = { type: ThreadEventType; actor: Member; at: number; payload: Prisma.InputJsonObject };
type SimNotice = { recipient: string; type: NotificationType; actorName: string; dedupeKey: string; at: number };

type SimIncident = {
  id: string;
  spec: IncidentSpec;
  siteId: string;
  reporter: Member;
  createdBy: Member;
  reportedCategory: Category;
  reportedPriority: Priority;
  category: Category;
  priority: Priority;
  latitude: number | null;
  longitude: number | null;
  status: IncidentStatus;
  version: number;
  declinedAt: number | null;
  sentBackAt: number | null;
  resolutionNote: string | null;
  dismissReason: DismissReason | null;
  dismissNote: string | null;
  triagedAt: number | null;
  firstAssignedAt: number | null;
  startedAt: number | null;
  resolvedAt: number | null;
  closedAt: number | null;
  updatedAt: number;
  assignments: SimAssignment[];
  events: SimEvent[];
  progress: { id: string; assignmentId: string; author: Member; type: ProgressType; note: string; at: number }[];
  comments: { id: string; author: Member; visibility: CommentVisibility; body: string; at: number }[];
  notices: SimNotice[];
};

function threadPayload(payload: ThreadPayloads[ThreadEventType]): Prisma.InputJsonObject {
  return payload;
}

function record<T extends ThreadEventType>(
  incident: SimIncident,
  type: T,
  actor: Member,
  at: number,
  payload: ThreadPayloads[T],
) {
  incident.events.push({ type, actor, at, payload: threadPayload(payload) });
}

/** Same recipients and dedupe keys as lib/notify: unique, never the actor. */
function notice(
  incident: SimIncident,
  type: NotificationType,
  actor: Member,
  at: number,
  recipients: (string | undefined)[],
  dedupe: string | number,
) {
  const unique = new Set(recipients.filter((id): id is string => !!id && id !== actor.membershipId));
  for (const recipient of unique) {
    incident.notices.push({
      recipient,
      type,
      actorName: actor.name,
      dedupeKey: `${type}:${incident.id}:${dedupe}`,
      at,
    });
  }
}

const personRef = (member: Member) => ({ membershipId: member.membershipId, name: member.name });

function liveOf(incident: SimIncident): { assignment: SimAssignment; status: LiveAssignmentStatus } | null {
  for (const assignment of incident.assignments) {
    const { status } = assignment;
    if (isLiveAssignment(status)) return { assignment, status };
  }
  return null;
}

/** Local hour and minute in the organization's time zone. */
function localTime(timezone: string, at: number): { hour: number; minute: number } {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone,
    hour: 'numeric',
    minute: 'numeric',
    hourCycle: 'h23',
  }).formatToParts(new Date(at));
  const part = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  return { hour: part('hour'), minute: part('minute') };
}

/** Moves a time outside 8:00 to 19:00 local to the next morning. */
function workingHours(timezone: string, at: number): number {
  const { hour, minute } = localTime(timezone, at);
  if (hour >= 8 && hour < 19) return at;
  return at + ((24 + 8 - hour) % 24) * HOUR - minute * MINUTE + int(5, 90) * MINUTE;
}

/** Report time: the requested day during working hours (UTC 6:00 to 15:00 is 7:00 to 17:00 in Europe). */
function wantedStart(spec: IncidentSpec): number {
  const [hour, minute] = spec.at ?? [int(6, 14), int(0, 59)];
  return startOfDay(now - spec.daysAgo * DAY) + hour * HOUR + minute * MINUTE + int(0, 59) * 1000;
}

function simulate(org: Org, spec: IncidentSpec, start: number): SimIncident {
  const fail = (message: string): never => {
    throw new Error(`Seed incident "${spec.title}": ${message}`);
  };
  const member = (person: PersonKey) => lookup(org.members, person, 'member');
  const supervisor = (person: PersonKey) => {
    const found = member(person);
    return found.role === 'SUPERVISOR' ? found : fail(`${found.name} is not a supervisor`);
  };
  const category = (name: string) => lookup(org.categories, name, 'category');

  const site = lookup(org.sites, spec.site, 'site');
  const reporter = member(spec.reporter);
  const createdBy = spec.onBehalfBy ? supervisor(spec.onBehalfBy) : reporter;
  const reportedCategory = category(spec.category);
  const reportedPriority = spec.priority ?? reportedCategory.defaultPriority;
  // Most reports come from a phone with location turned on.
  const located = random() < 0.7;

  const incident: SimIncident = {
    id: randomUUID(),
    spec,
    siteId: site.id,
    reporter,
    createdBy,
    reportedCategory,
    reportedPriority,
    category: reportedCategory,
    priority: reportedPriority,
    latitude: located ? Number((site.lat + between(-0.0007, 0.0007)).toFixed(6)) : null,
    longitude: located ? Number((site.lng + between(-0.0007, 0.0007)).toFixed(6)) : null,
    status: 'NEW',
    version: 1,
    declinedAt: null,
    sentBackAt: null,
    resolutionNote: null,
    dismissReason: null,
    dismissNote: null,
    triagedAt: null,
    firstAssignedAt: null,
    startedAt: null,
    resolvedAt: null,
    closedAt: null,
    updatedAt: 0,
    assignments: [],
    events: [],
    progress: [],
    comments: [],
    notices: [],
  };

  record(incident, 'INCIDENT_CREATED', createdBy, 0, { onBehalfOf: spec.onBehalfBy ? personRef(reporter) : null });
  notice(incident, 'INCIDENT_CREATED', createdBy, 0, org.supervisors, incident.version);

  const transition = (trigger: IncidentTrigger): IncidentStatus =>
    nextStatus(incident.status, trigger) ?? fail(`cannot ${trigger} while ${incident.status}`);
  const live = () => liveOf(incident);
  const working = () => {
    const current = live();
    if (!current || (current.status !== 'ACCEPTED' && current.status !== 'REASSIGNMENT_REQUESTED')) {
      return fail('needs an accepted assignment');
    }
    return current.assignment;
  };
  const pending = () => {
    const current = live();
    return current?.status === 'PENDING_ACCEPTANCE' ? current.assignment : fail('needs a pending assignment');
  };

  /** Records TRIAGED when priority or category changes, as applyTriage does. */
  const applyTriage = (by: Member, at: number, change: { priority?: Priority; category?: string }) => {
    const nextCategory = change.category ? category(change.category) : incident.category;
    const nextPriority = change.priority ?? incident.priority;
    if (nextCategory.id === incident.category.id && nextPriority === incident.priority) return false;
    record(incident, 'TRIAGED', by, at, {
      from: { priority: incident.priority, category: incident.category.name },
      to: { priority: nextPriority, category: nextCategory.name },
    });
    incident.category = nextCategory;
    incident.priority = nextPriority;
    return true;
  };

  let t = 0;
  for (const step of spec.steps) {
    t += jitter(step.after);
    // Follow-ups planned for later happen in working hours. Short ones (urgent chains) happen as they come.
    if (step.after >= 120) t = workingHours(org.spec.timezone, start + t) - start;
    incident.updatedAt = t;
    switch (step.kind) {
      case 'triage': {
        const by = supervisor(step.by);
        if (!['NEW', 'ASSIGNED', 'IN_PROGRESS'].includes(incident.status))
          fail(`cannot triage while ${incident.status}`);
        if (!applyTriage(by, t, step)) fail('a triage step must change the priority or the category');
        incident.version += 1;
        incident.triagedAt ??= t;
        break;
      }
      case 'assign': {
        const by = supervisor(step.by);
        const target = member(step.to);
        const status = transition(incident.status === 'NEW' ? 'assign' : 'reassign');
        const previous = live()?.assignment ?? null;
        if (target.role !== 'INTERVENANT') fail(`${target.name} is not an intervenant`);
        if (previous?.intervenant === target) fail(`${target.name} already holds the incident`);
        if (!org.access.get(target.membershipId)?.has(incident.siteId))
          fail(`${target.name} has no access to ${spec.site}`);
        const first = incident.firstAssignedAt === null;

        applyTriage(by, t, step);
        incident.version += 1;
        incident.status = status;
        incident.triagedAt ??= t;
        incident.firstAssignedAt ??= t;
        incident.declinedAt = null;
        if (previous) {
          previous.status = 'SUPERSEDED';
          previous.endedAt = t;
        }
        incident.assignments.push({
          id: randomUUID(),
          intervenant: target,
          assignedBy: by,
          status: 'PENDING_ACCEPTANCE',
          note: step.note ?? null,
          declineReason: null,
          reassignmentReason: null,
          reassignmentNote: null,
          reassignmentRequestedAt: null,
          assignedAt: t,
          respondedAt: null,
          endedAt: null,
        });
        record(incident, 'ASSIGNED', by, t, {
          assignee: personRef(target),
          previous: previous ? personRef(previous.intervenant) : null,
          note: step.note ?? null,
        });
        notice(incident, 'ASSIGNED', by, t, [target.membershipId], incident.version);
        if (first) notice(incident, 'ASSIGNED_REPORTER', by, t, [reporter.membershipId], incident.version);
        if (previous) notice(incident, 'UNASSIGNED', by, t, [previous.intervenant.membershipId], incident.version);
        break;
      }
      case 'accept': {
        const assignment = pending();
        incident.status = transition('accept');
        incident.version += 1;
        incident.startedAt ??= t;
        assignment.status = 'ACCEPTED';
        assignment.respondedAt = t;
        record(incident, 'ASSIGNMENT_ACCEPTED', assignment.intervenant, t, {});
        notice(
          incident,
          'ACCEPTED',
          assignment.intervenant,
          t,
          [...org.supervisors, reporter.membershipId],
          incident.version,
        );
        break;
      }
      case 'decline': {
        const assignment = pending();
        incident.status = transition('decline');
        incident.version += 1;
        incident.declinedAt = t;
        assignment.status = 'DECLINED';
        assignment.declineReason = step.reason;
        assignment.respondedAt = t;
        assignment.endedAt = t;
        record(incident, 'ASSIGNMENT_DECLINED', assignment.intervenant, t, { reason: step.reason });
        notice(incident, 'DECLINED', assignment.intervenant, t, org.supervisors, incident.version);
        break;
      }
      case 'request-reassignment': {
        const assignment = working();
        if (assignment.status !== 'ACCEPTED' || incident.status !== 'IN_PROGRESS')
          fail('cannot ask for reassignment now');
        incident.version += 1;
        assignment.status = 'REASSIGNMENT_REQUESTED';
        assignment.reassignmentReason = step.reasonCode;
        assignment.reassignmentNote = step.note;
        assignment.reassignmentRequestedAt = t;
        record(incident, 'REASSIGNMENT_REQUESTED', assignment.intervenant, t, {
          reasonCode: step.reasonCode,
          note: step.note,
        });
        notice(incident, 'REASSIGNMENT_REQUESTED', assignment.intervenant, t, org.supervisors, incident.version);
        break;
      }
      case 'progress': {
        const assignment = working();
        if (incident.status !== 'IN_PROGRESS') fail('progress needs an incident in progress');
        const id = randomUUID();
        incident.progress.push({
          id,
          assignmentId: assignment.id,
          author: assignment.intervenant,
          type: step.progressType,
          note: step.note,
          at: t,
        });
        record(incident, 'PROGRESS_POSTED', assignment.intervenant, t, {
          progressType: step.progressType,
          note: step.note,
        });
        notice(incident, 'PROGRESS_POSTED', assignment.intervenant, t, org.supervisors, id);
        break;
      }
      case 'comment': {
        const author = member(step.by);
        const current = live();
        const actions = incidentActions(
          { role: author.role, membershipId: author.membershipId },
          {
            status: incident.status,
            reporterMembershipId: reporter.membershipId,
            liveAssignment: current
              ? { intervenantMembershipId: current.assignment.intervenant.membershipId, status: current.status }
              : null,
          },
        );
        if (!actions.includes(step.visibility === 'PUBLIC' ? 'comment-public' : 'comment-internal')) {
          fail(`${author.name} may not post a ${step.visibility.toLowerCase()} comment now`);
        }
        const id = randomUUID();
        incident.comments.push({ id, author, visibility: step.visibility, body: step.body, at: t });
        record(incident, 'COMMENT_ADDED', author, t, { visibility: step.visibility, body: step.body });
        const assignee = current?.assignment.intervenant.membershipId;
        const isSupervisor = author.role === 'SUPERVISOR';
        const recipients =
          step.visibility === 'PUBLIC'
            ? [reporter.membershipId, assignee, ...(isSupervisor ? [] : org.supervisors)]
            : isSupervisor
              ? [assignee]
              : org.supervisors;
        notice(incident, 'COMMENT_ADDED', author, t, recipients, id);
        break;
      }
      case 'resolve': {
        const assignment = working();
        incident.status = transition('resolve');
        incident.version += 1;
        incident.resolutionNote = step.note;
        // The first resolution time is kept when work comes back after a send back.
        incident.resolvedAt ??= t;
        incident.sentBackAt = null;
        assignment.status = 'ACCEPTED';
        record(incident, 'RESOLVED', assignment.intervenant, t, { note: step.note });
        notice(
          incident,
          'RESOLVED',
          assignment.intervenant,
          t,
          [...org.supervisors, reporter.membershipId],
          incident.version,
        );
        break;
      }
      case 'send-back': {
        const by = supervisor(step.by);
        incident.status = transition('send-back');
        incident.version += 1;
        incident.sentBackAt = t;
        record(incident, 'SENT_BACK', by, t, { reason: step.reason });
        notice(incident, 'SENT_BACK', by, t, [live()?.assignment.intervenant.membershipId], incident.version);
        break;
      }
      case 'close': {
        const by = supervisor(step.by);
        const current = live()?.assignment;
        incident.status = transition('close');
        incident.version += 1;
        incident.closedAt = t;
        if (current) {
          current.status = 'COMPLETED';
          current.endedAt = t;
        }
        record(incident, 'CLOSED', by, t, {});
        notice(incident, 'CLOSED', by, t, [reporter.membershipId, current?.intervenant.membershipId], incident.version);
        break;
      }
      case 'dismiss': {
        const by = supervisor(step.by);
        incident.status = transition('dismiss');
        incident.version += 1;
        incident.dismissReason = step.reason;
        incident.dismissNote = step.note;
        incident.closedAt = t;
        record(incident, 'DISMISSED', by, t, { reason: step.reason, note: step.note });
        notice(incident, 'CLOSED', by, t, [reporter.membershipId], incident.version);
        break;
      }
    }
  }

  // I14: an open incident's status mirrors its live assignment (RESOLVED keeps it accepted until close).
  if (incident.status !== 'CLOSED' && incident.status !== 'RESOLVED') {
    const expected = statusForAssignment(live()?.status ?? null);
    if (expected !== incident.status) fail(`ends ${incident.status} but its assignments say ${expected}`);
  }
  return incident;
}

/** Moves the whole story earlier when it would otherwise end in the future. */
function placeInTime(start: number, incident: SimIncident): number {
  const latestEnd = now - between(8, 90) * MINUTE;
  return Math.min(start, latestEnd - incident.updatedAt);
}

function yearIn(timezone: string, at: number): number {
  return Number(new Intl.DateTimeFormat('en', { timeZone: timezone, year: 'numeric' }).format(new Date(at)));
}

async function createIncidents(tx: Tx, org: Org) {
  const placed = org.spec.incidents
    .map((spec) => {
      const start = wantedStart(spec);
      const incident = simulate(org, spec, start);
      return { incident, base: placeInTime(start, incident) };
    })
    .sort((a, b) => a.base - b.base);

  const incidents: Prisma.IncidentCreateManyInput[] = [];
  const assignments: Prisma.AssignmentCreateManyInput[] = [];
  const progressRows: Prisma.ProgressUpdateCreateManyInput[] = [];
  const comments: Prisma.CommentCreateManyInput[] = [];
  const events: Prisma.AuditEventCreateManyInput[] = [];
  const notifications: Prisma.NotificationCreateManyInput[] = [];
  // References follow creation order, per year in the organization's time zone (F-INC-02).
  const counters = new Map<number, number>();

  for (const { incident, base } of placed) {
    const at = (offset: number) => new Date(base + offset);
    const maybe = (offset: number | null) => (offset === null ? null : at(offset));
    const organizationId = org.id;
    const year = yearIn(org.spec.timezone, base);
    const sequence = (counters.get(year) ?? 0) + 1;
    counters.set(year, sequence);

    incidents.push({
      id: incident.id,
      organizationId,
      reference: formatReference(year, sequence),
      siteId: incident.siteId,
      reporterMembershipId: incident.reporter.membershipId,
      createdByMembershipId: incident.createdBy.membershipId,
      title: incident.spec.title,
      description: incident.spec.description,
      reportedCategoryId: incident.reportedCategory.id,
      reportedPriority: incident.reportedPriority,
      locationDetail: incident.spec.location ?? null,
      latitude: incident.latitude,
      longitude: incident.longitude,
      categoryId: incident.category.id,
      priority: incident.priority,
      status: incident.status,
      version: incident.version,
      declinedAt: maybe(incident.declinedAt),
      sentBackAt: maybe(incident.sentBackAt),
      resolutionNote: incident.resolutionNote,
      dismissReason: incident.dismissReason,
      dismissNote: incident.dismissNote,
      createdAt: at(0),
      triagedAt: maybe(incident.triagedAt),
      firstAssignedAt: maybe(incident.firstAssignedAt),
      startedAt: maybe(incident.startedAt),
      resolvedAt: maybe(incident.resolvedAt),
      closedAt: maybe(incident.closedAt),
      updatedAt: at(incident.updatedAt),
    });
    for (const a of incident.assignments) {
      assignments.push({
        id: a.id,
        organizationId,
        incidentId: incident.id,
        intervenantMembershipId: a.intervenant.membershipId,
        assignedByMembershipId: a.assignedBy.membershipId,
        status: a.status,
        note: a.note,
        declineReason: a.declineReason,
        reassignmentReason: a.reassignmentReason,
        reassignmentNote: a.reassignmentNote,
        reassignmentRequestedAt: maybe(a.reassignmentRequestedAt),
        assignedAt: at(a.assignedAt),
        respondedAt: maybe(a.respondedAt),
        endedAt: maybe(a.endedAt),
      });
    }
    for (const p of incident.progress) {
      progressRows.push({
        id: p.id,
        organizationId,
        incidentId: incident.id,
        assignmentId: p.assignmentId,
        authorMembershipId: p.author.membershipId,
        type: p.type,
        note: p.note,
        createdAt: at(p.at),
      });
    }
    for (const c of incident.comments) {
      comments.push({
        id: c.id,
        organizationId,
        incidentId: incident.id,
        authorMembershipId: c.author.membershipId,
        visibility: c.visibility,
        body: c.body,
        createdAt: at(c.at),
      });
    }
    for (const e of incident.events) {
      events.push({
        organizationId,
        incidentId: incident.id,
        actorMembershipId: e.actor.membershipId,
        actorUserId: e.actor.userId,
        type: e.type,
        payload: e.payload,
        createdAt: at(e.at),
      });
    }
    for (const n of incident.notices) {
      notifications.push({
        organizationId,
        recipientMembershipId: n.recipient,
        type: n.type,
        incidentId: incident.id,
        actorName: n.actorName,
        dedupeKey: n.dedupeKey,
        readAt: readAt(base + n.at),
        createdAt: at(n.at),
      });
    }
  }

  await tx.incident.createMany({ data: incidents });
  await tx.assignment.createMany({ data: assignments });
  await tx.progressUpdate.createMany({ data: progressRows });
  await tx.comment.createMany({ data: comments });
  await tx.auditEvent.createMany({ data: events });
  await tx.notification.createMany({ data: notifications });
  await tx.organizationCounter.createMany({
    data: [...counters].map(([year, value]) => ({ organizationId: org.id, name: `incident:${year}`, value })),
  });
  return placed.map(({ incident }) => incident.status);
}

/* Platform */

type RegistrationPayload = z.output<typeof registerCompanySchema> & {
  contact: { firstName: string; lastName: string; email: string; phone?: string; passwordHash: string };
};

async function createRegistrations(tx: Tx, passwordHash: string) {
  const registrations: { createdAt: number; payload: RegistrationPayload }[] = [
    {
      // Waiting for the email link, which is valid for 24 hours.
      createdAt: now - 3 * HOUR,
      payload: {
        legalName: 'Boulangeries Marchal SARL',
        displayName: 'Boulangeries Marchal',
        registrationNumber: '533 912 004',
        industry: 'RETAIL',
        sizeBand: 'S',
        country: 'FR',
        city: 'Dijon',
        timezone: 'Europe/Paris',
        defaultLocale: 'fr',
        website: undefined,
        contact: {
          firstName: 'Sophie',
          lastName: 'Marchal',
          email: 'sophie@marchal.test',
          phone: '+33 6 58 21 47 30',
          passwordHash,
        },
      },
    },
    {
      // The link expired two days ago without a click.
      createdAt: now - 3 * DAY,
      payload: {
        legalName: 'Clinique des Alpes SAS',
        displayName: 'Clinique des Alpes',
        registrationNumber: undefined,
        industry: 'HEALTHCARE',
        sizeBand: 'L',
        country: 'FR',
        city: 'Chambéry',
        timezone: 'Europe/Paris',
        defaultLocale: 'fr',
        website: 'https://clinique-alpes.test',
        contact: { firstName: 'Julien', lastName: 'Morel', email: 'julien@clinique-alpes.test', passwordHash },
      },
    },
  ];
  await tx.organizationRegistration.createMany({
    data: registrations.map(({ createdAt, payload }) => ({
      email: payload.contact.email,
      companyName: payload.displayName,
      contactName: `${payload.contact.firstName} ${payload.contact.lastName}`,
      // Undefined optional fields are dropped from the JSON, as in the registration route.
      payload,
      tokenHash: hashToken(newToken()),
      expiresAt: new Date(createdAt + REGISTRATION_TTL_MS),
      createdAt: new Date(createdAt),
    })),
  });
}

async function createPlatformEvents(tx: Tx, adminUserId: string, orgs: Map<string, Org>) {
  await tx.platformAuditEvent.createMany({
    data: organizations.flatMap(({ slug, platformChange }) =>
      platformChange
        ? [
            {
              adminUserId,
              organizationId: lookup(orgs, slug, 'organization').id,
              type: platformChange.type,
              reason: platformChange.reason,
              payload: platformChange.payload ?? {},
              createdAt: new Date(now - platformChange.daysAgo * DAY),
            },
          ]
        : [],
    ),
  });
}

/* Main */

function countBy(statuses: IncidentStatus[]): string {
  const order: IncidentStatus[] = ['NEW', 'ASSIGNED', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'];
  return order
    .map((status) => [status, statuses.filter((s) => s === status).length] as const)
    .filter(([, count]) => count > 0)
    .map(([status, count]) => `${count} ${status}`)
    .join(', ');
}

async function main() {
  const started = Date.now();
  // Hashed once: scrypt is deliberately slow and every demo account shares the password.
  const passwordHash = await hashPassword(DEMO_PASSWORD);
  const accounts: AccountRow[] = [{ email: people.admin.email, role: 'Platform admin', organization: '-' }];
  const pendingLinks: string[] = [];
  const summaries: string[] = [];

  await prisma.$transaction(
    async (tx) => {
      // Row level triggers (append-only audit, read-only closed incidents) do not fire on TRUNCATE.
      const tables = await tx.$queryRaw<{ tablename: string }[]>`
        SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
      await tx.$executeRawUnsafe(
        `TRUNCATE ${tables.map((t) => `"${t.tablename}"`).join(', ')} RESTART IDENTITY CASCADE`,
      );

      const users = await createUsers(tx, passwordHash);
      const orgs = new Map<string, Org>();
      for (const spec of organizations) {
        const org = await createOrganization(tx, spec, users, accounts, pendingLinks);
        orgs.set(spec.slug, org);
        const statuses = await createIncidents(tx, org);
        if (statuses.length > 0) {
          summaries.unshift(`${spec.displayName}: ${statuses.length} incidents (${countBy(statuses)})`);
        }
      }
      await createRegistrations(tx, passwordHash);
      await createPlatformEvents(tx, lookup(users, 'admin', 'person').id, orgs);
    },
    { timeout: 120_000, maxWait: 10_000 },
  );

  // Main demo tenant first.
  const order = [northwind, helios, atlas].map((spec) => spec.displayName);
  accounts.sort((a, b) => order.indexOf(a.organization) - order.indexOf(b.organization));
  const widths = [
    Math.max(...accounts.map((a) => a.email.length)),
    Math.max(...accounts.map((a) => a.role.length)),
  ] as const;
  const line = (a: AccountRow) => `  ${a.email.padEnd(widths[0])}  ${a.role.padEnd(widths[1])}  ${a.organization}`;

  console.log(`\nSentinel demo data ready in ${((Date.now() - started) / 1000).toFixed(1)} s`);
  for (const summary of summaries) console.log(summary);
  console.log('');
  console.log(line({ email: 'Email', role: 'Role', organization: 'Organization' }));
  for (const account of accounts) console.log(line(account));
  console.log(`\nPassword for every account: ${DEMO_PASSWORD}`);
  console.log(`Platform admin TOTP secret: ${PLATFORM_TOTP_SECRET}`);
  if (pendingLinks.length > 0) {
    console.log('\nPending invitations:');
    for (const link of pendingLinks) console.log(`  ${link}`);
  }
  console.log('');
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
