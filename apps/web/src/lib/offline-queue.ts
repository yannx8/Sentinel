/**
 * Reports and actions written without a connection wait here until they can be sent (V2 plan 2.4). Each item keeps the
 * Idempotency-Key it will be sent with, so a replay that follows a lost answer returns the same incident.
 * The store is a small interface so the ordering rules run in tests without a browser.
 */

export type QueueState = 'waiting' | 'failed';

export type QueueKind = 'report' | 'action';

/** Stored in `error` when an earlier step of the same group failed; the screen words it in the user's language. */
export const DEPENDENT_ERROR = 'DEPENDENT';

export type QueueItem = {
  id: string;
  userId: string;
  orgId: string;
  createdAt: number;
  kind: QueueKind;
  /** Where the body is posted: /incidents for a report, the action path otherwise. */
  path: string;
  /** What the person sees in the list, such as "Accept". */
  label: string;
  /** Items of one group go out in order, and a failure stops the rest of the group. */
  group: string;
  body: Record<string, unknown>;
  idempotencyKey: string;
  photos: File[];
  photosSent: number;
  /** Set once the incident exists, so a retry only finishes the photos. */
  reference: string | null;
  state: QueueState;
  error: string | null;
};

export type QueueStore = {
  list(userId: string): Promise<QueueItem[]>;
  put(item: QueueItem): Promise<void>;
  remove(id: string): Promise<void>;
};

/** What happened to one item: done, the network is down (keep it and stop), or the server refused it. */
export type Outcome = 'done' | 'offline' | { failed: string };

export type NewItem = Pick<QueueItem, 'userId' | 'orgId' | 'kind' | 'path' | 'label' | 'body' | 'idempotencyKey'> &
  Partial<Pick<QueueItem, 'group' | 'photos'>>;

export function createQueue(store: QueueStore, clock: () => number = Date.now) {
  const ordered = async (userId: string) =>
    (await store.list(userId)).sort((a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id));

  return {
    list: ordered,

    async add(input: NewItem): Promise<QueueItem> {
      const id = crypto.randomUUID();
      const item: QueueItem = {
        ...input,
        id,
        group: input.group ?? id,
        photos: input.photos ?? [],
        createdAt: clock(),
        photosSent: 0,
        reference: null,
        state: 'waiting',
        error: null,
      };
      await store.put(item);
      return item;
    },

    async retry(userId: string, id: string) {
      const all = await store.list(userId);
      const item = all.find((candidate) => candidate.id === id);
      if (!item) return;
      // The steps that failed only because this one did go back to waiting with it.
      for (const other of all) {
        if (other.id === id || (other.group === item.group && other.error === DEPENDENT_ERROR)) {
          await store.put({ ...other, state: 'waiting', error: null });
        }
      }
    },

    discard: (id: string) => store.remove(id),

    /**
     * Sends waiting items oldest first. An offline answer stops the run so order is kept; a refusal marks that
     * item failed and moves on, because reports do not depend on each other.
     */
    async drain(
      userId: string,
      send: (item: QueueItem, save: (patch: Partial<QueueItem>) => Promise<void>) => Promise<Outcome>,
    ) {
      const result = { sent: [] as QueueItem[], failed: 0, offline: false };
      const blocked = new Set<string>();
      for (const item of await ordered(userId)) {
        if (item.state === 'failed') blocked.add(item.group);
        if (item.state !== 'waiting') continue;
        const save = async (patch: Partial<QueueItem>) => {
          Object.assign(item, patch);
          await store.put(item);
        };
        if (blocked.has(item.group)) {
          await save({ state: 'failed', error: DEPENDENT_ERROR });
          result.failed += 1;
          continue;
        }
        const outcome = await send(item, save);
        if (outcome === 'done') {
          await store.remove(item.id);
          result.sent.push(item);
        } else if (outcome === 'offline') {
          result.offline = true;
          break;
        } else {
          await save({ state: 'failed', error: outcome.failed });
          blocked.add(item.group);
          result.failed += 1;
        }
      }
      return result;
    },
  };
}

/** IndexedDB, one record per item, indexed by user so nobody replays another person's reports. */
export function indexedDbStore(): QueueStore {
  const opened = new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open('sentinel-offline', 1);
    request.onupgradeneeded = () => {
      const store = request.result.createObjectStore('items', { keyPath: 'id' });
      store.createIndex('userId', 'userId');
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

  const run = async <T>(mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>) => {
    const db = await opened;
    return new Promise<T>((resolve, reject) => {
      const request = action(db.transaction('items', mode).objectStore('items'));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  };

  return {
    list: (userId) => run('readonly', (store) => store.index('userId').getAll(userId)),
    put: async (item) => void (await run('readwrite', (store) => store.put(item))),
    remove: async (id) => void (await run('readwrite', (store) => store.delete(id))),
  };
}
