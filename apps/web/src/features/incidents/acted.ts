import { createContext, useContext } from 'react';

/**
 * Called after a supervisor's own action on the open incident succeeds (`assign`, `close`, `send-back`,
 * `dismiss`, ...), so the inbox can move on to the next incident instead of leaving the finished one open.
 */
export const ActedContext = createContext<(action: string) => void>(() => undefined);
export const useActed = () => useContext(ActedContext);
