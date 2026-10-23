import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { configured, must, supabase } from './supabase';
import type { Company, Membership } from './types';
import { Ctx, type AppCtx, type Page } from './app-context';
import { Icon, ROLE_LABEL } from './ui';
import Login from './pages/Login';
import Onboarding from './pages/Onboarding';
import PublicForm from './pages/PublicForm';
import Dashboard from './pages/Dashboard';
import Requests from './pages/Requests';
import DossierPage from './pages/DossierPage';
import Quotes from './pages/Quotes';
import Followups from './pages/Followups';
import Settings from './pages/Settings';

const NAV: [Page, string, string][] = [
  ['dashboard', 'Tableau de bord', 'dashboard'],
  ['requests', 'Demandes', 'requests'],
  ['quotes', 'Devis', 'quotes'],
  ['followups', 'Relances', 'followups'],
  ['settings', 'Paramètres', 'settings'],
];

function parsePath(): { page: Page; id?: string } {
  const [, a, b] = location.pathname.split('/');
  const pages: Page[] = ['dashboard', 'requests', 'dossier', 'quotes', 'followups', 'settings'];
  return pages.includes(a as Page) ? { page: a as Page, id: b } : { page: 'dashboard' };
}

export default function App() {
  const formToken = /^\/f\/([a-f0-9]{16,64})$/.exec(location.pathname)?.[1];
  if (formToken) return <PublicForm token={formToken} />;
  if (!configured) {
    return (
      <div className="center"><div className="card"><h1>Configuration requise</h1>
        <p className="muted">Renseignez VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY (voir README), puis relancez l'application.</p></div></div>
    );
  }
  return <Authed />;
}

function Authed() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);
  if (session === undefined) return <p className="spinner">Chargement…</p>;
  if (!session) return <Login />;
  return <Workspace userId={session.user.id} email={session.user.email ?? ''} />;
}

function Workspace({ userId, email }: { userId: string; email: string }) {
  const [memberships, setMemberships] = useState<Membership[] | null>(null);
  const [names, setNames] = useState<Record<string, string>>({});
  const [companyId, setCompanyId] = useState<string>(() => localStorage.getItem('suivio.company') ?? '');
  const [company, setCompany] = useState<Company | null>(null);
  const [members, setMembers] = useState<Membership[]>([]);
  const [route, setRoute] = useState(parsePath);
  const [filter, setFilter] = useState('');
  const [error, setError] = useState('');

  const loadMemberships = useCallback(async () => {
    try {
      await supabase.rpc('accept_invitations');
      const rows = must(await supabase.from('memberships').select('*').eq('user_id', userId)) as Membership[];
      const cos = must(await supabase.from('companies').select('id,name')) as { id: string; name: string }[];
      setNames(Object.fromEntries(cos.map((c) => [c.id, c.name])));
      setMemberships(rows);
      if (rows.length && !rows.some((m) => m.company_id === companyId)) setCompanyId(rows[0]!.company_id);
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
  }, [userId, companyId]);

  useEffect(() => { void loadMemberships(); }, [loadMemberships]);

  const reloadCompany = useCallback(async () => {
    if (!companyId) return;
    const c = must(await supabase.from('companies').select('*').eq('id', companyId).single()) as Company;
    const ms = must(await supabase.from('memberships').select('*').eq('company_id', companyId).order('created_at')) as Membership[];
    setCompany(c);
    setMembers(ms);
  }, [companyId]);

  useEffect(() => {
    if (!companyId) return;
    localStorage.setItem('suivio.company', companyId);
    reloadCompany().catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, [companyId, reloadCompany]);

  useEffect(() => {
    const pop = () => setRoute(parsePath());
    window.addEventListener('popstate', pop);
    return () => window.removeEventListener('popstate', pop);
  }, []);

  const go = useCallback((page: Page, id?: string, f?: string) => {
    history.pushState(null, '', `/${page}${id ? `/${id}` : ''}`);
    setRoute({ page, id });
    setFilter(f ?? '');
    window.scrollTo(0, 0);
  }, []);

  const me = memberships?.find((m) => m.company_id === companyId);
  const ctx = useMemo<AppCtx | null>(() => (company && me ? {
    company, me, members, go, filter, reloadCompany,
    canEdit: me.role !== 'lecture', isAdmin: me.role === 'admin',
    memberName: (id) => members.find((m) => m.user_id === id)?.display_name || '—',
  } : null), [company, me, members, go, filter, reloadCompany]);

  if (error) return <div className="center"><div className="card"><h1>Erreur</h1><p className="err">{error}</p><button className="btn" onClick={() => location.reload()}>Recharger</button></div></div>;
  if (!memberships) return <p className="spinner">Chargement…</p>;
  if (!memberships.length) return <Onboarding email={email} onDone={async (id) => { setCompanyId(id); await loadMemberships(); }} />;
  if (!ctx) return <p className="spinner">Chargement…</p>;

  const cur = route.page === 'dossier' ? 'requests' : route.page;
  const page = {
    dashboard: <Dashboard />, requests: <Requests />, dossier: <DossierPage id={route.id ?? ''} />,
    quotes: <Quotes />, followups: <Followups />, settings: <Settings />,
  }[route.page];

  return (
    <Ctx.Provider value={ctx}>
      <div className="app">
        <aside className="side">
          <div className="brand"><div className="brand-mark"><Icon n="flame" s={17} /></div><div><b>Suivio</b><small>{ctx.company.name}</small></div></div>
          {memberships.length > 1 && (
            <select className="co-switch" value={companyId} onChange={(e) => { setCompanyId(e.target.value); go('dashboard'); }} aria-label="Entreprise">
              {memberships.map((m) => <option key={m.company_id} value={m.company_id}>{names[m.company_id] ?? m.company_id.slice(0, 8)}</option>)}
            </select>
          )}
          <nav className="nav" aria-label="Navigation principale">
            {NAV.map(([k, label, icon]) => (
              <button key={k} onClick={() => go(k)} aria-current={cur === k ? 'page' : undefined}><Icon n={icon} />{label}</button>
            ))}
          </nav>
          <div className="side-foot">
            <div className="faint" style={{ fontSize: '.78rem' }}>{email}<br />{ROLE_LABEL[ctx.me.role]}</div>
            <button className="btn ghost sm" onClick={() => supabase.auth.signOut()}>Se déconnecter</button>
          </div>
        </aside>
        <main className="main"><div className="wrap">{page}</div></main>
      </div>
      <nav className="tabbar" aria-label="Navigation">
        {NAV.map(([k, label, icon]) => (
          <button key={k} onClick={() => go(k)} aria-current={cur === k ? 'page' : undefined}><Icon n={icon} s={20} /><span>{k === 'dashboard' ? 'Accueil' : label}</span></button>
        ))}
      </nav>
    </Ctx.Provider>
  );
}
