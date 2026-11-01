import { Link } from 'react-router-dom';
import {
  ArrowRight, BarChart3, BookOpen, CalendarCheck, ClipboardList,
  GraduationCap, Megaphone, ShieldCheck, Users, Wallet, Award, ArrowUpRight, Check,
} from 'lucide-react';
import { Logo } from '../components/logo';
import { formatMoney } from '../lib/format';

const NAV = [
  { label: 'Accueil', href: '#accueil' },
  { label: 'Fonctionnalités', href: '#fonctionnalites' },
  { label: 'Modules', href: '#modules' },
  { label: 'Admissions', href: '#admissions' },
  { label: 'Contact', href: '#contact' },
];

const FEATURES = [
  {
    icon: ClipboardList,
    title: 'Inscriptions sans papier',
    text: "Recevez les demandes, suivez chaque dossier et convertissez un candidat accepté en élève inscrit en un clic.",
  },
  {
    icon: Wallet,
    title: 'Scolarité et paiements',
    text: 'Encaissez par Mobile Money, espèces, chèque ou virement. Repérez les impayés et relancez les familles à temps.',
  },
  {
    icon: Award,
    title: 'Résultats et bulletins',
    text: 'Saisissez les notes par trimestre, calculez les moyennes pondérées et identifiez les élèves à accompagner.',
  },
  {
    icon: BookOpen,
    title: 'Cours en ligne',
    text: 'Publiez vos supports, exercices et quiz. Les élèves retrouvent leurs cours depuis leur espace personnel.',
  },
  {
    icon: Megaphone,
    title: 'Communication ciblée',
    text: "Annonces pour les parents, les enseignants ou les élèves — chaque message atteint le bon public.",
  },
  {
    icon: ShieldCheck,
    title: 'Rôles et confidentialité',
    text: "Direction, enseignants et parents disposent chacun d'un accès adapté. Un parent ne voit que ses enfants.",
  },
];

const MODULES = [
  { name: 'Élèves & dossiers', text: 'Identité, tuteur, classe, historique de paiement et moyennes réunis sur une fiche unique.' },
  { name: 'Classes & enseignants', text: 'Effectifs, salles, professeurs titulaires et matières, avec taux de remplissage en temps réel.' },
  { name: 'Paiements', text: 'Suivi des échéances, encaissements et statuts (payé, en attente, en retard, remboursé).' },
  { name: 'Résultats', text: 'Notes par matière et par trimestre, moyennes pondérées et appréciations.' },
  { name: 'Cours en ligne', text: 'Catalogue de cours publiés ou en brouillon, nombre de leçons et d’apprenants.' },
  { name: 'Annonces', text: 'Messages publiés ou en brouillon, filtrés selon le profil connecté.' },
];

export function Landing() {
  return (
    <div className="lp">
      <header className="lp-nav">
        <Link to="/" className="row gap-10">
          <Logo />
        </Link>
        <nav className="lp-links">
          {NAV.map((item) => (
            <a key={item.label} href={item.href}>{item.label}</a>
          ))}
        </nav>
        <div className="actions">
          <Link to="/connexion" className="btn btn-ghost">Se connecter</Link>
          <Link to="/connexion" className="btn btn-primary">
            Espace école <ArrowRight size={15} />
          </Link>
        </div>
      </header>

      <section className="lp-hero" id="accueil">
        <div className="lp-hero-inner">
          <div>
            <span className="lp-eyebrow">
              <span className="pill">Nouveau</span>
              Plateforme de gestion scolaire · Congo
            </span>
            <h1>
              Toute votre école,<br />
              <em>pilotée depuis un seul endroit.</em>
            </h1>
            <p className="lead">
              Bienvenue sur School Net Academy : inscriptions, paiements, résultats, cours en ligne
              et communication entre l'école, les parents, les enseignants et les élèves.
            </p>
            <div className="cta">
              <Link to="/connexion" className="btn btn-primary btn-lg">
                Ouvrir le tableau de bord <ArrowRight size={17} />
              </Link>
              <a href="#fonctionnalites" className="btn btn-lg">Découvrir les modules</a>
            </div>
            <div className="lp-trust">
              <span className="avatars">
                <span className="avatar" style={{ background: '#0f766e' }}>CM</span>
                <span className="avatar" style={{ background: '#b45309' }}>PM</span>
                <span className="avatar" style={{ background: '#6d28d9' }}>NO</span>
                <span className="avatar" style={{ background: '#1d4ed8' }}>+</span>
              </span>
              <span>Déjà utilisé par les équipes de direction, enseignants et parents.</span>
            </div>
          </div>

          <div className="lp-preview" aria-hidden="true">
            <div className="lp-preview-top">
              <span className="dot" />
              <span className="dot" />
              <span className="dot" />
              <span className="tiny muted" style={{ marginLeft: 8 }}>schoolnet.academy / tableau de bord</span>
            </div>
            <div className="lp-preview-body">
              <div className="lp-mini-side">
                <div className="item a" />
                <div className="item" />
                <div className="item" />
                <div className="item" />
                <div className="item" style={{ marginTop: 'auto' }} />
              </div>
              <div className="lp-mini-main">
                <div className="lp-mini-kpis">
                  <div className="lp-mini-kpi"><div className="a" /><div className="b" /></div>
                  <div className="lp-mini-kpi"><div className="a" /><div className="b" /></div>
                  <div className="lp-mini-kpi"><div className="a" /><div className="b" /></div>
                </div>
                <div className="lp-mini-chart">
                  {[32, 46, 38, 60, 52, 74, 66, 88].map((height, index) => (
                    <i key={index} style={{ height: `${height}%` }} />
                  ))}
                </div>
                <div style={{ border: '1px solid var(--line)', borderRadius: 10, padding: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {[0, 1, 2].map((row) => (
                    <div key={row} className="row gap-8">
                      <span className="skeleton" style={{ width: 18, height: 18, borderRadius: '50%' }} />
                      <span className="skeleton" style={{ height: 8, width: `${50 + row * 12}%` }} />
                      <span className="skeleton" style={{ height: 8, width: 34, marginLeft: 'auto' }} />
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="lp-float">
              <span className="stat-icon" style={{ width: 28, height: 28, borderRadius: 8 }}><BarChart3 size={14} /></span>
              <div>
                <div className="v">{formatMoney(26940000, true)}</div>
                <div className="l">encaissés ce mois</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="lp-stats">
        {[
          { value: '100+', label: 'Écoles accompagnées' },
          { value: '20 000+', label: 'Élèves suivis' },
          { value: '1 000+', label: 'Enseignants connectés' },
          { value: '24/7', label: 'Support et assistance' },
        ].map((stat) => (
          <div className="lp-stat" key={stat.label}>
            <div className="v">{stat.value}</div>
            <div className="l">{stat.label}</div>
          </div>
        ))}
      </section>

      <section className="lp-section" id="fonctionnalites">
        <div className="lp-section-inner">
          <div className="lp-section-head">
            <div className="lp-eyebrow-sm">Fonctionnalités</div>
            <h2>Tout ce dont l'école a besoin, sans tableur ni cahier.</h2>
            <p>
              Une plateforme unique pour la direction, le secrétariat, les enseignants et les familles —
              avec les bons accès pour chacun.
            </p>
          </div>
          <div className="lp-features">
            {FEATURES.map((feature) => (
              <div className="lp-feature" key={feature.title}>
                <span className="ic"><feature.icon size={19} /></span>
                <h3>{feature.title}</h3>
                <p>{feature.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="lp-section" id="modules" style={{ background: '#fff', borderTop: '1px solid var(--line)', borderBottom: '1px solid var(--line)' }}>
        <div className="lp-section-inner">
          <div className="lp-section-head">
            <div className="lp-eyebrow-sm">Modules inclus</div>
            <h2>Un espace de travail complet, accessible en un clic.</h2>
          </div>
          <div className="lp-modules">
            {MODULES.map((module, index) => (
              <div className="lp-module" key={module.name}>
                <span className="n">{String(index + 1).padStart(2, '0')}</span>
                <div>
                  <strong>{module.name}</strong>
                  <p>{module.text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="lp-section" id="admissions">
        <div className="lp-section-inner lp-split">
          <div>
            <div className="lp-eyebrow-sm">Admissions</div>
            <h2 style={{ fontSize: 32, letterSpacing: '-0.03em', marginTop: 10, lineHeight: 1.15 }}>
              De la demande d'inscription au premier cours.
            </h2>
            <p style={{ color: 'var(--ink-500)', marginTop: 14, lineHeight: 1.65 }}>
              Le dossier est créé, examiné puis accepté. La conversion en élève inscrit génère
              automatiquement le matricule, la fiche et les frais d'inscription à encaisser.
            </p>
            <ul style={{ listStyle: 'none', padding: 0, margin: '20px 0 0', display: 'flex', flexDirection: 'column', gap: 11 }}>
              {['Suivi des statuts en temps réel', 'Contrôle des places disponibles par classe', 'Historique complet des décisions'].map((item) => (
                <li key={item} className="row gap-10" style={{ fontSize: 13.5 }}>
                  <span style={{ width: 20, height: 20, borderRadius: '50%', background: 'var(--primary-soft)', color: 'var(--primary)', display: 'grid', placeItems: 'center', flex: 'none' }}>
                    <Check size={12} />
                  </span>
                  {item}
                </li>
              ))}
            </ul>
            <Link to="/connexion" className="btn btn-primary mt-16">
              Tester le parcours <ArrowRight size={15} />
            </Link>
          </div>
          <div className="card card-pad" style={{ background: '#fff', boxShadow: 'var(--shadow-md)' }}>
            {[
              { icon: ClipboardList, label: 'Nouvelle demande', meta: 'Il y a 2 jours', tone: 'warning' },
              { icon: Users, label: 'Dossier examiné', meta: 'Il y a 1 jour', tone: 'info' },
              { icon: CalendarCheck, label: 'Élève inscrit · 6ème A', meta: "Aujourd'hui", tone: 'success' },
            ].map((step, index) => (
              <div key={step.label} className="row gap-12" style={{ padding: '14px 0', borderBottom: index < 2 ? '1px solid var(--line)' : 'none' }}>
                <span className={`stat-icon ${step.tone === 'warning' ? 'amber' : step.tone === 'info' ? 'info' : ''}`} style={{ width: 34, height: 34, borderRadius: 10 }}>
                  <step.icon size={16} />
                </span>
                <div className="grow">
                  <div className="strong" style={{ fontSize: 13.5 }}>{step.label}</div>
                  <div className="tiny muted">{step.meta}</div>
                </div>
                <span className={`badge badge-${step.tone}`}>Étape {index + 1}</span>
              </div>
            ))}
            <div className="mt-16" style={{ padding: 12, background: 'var(--primary-softer)', borderRadius: 10, fontSize: 12.5, color: 'var(--primary-700)' }}>
              <strong>Astuce :</strong> la conversion crée aussi l'échéance des frais d'inscription.
            </div>
          </div>
        </div>
      </section>

      <section className="lp-cta" id="contact">
        <div style={{ position: 'relative', zIndex: 1 }}>
          <h2>Prêt à essayer la plateforme ?</h2>
          <p>
            Trois profils de démonstration sont disponibles : direction, enseignant et parent.
            Aucune installation, aucun mot de passe à retenir.
          </p>
        </div>
        <div style={{ position: 'relative', zIndex: 1, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <Link to="/connexion" className="btn btn-lg" style={{ background: '#fff', borderColor: '#fff', color: 'var(--primary-700)' }}>
            Se connecter <ArrowUpRight size={16} />
          </Link>
          <a href="mailto:contact@schoolnet.academy" className="btn btn-lg" style={{ background: 'transparent', borderColor: 'rgba(255,255,255,0.35)', color: '#fff' }}>
            Nous contacter
          </a>
        </div>
      </section>

      <footer className="lp-footer">
        <div className="row gap-10">
          <span className="brand-mark" style={{ width: 30, height: 30, borderRadius: 9 }}><GraduationCap size={16} /></span>
          <span className="strong" style={{ fontSize: 13 }}>School Net Academy</span>
          <span className="copy">· Brazzaville, République du Congo</span>
        </div>
        <div className="links">
          <a href="mailto:contact@schoolnet.academy">contact@schoolnet.academy</a>
          <span>+242 06 512 44 18</span>
          <Link to="/connexion">Connexion</Link>
        </div>
        <div className="copy">© {new Date().getFullYear()} School Net Academy. Tous droits réservés.</div>
      </footer>
    </div>
  );
}
