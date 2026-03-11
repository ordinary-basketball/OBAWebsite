(async function() {
  OBA.renderNav('awards');
  OBA.renderFooter();

  const [awards, players, teams, games] = await Promise.all([
    OBA.getAwards(), OBA.getPlayers(), OBA.getTeams(), OBA.getGames()
  ]);

  const playerMap = Object.fromEntries(players.map(p => [p.id, p]));
  const teamMap = Object.fromEntries(teams.map(t => [t.id, t]));

  // --- Compute all player & team stats from games ---
  const playerStats = {};
  const teamStats = {};
  teams.forEach(t => {
    teamStats[t.id] = { wins: 0, losses: 0, gp: 0, ptsFor: 0, ptsAgainst: 0 };
  });

  games.filter(g => !g.round).forEach(g => {
    [
      [g.homeTeam, g.homeScore, g.awayScore],
      [g.awayTeam, g.awayScore, g.homeScore]
    ].forEach(([tid, pf, pa]) => {
      if (!teamStats[tid]) return;
      teamStats[tid].gp++;
      teamStats[tid].ptsFor += pf;
      teamStats[tid].ptsAgainst += pa;
      if (pf > pa) teamStats[tid].wins++;
      else teamStats[tid].losses++;
    });

    Object.values(g.boxScore).flat().forEach(line => {
      if (!playerStats[line.playerId]) {
        playerStats[line.playerId] = { gp: 0, pts: 0, reb: 0, ast: 0, stl: 0, blk: 0, to: 0, fgm: 0, fga: 0, tpm: 0, tpa: 0, ftm: 0, fta: 0 };
      }
      const s = playerStats[line.playerId];
      s.gp++;
      ['pts','reb','ast','stl','blk','to','fgm','fga','tpm','tpa','ftm','fta'].forEach(k => {
        s[k] += line[k] || 0;
      });
    });
  });

  // Per-game averages and Game Score
  Object.keys(playerStats).forEach(pid => {
    const s = playerStats[pid];
    const gp = s.gp || 1;
    s.ppg = s.pts / gp;
    s.rpg = s.reb / gp;
    s.apg = s.ast / gp;
    s.spg = s.stl / gp;
    s.bpg = s.blk / gp;
    s.topg = s.to / gp;
    // Hollinger Game Score (adapted: no PF, combined REB)
    s.gameScore = (s.pts + 0.4*s.fgm - 0.7*s.fga - 0.4*(s.fta - s.ftm) + 0.7*s.reb + s.stl + 0.7*s.ast + 0.7*s.blk - s.to) / gp;
  });

  // League-wide averages
  const activeTeamIds = Object.keys(teamStats).filter(id => teamStats[id].gp > 0);
  const leagueAvgOppPPG = activeTeamIds.reduce((sum, id) => sum + teamStats[id].ptsAgainst / teamStats[id].gp, 0) / activeTeamIds.length;

  // Eligibility: minimum 2 games played
  const minGP = 2;
  const eligible = Object.keys(playerStats).filter(pid => playerStats[pid].gp >= minGP && playerMap[pid]);

  // --- Award Algorithms ---

  // MVP: Game Score per game + team record boost
  function computeMVP() {
    return eligible.map(pid => {
      const s = playerStats[pid];
      const ts = teamStats[playerMap[pid].teamId];
      const winPct = ts.gp > 0 ? ts.wins / ts.gp : 0.5;
      const score = s.gameScore * (1 + 0.3 * (winPct - 0.5));
      return { playerId: pid, score, stats: `${s.ppg.toFixed(1)} PPG, ${s.rpg.toFixed(1)} RPG, ${s.apg.toFixed(1)} APG` };
    }).sort((a, b) => b.score - a.score).slice(0, 5);
  }

  // DPOY: Steals + Blocks weighted, rebounds, team defense factor
  function computeDPOY() {
    return eligible.map(pid => {
      const s = playerStats[pid];
      const ts = teamStats[playerMap[pid].teamId];
      const oppPPG = ts.gp > 0 ? ts.ptsAgainst / ts.gp : leagueAvgOppPPG;
      const teamDefFactor = 1 + 0.3 * ((leagueAvgOppPPG - oppPPG) / (leagueAvgOppPPG || 1));
      const score = (s.spg * 3 + s.bpg * 3 + s.rpg * 0.8) * teamDefFactor;
      return { playerId: pid, score, stats: `${s.spg.toFixed(1)} SPG, ${s.bpg.toFixed(1)} BPG, ${s.rpg.toFixed(1)} RPG` };
    }).sort((a, b) => b.score - a.score).slice(0, 5);
  }

  // 6th Man: Exclude starters, rank bench players by Game Score
  function compute6thMan() {
    const starters = new Set([
      'nathanp','austini','andrewp','ryanc','ericl',
      'mattp','kangheel','benn','chrish','davidk',
      'seanl','christiank','justinp','joshp','ethanl',
      'pjop','wonjinj','isaacs1','justinh','pjun',
      'aronk','jonh','jonathanc','brandonk','joshs'
    ]);
    return eligible.filter(pid => !starters.has(pid)).map(pid => {
      const s = playerStats[pid];
      return { playerId: pid, score: s.gameScore, stats: `${s.ppg.toFixed(1)} PPG, ${s.rpg.toFixed(1)} RPG, ${s.apg.toFixed(1)} APG` };
    }).sort((a, b) => b.score - a.score).slice(0, 5);
  }

  // MIP: Compare current season vs season1 stats for returning players
  async function computeMIP() {
    if (OBA.currentSeason === 'season1') return null;
    try {
      const s1Games = await OBA.getGames('season1');
      const s1Stats = {};
      s1Games.filter(g => !g.round).forEach(g => {
        Object.values(g.boxScore).flat().forEach(line => {
          if (!s1Stats[line.playerId]) {
            s1Stats[line.playerId] = { gp: 0, pts: 0, reb: 0, ast: 0, stl: 0, blk: 0, fgm: 0, fga: 0, ftm: 0, fta: 0 };
          }
          const s = s1Stats[line.playerId];
          s.gp++;
          ['pts','reb','ast','stl','blk','fgm','fga','ftm','fta'].forEach(k => { s[k] += line[k] || 0; });
        });
      });
      const returning = eligible.filter(pid => s1Stats[pid] && s1Stats[pid].gp >= 2);
      if (returning.length === 0) return null;
      return returning.map(pid => {
        const s2 = playerStats[pid];
        const s1 = s1Stats[pid];
        const s1ppg = s1.pts / s1.gp;
        const s1rpg = s1.reb / s1.gp;
        const s1apg = s1.ast / s1.gp;
        // True Shooting %
        const s1ts = (s1.fga + 0.44 * s1.fta) > 0 ? s1.pts / (2 * (s1.fga + 0.44 * s1.fta)) : 0;
        const s2ts = (s2.fga + 0.44 * s2.fta) > 0 ? s2.pts / (2 * (s2.fga + 0.44 * s2.fta)) : 0;
        const ppgDiff = s2.ppg - s1ppg;
        const rpgDiff = s2.rpg - s1rpg;
        const apgDiff = s2.apg - s1apg;
        const tsDiff = s2ts - s1ts;
        const score = ppgDiff * 2 + rpgDiff + apgDiff + tsDiff * 10;
        const sign = ppgDiff >= 0 ? '+' : '';
        return { playerId: pid, score, stats: `${sign}${ppgDiff.toFixed(1)} PPG (${s1ppg.toFixed(1)} \u2192 ${s2.ppg.toFixed(1)})` };
      }).sort((a, b) => b.score - a.score).slice(0, 5);
    } catch (e) {
      return null;
    }
  }

  // --- Rendering ---

  function playerCard(playerId) {
    const p = playerMap[playerId];
    if (!p) return { name: 'Unknown', teamName: '', id: playerId };
    const t = teamMap[p.teamId];
    return { name: p.name, teamName: t ? t.name : '', id: p.id };
  }

  function renderWinner(title, icon, awardData) {
    if (!awardData) return '';
    const p = playerCard(awardData.playerId);
    return `
      <div class="award-card">
        <div class="award-header">${title}</div>
        <div class="award-body">
          <div class="award-icon">${icon}</div>
          <div class="player-name"><a href="player.html?id=${p.id}">${p.name}</a></div>
          <div class="player-team">${p.teamName}</div>
          ${awardData.highlights ? `<div class="highlights">${awardData.highlights}</div>` : ''}
        </div>
      </div>`;
  }

  function renderFrontrunners(title, icon, runners) {
    if (!runners || runners.length === 0) {
      return `
        <div class="award-card">
          <div class="award-header">${title}</div>
          <div class="award-body">
            <div class="award-icon">${icon}</div>
            <div class="highlights">Not enough data yet</div>
          </div>
        </div>`;
    }
    return `
      <div class="award-card frontrunner-card">
        <div class="award-header">${title}</div>
        <div class="award-body">
          <div class="award-icon">${icon}</div>
          <div class="frontrunners-label">Frontrunners</div>
          <ol class="frontrunners-list">
            ${runners.map(r => {
              const p = playerCard(r.playerId);
              return `
                <li>
                  <a href="player.html?id=${p.id}" class="frontrunner-name">${p.name}</a>
                  <span class="frontrunner-team">${p.teamName}</span>
                  <span class="frontrunner-stats">${r.stats}</span>
                </li>`;
            }).join('')}
          </ol>
        </div>
      </div>`;
  }

  function renderAward(title, icon, awardData, frontrunners) {
    if (awardData) return renderWinner(title, icon, awardData);
    return renderFrontrunners(title, icon, frontrunners);
  }

  function renderAllTeam(title, playerIds) {
    if (!playerIds || playerIds.length === 0) return '';
    return `
      <div class="all-team-section">
        <h2>${title}</h2>
        <div class="all-team-list">
          ${playerIds.map(id => {
            const p = playerCard(id);
            return `
              <a href="player.html?id=${p.id}" class="all-team-player">
                <div class="name">${p.name}</div>
                <div class="team">${p.teamName}</div>
              </a>`;
          }).join('')}
        </div>
      </div>`;
  }

  // Compute frontrunners for any null awards
  const mvpRunners = !awards.mvp ? computeMVP() : null;
  const dpoyRunners = !awards.dpoy ? computeDPOY() : null;
  const sixthManRunners = !awards.sixthMan ? compute6thMan() : null;
  const mipRunners = (awards.mip === null || awards.mip === undefined) ? await computeMIP() : null;

  let html = '<div class="awards-grid">';
  html += renderAward('Most Valuable Player', '\u{1F3C6}', awards.mvp, mvpRunners);
  html += renderAward('Defensive Player of the Year', '\u{1F6E1}\u{FE0F}', awards.dpoy, dpoyRunners);
  html += renderAward('6th Man of the Year', '\u{1F4AA}', awards.sixthMan, sixthManRunners);
  if (awards.mip !== undefined) {
    html += renderAward('Most Improved Player', '\u{1F4C8}', awards.mip, mipRunners);
  }

  // Fun awards (only when assigned)
  const fun = awards.funAwards;
  if (fun) {
    if (fun.bestCelebration) html += renderWinner('Best Celebration', '\u{1F389}', fun.bestCelebration);
    if (fun.bestTrashTalker) html += renderWinner('Best Trash Talker (in love)', '\u{1F5E3}\u{FE0F}', fun.bestTrashTalker);
    if (fun.mrHustle) html += renderWinner('Mr. Hustle', '\u{1F525}', fun.mrHustle);
  }
  html += '</div>';

  if (awards.eligibilityNote) {
    html += `<p class="awards-eligibility">${awards.eligibilityNote}</p>`;
  }

  html += renderAllTeam('All-OBA First Team', awards.allOBA);
  html += renderAllTeam('All-OBA Defensive Team', awards.allDefense);

  // Playoff awards
  if (awards.finalsMvp || awards.playoffMvp) {
    html += '<h2 class="awards-section-header">Playoff Awards</h2>';
    html += '<div class="awards-grid">';
    if (awards.finalsMvp) html += renderWinner('Finals MVP', '\u{1F3C6}', awards.finalsMvp);
    if (awards.playoffMvp) html += renderWinner('Playoff MVP', '\u{1F31F}', awards.playoffMvp);
    html += '</div>';
  }

  document.getElementById('awards-content').innerHTML = html;
})();
