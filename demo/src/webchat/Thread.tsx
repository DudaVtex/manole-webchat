import React from 'react';
import type { ComponentType } from 'react';
import type { ChatMessage, ChatProduct } from './mapMessage';
import { RichText } from './richText';
import ProductCarousel from './ProductCarousel';
import { suggestFollowUps } from './suggestions';
import BrandLoader from './BrandLoader';
import { useLinkedProducts } from './linkedProducts';
import { BookIcon, ChatIcon, FileIcon, SearchIcon, GridIcon, TruckIcon } from './icons';

export interface QuickAction {
  icon: 'search' | 'grid' | 'truck' | 'book';
  label: string;
  /** What the card sends when clicked. */
  text: string;
}

const ACTION_ICONS: Record<QuickAction['icon'], ComponentType<{ size?: number }>> = {
  search: SearchIcon,
  grid: GridIcon,
  truck: TruckIcon,
  book: BookIcon,
};

function Avatar() {
  return (
    <span className="krc-avatar" aria-hidden="true">
      <ChatIcon size={15} />
    </span>
  );
}

/**
 * An attachment inside a bubble. What renders is driven by the message type on
 * the wire, not by sniffing the URL.
 */
function Attachment({ message }: { message: ChatMessage }) {
  const { mediaUrl, mediaKind, mediaName } = message;

  if (mediaUrl && mediaKind === 'image') return <img src={mediaUrl} alt="" className="krc-media" />;
  if (mediaUrl && mediaKind === 'video') return <video src={mediaUrl} controls className="krc-media" />;
  if (mediaUrl && mediaKind === 'audio') return <audio src={mediaUrl} controls className="krc-audio" />;

  const Frame = mediaUrl ? 'a' : 'div';
  return (
    <Frame
      className="krc-file"
      {...(mediaUrl ? { href: mediaUrl, target: '_blank', rel: 'noreferrer', download: mediaName } : {})}
    >
      <FileIcon size={16} />
      <span>{mediaName || 'Arquivo anexado'}</span>
    </Frame>
  );
}

function TypingTurn() {
  return (
    <div className="krc-turn krc-turn--agent">
      <Avatar />
      <div className="krc-turn-body">
        <div className="krc-bubble krc-typing" role="status" aria-label="Digitando">
          <BrandLoader />
        </div>
      </div>
    </div>
  );
}

function Turn({
  message,
  followUpsAllowed,
  disabled,
  cartMode,
  storeOrigin,
  onSend,
  onAddToCart,
}: {
  message: ChatMessage;
  followUpsAllowed: boolean;
  disabled: boolean;
  cartMode: 'vtex' | 'link';
  storeOrigin?: string;
  onSend: (text: string) => void;
  onAddToCart: (product: ChatProduct) => Promise<boolean>;
}) {
  const isAgent = message.direction === 'agent';
  // Products written as prose links come back as cards, like a catalog turn.
  const linked = useLinkedProducts(message.text, storeOrigin, isAgent && !message.products?.length);
  const m: ChatMessage = linked ? { ...message, text: linked.text, products: linked.products } : message;
  const followUps = m.products?.length && followUpsAllowed ? suggestFollowUps(m.products) : [];
  const hasBubble = Boolean(m.text || m.mediaUrl || m.mediaKind);
  return (
    <div className={`krc-turn krc-turn--${m.direction}`}>
      {isAgent && (hasBubble ? <Avatar /> : <span className="krc-avatar-spacer" aria-hidden="true" />)}

      <div className={`krc-turn-body${m.products?.length ? ' is-wide' : ''}`}>
        {hasBubble && (
          <div className={`krc-bubble${m.mediaKind && !m.text ? ' is-media-only' : ''}`}>
            {m.mediaKind && <Attachment message={m} />}
            {m.text && (
              <div className="krc-bubble-text">
                {isAgent ? <RichText text={m.text} /> : m.text}
              </div>
            )}
          </div>
        )}

        {m.products && m.products.length > 0 && (
          <ProductCarousel products={m.products} header={m.productsHeader} onAdd={onAddToCart} mode={cartMode} />
        )}

        {followUps.length > 0 && (
          <div className="krc-quick-replies krc-follow-ups" aria-label="Sugestões para continuar">
            {followUps.map((text) => (
              <button type="button" key={text} onClick={() => onSend(text)} disabled={disabled}>
                {text}
              </button>
            ))}
          </div>
        )}

        {m.listItems && m.listItems.length > 0 && (
          <div className="krc-list">
            {m.listItems.map((item, i) => (
              <button type="button" key={i} onClick={() => onSend(item.title)} disabled={disabled}>
                <strong>{item.title}</strong>
                {item.description && <span>{item.description}</span>}
              </button>
            ))}
          </div>
        )}

        {m.quickReplies && m.quickReplies.length > 0 && (
          <div className="krc-quick-replies">
            {m.quickReplies.map((qr, i) => (
              <button type="button" key={i} onClick={() => onSend(qr)} disabled={disabled}>
                {qr}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function Thread({
  greeting,
  actions,
  messages,
  waiting,
  disabled,
  cartMode,
  storeOrigin,
  onSend,
  onAddToCart,
}: {
  greeting: string;
  actions: QuickAction[];
  messages: ChatMessage[];
  waiting: boolean;
  disabled: boolean;
  cartMode: 'vtex' | 'link';
  storeOrigin?: string;
  onSend: (text: string) => void;
  onAddToCart: (product: ChatProduct) => Promise<boolean>;
}) {
  return (
    <>
      {/* The opening turn is local copy, not a message from the agent: it is
          always the first thing in the thread and never sent over the wire. */}
      <div className="krc-turn krc-turn--agent">
        <Avatar />
        <div className="krc-turn-body">
          <div className="krc-bubble">{greeting}</div>
        </div>
      </div>

      {actions.length > 0 && (
        <div className="krc-actions">
          {actions.map((action) => {
            const Icon = ACTION_ICONS[action.icon] ?? SearchIcon;
            return (
              <button key={action.label} type="button" className="krc-action" onClick={() => onSend(action.text)} disabled={disabled}>
                <span className="krc-action-icon">
                  <Icon size={20} />
                </span>
                <span className="krc-action-label">{action.label}</span>
              </button>
            );
          })}
        </div>
      )}

      {messages.map((m, index) => (
        <Turn
          key={m.id}
          message={m}
          // Follow-ups for a carousel only while they are still the next step:
          // gone once the visitor says something, or once the agent offers
          // quick replies of its own (two rows of chips would compete).
          followUpsAllowed={!messages.slice(index + 1).some((later) => later.direction === 'user' || later.quickReplies?.length)}
          disabled={disabled}
          cartMode={cartMode}
          storeOrigin={storeOrigin}
          onSend={onSend}
          onAddToCart={onAddToCart}
        />
      ))}

      {waiting && <TypingTurn />}
    </>
  );
}
