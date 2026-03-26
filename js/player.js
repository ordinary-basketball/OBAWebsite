(async function() {
  OBA.renderNav('');
  OBA.renderFooter();

  const playerId = OBA.getParam('id');
  if (!playerId) {
    document.getElementById('player-content').innerHTML = '<p class="loading">Player not found.</p>';
    return;
  }

  const [player, teams] = await Promise.all([OBA.getPlayer(playerId), OBA.getTeams()]);
  if (!player) {
    document.getElementById('player-content').innerHTML = '<p class="loading">Player not found.</p>';
    return;
  }

  const team = teams.find(t => t.id === player.teamId);
  const { totals, gameLogs } = await OBA.getPlayerSeasonStats(playerId);
  const avg = OBA.calcAverages(totals);

  // Compute playoff stats
  const playoffLogs = gameLogs.filter(g => g.round);
  let playoffAvg = null;
  if (playoffLogs.length > 0) {
    const pTotals = { gp: 0, pts: 0, reb: 0, ast: 0, stl: 0, blk: 0, to: 0, fgm: 0, fga: 0, tpm: 0, tpa: 0, ftm: 0, fta: 0 };
    playoffLogs.forEach(g => {
      pTotals.gp++;
      ['pts','reb','ast','stl','blk','to','fgm','fga','tpm','tpa','ftm','fta'].forEach(k => pTotals[k] += g[k] || 0);
    });
    playoffAvg = OBA.calcAverages(pTotals);
    playoffAvg.gp = pTotals.gp;
  }

  // Gather stats across all seasons (exclude exhibition from records)
  const recordSeasons = OBA.seasons.filter(s => s !== 'exhibition');
  const seasonRows = [];
  const allLogs = [];
  for (const s of recordSeasons) {
    try {
      const { totals: sTotals, gameLogs: sLogs } = await OBA.getPlayerSeasonStats(playerId, s);
      sLogs.forEach(g => allLogs.push({ ...g, season: s }));
      if (sTotals.gp > 0) {
        const sAvg = OBA.calcAverages(sTotals);
        let sTeamName = '';
        try {
          const sPlayers = await OBA.getPlayers(s);
          const sPlayer = sPlayers.find(p => p.id === playerId);
          if (sPlayer) {
            const sTeams = await OBA.getTeams(s);
            const sTeam = sTeams.find(t => t.id === sPlayer.teamId);
            if (sTeam) sTeamName = sTeam.name;
          }
        } catch(e) {}
        seasonRows.push({ season: s, label: OBA.seasonLabels[s] || s, team: sTeamName, gp: sTotals.gp, avg: sAvg });
      }
    } catch(e) {}
  }

  // Compute career highs from all game logs
  const highCategories = [
    { key: 'pts', label: 'PTS' },
    { key: 'reb', label: 'REB' },
    { key: 'ast', label: 'AST' },
    { key: 'stl', label: 'STL' },
    { key: 'blk', label: 'BLK' },
    { key: 'tpm', label: '3PM' },
  ];
  const careerHighs = highCategories.map(cat => {
    let best = null;
    allLogs.forEach(g => {
      const val = g[cat.key] || 0;
      if (!best || val > best.val) best = { val, game: g };
    });
    return { ...cat, best };
  }).filter(h => h.best && h.best.val > 0);

  document.title = `${player.name} - OBA`;

  const initials = player.name.split(' ').map(n => n[0]).join('');

  document.getElementById('player-content').innerHTML = `
    <div class="player-header" style="background: linear-gradient(135deg, ${team.color}, ${team.colorSecondary || team.color})">
      <div class="player-avatar">${initials}</div>
      <div class="player-info">
        <h1>${player.name}</h1>
        <div class="player-meta">
          <span><a href="team.html?id=${team.id}" style="color:var(--cream)">${team.name}</a></span>
          <span>${player.position}</span>
          <span>${player.height}</span>
        </div>
      </div>
    </div>

    <h2 class="section-title">Season Averages</h2>
    <div class="averages-grid">
      <div class="avg-card"><div class="value">${avg.ppg}</div><div class="label">PPG</div></div>
      <div class="avg-card"><div class="value">${avg.rpg}</div><div class="label">RPG</div></div>
      <div class="avg-card"><div class="value">${avg.apg}</div><div class="label">APG</div></div>
      <div class="avg-card"><div class="value">${avg.spg}</div><div class="label">SPG</div></div>
      <div class="avg-card"><div class="value">${avg.bpg}</div><div class="label">BPG</div></div>
      <div class="avg-card"><div class="value">${avg.fgPct}%</div><div class="label">FG%</div></div>
      <div class="avg-card"><div class="value">${avg.tpPct}%</div><div class="label">3P%</div></div>
      <div class="avg-card"><div class="value">${avg.ftPct}%</div><div class="label">FT%</div></div>
    </div>

    ${playoffAvg ? `
    <h2 class="section-title">Playoff Averages <span class="playoff-gp">(${playoffAvg.gp} game${playoffAvg.gp > 1 ? 's' : ''})</span></h2>
    <div class="averages-grid playoff-averages">
      <div class="avg-card"><div class="value">${playoffAvg.ppg}</div><div class="label">PPG</div></div>
      <div class="avg-card"><div class="value">${playoffAvg.rpg}</div><div class="label">RPG</div></div>
      <div class="avg-card"><div class="value">${playoffAvg.apg}</div><div class="label">APG</div></div>
      <div class="avg-card"><div class="value">${playoffAvg.spg}</div><div class="label">SPG</div></div>
      <div class="avg-card"><div class="value">${playoffAvg.bpg}</div><div class="label">BPG</div></div>
      <div class="avg-card"><div class="value">${playoffAvg.fgPct}%</div><div class="label">FG%</div></div>
      <div class="avg-card"><div class="value">${playoffAvg.tpPct}%</div><div class="label">3P%</div></div>
      <div class="avg-card"><div class="value">${playoffAvg.ftPct}%</div><div class="label">FT%</div></div>
    </div>
    ` : ''}

    ${seasonRows.length > 1 ? `
    <h2 class="section-title">Season-by-Season</h2>
    <div class="table-wrapper">
      <table class="stats-table season-by-season">
        <thead>
          <tr>
            <th>Season</th><th>Team</th><th>GP</th><th>PPG</th><th>RPG</th><th>APG</th><th>SPG</th><th>BPG</th><th>FG</th><th>FG%</th><th>3PT</th><th>3P%</th><th>FT</th><th>FT%</th>
          </tr>
        </thead>
        <tbody>
          ${seasonRows.map(r => `<tr class="${r.season === OBA.currentSeason ? 'current-season-row' : ''}">
            <td>${r.label}</td><td>${r.team}</td><td>${r.gp}</td>
            <td>${r.avg.ppg}</td><td>${r.avg.rpg}</td><td>${r.avg.apg}</td>
            <td>${r.avg.spg}</td><td>${r.avg.bpg}</td>
            <td>${r.avg.fgmpg}/${r.avg.fgapg}</td><td>${r.avg.fgPct}%</td><td>${r.avg.tpmpg}/${r.avg.tpapg}</td><td>${r.avg.tpPct}%</td><td>${r.avg.ftmpg}/${r.avg.ftapg}</td><td>${r.avg.ftPct}%</td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>
    ` : ''}

    ${careerHighs.length > 0 ? `
    <h2 class="section-title">Career Highs</h2>
    <div class="career-highs-grid">
      ${careerHighs.map(h => {
        const g = h.best.game;
        const myTeam = g.forTeam || player.teamId;
        const oppId = g.homeTeam === myTeam ? g.awayTeam : g.homeTeam;
        return `<a href="game.html?id=${g.gameId}" class="career-high-item">
          <span class="career-high-value">${h.best.val}</span>
          <span class="career-high-label">${h.label}</span>
          <span class="career-high-meta">vs ${oppId} &middot; ${OBA.formatDate(g.date)}</span>
        </a>`;
      }).join('')}
    </div>
    ` : ''}

    <h2 class="section-title">Game Log</h2>
    <div class="table-wrapper">
      <table class="stats-table">
        <thead>
          <tr>
            <th>Date</th><th>Matchup</th><th>Result</th><th>PTS</th><th>REB</th><th>AST</th><th>STL</th><th>BLK</th><th>TO</th><th>FG</th><th>3PT</th><th>FT</th>
          </tr>
        </thead>
        <tbody>
          ${gameLogs.map(g => {
            const myTeam = g.forTeam || player.teamId;
            const isHome = g.homeTeam === myTeam;
            const oppId = isHome ? g.awayTeam : g.homeTeam;
            const won = isHome ? g.homeScore > g.awayScore : g.awayScore > g.homeScore;
            const myScore = isHome ? g.homeScore : g.awayScore;
            const oppScore = isHome ? g.awayScore : g.homeScore;
            const fillinTag = g.fillin ? ' <span style="font-size:0.75em;color:#888">(fill-in)</span>' : '';
            return `<tr>
              <td><a href="game.html?id=${g.gameId}">${OBA.formatDate(g.date)}</a></td>
              <td>${isHome ? 'vs' : '@'} ${oppId}${fillinTag}</td>
              <td style="color:${won ? 'green' : 'red'}">${won ? 'W' : 'L'} ${myScore}-${oppScore}</td>
              <td>${g.pts}</td><td>${g.reb}</td><td>${g.ast}</td>
              <td>${g.stl}</td><td>${g.blk}</td><td>${g.to}</td>
              <td>${g.fgm}-${g.fga}</td><td>${g.tpm}-${g.tpa}</td><td>${g.ftm}-${g.fta}</td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>
  `;
})();
