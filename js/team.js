(async function() {
  OBA.renderNav('teams');
  OBA.renderFooter();

  const teamId = OBA.getParam('id');
  if (!teamId) {
    document.getElementById('team-content').innerHTML = '<p class="loading">Team not found.</p>';
    return;
  }

  const [team, roster, record, games] = await Promise.all([
    OBA.getTeam(teamId),
    OBA.getTeamPlayers(teamId),
    OBA.getTeamRecord(teamId),
    OBA.getGames()
  ]);

  if (!team) {
    document.getElementById('team-content').innerHTML = '<p class="loading">Team not found.</p>';
    return;
  }

  document.title = `${team.name} - OBA`;

  // Calculate team per-game stats (regular season only)
  const teamGames = games.filter(g => !g.round && (g.homeTeam === teamId || g.awayTeam === teamId));
  let totalPts = 0, totalReb = 0, totalAst = 0;
  teamGames.forEach(g => {
    const box = g.boxScore[teamId] || [];
    box.forEach(b => {
      totalPts += b.pts;
      totalReb += b.reb;
      totalAst += b.ast;
    });
  });
  const gp = teamGames.length || 1;

  // Get player season stats for the roster table
  const playerStatsPromises = roster.map(p => OBA.getPlayerSeasonStats(p.id));
  const playerStats = await Promise.all(playerStatsPromises);

  // Combine roster with stats and sort by PPG descending
  const rosterWithStats = roster.map((p, i) => ({ player: p, stats: playerStats[i] }));
  rosterWithStats.sort((a, b) => {
    const avgA = a.stats.totals.gp ? a.stats.totals.pts / a.stats.totals.gp : 0;
    const avgB = b.stats.totals.gp ? b.stats.totals.pts / b.stats.totals.gp : 0;
    return avgB - avgA;
  });

  document.getElementById('team-content').innerHTML = `
    <div class="team-header" style="background: linear-gradient(135deg, ${team.color}, ${team.colorSecondary || team.color})">
      <h1>${team.name}</h1>
      <div class="record">${record.wins} - ${record.losses}</div>
    </div>

    <div class="averages-grid">
      <div class="avg-card"><div class="value">${(totalPts / gp).toFixed(1)}</div><div class="label">PPG</div></div>
      <div class="avg-card"><div class="value">${(totalReb / gp).toFixed(1)}</div><div class="label">RPG</div></div>
      <div class="avg-card"><div class="value">${(totalAst / gp).toFixed(1)}</div><div class="label">APG</div></div>
      <div class="avg-card"><div class="value">${teamGames.length}</div><div class="label">GP</div></div>
    </div>

    <h2 class="section-title">Roster</h2>
    <div class="table-wrapper">
      <table class="stats-table">
        <thead>
          <tr>
            <th>Player</th><th>Pos</th><th>Ht</th><th>GP</th><th>PPG</th><th>RPG</th><th>APG</th><th>SPG</th><th>BPG</th><th>TOPG</th><th>FG</th><th>FG%</th><th>3PT</th><th>3P%</th><th>FT</th><th>FT%</th><th>TS%</th>
          </tr>
        </thead>
        <tbody>
          ${rosterWithStats.map(({ player: p, stats: s }) => {
            const avg = OBA.calcAverages(s.totals);
            return `<tr>
              <td><a href="player.html?id=${p.id}">${p.name}</a></td>
              <td>${p.position}</td>
              <td>${p.height}</td>
              <td>${s.totals.gp}</td>
              <td>${avg.ppg}</td>
              <td>${avg.rpg}</td>
              <td>${avg.apg}</td>
              <td>${avg.spg}</td>
              <td>${avg.bpg}</td>
              <td>${avg.topg}</td>
              <td>${(s.totals.fgm / (s.totals.gp || 1)).toFixed(1)}/${(s.totals.fga / (s.totals.gp || 1)).toFixed(1)}</td>
              <td>${avg.fgPct}%</td>
              <td>${(s.totals.tpm / (s.totals.gp || 1)).toFixed(1)}/${(s.totals.tpa / (s.totals.gp || 1)).toFixed(1)}</td>
              <td>${avg.tpPct}%</td>
              <td>${(s.totals.ftm / (s.totals.gp || 1)).toFixed(1)}/${(s.totals.fta / (s.totals.gp || 1)).toFixed(1)}</td>
              <td>${avg.ftPct}%</td>
              <td>${(2 * (s.totals.fga + 0.44 * s.totals.fta)) ? (s.totals.pts / (2 * (s.totals.fga + 0.44 * s.totals.fta)) * 100).toFixed(1) : '0.0'}%</td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>
  `;
})();
