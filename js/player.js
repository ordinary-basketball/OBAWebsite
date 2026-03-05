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
            const isHome = g.homeTeam === player.teamId;
            const oppId = isHome ? g.awayTeam : g.homeTeam;
            const won = isHome ? g.homeScore > g.awayScore : g.awayScore > g.homeScore;
            const myScore = isHome ? g.homeScore : g.awayScore;
            const oppScore = isHome ? g.awayScore : g.homeScore;
            return `<tr>
              <td><a href="game.html?id=${g.gameId}">${OBA.formatDate(g.date)}</a></td>
              <td>${isHome ? 'vs' : '@'} ${oppId}</td>
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
