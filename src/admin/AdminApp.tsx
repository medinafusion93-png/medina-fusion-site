import { createContext, useCallback, useContext, useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { getApi, type AdminApi } from './api';
import CalendarPage from './pages/CalendarPage';
import ClientDetail from './pages/ClientDetail';
import ClientsPage from './pages/ClientsPage';
import CommandeForm from './pages/CommandeForm';
import CommandesPage from './pages/CommandesPage';
import Dashboard from './pages/Dashboard';
import PrintPage from './pages/PrintPage';
import type { Client, ClientInput, Commande, CommandeInput } from './types';
import { Field, Input, Spinner } from './ui';

// ---------------------------------------------------------------------------
// Navigation par hash : #/commandes, #/commandes/<id>, #/clients/<id>, #/imprimer/<id>/facture…
// ---------------------------------------------------------------------------
export function useRoute(): string[] {
  const get = () => window.location.hash.replace(/^#\/?/, '').split('?')[0]!.split('/').filter(Boolean);
  const [route, setRoute] = useState(get);
  useEffect(() => {
    const on = () => {
      setRoute(get());
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return route;
}
/** Paramètres après « ? » dans le hash (ex. #/commandes?statut=demande) */
export const hashQuery = () => new URLSearchParams(window.location.hash.split('?')[1] ?? '');

export const go = (path: string) => {
  window.location.hash = `#/${path}`;
};

// ---------------------------------------------------------------------------
// Données partagées
// ---------------------------------------------------------------------------
interface AdminData {
  api: AdminApi;
  clients: Client[];
  commandes: Commande[];
  clientById: Map<string, Client>;
  reload: () => Promise<void>;
  saveClient: (c: ClientInput) => Promise<Client>;
  saveCommande: (c: CommandeInput) => Promise<Commande>;
  deleteCommande: (id: string) => Promise<void>;
  deleteClient: (id: string) => Promise<void>;
}

const DataContext = createContext<AdminData | null>(null);
export function useAdmin(): AdminData {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useAdmin hors DataProvider');
  return ctx;
}

function DataProvider({ api, children }: { api: AdminApi; children: ReactNode }) {
  const [clients, setClients] = useState<Client[] | null>(null);
  const [commandes, setCommandes] = useState<Commande[] | null>(null);
  const [error, setError] = useState('');

  const reload = useCallback(async () => {
    try {
      const [cl, co] = await Promise.all([api.listClients(), api.listCommandes()]);
      setClients(cl);
      setCommandes(co);
      setError('');
    } catch (e) {
      setError((e as Error).message);
    }
  }, [api]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const value = useMemo<AdminData | null>(() => {
    if (!clients || !commandes) return null;
    return {
      api,
      clients,
      commandes,
      clientById: new Map(clients.map((c) => [c.id, c])),
      reload,
      saveClient: async (c) => {
        const saved = await api.saveClient(c);
        await reload();
        return saved;
      },
      saveCommande: async (c) => {
        const saved = await api.saveCommande(c);
        await reload();
        return saved;
      },
      deleteCommande: async (id) => {
        await api.deleteCommande(id);
        await reload();
      },
      deleteClient: async (id) => {
        await api.deleteClient(id);
        await reload();
      },
    };
  }, [api, clients, commandes, reload]);

  if (error)
    return (
      <div className="mx-auto max-w-md p-6 text-center">
        <p className="text-red-300">Impossible de charger les données : {error}</p>
        <button className="btn-gold mt-4" onClick={() => void reload()}>
          Réessayer
        </button>
      </div>
    );
  if (!value) return <Spinner />;
  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

// ---------------------------------------------------------------------------
// Connexion
// ---------------------------------------------------------------------------
function Login({ api }: { api: AdminApi }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      await api.signIn(email.trim(), password);
    } catch (err) {
      setMsg({ ok: false, text: (err as Error).message });
    } finally {
      setBusy(false);
    }
  };

  const reset = async () => {
    if (!email.trim()) return setMsg({ ok: false, text: 'Indiquez votre email puis cliquez à nouveau.' });
    try {
      await api.resetPassword(email.trim());
      setMsg({ ok: true, text: 'Si ce compte existe, un email de réinitialisation vient d’être envoyé.' });
    } catch (err) {
      setMsg({ ok: false, text: (err as Error).message });
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <form onSubmit={submit} className="w-full max-w-sm rounded-2xl border border-gold/40 bg-ink-800 p-6 shadow-2xl">
        <p className="text-center font-display text-2xl font-bold text-gold-light">MEDINA FUSION</p>
        <h1 className="mt-1 text-center text-sm uppercase tracking-widest text-neutral-300">Espace administrateur</h1>
        {api.demo && (
          <p className="mt-4 rounded-lg bg-amber-950/70 p-3 text-xs text-amber-100">
            Mode démo : base de données non branchée. Cliquez sur « Se connecter » pour visiter avec des données fictives.
          </p>
        )}
        <div className="mt-6 space-y-4">
          <Field label="Email" id="login-email">
            <Input id="login-email" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required={!api.demo} />
          </Field>
          <Field label="Mot de passe" id="login-pass">
            <Input
              id="login-pass"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required={!api.demo}
            />
          </Field>
        </div>
        {msg && (
          <p role="alert" className={`mt-4 text-sm ${msg.ok ? 'text-emerald-300' : 'text-red-300'}`}>
            {msg.text}
          </p>
        )}
        <button type="submit" className="btn-gold mt-6 w-full" disabled={busy}>
          {busy ? 'Connexion…' : 'Se connecter'}
        </button>
        {!api.demo && (
          <button type="button" onClick={() => void reset()} className="mt-3 w-full text-center text-sm text-neutral-400 underline underline-offset-2">
            Mot de passe oublié ?
          </button>
        )}
        <a href="/" className="mt-6 block text-center text-xs text-neutral-500">
          ← Retour au site
        </a>
      </form>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Mise en page
// ---------------------------------------------------------------------------
const TABS = [
  { path: '', label: 'Tableau de bord', short: 'Accueil', icon: '📊' },
  { path: 'commandes', label: 'Commandes', short: 'Commandes', icon: '🧾' },
  { path: 'clients', label: 'Clients', short: 'Clients', icon: '👥' },
  { path: 'calendrier', label: 'Calendrier', short: 'Agenda', icon: '📅' },
];

function Shell({ email, api, route, children }: { email: string; api: AdminApi; route: string[]; children: ReactNode }) {
  const current = route[0] ?? '';
  const { commandes } = useAdmin();
  const aTraiter = commandes.filter((c) => c.statut === 'demande').length;

  return (
    <div className="min-h-screen pb-24 md:pb-10">
      {api.demo && (
        <div className="bg-amber-500 px-4 py-1.5 text-center text-xs font-semibold text-ink">
          MODE DÉMO — données fictives, rien n’est enregistré. Branchez Supabase pour l’utiliser pour de vrai.
        </div>
      )}
      <header className="sticky top-0 z-30 border-b border-white/10 bg-ink/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3">
          <a href="#/" className="font-display text-lg font-bold text-gold-light">
            MF <span className="hidden text-sm font-normal text-neutral-300 sm:inline">· Admin</span>
          </a>
          <nav className="hidden flex-1 gap-1 md:flex" aria-label="Sections">
            {TABS.map((t) => (
              <a
                key={t.path}
                href={`#/${t.path}`}
                aria-current={current === t.path ? 'page' : undefined}
                className={`whitespace-nowrap rounded-full px-3 py-2 text-sm font-semibold transition lg:px-4 ${
                  current === t.path ? 'bg-gold text-ink' : 'text-neutral-200 hover:bg-white/10'
                }`}
              >
                {t.icon} <span className="lg:hidden">{t.short}</span>
                <span className="hidden lg:inline">{t.label}</span>
                {t.path === 'commandes' && aTraiter > 0 && (
                  <span className="ml-1.5 rounded-full bg-sky-500 px-1.5 text-xs text-white">{aTraiter}</span>
                )}
              </a>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <a href="#/commandes/nouvelle" className="btn-gold hidden px-4 sm:inline-flex">
              + Commande
            </a>
            <span className="hidden max-w-[180px] truncate text-xs text-neutral-400 xl:inline">{email}</span>
            <button type="button" onClick={() => void api.signOut()} className="btn-outline px-3 text-xs">
              Déconnexion
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>

      {/* Barre d’onglets mobile */}
      <nav aria-label="Sections" className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-white/10 bg-ink/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
        {TABS.slice(0, 2).map((t) => (
          <TabLink key={t.path} t={t} active={current === t.path} badge={t.path === 'commandes' ? aTraiter : 0} />
        ))}
        <a href="#/commandes/nouvelle" className="flex flex-col items-center justify-center py-2 text-gold" aria-label="Nouvelle commande">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-gold text-2xl font-bold text-ink">+</span>
        </a>
        {TABS.slice(2).map((t) => (
          <TabLink key={t.path} t={t} active={current === t.path} badge={0} />
        ))}
      </nav>
    </div>
  );
}

function TabLink({ t, active, badge }: { t: (typeof TABS)[number]; active: boolean; badge: number }) {
  return (
    <a
      href={`#/${t.path}`}
      aria-current={active ? 'page' : undefined}
      className={`relative flex flex-col items-center justify-center py-2 text-[11px] font-semibold ${active ? 'text-gold' : 'text-neutral-400'}`}
    >
      <span className="text-xl" aria-hidden="true">
        {t.icon}
      </span>
      {t.short}
      {badge > 0 && <span className="absolute right-3 top-1 rounded-full bg-sky-500 px-1.5 text-[10px] text-white">{badge}</span>}
    </a>
  );
}

function Router({ route }: { route: string[] }) {
  const [section, id, extra] = route;
  if (section === 'commandes' && id) return <CommandeForm key={id} id={id === 'nouvelle' ? null : id} />;
  if (section === 'commandes') return <CommandesPage />;
  if (section === 'clients' && id) return <ClientDetail key={id} id={id === 'nouveau' ? null : id} />;
  if (section === 'clients') return <ClientsPage />;
  if (section === 'calendrier') return <CalendarPage />;
  if (section === 'imprimer' && id && extra) return <PrintPage id={id} doc={extra} />;
  return <Dashboard />;
}

// ---------------------------------------------------------------------------
export default function AdminApp() {
  const api = useMemo(getApi, []);
  const route = useRoute();
  const [email, setEmail] = useState<string | null | undefined>(undefined);
  const [admin, setAdmin] = useState<boolean | undefined>(undefined);

  useEffect(() => {
    document.title = 'Admin · Medina Fusion';
    void api.getSessionEmail().then(setEmail);
    return api.onAuthChange(setEmail);
  }, [api]);

  useEffect(() => {
    setAdmin(undefined);
    if (email) void api.isAdmin().then(setAdmin);
  }, [api, email]);

  if (email === undefined) return <Spinner />;
  if (!email) return <Login api={api} />;
  if (admin === undefined) return <Spinner label="Vérification des droits…" />;
  if (!admin)
    return (
      <div className="mx-auto max-w-md p-8 text-center">
        <p className="text-lg font-semibold text-red-300">Accès refusé</p>
        <p className="mt-2 text-sm text-neutral-300">Le compte {email} n’est pas administrateur.</p>
        <button className="btn-outline mt-6" onClick={() => void api.signOut()}>
          Se déconnecter
        </button>
      </div>
    );

  const printing = route[0] === 'imprimer';
  return (
    <DataProvider api={api}>
      {printing ? (
        <Router route={route} />
      ) : (
        <Shell email={email} api={api} route={route}>
          <Router route={route} />
        </Shell>
      )}
    </DataProvider>
  );
}
