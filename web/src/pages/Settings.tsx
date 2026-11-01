import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import {
  UserRound, ShieldCheck, Info, Save, KeyRound, Mail, Phone, BadgeCheck, GraduationCap, Database,
} from 'lucide-react';
import { patch, post, ApiError } from '../lib/api';
import type { User } from '../lib/types';
import { useAuth } from '../lib/auth';
import { ROLE_LABEL } from '../lib/labels';
import { Avatar, Badge, Button, Card, Field, Input, PageHeader, Tabs } from '../components/ui';
import { useToast } from '../components/toast';

type Section = 'profil' | 'securite' | 'apropos';

export function Settings() {
  const { user, setUser } = useAuth();
  const toast = useToast();
  const [section, setSection] = useState<Section>('profil');

  const [profile, setProfile] = useState({
    name: user?.name ?? '',
    email: user?.email ?? '',
    phone: user?.phone ?? '',
    title: user?.title ?? '',
  });
  const [profileError, setProfileError] = useState<string | null>(null);

  const [passwords, setPasswords] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const profileMutation = useMutation({
    mutationFn: (payload: typeof profile) => patch<{ user: User }>('/auth/profile', payload),
    onSuccess: (data) => {
      setUser(data.user);
      toast.success('Profil mis à jour', 'Vos informations ont été enregistrées.');
      setProfileError(null);
    },
    onError: (error: ApiError) => setProfileError(error.message),
  });

  const passwordMutation = useMutation({
    mutationFn: () => post('/auth/password', {
      currentPassword: passwords.currentPassword,
      newPassword: passwords.newPassword,
    }),
    onSuccess: () => {
      setPasswords({ currentPassword: '', newPassword: '', confirm: '' });
      setPasswordError(null);
      toast.success('Mot de passe modifié', 'Utilisez-le lors de votre prochaine connexion.');
    },
    onError: (error: ApiError) => setPasswordError(error.message),
  });

  if (!user) return null;

  return (
    <>
      <PageHeader title="Paramètres" subtitle="Profil, sécurité et informations sur la plateforme." />

      <div className="settings-grid">
        <Card className="card-pad">
          <div className="stack" style={{ alignItems: 'center', textAlign: 'center', paddingBottom: 16 }}>
            <Avatar name={user.name} color={user.avatarColor} size="lg" />
            <div className="strong mt-8">{user.name}</div>
            <Badge tone="primary">{ROLE_LABEL[user.role]}</Badge>
            <div className="tiny muted">{user.email}</div>
          </div>
          <div className="settings-nav">
            <button className={section === 'profil' ? 'active' : ''} onClick={() => setSection('profil')}>
              <UserRound size={15} /> Mon profil
            </button>
            <button className={section === 'securite' ? 'active' : ''} onClick={() => setSection('securite')}>
              <ShieldCheck size={15} /> Sécurité
            </button>
            <button className={section === 'apropos' ? 'active' : ''} onClick={() => setSection('apropos')}>
              <Info size={15} /> À propos
            </button>
          </div>
        </Card>

        {section === 'profil' && (
          <Card>
            <div className="card-head">
              <div>
                <h3>Informations personnelles</h3>
                <p className="card-sub">Ces informations apparaissent dans la plateforme.</p>
              </div>
            </div>
            <div className="card-body">
              <div className="form-grid">
                <Field label="Nom complet" htmlFor="pName">
                  <Input id="pName" value={profile.name} onChange={(event) => setProfile({ ...profile, name: event.target.value })} />
                </Field>
                <Field label="Fonction" htmlFor="pTitle">
                  <Input id="pTitle" value={profile.title} onChange={(event) => setProfile({ ...profile, title: event.target.value })} placeholder="Directrice générale" />
                </Field>
                <Field label="Adresse e-mail" htmlFor="pEmail">
                  <Input id="pEmail" type="email" value={profile.email} onChange={(event) => setProfile({ ...profile, email: event.target.value })} />
                </Field>
                <Field label="Téléphone" htmlFor="pPhone">
                  <Input id="pPhone" value={profile.phone} onChange={(event) => setProfile({ ...profile, phone: event.target.value })} />
                </Field>
              </div>
              {profileError && <div className="error-text mt-16">{profileError}</div>}
              <div className="row gap-8 mt-16">
                <Button variant="primary" icon={Save} loading={profileMutation.isPending} onClick={() => profileMutation.mutate(profile)}>
                  Enregistrer
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => setProfile({
                    name: user.name, email: user.email, phone: user.phone ?? '', title: user.title ?? '',
                  })}
                >
                  Réinitialiser
                </Button>
              </div>
            </div>
            <div className="card-head" style={{ borderTop: '1px solid var(--line)', borderBottom: 'none' }}>
              <h3>Rôle & accès</h3>
            </div>
            <div className="card-body">
              <div className="row gap-12" style={{ alignItems: 'flex-start' }}>
                <span className="stat-icon info" style={{ flex: 'none' }}><BadgeCheck size={18} /></span>
                <div>
                  <div className="strong">{ROLE_LABEL[user.role]}</div>
                  <p className="small muted mt-4">
                    {user.role === 'admin' && 'Accès complet : élèves, classes, enseignants, inscriptions, paiements, résultats, cours et annonces.'}
                    {user.role === 'teacher' && 'Accès à la scolarité, aux résultats, aux cours en ligne et aux annonces destinées aux enseignants.'}
                    {user.role === 'parent' && 'Accès aux fiches de vos enfants, à leurs paiements et à leurs résultats. Aucune modification possible.'}
                  </p>
                </div>
              </div>
            </div>
          </Card>
        )}

        {section === 'securite' && (
          <Card>
            <div className="card-head">
              <div>
                <h3>Mot de passe</h3>
                <p className="card-sub">Choisissez un mot de passe d'au moins 8 caractères.</p>
              </div>
            </div>
            <div className="card-body">
              <div className="form-grid">
                <Field label="Mot de passe actuel" htmlFor="curPass" className="span-2">
                  <Input id="curPass" type="password" autoComplete="current-password" value={passwords.currentPassword} onChange={(event) => setPasswords({ ...passwords, currentPassword: event.target.value })} />
                </Field>
                <Field label="Nouveau mot de passe" htmlFor="newPass">
                  <Input id="newPass" type="password" autoComplete="new-password" value={passwords.newPassword} onChange={(event) => setPasswords({ ...passwords, newPassword: event.target.value })} />
                </Field>
                <Field label="Confirmation" htmlFor="confPass">
                  <Input id="confPass" type="password" autoComplete="new-password" value={passwords.confirm} onChange={(event) => setPasswords({ ...passwords, confirm: event.target.value })} />
                </Field>
              </div>
              {passwordError && <div className="error-text mt-16">{passwordError}</div>}
              <div className="mt-16">
                <Button
                  variant="primary"
                  icon={KeyRound}
                  loading={passwordMutation.isPending}
                  onClick={() => {
                    if (passwords.newPassword.length < 8) { setPasswordError('Le nouveau mot de passe doit contenir au moins 8 caractères.'); return; }
                    if (passwords.newPassword !== passwords.confirm) { setPasswordError('Les deux mots de passe ne correspondent pas.'); return; }
                    passwordMutation.mutate();
                  }}
                >
                  Mettre à jour le mot de passe
                </Button>
              </div>
            </div>
            <div className="card-head" style={{ borderTop: '1px solid var(--line)', borderBottom: 'none' }}>
              <h3>Session</h3>
            </div>
            <div className="card-body">
              <div className="row gap-12">
                <span className="stat-icon" style={{ flex: 'none' }}><Mail size={17} /></span>
                <div className="grow">
                  <div className="small strong">Connecté en tant que {user.email}</div>
                  <div className="tiny muted">Session sécurisée · expiration automatique après 30 jours</div>
                </div>
                <Badge tone="success" dot>Active</Badge>
              </div>
            </div>
          </Card>
        )}

        {section === 'apropos' && (
          <div className="stack gap-16">
            <Card className="card-pad">
              <div className="row gap-12">
                <span className="stat-icon" style={{ width: 46, height: 46, borderRadius: 13 }}><GraduationCap size={22} /></span>
                <div>
                  <h3 style={{ fontSize: 16 }}>School Net Academy</h3>
                  <p className="small muted">Plateforme de gestion scolaire · Brazzaville, République du Congo</p>
                </div>
              </div>
              <p className="small muted mt-16" style={{ lineHeight: 1.7 }}>
                School Net Academy centralise les inscriptions, la scolarité, les paiements, les résultats,
                les cours en ligne et la communication entre l'école, les parents, les enseignants et les élèves.
                Chaque profil dispose d'un accès adapté à ses responsabilités.
              </p>
            </Card>

            <Card className="card-pad">
              <div className="row gap-8" style={{ marginBottom: 12 }}>
                <Database size={15} style={{ color: 'var(--primary)' }} />
                <h3 style={{ fontSize: 14.5 }}>Comptes de démonstration</h3>
              </div>
              {[
                { label: 'Direction', email: 'direction@schoolnet.academy' },
                { label: 'Enseignant', email: 'prof.mbemba@schoolnet.academy' },
                { label: 'Parent', email: 'parent.ondongo@schoolnet.academy' },
              ].map((account) => (
                <div className="demo-credential" key={account.email}>
                  <span className="row gap-8"><Mail size={13} style={{ color: 'var(--ink-300)' }} /> {account.email}</span>
                  <span className="row gap-8">
                    <Badge tone="neutral">{account.label}</Badge>
                    <span className="tiny muted">demo1234</span>
                  </span>
                </div>
              ))}
              <p className="tiny muted mt-16">
                Les données sont générées automatiquement (élèves, paiements, notes, admissions) afin de
                présenter un établissement réaliste.
              </p>
            </Card>

            <Card className="card-pad">
              <div className="row gap-8" style={{ marginBottom: 10 }}>
                <Phone size={15} style={{ color: 'var(--primary)' }} />
                <h3 style={{ fontSize: 14.5 }}>Support</h3>
              </div>
              <p className="small muted">
                Secrétariat : +242 06 512 44 18 · contact@schoolnet.academy<br />
                Horaires : lundi au vendredi, 7h30 – 16h00.
              </p>
            </Card>
          </div>
        )}
      </div>
    </>
  );
}
