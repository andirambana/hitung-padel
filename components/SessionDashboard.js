"use client";

import { useEffect, useRef, useState } from "react";
import { fill } from "@/lib/i18n";
import { addPlayer, addRounds, createSession, endSession, hasScoreGap, isComplete, isSocial, minimumPlayers, normalizeBonus, rematchSession, remixRemaining, scheduleBalance, setMatchScore, setResultPoints, standings, stopPlayer } from "@/lib/session";
import { saveSession } from "@/lib/session-store";
import { getAccountSnapshot } from "@/lib/account";
import { publishSession } from "@/lib/cloud-sessions";
import { isCloudEnabled } from "@/lib/firebase";

function LanguageSwitch({ lang, label, onChange }) {
  return (
    <div className="lang-switch" role="group" aria-label={label}>
      <button type="button" className={lang === "id" ? "is-on" : ""} aria-pressed={lang === "id"} onClick={() => onChange("id")}>
        ID
      </button>
      <button type="button" className={lang === "en" ? "is-on" : ""} aria-pressed={lang === "en"} onClick={() => onChange("en")}>
        EN
      </button>
    </div>
  );
}

function SiteHeader({ label, onHome }) {
  return (
    <header className="page-head">
      <button className="page-logo" type="button" onClick={onHome} aria-label={label}>
        <img src="/mark.png" alt="" />
        <span>
          HitungSkor<span>Padel</span>
        </span>
      </button>
    </header>
  );
}

function SiteFooter({ copy }) {
  return (
    <footer className="site-footer">
      <div className="site-footer-brand">
        <img src="/mark.png" alt="" />
        <strong>
          HitungSkor<span>Padel</span>
        </strong>
      </div>
      <p>
        {copy.footerTag}
        <span className="site-footer-meta">© 2026</span>
      </p>
    </footer>
  );
}

function MenuGlyph({ name }) {
  const common = { fill: "none", stroke: "currentColor", strokeWidth: "1.8", strokeLinecap: "round", strokeLinejoin: "round" };
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" width="18" height="18">
      {name === "share" ? (
        <>
          <path d="M14 5h5v5M19 5l-8 8" {...common} />
          <path d="M17 13.5V19a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1h5.5" {...common} />
        </>
      ) : null}
      {name === "edit" ? <path d="M4 20h4L18.5 9.5a2.1 2.1 0 0 0-3-3L5 17v3Z" {...common} /> : null}
      {name === "points" ? <path d="M7 7h10M7 12h10M7 17h6" {...common} /> : null}
      {name === "shuffle" ? (
        <>
          <path d="M4 7h4l8 10h4M16 7h4v4M4 17h4l3.5-4.4" {...common} />
        </>
      ) : null}
      {name === "end" ? <path d="M6 4v16M6 5h10l-2.2 3.2L16 11.5H6" {...common} /> : null}
      {name === "add" ? (
        <>
          <circle cx="9" cy="8" r="3" {...common} />
          <path d="M3.8 19c.7-3 2.8-4.5 5.2-4.5s4.5 1.5 5.2 4.5M17 8v6M14 11h6" {...common} />
        </>
      ) : null}
      {name === "stop" ? (
        <>
          <circle cx="9" cy="8" r="3" {...common} />
          <path d="M3.8 19c.7-3 2.8-4.5 5.2-4.5s4.5 1.5 5.2 4.5M14 11h6" {...common} />
        </>
      ) : null}
      {name === "rematch" ? <path d="M20 12a8 8 0 1 1-2.3-5.6M20 4.5V9h-4.5" {...common} /> : null}
      {name === "back" ? <path d="M15 6.5 9.5 12 15 17.5" {...common} /> : null}
      {name === "chevron" ? <path d="M9 6.5 14.5 12 9 17.5" {...common} /> : null}
      {name === "out" ? <path d="M10 7V5h9v14h-9v-2M4 12h11M12 9l3 3-3 3" {...common} /> : null}
    </svg>
  );
}

function DotsIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" width="22" height="22">
      <circle cx="5" cy="12" r="1.7" fill="currentColor" />
      <circle cx="12" cy="12" r="1.7" fill="currentColor" />
      <circle cx="19" cy="12" r="1.7" fill="currentColor" />
    </svg>
  );
}

function ArrowRightIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" width="18" height="18">
      <path d="M5 12h14M13 6l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function PlayersIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="9" cy="8" r="2.3" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="16" cy="9" r="1.8" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M4.2 18.2c.7-2.6 2.6-3.9 4.8-3.9s4.1 1.3 4.8 3.9M13.2 14.8c1.3-.5 2.5-.5 3.7.3 1 .8 1.6 1.9 1.9 3.1" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function TargetIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="7" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="12" cy="12" r="2.4" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M12 3.2V6M12 18v2.8M3.2 12H6M18 12h2.8" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function TrophyIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" width="22" height="22">
      <path d="M7 4h10v2.2a5 5 0 0 1-3.2 4.66A4.2 4.2 0 0 1 12.9 13H11a4.2 4.2 0 0 1-1.1-2.14A5 5 0 0 1 7 6.2V4Z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M7 6H4.8A2.8 2.8 0 0 0 7 9.2M17 6h2.2A2.8 2.8 0 0 1 17 9.2M9.2 16.5h5.6M8 20h8M12 13.2V16.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

const POINT_GAME_TYPES = new Set(["americano", "mexicano", "king", "box", "swiss"]);

function scoringIdsFor(gameType) {
  if (POINT_GAME_TYPES.has(gameType)) {
    return ["rally"];
  }
  return ["golden", "advantage", "star", "silver", "rally"];
}

function sideLabel(session, ids) {
  return ids
    .map((id) => session.players.find((player) => player.id === id)?.name || "")
    .filter(Boolean)
    .join(" & ");
}

function resultSheet(session) {
  const pointsMode = session.result === "points";
  const sitOut = pointsMode ? normalizeBonus(session.sitOutPoints) : 0;
  const winBonus = pointsMode ? normalizeBonus(session.winBonus) : 0;
  const drawBonus = pointsMode ? normalizeBonus(session.drawBonus) : 0;
  const lossBonus = pointsMode ? normalizeBonus(session.lossBonus) : 0;
  const rows = new Map(
    session.players.map((player) => [
      player.id,
      { wins: 0, draws: 0, losses: 0, cells: session.rounds.map(() => null) },
    ]),
  );
  const matches = [];
  session.rounds.forEach((round, index) => {
    round.matches.forEach((match) => {
      matches.push({
        key: match.id,
        round: index + 1,
        sideA: sideLabel(session, match.sideA),
        sideB: sideLabel(session, match.sideB),
        scoreA: match.scoreA,
        scoreB: match.scoreB,
        done: isComplete(match),
      });
      if (!isComplete(match)) {
        return;
      }
      const resultA = match.scoreA > match.scoreB ? "win" : match.scoreA < match.scoreB ? "loss" : "draw";
      const resultB = resultA === "win" ? "loss" : resultA === "loss" ? "win" : "draw";
      const mark = (id, score, result) => {
        const row = rows.get(id);
        if (!row) {
          return;
        }
        const bonus = result === "win" ? winBonus : result === "draw" ? drawBonus : lossBonus;
        const current = row.cells[index];
        row.cells[index] = {
          points: (current && current.result !== "sit" ? current.points : 0) + score + bonus,
          result: current && current.result !== "sit" && current.result !== result ? "draw" : result,
        };
        row[result === "win" ? "wins" : result === "draw" ? "draws" : "losses"] += 1;
      };
      match.sideA.forEach((id) => mark(id, match.scoreA, resultA));
      match.sideB.forEach((id) => mark(id, match.scoreB, resultB));
    });
    const finished = sitOut > 0 && !round.pending && round.matches.length > 0 && round.matches.every(isComplete);
    for (const id of round.byes || []) {
      const row = rows.get(id);
      if (!row || row.cells[index]) {
        continue;
      }
      row.cells[index] = { points: finished ? sitOut : 0, result: "sit" };
    }
  });
  return { rows, matches };
}

function RoundTimer({ minutes, startLabel, doneLabel }) {
  const [left, setLeft] = useState(null);
  useEffect(() => {
    if (left == null || left <= 0) {
      return undefined;
    }
    const timer = setTimeout(() => setLeft((value) => (value == null ? value : value - 1)), 1000);
    return () => clearTimeout(timer);
  }, [left]);
  if (left == null) {
    return (
      <button className="button button-ghost timer-button" type="button" onClick={() => setLeft(minutes * 60)}>
        {startLabel}
      </button>
    );
  }
  const text = left <= 0 ? doneLabel : `${String(Math.floor(left / 60)).padStart(2, "0")}:${String(left % 60).padStart(2, "0")}`;
  return <span className={left <= 0 ? "timer is-done" : "timer"}>{text}</span>;
}

function RoundCard({ startOpen, title, progress, children }) {
  const started = useRef(false);
  return (
    <details
      className="round-card"
      ref={(node) => {
        if (node && startOpen && !started.current) {
          node.open = true;
          started.current = true;
        }
      }}
    >
      <summary>
        {title}
        <span>{progress}</span>
      </summary>
      {children}
    </details>
  );
}

function Chevron() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" width="18" height="18">
      <path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function OptionMenu({ label, value, options, open, onToggle, onChange, infoOpen, onInfo, infoLabel, placeholder, error }) {
  const selected = options.find((option) => option.id === value) || null;
  const canOpen = options.length > 1;
  const shown = selected?.title || placeholder || "";
  return (
    <div className={error ? "field is-invalid" : "field"}>
      <div className="field-head">
        <span>{label}</span>
        {onInfo ? (
          <button type="button" className={infoOpen ? "info-button is-on" : "info-button"} aria-expanded={infoOpen} aria-label={infoLabel} onClick={onInfo}>
            i
          </button>
        ) : null}
      </div>
      <div className={open ? "menu-select is-open" : "menu-select"}>
        {canOpen ? (
          <button type="button" className="menu-select-value" aria-haspopup="listbox" aria-expanded={open} aria-invalid={error ? true : undefined} onClick={onToggle}>
            <strong className={selected ? "" : "is-placeholder"}>{shown}</strong>
            <Chevron />
          </button>
        ) : (
          <div className="menu-select-value is-locked">
            <strong className={selected ? "" : "is-placeholder"}>{shown}</strong>
          </div>
        )}
        {open && canOpen ? (
          <ul className="menu-select-list" role="listbox" aria-label={label}>
            {options.map((option) => (
              <li key={option.id}>
                <button type="button" role="option" aria-selected={option.id === selected?.id} className={option.id === selected?.id ? "is-on" : ""} onClick={() => onChange(option.id)}>
                  {option.title}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
      {infoOpen && selected?.detail?.length ? (
        <ul className="scoring-detail">
          {selected.detail.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      ) : null}
      {error ? <small className="field-error">{error}</small> : null}
    </div>
  );
}

function filledCount(value) {
  const count = Number(value);
  return Number.isInteger(count) && count >= 1;
}

function limitCount(raw, max) {
  const digits = raw.replace(/[^\d]/g, "");
  if (!digits) {
    return "";
  }
  return String(Math.min(Number(digits), max));
}

export function CreateGame({ copy, lang, onLang, onBack }) {
  const [name, setName] = useState("");
  const [gameType, setGameType] = useState("");
  const [scoring, setScoring] = useState("");
  const [pointsPerRound, setPointsPerRound] = useState("");
  const [pairing, setPairing] = useState("");
  const [rounds, setRounds] = useState("");
  const [autoRound, setAutoRound] = useState(false);
  const [courts, setCourts] = useState("");
  const [courtNames, setCourtNames] = useState("");
  const [sitOut, setSitOut] = useState("");
  const [winBonus, setWinBonus] = useState("");
  const [drawBonus, setDrawBonus] = useState("");
  const [lossBonus, setLossBonus] = useState("");
  const [roundMinutes, setRoundMinutes] = useState("");
  const [timerOn, setTimerOn] = useState(false);
  const [playoffs, setPlayoffs] = useState(false);
  const [playerName, setPlayerName] = useState("");
  const [playerGender, setPlayerGender] = useState("m");
  const [players, setPlayers] = useState([]);
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState("");
  const [infoId, setInfoId] = useState(null);
  const [openMenu, setOpenMenu] = useState(null);
  const [step, setStep] = useState(1);
  const [showRequired, setShowRequired] = useState(false);
  const typeChosen = gameType !== "";
  const tournament = typeChosen && gameType !== "match";
  const social = gameType === "americano" || gameType === "mexicano";
  const gendered = social && pairing === "gender";
  const rally = scoring === "rally";

  function addName() {
    const next = playerName.trim();
    if (!next || players.length >= 32) {
      return;
    }
    setPlayers((current) => [...current, { name: next, gender: gendered ? playerGender : "" }]);
    setPlayerName("");
    setError("");
  }

  function chooseGameType(next) {
    setOpenMenu(null);
    setGameType(next);
    setScoring((current) => {
      const allowed = scoringIdsFor(next);
      if (allowed.length === 1) {
        return allowed[0];
      }
      if (current && allowed.includes(current)) {
        return current;
      }
      return "";
    });
    setPairing((current) => {
      if (current === "club" && next !== "americano") {
        return "";
      }
      if (current === "gender" && next !== "americano" && next !== "mexicano") {
        return "";
      }
      return current;
    });
  }

  const scoringChoices = copy.scoringOptions.filter((option) => scoringIdsFor(gameType || "match").includes(option.id));
  const selectedType = copy.gameTypes.find((option) => option.id === gameType) || null;
  const selectedScoring = scoringChoices.find((option) => option.id === scoring) || null;

  const showPairing = !typeChosen || social || gameType === "match";
  const clubMode = gameType === "americano" && pairing === "club";
  const showExtras = rally || POINT_GAME_TYPES.has(gameType);
  const showPlayoffs = gameType === "americano" || gameType === "mexicano" || gameType === "swiss";
  const needName = !name.trim();
  const needRounds = gameType !== "knockout" && !autoRound && !filledCount(rounds);
  const needCourts = gameType !== "knockout" && !filledCount(courts);
  const needPoints = rally && !pointsPerRound;
  const needPairing = showPairing && !pairing;
  const setupIncomplete = needName || !gameType || !scoring || needPairing || needPoints || needRounds || needCourts;

  function ready(event) {
    event.preventDefault();
    if (setupIncomplete) {
      setShowRequired(true);
      setError("");
      setStep(1);
      return null;
    }
    const needed = minimumPlayers("doubles");
    if (players.length < needed) {
      setError(fill(copy.needPlayers, { n: needed }));
      return null;
    }
    if (gendered) {
      const men = players.filter((player) => player.gender !== "f").length;
      const women = players.filter((player) => player.gender === "f").length;
      if (men < 2 || women < 2) {
        setError(copy.needMixed);
        return null;
      }
    }
    if (clubMode) {
      const clubs = new Map();
      players.forEach((player) => {
        const club = player.club?.trim();
        if (club) {
          clubs.set(club, (clubs.get(club) || 0) + 1);
        }
      });
      if ([...clubs.values()].filter((count) => count >= 2).length < 2) {
        setError(copy.needClubs);
        return null;
      }
    }
    setError("");
    return createSession({
      name,
      scoring,
      system: gameType,
      pointsPerRound,
      format: "doubles",
      pairing: gameType === "swiss" ? "fixed" : tournament ? pairing : pairing === "fixed" ? "fixed" : "mixed",
      rounds: autoRound ? "auto" : rounds,
      courts,
      courtNames,
      players: players.map((player) => ({ name: player.name, gender: player.gender, club: clubMode ? player.club : "" })),
      sitOutPoints: showExtras ? sitOut : "",
      winBonus: showExtras ? winBonus : "",
      drawBonus: showExtras ? drawBonus : "",
      lossBonus: showExtras ? lossBonus : "",
      roundMinutes: showExtras && timerOn ? roundMinutes : "",
      playoffs: showPlayoffs && playoffs,
    });
  }

  function goNext(event) {
    event.preventDefault();
    if (setupIncomplete) {
      setShowRequired(true);
      setError("");
      return;
    }
    setShowRequired(false);
    setError("");
    setOpenMenu(null);
    setStep(2);
  }

  function start(event) {
    const session = ready(event);
    if (!session) {
      return;
    }
    saveSession(session);
    onBack(session.id);
  }

  function showPreview(event) {
    const session = ready(event);
    setPreview(session);
  }

  useEffect(() => {
    setPreview(null);
  }, [name, gameType, scoring, pointsPerRound, pairing, rounds, autoRound, courts, courtNames, sitOut, winBonus, drawBonus, lossBonus, roundMinutes, timerOn, playoffs, players]);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [step]);

  const pairs = [];
  const showFixedPairs = pairing === "fixed";
  if (showFixedPairs) {
    for (let index = 0; index < players.length; index += 2) {
      pairs.push(players.slice(index, index + 2).map((player) => player.name));
    }
  }

  const choice = (id, title, detail = "") => ({ id, title, detail: detail ? [detail] : [] });
  const pairingValue = pairing === "fixed" || pairing === "gender" || pairing === "mixed" || pairing === "club" ? pairing : "";
  const pairingOptions = gameType === "americano"
    ? [choice("mixed", copy.individual, copy.individualHint), choice("gender", copy.mixed, copy.genderHint), choice("fixed", copy.teams, copy.teamsHint), choice("club", copy.club, copy.clubHint)]
    : social
      ? [choice("mixed", copy.individual, copy.individualHint), choice("gender", copy.mixed, copy.genderHint), choice("fixed", copy.teams, copy.teamsHint)]
      : [choice("fixed", copy.fixed, copy.fixedHint), choice("mixed", copy.mixed, copy.mixedHint)];
  const selectedPairing = pairingOptions.find((option) => option.id === pairingValue) || null;

  function pick(id, extra) {
    return <OptionMenu key={id} placeholder={copy.choosePlaceholder} open={openMenu === id} onToggle={() => setOpenMenu((current) => (current === id ? null : id))} {...extra} />;
  }

  const settingFields = [
    pick("type", {
      label: copy.gameType,
      value: gameType,
      options: copy.gameTypes,
      error: showRequired && !gameType ? copy.requiredField : "",
      onChange: chooseGameType,
      infoOpen: infoId === "type",
      onInfo: () => setInfoId((current) => (current === "type" ? null : "type")),
      infoLabel: fill(copy.scoringInfo, { name: selectedType?.title || copy.gameType }),
    }),
    pick("scoring", {
      label: copy.scoringSystem,
      value: selectedScoring?.id || scoring,
      options: scoringChoices,
      error: showRequired && !scoring ? copy.requiredField : "",
      onChange: (next) => {
        setScoring(next);
        setOpenMenu(null);
      },
      infoOpen: infoId === "scoring",
      onInfo: () => setInfoId((current) => (current === "scoring" ? null : "scoring")),
      infoLabel: fill(copy.scoringInfo, { name: selectedScoring?.title || copy.scoringSystem }),
    }),
  ];
  if (showPairing) {
    settingFields.push(
      pick("pairing", {
        label: copy.playerSystem,
        value: pairingValue,
        options: pairingOptions,
        error: showRequired && !pairing ? copy.requiredField : "",
        onChange: (next) => {
          setPairing(next);
          setOpenMenu(null);
        },
        infoOpen: infoId === "pairing",
        onInfo: () => setInfoId((current) => (current === "pairing" ? null : "pairing")),
        infoLabel: fill(copy.scoringInfo, { name: selectedPairing?.title || copy.playerSystem }),
      }),
    );
  }
  if (rally) {
    settingFields.push(
      <label key="points" className={showRequired && needPoints ? "field is-invalid" : "field"}>
        <span>{copy.pointsPerRound}</span>
        <input inputMode="numeric" aria-invalid={showRequired && needPoints ? true : undefined} value={pointsPerRound} placeholder={copy.pointsPlaceholder} onChange={(event) => setPointsPerRound(limitCount(event.target.value, 99))} />
        {showRequired && needPoints ? <small className="field-error">{copy.requiredField}</small> : null}
      </label>,
    );
  }
  if (gameType !== "knockout") {
    settingFields.push(
      <label key="rounds" className={showRequired && needRounds ? "field is-invalid" : "field"}>
        <span>{copy.roundsLabel}</span>
        <span className="inline-field">
          <input inputMode="numeric" aria-invalid={showRequired && needRounds ? true : undefined} value={autoRound ? "" : rounds} placeholder={copy.roundsPlaceholder} disabled={autoRound} onChange={(event) => { setAutoRound(false); setRounds(limitCount(event.target.value, 100)); }} />
          <button
            className={autoRound ? "button button-primary" : "button button-ghost"}
            type="button"
            aria-pressed={autoRound}
            onClick={() => {
              setAutoRound((current) => !current);
              setRounds("");
            }}
          >
            {copy.autoRounds}
          </button>
        </span>
        {showRequired && needRounds ? <small className="field-error">{copy.requiredField}</small> : null}
      </label>,
      <label key="courts" className={showRequired && needCourts ? "field is-invalid" : "field"}>
        <span>{copy.courtsLabel}</span>
        <input inputMode="numeric" aria-invalid={showRequired && needCourts ? true : undefined} value={courts} placeholder={copy.courtsPlaceholder} onChange={(event) => setCourts(limitCount(event.target.value, 10))} />
        {showRequired && needCourts ? <small className="field-error">{copy.requiredField}</small> : null}
      </label>,
    );
  }
  if (showExtras && gameType !== "knockout") {
    settingFields.push(
      <label key="court-names" className="field span-2">
        <span>{copy.courtNames}</span>
        <input value={courtNames} placeholder={copy.courtNamesPlaceholder} onChange={(event) => setCourtNames(event.target.value)} />
      </label>,
    );
  }
  if (settingFields.length % 2 === 1) {
    const last = settingFields[settingFields.length - 1];
    settingFields[settingFields.length - 1] = (
      <div key={last.key} className="span-2">
        {last}
      </div>
    );
  }

  return (
    <main className="setup session">
      <SiteHeader label={copy.home} onHome={() => onBack(null)} />
      <header className="setup-bar">
        <button className="back-button" type="button" onClick={() => onBack(null)}>
          <svg viewBox="0 0 24 24" aria-hidden="true" width="18" height="18">
            <path d="M14.5 6.5L9 12l5.5 5.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span>{copy.back}</span>
        </button>
        <p>{copy.createGame}</p>
        <LanguageSwitch lang={lang} label={copy.langLabel} onChange={onLang} />
      </header>

      <form
        onSubmit={step === 1 ? goNext : start}
        onPointerDown={(event) => {
          if (!event.target.closest(".menu-select")) {
            setOpenMenu(null);
          }
        }}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            setOpenMenu(null);
          }
        }}
      >
        <div className="create-steps">
          <button type="button" className={step === 1 ? "is-on" : "is-done"} onClick={() => { setError(""); setStep(1); }}>
            {copy.rulesStep}
          </button>
          <button type="button" className={step === 2 ? "is-on" : ""} onClick={goNext}>
            {copy.playersTitle}
          </button>
        </div>
        <div className="form-grid">
        {step === 1 ? (
          <>
        <label className={showRequired && needName ? "field span-2 is-invalid" : "field span-2"}>
          <span>{copy.gameName}</span>
          <input value={name} maxLength={50} aria-invalid={showRequired && needName ? true : undefined} placeholder={copy.gameNamePlaceholder} onChange={(event) => setName(event.target.value)} />
          {showRequired && needName ? <small className="field-error">{copy.requiredField}</small> : null}
        </label>

        {settingFields}

        {showPlayoffs ? (
          <label className="check-row span-2">
            <input type="checkbox" checked={playoffs} onChange={(event) => setPlayoffs(event.target.checked)} />
            <span>
              <strong>{copy.playoffs}</strong>
              <small>{copy.playoffsHint}</small>
            </span>
          </label>
        ) : null}

        <div className="form-actions span-2 step-next">
          <button className="button button-primary" type="submit">
            <span>{copy.nextStep}</span>
            <ArrowRightIcon />
          </button>
        </div>
          </>
        ) : (
          <>
        <div className="field span-2 players-field">
          <div className="players-head">
            <span>{copy.playersTitle}</span>
            {players.length > 0 ? <span className="count-pill">{players.length}</span> : null}
          </div>
          <div className="player-add">
            <input
              value={playerName}
              maxLength={30}
              placeholder={copy.playerPlaceholder}
              aria-label={copy.playersTitle}
              onChange={(event) => setPlayerName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  addName();
                }
              }}
            />
            {gendered ? (
              <div className="segmented gender-toggle" role="group" aria-label={copy.mixed}>
                <button type="button" className={playerGender === "m" ? "is-on" : ""} onClick={() => setPlayerGender("m")}>
                  {copy.male}
                </button>
                <button type="button" className={playerGender === "f" ? "is-on" : ""} onClick={() => setPlayerGender("f")}>
                  {copy.female}
                </button>
              </div>
            ) : null}
            <button className="button button-primary" type="button" disabled={!playerName.trim()} onClick={addName}>
              {copy.addPlayer}
            </button>
          </div>
          {players.length > 0 ? (
            <ol className="player-list">
              {players.map((player, index) => (
                <li key={`${player.name}-${index}`}>
                  <span className="player-index">{index + 1}</span>
                  <span className="player-name">{player.name}</span>
                  {clubMode ? (
                    <input
                      className="player-club"
                      maxLength={24}
                      value={player.club || ""}
                      placeholder={copy.club}
                      aria-label={copy.club}
                      onChange={(event) => setPlayers((current) => current.map((item, itemIndex) => (itemIndex === index ? { ...item, club: event.target.value } : item)))}
                    />
                  ) : null}
                  {gendered ? (
                    <span className="gender-toggle">
                      <button type="button" className={player.gender === "f" ? "" : "is-on"} onClick={() => setPlayers((current) => current.map((item, itemIndex) => (itemIndex === index ? { ...item, gender: "m" } : item)))}>
                        {copy.male}
                      </button>
                      <button type="button" className={player.gender === "f" ? "is-on" : ""} onClick={() => setPlayers((current) => current.map((item, itemIndex) => (itemIndex === index ? { ...item, gender: "f" } : item)))}>
                        {copy.female}
                      </button>
                    </span>
                  ) : null}
                  <button
                    type="button"
                    className="player-remove"
                    aria-label={fill(copy.removePlayer, { name: player.name })}
                    onClick={() => setPlayers((current) => current.filter((_, item) => item !== index))}
                  >
                    ×
                  </button>
                </li>
              ))}
            </ol>
          ) : null}
          {clubMode ? <p className="hint">{copy.clubHint}</p> : null}
          {error ? <small className="field-error">{error}</small> : null}
          {pairs.length > 0 ? (
            <p className="hint">{pairs.map((pair) => (pair.length === 2 ? pair.join(" & ") : `${pair[0]} · ${copy.waitingPartner}`)).join("  ·  ")}</p>
          ) : null}
        </div>

        {showExtras && gameType !== "knockout" ? (
          <>
            <label className="field">
              <span>{copy.sitOutPoints}</span>
              <input inputMode="numeric" value={sitOut} placeholder={copy.bonusPlaceholder} onChange={(event) => setSitOut(limitCount(event.target.value, 99))} />
            </label>
            <div className="field">
              <span>{copy.roundTimer}</span>
              <div className="segmented timer-toggle" role="group" aria-label={copy.roundTimer}>
                <button
                  type="button"
                  className={timerOn ? "" : "is-on"}
                  aria-pressed={!timerOn}
                  onClick={() => {
                    setTimerOn(false);
                    setRoundMinutes("");
                  }}
                >
                  {copy.timerOff}
                </button>
                <button type="button" className={timerOn ? "is-on" : ""} aria-pressed={timerOn} onClick={() => setTimerOn(true)}>
                  {copy.timerOn}
                </button>
              </div>
              {timerOn ? (
                <input inputMode="numeric" value={roundMinutes} placeholder={copy.minutesPlaceholder} aria-label={copy.minutesPlaceholder} onChange={(event) => setRoundMinutes(limitCount(event.target.value, 180))} />
              ) : null}
            </div>
            <label className="field">
              <span>{copy.winBonus}</span>
              <input inputMode="numeric" value={winBonus} placeholder={copy.bonusPlaceholder} onChange={(event) => setWinBonus(limitCount(event.target.value, 99))} />
            </label>
            <label className="field">
              <span>{copy.drawBonus}</span>
              <input inputMode="numeric" value={drawBonus} placeholder={copy.bonusPlaceholder} onChange={(event) => setDrawBonus(limitCount(event.target.value, 99))} />
            </label>
            <label className="field">
              <span>{copy.lossBonus}</span>
              <input inputMode="numeric" value={lossBonus} placeholder={copy.bonusPlaceholder} onChange={(event) => setLossBonus(limitCount(event.target.value, 99))} />
            </label>
          </>
        ) : null}

        <div className="form-actions span-2">
          <button className="button button-ghost" type="button" onClick={() => { setError(""); setStep(1); }}>
            {copy.back}
          </button>
          <button className="button button-ghost" type="button" onClick={showPreview}>
            {copy.preview}
          </button>
          <button className="button button-primary" type="submit">
            {copy.startGame}
          </button>
        </div>
        {preview ? (
          <div className="preview span-2">
            <p>{fill(copy.previewSummary, { players: preview.players.length, rounds: preview.rounds.length })}</p>
            <ol>
              {preview.rounds.map((round, index) => (
                <li key={round.id}>
                  <b>{fill(copy.roundLabel, { n: index + 1 })}</b>
                  {round.pending || round.matches.length === 0 ? (
                    <span>{copy.previewLater}</span>
                  ) : (
                    <span>
                      {round.matches
                        .map((match) => `${sideLabel(preview, match.sideA)} vs ${sideLabel(preview, match.sideB)}`)
                        .join(" · ")}
                      {round.byes.length ? ` · ${round.byes.map((id) => preview.players.find((player) => player.id === id)?.name).filter(Boolean).join(", ")}` : ""}
                    </span>
                  )}
                </li>
              ))}
            </ol>
            <table className="standings">
              <thead>
                <tr>
                  <th>{copy.playersTitle}</th>
                  <th>{copy.previewMatches}</th>
                  <th>{copy.previewSits}</th>
                </tr>
              </thead>
              <tbody>
                {scheduleBalance(preview).map((row) => (
                  <tr key={row.id}>
                    <td>{row.name}</td>
                    <td>{row.matches}</td>
                    <td>{row.sits}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
          </>
        )}
        </div>
      </form>
      <SiteFooter copy={copy} />
    </main>
  );
}

export function SessionBoard({ session, copy, lang, onLang, onHome, onSignOut, readOnly = false }) {
  const [playerName, setPlayerName] = useState("");
  const [playerGender, setPlayerGender] = useState("m");
  const [panel, setPanel] = useState(null);
  const [menuView, setMenuView] = useState("main");
  const [roundIndex, setRoundIndex] = useState(0);
  const [picker, setPicker] = useState(null);
  const [boardOpen, setBoardOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [toast, setToast] = useState(null);
  const [pointDraft, setPointDraft] = useState(null);
  const rows = standings(session);
  const sheet = resultSheet(session);
  const typeTitle = copy.gameTypes.find((option) => option.id === (session.system || "match"))?.title;
  const setsMode = session.result === "sets";
  const pointMode = !setsMode && (isSocial(session) || session.scoring === "rally" || session.result === "points");
  const ended = session.status === "finished";
  const locked = ended || readOnly;
  const unit = setsMode ? copy.setsWord : pointMode ? copy.points : copy.gamesWord;
  const shownRound = Math.min(roundIndex, Math.max(0, session.rounds.length - 1));
  const round = session.rounds[shownRound] || null;
  const nextRound = session.rounds[shownRound + 1] || null;
  const title = session.name || copy.untitledGame;

  function chooseScore(roundId, match, side, value) {
    if (locked) {
      return;
    }
    const cap = pointMode ? session.pointsPerRound : null;
    const scoreA = cap ? (side === "A" ? value : cap - value) : side === "A" ? value : match.scoreA;
    const scoreB = cap ? (side === "B" ? value : cap - value) : side === "B" ? value : match.scoreB;
    saveSession(setMatchScore(session, roundId, match.id, scoreA, scoreB));
    setPicker(null);
  }

  useEffect(() => {
    setPicker(null);
  }, [roundIndex]);

  useEffect(() => {
    if (!toast) {
      return;
    }
    const timer = window.setTimeout(() => setToast(null), 2800);
    return () => window.clearTimeout(timer);
  }, [toast]);

  function showToast(text) {
    setPanel(null);
    setToast({ id: Date.now(), text });
  }

  useEffect(() => {
    if (!panel && !boardOpen && !picker) {
      return;
    }
    function onKey(event) {
      if (event.key !== "Escape") {
        return;
      }
      if (picker) {
        setPicker(null);
        return;
      }
      if (boardOpen) {
        if (detailOpen) {
          setDetailOpen(false);
          return;
        }
        setBoardOpen(false);
        return;
      }
      setPanel(null);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [panel, boardOpen, detailOpen, picker]);

  async function shareMatch() {
    if (!isCloudEnabled()) {
      showToast(copy.cloudOff);
      return;
    }
    const account = getAccountSnapshot();
    const owns = account && (!session.ownerId || session.ownerId === account.uid);
    if (!session.ownerId && !account) {
      showToast(copy.needAccount);
      return;
    }
    if (owns) {
      try {
        await publishSession(session, account.uid);
      } catch {
        showToast(copy.signInFailed);
        return;
      }
    }
    const url = `${window.location.origin}/m/${session.id}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: "HitungSkorPadel", text: title, url });
        return;
      }
    } catch (error) {
      if (error?.name === "AbortError") {
        return;
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      showToast(copy.linkCopied);
    } catch {
      showToast(url);
    }
  }

  function addName(event) {
    event.preventDefault();
    const next = addPlayer(session, playerName, session.pairing === "gender" ? playerGender : "");
    if (next === session) {
      return;
    }
    saveSession(next);
    setPlayerName("");
  }

  return (
    <main className="setup session">
      <SiteHeader label={copy.home} onHome={onHome} />
      <header className="setup-bar session-bar">
        <button className="icon-button" type="button" aria-label={copy.back} onClick={onHome}>
          <svg viewBox="0 0 24 24" aria-hidden="true" width="22" height="22">
            <path d="M14.5 6.5 9 12l5.5 5.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <div className="session-title">
          <strong>{title}</strong>
          <p className="session-meta">
            <span className="session-type">{typeTitle}</span>
            <span aria-label={fill(copy.playerCount, { n: session.players.length })} title={fill(copy.playerCount, { n: session.players.length })}>
              <PlayersIcon />
              <b>{session.players.length}</b>
            </span>
            {session.pointsPerRound ? (
              <span aria-label={fill(copy.pointsTarget, { n: session.pointsPerRound })} title={fill(copy.pointsTarget, { n: session.pointsPerRound })}>
                <TargetIcon />
                <b>{session.pointsPerRound}</b>
              </span>
            ) : null}
          </p>
        </div>
        <div className="bar-actions">
          <button className="trophy-button" type="button" aria-label={copy.standings} onClick={() => setBoardOpen(true)}>
            <TrophyIcon />
          </button>
          <button className="icon-button" type="button" aria-label={copy.menu} aria-expanded={panel === "menu"} onClick={() => { setMenuView("main"); setPanel(panel === "menu" ? null : "menu"); }}>
            <DotsIcon />
          </button>
          {panel === "menu" ? (
            <div className="menu-pop" role="menu">
              {menuView === "edit" ? (
                <>
                  <button type="button" className="menu-back" onClick={() => setMenuView("main")}>
                    <MenuGlyph name="back" />
                    <span>{copy.editGame}</span>
                  </button>
                  {pointMode ? (
                    <button
                      type="button"
                      disabled={locked}
                      onClick={() => {
                        setPointDraft({
                          sitOut: session.sitOutPoints ? String(session.sitOutPoints) : "",
                          win: session.winBonus ? String(session.winBonus) : "",
                          draw: session.drawBonus ? String(session.drawBonus) : "",
                          loss: session.lossBonus ? String(session.lossBonus) : "",
                        });
                        setPanel("points");
                      }}
                    >
                      <MenuGlyph name="points" />
                      <span>{copy.resultPoints}</span>
                    </button>
                  ) : null}
                  <button type="button" disabled={locked} onClick={() => setPanel("add")}>
                    <MenuGlyph name="add" />
                    <span>{copy.addPlayerTitle}</span>
                  </button>
                  <button type="button" disabled={locked} onClick={() => setPanel("stop")}>
                    <MenuGlyph name="stop" />
                    <span>{copy.playerStop}</span>
                  </button>
                  <button type="button" disabled={readOnly} onClick={() => setPanel("rematch")}>
                    <MenuGlyph name="rematch" />
                    <span>{copy.rematch}</span>
                  </button>
                </>
              ) : (
                <>
                  <button type="button" onClick={shareMatch}>
                    <MenuGlyph name="share" />
                    <span>{copy.shareMatch}</span>
                  </button>
                  <button type="button" onClick={() => setMenuView("edit")}>
                    <MenuGlyph name="edit" />
                    <span>{copy.editGame}</span>
                    <MenuGlyph name="chevron" />
                  </button>
                  <button
                    type="button"
                    disabled={locked}
                    onClick={() => {
                      setPanel(null);
                      if (hasScoreGap(session)) {
                        showToast(copy.remixGap);
                        return;
                      }
                      const mixed = remixRemaining(session);
                      if (mixed === session) {
                        showToast(copy.remixNone);
                        return;
                      }
                      saveSession(mixed);
                      showToast(copy.remixDone);
                    }}
                  >
                    <MenuGlyph name="shuffle" />
                    <span>{copy.remixRemaining}</span>
                  </button>
                  <button className="is-end" type="button" disabled={locked} onClick={() => setPanel("end")}>
                    <MenuGlyph name="end" />
                    <span>{copy.endSession}</span>
                  </button>
                  {onSignOut ? (
                    <button type="button" onClick={onSignOut}>
                      <MenuGlyph name="out" />
                      <span>{copy.signOut}</span>
                    </button>
                  ) : null}
                </>
              )}
            </div>
          ) : null}
        </div>
      </header>
      {ended ? <p className="view-note">{copy.matchEnded}</p> : null}
      {readOnly ? <p className="view-note">{copy.viewOnly}</p> : null}
      {toast ? (
        <p key={toast.id} className="toast" role="status" aria-live="polite">
          {toast.text}
        </p>
      ) : null}

      <div className="stage-tools">
      <div className="round-rail" role="tablist" aria-label={copy.roundsLabel}>
        {session.rounds.length > 5 && Math.floor(shownRound / 5) > 0 ? (
          <button className="round-shift" type="button" aria-label={copy.back} onClick={() => setRoundIndex((Math.floor(shownRound / 5) - 1) * 5)}>
            ‹
          </button>
        ) : null}
        {session.rounds.slice(Math.floor(shownRound / 5) * 5, Math.floor(shownRound / 5) * 5 + 5).map((item, offset) => {
          const index = Math.floor(shownRound / 5) * 5 + offset;
          const done = !item.pending && item.matches.length > 0 && item.matches.every(isComplete);
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={index === shownRound}
              aria-label={`${fill(copy.roundLabel, { n: index + 1 })}, ${done ? copy.filled : copy.notFilled}`}
              className={["round-tab", done ? "is-done" : "", index === shownRound ? "is-on" : ""].filter(Boolean).join(" ")}
              onClick={() => setRoundIndex(index)}
            >
              {index + 1}
            </button>
          );
        })}
        {session.rounds.length > 5 && Math.floor(shownRound / 5) < Math.ceil(session.rounds.length / 5) - 1 ? (
          <button className="round-shift" type="button" aria-label={fill(copy.roundLabel, { n: (Math.floor(shownRound / 5) + 1) * 5 + 1 })} onClick={() => setRoundIndex((Math.floor(shownRound / 5) + 1) * 5)}>
            ›
          </button>
        ) : null}
        {!locked && session.system !== "knockout" && session.rounds.length < 100 ? (
          <button
            className="round-shift round-add"
            type="button"
            aria-label={copy.addRound}
            onClick={() => {
              const next = addRounds(session, 1);
              saveSession(next);
              setRoundIndex(next.rounds.length - 1);
            }}
          >
            +
          </button>
        ) : null}
      </div>
      </div>

      {round ? (
        <section className="round-card round-stage">
          <div className="round-center">
            <h2>{fill(copy.roundLabel, { n: shownRound + 1 })}</h2>
            {round.matches.length <= 1 && session.courtNames?.length ? <p className="court-name">{session.courtNames[0] || fill(copy.courtName, { n: 1 })}</p> : null}
            {session.roundMinutes ? <RoundTimer minutes={session.roundMinutes} startLabel={copy.startTimer} doneLabel={copy.timeUp} /> : null}
          </div>
          {round.pending || round.matches.length === 0 ? (
            <p className="hint">{round.pending ? copy.waitingRound : copy.noCourt}</p>
          ) : (
            round.matches.map((match, matchIndex) => {
              const leftNames = match.sideA.map((id) => session.players.find((player) => player.id === id)?.name).filter(Boolean);
              const rightNames = match.sideB.map((id) => session.players.find((player) => player.id === id)?.name).filter(Boolean);
              const shown = (value) => (typeof value === "number" ? value : "–");
              const court = round.matches.length > 1 ? session.courtNames?.[matchIndex] || (session.courtNames?.length ? fill(copy.courtName, { n: matchIndex + 1 }) : "") : "";
              return (
                <div key={match.id}>
                  {court ? <p className="court-name">{court}</p> : null}
                  <div className="pair-board">
                  <button className={picker?.matchId === match.id && picker.side === "A" ? "pair-side is-picking" : "pair-side"} type="button" disabled={locked} aria-label={fill(copy.scoreFor, { name: leftNames.join(" & ") })} onClick={() => setPicker((current) => (current?.matchId === match.id && current.side === "A" ? null : { roundId: round.id, matchId: match.id, side: "A" }))}>
                    <span className="pair-names">
                      {leftNames.map((name) => (
                        <b key={name}>{name}</b>
                      ))}
                    </span>
                    <strong>{shown(match.scoreA)}</strong>
                  </button>
                  <span className="dash">–</span>
                  <button className={picker?.matchId === match.id && picker.side === "B" ? "pair-side is-picking" : "pair-side"} type="button" disabled={locked} aria-label={fill(copy.scoreFor, { name: rightNames.join(" & ") })} onClick={() => setPicker((current) => (current?.matchId === match.id && current.side === "B" ? null : { roundId: round.id, matchId: match.id, side: "B" }))}>
                    <span className="pair-names">
                      {rightNames.map((name) => (
                        <b key={name}>{name}</b>
                      ))}
                    </span>
                    <strong>{shown(match.scoreB)}</strong>
                  </button>
                  </div>
                  {picker?.matchId === match.id ? (
                    <div className="picker picker-inline" role="dialog" aria-label={copy.scorePick}>
                      <p>{copy.scorePick}</p>
                      <div className="picker-grid">
                        {(pointMode && session.pointsPerRound ? Array.from({ length: session.pointsPerRound + 1 }, (_, value) => value) : setsMode ? [0, 1, 2, 3] : Array.from({ length: 8 }, (_, value) => value)).map((value) => {
                          const current = picker.side === "A" ? match.scoreA : match.scoreB;
                          return (
                            <button key={value} type="button" className={current === value ? "is-on" : ""} onClick={() => chooseScore(picker.roundId, match, picker.side, value)}>
                              {value}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ) : null}
                </div>
              );
            })
          )}
          {nextRound?.pending ? (
            <p className="bye-line">{copy.previewLater}</p>
          ) : nextRound?.matches?.length ? (
            <p className="bye-line">
              {copy.nextPlay}: {nextRound.matches.map((match) => `${sideLabel(session, match.sideA)} vs ${sideLabel(session, match.sideB)}`).join(" · ")}
            </p>
          ) : null}
        </section>
      ) : null}
      {nextRound && !locked && round?.matches.length > 0 && !round.pending ? (
        <div className="round-actions">
          <button className="button button-primary round-next" type="button" onClick={() => setRoundIndex(shownRound + 1)}>
            <span>{copy.nextRound}</span>
            <ArrowRightIcon />
          </button>
        </div>
      ) : null}

      {boardOpen ? (
        <div
          className="picker-wrap"
          role="presentation"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              setBoardOpen(false);
              setDetailOpen(false);
            }
          }}
        >
          <div className={detailOpen ? "board-sheet is-detail" : "board-sheet"} role="dialog" aria-modal="true" aria-label={detailOpen ? copy.detailView : copy.standings}>
            <div className="board-sheet-head">
              {detailOpen ? (
                <button className="icon-button sheet-close" type="button" aria-label={copy.back} onClick={() => setDetailOpen(false)}>
                  <svg viewBox="0 0 24 24" aria-hidden="true" width="18" height="18">
                    <path d="M14 6 8 12l6 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              ) : (
                <span className="trophy-mark">
                  <TrophyIcon />
                </span>
              )}
              <div>
                <h2>{detailOpen ? copy.detailView : copy.standings}</h2>
                <p>{title}</p>
              </div>
              <button className="icon-button sheet-close" type="button" aria-label={copy.close} onClick={() => { setBoardOpen(false); setDetailOpen(false); }}>
                <svg viewBox="0 0 24 24" aria-hidden="true" width="18" height="18">
                  <path d="M6 6l12 12M18 6 6 18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </button>
            </div>
            <p className="board-legend">
              <span><b className="is-win">{copy.winShort}</b> {copy.winWord}</span>
              <span><b>{copy.drawShort}</b> {copy.drawWord}</span>
              <span><b className="is-loss">{copy.lossShort}</b> {copy.lossWord}</span>
            </p>
            {detailOpen ? (
              <>
                <section className="board-block">
                  <h3>{copy.everyMatch}</h3>
                  <div className="board-scroll">
                  <table className="board-table board-match">
                    <thead>
                      <tr>
                        <th>{copy.roundWord}</th>
                        <th>{copy.sideA}</th>
                        <th>{copy.scoreWord}</th>
                        <th>{copy.sideB}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sheet.matches.map((match) => (
                        <tr key={match.key}>
                          <td>{match.round}</td>
                          <td>{match.sideA}</td>
                          <td className="board-score">
                            {match.done ? (
                              <>
                                <b className={match.scoreA > match.scoreB ? "is-win" : match.scoreA < match.scoreB ? "is-loss" : ""}>{match.scoreA}</b>
                                <span>–</span>
                                <b className={match.scoreB > match.scoreA ? "is-win" : match.scoreB < match.scoreA ? "is-loss" : ""}>{match.scoreB}</b>
                              </>
                            ) : (
                              "–"
                            )}
                          </td>
                          <td>{match.sideB}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  </div>
                </section>
                <section className="board-block">
                  <h3>{copy.playerBreakdown}</h3>
                  <div className="board-scroll">
                  <table className="board-table board-matrix">
                    <thead>
                      <tr>
                        <th>{copy.playersTitle}</th>
                        {session.rounds.map((round, index) => (
                          <th key={round.id || index}>{index + 1}</th>
                        ))}
                        <th>{unit}</th>
                        <th>{copy.winShort}</th>
                        <th>{copy.drawShort}</th>
                        <th>{copy.lossShort}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row) => {
                        const record = sheet.rows.get(row.id);
                        return (
                          <tr key={row.id}>
                            <th>{row.name}</th>
                            {record.cells.map((cell, index) => (
                              <td key={index} className={cell ? `is-${cell.result}` : ""}>
                                {cell ? (cell.result === "sit" && cell.points === 0 ? "–" : cell.points) : ""}
                              </td>
                            ))}
                            <td>{row.points}</td>
                            <td>{record.wins}</td>
                            <td>{record.draws}</td>
                            <td>{record.losses}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  </div>
                </section>
              </>
            ) : (
              <>
                <ol>
                  {rows.map((row) => {
                    const record = sheet.rows.get(row.id) || { wins: 0, draws: 0, losses: 0 };
                    return (
                      <li key={row.id} className={row.rank === 1 && row.points > 0 ? "is-lead" : ""}>
                        <div className="board-row">
                          <span className={row.points > 0 ? `place place-${Math.min(row.rank, 4)}` : "place"}>{row.rank}</span>
                          <b>{row.name}</b>
                          <strong>{row.points}</strong>
                          <span className="board-record" aria-label={fill(copy.recordLabel, { w: record.wins, d: record.draws, l: record.losses })}>
                            <span className="is-win"><b>{record.wins}</b><small>{copy.winShort}</small></span>
                            <span><b>{record.draws}</b><small>{copy.drawShort}</small></span>
                            <span className="is-loss"><b>{record.losses}</b><small>{copy.lossShort}</small></span>
                          </span>
                        </div>
                      </li>
                    );
                  })}
                </ol>
                <button className="button button-ghost board-more" type="button" onClick={() => setDetailOpen(true)}>
                  {copy.detailView}
                </button>
              </>
            )}
          </div>
        </div>
      ) : null}

      {panel === "menu" ? <div className="menu-pop-wrap" role="presentation" onClick={() => setPanel(null)} /> : null}

      {panel && panel !== "menu" ? (
        <div
          className="drawer-wrap"
          role="presentation"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              setPanel(null);
            }
          }}
        >
          <div className="drawer" role="dialog" aria-modal="true" aria-labelledby="session-menu-title">
            <div className="section-head">
              <h2 id="session-menu-title">
                {panel === "standings"
                  ? copy.standings
                  : panel === "points"
                    ? copy.resultPoints
                    : panel === "add"
                    ? copy.addPlayerTitle
                    : panel === "stop"
                      ? copy.playerStop
                      : panel === "rematch"
                        ? copy.rematchTitle
                        : panel === "end"
                          ? copy.endSessionTitle
                          : copy.menu}
              </h2>
              <button className="text-button" type="button" onClick={() => setPanel(panel === "menu" ? null : "menu")}>
                {panel === "menu" ? copy.close : copy.back}
              </button>
            </div>

            {panel === "standings" ? (
              <table className="standings">
                <thead>
                  <tr>
                    <th>{copy.rank}</th>
                    <th>{copy.playersTitle}</th>
                    <th>{unit}</th>
                    <th>{copy.played}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.id}>
                      <td>{row.rank}</td>
                      <td>{row.name}</td>
                      <td>{row.points}</td>
                      <td>{row.played}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : null}

            {panel === "points" && pointDraft ? (
              <form
                className="points-fields"
                onSubmit={(event) => {
                  event.preventDefault();
                  setPanel(null);
                }}
              >
                <p className="muted-dark">{copy.resultPointsHint}</p>
                {[
                  ["sitOut", copy.sitOutPoints],
                  ["win", copy.winBonus],
                  ["draw", copy.drawBonus],
                  ["loss", copy.lossBonus],
                ].map(([key, label]) => (
                  <label className="field" key={key}>
                    <span>{label}</span>
                    <input
                      inputMode="numeric"
                      value={pointDraft[key]}
                      placeholder={copy.bonusPlaceholder}
                      aria-label={label}
                      onChange={(event) => {
                        const next = { ...pointDraft, [key]: limitCount(event.target.value, 99) };
                        setPointDraft(next);
                        saveSession(setResultPoints(session, {
                          sitOutPoints: next.sitOut,
                          winBonus: next.win,
                          drawBonus: next.draw,
                          lossBonus: next.loss,
                        }));
                      }}
                    />
                  </label>
                ))}
              </form>
            ) : null}

            {panel === "add" ? (
              <form className="drawer-add" onSubmit={addName}>
                <p className="muted-dark">{copy.addPlayerHint}</p>
                <input value={playerName} maxLength={30} placeholder={copy.playerPlaceholder} aria-label={copy.playersTitle} onChange={(event) => setPlayerName(event.target.value)} />
                {session.pairing === "gender" ? (
                  <div className="segmented gender-toggle" role="group" aria-label={copy.mixed}>
                    <button type="button" className={playerGender === "m" ? "is-on" : ""} onClick={() => setPlayerGender("m")}>
                      {copy.male}
                    </button>
                    <button type="button" className={playerGender === "f" ? "is-on" : ""} onClick={() => setPlayerGender("f")}>
                      {copy.female}
                    </button>
                  </div>
                ) : null}
                <button className="button button-primary" type="submit" disabled={!playerName.trim()}>
                  {copy.addPlayer}
                </button>
                {session.players.length > 0 ? (
                  <ul className="drawer-list">
                    {session.players.map((player, index) => (
                      <li key={player.id}>
                        <span><b>{index + 1}</b>{player.name}</span>
                        {player.stopped ? <b className="is-stopped">{copy.stopped}</b> : null}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </form>
            ) : null}

            {panel === "stop" ? (
              <ul className="drawer-list">
                {session.players.map((player) => (
                  <li key={player.id}>
                    <span>{player.name}</span>
                    {player.stopped ? (
                      <b>{copy.stopped}</b>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          saveSession(stopPlayer(session, player.id));
                        }}
                      >
                        {copy.stop}
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            ) : null}

            {panel === "rematch" ? (
              <>
                <p className="muted-dark">{copy.rematchBody}</p>
                <div className="sheet-actions">
                  <button className="button button-ghost" type="button" onClick={() => setPanel("menu")}>
                    {copy.back}
                  </button>
                  <button
                    className="button button-primary"
                    type="button"
                    onClick={() => {
                      saveSession(rematchSession(session));
                      setRoundIndex(0);
                      setPanel(null);
                    }}
                  >
                    {copy.rematch}
                  </button>
                </div>
              </>
            ) : null}

            {panel === "end" ? (
              <>
                <p className="muted-dark">{copy.endSessionBody}</p>
                <div className="sheet-actions">
                  <button className="button button-ghost" type="button" onClick={() => setPanel("menu")}>
                    {copy.keepPlaying}
                  </button>
                  <button
                    className="button button-primary"
                    type="button"
                    onClick={() => {
                      saveSession(endSession(session));
                      setPanel(null);
                      onHome();
                    }}
                  >
                    {copy.endSession}
                  </button>
                </div>
              </>
            ) : null}
          </div>
        </div>
      ) : null}
      <SiteFooter copy={copy} />
    </main>
  );
}
