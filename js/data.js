// OBA Data Loading Utilities
const OBA = {
  seasons: ['exhibition', 'season1', 'season2'],
  seasonLabels: { exhibition: 'Exhibition', season1: 'Season 1', season2: 'Season 2' },
  currentSeason: localStorage.getItem('obaSeason') || 'season2',
  cache: {},

  async fetchJSON(path) {
    if (this.cache[path]) return this.cache[path];
    const res = await fetch(path);
    const data = await res.json();
    this.cache[path] = data;
    return data;
  },

  async getTeams(season) {
    season = season || this.currentSeason;
    return this.fetchJSON(`data/seasons/${season}/teams.json`);
  },

  async getPlayers(season) {
    season = season || this.currentSeason;
    return this.fetchJSON(`data/seasons/${season}/players.json`);
  },

  async getGames(season) {
    season = season || this.currentSeason;
    return this.fetchJSON(`data/seasons/${season}/games.json`);
  },

  async getAwards(season) {
    season = season || this.currentSeason;
    return this.fetchJSON(`data/seasons/${season}/awards.json`);
  },

  async getPhotos(season) {
    season = season || this.currentSeason;
    return this.fetchJSON(`data/seasons/${season}/photos.json`);
  },

  async getPowerRankings(season) {
    season = season || this.currentSeason;
    return this.fetchJSON(`data/seasons/${season}/power-rankings.json`);
  },

  async getPredictions(season) {
    season = season || this.currentSeason;
    return this.fetchJSON(`data/seasons/${season}/predictions.json`);
  },

  async getTeam(teamId) {
    const teams = await this.getTeams();
    return teams.find(t => t.id === teamId);
  },

  async getPlayer(playerId) {
    const players = await this.getPlayers();
    return players.find(p => p.id === playerId);
  },

  async getTeamPlayers(teamId) {
    const players = await this.getPlayers();
    return players.filter(p => p.teamId === teamId);
  },

  async getTeamRecord(teamId, season) {
    const games = await this.getGames(season);
    let wins = 0, losses = 0, draws = 0;
    games.filter(g => !g.round).forEach(g => {
      if (g.excludeRecord && g.excludeRecord.includes(teamId)) return;
      if (g.homeTeam === teamId) {
        g.homeScore > g.awayScore ? wins++ : g.homeScore < g.awayScore ? losses++ : draws++;
      } else if (g.awayTeam === teamId) {
        g.awayScore > g.homeScore ? wins++ : g.awayScore < g.homeScore ? losses++ : draws++;
      }
    });
    return { wins, losses, draws };
  },

  async getPlayerSeasonStats(playerId, season) {
    const games = await this.getGames(season);
    const stats = { gp: 0, pts: 0, reb: 0, ast: 0, stl: 0, blk: 0, to: 0, fgm: 0, fga: 0, tpm: 0, tpa: 0, ftm: 0, fta: 0 };
    const gameLogs = [];

    games.forEach(g => {
      let line = null, forTeam = null;
      for (const [tid, box] of Object.entries(g.boxScore)) {
        const found = box.find(b => b.playerId === playerId);
        if (found) { line = found; forTeam = tid; break; }
      }
      if (line) {
        if (!g.round && !line.fillin) {
          stats.gp++;
          Object.keys(stats).forEach(k => {
            if (k !== 'gp') stats[k] += line[k] || 0;
          });
        }
        gameLogs.push({ gameId: g.id, date: g.date, round: g.round, fillin: line.fillin, forTeam, homeTeam: g.homeTeam, awayTeam: g.awayTeam, homeScore: g.homeScore, awayScore: g.awayScore, ...line });
      }
    });

    return { totals: stats, gameLogs };
  },

  calcAverages(totals) {
    const gp = totals.gp || 1;
    return {
      ppg: (totals.pts / gp).toFixed(1),
      rpg: (totals.reb / gp).toFixed(1),
      apg: (totals.ast / gp).toFixed(1),
      spg: (totals.stl / gp).toFixed(1),
      bpg: (totals.blk / gp).toFixed(1),
      topg: (totals.to / gp).toFixed(1),
      fgPct: totals.fga ? (totals.fgm / totals.fga * 100).toFixed(1) : '0.0',
      tpPct: totals.tpa ? (totals.tpm / totals.tpa * 100).toFixed(1) : '0.0',
      ftPct: totals.fta ? (totals.ftm / totals.fta * 100).toFixed(1) : '0.0',
      fgmpg: (totals.fgm / gp).toFixed(1),
      fgapg: (totals.fga / gp).toFixed(1),
      tpmpg: (totals.tpm / gp).toFixed(1),
      tpapg: (totals.tpa / gp).toFixed(1),
      ftmpg: (totals.ftm / gp).toFixed(1),
      ftapg: (totals.fta / gp).toFixed(1),
    };
  },

  // ===== Team Context (for role-aware comps) =====
  // Returns totals for a team and per-player totals for everyone on the roster.
  // Regular-season only. Used by getPlayerComp to determine if a player is
  // their team's alpha, co-star, third option, or role player.
  async getTeamContext(teamId, season) {
    const games = await this.getGames(season);
    const teamTotals = { gp: 0, pts: 0, fga: 0, fta: 0, to: 0 };
    const playerTotals = {};

    games.forEach(g => {
      if (g.round) return;
      if (g.homeTeam !== teamId && g.awayTeam !== teamId) return;
      const isHome = g.homeTeam === teamId;
      const myScore = isHome ? g.homeScore : g.awayScore;
      teamTotals.gp++;
      teamTotals.pts += myScore;
      const box = g.boxScore[teamId];
      if (!box) return;
      box.forEach(line => {
        if (line.fillin) return;
        teamTotals.fga += line.fga || 0;
        teamTotals.fta += line.fta || 0;
        teamTotals.to += line.to || 0;
        if (!playerTotals[line.playerId]) {
          playerTotals[line.playerId] = { gp: 0, pts: 0, fga: 0, fta: 0, to: 0 };
        }
        const pt = playerTotals[line.playerId];
        pt.gp++;
        pt.pts += line.pts || 0;
        pt.fga += line.fga || 0;
        pt.fta += line.fta || 0;
        pt.to += line.to || 0;
      });
    });

    return {
      teamTotals,
      roster: Object.entries(playerTotals).map(([pid, t]) => ({ playerId: pid, totals: t }))
    };
  },

  // ===== Player Comp ("Plays Like") =====
  // Given a player's season totals + player record + optional team context,
  // return an NBA player comparison that matches their archetype and their
  // role on the team (alpha / costar / third / role / bench).
  // Returns { comp, rationale, archetype, teamRole } or null if not enough data.
  getPlayerComp(totals, player, teamContext) {
    if (!totals || totals.gp < 2) return null;
    const gp = totals.gp;
    const ppg = totals.pts / gp;
    const rpg = totals.reb / gp;
    const apg = totals.ast / gp;
    const spg = totals.stl / gp;
    const bpg = totals.blk / gp;
    const topg = totals.to / gp;
    const fgPct = totals.fga > 0 ? totals.fgm / totals.fga * 100 : 0;
    const tpPct = totals.tpa > 0 ? totals.tpm / totals.tpa * 100 : 0;
    const tsPct = (totals.fga + 0.44 * totals.fta) > 0 ? totals.pts / (2 * (totals.fga + 0.44 * totals.fta)) * 100 : 0;
    const tpaRate = totals.fga > 0 ? totals.tpa / totals.fga * 100 : 0;
    const ftRate = totals.fga > 0 ? totals.fta / totals.fga : 0;
    const pts2 = (totals.fgm - totals.tpm) * 2;
    const pts3 = totals.tpm * 3;
    const ptsFT = totals.ftm;
    const totalPts = pts2 + pts3 + ptsFT;
    const paintShare = totalPts > 0 ? pts2 / totalPts * 100 : 0;
    const fgaPg = totals.fga / gp;
    const ftaPg = totals.fta / gp;
    // Advanced stats (same formulas as Analytics panel 2)
    const eps2 = (totals.fga - totals.tpa) > 0 ? ((totals.fgm - totals.tpm) / (totals.fga - totals.tpa) * 2) : 0;
    const eps3 = totals.tpa > 0 ? (totals.tpm / totals.tpa * 3) : 0;
    const ptsPerPoss = (totals.fga + 0.44 * totals.fta + totals.to) > 0
      ? totals.pts / (totals.fga + 0.44 * totals.fta + totals.to) : 0;
    const gameScore = (totals.pts + 0.4 * totals.fgm - 0.7 * totals.fga - 0.4 * (totals.fta - totals.ftm)
      + 0.7 * totals.reb + totals.stl + 0.7 * totals.ast + 0.7 * totals.blk - totals.to) / gp;

    // Parse height (e.g., "6'2\"") → inches
    let heightInches = 72;
    if (player && player.height) {
      const m = String(player.height).match(/(\d+)\D+(\d+)/);
      if (m) heightInches = parseInt(m[1]) * 12 + parseInt(m[2]);
    }
    const isBig = heightInches >= 75;    // 6'3+
    const isTall = heightInches >= 77;   // 6'5+

    // ===== Team Role classification =====
    // alpha: #1 scorer with high pts share (≥30%)
    // costar: #1 or #2 scorer with meaningful share (22-30% or #2 with ≥20%)
    // third: #3 scorer with meaningful share (≥13%)
    // role: plays regularly but lower share
    // bench: deep rotation
    let teamRole = 'role';
    let ptsShare = 0;
    let usagePct = 0;
    let scoreRank = 0;
    if (teamContext && teamContext.teamTotals && teamContext.roster && teamContext.teamTotals.gp > 0) {
      const { teamTotals, roster } = teamContext;
      ptsShare = teamTotals.pts > 0 ? totals.pts / teamTotals.pts * 100 : 0;
      const teamPossPerGame = (teamTotals.fga + 0.44 * teamTotals.fta + teamTotals.to) / teamTotals.gp;
      const playerPossPerGame = (totals.fga + 0.44 * totals.fta + totals.to) / gp;
      usagePct = teamPossPerGame > 0 ? playerPossPerGame / teamPossPerGame * 100 : 0;

      const scorers = roster
        .filter(r => r.totals.gp >= 2)
        .map(r => ({ pid: r.playerId, ppg: r.totals.pts / r.totals.gp }))
        .sort((a, b) => b.ppg - a.ppg);
      scoreRank = (player && scorers.findIndex(s => s.pid === player.id) + 1) || 0;

      // Role classification: pts-share drives the top tiers, but a player with
      // strong contributions in rebounds/assists that adds up to meaningful
      // usage still gets "role" not "bench" even at low scoring.
      if (scoreRank === 1 && ptsShare >= 30) teamRole = 'alpha';
      else if (scoreRank === 1 || (scoreRank === 2 && ptsShare >= 20)) teamRole = 'costar';
      else if (scoreRank <= 4 && ptsShare >= 13) teamRole = 'third';
      else if (ppg >= 6 || usagePct >= 12) teamRole = 'role';
      else teamRole = 'bench';
    }

    // ===== Archetype classification (role-independent) =====
    // Signal-driven: even low-volume players should hit a descriptive archetype
    // based on their tendencies (shot selection, rebounding, defense) rather
    // than falling into a generic "deep-bench" bucket.
    let archetype;
    // Superstar tier (25+ PPG with supporting stats)
    if (ppg >= 25 && rpg >= 8 && apg >= 3) archetype = 'playmaking-fwd';
    else if (ppg >= 25) archetype = 'volume-scorer';
    // Dominant bigs (require actual height for point-big)
    else if (rpg >= 10 && apg >= 2.5 && isBig) archetype = 'point-big';
    else if (rpg >= 10 && isBig) archetype = 'double-double-big';
    else if (rpg >= 10 && apg >= 3) archetype = 'playmaking-fwd';
    else if (rpg >= 10) archetype = 'rebounding-fwd';
    // Forwards/rebounders
    else if (rpg >= 7 && apg >= 3) archetype = 'playmaking-fwd';
    else if (rpg >= 7 && ppg >= 10) archetype = 'rebounding-fwd';
    // Volume scoring (20+ PPG) — before slasher/sniper so primary scorers
    // aren't mislabeled by secondary shot-selection signals.
    else if (ppg >= 20) archetype = 'volume-scorer';
    // Facilitators
    else if (apg >= 5) archetype = 'lead-pg';
    else if (apg >= 3.5 && ppg < 12) archetype = 'secondary-pg';
    // Bigs (post / rim)
    else if (isBig && paintShare >= 75 && ppg >= 12) archetype = 'post-scorer';
    else if (isBig && fgPct >= 55 && paintShare >= 70 && fgaPg >= 4) archetype = 'rim-runner';
    // Snipers (high volume)
    else if (tpaRate >= 55 && tpPct >= 35 && fgaPg >= 5) archetype = 'sniper-elite';
    else if (tpaRate >= 45 && fgaPg >= 4) archetype = 'sniper';
    // Slashers (high volume)
    else if (ftRate >= 0.45 && ppg >= 14 && rpg < 7) archetype = 'slasher-elite';
    else if (ftRate >= 0.40 && ppg >= 12 && rpg < 6) archetype = 'slasher';
    // Two-way / defensive wings
    else if (spg >= 1.5 && bpg >= 0.5) archetype = 'two-way-wing';
    else if (spg >= 1.3 && ppg >= 10) archetype = 'defensive-wing';
    else if (bpg >= 1.0) archetype = 'rim-protector';
    // Mid-volume scorers
    else if (ppg >= 14) archetype = 'mid-scorer';
    else if (ppg >= 10 && tsPct >= 55 && tpaRate >= 25) archetype = 'efficient-role';
    // ===== Bench-tier archetypes (lower volume but still identifiable style) =====
    // Bench rebounder: contributes on the glass without scoring volume.
    // Checked first because rebounding is a strong, unambiguous signal.
    else if (rpg >= 4 && ppg < 10) archetype = 'bench-hustle';
    // Bench connector: ball-mover who isn't a primary creator
    else if (apg >= 1.5 && apg / Math.max(ppg, 1) >= 0.25 && ppg < 10) archetype = 'bench-connector';
    // Bench defender: produces steals/blocks without needing the ball
    else if ((spg >= 0.8 || bpg >= 0.6) && ppg < 10) archetype = 'bench-defender';
    // Bench slasher: gets to the line at his volume level
    else if (ftRate >= 0.35 && ftaPg >= 1 && ppg < 12) archetype = 'bench-slasher';
    // Bench sniper: takes threes (lower volume than the main sniper tier)
    else if (tpaRate >= 40 && fgaPg >= 1.5) archetype = 'bench-sniper';
    // Efficient low-volume scorer: high TS% on any volume
    else if (tsPct >= 55 && fgaPg >= 2) archetype = 'efficient-role';
    // Tiebreaker: EPS-3 significantly better than EPS-2 → shooter-leaning
    else if (eps3 > eps2 && tpaRate >= 30) archetype = 'bench-sniper';
    // Tiebreaker: paint-scoring-leaning (EPS-2 strong, FT rate moderate)
    else if (eps2 >= 1.0 && paintShare >= 60 && isBig) archetype = 'bench-interior';
    // Generic role player (still has some volume)
    else if (ppg >= 6) archetype = 'role-scorer';
    // Truly deep bench (minimal minutes/stats)
    else archetype = 'deep-bench';

    // ===== Archetype × Role comp table =====
    // Each entry returns { comp, rationale }. Order of lookup within an
    // archetype: teamRole → 'default'. If no match, falls through to 'default'.
    const T = {
      'point-big': {
        alpha: { comp: 'Nikola Jokić', rationale: 'Offensive hub big — scoring, rebounding, and orchestrating from the post. The offense runs through him.' },
        costar: { comp: 'Domantas Sabonis', rationale: 'Co-star big who dominates the glass and facilitates from the elbow.' },
        default: { comp: 'Alperen Şengün', rationale: 'Skilled passing big — finds shooters out of double-teams.' }
      },
      'double-double-big': {
        alpha: { comp: 'Joel Embiid', rationale: 'Interior alpha — draws fouls and scores at will while dominating the glass.' },
        costar: { comp: 'Karl-Anthony Towns', rationale: 'Co-star big — scores inside and out while controlling the boards.' },
        default: { comp: 'Rudy Gobert', rationale: 'Paint anchor — rebounds and protects the rim without demanding touches.' }
      },
      'rebounding-fwd': {
        alpha: { comp: 'Zach Randolph', rationale: 'Old-school alpha forward — bullies defenders inside and owns the glass.' },
        costar: { comp: 'Tristan Thompson', rationale: 'Hustle co-star — cleans the glass and finishes what teammates set up.' },
        default: { comp: 'Kenneth Faried', rationale: 'Energy-first rebounder who wins possessions through motor and positioning.' }
      },
      'energy-rebounder': {
        default: { comp: 'Kenneth Faried', rationale: 'Pure energy — rebounds, hustles, plays bigger than the numbers say.' }
      },
      'playmaking-fwd': {
        alpha: { comp: 'LeBron James', rationale: 'Triple-threat wing — scores, rebounds, and runs the offense.' },
        costar: { comp: 'Draymond Green', rationale: 'Connective co-star — rebounds, passes, defends multiple positions.' },
        default: { comp: 'Aaron Gordon', rationale: 'Versatile forward — fills gaps and makes plays without demanding the ball.' }
      },
      'lead-pg': {
        alpha: { comp: 'Chris Paul', rationale: 'Floor general — runs the offense, controls pace, picks his spots.' },
        costar: { comp: 'Tyrese Haliburton', rationale: 'Pass-first co-star — makes teammates better without hogging shots.' },
        default: { comp: 'Rajon Rondo', rationale: 'Pure orchestrator — vision over volume, sets the table.' }
      },
      'secondary-pg': {
        default: { comp: 'Rajon Rondo', rationale: 'Pass-first bench floor general — orchestrates when on the court.' }
      },
      'post-scorer': {
        alpha: { comp: 'Joel Embiid', rationale: 'Post-dominant alpha — scores in the paint, lives at the line.' },
        costar: { comp: 'Zach Randolph', rationale: 'Post-scoring co-star — backs defenders down and finishes through contact.' },
        default: { comp: 'Jusuf Nurkić', rationale: 'Interior complement — picks up easy buckets in and around the paint.' }
      },
      'rim-runner': {
        alpha: { comp: 'Deandre Ayton', rationale: 'Interior focal point — finishes at a high clip, rebounds everything.' },
        costar: { comp: 'Clint Capela', rationale: 'Efficient rim-running co-star — lob threat and clean-up scorer.' },
        default: { comp: 'Mitchell Robinson', rationale: 'Role-playing finisher — dunks and rebounds, nothing fancy.' }
      },
      'sniper-elite': {
        alpha: { comp: 'Stephen Curry', rationale: 'Elite shooter AND offensive engine — rarest combo in basketball.' },
        costar: { comp: 'Klay Thompson', rationale: 'Co-star sniper — catch-and-shoot assassin alongside a primary creator.' },
        default: { comp: 'Buddy Hield', rationale: 'Designated gunner — enters, shoots threes, punishes closeouts.' }
      },
      'sniper': {
        alpha: { comp: 'Damian Lillard', rationale: 'High-usage alpha guard with deep range.' },
        costar: { comp: 'Desmond Bane', rationale: 'Modern co-star shooter — efficient threes, some off-dribble creation.' },
        // Role-tier shooters split by accuracy so not everyone is Duncan Robinson
        default: ({ tpPct, tsPct }) => {
          if (tpPct >= 38) return { comp: 'Seth Curry', rationale: 'Ruthlessly efficient role shooter — makes you pay for leaving him.' };
          if (tpPct >= 32) return { comp: 'Duncan Robinson', rationale: 'Specialist shooter — spaces the floor, nothing more.' };
          return { comp: 'Georges Niang', rationale: 'Willing shooter — lets it fly from deep, variance-heavy.' };
        }
      },
      'shooter': {
        default: { comp: 'JJ Redick', rationale: 'Movement shooter — punishes closeouts with a quick release.' }
      },
      'slasher-elite': {
        alpha: { comp: 'James Harden', rationale: 'Foul-drawing alpha — creates for self and teammates off the dribble.' },
        costar: { comp: 'Ja Morant', rationale: 'Explosive co-star attacker — gets to the rim off the catch.' },
        default: { comp: 'Dwyane Wade', rationale: 'Veteran slasher — crafty, gets to the line, scores off attacks.' }
      },
      'slasher': {
        default: { comp: 'Dejounte Murray', rationale: 'Crafty attacker — gets to his spots, draws fouls, scores downhill.' }
      },
      'two-way-wing': {
        alpha: { comp: 'Kawhi Leonard', rationale: 'Two-way alpha — shuts down the best scorer and produces on offense.' },
        costar: { comp: 'Jimmy Butler', rationale: 'Two-way co-star — high motor on defense, reliable scorer on offense.' },
        default: { comp: 'OG Anunoby', rationale: 'Defensive wing who hits open threes and makes the right play.' }
      },
      'defensive-wing': {
        default: { comp: 'Marcus Smart', rationale: 'Defensive pest — turns steals into transition offense.' }
      },
      'rim-protector': {
        default: { comp: 'Bam Adebayo', rationale: 'Defensive anchor with modern mobility — switches everything.' }
      },
      'volume-scorer': {
        alpha: { comp: 'Devin Booker', rationale: 'Primary scoring option — the offense runs through him, scores on volume.' },
        costar: { comp: 'Jaylen Brown', rationale: 'High-volume co-star — scores without needing to orchestrate.' },
        default: { comp: 'Tyler Herro', rationale: 'Instant offense — racks up points while the stars demand the defense\'s attention.' }
      },
      'mid-scorer': {
        alpha: { comp: 'DeMar DeRozan', rationale: 'Mid-range alpha — gets buckets the old-fashioned way, with or without threes.' },
        costar: { comp: 'Khris Middleton', rationale: 'Reliable co-star — quiet 18 every night without demanding the ball.' },
        third: { comp: 'Malcolm Brogdon', rationale: '3rd-option scorer — efficient, two-way, picks his spots.' },
        default: { comp: 'Norman Powell', rationale: 'Bench scorer — comes in hot and keeps the offense humming.' }
      },
      'efficient-role': {
        default: { comp: 'Mikal Bridges', rationale: '3-and-D role player — efficient scoring with defensive credibility.' }
      },
      'role-scorer': {
        default: { comp: 'Seth Curry', rationale: 'Efficient role scorer — takes his shots when the offense finds him.' }
      },
      // ===== Bench tier — each has a distinct identity =====
      'bench-hustle': {
        default: { comp: 'Bruce Brown', rationale: 'Energy role player — rebounds, cuts, does the little things without needing plays called.' }
      },
      'bench-connector': {
        default: { comp: 'Derrick White', rationale: 'Bench connector — moves the ball, makes the right pass, plays within the offense.' }
      },
      'bench-defender': {
        default: { comp: 'Alex Caruso', rationale: 'Defensive specialist — creates chaos with his hands and IQ without demanding touches.' }
      },
      'bench-slasher': {
        default: { comp: 'Gary Trent Jr.', rationale: 'Bench attacker — gets to the line when he drives, picks his spots.' }
      },
      'bench-sniper': {
        default: ({ tpPct }) => {
          if (tpPct >= 38) return { comp: 'Joe Harris', rationale: 'Spot-up shooter — camps in the corner and punishes help defense.' };
          if (tpPct >= 30) return { comp: 'Cam Johnson', rationale: 'Corner-three specialist — steady release, plays within role.' };
          return { comp: 'Malik Beasley', rationale: 'Willing gunner — lets it fly regardless of the last one.' };
        }
      },
      'bench-interior': {
        default: { comp: 'Jusuf Nurkić', rationale: 'Bench big who scores in the paint and controls his area.' }
      },
      'deep-bench': {
        default: { comp: 'Pat Connaughton', rationale: 'Versatile deep-bench contributor — minimal stats, fills whatever role is needed.' }
      }
    };

    const archetypeComps = T[archetype] || T['role-scorer'];
    let pickedEntry = archetypeComps[teamRole] || archetypeComps.default || archetypeComps.costar || archetypeComps.alpha;
    // Entries can be a function for profile-driven tiebreaking (e.g. sniper
    // role-tier split by 3P%). Resolve against the advanced-stats bundle.
    const profile = { tpPct, tsPct, fgPct, eps2, eps3, ftRate, ptsPerPoss, paintShare, ppg, rpg, apg, gameScore };
    const picked = typeof pickedEntry === 'function' ? pickedEntry(profile) : pickedEntry;
    return {
      comp: picked.comp,
      rationale: picked.rationale,
      archetype,
      teamRole,
      ptsShare: +ptsShare.toFixed(1),
      usagePct: +usagePct.toFixed(1),
      scoreRank,
      gameScore: +gameScore.toFixed(1)
    };
  },

  formatDate(dateStr) {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  },

  getParam(name) {
    return new URLSearchParams(window.location.search).get(name);
  },

  // Build shared navigation HTML
  renderNav(activePage) {
    const links = [
      { href: 'index.html', label: 'Home', id: 'home' },
      { href: 'schedule.html', label: 'Schedule', id: 'schedule' },
      { href: 'teams.html', label: 'Teams', id: 'teams' },
      // { href: 'photos.html', label: 'Photos', id: 'photos' },
      { href: 'power-rankings.html', label: 'Rankings', id: 'power-rankings' },
      { href: 'predictions.html', label: 'Predictions', id: 'predictions' },
      { href: 'records.html', label: 'Records', id: 'records' },
      { href: 'awards.html', label: 'Awards', id: 'awards' },
    ];
    const nav = document.getElementById('site-nav');
    if (!nav) return;
    const seasonOptions = this.seasons.map(s =>
      `<option value="${s}" ${s === this.currentSeason ? 'selected' : ''}>${this.seasonLabels[s]}</option>`
    ).join('');
    nav.innerHTML = `
      <div class="nav-inner">
        <a href="index.html" class="nav-logo"><img src="images/OBALogo.png" alt="OBA" class="nav-logo-img">OBA</a>
        <button class="nav-toggle" onclick="document.querySelector('.nav-links').classList.toggle('open')" aria-label="Menu">&#9776;</button>
        <ul class="nav-links">
          ${links.map(l => `<li><a href="${l.href}" class="${activePage === l.id ? 'active' : ''}">${l.label}</a></li>`).join('')}
          <li class="season-selector">
            <select id="season-select" onchange="OBA.switchSeason(this.value)">
              ${seasonOptions}
            </select>
          </li>
        </ul>
      </div>
    `;
  },

  switchSeason(season) {
    localStorage.setItem('obaSeason', season);
    // Go to index page when switching seasons (team/player/game IDs may not exist across seasons)
    window.location.href = 'index.html';
  },

  renderFooter() {
    const footer = document.getElementById('site-footer');
    if (!footer) return;
    footer.innerHTML = `<p>&copy; ${new Date().getFullYear()} Ordinary Basketball Association &mdash; A Church Basketball League</p>`;
  }
};

// ============================================================
// Number count-up for hero stats (.avg-card .value).
// Watches the DOM for newly-rendered stat cards and animates
// their number from 0 to the final value. Respects
// prefers-reduced-motion and only runs once per element.
// ============================================================
(function() {
  if (typeof document === 'undefined') return;
  const reducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reducedMotion) return;

  function animateCount(el) {
    if (el.dataset.obaAnimated) return;
    const raw = el.textContent.trim();
    const match = raw.match(/^(-?[\d.]+)(.*)$/);
    if (!match) return;
    const final = parseFloat(match[1]);
    const suffix = match[2] || '';
    if (!isFinite(final) || final === 0) return;
    el.dataset.obaAnimated = '1';
    const decimals = (match[1].split('.')[1] || '').length;
    const duration = 650;
    const start = performance.now();
    el.textContent = (0).toFixed(decimals) + suffix;
    function step(now) {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      const val = final * eased;
      el.textContent = val.toFixed(decimals) + suffix;
      if (t < 1) requestAnimationFrame(step);
      else el.textContent = raw;
    }
    requestAnimationFrame(step);
  }

  function scan(root) {
    if (!root || !root.querySelectorAll) return;
    root.querySelectorAll('.avg-card .value').forEach(animateCount);
  }

  // Initial scan on load
  document.addEventListener('DOMContentLoaded', () => scan(document.body));

  // Watch for async-rendered content
  const mo = new MutationObserver(muts => {
    for (const m of muts) {
      for (const n of m.addedNodes) {
        if (n.nodeType !== 1) continue;
        if (n.matches && n.matches('.avg-card .value')) animateCount(n);
        else scan(n);
      }
    }
  });
  mo.observe(document.documentElement, { childList: true, subtree: true });
})();
