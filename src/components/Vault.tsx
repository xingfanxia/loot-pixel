"use client";

import { useEffect, useRef, useState } from "react";
import { deckIdFrom, DEFAULT_DECK, forceOptions, resolveDeck, type Deck, type DeckSources } from "@/lib/vault/decks";
import { THEME_KEY, THEMES, themeById } from "@/lib/vault/themes";
import Collection from "./Collection";
import PackResults from "./PackResults";
import { LuckPill } from "./DrawRecord";
import type { VaultController } from "@/lib/vault/engine";
import type { DrawRecord, PackResult } from "@/lib/vault/context";

/**
 * DOM shell for the canvas engine. React owns the HUD controls; the engine owns the
 * canvases, the card hit area, the "draw another" button and the live region.
 * The deck comes from `?deck=<id>` (default cl-team); `sources` is its server-read card data.
 * The theme comes from `?theme=<id>`, else the viewer's last choice (THEME_KEY), else the default;
 * switching it rebuilds the engine (the bag is saved per deck, so nothing is lost).
 * "Draw x1 / x10" picks single cards or 10-pull packs (src/lib/vault/pack.ts).
 */
/** The "Next: Random / Common / …" rarity picker, hidden since the 10-pull (every draw is random); window.APP.force still forces a tier. */
const RARITY_PICKER = false;

export default function Vault({ sources }: { sources: DeckSources }) {
  const stage = useRef<HTMLDivElement>(null);
  const screen = useRef<HTMLCanvasElement>(null);
  const bloom = useRef<HTMLCanvasElement>(null);
  const crt = useRef<HTMLDivElement>(null);
  const hit = useRef<HTMLButtonElement>(null);
  const again = useRef<HTMLButtonElement>(null);
  const hud = useRef<HTMLDivElement>(null);
  const live = useRef<HTMLDivElement>(null);
  const bag = useRef<HTMLButtonElement>(null);
  const vault = useRef<VaultController | null>(null);

  const [options, setOptions] = useState(() => forceOptions(DEFAULT_DECK));
  const [force, setForce] = useState(-1);
  const [sound, setSound] = useState(true);
  const [bagComplete, setBagComplete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // the deck depends on the theme (a theme can bring its own card pack), so both change together
  const [run, setRun] = useState<{ deck: Deck; theme: string } | null>(null);
  const [album, setAlbum] = useState<{ owned: Record<string, number>; record: DrawRecord } | null>(null);
  const [packMode, setPackMode] = useState(false);
  // the pack being dealt (card on the altar of total) and the finished pack's results
  const [packAt, setPackAt] = useState<{ at: number; total: number } | null>(null);
  const [pull, setPull] = useState<{ cards: PackResult[]; record: DrawRecord } | null>(null);
  const [record, setRecord] = useState<DrawRecord | null>(null);
  // read by a rebuilt engine (theme switch) so the rarity pick, sound setting and draw mode carry over
  const prefs = useRef({ force: -1, sound: true, pack: false });

  const start = (theme: string) => {
    const deck = resolveDeck(deckIdFrom(location.search), sources, theme), opts = forceOptions(deck);
    setOptions(opts);
    if (!opts.some((o) => o.value === prefs.current.force)) { prefs.current.force = -1; setForce(-1); }
    setRun({ deck, theme });
  };

  useEffect(() => {
    const onError = (e: ErrorEvent) => setError(e.message);
    window.addEventListener("error", onError);
    setForce(-1);
    prefs.current.force = -1;
    let stored: string | null = null;
    try { stored = localStorage.getItem(THEME_KEY); } catch {}
    start(themeById(new URLSearchParams(location.search).get("theme") ?? stored).id);
    return () => window.removeEventListener("error", onError);
  }, [sources]);

  useEffect(() => {
    if (!run) return;
    const { deck, theme } = run;
    let cancelled = false;
    document.documentElement.dataset.vaultTheme = theme;
    // The engine touches canvas/DOM APIs, so load it only in the browser.
    import("@/lib/vault/engine")
      .then(({ createVault }) => {
        if (cancelled) return;
        const v = vault.current = createVault(
          {
            stage: stage.current!, screen: screen.current!, bloom: bloom.current!, crt: crt.current!,
            hit: hit.current!, again: again.current!, hud: hud.current!, live: live.current!, bag: bag.current!,
          },
          deck,
          themeById(theme),
          { onBagComplete: setBagComplete, onError: setError, onPack: setPackAt, onPackDone: (cards, record) => setPull({ cards, record }), onRecord: setRecord },
        );
        if (prefs.current.pack) v.setPack(true);
        if (prefs.current.force >= 0) v.setForce(prefs.current.force);
        if (!prefs.current.sound) v.setSound(false);
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)));
    return () => {
      cancelled = true;
      vault.current?.destroy();
      vault.current = null;
      setPackAt(null);
      setPull(null);
      setRecord(null);
    };
  }, [run]);

  const theme = run?.theme ?? null, deck = run?.deck ?? null;
  const openAlbum = () => { const v = vault.current; if (v) setAlbum({ owned: v.owned(), record: v.record() }); };
  const pickTheme = (id: string) => {
    if (id === theme) return;
    start(id);
    try { localStorage.setItem(THEME_KEY, id); } catch {}
    const url = new URL(location.href);
    if (url.searchParams.has("theme")) { url.searchParams.set("theme", id); history.replaceState(null, "", url); }
  };

  return (
    <>
      <div id="stage" ref={stage}>
        <canvas id="screen" ref={screen} aria-hidden="true" />
        <canvas id="bloom" ref={bloom} aria-hidden="true" />
      </div>
      <div id="crt" ref={crt} />
      <button id="hit" ref={hit} aria-label="Loot card. Press and hold to open." />
      <button id="again" ref={again} className={packAt && packAt.at < packAt.total ? "px skip" : "px"} type="button">
        {!packAt ? "Draw another" : packAt.at < packAt.total ? "Skip to best" : `See all ${packAt.total}`}
      </button>
      <div id="top">
        <div className="row" role="group" aria-label="Theme">
          {THEMES.map((t) => (
            <button key={t.id} className="px pill" type="button" aria-pressed={theme === t.id} onClick={() => pickTheme(t.id)}>
              {t.label}
            </button>
          ))}
        </div>
        <button
          id="mute"
          className="px pill"
          type="button"
          aria-pressed={!sound}
          onClick={() => { const on = !sound; setSound(on); prefs.current.sound = on; vault.current?.setSound(on); }}
        >
          {sound ? "Sound on" : "Sound off"}
        </button>
      </div>
      <div id="hud" ref={hud}>
        <div className="row" role="group" aria-label="Cards per draw">
          <span className="lbl">Draw:</span>
          {[false, true].map((on) => (
            <button key={String(on)} className="px pill" type="button" aria-pressed={packMode === on}
              onClick={() => { setPackMode(on); prefs.current.pack = on; vault.current?.setPack(on); }}>
              {on ? "x10" : "x1"}
            </button>
          ))}
        </div>
        {RARITY_PICKER && <div className="row" role="group" aria-label="Next card rarity">
          <span className="lbl">Next:</span>
          {options.map((o) => (
            <button
              key={o.value}
              className="px pill"
              type="button"
              aria-pressed={force === o.value}
              onClick={() => { setForce(o.value); prefs.current.force = o.value; vault.current?.setForce(o.value); }}
            >
              {o.label}
            </button>
          ))}
        </div>}
        {record && record.luck !== null && <LuckPill record={record} onOpen={openAlbum} />}
        <button id="reset" className="px pill" type="button" hidden={!bagComplete} onClick={() => vault.current?.resetBag()}>
          Empty bag
        </button>
      </div>
      <button id="bag" ref={bag} type="button" aria-label="Open the collection"
        onClick={openAlbum} />
      <PackResults cards={pull?.cards ?? null} record={pull?.record ?? null} onClose={(again) => { setPull(null); vault.current?.closePack(again); }} />
      {deck && <Collection deck={deck} owned={album?.owned ?? {}} record={album?.record ?? null} open={album !== null} onClose={() => setAlbum(null)} />}
      <div id="live" ref={live} className="sr" aria-live="polite" />
      <div id="err" style={error ? { display: "block" } : undefined}>{error && `Something broke: ${error}`}</div>
    </>
  );
}
