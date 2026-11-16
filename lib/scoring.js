const POINT_LABELS = ["0", "15", "30", "40"];

function newId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `laga-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function teamName(value, fallback) {
  const name = String(value || "").trim().slice(0, 24);
  return name || fallback;
}

export function createMatch(options = {}) {
  const bestOf = options.bestOf === 1 ? 1 : 3;
  const server = options.server === 1 ? 1 : 0;

  return {
    id: options.id || newId(),
    createdAt: new Date().toISOString(),
    teams: [teamName(options.teams?.[0], "Us"), teamName(options.teams?.[1], "Them")],
    rules: {
      deuce: ["golden", "advantage", "star", "silver"].includes(options.deuce) ? options.deuce : "golden",
      bestOf,
      gamesPerSet: options.gamesPerSet === 4 ? 4 : 6,
      superTiebreak: Boolean(options.superTiebreak) && bestOf === 3,
    },
    sets: [],
    games: [0, 0],
    points: [0, 0],
    advantage: null,
    deuceCount: 0,
    phase: "game",
    tiebreak: [0, 0],
    server,
    tiebreakFirstServer: null,
    status: "playing",
    winner: null,
    finishedAt: null,
  };
}

function cloneMatch(match) {
  return {
    ...match,
    teams: [...match.teams],
    rules: { ...match.rules },
    sets: match.sets.map((set) => ({
      ...set,
      detail: set.detail ? [...set.detail] : null,
    })),
    games: [...match.games],
    points: [...match.points],
    tiebreak: [...match.tiebreak],
  };
}

export function scorePoint(match, team) {
  if (match.status !== "playing" || (team !== 0 && team !== 1)) {
    return match;
  }

  const next = cloneMatch(match);
  if (next.phase === "game") {
    scoreGamePoint(next, team);
  } else {
    scoreTiebreakPoint(next, team);
  }
  return next;
}

function scoreGamePoint(match, team) {
  const opponent = 1 - team;
  const inDeuce = match.points[0] >= 3 && match.points[1] >= 3;

  if (!inDeuce) {
    if (match.points[team] < 3) {
      match.points[team] += 1;
      if (match.points[0] >= 3 && match.points[1] >= 3) {
        match.deuceCount = 1;
      }
      return;
    }
    winGame(match, team);
    return;
  }

  const decidingPoint =
    match.rules.deuce === "golden" ||
    (match.rules.deuce === "star" && match.deuceCount >= 3) ||
    (match.rules.deuce === "silver" && match.deuceCount >= 2);

  if (decidingPoint || match.advantage === team) {
    winGame(match, team);
    return;
  }

  if (match.advantage === opponent) {
    match.advantage = null;
    match.deuceCount += 1;
    return;
  }

  match.advantage = team;
}

function winGame(match, team) {
  match.games[team] += 1;
  match.points = [0, 0];
  match.advantage = null;
  match.deuceCount = 0;
  match.server = 1 - match.server;

  const target = match.rules.gamesPerSet;
  const [left, right] = match.games;
  const difference = Math.abs(left - right);

  if (Math.max(left, right) >= target && difference >= 2) {
    closeSet(match, team, false);
    return;
  }

  if (left === target && right === target) {
    match.phase = "tiebreak";
    match.tiebreak = [0, 0];
    match.tiebreakFirstServer = match.server;
  }
}

function scoreTiebreakPoint(match, team) {
  match.tiebreak[team] += 1;
  const target = match.phase === "super" ? 10 : 7;
  const [left, right] = match.tiebreak;
  const leader = left === right ? null : left > right ? 0 : 1;

  if (Math.max(left, right) >= target && Math.abs(left - right) >= 2 && leader === team) {
    closeSet(match, team, match.phase === "super");
  }
}

function closeSet(match, team, isSuper) {
  if (isSuper) {
    match.sets.push({
      left: match.tiebreak[0],
      right: match.tiebreak[1],
      super: true,
      detail: null,
    });
  } else if (match.phase === "tiebreak") {
    const games = [match.rules.gamesPerSet, match.rules.gamesPerSet];
    games[team] = match.rules.gamesPerSet + 1;
    match.sets.push({
      left: games[0],
      right: games[1],
      super: false,
      detail: [match.tiebreak[0], match.tiebreak[1]],
    });
    match.server = 1 - match.tiebreakFirstServer;
  } else {
    match.sets.push({
      left: match.games[0],
      right: match.games[1],
      super: false,
      detail: null,
    });
  }

  const won = setsWon(match);
  const needed = match.rules.bestOf === 1 ? 1 : 2;
  if (won[team] >= needed) {
    match.status = "finished";
    match.winner = team;
    match.finishedAt = new Date().toISOString();
    return;
  }

  const splitSets = won[0] === 1 && won[1] === 1;
  match.games = [0, 0];
  match.points = [0, 0];
  match.advantage = null;
  match.deuceCount = 0;
  match.tiebreak = [0, 0];

  if (splitSets && match.rules.superTiebreak) {
    match.phase = "super";
    match.tiebreakFirstServer = match.server;
    return;
  }

  match.phase = "game";
  match.tiebreakFirstServer = null;
}

export function currentServer(match) {
  if (match.phase === "game") {
    return match.server;
  }

  const start = match.tiebreakFirstServer ?? match.server;
  const total = match.tiebreak[0] + match.tiebreak[1];
  if (total === 0) {
    return start;
  }

  const block = Math.floor((total - 1) / 2);
  return block % 2 === 0 ? 1 - start : start;
}

export function setsWon(match) {
  return [0, 1].map((team) =>
    match.sets.filter((set) => (team === 0 ? set.left > set.right : set.right > set.left)).length,
  );
}

export function pointText(match, team) {
  if (match.phase !== "game") {
    return String(match.tiebreak[team]);
  }

  if (match.points[0] >= 3 && match.points[1] >= 3) {
    if (match.advantage === team) {
      return "AD";
    }
    return "40";
  }

  return POINT_LABELS[match.points[team]] ?? "0";
}

export function heroNumber(match, team) {
  if (match.status === "finished" && match.phase === "game") {
    return String(match.games[team]);
  }
  return pointText(match, team);
}

export function setLabel(set) {
  const main = `${set.left}–${set.right}`;
  if (set.detail) {
    return `${main} (${set.detail[0]}–${set.detail[1]})`;
  }
  return main;
}

export function scoreLine(sets) {
  if (!sets?.length) {
    return "";
  }
  return sets.map(setLabel).join(", ");
}

export function moment(previous, next) {
  if (!previous) {
    return null;
  }

  if (previous.status !== "finished" && next.status === "finished") {
    return { kind: "match", team: next.winner };
  }

  if (next.sets.length > previous.sets.length) {
    const set = next.sets[next.sets.length - 1];
    return {
      kind: "set",
      team: set.left > set.right ? 0 : 1,
      side: !set.super && (set.left + set.right) % 2 === 0,
    };
  }

  if (previous.phase === "game" && next.phase === "tiebreak") {
    return { kind: "tiebreak" };
  }

  if (previous.phase !== "super" && next.phase === "super") {
    return { kind: "super" };
  }

  const previousGames = previous.games[0] + previous.games[1];
  const nextGames = next.games[0] + next.games[1];
  if (next.phase === "game" && previous.phase === "game" && nextGames === previousGames + 1) {
    const team = next.games[0] > previous.games[0] ? 0 : 1;
    return { kind: "game", team, side: nextGames % 2 === 1 };
  }

  if (next.phase !== "game") {
    const total = next.tiebreak[0] + next.tiebreak[1];
    const previousTotal = previous.tiebreak[0] + previous.tiebreak[1];
    if (total !== previousTotal && total > 0 && total % 6 === 0) {
      return { kind: "side" };
    }
  }

  return null;
}
