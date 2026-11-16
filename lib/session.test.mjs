import assert from "node:assert/strict";
import test from "node:test";
import { addPlayer, addRounds, balancedRounds, createSession, endSession, hasScoreGap, normalizeRounds, rematchSession, remixRemaining, scheduleBalance, setMatchScore, setResultPoints, standings, stopPlayer } from "./session.js";

test("tennis scoring records sets and a tournament without a tennis system records points", () => {
  const tennis = createSession({ players: ["A", "B", "C", "D"], scoring: "golden" });
  assert.equal(tennis.scoring, "golden");
  assert.equal(tennis.result, "sets");
  assert.equal(tennis.pointsPerRound, null);
  const rally = createSession({ players: ["A", "B", "C", "D"], system: "americano" });
  assert.equal(rally.scoring, "rally");
  assert.equal(rally.result, "points");
  assert.equal(rally.pointsPerRound, 24);
  const mixed = createSession({ players: ["A", "B", "C", "D"], system: "mexicano", scoring: "advantage" });
  assert.equal(mixed.system, "mexicano");
  assert.equal(mixed.scoring, "advantage");
  assert.equal(mixed.result, "sets");
  assert.equal(mixed.pointsPerRound, null);
});

test("an empty round count defaults to 10", () => {
  assert.equal(normalizeRounds(""), 10);
  assert.equal(normalizeRounds(undefined), 10);
  const session = createSession({ players: ["A", "B", "C", "D"], format: "doubles", pairing: "mixed", rounds: "" });
  assert.equal(session.rounds.length, 10);
});

test("mixed doubles rotates partners and sits the extra player", () => {
  const session = createSession({ players: ["A", "B", "C", "D", "E"], format: "doubles", pairing: "mixed", rounds: 2 });
  assert.equal(session.rounds[0].matches.length, 1);
  assert.equal(session.rounds[0].byes.length, 1);
  assert.equal(session.rounds[0].matches[0].sideA.length, 2);
  const firstBye = session.rounds[0].byes[0];
  assert.notEqual(session.rounds[1].byes[0], firstBye);
});

test("fixed doubles keeps pairs and leaves one player waiting", () => {
  const session = createSession({ players: ["A", "B", "C", "D", "E"], format: "doubles", pairing: "fixed", rounds: 1 });
  assert.equal(session.teams.length, 2);
  assert.deepEqual(session.rounds[0].matches[0].sideA, session.teams[0].playerIds);
  assert.deepEqual(session.rounds[0].byes, [session.players[4].id]);
});

test("editing a score leaves every other match untouched", () => {
  const session = createSession({ players: ["A", "B", "C", "D"], format: "singles", pairing: "fixed", rounds: 2 });
  const target = session.rounds[0].matches[0];
  const other = session.rounds[0].matches[1];
  const next = setMatchScore(session, session.rounds[0].id, target.id, 6, 4);
  assert.deepEqual(next.rounds[0].matches[1], other);
  assert.deepEqual(
    next.rounds[0].matches.find((match) => match.id === target.id),
    { ...target, scoreA: 6, scoreB: 4 },
  );
  const edited = setMatchScore(next, session.rounds[0].id, target.id, 6, 2);
  assert.equal(edited.rounds[0].matches.find((match) => match.id === target.id).scoreB, 2);
});

test("adding a player keeps scored matches and remixes the rounds that have not started", () => {
  let session = createSession({ players: ["A", "B", "C", "D"], format: "doubles", pairing: "mixed", rounds: 3 });
  const scored = session.rounds[0].matches[0];
  session = setMatchScore(session, session.rounds[0].id, scored.id, 6, 3);
  const lockedRound = session.rounds[0];
  const openBefore = JSON.stringify(session.rounds[1]);
  session = addPlayer(session, "Eva");
  const added = session.players.find((player) => player.name === "Eva");

  assert.equal(session.rounds[0], lockedRound);
  assert.equal(session.rounds[0].matches[0].scoreA, 6);
  assert.equal(session.rounds[0].matches[0].scoreB, 3);
  assert.notEqual(JSON.stringify(session.rounds[1]), openBefore);
  const roundTwoIds = [...session.rounds[1].matches.flatMap((match) => [...match.sideA, ...match.sideB]), ...session.rounds[1].byes];
  assert.ok(roundTwoIds.includes(added.id));
  assert.equal(session.rounds.length, 3);
});

test("a partly scored round keeps the entered match and rebuilds only the open one", () => {
  let session = createSession({ players: ["A", "B", "C", "D", "E", "F", "G", "H"], format: "singles", pairing: "fixed", rounds: 1 });
  assert.equal(session.rounds[0].matches.length, 4);
  const kept = session.rounds[0].matches[0];
  session = setMatchScore(session, session.rounds[0].id, kept.id, 4, 1);
  session = addPlayer(session, "Iva");
  const same = session.rounds[0].matches.find((match) => match.id === kept.id);
  assert.deepEqual(same, { ...kept, scoreA: 4, scoreB: 1 });
  const busy = new Set([...same.sideA, ...same.sideB]);
  session.rounds[0].matches
    .filter((match) => match.id !== kept.id)
    .forEach((match) => {
      [...match.sideA, ...match.sideB].forEach((id) => assert.equal(busy.has(id), false));
    });
});

test("americano schedules every round up front and keeps an edited score", () => {
  let session = createSession({ players: ["A", "B", "C", "D"], system: "americano", pointsPerRound: 24, rounds: 2 });
  assert.equal(session.system, "americano");
  assert.equal(session.pointsPerRound, 24);
  assert.equal(session.rounds[0].matches.length, 1);
  assert.equal(session.rounds[1].pending, false);
  assert.equal(session.rounds[1].matches.length, 1);
  const first = session.rounds[0].matches[0].sideA.concat(session.rounds[0].matches[0].sideB).sort();
  const second = session.rounds[1].matches[0].sideA.concat(session.rounds[1].matches[0].sideB).sort();
  assert.deepEqual(first, second);
  assert.notDeepEqual(session.rounds[0].matches[0].sideA, session.rounds[1].matches[0].sideA);
  const kept = session.rounds[0];
  session = setMatchScore(session, kept.id, kept.matches[0].id, 16, 8);
  assert.equal(session.rounds[0].matches[0].scoreA, 16);
  assert.equal(session.rounds[1].matches[0].scoreA, null);
});

test("mexicano waits for a finished round, then pairs 1 with 3 against 2 with 4", () => {
  let session = createSession({ players: ["A", "B", "C", "D"], system: "mexicano", pointsPerRound: "", rounds: 3 });
  assert.equal(session.pointsPerRound, 24);
  assert.equal(session.rounds[0].matches.length, 1);
  assert.equal(session.rounds[1].pending, true);
  assert.equal(session.rounds[2].pending, true);
  const opener = session.rounds[0].matches[0];
  session = setMatchScore(session, session.rounds[0].id, opener.id, 16, 8);
  assert.equal(session.rounds[0].matches[0].scoreA, 16);
  assert.equal(session.rounds[0].matches[0].scoreB, 8);
  assert.equal(session.rounds[1].pending, false);
  const names = (ids) => ids.map((id) => session.players.find((player) => player.id === id).name);
  assert.deepEqual(names(session.rounds[1].matches[0].sideA), ["A", "B"]);
  assert.deepEqual(names(session.rounds[1].matches[0].sideB), ["C", "D"]);
  assert.equal(session.rounds[2].pending, true);

  session = setMatchScore(session, session.rounds[0].id, opener.id, 8, 16);
  assert.deepEqual(names(session.rounds[1].matches[0].sideA), ["B", "A"]);
  assert.deepEqual(names(session.rounds[1].matches[0].sideB), ["D", "C"]);
  assert.equal(session.rounds[0].matches[0].scoreA, 8);
});

test("adding a player to mexicano keeps the scored round and sits the new player", () => {
  let session = createSession({ players: ["A", "B", "C", "D"], system: "mexicano", rounds: 2 });
  const opener = session.rounds[0].matches[0];
  session = setMatchScore(session, session.rounds[0].id, opener.id, 16, 8);
  const locked = session.rounds[0];
  session = addPlayer(session, "Eva");
  assert.equal(session.rounds[0], locked);
  assert.equal(session.rounds[0].matches[0].scoreB, 8);
  const eva = session.players.find((player) => player.name === "Eva");
  assert.deepEqual(session.rounds[1].byes, [eva.id]);
  assert.equal(session.rounds[1].matches.length, 1);
});

test("stopping a player keeps the scored round and leaves them out of the rest", () => {
  let session = createSession({ players: ["A", "B", "C", "D"], format: "doubles", pairing: "mixed", rounds: 2 });
  const opener = session.rounds[0].matches[0];
  session = setMatchScore(session, session.rounds[0].id, opener.id, 6, 4);
  const locked = session.rounds[0];
  const stopped = session.players.find((player) => opener.sideA.includes(player.id));
  session = stopPlayer(session, stopped.id);
  assert.equal(session.rounds[0], locked);
  const later = [...session.rounds[1].matches.flatMap((match) => [...match.sideA, ...match.sideB]), ...session.rounds[1].byes];
  assert.equal(later.includes(stopped.id), false);
});

test("remixing the rest leaves a saved score in place", () => {
  let session = createSession({ players: ["A", "B", "C", "D"], format: "doubles", pairing: "mixed", rounds: 2 });
  session = setMatchScore(session, session.rounds[0].id, session.rounds[0].matches[0].id, 6, 2);
  const locked = session.rounds[0];
  session = remixRemaining(session);
  assert.equal(session.rounds[0], locked);
  assert.equal(session.rounds[1].matches[0].scoreA, null);
});

test("remixing the rest really changes the open matches and keeps sits even", () => {
  let session = createSession({ players: ["A", "B", "C", "D", "E", "F", "G"], system: "americano", courts: 1, rounds: 7 });
  session = setMatchScore(session, session.rounds[0].id, session.rounds[0].matches[0].id, 10, 6);
  const shape = (rounds) => JSON.stringify(rounds.map((round) => round.matches.map((match) => [[...match.sideA].sort(), [...match.sideB].sort()])));
  const next = remixRemaining(session);
  assert.notEqual(shape(next.rounds.slice(1)), shape(session.rounds.slice(1)));
  assert.equal(next.rounds[0], session.rounds[0]);
  assert.deepEqual(next.players.map((player) => player.name), ["A", "B", "C", "D", "E", "F", "G"]);
  const sits = new Map(next.players.map((player) => [player.id, 0]));
  next.rounds.forEach((round) => round.byes.forEach((id) => sits.set(id, sits.get(id) + 1)));
  const counts = [...sits.values()];
  assert.ok(Math.max(...counts) - Math.min(...counts) <= 1);
});

test("americano spreads partners instead of repeating the same pair", () => {
  for (const [count, courts, rounds] of [[5, 1, 10], [10, 2, 10], [16, 4, 12]]) {
    const session = createSession({ players: Array.from({ length: count }, (_, index) => `P${index}`), system: "americano", courts, rounds });
    const together = new Map();
    session.rounds.forEach((round) => round.matches.forEach((match) => {
      [match.sideA, match.sideB].forEach((side) => {
        const key = [...side].sort().join("|");
        together.set(key, (together.get(key) || 0) + 1);
      });
    }));
    assert.ok(Math.max(...together.values()) <= 2, `${count} players repeat a partner too often`);
  }
});

test("remixing a fully scored game changes nothing", () => {
  let session = createSession({ players: ["A", "B", "C", "D"], system: "americano", rounds: 1 });
  session = setMatchScore(session, session.rounds[0].id, session.rounds[0].matches[0].id, 10, 6);
  assert.equal(remixRemaining(session), session);
});

test("remix refuses a score left empty between rounds that already have points", () => {
  let session = createSession({ players: ["A", "B", "C", "D"], system: "americano", format: "doubles", pairing: "mixed", rounds: 3 });
  session = setMatchScore(session, session.rounds[0].id, session.rounds[0].matches[0].id, 10, 6);
  session = setMatchScore(session, session.rounds[2].id, session.rounds[2].matches[0].id, 9, 7);
  assert.equal(hasScoreGap(session), true);
  const next = remixRemaining(session);
  assert.equal(next, session);
  assert.equal(next.rounds[1].matches[0].scoreA, null);
  assert.equal(next.rounds[2].matches[0].scoreA, 9);
});

test("scores in order are not a gap, including a partial round at the end", () => {
  let session = createSession({ players: ["A", "B", "C", "D", "E", "F", "G", "H"], system: "americano", courts: 2, rounds: 2 });
  const [first, second] = session.rounds[0].matches;
  session = setMatchScore(session, session.rounds[0].id, first.id, 8, 4);
  assert.equal(hasScoreGap(session), false);
  session = setMatchScore(session, session.rounds[0].id, second.id, 7, 5);
  session = setMatchScore(session, session.rounds[1].id, session.rounds[1].matches[0].id, 6, 6);
  assert.equal(hasScoreGap(session), false);
});

test("a rematch keeps the players and clears the scores", () => {
  let session = createSession({ players: ["A", "B", "C", "D"], format: "doubles", pairing: "mixed", rounds: 2 });
  session = setMatchScore(session, session.rounds[0].id, session.rounds[0].matches[0].id, 6, 1);
  session = endSession(session);
  session = rematchSession(session);
  assert.equal(session.status, "playing");
  assert.equal(session.players.length, 4);
  assert.equal(session.rounds.length, 2);
  assert.equal(session.rounds[0].matches[0].scoreA, null);
});

test("a court limit sits everyone who does not fit", () => {
  const session = createSession({ players: ["A", "B", "C", "D", "E", "F", "G", "H"], system: "americano", courts: 1, rounds: 1 });
  assert.equal(session.rounds[0].matches.length, 1);
  assert.equal(session.rounds[0].byes.length, 4);
});

test("mixed americano puts one man and one woman on each side", () => {
  const session = createSession({
    players: [
      { name: "M1", gender: "m" },
      { name: "M2", gender: "m" },
      { name: "W1", gender: "f" },
      { name: "W2", gender: "f" },
    ],
    system: "americano",
    pairing: "gender",
    rounds: 2,
  });
  session.rounds.forEach((round) => {
    round.matches.forEach((match) => {
      [match.sideA, match.sideB].forEach((side) => {
        const genders = side.map((id) => session.players.find((player) => player.id === id).gender);
        assert.deepEqual(genders.sort(), ["f", "m"]);
      });
    });
  });
  assert.notDeepEqual(session.rounds[0].matches[0].sideA, session.rounds[1].matches[0].sideA);
});

test("king of the hill moves winners up and losers down", () => {
  let session = createSession({ players: ["A", "B", "C", "D", "E", "F", "G", "H"], system: "king", courts: 2, rounds: 2 });
  assert.equal(session.rounds[0].matches.length, 2);
  assert.equal(session.rounds[1].pending, true);
  const names = (ids) => ids.map((id) => session.players.find((player) => player.id === id).name);
  session.rounds[0].matches.forEach((match) => {
    session = setMatchScore(session, session.rounds[0].id, match.id, 24, 10);
  });
  assert.equal(session.rounds[1].pending, false);
  assert.deepEqual(names(session.rounds[1].matches[0].sideA), ["A", "B"]);
  assert.deepEqual(names(session.rounds[1].matches[0].sideB), ["E", "F"]);
  assert.deepEqual(names(session.rounds[1].matches[1].sideA), ["C", "D"]);
  assert.deepEqual(names(session.rounds[1].matches[1].sideB), ["G", "H"]);
});

test("beat the box waits for the first half, then reseeds the boxes", () => {
  let session = createSession({ players: ["A", "B", "C", "D", "E", "F", "G", "H"], system: "box", rounds: 2 });
  assert.equal(session.boxSplit, 1);
  assert.equal(session.rounds[0].matches.length, 2);
  assert.equal(session.rounds[1].pending, true);
  session.rounds[0].matches.forEach((match) => {
    session = setMatchScore(session, session.rounds[0].id, match.id, 16, 8);
  });
  assert.equal(session.rounds[1].pending, false);
  assert.equal(session.rounds[1].matches.length, 2);
});

test("knockout advances the winners and gives a bye to the extra team", () => {
  let session = createSession({ players: ["A", "B", "C", "D", "E", "F"], system: "knockout" });
  assert.equal(session.rounds.length, 2);
  assert.equal(session.rounds[0].matches.length, 1);
  assert.equal(session.rounds[0].advancing.length, 1);
  assert.equal(session.rounds[1].pending, true);
  const names = (ids) => ids.map((id) => session.players.find((player) => player.id === id).name);
  session = setMatchScore(session, session.rounds[0].id, session.rounds[0].matches[0].id, 10, 6);
  assert.equal(session.rounds[1].pending, false);
  assert.equal(session.rounds[1].matches.length, 1);
  assert.deepEqual(names(session.rounds[1].matches[0].sideA), ["A", "B"]);
  assert.deepEqual(names(session.rounds[1].matches[0].sideB), names(session.rounds[0].matches[0].sideA));
});

test("standings keep side points and ignore bonuses that were not set", () => {
  let session = createSession({ players: ["A", "B", "C", "D"], system: "americano", rounds: 1 });
  const match = session.rounds[0].matches[0];
  session = setMatchScore(session, session.rounds[0].id, match.id, 16, 8);
  const rows = standings(session);
  const points = Object.fromEntries(rows.map((row) => [row.name, row.points]));
  assert.equal(points.A, 16);
  assert.equal(points.B, 16);
  assert.equal(points.C, 8);
  assert.equal(points.D, 8);
  assert.deepEqual(rows.map((row) => row.rank), [1, 1, 3, 3]);
});

test("sit-out points, win bonus, and draw bonus are added on top of the side score", () => {
  let session = createSession({ players: ["A", "B", "C", "D", "E"], system: "americano", rounds: 1, courts: 1, sitOutPoints: 5, winBonus: 2 });
  const match = session.rounds[0].matches[0];
  const names = (ids) => ids.map((id) => session.players.find((player) => player.id === id).name);
  session = setMatchScore(session, session.rounds[0].id, match.id, 16, 8);
  const points = Object.fromEntries(standings(session).map((row) => [row.name, row.points]));
  names(match.sideA).forEach((name) => assert.equal(points[name], 18));
  names(match.sideB).forEach((name) => assert.equal(points[name], 8));
  assert.equal(points[names(session.rounds[0].byes)[0]], 5);
  assert.equal(standings(session).find((row) => row.name === names(session.rounds[0].byes)[0]).played, 0);

  let drawn = createSession({ players: ["A", "B", "C", "D"], system: "americano", rounds: 1, drawBonus: 1 });
  drawn = setMatchScore(drawn, drawn.rounds[0].id, drawn.rounds[0].matches[0].id, 12, 12);
  assert.ok(standings(drawn).every((row) => row.points === 13));
});

test("result points can change during a match and a loss point is added to the losing side", () => {
  let session = createSession({ players: ["A", "B", "C", "D", "E"], system: "americano", rounds: 1, courts: 1, winBonus: 1 });
  const match = session.rounds[0].matches[0];
  const names = (ids) => ids.map((id) => session.players.find((player) => player.id === id).name);
  session = setMatchScore(session, session.rounds[0].id, match.id, 16, 8);
  session = setResultPoints(session, { sitOutPoints: 3, winBonus: 2, drawBonus: 0, lossBonus: 1 });
  const points = Object.fromEntries(standings(session).map((row) => [row.name, row.points]));
  names(match.sideA).forEach((name) => assert.equal(points[name], 18));
  names(match.sideB).forEach((name) => assert.equal(points[name], 9));
  assert.equal(points[names(session.rounds[0].byes)[0]], 3);
  const ended = { ...session, status: "finished" };
  assert.equal(setResultPoints(ended, { winBonus: 9 }), ended);
});

test("skip ranking shares a place and skips the next number", () => {
  const session = {
    result: "points",
    players: ["Ana", "Bia", "Cia", "Dia"].map((name, index) => ({ id: String(index), name })),
    rounds: [
      {
        pending: false,
        byes: [],
        matches: [
          { sideA: ["0"], sideB: ["1"], scoreA: 10, scoreB: 8 },
          { sideA: ["2"], sideB: ["3"], scoreA: 8, scoreB: 5 },
        ],
      },
    ],
  };
  assert.deepEqual(
    standings(session).map((row) => [row.name, row.rank]),
    [
      ["Ana", 1],
      ["Bia", 2],
      ["Cia", 2],
      ["Dia", 4],
    ],
  );
});

test("extra rounds keep matches and sits within one of each other", () => {
  const session = createSession({ players: ["A", "B", "C", "D", "E", "F", "G"], system: "americano", rounds: 10, courts: 1 });
  const balance = scheduleBalance(session);
  const matches = balance.map((row) => row.matches);
  const sits = balance.map((row) => row.sits);
  assert.equal(Math.max(...matches) - Math.min(...matches), 1);
  assert.equal(Math.max(...sits) - Math.min(...sits), 1);
  session.rounds.forEach((round) => {
    const ids = [...round.matches.flatMap((match) => [...match.sideA, ...match.sideB]), ...round.byes];
    assert.equal(new Set(ids).size, 7);
    assert.equal(round.matches.length, 1);
  });
});

test("auto rounds give every player the same number of matches", () => {
  assert.equal(balancedRounds(7, "doubles", 1), 7);
  assert.equal(balancedRounds(4, "doubles", 1), 3);
  assert.equal(balancedRounds(5, "singles", 1), 5);
  const session = createSession({ players: ["A", "B", "C", "D", "E", "F", "G"], system: "americano", rounds: "auto", courts: 1 });
  assert.equal(session.rounds.length, 7);
  const balance = scheduleBalance(session);
  assert.equal(new Set(balance.map((row) => row.matches)).size, 1);
  assert.equal(new Set(balance.map((row) => row.sits)).size, 1);
});

test("club americano pairs inside a club and never matches the same club", () => {
  const session = createSession({
    players: [
      { name: "A1", club: "Utara" },
      { name: "A2", club: "Utara" },
      { name: "B1", club: "Selatan" },
      { name: "B2", club: "Selatan" },
    ],
    system: "americano",
    pairing: "club",
    rounds: 1,
  });
  const match = session.rounds[0].matches[0];
  const club = (id) => session.players.find((player) => player.id === id).club;
  assert.equal(session.rounds[0].matches.length, 1);
  assert.equal(club(match.sideA[0]), club(match.sideA[1]));
  assert.equal(club(match.sideB[0]), club(match.sideB[1]));
  assert.notEqual(club(match.sideA[0]), club(match.sideB[0]));
});

test("swiss pairs by points and does not repeat an opponent while another is free", () => {
  let session = createSession({ players: ["A", "B", "C", "D", "E", "F"], system: "swiss", rounds: 2 });
  assert.equal(session.teams.length, 3);
  assert.equal(session.rounds[0].matches.length, 1);
  assert.equal(session.rounds[0].byes.length, 2);
  assert.equal(session.rounds[1].pending, true);
  const names = (ids) => ids.map((id) => session.players.find((player) => player.id === id).name).join("&");
  const first = names(session.rounds[0].matches[0].sideA) + "v" + names(session.rounds[0].matches[0].sideB);
  session = setMatchScore(session, session.rounds[0].id, session.rounds[0].matches[0].id, 16, 10);
  assert.equal(session.rounds[1].pending, false);
  const second = names(session.rounds[1].matches[0].sideA) + "v" + names(session.rounds[1].matches[0].sideB);
  assert.notEqual(first, second);
  assert.notEqual(first.split("v").reverse().join("v"), second);
});

test("a playoff round waits for the group, then seeds 1 with 4 against 2 with 3", () => {
  let session = createSession({ players: ["A", "B", "C", "D"], system: "americano", rounds: 1, playoffs: true });
  assert.equal(session.rounds.length, 2);
  assert.equal(session.rounds[1].pending, true);
  session = setMatchScore(session, session.rounds[0].id, session.rounds[0].matches[0].id, 16, 8);
  assert.equal(session.rounds[1].pending, false);
  const names = (ids) => ids.map((id) => session.players.find((player) => player.id === id).name);
  assert.deepEqual(names(session.rounds[1].matches[0].sideA), ["A", "D"]);
  assert.deepEqual(names(session.rounds[1].matches[0].sideB), ["B", "C"]);
  assert.deepEqual(names(session.rounds[0].matches[0].sideA), ["A", "B"]);
});

test("rounds can be added without touching earlier scores", () => {
  let session = createSession({ players: ["A", "B"], format: "singles", pairing: "fixed", rounds: 1 });
  session = setMatchScore(session, session.rounds[0].id, session.rounds[0].matches[0].id, 10, 8);
  const first = session.rounds[0];
  session = addRounds(session, 1);
  assert.equal(session.rounds.length, 2);
  assert.equal(session.rounds[0], first);
  assert.equal(session.rounds[1].matches[0].scoreA, null);
});
