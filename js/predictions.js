(async function() {
  OBA.renderNav('predictions');
  OBA.renderFooter();

  const [predictions, teams, players, games] = await Promise.all([
    OBA.getPredictions(),
    OBA.getTeams(),
    OBA.getPlayers(),
    OBA.getGames()
  ]);

  const teamMap = {};
  teams.forEach(t => teamMap[t.id] = t);
  const playerMap = {};
  players.forEach(p => playerMap[p.id] = p);

  // --- Compute player season averages (exclude fillin and playoff) ---
  const playerStats = {};
  const teamDefense = {};
  teams.forEach(t => { teamDefense[t.id] = { gp: 0, ptsAllowed: 0 }; });

  games.filter(g => !g.round).forEach(g => {
    // Team defense: points allowed
    teamDefense[g.homeTeam].gp++;
    teamDefense[g.homeTeam].ptsAllowed += g.awayScore;
    teamDefense[g.awayTeam].gp++;
    teamDefense[g.awayTeam].ptsAllowed += g.homeScore;

    // Player stats (skip fillin)
    Object.values(g.boxScore).flat().forEach(line => {
      if (line.fillin) return;
      if (!playerStats[line.playerId]) {
        playerStats[line.playerId] = { gp: 0, pts: 0, reb: 0, ast: 0 };
      }
      const s = playerStats[line.playerId];
      s.gp++;
      s.pts += line.pts || 0;
      s.reb += line.reb || 0;
      s.ast += line.ast || 0;
    });
  });

  // League average points scored per game (per team)
  const activeTeams = Object.keys(teamDefense).filter(id => teamDefense[id].gp > 0);
  const leagueAvgPtsAllowed = activeTeams.reduce((sum, id) => sum + teamDefense[id].ptsAllowed / teamDefense[id].gp, 0) / activeTeams.length;

  // Opponent defensive factor: >1 means they allow more than average (weaker defense)
  function getDefFactor(oppTeamId) {
    const d = teamDefense[oppTeamId];
    if (!d || d.gp === 0) return 1.0;
    return (d.ptsAllowed / d.gp) / leagueAvgOppPts();
  }

  function leagueAvgOppPts() {
    return leagueAvgPtsAllowed || 55;
  }

  // Generate prop lines for a team's players against a specific opponent
  function generateProps(teamId, oppTeamId) {
    const defFactor = getDefFactor(oppTeamId);
    const roster = players.filter(p => p.teamId === teamId);

    return roster
      .filter(p => !p.inactive && playerStats[p.id] && playerStats[p.id].gp >= 2)
      .map(p => {
        const s = playerStats[p.id];
        const ppg = s.pts / s.gp;
        const adjustedPts = ppg * defFactor;
        const line = Math.round(adjustedPts * 2) / 2; // round to nearest 0.5
        return { playerId: p.id, line, stat: 'pts', rawPpg: ppg };
      })
      .filter(p => p.line >= 0.5)
      .sort((a, b) => b.line - a.line)
      .slice(0, 6);
  }

  const statLabels = { pts: 'Points', reb: 'Rebounds', ast: 'Assists' };
  const container = document.getElementById('predictions-content');

  const weekLabel = predictions.title || `Week ${predictions.week}`;
  let html = `
    <div class="predictions-container">
      <div class="predictions-meta">${weekLabel} &mdash; ${OBA.formatDate(predictions.date)}</div>
  `;

  predictions.matchups.forEach(matchup => {
    const home = teamMap[matchup.homeTeam];
    const away = teamMap[matchup.awayTeam];
    const homeProps = generateProps(matchup.homeTeam, matchup.awayTeam);
    const awayProps = generateProps(matchup.awayTeam, matchup.homeTeam);

    html += `
      <div class="matchup-section">
        ${matchup.label ? `<div class="matchup-label">${matchup.label}</div>` : ''}
        <div class="matchup-header">
          <span class="matchup-team-name" style="color:${home.color}">${home.name}</span>
          <span class="matchup-vs">vs</span>
          <span class="matchup-team-name" style="color:${away.color}">${away.name}</span>
        </div>
        ${matchup.spread ? (() => {
          const fav = teamMap[matchup.spread.favorite];
          const dog = fav.id === matchup.homeTeam ? away : home;
          return `<div class="spread-card">
            <div class="spread-header">Game Spread</div>
            <div class="spread-picks">
              <div class="spread-pick">
                <span class="spread-pick-team">${fav.name}</span>
                <span class="spread-pick-line">-${matchup.spread.line}</span>
              </div>
              <div class="spread-pick">
                <span class="spread-pick-team">${dog.name}</span>
                <span class="spread-pick-line">+${matchup.spread.line}</span>
              </div>
            </div>
          </div>`;
        })() : ''}
        <div class="props-section-label">Player Props</div>
        <div class="props-grid">
          <div class="team-props">
            <h3 class="team-props-title" style="color:${home.color}">${home.name}</h3>
            ${homeProps.map(prop => renderPropCard(prop)).join('')}
          </div>
          <div class="team-props">
            <h3 class="team-props-title" style="color:${away.color}">${away.name}</h3>
            ${awayProps.map(prop => renderPropCard(prop)).join('')}
          </div>
        </div>
      </div>
    `;
  });

  html += `
      <div class="predictions-attribution">Lines set using opponent-adjusted scoring projections</div>
    </div>
  `;

  container.innerHTML = html;

  function renderPropCard(prop) {
    const player = playerMap[prop.playerId];
    if (!player) return '';
    return `
      <div class="prop-card">
        <a class="prop-player-name" href="player.html?id=${player.id}">${player.name}</a>
        <div class="prop-stat-label">${statLabels[prop.stat] || prop.stat}</div>
        <div class="prop-line-display">
          <span class="prop-side over">OVER</span>
          <span class="prop-line-value">${prop.line.toFixed(1)}</span>
          <span class="prop-side under">UNDER</span>
        </div>
      </div>
    `;
  }
})();
