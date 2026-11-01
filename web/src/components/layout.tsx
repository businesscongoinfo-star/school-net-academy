import { useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Users, GraduationCap, School, ClipboardList, Wallet, BookOpen,
  Megaphone, Award, Settings, Menu, X, LogOut, ChevronDown, LifeBuoy, Bell, UserRound,
  Building2, Layers, CalendarDays, Library, UserCheck,
} from 'lucide-react';
import { clsx } from 'clsx';
import { useAuth } from '../lib/auth';
import { ROLE_LABEL } from '../lib/labels';
import { Avatar, IconButton } from './ui';
import { Logo } from './logo';

export interface NavItem {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  roles: string[];
}

const SECTIONS: { title: string; items: NavItem[] }[] = [
  {
    title: 'Pilotage',
    items: [
      { to: '/app', label: 'Tableau de bord', icon: LayoutDashboard, roles: ['admin', 'teacher', 'parent'] },
    ],
  },
  {
    title: 'Scolarité',
    items: [
      { to: '/app/eleves', label: 'Élèves', icon: Users, roles: ['admin', 'teacher'] },
      { to: '/app/mes-enfants', label: 'Mes enfants', icon: Users, roles: ['parent'] },
      { to: '/app/classes', label: 'Classes', icon: School, roles: ['admin', 'teacher'] },
      { to: '/app/enseignants', label: 'Enseignants', icon: GraduationCap, roles: ['admin'] },
      { to: '/app/presences', label: 'Présences', icon: UserCheck, roles: ['admin', 'teacher'] },
    ],
  },
  {
    title: 'Université',
    items: [
      { to: '/app/facultes', label: 'Facultés', icon: Building2, roles: ['admin', 'teacher'] },
      { to: '/app/filieres', label: 'Filières', icon: Layers, roles: ['admin', 'teacher'] },
      { to: '/app/unites', label: "Unités d'enseignement", icon: BookOpen, roles: ['admin', 'teacher'] },
      { to: '/app/emploi-du-temps', label: 'Emploi du temps', icon: CalendarDays, roles: ['admin', 'teacher'] },
      { to: '/app/bibliotheque', label: 'Bibliothèque', icon: Library, roles: ['admin'] },
    ],
  },
  {
    title: 'Administration',
    items: [
      { to: '/app/inscriptions', label: 'Inscriptions', icon: ClipboardList, roles: ['admin'] },
      { to: '/app/paiements', label: 'Paiements', icon: Wallet, roles: ['admin', 'parent'] },
      { to: '/app/resultats', label: 'Résultats', icon: Award, roles: ['admin', 'teacher', 'parent'] },
    ],
  },
  {
    title: 'Pédagogie',
    items: [
      { to: '/app/cours', label: 'Cours en ligne', icon: BookOpen, roles: ['admin', 'teacher'] },
      { to: '/app/annonces', label: 'Annonces', icon: Megaphone, roles: ['admin', 'teacher', 'parent'] },
    ],
  },
];

const ALL_ITEMS = SECTIONS.flatMap((section) => section.items);

export function AppShell() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => setSidebarOpen(false), [location.pathname]);

  useEffect(() => {
    if (!menuOpen) return;
    const onClick = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [menuOpen]);

  if (!user) return null;

  const role = user.role;
  const current = ALL_ITEMS
    .filter((item) => item.roles.includes(role))
    .sort((a, b) => b.to.length - a.to.length)
    .find((item) => location.pathname === item.to || location.pathname.startsWith(`${item.to}/`));

  const handleLogout = async () => {
    await logout();
    navigate('/connexion', { replace: true });
  };

  return (
    <div className="shell">
      {sidebarOpen && <div className="sidebar-scrim" onClick={() => setSidebarOpen(false)} />}

      <aside className={clsx('sidebar', sidebarOpen && 'open')}>
        <div className="sidebar-brand">
          <Logo />
          <button className="icon-btn mobile-toggle" style={{ marginLeft: 'auto', color: '#a9cbc4' }} onClick={() => setSidebarOpen(false)} aria-label="Fermer le menu">
            <X size={18} />
          </button>
        </div>

        <nav className="sidebar-nav">
          {SECTIONS.map((section) => {
            const items = section.items.filter((item) => item.roles.includes(role));
            if (!items.length) return null;
            return (
              <div key={section.title}>
                <div className="sidebar-section">{section.title}</div>
                {items.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.to === '/app'}
                    className={({ isActive }) => clsx('sidebar-link', isActive && 'active')}
                  >
                    <item.icon size={17} />
                    <span>{item.label}</span>
                  </NavLink>
                ))}
              </div>
            );
          })}
          <div className="sidebar-section">Compte</div>
          <NavLink to="/app/parametres" className={({ isActive }) => clsx('sidebar-link', isActive && 'active')}>
            <Settings size={17} />
            <span>Paramètres</span>
          </NavLink>
        </nav>

        <div className="sidebar-foot">
          <div className="sidebar-help">
            <div className="row gap-8">
              <LifeBuoy size={14} style={{ color: '#5eead4' }} />
              <strong>Besoin d'aide ?</strong>
            </div>
            <p>Le secrétariat répond du lundi au vendredi, de 7h30 à 16h00.</p>
          </div>
          <div className="sidebar-user">
            <Avatar name={user.name} color={user.avatarColor} size="sm" />
            <div className="grow" style={{ minWidth: 0 }}>
              <div className="name truncate">{user.name}</div>
              <div className="role">{ROLE_LABEL[user.role] ?? user.role}</div>
            </div>
            <button
              className="icon-btn"
              style={{ color: '#7fada4', width: 30, height: 30 }}
              onClick={handleLogout}
              aria-label="Se déconnecter"
              title="Se déconnecter"
            >
              <LogOut size={15} />
            </button>
          </div>
        </div>
      </aside>

      <div className="main">
        {import.meta.env.VITE_DEMO === '1' && (
          <div className="demo-strip">
            <span className="demo-dot" />
            <span className="demo-strip-text">
              <strong>Démo statique</strong> · données de démonstration, écritures simulées dans le navigateur
              (réinitialisées au rechargement).
            </span>
            <button type="button" className="demo-strip-btn" onClick={handleLogout}>
              Changer de profil
            </button>
          </div>
        )}
        <header className="topbar">
          <button className="icon-btn mobile-toggle" onClick={() => setSidebarOpen(true)} aria-label="Ouvrir le menu">
            <Menu size={19} />
          </button>
          <div className="page-crumb">
            <span className="hide-sm">School Net Academy</span>
            <span className="hide-sm">/</span>
            <strong>{current?.label ?? 'Espace'}</strong>
          </div>
          <div className="topbar-actions">
            <NavLink to="/app/annonces" className="icon-btn" aria-label="Annonces" title="Annonces">
              <Bell size={17} />
            </NavLink>
            <div style={{ position: 'relative' }} ref={menuRef}>
              <button className="topbar-user" onClick={() => setMenuOpen((open) => !open)} aria-expanded={menuOpen}>
                <Avatar name={user.name} color={user.avatarColor} size="sm" />
                <span className="meta">
                  <strong>{user.name.split(' ')[0]}</strong>
                  <span>{ROLE_LABEL[user.role] ?? user.role}</span>
                </span>
                <ChevronDown size={14} style={{ color: 'var(--ink-400)', marginRight: 4 }} />
              </button>
              {menuOpen && (
                <div className="user-menu">
                  <div style={{ padding: '8px 10px 10px' }}>
                    <div className="strong truncate">{user.name}</div>
                    <div className="tiny muted truncate">{user.email}</div>
                  </div>
                  <div className="sep" />
                  <button className="item" onClick={() => { setMenuOpen(false); navigate('/app/parametres'); }}>
                    <UserRound size={15} /> Mon profil
                  </button>
                  <button className="item" onClick={() => { setMenuOpen(false); navigate('/app/parametres'); }}>
                    <Settings size={15} /> Paramètres
                  </button>
                  <div className="sep" />
                  <button className="item danger" onClick={handleLogout}>
                    <LogOut size={15} /> Se déconnecter
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="page">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export { IconButton };
