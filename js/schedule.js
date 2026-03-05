(async function() {
  OBA.renderNav('schedule');
  OBA.renderFooter();

  const [games, teams] = await Promise.all([OBA.getGames(), OBA.getTeams()]);
  const teamMap = Object.fromEntries(teams.map(t => [t.id, t]));

  // Partition into regular season and playoff games
  const regularGames = games.filter(g => !g.round);
  const playoffGames = games.filter(g => g.round);

  // Group regular season by week
  const weekGroups = {};
  regularGames.forEach(g => {
    const key = `Week ${g.week || 1}`;
    if (!weekGroups[key]) weekGroups[key] = { week: g.week || 1, games: [] };
    weekGroups[key].games.push(g);
  });

  // Group playoffs by round (preserve order: Play-In, Semifinal, Championship)
  const roundOrder = { 'Play-In': 1, 'Semifinal': 2, 'Championship': 3 };
  const playoffGroups = {};
  playoffGames.forEach(g => {
    const key = g.round;
    if (!playoffGroups[key]) playoffGroups[key] = { order: roundOrder[key] || 99, games: [] };
    playoffGroups[key].games.push(g);
  });

  function renderGameRow(g, isPlayoff) {
    const home = teamMap[g.homeTeam];
    const away = teamMap[g.awayTeam];
    const homeWin = g.homeScore > g.awayScore;
    const roundClass = isPlayoff ? `round-${g.round.toLowerCase().replace(/\s+/g, '-')}` : '';
    const roundLabel = g.round === 'Championship' ? 'Finals' : (g.round === 'Semifinal' ? 'Semi Finals' : g.round);

    return `
      <a href="game.html?id=${g.id}" class="game-row${isPlayoff ? ' playoff-game' : ''}">
        ${isPlayoff ? `<span class="round-badge ${roundClass}">${roundLabel}</span>` : ''}
        <span class="game-date">${OBA.formatDate(g.date)}</span>
        <span class="game-matchup">
          <span class="team-name home-team" style="color:${home.color}">${home.name}</span>
          <span class="vs">vs</span>
          <span class="team-name away-team" style="color:${away.color}">${away.name}</span>
        </span>
        <span class="game-score">
          <span class="${homeWin ? 'winner' : ''}">${g.homeScore}</span> - <span class="${!homeWin ? 'winner' : ''}">${g.awayScore}</span>
        </span>
      </a>`;
  }

  const container = document.getElementById('schedule-content');
  let html = '';

  // Regular Season section
  if (Object.keys(weekGroups).length > 0) {
    html += `<h2 class="schedule-section-header">Regular Season</h2>`;
    const sortedWeeks = Object.keys(weekGroups).sort((a, b) => weekGroups[a].week - weekGroups[b].week);
    html += sortedWeeks.map(label => `
      <div class="week-group">
        <h3>${label}</h3>
        <div class="schedule-list">
          ${weekGroups[label].games.map(g => renderGameRow(g, false)).join('')}
        </div>
      </div>`).join('');
  }

  // Playoffs section
  if (Object.keys(playoffGroups).length > 0) {
    html += `<h2 class="schedule-section-header playoffs-header">Playoffs</h2>`;
    const sortedRounds = Object.keys(playoffGroups).sort((a, b) => playoffGroups[a].order - playoffGroups[b].order);
    html += sortedRounds.map(round => {
      const roundLabel = round === 'Championship' ? 'Finals' : (round === 'Semifinal' ? 'Semi Finals' : round);
      return `
        <div class="week-group">
          <h3>${roundLabel}</h3>
          <div class="schedule-list">
            ${playoffGroups[round].games.map(g => renderGameRow(g, true)).join('')}
          </div>
        </div>`;
    }).join('');

    // Champion banner — find the Championship game
    const champGame = playoffGames.find(g => g.round === 'Championship');
    if (champGame) {
      const winnerId = champGame.homeScore > champGame.awayScore ? champGame.homeTeam : champGame.awayTeam;
      const winner = teamMap[winnerId];
      const seasonLabel = OBA.currentSeason ? OBA.currentSeason.replace('season', 'Season ') : 'Season 1';
      html += `
        <div class="champion-banner" style="border-color: ${winner.color}">
          <div class="champion-trophy">&#127942;</div>
          <div class="champion-text">
            <span class="champion-team" style="color: ${winner.color}">${winner.name}</span>
            <span class="champion-title">${seasonLabel} Champions</span>
          </div>
        </div>`;
    }
  }

  container.innerHTML = html;
})();
