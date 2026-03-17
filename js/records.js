(async function() {
  OBA.renderNav('records');
  OBA.renderFooter();

  // Load data from all seasons (exclude exhibition)
  const recordSeasons = OBA.seasons.filter(s => s !== 'exhibition');
  const seasonData = await Promise.all(recordSeasons.map(async season => {
    const [games, players, teams] = await Promise.all([
      OBA.getGames(season),
      OBA.getPlayers(season),
      OBA.getTeams(season)
    ]);
    return { season, games, players, teams };
  }));

  // Build combined lookup maps
  const playerMap = {};
  const teamMap = {};
  seasonData.forEach(({ players, teams }) => {
    players.forEach(p => playerMap[p.id] = p);
    teams.forEach(t => teamMap[t.id] = t);
  });

  // Define record categories
  const categories = [
    { key: 'pts', label: 'Most Points' },
    { key: 'reb', label: 'Most Rebounds' },
    { key: 'ast', label: 'Most Assists' },
    { key: 'stl', label: 'Most Steals' },
    { key: 'blk', label: 'Most Blocks' },
    { key: 'tpm', label: 'Most 3-Pointers Made' },
    { key: 'fgm', label: 'Most FG Made' },
    { key: 'ftm', label: 'Most FT Made' },
  ];

  // Scan all games to find records
  const records = {};
  categories.forEach(c => records[c.key] = null);

  seasonData.forEach(({ season, games }) => {
    games.forEach(game => {
      Object.values(game.boxScore).flat().forEach(line => {
        categories.forEach(({ key }) => {
          const val = line[key] || 0;
          if (!records[key] || val > records[key].value) {
            const player = playerMap[line.playerId];
            const team = player ? teamMap[player.teamId] : null;
            records[key] = {
              value: val,
              playerId: line.playerId,
              playerName: player ? player.name : line.playerId,
              teamName: team ? team.name : '',
              teamColor: team ? team.color : '#999',
              gameId: game.id,
              date: game.date,
              season: season
            };
          }
        });
      });
    });
  });

  // Render
  const container = document.getElementById('records-content');
  container.innerHTML = `
    <div class="leaders-grid">
      ${categories.map(({ key, label }) => {
        const r = records[key];
        if (!r) return '';
        return `
          <a href="game.html?id=${r.gameId}&season=${r.season}" class="leader-column record-card">
            <h3 class="leader-title">${label}</h3>
            <div class="leader-list">
              <div class="leader-item">
                <div class="leader-info">
                  <span class="leader-name">${r.playerName}</span>
                  <span class="leader-team" style="color:${r.teamColor}">${r.teamName}</span>
                  <span class="record-date">${OBA.formatDate(r.date)} &middot; ${OBA.seasonLabels[r.season]}</span>
                </div>
                <span class="leader-stat">${r.value}</span>
              </div>
            </div>
          </a>`;
      }).join('')}
    </div>
  `;
})();
