(async function() {
  OBA.renderNav('predictions');
  OBA.renderFooter();

  const [predictions, teams, players] = await Promise.all([
    OBA.getPredictions(),
    OBA.getTeams(),
    OBA.getPlayers()
  ]);

  const teamMap = {};
  teams.forEach(t => teamMap[t.id] = t);
  const playerMap = {};
  players.forEach(p => playerMap[p.id] = p);

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
    const homeProps = matchup.props.filter(p => playerMap[p.playerId]?.teamId === matchup.homeTeam);
    const awayProps = matchup.props.filter(p => playerMap[p.playerId]?.teamId === matchup.awayTeam);

    html += `
      <div class="matchup-section">
        <div class="matchup-header">
          <span class="matchup-team-name" style="color:${home.color}">${home.name}</span>
          <span class="matchup-vs">vs</span>
          <span class="matchup-team-name" style="color:${away.color}">${away.name}</span>
        </div>
        <div class="props-grid">
          <div class="team-props">
            <h3 class="team-props-title" style="color:${home.color}">${home.name}</h3>
            ${homeProps.map(prop => renderPropCard(prop, playerMap, statLabels)).join('')}
          </div>
          <div class="team-props">
            <h3 class="team-props-title" style="color:${away.color}">${away.name}</h3>
            ${awayProps.map(prop => renderPropCard(prop, playerMap, statLabels)).join('')}
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

  function renderPropCard(prop, playerMap, statLabels) {
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
