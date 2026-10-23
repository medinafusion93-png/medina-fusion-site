import { createContext, useContext } from 'react';
import type { Company, Membership } from './types';

export type Page = 'dashboard' | 'requests' | 'dossier' | 'quotes' | 'followups' | 'settings';

export interface AppCtx {
  company: Company;
  me: Membership;
  members: Membership[];
  canEdit: boolean;
  isAdmin: boolean;
  go: (page: Page, id?: string, filter?: string) => void;
  filter: string;
  reloadCompany: () => Promise<void>;
  memberName: (id: string | null | undefined) => string;
}

export const Ctx = createContext<AppCtx | null>(null);
export function useApp(): AppCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error('Contexte absent');
  return c;
}
