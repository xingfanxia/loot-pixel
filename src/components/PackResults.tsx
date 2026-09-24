"use client";

import { useEffect, useRef, type CSSProperties } from "react";
import type { PackResult } from "@/lib/vault/context";
import { PAL } from "@/lib/vault/palette";
import { TIERS } from "@/lib/vault/tiers";

/**
 * The 10-pull results: every card of the pack as the engine drew its face, best first, with
 * NEW or the copy count. "Open another pack" charges the next pack; "Done" leaves it waiting.
 */
export default function PackResults({ cards, onClose }: { cards: PackResult[] | null; onClose: (again: boolean) => void }) {
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = dialog.current; if (!d) return;
    if (cards && !d.open) d.showModal();
    if (!cards && d.open) d.close();
  }, [cards]);

  const fresh = cards?.filter(c => c.isNew).length ?? 0;

  return (
    <dialog ref={dialog} id="pull" aria-labelledby="pull-title" onCancel={e => { e.preventDefault(); onClose(false); }}>
      {cards && (<>
        <header className="pull-head">
          <h2 id="pull-title">Pack opened</h2>
          <p>{fresh ? `${fresh} new ${fresh === 1 ? "card" : "cards"} for your collection` : "No new cards this time"}</p>
        </header>
        <ol className="pull-grid">
          {cards.map((c, k) => (
            <li key={k} className={k === 0 ? "best" : undefined}
              style={{ "--tl": PAL[TIERS[c.tier].l], "--td": PAL[TIERS[c.tier].d], "--w": c.w, "--h": c.h, "--k": k } as CSSProperties}>
              <img src={c.face} alt={`${TIERS[c.tier].short}: ${c.title}${c.isNew ? ", new" : `, ${c.count} copies`}`} />
              <span className={c.isNew ? "tag new" : "tag"} aria-hidden="true">{c.isNew ? "NEW" : `x${c.count}`}</span>
            </li>
          ))}
        </ol>
        <footer className="pull-foot">
          <button type="button" className="px pull-again" onClick={() => onClose(true)} autoFocus>Open another pack</button>
          <button type="button" className="px" onClick={() => onClose(false)}>Done</button>
        </footer>
      </>)}
    </dialog>
  );
}
