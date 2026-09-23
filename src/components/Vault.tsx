"use client";

import { useEffect, useRef, useState } from "react";
import { deckIdFrom, DEFAULT_DECK, forceOptions, resolveDeck, type DeckSources } from "@/lib/vault/decks";
import type { VaultController } from "@/lib/vault/engine";

/**
 * DOM shell for the canvas engine. React owns the HUD controls; the engine owns the
 * canvases, the card hit area, the "draw another" button and the live region.
 * The deck comes from `?deck=<id>` (default cl-team); `sources` is its server-read card data.
 */
export default function Vault({ sources }: { sources: DeckSources }) {
  const stage = useRef<HTMLDivElement>(null);
  const screen = useRef<HTMLCanvasElement>(null);
  const bloom = useRef<HTMLCanvasElement>(null);
  const crt = useRef<HTMLDivElement>(null);
  const hit = useRef<HTMLButtonElement>(null);
  const again = useRef<HTMLButtonElement>(null);
  const hud = useRef<HTMLDivElement>(null);
  const live = useRef<HTMLDivElement>(null);
  const vault = useRef<VaultController | null>(null);

  const [options, setOptions] = useState(() => forceOptions(DEFAULT_DECK));
  const [force, setForce] = useState(-1);
  const [sound, setSound] = useState(true);
  const [bagComplete, setBagComplete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const onError = (e: ErrorEvent) => setError(e.message);
    window.addEventListener("error", onError);
    const deck = resolveDeck(deckIdFrom(location.search), sources);
    setOptions(forceOptions(deck));
    setForce(-1);
    // The engine touches canvas/DOM APIs, so load it only in the browser.
    import("@/lib/vault/engine")
      .then(({ createVault }) => {
        if (cancelled) return;
        vault.current = createVault(
          {
            stage: stage.current!, screen: screen.current!, bloom: bloom.current!, crt: crt.current!,
            hit: hit.current!, again: again.current!, hud: hud.current!, live: live.current!,
          },
          deck,
          { onBagComplete: setBagComplete, onError: setError },
        );
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)));
    return () => {
      cancelled = true;
      window.removeEventListener("error", onError);
      vault.current?.destroy();
      vault.current = null;
    };
  }, [sources]);

  return (
    <>
      <div id="stage" ref={stage}>
        <canvas id="screen" ref={screen} aria-hidden="true" />
        <canvas id="bloom" ref={bloom} aria-hidden="true" />
      </div>
      <div id="crt" ref={crt} />
      <button id="hit" ref={hit} aria-label="Loot card. Press and hold to open." />
      <button id="again" ref={again} className="px" type="button">Draw another</button>
      <button
        id="mute"
        className="px"
        type="button"
        aria-pressed={!sound}
        onClick={() => { const on = !sound; setSound(on); vault.current?.setSound(on); }}
      >
        {sound ? "Sound on" : "Sound off"}
      </button>
      <div id="hud" ref={hud}>
        <div className="row" role="group" aria-label="Next card rarity">
          <span className="lbl">Next:</span>
          {options.map((o) => (
            <button
              key={o.value}
              className="px pill"
              type="button"
              aria-pressed={force === o.value}
              onClick={() => { setForce(o.value); vault.current?.setForce(o.value); }}
            >
              {o.label}
            </button>
          ))}
          <button id="reset" className="px pill" type="button" hidden={!bagComplete} onClick={() => vault.current?.resetBag()}>
            Empty bag
          </button>
        </div>
      </div>
      <div id="live" ref={live} className="sr" aria-live="polite" />
      <div id="err" style={error ? { display: "block" } : undefined}>{error && `Something broke: ${error}`}</div>
    </>
  );
}
