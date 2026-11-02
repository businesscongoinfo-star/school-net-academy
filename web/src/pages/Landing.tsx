import { Link } from 'react-router-dom';
import {
  ArrowRight, BarChart3, BookOpen, CalendarCheck, ClipboardList,
  GraduationCap, Megaphone, ShieldCheck, Users, Wallet, Award, ArrowUpRight, Check, CalendarDays,
  Bell, CreditCard, Globe2, MessageSquare, Nfc, QrCode, ScanLine, Sparkles, Building2,
  UserCog, Smartphone, Send, Star, Rocket, PlayCircle,
} from 'lucide-react';
import { Logo } from '../components/logo';
import { NewsletterForm } from '../components/newsletter-form';
import { AiChat } from '../components/ai-chat';
import { formatMoney } from '../lib/format';
import { COUNTRIES } from '../lib/countries';

const NAV = [
  { label: 'Accueil', href: '#accueil' },
  { label: 'Fonctionnalités', href: '#fonctionnalites' },
  { label: 'Modules', href: '#modules' },
  { label: 'Cartes & SMS', href: '#nouveautes' },
  { label: 'Tarifs', href: '#tarifs' },
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
    icon: GraduationCap,
    title: 'Université & LMD',
    text: "Facultés, filières Licence/Master, unités d'enseignement, crédits, amphis et soutenances — dans le même espace que l'école.",
  },
  {
    icon: CalendarDays,
    title: 'Emploi du temps & présences',
    text: 'Planning hebdomadaire par classe ou amphithéâtre, puis pointage des présences, retards et absences en quelques clics.',
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
  { name: 'Facultés & filières', text: 'Doyens, bâtiments, diplômes (Licence, Master, Doctorat, BTS) et frais annuels.' },
  { name: "Unités d'enseignement", text: 'Maquette LMD : codes, semestres, crédits, volumes horaires et enseignants affectés.' },
  { name: 'Emploi du temps', text: 'Séances par jour, salle, enseignant et type (Cours, TD, TP, Examen, Soutenance).' },
  { name: 'Bibliothèque', text: 'Catalogue, exemplaires disponibles, prêts, retours et retards de restitution.' },
  { name: 'Présences', text: 'Pointage par classe ou filière, séance par séance, avec taux de présence du jour.' },
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
          <Link to="/inscription" className="btn btn-primary">
            Essai gratuit <ArrowRight size={15} />
          </Link>
        </div>
      </header>

      <section className="lp-hero" id="accueil">
        <div className="lp-hero-inner">
          <div>
            <span className="lp-eyebrow">
              <span className="pill">Nouveau</span>
              Écoles & universités · {COUNTRIES.length} pays
            </span>
            <h1>
              Votre école et votre université,<br />
              <em>pilotées depuis un seul endroit.</em>
            </h1>
            <p className="lead">
              Bienvenue sur School Net Academy : élèves, étudiants, facultés, filières LMD, emploi du
              temps, bibliothèque, présences, paiements et résultats — pour le primaire, le secondaire
              et l'enseignement supérieur.
            </p>
            <div className="cta">
              <Link to="/inscription" className="btn btn-primary btn-lg">
                Créer mon compte — 7 jours offerts <ArrowRight size={17} />
              </Link>
              <a href="#tarifs" className="btn btn-lg">Voir les tarifs</a>
            </div>
            <div className="lp-hero-note">
              <span className="row gap-6"><Check size={13} /> Sans carte bancaire</span>
              <span className="row gap-6"><Check size={13} /> Mobile Money accepté</span>
              <span className="row gap-6"><Check size={13} /> Prêt en 3 minutes</span>
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


      <section className="lp-section lp-showcase" id="nouveautes">
        <div className="lp-section-inner">
          <div className="lp-section-head">
            <div className="lp-eyebrow-sm">Nouveautés de la rentrée</div>
            <h2>La carte scolaire intelligente, les parents informés en temps réel.</h2>
            <p>
              Chaque élève reçoit une carte d'identité scolaire avec QR code, code-barres et badge NFC.
              Un scan et la présence est signée ; une inscription ou un paiement et les parents reçoivent
              une notification dans l'application <strong>et</strong> un SMS.
            </p>
          </div>

          <div className="lp-showcase-grid">
            <div className="lp-card-visual">
              <div className="lp-school-card">
                <div className="lp-school-card-top">
                  <span className="brand-mark sm"><GraduationCap size={13} /></span>
                  <div>
                    <strong>School Net Academy</strong>
                    <span>Élève · 6ème A</span>
                  </div>
                  <span className="lp-card-chip" />
                </div>
                <div className="lp-school-card-name">Merveille Ondongo</div>
                <div className="lp-school-card-meta">Matricule SNA-2026-042 · 2025–2026</div>
                <div className="lp-school-card-bottom">
                  <span className="lp-qr" aria-hidden>
                    {Array.from({ length: 36 }).map((_, index) => <i key={index} className={index % 3 === 0 || index % 7 === 0 ? 'on' : ''} />)}
                  </span>
                  <span className="lp-barcode" aria-hidden />
                  <span className="lp-nfc"><Nfc size={16} /></span>
                </div>
              </div>
              <div className="lp-scan-pulse" aria-hidden />
            </div>

            <div className="lp-showcase-list">
              {[
                { icon: QrCode, title: 'Carte créée automatiquement', text: 'Dès l\'inscription de l\'élève : QR code, code-barres et badge NFC, prêts à imprimer.' },
                { icon: ScanLine, title: 'Présence en un bouton', text: 'Le surveillant scanne ou approche le badge : la présence est signée sans papier.' },
                { icon: Bell, title: 'Notification aux parents', text: 'Inscription, paiement, absence — chaque événement crée une alerte dans l\'application.' },
                { icon: MessageSquare, title: 'SMS sur le numéro enregistré', text: 'Le tuteur reçoit un SMS même sans smartphone ni connexion internet.' },
              ].map((item) => (
                <div key={item.title} className="lp-showcase-item">
                  <span className="ic"><item.icon size={17} /></span>
                  <div>
                    <strong>{item.title}</strong>
                    <p>{item.text}</p>
                  </div>
                </div>
              ))}
              <Link to="/inscription" className="btn btn-primary">
                Tester avec mon établissement <ArrowRight size={15} />
              </Link>
            </div>
          </div>

          <div className="lp-phone-demo">
            <div className="lp-phone">
              <div className="lp-phone-notch" />
              <div className="lp-phone-screen">
                <div className="lp-notif">
                  <span className="lp-notif-icon"><CreditCard size={13} /></span>
                  <div>
                    <strong>Paiement reçu</strong>
                    <span>Scolarité · 45 000 FCFA</span>
                  </div>
                </div>
                <div className="lp-notif">
                  <span className="lp-notif-icon sms"><MessageSquare size={13} /></span>
                  <div>
                    <strong>SMS au +242 06 580 82 65</strong>
                    <span>Votre enfant est bien inscrit en 6ème A.</span>
                  </div>
                </div>
                <div className="lp-notif">
                  <span className="lp-notif-icon nfc"><Nfc size={13} /></span>
                  <div>
                    <strong>Présence signée</strong>
                    <span>08:02 · Portail principal</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="lp-phone-caption">
              <Sparkles size={15} />
              <div>
                <strong>Les familles rassurées, l'école déchargée.</strong>
                <p>Les équipes passent moins de temps au téléphone et plus de temps sur la pédagogie.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="lp-section lp-platform-section">
        <div className="lp-section-inner lp-split">
          <div>
            <div className="lp-eyebrow-sm">Super administration</div>
            <h2 style={{ fontSize: 32, letterSpacing: '-0.03em', marginTop: 10, lineHeight: 1.15 }}>
              Une équipe, plusieurs espaces, des droits précis.
            </h2>
            <p style={{ color: 'var(--ink-500)', marginTop: 14, lineHeight: 1.65 }}>
              Le propriétaire de la plateforme crée ses agents — support, financier, gestionnaire,
              marketeur, closer — et chacun n'accède qu'à ce qui le concerne : établissements,
              facturation, campagnes ou journal SMS.
            </p>
            <ul style={{ listStyle: 'none', padding: 0, margin: '20px 0 0', display: 'flex', flexDirection: 'column', gap: 11 }}>
              {[
                'Rôles séparés et vérifiés côté serveur (RBAC)',
                'Création, suspension et conversion des établissements',
                'Campagnes newsletter avec audience ciblée',
                'Journal des SMS envoyés aux parents',
              ].map((item) => (
                <li key={item} className="row gap-10" style={{ fontSize: 13.5 }}>
                  <span style={{ width: 20, height: 20, borderRadius: '50%', background: 'var(--primary-soft)', color: 'var(--primary)', display: 'grid', placeItems: 'center', flex: 'none' }}>
                    <Check size={12} />
                  </span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <div className="lp-roles">
            {[
              { icon: UserCog, role: 'Gestionnaire', scope: 'Établissements, équipe, abonnements' },
              { icon: ShieldCheck, role: 'Support', scope: 'Assistance, prolongation d\'essai, SMS' },
              { icon: Wallet, role: 'Financier', scope: 'Facturation, encaissements, revenus' },
              { icon: Megaphone, role: 'Marketeur', scope: 'Newsletter et base d\'abonnés' },
              { icon: Rocket, role: 'Closer', scope: 'Conversion des essais en abonnements' },
            ].map((item) => (
              <div key={item.role} className="lp-role">
                <span className="ic"><item.icon size={16} /></span>
                <div className="grow">
                  <strong>{item.role}</strong>
                  <p>{item.scope}</p>
                </div>
                <Check size={14} />
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="lp-section" id="tarifs" style={{ background: '#fff', borderTop: '1px solid var(--line)', borderBottom: '1px solid var(--line)' }}>
        <div className="lp-section-inner">
          <div className="lp-section-head">
            <div className="lp-eyebrow-sm">Tarifs</div>
            <h2>Un essai de 7 jours, puis une offre à votre mesure.</h2>
            <p>Prix affichés en FCFA et convertis automatiquement dans la devise de votre pays à l'inscription.</p>
          </div>
          <div className="lp-pricing">
            {[
              { id: 'essentiel', name: 'Essentiel', price: 15000, tagline: 'Petite école', features: ['Élèves, classes, présences', 'Paiements & reçus', 'Cartes scolaires QR + NFC', '3 comptes utilisateurs'], popular: false },
              { id: 'pro', name: 'Pro', price: 45000, tagline: 'École & université', features: ['Tout Essentiel', 'Facultés, filières, UE & crédits', 'Emploi du temps & bibliothèque', 'SMS aux parents & notifications', '10 comptes utilisateurs'], popular: true },
              { id: 'universite', name: 'Université', price: 120000, tagline: 'Campus & LMD', features: ['Tout Pro', 'Multi-campus illimité', 'Pointage NFC multi-portails', 'Support prioritaire', 'Utilisateurs illimités'], popular: false },
            ].map((plan) => (
              <div key={plan.id} className={`lp-price${plan.popular ? ' popular' : ''}`}>
                {plan.popular && <span className="lp-price-flag"><Star size={12} /> Le plus choisi</span>}
                <strong className="lp-price-name">{plan.name}</strong>
                <span className="lp-price-tag">{plan.tagline}</span>
                <div className="lp-price-amount">
                  {formatMoney(plan.price)}
                  <span>/mois</span>
                </div>
                <ul>
                  {plan.features.map((feature) => <li key={feature}><Check size={13} /> {feature}</li>)}
                </ul>
                <Link to="/inscription" className={plan.popular ? 'btn btn-primary btn-block' : 'btn btn-secondary btn-block'}>
                  Démarrer l'essai
                </Link>
              </div>
            ))}
          </div>
          <p className="lp-pricing-note">
            <Globe2 size={14} /> {COUNTRIES.length} pays · paiement Mobile Money, carte bancaire, virement ou espèces ·
            aucune commission sur les frais de scolarité.
          </p>
        </div>
      </section>

      <section className="lp-section lp-newsletter-section" id="newsletter">
        <div className="lp-section-inner lp-newsletter-card">
          <div className="grow">
            <div className="lp-eyebrow-sm">Newsletter</div>
            <h2 style={{ fontSize: 30, letterSpacing: '-0.03em', marginTop: 8 }}>
              Les bonnes pratiques de gestion scolaire, une fois par mois.
            </h2>
            <p style={{ color: 'var(--ink-500)', marginTop: 10 }}>
              Guides pratiques, nouveautés de la plateforme et retours d'expérience d'écoles et
              d'universités africaines. Sans spam, désinscription en un clic.
            </p>
          </div>
          <div className="lp-newsletter-side">
            <NewsletterForm source="accueil" />
          </div>
        </div>
      </section>

      <section className="lp-cta" id="contact">
        <div style={{ position: 'relative', zIndex: 1 }}>
          <h2>Prêt à ouvrir votre espace ?</h2>
          <p>
            Créez votre établissement en 3 minutes — 7 jours d'essai gratuit, sans carte bancaire.
            Trois profils de démonstration restent disponibles pour explorer immédiatement.
          </p>
        </div>
        <div style={{ position: 'relative', zIndex: 1, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <Link to="/inscription" className="btn btn-lg" style={{ background: '#fff', borderColor: '#fff', color: 'var(--primary-700)' }}>
            Créer mon compte <ArrowUpRight size={16} />
          </Link>
          <Link to="/connexion" className="btn btn-lg" style={{ background: 'transparent', borderColor: 'rgba(255,255,255,0.35)', color: '#fff' }}>
            <PlayCircle size={16} /> Voir la démo
          </Link>
          <a href="mailto:businesscongo.inf@gmail.com" className="btn btn-lg" style={{ background: 'transparent', borderColor: 'rgba(255,255,255,0.35)', color: '#fff' }}>
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
          <a href="mailto:businesscongo.inf@gmail.com">businesscongo.inf@gmail.com</a>
          <span>+242 06 512 44 18</span>
          <Link to="/connexion">Connexion</Link>
          <Link to="/inscription">Créer un compte</Link>
          <Link to="/mot-de-passe-oublie">Mot de passe oublié</Link>
          <Link to="/conditions">Conditions</Link>
          <Link to="/confidentialite">Confidentialité</Link>
        </div>
        <div className="lp-footer-newsletter">
          <strong>Restons en contact</strong>
          <NewsletterForm source="pied de page" compact />
        </div>
        <div className="copy">© {new Date().getFullYear()} School Net Academy. Tous droits réservés.</div>
      </footer>

      <AiChat />
    </div>
  );
}
