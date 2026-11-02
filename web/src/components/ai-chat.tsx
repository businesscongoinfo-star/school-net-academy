import { useEffect, useRef, useState } from 'react';
import { Bot, Send, Sparkles, X } from 'lucide-react';
import { ApiError, post } from '../lib/api';

type Message = { role: 'user' | 'assistant'; content: string };

const SUGGESTIONS = [
  'Combien coûte un abonnement ?',
  'Comment fonctionne la carte scolaire NFC ?',
  'Comment envoyer un SMS aux parents ?',
  'Comment créer une campagne newsletter ?',
];

export function AiChat({ floating = true, compact = false }: { floating?: boolean; compact?: boolean }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: "Bonjour 👋 Je suis **School Net IA**. Posez-moi une question sur la scolarité, les paiements, les cartes scolaires, les abonnements ou la newsletter.",
    },
  ]);
  const [input, setInput] = useState('');
  const [pending, setPending] = useState(false);
  const [source, setSource] = useState<'openai' | 'local' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages, open, pending]);

  async function send(text: string) {
    const question = text.trim();
    if (!question || pending) return;
    setError(null);
    setInput('');
    const history = [...messages, { role: 'user' as const, content: question }];
    setMessages(history);
    setPending(true);
    try {
      const data = await post<{ reply: string; source?: 'openai' | 'local' }>('/ai/chat', {
        messages: history.filter((message) => message.content).slice(-10),
      });
      setMessages((current) => [...current, { role: 'assistant', content: data.reply }]);
      setSource(data.source ?? 'local');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "L'assistant est momentanément indisponible.");
    } finally {
      setPending(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        className={floating ? 'ai-launcher' : 'ai-launcher inline'}
        onClick={() => setOpen(true)}
        aria-label="Ouvrir l'assistant School Net IA"
      >
        <Sparkles size={18} />
        <span>Assistance IA</span>
      </button>
    );
  }

  return (
    <div className={floating ? 'ai-panel' : `ai-panel inline${compact ? ' compact' : ''}`} role="dialog" aria-label="Assistant School Net IA">
      <div className="ai-head">
        <span className="ai-avatar"><Bot size={16} /></span>
        <div className="grow">
          <strong>School Net IA</strong>
          <div className="tiny">
            {source === 'openai' ? 'Connecté à OpenAI' : 'Assistant de la plateforme · réponses instantanées'}
          </div>
        </div>
        <button type="button" className="icon-btn" onClick={() => setOpen(false)} aria-label="Fermer l'assistant">
          <X size={15} />
        </button>
      </div>

      <div className="ai-body" ref={listRef}>
        {messages.map((message, index) => (
          <div key={index} className={`ai-msg ${message.role}`}>
            {message.role === 'assistant' && <span className="ai-bubble-icon"><Bot size={13} /></span>}
            <div className="ai-bubble" dangerouslySetInnerHTML={{ __html: renderMarkdown(message.content) }} />
          </div>
        ))}
        {pending && (
          <div className="ai-msg assistant">
            <span className="ai-bubble-icon"><Bot size={13} /></span>
            <div className="ai-bubble typing"><span /><span /><span /></div>
          </div>
        )}
        {error && <p className="error-text">{error}</p>}
        {messages.length <= 1 && (
          <div className="ai-suggestions">
            {SUGGESTIONS.map((suggestion) => (
              <button key={suggestion} type="button" className="ai-chip" onClick={() => send(suggestion)}>
                {suggestion}
              </button>
            ))}
          </div>
        )}
      </div>

      <form
        className="ai-foot"
        onSubmit={(event) => {
          event.preventDefault();
          send(input);
        }}
      >
        <input
          className="input"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="Écrivez votre question…"
          aria-label="Votre question"
        />
        <button type="submit" className="btn btn-primary btn-icon" disabled={pending || !input.trim()} aria-label="Envoyer">
          <Send size={15} />
        </button>
      </form>
    </div>
  );
}

/** Rendu minimal du markdown (gras + sauts de ligne) sans dépendance externe. */
function renderMarkdown(text: string) {
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  return escaped
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n{2,}/g, '<br /><br />')
    .replace(/\n/g, '<br />');
}
