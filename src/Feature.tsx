import { useEffect, useState } from "react";
import {
  MeshNameInput,
  useCommitRevealHook,
  useFairRng,
  useNamedPeer,
  usePhase,
  type MeshConfig,
  type YRoom,
} from "@baditaflorin/mesh-common";

type Props = { room: YRoom | null; config: MeshConfig };
type Compliment = { to: string; text: string };

export function Feature({ room, config }: Props) {
  if (!room) {
    return (
      <div className="compli-screen">
        <h1>compliment roulette</h1>
        <p className="compli-status">Connecting…</p>
      </div>
    );
  }
  return <Body room={room} config={config} />;
}

function Body({ room, config }: { room: YRoom; config: MeshConfig }) {
  const { name, setName, names, nameOf } = useNamedPeer(config, room);
  const fairRng = useFairRng(room, "compli-salts");
  const phaseState = usePhase<"lobby" | "writing" | "reveal">(room, "phase", "lobby");
  const stateMap = room.doc.getMap<number>("state");
  const [, rerender] = useState(0);
  useEffect(() => {
    const cb = () => rerender((n) => n + 1);
    stateMap.observe(cb);
    return () => stateMap.unobserve(cb);
  }, [stateMap]);
  const roundN = stateMap.get("round") ?? 0;
  const cr = useCommitRevealHook<Compliment>(room, config.storagePrefix, `compliments-${roundN}`);
  const [draft, setDraft] = useState("");

  const present = Object.keys(names).sort();
  const order = fairRng.shuffle(present);
  const myIdx = order.indexOf(room.peerId);
  const myTarget =
    present.includes(room.peerId) && order.length > 1 ? order[(myIdx + 1) % order.length] : null;
  const myTargetName = myTarget ? (nameOf(myTarget) ?? myTarget.slice(0, 6)) : "";
  const iAmNamed = present.includes(room.peerId);
  const canStart = present.length >= 2 && phaseState.phase === "lobby";

  useEffect(() => {
    if (phaseState.phase === "reveal" && cr.myHash && !cr.myReveal) {
      void cr.reveal();
    }
  }, [phaseState.phase, cr.myHash, cr.myReveal, cr]);

  const seal = () => {
    const text = draft.trim();
    if (!text || !myTarget) return;
    void cr.commit({ to: myTarget, text });
    setDraft("");
  };

  const nextRound = () => {
    stateMap.set("round", roundN + 1);
    fairRng.rerollMine();
    phaseState.transition("lobby");
  };

  const sealedCount = Object.values(cr.entries).filter((e) => e.hash).length;

  const revealedEntries = Object.values(cr.entries).filter(
    (e) => e.reveal && e.reveal.payload.to === room.peerId,
  );

  return (
    <div className="compli-screen">
      <header className="compli-header">
        <h1>compliment roulette</h1>
        <p className="compli-status">
          round {roundN + 1} · {present.length} {present.length === 1 ? "peer" : "peers"} ·{" "}
          {phaseState.phase}
        </p>
      </header>

      <MeshNameInput
        className="compli-name"
        value={name}
        onChange={setName}
        placeholder="your name"
        maxLength={48}
      />

      {phaseState.phase === "lobby" && (
        <div className="compli-lobby">
          <button
            type="button"
            className="compli-start"
            aria-label="start round"
            disabled={!canStart}
            onClick={() => phaseState.transition("writing", { from: "lobby" })}
          >
            start round
          </button>
          {!iAmNamed && <p className="compli-hint">Type your name above to join the round.</p>}
          {iAmNamed && present.length < 2 && (
            <p className="compli-hint">
              You&apos;re in. Now open this page in a second tab (or share the 📡 invite link) so
              there&apos;s someone to compliment — then press start round.
            </p>
          )}
        </div>
      )}

      {phaseState.phase === "writing" && myTarget && (
        <div className="compli-writing">
          <p className="compli-banner">write something kind for: {myTargetName}</p>
          <textarea
            className="compli-input"
            placeholder="say something kind…"
            maxLength={200}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            disabled={!!cr.myHash}
          />
          <div className="compli-actions">
            <button
              type="button"
              className="compli-seal"
              aria-label="seal"
              disabled={!draft.trim() || !!cr.myHash}
              onClick={seal}
            >
              seal
            </button>
            <button
              type="button"
              className="compli-reveal-all"
              aria-label="reveal all"
              onClick={() => phaseState.transition("reveal", { from: "writing" })}
            >
              reveal all
            </button>
          </div>
          <p className="compli-hint">
            {sealedCount} of {present.length} sealed
            {cr.myHash ? " · yours is in — reveal all once everyone has sealed" : ""}
          </p>
        </div>
      )}

      {phaseState.phase === "reveal" && (
        <div className="compli-reveal">
          {revealedEntries.length === 0 && <p className="compli-hint">waiting for reveals…</p>}
          <div className="compli-cards">
            {revealedEntries.map((e) => {
              const c = e.reveal!.payload;
              const toName = nameOf(c.to) ?? c.to.slice(0, 6);
              return (
                <div key={e.peerId} className="compli-card" data-to={c.to}>
                  for {toName}: {c.text}
                </div>
              );
            })}
          </div>
          <button type="button" className="compli-next" aria-label="next round" onClick={nextRound}>
            next round
          </button>
        </div>
      )}
    </div>
  );
}
