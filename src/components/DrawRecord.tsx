import type { CSSProperties } from "react";
import type { DrawRecord as Record } from "@/lib/vault/context";
import { meterFill, verdict } from "@/lib/vault/odds";

const SEGMENTS = 20;
/** What the rating is based on, against what the odds give: "74 draws per Legendary (the odds give 62)". */
const basis = (r: Record) => (r.gaps.length
  ? `${Math.round(r.gaps.reduce((a, b) => a + b, 0) / r.gaps.length)} draws per Legendary`
  : `No Legendary in ${r.streak} ${r.streak === 1 ? "draw" : "draws"}`) + ` (the odds give ${Math.round(r.mean)})`;

/** The luck verdict, a 20-segment meter (lucky to the right) and what it is based on. Theme CSS styles the meter (`.luck`). */
function Luck({ record, compact }: { record: Record; compact?: boolean }) {
  if (record.luck === null) return <p className="luck-none">No draws yet. Your luck shows up after the first one.</p>;
  const z = record.luck, word = verdict(z), fill = meterFill(z), lit = Math.max(1, Math.round(fill * SEGMENTS));
  return (
    <div className={compact ? "luck compact" : "luck"} data-verdict={word.toLowerCase()}>
      <p className="verdict">{word}</p>
      <div className="meter" role="meter" aria-label="Luck" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(fill * 100)} aria-valuetext={`${word}: ${basis(record)}`}>
        {Array.from({ length: SEGMENTS }, (_, i) => <i key={i} className={i < lit ? "on" : undefined} style={{ "--i": i } as CSSProperties} />)}
      </div>
      <p className="luck-note">{basis(record)}</p>
    </div>
  );
}

/** The collection's draw record: luck, counts, the pity countdown and every Legendary's draw count. */
export default function DrawRecord({ record }: { record: Record }) {
  const legends = record.gaps.length, avg = legends ? record.gaps.reduce((a, b) => a + b, 0) / legends : 0;
  return (
    <section className="record" aria-label="Draw record">
      <Luck record={record} />
      <dl className="record-stats">
        <div><dt>Draws</dt><dd>{record.draws}</dd></div>
        <div><dt>Legendary</dt><dd>{legends}</dd>
          <p>{legends ? `One every ${Math.round(avg)} draws (the odds give ${Math.round(record.mean)})` : `The odds give one every ${Math.round(record.mean)} draws`}</p></div>
        <div><dt>Epic</dt><dd>{record.epics}</dd></div>
        <div><dt>Since last Legendary</dt><dd>{record.streak}</dd>
          {record.legendIn !== null && <p>Guaranteed within {record.legendIn}</p>}</div>
      </dl>
      {legends > 0 && (
        <div className="record-gaps">
          <h3>Draws per Legendary</h3>
          <ol>{record.gaps.map((g, i) => <li key={i} className={g < record.mean * .8 ? "fast" : g > record.mean * 1.2 ? "slow" : undefined}>{g}</li>)}</ol>
        </div>
      )}
    </section>
  );
}

/** HUD pill: the verdict and a 10-segment bar; opens the draw record. "Luck:" shows where the HUD has room for labels. */
function LuckPill({ record, onOpen }: { record: Record; onOpen: () => void }) {
  const z = record.luck!, word = verdict(z), lit = Math.max(1, Math.round(meterFill(z) * 10));
  return (
    <div className="row" role="group" aria-label="Luck">
      <span className="lbl">Luck:</span>
      <button type="button" className="px pill luck-pill luck" data-verdict={word.toLowerCase()} onClick={onOpen}
        aria-label={`Luck: ${word}. ${basis(record)}. Open the draw record.`}>
        <span className="word">{word}</span>
        <span className="mini" aria-hidden="true">{Array.from({ length: 10 }, (_, i) => <i key={i} className={i < lit ? "on" : undefined} style={{ "--i": i * 2 } as CSSProperties} />)}</span>
      </button>
    </div>
  );
}

export { Luck, LuckPill };
