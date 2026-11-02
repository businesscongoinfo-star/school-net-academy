import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, CheckCheck, CreditCard, Megaphone, Sparkles, UserPlus, X } from 'lucide-react';
import { del, get, post } from '../lib/api';
import { relativeTime } from '../lib/format';
import type { NotificationItem } from '../lib/types';

const ICONS: Record<string, typeof Bell> = {
  paiement: CreditCard,
  inscription: UserPlus,
  annonce: Megaphone,
  systeme: Sparkles,
  equipe: Sparkles,
};

export function NotificationsBell() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const { data } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => get<{ items: NotificationItem[]; unread: number }>('/notifications'),
    refetchInterval: 60_000,
  });

  useEffect(() => {
    if (!open) return;
    const onClick = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['notifications'] });

  const markRead = useMutation({
    mutationFn: (id: string) => post(`/notifications/${id}/read`, {}),
    onSuccess: invalidate,
  });
  const readAll = useMutation({
    mutationFn: () => post('/notifications/read-all', {}),
    onSuccess: invalidate,
  });
  const remove = useMutation({
    mutationFn: (id: string) => del(`/notifications/${id}`),
    onSuccess: invalidate,
  });

  const items = data?.items ?? [];
  const unread = data?.unread ?? 0;

  return (
    <div className="notif-wrap" ref={ref}>
      <button
        type="button"
        className="icon-btn"
        aria-label={`Notifications${unread ? ` (${unread} non lues)` : ''}`}
        title="Notifications"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
      >
        <Bell size={17} />
        {unread > 0 && <span className="notif-dot">{unread > 9 ? '9+' : unread}</span>}
      </button>

      {open && (
        <div className="notif-panel" role="dialog" aria-label="Notifications">
          <div className="notif-head">
            <strong>Notifications</strong>
            <div className="row gap-6">
              {unread > 0 && (
                <button type="button" className="link-btn" onClick={() => readAll.mutate()}>
                  <CheckCheck size={13} /> Tout lire
                </button>
              )}
              <button type="button" className="icon-btn" onClick={() => setOpen(false)} aria-label="Fermer">
                <X size={14} />
              </button>
            </div>
          </div>
          <div className="notif-list">
            {!items.length && (
              <div className="notif-empty">
                <Bell size={18} />
                <p className="small muted">Aucune notification pour l'instant.</p>
              </div>
            )}
            {items.map((item) => {
              const Icon = ICONS[item.kind] ?? Bell;
              return (
                <div key={item.id} className={`notif-item${item.readAt ? '' : ' unread'}`}>
                  <button
                    type="button"
                    className="notif-main"
                    onClick={() => {
                      if (!item.readAt) markRead.mutate(item.id);
                      if (item.link) {
                        setOpen(false);
                        navigate(item.link);
                      }
                    }}
                  >
                    <span className="notif-icon"><Icon size={14} /></span>
                    <span className="grow">
                      <strong>{item.title}</strong>
                      {item.body && <span className="small muted notif-body">{item.body}</span>}
                      <span className="tiny muted">{relativeTime(item.createdAt)}</span>
                    </span>
                  </button>
                  <button
                    type="button"
                    className="icon-btn danger"
                    aria-label="Supprimer la notification"
                    onClick={() => remove.mutate(item.id)}
                  >
                    <X size={12} />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
