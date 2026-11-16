import assert from "node:assert/strict";
import test from "node:test";
import { createMatch, currentServer, scorePoint, setsWon } from "./scoring.js";

function giveGame(match, team) {
  let current = match;
  const games = current.games[team];
  let guard = 0;

  while (current.games[team] === games && current.phase === "game" && current.status === "playing" && guard < 12) {
    current = scorePoint(current, team);
    guard += 1;
  }

  return current;
}

function reachDeuce(deuce) {
  let match = createMatch({ deuce, bestOf: 1, superTiebreak: false });
  for (let step = 0; step < 3; step += 1) {
    match = scorePoint(match, 0);
    match = scorePoint(match, 1);
  }
  return match;
}

test("scoring does not mutate the previous match", () => {
  const match = createMatch();
  const snapshot = structuredClone(match);
  scorePoint(match, 0);
  assert.deepEqual(match, snapshot);
});

test("four unanswered points win a game and the serve switches", () => {
  let match = createMatch({ server: 0, bestOf: 1 });
  match = scorePoint(match, 0);
  assert.equal(match.points[0], 1);
  match = giveGame(match, 0);
  assert.deepEqual(match.games, [1, 0]);
  assert.equal(currentServer(match), 1);
});

test("golden point ends the game on the next point", () => {
  let match = reachDeuce("golden");
  assert.equal(match.deuceCount, 1);
  match = scorePoint(match, 1);
  assert.equal(match.games[1], 1);
  assert.deepEqual(match.points, [0, 0]);
});

test("advantage needs two points in a row", () => {
  let match = reachDeuce("advantage");
  match = scorePoint(match, 0);
  assert.equal(match.advantage, 0);
  match = scorePoint(match, 1);
  assert.equal(match.advantage, null);
  assert.equal(match.games[0], 0);
  match = scorePoint(match, 0);
  match = scorePoint(match, 0);
  assert.equal(match.games[0], 1);
});

test("star point decides on the third deuce", () => {
  let match = reachDeuce("star");
  match = scorePoint(match, 0);
  match = scorePoint(match, 1);
  assert.equal(match.deuceCount, 2);
  match = scorePoint(match, 0);
  match = scorePoint(match, 1);
  assert.equal(match.deuceCount, 3);
  assert.equal(match.games[0], 0);
  match = scorePoint(match, 1);
  assert.equal(match.games[1], 1);
});

function playToTiebreak(match) {
  let current = match;
  for (let game = 0; game < 6; game += 1) {
    current = giveGame(current, 0);
    current = giveGame(current, 1);
  }
  return current;
}

test("a set goes to tie-break at 6-6 and is recorded as 7-6", () => {
  let match = playToTiebreak(createMatch({ server: 0, bestOf: 1, gamesPerSet: 6 }));

  assert.equal(match.phase, "tiebreak");
  assert.deepEqual(match.games, [6, 6]);
  assert.equal(match.tiebreakFirstServer, 0);
  assert.equal(currentServer(match), 0);

  for (let point = 0; point < 7; point += 1) {
    match = scorePoint(match, 0);
  }

  assert.equal(match.status, "finished");
  assert.equal(match.winner, 0);
  assert.deepEqual(match.sets[0], { left: 7, right: 6, super: false, detail: [7, 0] });
});

test("tie-break serve rotates one point, then two", () => {
  const serverAt = (left, right) =>
    currentServer({
      phase: "tiebreak",
      tiebreak: [left, right],
      tiebreakFirstServer: 0,
      server: 0,
    });

  assert.equal(serverAt(0, 0), 0);
  assert.equal(serverAt(1, 0), 1);
  assert.equal(serverAt(1, 1), 1);
  assert.equal(serverAt(2, 1), 0);
  assert.equal(serverAt(2, 2), 0);
  assert.equal(serverAt(3, 2), 1);
});

test("tie-break continues until a team leads by two", () => {
  let match = playToTiebreak(createMatch({ bestOf: 1 }));

  for (let point = 0; point < 6; point += 1) {
    match = scorePoint(match, point % 2);
  }
  assert.equal(match.status, "playing");
  assert.deepEqual(match.tiebreak, [3, 3]);

  match = scorePoint(match, 0);
  match = scorePoint(match, 0);
  assert.equal(match.status, "playing");

  match = scorePoint(match, 0);
  match = scorePoint(match, 0);
  assert.equal(match.status, "finished");
  assert.deepEqual(match.sets[0].detail, [7, 3]);
});

test("best of three can finish in straight sets", () => {
  let match = createMatch({ bestOf: 3, gamesPerSet: 4, superTiebreak: true });
  for (let set = 0; set < 2; set += 1) {
    for (let game = 0; game < 4; game += 1) {
      match = giveGame(match, 0);
    }
  }
  assert.equal(match.status, "finished");
  assert.equal(match.winner, 0);
  assert.deepEqual(setsWon(match), [2, 0]);
  assert.equal(match.sets.length, 2);
});

test("a split match uses the super tie-break to 10", () => {
  let match = createMatch({ bestOf: 3, gamesPerSet: 4, superTiebreak: true, server: 0 });
  for (let game = 0; game < 4; game += 1) match = giveGame(match, 0);
  for (let game = 0; game < 4; game += 1) match = giveGame(match, 1);

  assert.equal(match.phase, "super");
  assert.equal(match.status, "playing");

  for (let point = 0; point < 10; point += 1) {
    match = scorePoint(match, 1);
  }

  assert.equal(match.status, "finished");
  assert.equal(match.winner, 1);
  assert.deepEqual(match.sets[2], { left: 0, right: 10, super: true, detail: null });
});
