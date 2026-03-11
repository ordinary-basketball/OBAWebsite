(async function() {
  OBA.renderNav('schedule');
  OBA.renderFooter();

  const gameId = parseInt(OBA.getParam('id'));
  const seasonParam = OBA.getParam('season');
  if (!gameId) {
    document.getElementById('game-content').innerHTML = '<p class="loading">Game not found.</p>';
    return;
  }

  const [games, teams, players] = await Promise.all([OBA.getGames(seasonParam), OBA.getTeams(seasonParam), OBA.getPlayers(seasonParam)]);
  const game = games.find(g => g.id === gameId);
  if (!game) {
    document.getElementById('game-content').innerHTML = '<p class="loading">Game not found.</p>';
    return;
  }

  const teamMap = Object.fromEntries(teams.map(t => [t.id, t]));
  const playerMap = Object.fromEntries(players.map(p => [p.id, p]));
  const home = teamMap[game.homeTeam];
  const away = teamMap[game.awayTeam];
  const homeWin = game.homeScore > game.awayScore;

  document.title = `${home.name} vs ${away.name} - OBA`;

  function renderBoxScore(teamId, boxData) {
    const team = teamMap[teamId];
    boxData.sort((a, b) => b.pts - a.pts);
    const hasOrebDreb = boxData.some(b => b.oreb !== undefined);
    const totals = { pts: 0, reb: 0, oreb: 0, dreb: 0, ast: 0, stl: 0, blk: 0, to: 0, fgm: 0, fga: 0, tpm: 0, tpa: 0, ftm: 0, fta: 0 };
    boxData.forEach(b => {
      Object.keys(totals).forEach(k => totals[k] += b[k] || 0);
    });

    const rebHeaders = hasOrebDreb ? '<th>OREB</th><th>DREB</th><th>REB</th>' : '<th>REB</th>';
    const rebCells = b => hasOrebDreb ? `<td>${b.oreb || 0}</td><td>${b.dreb || 0}</td><td>${b.reb}</td>` : `<td>${b.reb}</td>`;
    const rebTotals = hasOrebDreb ? `<td>${totals.oreb}</td><td>${totals.dreb}</td><td>${totals.reb}</td>` : `<td>${totals.reb}</td>`;

    return `
      <div class="box-score-section">
        <h2 style="border-left-color: ${team.color}">${team.name}</h2>
        <div class="table-wrapper">
          <table class="stats-table">
            <thead>
              <tr>
                <th>Player</th><th>PTS</th>${rebHeaders}<th>AST</th><th>STL</th><th>BLK</th><th>TO</th><th>FG</th><th>3PT</th><th>FT</th>
              </tr>
            </thead>
            <tbody>
              ${boxData.map(b => {
                const p = playerMap[b.playerId];
                return `<tr>
                  <td><a href="player.html?id=${b.playerId}">${p ? p.name : b.playerId}</a></td>
                  <td>${b.pts}</td>${rebCells(b)}<td>${b.ast}</td>
                  <td>${b.stl}</td><td>${b.blk}</td><td>${b.to}</td>
                  <td>${b.fgm}-${b.fga}</td><td>${b.tpm}-${b.tpa}</td><td>${b.ftm}-${b.fta}</td>
                </tr>`;
              }).join('')}
              <tr class="totals-row">
                <td>TOTALS</td>
                <td>${totals.pts}</td>${rebTotals}<td>${totals.ast}</td>
                <td>${totals.stl}</td><td>${totals.blk}</td><td>${totals.to}</td>
                <td>${totals.fgm}-${totals.fga}</td><td>${totals.tpm}-${totals.tpa}</td><td>${totals.ftm}-${totals.fta}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>`;
  }

  document.getElementById('game-content').innerHTML = `
    <div class="matchup-header">
      ${game.round ? `<div class="game-round">${game.round}</div>` : ''}
      <div class="game-date">${OBA.formatDate(game.date)}</div>
      <div class="matchup-teams">
        <div class="matchup-team">
          <div class="team-name"><a href="team.html?id=${home.id}" style="color:var(--cream)">${home.name}</a></div>
          <div class="score" style="${homeWin ? '' : 'opacity:0.6'}">${game.homeScore}</div>
        </div>
        <div class="matchup-vs">VS</div>
        <div class="matchup-team">
          <div class="team-name"><a href="team.html?id=${away.id}" style="color:var(--cream)">${away.name}</a></div>
          <div class="score" style="${!homeWin ? '' : 'opacity:0.6'}">${game.awayScore}</div>
        </div>
      </div>
    </div>
    ${game.videoUrl ? `<div class="game-video-link"><a href="${game.videoUrl}" target="_blank" rel="noopener">Watch Game</a></div>` : ''}
    ${renderBoxScore(game.homeTeam, game.boxScore[game.homeTeam])}
    ${renderBoxScore(game.awayTeam, game.boxScore[game.awayTeam])}
  `;
})();
