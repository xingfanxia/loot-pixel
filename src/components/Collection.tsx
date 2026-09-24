"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import type { Deck } from "@/lib/vault/decks";
import type { DeckCard } from "@/lib/vault/decks/types";
import { PAL } from "@/lib/vault/palette";
import { TIERS } from "@/lib/vault/tiers";

/** Tier colours as CSS custom properties for a card frame. */
const tierStyle = (tier: number) => ({ "--tl": PAL[TIERS[tier].l], "--td": PAL[TIERS[tier].d] }) as CSSProperties;

/**
 * The collection: every card of the deck grouped by slot (a person), found cards shown in full,
 * missing ones as the card's own silhouette. Only image decks have per-card art worth browsing.
 */
export default function Collection({ deck, owned, open, onClose }: {
  deck: Deck; owned: Record<string, number>; open: boolean; onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [detail, setDetail] = useState<DeckCard | null>(null);

  useEffect(() => {
    const d = dialog.current; if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
    if (!open) setDetail(null);
  }, [open]);

  const bySlot = useMemo(() => deck.slots.map((s, i) => ({ slot: s, cards: deck.cards.filter(c => c.slot === i) })), [deck]);
  const tiers = deck.tiers.map(t => t.tier);
  const found = deck.cards.filter(c => owned[c.id]).length;

  return (
    <dialog ref={dialog} id="album" onClose={onClose} onCancel={e => { if (detail) { e.preventDefault(); setDetail(null); } }}
      aria-labelledby="album-title">
      <header className="album-head">
        <div>
          <h2 id="album-title">{deck.title} collection</h2>
          <p className="album-count">{found} of {deck.cards.length} cards found</p>
        </div>
        <ul className="album-tiers" aria-label="Found per rarity">
          {tiers.map(t => {
            const all = deck.cards.filter(c => c.tier === t), have = all.filter(c => owned[c.id]).length;
            return <li key={t} style={tierStyle(t)}><span className="swatch" />{TIERS[t].short} {have}/{all.length}</li>;
          })}
        </ul>
        <button type="button" className="px album-close" onClick={onClose}>Close</button>
      </header>

      <div className="album-body">
        {found === 0 && <p className="album-empty">Nothing here yet. Hold the card on the altar to draw your first one.</p>}
        {bySlot.map(({ slot, cards }) => {
          const have = cards.filter(c => owned[c.id]).length;
          return (
            <section key={slot.id} className="album-person" aria-label={`${slot.fullName}, ${have} of ${cards.length} found`}>
              <div className="album-who">
                <h3>{slot.fullName}</h3>
                {slot.role && <p className="role">{slot.role}</p>}
                <p className="progress"><span className="bar"><span style={{ width: `${(have / cards.length) * 100}%` }} /></span>{have}/{cards.length}</p>
              </div>
              <div className="album-cards">
                {tiers.map(t => { const group = cards.filter(c => c.tier === t); if (!group.length) return null; return (
                <ol key={t} className="tier-group" aria-label={TIERS[t].short}>
                {group.map(c => {
                  const n = owned[c.id] || 0, art = c.art.kind === "image" ? c.art.src : null;
                  return (
                    <li key={c.id} style={tierStyle(c.tier)}>
                      {n > 0 ? (
                        <button type="button" className="thumb" onClick={() => setDetail(c)}
                          aria-label={`${TIERS[c.tier].short}: ${c.title ?? c.name}${n > 1 ? `, ${n} copies` : ""}`}>
                          {art ? <img src={art} alt="" /> : <span className="thumb-name">{c.name}</span>}
                          {n > 1 && <span className="copies">x{n}</span>}
                        </button>
                      ) : (
                        <span className="thumb missing" role="img" aria-label={`${TIERS[c.tier].short} card not found yet`}>
                          {art && <img src={art} alt="" />}
                          <span className="q" aria-hidden="true">?</span>
                        </span>
                      )}
                    </li>
                  );
                })}
                </ol>); })}
              </div>
            </section>
          );
        })}
      </div>

      {detail && (
        <div className="album-detail" style={tierStyle(detail.tier)} role="group" aria-label={detail.title ?? detail.name}>
          <div className="detail-card">
            {detail.art.kind === "image" && <img src={detail.art.src} alt={`${deck.slots[detail.slot].fullName} as ${detail.title}`} />}
            <div className="detail-text">
              <p className="detail-tier">{TIERS[detail.tier].name}</p>
              <h3>{detail.title ?? detail.name}</h3>
              <p className="detail-who">{deck.slots[detail.slot].fullName}</p>
              {detail.note && <p className="detail-note">{detail.note}</p>}
              <p className="detail-copies">{(owned[detail.id] || 0) > 1 ? `${owned[detail.id]} copies` : "1 copy"}</p>
              <button type="button" className="px" onClick={() => setDetail(null)} autoFocus>Back to collection</button>
            </div>
          </div>
        </div>
      )}
    </dialog>
  );
}
