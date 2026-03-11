(async function() {
  OBA.renderNav('power-rankings');
  OBA.renderFooter();

  const [rankings, teams] = await Promise.all([
    OBA.getPowerRankings(),
    OBA.getTeams()
  ]);

  const teamMap = Object.fromEntries(teams.map(t => [t.id, t]));

  const container = document.getElementById('rankings-content');

  container.innerHTML = `
    <p class="rankings-meta">${rankings.title ? rankings.title + ' &mdash; ' : 'Week ' + rankings.week + ' &mdash; '}${OBA.formatDate(rankings.date)}</p>
    <div class="power-rankings-list">
      ${rankings.rankings.map(r => {
        const team = teamMap[r.teamId];
        const name = team ? team.name : r.teamId;
        const color = team ? team.color : '#333';
        return `
          <div class="ranking-card" style="border-left-color: ${color}">
            <div class="ranking-header">
              <span class="ranking-rank">${r.rank}</span>
              <a href="team.html?id=${r.teamId}" class="ranking-team" style="color: ${color}">${name}</a>
              <span class="ranking-record">${r.record}</span>
            </div>
            ${r.stats ? `<div class="ranking-stats">
              <span class="ranking-stat"><span class="ranking-stat-label">FG%</span> <span class="ranking-stat-value">${r.stats.fgPct}%</span></span>
              <span class="ranking-stat"><span class="ranking-stat-label">3PT%</span> <span class="ranking-stat-value">${r.stats.tpPct}%</span></span>
              <span class="ranking-stat"><span class="ranking-stat-label">FT%</span> <span class="ranking-stat-value">${r.stats.ftPct}%</span></span>
            </div>` : ''}
            <p class="ranking-writeup">${r.writeup}</p>
          </div>`;
      }).join('')}
    </div>
    <p class="powered-by">Powered by Claude</p>
  `;
})();
