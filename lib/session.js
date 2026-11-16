function newId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function normalizeRounds(value) {
  const count = Number(value);
  if (!Number.isInteger(count) || count < 1) {
    return 10;
  }
  return Math.min(count, 100);
}

function rotate(list, times) {
  if (list.length === 0) {
    return [];
  }
  const shift = ((times % list.length) + list.length) % list.length;
  return list.slice(shift).concat(list.slice(0, shift));
}

function roundRobinUnits(units, roundIndex) {
  if (units.length < 2) {
    return { pairs: [], bye: units[0] ?? null };
  }

  const work = [...units];
  if (work.length % 2 === 1) {
    work.push(null);
  }

  const size = work.length;
  const round = roundIndex % (size - 1);
  const rest = rotate(work.slice(1), round);
  const line = [work[0], ...rest];
  const pairs = [];
  let bye = null;

  for (let index = 0; index < size / 2; index += 1) {
    const left = line[index];
    const right = line[size - 1 - index];
    if (left == null || right == null) {
      bye = left ?? right;
    } else {
      pairs.push([left, right]);
    }
  }

  return { pairs, bye };
}

function courtSides(group, variant) {
  const [first, second, third, fourth] = group;
  if (variant === 1) {
    return [
      [first, third],
      [second, fourth],
    ];
  }
  if (variant === 2) {
    return [
      [first, fourth],
      [second, third],
    ];
  }
  return [
    [first, second],
    [third, fourth],
  ];
}

function planSingles(playerIds, roundIndex, pairing) {
  const order = pairing === "mixed" ? rotate(playerIds, 1) : playerIds;
  const { pairs, bye } = roundRobinUnits(order, roundIndex);
  return {
    matches: pairs.map(([left, right]) => ({ sideA: [left], sideB: [right] })),
    byes: bye ? [bye] : [],
  };
}

function planMixedDoubles(playerIds, roundIndex, previousRounds = [], courts = null) {
  if (playerIds.length < 4) {
    return { matches: [], byes: [...playerIds] };
  }

  const room = Math.max(1, courts ? Math.min(courts, Math.floor(playerIds.length / 4)) : Math.floor(playerIds.length / 4));
  const byeCount = playerIds.length - room * 4;
  const sits = new Map(playerIds.map((id) => [id, 0]));
  const lastSat = new Map(playerIds.map((id) => [id, -1]));
  previousRounds.forEach((round, index) => {
    for (const id of round.byes || []) {
      if (!sits.has(id)) {
        continue;
      }
      sits.set(id, sits.get(id) + 1);
      lastSat.set(id, index);
    }
  });
  const indexOf = new Map(playerIds.map((id, index) => [id, index]));
  const byes = [...playerIds]
    .sort((left, right) => sits.get(left) - sits.get(right) || lastSat.get(left) - lastSat.get(right) || indexOf.get(left) - indexOf.get(right))
    .slice(0, byeCount);
  const sitting = new Set(byes);
  const active = rotate(playerIds.filter((id) => !sitting.has(id)), roundIndex);
  const seats = [];

  for (let index = 0; index < active.length; index += 4) {
    const [sideA, sideB] = courtSides(active.slice(index, index + 4), (roundIndex + index / 4) % 3);
    seats.push(...sideA, ...sideB);
  }

  spreadPartners(seats, previousRounds);
  const matches = [];
  for (let index = 0; index < seats.length; index += 4) {
    matches.push({ sideA: seats.slice(index, index + 2), sideB: seats.slice(index + 2, index + 4) });
  }

  return { matches, byes };
}

function pairKey(left, right) {
  return left < right ? `${left}|${right}` : `${right}|${left}`;
}

function spreadPartners(seats, previousRounds) {
  const partners = new Map();
  const opponents = new Map();
  const bump = (map, left, right) => {
    const key = pairKey(left, right);
    map.set(key, (map.get(key) || 0) + 1);
  };
  previousRounds.forEach((round) => {
    (round.matches || []).forEach((match) => {
      if (match.sideA.length === 2) bump(partners, match.sideA[0], match.sideA[1]);
      if (match.sideB.length === 2) bump(partners, match.sideB[0], match.sideB[1]);
      match.sideA.forEach((left) => match.sideB.forEach((right) => bump(opponents, left, right)));
    });
  });
  const partner = (left, right) => partners.get(pairKey(left, right)) || 0;
  const opponent = (left, right) => opponents.get(pairKey(left, right)) || 0;
  const courtCost = (court) => {
    const [a, b, c, d] = seats.slice(court * 4, court * 4 + 4);
    const together = partner(a, b) ** 2 + partner(c, d) ** 2;
    const against = opponent(a, c) ** 2 + opponent(a, d) ** 2 + opponent(b, c) ** 2 + opponent(b, d) ** 2;
    return together * 10 + against;
  };

  for (let pass = 0; pass < 50; pass += 1) {
    let improved = false;
    for (let first = 0; first < seats.length; first += 1) {
      for (let second = first + 1; second < seats.length; second += 1) {
        if (Math.floor(first / 2) === Math.floor(second / 2)) continue;
        const courts = [...new Set([Math.floor(first / 4), Math.floor(second / 4)])];
        const before = courts.reduce((sum, court) => sum + courtCost(court), 0);
        [seats[first], seats[second]] = [seats[second], seats[first]];
        const after = courts.reduce((sum, court) => sum + courtCost(court), 0);
        if (after < before) {
          improved = true;
        } else {
          [seats[first], seats[second]] = [seats[second], seats[first]];
        }
      }
    }
    if (!improved) break;
  }
}

function planFixedDoubles(teams, players, roundIndex) {
  const paired = new Set(teams.flatMap((team) => team.playerIds));
  const waiting = players.filter((player) => !paired.has(player.id)).map((player) => player.id);
  if (teams.length < 2) {
    return { matches: [], byes: [...paired, ...waiting] };
  }

  const { pairs, bye } = roundRobinUnits(teams, roundIndex);
  return {
    matches: pairs.map(([left, right]) => ({ sideA: [...left.playerIds], sideB: [...right.playerIds] })),
    byes: [...(bye ? bye.playerIds : []), ...waiting],
  };
}

const TOURNAMENTS = ["americano", "mexicano", "king", "box", "knockout", "swiss"];

export function isSocial(session) {
  return TOURNAMENTS.includes(session?.system);
}

export function normalizeCourts(value) {
  if (value == null || value === "") {
    return null;
  }
  const count = Number(value);
  if (!Number.isInteger(count) || count < 1) {
    return null;
  }
  return Math.min(count, 10);
}

export function normalizeBonus(value) {
  const count = Number(value);
  if (!Number.isInteger(count) || count < 1) {
    return 0;
  }
  return Math.min(count, 99);
}

function normalizeMinutes(value) {
  const count = Number(value);
  if (!Number.isInteger(count) || count < 1) {
    return null;
  }
  return Math.min(count, 180);
}

function readCourtNames(value) {
  const list = Array.isArray(value) ? value : String(value || "").split(",");
  return list
    .map((item) => String(item || "").trim().slice(0, 24))
    .filter(Boolean)
    .slice(0, 10);
}

export function balancedRounds(playerCount, format, courts) {
  const size = format === "singles" ? 2 : 4;
  const count = Number(playerCount) || 0;
  if (count < size) {
    return 10;
  }
  const room = courts ? Math.min(Number(courts) || 0, Math.floor(count / size)) : Math.floor(count / size);
  const playing = Math.max(0, room) * size;
  if (playing < size) {
    return 10;
  }
  if (playing === count) {
    const cycle = format === "singles" ? count - 1 : 3 * (count / size);
    return Math.min(cycle, 100);
  }
  let left = playing;
  let right = count;
  while (right) {
    const next = left % right;
    left = right;
    right = next;
  }
  return Math.min(count / left, 100);
}

function followsResults(session) {
  return session.system === "mexicano" || session.system === "king" || session.system === "box" || session.system === "knockout" || session.system === "swiss";
}

function limitCourts(plan, courts) {
  if (!courts || plan.matches.length <= courts) {
    return plan;
  }
  const extra = plan.matches.slice(courts).flatMap((match) => [...match.sideA, ...match.sideB]);
  return { ...plan, matches: plan.matches.slice(0, courts), byes: [...plan.byes, ...extra] };
}

function blankPlan(pending = false) {
  return { matches: [], byes: [], pending, advancing: [] };
}

function previousReady(session, roundIndex, allowTie) {
  if (roundIndex === 0) {
    return true;
  }
  const previous = session.rounds[roundIndex - 1];
  if (!previous || previous.pending || previous.matches.length === 0) {
    return false;
  }
  return previous.matches.every((match) => isComplete(match) && (allowTie || match.scoreA !== match.scoreB));
}

function planGenderAmericano(players, roundIndex) {
  const men = players.filter((player) => player.gender !== "f").map((player) => player.id);
  const women = players.filter((player) => player.gender === "f").map((player) => player.id);
  const count = Math.min(men.length, women.length);
  if (count < 2) {
    return blankPlan();
  }
  const spun = rotate(women, roundIndex);
  const teams = men.slice(0, count).map((id, index) => [id, spun[index]]);
  const used = new Set(spun.slice(0, count));
  const { pairs, bye } = roundRobinUnits(teams, roundIndex);
  return {
    matches: pairs.map(([left, right]) => ({ sideA: [...left], sideB: [...right] })),
    byes: [...men.slice(count), ...women.filter((id) => !used.has(id)), ...(bye || [])],
    pending: false,
    advancing: [],
  };
}

function planGenderMexicano(session, roundIndex) {
  const men = rankedIds(session, roundIndex).filter((id) => session.players.find((player) => player.id === id)?.gender !== "f");
  const women = rankedIds(session, roundIndex).filter((id) => session.players.find((player) => player.id === id)?.gender === "f");
  const courts = Math.floor(Math.min(men.length, women.length) / 2);
  const matches = [];
  for (let index = 0; index < courts; index += 1) {
    const man = men.slice(index * 2, index * 2 + 2);
    const woman = women.slice(index * 2, index * 2 + 2);
    matches.push({ sideA: [man[0], woman[1]], sideB: [man[1], woman[0]] });
  }
  const used = new Set(matches.flatMap((match) => [...match.sideA, ...match.sideB]));
  return {
    matches,
    byes: [...men, ...women].filter((id) => !used.has(id)),
    pending: false,
    advancing: [],
  };
}

function planTeamMexicano(session, roundIndex) {
  const rows = new Map(standings({ ...session, rounds: session.rounds.slice(0, roundIndex) }).map((row) => [row.id, row.points]));
  const teams = [...(session.teams || [])].sort((left, right) => {
    const leftPoints = left.playerIds.reduce((sum, id) => sum + (rows.get(id) || 0), 0);
    const rightPoints = right.playerIds.reduce((sum, id) => sum + (rows.get(id) || 0), 0);
    return rightPoints - leftPoints;
  });
  if (teams.length < 2) {
    return { matches: [], byes: teams.flatMap((team) => team.playerIds), pending: false, advancing: [] };
  }
  const sitting = teams.length % 2;
  const active = teams.slice(0, teams.length - sitting);
  return {
    matches: Array.from({ length: active.length / 2 }, (_, index) => ({
      sideA: [...active[index * 2].playerIds],
      sideB: [...active[index * 2 + 1].playerIds],
    })),
    byes: teams.slice(active.length).flatMap((team) => team.playerIds),
    pending: false,
    advancing: [],
  };
}

function rankedIds(session, roundIndex) {
  const order = new Map(session.players.map((player, index) => [player.id, index]));
  const rows = standings({ ...session, rounds: session.rounds.slice(0, roundIndex) });
  return rows
    .sort((left, right) => right.points - left.points || left.played - right.played || order.get(left.id) - order.get(right.id))
    .map((row) => row.id);
}

function planRankedCourts(ids, format) {
  if (format === "singles") {
    if (ids.length < 2) {
      return { matches: [], byes: [...ids] };
    }
    const sitting = ids.length % 2;
    const active = ids.slice(0, ids.length - sitting);
    const matches = [];
    for (let index = 0; index < active.length; index += 2) {
      matches.push({ sideA: [active[index]], sideB: [active[index + 1]] });
    }
    return { matches, byes: ids.slice(ids.length - sitting) };
  }

  if (ids.length < 4) {
    return { matches: [], byes: [...ids] };
  }
  const sitting = ids.length % 4;
  const active = ids.slice(0, ids.length - sitting);
  const matches = [];
  for (let index = 0; index < active.length; index += 4) {
    const [first, second, third, fourth] = active.slice(index, index + 4);
    matches.push({ sideA: [first, third], sideB: [second, fourth] });
  }
  return { matches, byes: ids.slice(ids.length - sitting) };
}

function planMexicanoRound(session, roundIndex) {
  if (!previousReady(session, roundIndex, true)) {
    return blankPlan(true);
  }
  if (session.pairing === "gender") {
    return planGenderMexicano(session, roundIndex);
  }
  if (session.pairing === "fixed") {
    return planTeamMexicano(session, roundIndex);
  }
  return { ...planRankedCourts(rankedIds(session, roundIndex), session.format), pending: false, advancing: [] };
}

function seedCourts(ids, format, courts) {
  const size = format === "singles" ? 2 : 4;
  const room = courts || Math.floor(ids.length / size);
  const playing = ids.slice(0, Math.max(0, room) * size);
  const matches = [];
  for (let index = 0; index < playing.length; index += size) {
    const group = playing.slice(index, index + size);
    if (size === 2) {
      matches.push({ sideA: [group[0]], sideB: [group[1]] });
    } else {
      matches.push({ sideA: [group[0], group[1]], sideB: [group[2], group[3]] });
    }
  }
  return { matches, byes: ids.slice(playing.length) };
}

function planKing(session, roundIndex) {
  const ids = session.players.map((player) => player.id);
  if (roundIndex === 0) {
    return { ...seedCourts(ids, session.format, session.courts), pending: false, advancing: [] };
  }
  if (!previousReady(session, roundIndex, true)) {
    return blankPlan(true);
  }
  const played = session.rounds[roundIndex - 1].matches;
  const win = played.map((match) => (match.scoreA >= match.scoreB ? match.sideA : match.sideB));
  const lose = played.map((match) => (match.scoreA >= match.scoreB ? match.sideB : match.sideA));
  const count = played.length;
  const matches = [];
  if (count === 1) {
    matches.push({ sideA: [...win[0]], sideB: [...lose[0]] });
  } else {
    for (let index = 0; index < count; index += 1) {
      if (index === 0) {
        matches.push({ sideA: [...win[0]], sideB: [...win[1]] });
      } else if (index === count - 1) {
        matches.push({ sideA: [...lose[count - 2]], sideB: [...lose[count - 1]] });
      } else {
        matches.push({ sideA: [...lose[index - 1]], sideB: [...win[index + 1]] });
      }
    }
  }
  const used = new Set(matches.flatMap((match) => [...match.sideA, ...match.sideB]));
  return { matches, byes: ids.filter((id) => !used.has(id)), pending: false, advancing: [] };
}

function planBox(session, roundIndex) {
  const size = session.format === "singles" ? 2 : 4;
  const split = session.boxSplit || 0;
  let source = session.players.map((player) => player.id);
  if (split > 0 && roundIndex >= split) {
    const stage = session.rounds.slice(0, split);
    const ready = stage.length >= split && stage.every((round) => !round.pending && round.matches.every(isComplete));
    if (!ready) {
      return blankPlan(true);
    }
    source = rankedIds(session, roundIndex);
  }
  const groups = [];
  for (let index = 0; index + size <= source.length; index += size) {
    groups.push(source.slice(index, index + size));
  }
  let byes = source.slice(groups.length * size);
  let active = groups;
  if (session.courts && active.length > session.courts) {
    byes = [...byes, ...active.slice(session.courts).flat()];
    active = active.slice(0, session.courts);
  }
  return {
    matches: active.map((group, index) => {
      if (size === 2) {
        return { sideA: [group[0]], sideB: [group[1]] };
      }
      const [sideA, sideB] = courtSides(group, (roundIndex + index) % 3);
      return { sideA, sideB };
    }),
    byes,
    pending: false,
    advancing: [],
  };
}

function knockoutSides(session) {
  if (session.format === "singles") {
    return session.players.map((player) => [player.id]);
  }
  if (session.teams?.length) {
    return session.teams.map((team) => [...team.playerIds]);
  }
  const ids = session.players.map((player) => player.id);
  const sides = [];
  for (let index = 0; index + 1 < ids.length; index += 2) {
    sides.push([ids[index], ids[index + 1]]);
  }
  return sides;
}

function planKnockout(session, roundIndex) {
  let sides;
  if (roundIndex === 0) {
    sides = knockoutSides(session);
  } else {
    if (!previousReady(session, roundIndex, false)) {
      return blankPlan(true);
    }
    const previous = session.rounds[roundIndex - 1];
    const winners = previous.matches.map((match) => (match.scoreA > match.scoreB ? [...match.sideA] : [...match.sideB]));
    sides = [...(previous.advancing || []).map((side) => [...side]), ...winners];
  }
  if (sides.length < 2) {
    return { matches: [], byes: sides.flat(), pending: false, advancing: sides };
  }
  const target = 2 ** Math.ceil(Math.log2(sides.length));
  const advancing = sides.slice(0, target - sides.length);
  const playing = sides.slice(advancing.length);
  const matches = [];
  for (let index = 0; index + 1 < playing.length; index += 2) {
    matches.push({ sideA: [...playing[index]], sideB: [...playing[index + 1]] });
  }
  return { matches, byes: advancing.flat(), pending: false, advancing };
}

function planClubAmericano(players, roundIndex) {
  const groups = new Map();
  players.forEach((player) => {
    const club = player.club || "";
    if (!groups.has(club)) {
      groups.set(club, []);
    }
    groups.get(club).push(player.id);
  });
  const units = [];
  const byes = [];
  groups.forEach((ids, club) => {
    const rotated = rotate(ids, roundIndex);
    let index = 0;
    for (; index + 1 < rotated.length; index += 2) {
      units.push({ club, ids: [rotated[index], rotated[index + 1]] });
    }
    if (index < rotated.length) {
      byes.push(rotated[index]);
    }
  });
  const spun = rotate(units, roundIndex);
  const matches = [];
  const used = new Set();
  for (let index = 0; index < spun.length; index += 1) {
    if (used.has(index)) {
      continue;
    }
    let other = -1;
    for (let next = index + 1; next < spun.length; next += 1) {
      if (!used.has(next) && spun[next].club !== spun[index].club) {
        other = next;
        break;
      }
    }
    used.add(index);
    if (other === -1) {
      byes.push(...spun[index].ids);
      continue;
    }
    used.add(other);
    matches.push({ sideA: [...spun[index].ids], sideB: [...spun[other].ids] });
  }
  return { matches, byes, pending: false, advancing: [] };
}

function teamKey(ids) {
  return [...ids].sort().join("|");
}

function planSwiss(session, roundIndex) {
  if (!previousReady(session, roundIndex, true)) {
    return blankPlan(true);
  }
  const teams = session.format === "singles" ? session.players.map((player) => [player.id]) : (session.teams || []).map((team) => [...team.playerIds]);
  const points = new Map(standings({ ...session, rounds: session.rounds.slice(0, roundIndex) }).map((row) => [row.id, row.points]));
  const order = teams.map((playerIds, index) => ({
    playerIds,
    index,
    points: playerIds.reduce((sum, id) => sum + (points.get(id) || 0), 0),
  }));
  order.sort((left, right) => right.points - left.points || left.index - right.index);
  const played = new Set();
  session.rounds.slice(0, roundIndex).forEach((round) => {
    round.matches.forEach((match) => {
      const left = teamKey(match.sideA);
      const right = teamKey(match.sideB);
      played.add(`${left}>${right}`);
      played.add(`${right}>${left}`);
    });
  });
  const matches = [];
  const byes = [];
  const used = new Set();
  for (let index = 0; index < order.length; index += 1) {
    if (used.has(index)) {
      continue;
    }
    const home = teamKey(order[index].playerIds);
    let other = -1;
    for (let next = index + 1; next < order.length; next += 1) {
      if (!used.has(next) && !played.has(`${home}>${teamKey(order[next].playerIds)}`)) {
        other = next;
        break;
      }
    }
    if (other === -1) {
      for (let next = index + 1; next < order.length; next += 1) {
        if (!used.has(next)) {
          other = next;
          break;
        }
      }
    }
    used.add(index);
    if (other === -1) {
      byes.push(...order[index].playerIds);
      continue;
    }
    used.add(other);
    matches.push({ sideA: [...order[index].playerIds], sideB: [...order[other].playerIds] });
  }
  return { matches, byes, pending: false, advancing: [] };
}

function planPlayoff(session) {
  const group = session.rounds.slice(0, session.groupRounds || 0);
  const ready = group.length === (session.groupRounds || 0) && group.every((round) => !round.pending && round.matches.length > 0 && round.matches.every(isComplete));
  if (!ready) {
    return blankPlan(true);
  }
  const ids = rankedIds(session, session.groupRounds);
  const size = session.format === "singles" ? 2 : 4;
  const room = session.courts || Math.floor(ids.length / size);
  const playing = ids.slice(0, Math.max(0, room) * size);
  const matches = [];
  for (let index = 0; index + size <= playing.length; index += size) {
    const groupIds = playing.slice(index, index + size);
    if (size === 2) {
      matches.push({ sideA: [groupIds[0]], sideB: [groupIds[1]] });
    } else {
      matches.push({ sideA: [groupIds[0], groupIds[3]], sideB: [groupIds[1], groupIds[2]] });
    }
  }
  return { matches, byes: ids.slice(playing.length), pending: false, advancing: [] };
}

function knockoutRounds(players, format) {
  const sides = format === "singles" ? players.length : Math.floor(players.length / 2);
  if (sides < 2) {
    return 1;
  }
  return Math.ceil(Math.log2(sides));
}

function withActive(session) {
  const players = session.players.filter((player) => !player.stopped);
  const active = new Set(players.map((player) => player.id));
  return {
    ...session,
    players,
    teams: (session.teams || []).filter((team) => team.playerIds.every((id) => active.has(id))),
  };
}

export function planRound(session, roundIndex) {
  const view = withActive(session);
  let plan;
  if (view.playoffs && roundIndex === view.groupRounds) {
    plan = planPlayoff(view);
  } else if (view.system === "mexicano") {
    plan = planMexicanoRound(view, roundIndex);
  } else if (view.system === "swiss") {
    plan = planSwiss(view, roundIndex);
  } else if (view.system === "king") {
    plan = planKing(view, roundIndex);
  } else if (view.system === "box") {
    plan = planBox(view, roundIndex);
  } else if (view.system === "knockout") {
    plan = planKnockout(view, roundIndex);
  } else if (view.system === "americano" && view.pairing === "club") {
    plan = planClubAmericano(view.players, roundIndex);
  } else if (view.system === "americano" && view.pairing === "gender") {
    plan = planGenderAmericano(view.players, roundIndex);
  } else if (view.system === "americano" && view.pairing === "fixed") {
    plan = { ...planFixedDoubles(view.teams || [], view.players, roundIndex), pending: false, advancing: [] };
  } else if (view.system === "americano") {
    const ids = view.players.map((player) => player.id);
    const rotation = view.format === "doubles" ? planMixedDoubles(ids, roundIndex, view.rounds.slice(0, roundIndex), view.courts) : planSingles(ids, roundIndex, "mixed");
    plan = { ...rotation, pending: false, advancing: [] };
  } else if (view.format === "doubles" && view.pairing === "fixed") {
    plan = { ...planFixedDoubles(view.teams || [], view.players, roundIndex), pending: false, advancing: [] };
  } else {
    const ids = view.players.map((player) => player.id);
    const rotation = view.format === "doubles" ? planMixedDoubles(ids, roundIndex, view.rounds.slice(0, roundIndex), view.courts) : planSingles(ids, roundIndex, view.pairing);
    plan = { ...rotation, pending: false, advancing: [] };
  }
  if (!plan.advancing) {
    plan = { ...plan, advancing: [] };
  }
  if (!plan.pending && view.system !== "king" && view.system !== "knockout" && view.system !== "box") {
    plan = limitCourts(plan, view.courts);
  }
  return plan;
}

function freshMatch(plan) {
  return {
    id: newId(),
    sideA: [...plan.sideA],
    sideB: [...plan.sideB],
    scoreA: null,
    scoreB: null,
  };
}

function materializeRound(session, roundIndex) {
  const plan = planRound(session, roundIndex);
  return {
    id: newId(),
    pending: Boolean(plan.pending),
    matches: plan.matches.map(freshMatch),
    byes: [...plan.byes],
    advancing: (plan.advancing || []).map((side) => [...side]),
  };
}

function appendRounds(session, count) {
  const added = [];
  for (let offset = 0; offset < count; offset += 1) {
    const view = { ...session, rounds: [...session.rounds, ...added] };
    added.push(materializeRound(view, session.rounds.length + offset));
  }
  return added;
}

export function normalizePoints(value) {
  const count = Number(value);
  if (!Number.isInteger(count) || count < 1) {
    return 24;
  }
  return Math.min(count, 99);
}

function pairFixed(players) {
  const teams = [];
  for (let index = 0; index + 1 < players.length; index += 2) {
    teams.push({ id: newId(), playerIds: [players[index].id, players[index + 1].id] });
  }
  return teams;
}

function readPlayer(entry) {
  const source = typeof entry === "string" ? { name: entry } : entry || {};
  const gender = source.gender === "f" || source.gender === "m" ? source.gender : "";
  const club = String(source.club || "").trim().slice(0, 24);
  return { name: String(source.name || "").trim(), gender, club };
}

export function createSession(options = {}) {
  const players = (options.players || [])
    .map(readPlayer)
    .filter((player) => player.name)
    .map((player) => ({ id: newId(), name: player.name, ...(player.gender ? { gender: player.gender } : {}), ...(player.club ? { club: player.club } : {}) }));
  const format = options.format === "singles" ? "singles" : "doubles";
  const system = TOURNAMENTS.includes(options.system) ? options.system : "match";
  let pairing = options.pairing === "fixed" || options.pairing === "gender" || options.pairing === "club" ? options.pairing : "mixed";
  if (system === "knockout" && format === "doubles") {
    pairing = "fixed";
  }
  if (system === "swiss") {
    pairing = format === "singles" ? "mixed" : "fixed";
  }
  if ((system === "match" || system === "swiss") && pairing === "gender") {
    pairing = "mixed";
  }
  if (pairing === "club" && system !== "americano") {
    pairing = "mixed";
  }
  const courts = normalizeCourts(options.courts);
  const roundCount = system === "knockout" ? knockoutRounds(players, format) : options.rounds === "auto" ? balancedRounds(players.length, format, courts) : normalizeRounds(options.rounds);
  const playoffs = Boolean(options.playoffs) && (system === "americano" || system === "mexicano" || system === "swiss");
  const requested = options.scoring;
  const tennis = ["golden", "advantage", "star", "silver"].includes(requested);
  const scoring = tennis ? requested : system !== "match" || requested === "rally" ? "rally" : "golden";
  const session = {
    id: newId(),
    name: String(options.name || "").trim(),
    createdAt: new Date().toISOString(),
    system,
    scoring,
    result: scoring === "rally" ? "points" : "sets",
    pointsPerRound: scoring === "rally" ? normalizePoints(options.pointsPerRound) : null,
    format,
    pairing,
    courts,
    courtNames: readCourtNames(options.courtNames),
    boxSplit: system === "box" ? Math.floor(roundCount / 2) : 0,
    sitOutPoints: normalizeBonus(options.sitOutPoints),
    winBonus: normalizeBonus(options.winBonus),
    drawBonus: normalizeBonus(options.drawBonus),
    lossBonus: normalizeBonus(options.lossBonus),
    roundMinutes: normalizeMinutes(options.roundMinutes),
    playoffs,
    groupRounds: roundCount,
    players,
    teams: format === "doubles" && pairing === "fixed" ? pairFixed(players) : [],
    rounds: [],
  };
  session.rounds = appendRounds(session, roundCount + (playoffs ? 1 : 0));
  return session;
}

export function isComplete(match) {
  return typeof match.scoreA === "number" && typeof match.scoreB === "number";
}

export function isLocked(match) {
  return typeof match.scoreA === "number" || typeof match.scoreB === "number";
}

function remixRound(session, round, index) {
  const locked = round.matches.filter(isLocked);
  if (locked.length > 0 && locked.length === round.matches.length) {
    return round;
  }
  if (followsResults(session) && locked.length > 0) {
    return round;
  }
  if (locked.length === 0) {
    const plan = planRound(session, index);
    return {
      id: round.id,
      pending: Boolean(plan.pending),
      matches: plan.matches.map(freshMatch),
      byes: [...plan.byes],
      advancing: (plan.advancing || []).map((side) => [...side]),
    };
  }

  const busy = new Set(locked.flatMap((match) => [...match.sideA, ...match.sideB]));
  const freePlayers = session.players.filter((player) => !busy.has(player.id));
  const freeTeams = (session.teams || []).filter((team) => team.playerIds.every((id) => !busy.has(id)));
  const plan = planRound({ ...session, players: freePlayers, teams: freeTeams }, index);
  return {
    id: round.id,
    pending: false,
    matches: [...locked, ...plan.matches.map(freshMatch)],
    byes: [...plan.byes],
  };
}

function remix(session) {
  const rounds = [];
  session.rounds.forEach((round, index) => {
    const view = { ...session, rounds: [...rounds, ...session.rounds.slice(index)] };
    rounds.push(remixRound(view, round, index));
  });
  return { ...session, rounds };
}

export function addPlayer(session, name, gender) {
  const trimmed = String(name || "").trim();
  if (!trimmed || session.status === "finished") {
    return session;
  }

  const player = { id: newId(), name: trimmed, ...(gender === "f" || gender === "m" ? { gender } : {}) };
  const players = [...session.players, player];
  let teams = session.teams || [];
  if (session.format === "doubles" && session.pairing === "fixed") {
    const paired = new Set(teams.flatMap((team) => team.playerIds));
    const waiting = players.filter((item) => !paired.has(item.id));
    teams = [...teams];
    for (let index = 0; index + 1 < waiting.length; index += 2) {
      teams.push({ id: newId(), playerIds: [waiting[index].id, waiting[index + 1].id] });
    }
  }

  return remix({ ...session, players, teams });
}

export function stopPlayer(session, playerId) {
  if (!session.players.some((player) => player.id === playerId) || session.status === "finished") {
    return session;
  }
  return remix({
    ...session,
    players: session.players.map((player) => (player.id === playerId ? { ...player, stopped: true } : player)),
  });
}

export function hasScoreGap(session) {
  let skipped = false;
  for (const round of session.rounds || []) {
    const matches = round.matches || [];
    const scored = matches.some(isLocked);
    const complete = matches.length > 0 && matches.every(isComplete);
    if (scored && skipped) return true;
    if (!complete) skipped = true;
  }
  return false;
}

function shuffled(list, random) {
  const copy = [...list];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const pick = Math.floor(random() * (index + 1));
    [copy[index], copy[pick]] = [copy[pick], copy[index]];
  }
  return copy;
}

function drawShape(rounds) {
  const side = (ids) => [...ids].sort().join("+");
  return JSON.stringify(
    rounds.map((round) => ({
      matches: round.matches.map((match) => [side(match.sideA), side(match.sideB)].sort().join(" vs ")).sort(),
      byes: [...(round.byes || [])].sort(),
    })),
  );
}

export function remixRemaining(session, random = Math.random) {
  if (session.status === "finished" || hasScoreGap(session)) {
    return session;
  }
  const before = drawShape(session.rounds);
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const mixed = remix({ ...session, players: shuffled(session.players, random), teams: shuffled(session.teams || [], random) });
    const next = { ...mixed, players: session.players, teams: session.teams || [] };
    if (drawShape(next.rounds) !== before) {
      return next;
    }
  }
  return session;
}

export function rematchSession(session) {
  const next = { ...session, status: "playing", finishedAt: null, rounds: [] };
  next.rounds = appendRounds(next, Math.max(1, session.rounds.length));
  return next;
}

export function endSession(session) {
  if (session.status === "finished") {
    return session;
  }
  return { ...session, status: "finished", finishedAt: new Date().toISOString() };
}

export function addRounds(session, count = 1) {
  const extra = Math.max(1, Math.min(10, Number(count) || 1));
  return { ...session, rounds: [...session.rounds, ...appendRounds(session, extra)] };
}

export function setResultPoints(session, values) {
  if (session.status === "finished" || session.result !== "points") {
    return session;
  }
  return {
    ...session,
    sitOutPoints: normalizeBonus(values.sitOutPoints),
    winBonus: normalizeBonus(values.winBonus),
    drawBonus: normalizeBonus(values.drawBonus),
    lossBonus: normalizeBonus(values.lossBonus),
  };
}

export function setMatchScore(session, roundId, matchId, scoreA, scoreB) {
  const next = {
    ...session,
    rounds: session.rounds.map((round) => {
      if (round.id !== roundId) {
        return round;
      }
      return {
        ...round,
        matches: round.matches.map((match) => (match.id === matchId ? { ...match, scoreA, scoreB } : match)),
      };
    }),
  };
  if (followsResults(next)) {
    return remix(next);
  }
  return next.playoffs ? refreshPlayoffs(next) : next;
}

function refreshPlayoffs(session) {
  const start = session.groupRounds || session.rounds.length;
  return {
    ...session,
    rounds: session.rounds.map((round, index) => {
      if (index !== start || round.matches.some(isLocked)) {
        return round;
      }
      const plan = planRound(session, index);
      return {
        id: round.id,
        pending: Boolean(plan.pending),
        matches: plan.matches.map(freshMatch),
        byes: [...plan.byes],
        advancing: (plan.advancing || []).map((side) => [...side]),
      };
    }),
  };
}

export function standings(session) {
  const pointsMode = session.result === "points";
  const sitOut = pointsMode ? normalizeBonus(session.sitOutPoints) : 0;
  const winBonus = pointsMode ? normalizeBonus(session.winBonus) : 0;
  const drawBonus = pointsMode ? normalizeBonus(session.drawBonus) : 0;
  const lossBonus = pointsMode ? normalizeBonus(session.lossBonus) : 0;
  const rows = new Map(session.players.map((player) => [player.id, { id: player.id, name: player.name, points: 0, played: 0 }]));
  const add = (id, points, played) => {
    const row = rows.get(id);
    if (!row) {
      return;
    }
    row.points += points;
    row.played += played;
  };
  session.rounds.forEach((round) => {
    round.matches.forEach((match) => {
      if (!isComplete(match)) {
        return;
      }
      match.sideA.forEach((id) => add(id, match.scoreA, 1));
      match.sideB.forEach((id) => add(id, match.scoreB, 1));
      if (match.scoreA > match.scoreB) {
        if (winBonus) match.sideA.forEach((id) => add(id, winBonus, 0));
        if (lossBonus) match.sideB.forEach((id) => add(id, lossBonus, 0));
      } else if (match.scoreB > match.scoreA) {
        if (winBonus) match.sideB.forEach((id) => add(id, winBonus, 0));
        if (lossBonus) match.sideA.forEach((id) => add(id, lossBonus, 0));
      } else if (drawBonus) {
        [...match.sideA, ...match.sideB].forEach((id) => add(id, drawBonus, 0));
      }
    });
    const finished = sitOut > 0 && !round.pending && round.matches.length > 0 && round.matches.every(isComplete);
    if (finished) {
      round.byes.forEach((id) => add(id, sitOut, 0));
    }
  });
  const sorted = [...rows.values()].sort((left, right) => right.points - left.points || left.name.localeCompare(right.name));
  let rank = 0;
  return sorted.map((row, index) => {
    if (index === 0 || row.points !== sorted[index - 1].points) {
      rank = index + 1;
    }
    return { ...row, rank };
  });
}

export function scheduleBalance(session) {
  const rows = new Map(session.players.map((player) => [player.id, { id: player.id, name: player.name, matches: 0, sits: 0 }]));
  session.rounds.forEach((round) => {
    if (round.pending || round.matches.length === 0) {
      return;
    }
    round.matches.forEach((match) => {
      [...match.sideA, ...match.sideB].forEach((id) => {
        const row = rows.get(id);
        if (row) {
          row.matches += 1;
        }
      });
    });
    round.byes.forEach((id) => {
      const row = rows.get(id);
      if (row) {
        row.sits += 1;
      }
    });
  });
  return [...rows.values()];
}

export function minimumPlayers(format) {
  return format === "singles" ? 2 : 4;
}
