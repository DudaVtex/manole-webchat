import React, { useState } from 'react';
import type { BackInStockOffer, ContactErrors, SubscribeResult } from './backInStock';

/** "11987654321" → "(11) 98765-4321", as the shopper types. */
function maskBrPhone(value: string): string {
  const d = value.replace(/\D/g, '').slice(0, 11);
  if (d.length <= 2) return d ? `(${d}` : '';
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

type Phase = 'form' | 'sending' | 'done' | 'not-active' | 'failed';

/**
 * The sign-up card inside the conversation. Copy follows the official VTEX CX
 * widget in Portuguese, so shoppers see the same flow on any Manole channel.
 */
export default function BackInStockForm({
  offer,
  onSubmit,
  onDismiss,
}: {
  offer: BackInStockOffer;
  onSubmit: (contact: { name: string; phone: string }) => Promise<SubscribeResult>;
  onDismiss: () => void;
}) {
  const [name, setName] = useState('');
  const [ddi, setDdi] = useState('55');
  const [phone, setPhone] = useState('');
  const [errors, setErrors] = useState<ContactErrors>({});
  const [phase, setPhase] = useState<Phase>('form');
  const product = offer.productName || 'este produto';

  if (phase === 'done') {
    return (
      <div className="krc-bis" role="status">
        <strong className="krc-bis-title">Tudo pronto</strong>
        <p className="krc-bis-text">Vamos te avisar no WhatsApp quando {product} estiver de volta ao estoque.</p>
      </div>
    );
  }

  if (phase === 'not-active') {
    return (
      <div className="krc-bis" role="status">
        <strong className="krc-bis-title">Aviso indisponível</strong>
        <p className="krc-bis-text">No momento não conseguimos registrar avisos de reposição. Tente de novo mais tarde.</p>
        <button type="button" className="krc-bis-secondary" onClick={onDismiss}>
          Fechar
        </button>
      </div>
    );
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setPhase('sending');
    const result = await onSubmit({ name: name.trim(), phone: `+${ddi.replace(/\D/g, '')} ${phone}` });
    if (result.ok) {
      setPhase(result.accepted ? 'done' : 'not-active');
      return;
    }
    if (result.errors) {
      setErrors(result.errors);
      setPhase('form');
      return;
    }
    setPhase('failed');
  }

  const sending = phase === 'sending';
  return (
    <form className="krc-bis" onSubmit={submit} noValidate>
      <strong className="krc-bis-title">Receba aviso de reposição</strong>
      <p className="krc-bis-text">Vamos te avisar no WhatsApp assim que {product} estiver de volta ao estoque.</p>

      <label className="krc-bis-label" htmlFor="krc-bis-name">
        Nome
      </label>
      <input
        id="krc-bis-name"
        className={`krc-bis-input${errors.name ? ' is-invalid' : ''}`}
        autoComplete="name"
        value={name}
        aria-invalid={Boolean(errors.name)}
        aria-describedby={errors.name ? 'krc-bis-name-error' : undefined}
        onChange={(event) => {
          setName(event.target.value);
          setErrors((e) => ({ ...e, name: undefined }));
        }}
      />
      {errors.name && (
        <span id="krc-bis-name-error" className="krc-bis-error">
          Preencha este campo
        </span>
      )}

      <label className="krc-bis-label" htmlFor="krc-bis-phone">
        Número do WhatsApp
      </label>
      <div className="krc-bis-phone">
        <span className="krc-bis-ddi">
          <span aria-hidden="true">+</span>
          <input
            className="krc-bis-input"
            aria-label="DDI"
            inputMode="numeric"
            maxLength={3}
            value={ddi}
            onChange={(event) => setDdi(event.target.value.replace(/\D/g, ''))}
          />
        </span>
        <input
          id="krc-bis-phone"
          className={`krc-bis-input${errors.phone ? ' is-invalid' : ''}`}
          inputMode="tel"
          autoComplete="tel-national"
          placeholder="(11) 98765-4321"
          value={phone}
          aria-invalid={Boolean(errors.phone)}
          aria-describedby={errors.phone ? 'krc-bis-phone-error' : undefined}
          onChange={(event) => {
            setPhone(ddi === '55' ? maskBrPhone(event.target.value) : event.target.value);
            setErrors((e) => ({ ...e, phone: undefined }));
          }}
        />
      </div>
      {errors.phone && (
        <span id="krc-bis-phone-error" className="krc-bis-error">
          Informe um telefone válido
        </span>
      )}
      {phase === 'failed' && <span className="krc-bis-error">Não foi possível enviar agora. Tente de novo.</span>}

      <div className="krc-bis-actions">
        <button type="button" className="krc-bis-secondary" onClick={onDismiss} disabled={sending}>
          Agora não
        </button>
        <button type="submit" className="krc-bis-primary" disabled={sending}>
          {sending ? 'Enviando…' : 'Avise-me'}
        </button>
      </div>
    </form>
  );
}
