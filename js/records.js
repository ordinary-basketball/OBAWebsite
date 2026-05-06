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

  // ===== Single-season shooting % records =====
  // Aggregate per-player per-season totals (regular season only, exclude fill-ins).
  const seasonTotals = {};
  seasonData.forEach(({ season, games, players: sPlayers, teams: sTeams }) => {
    const sPlayerMap = Object.fromEntries(sPlayers.map(p => [p.id, p]));
    const sTeamMap = Object.fromEntries(sTeams.map(t => [t.id, t]));
    games.filter(g => !g.round).forEach(game => {
      Object.values(game.boxScore).flat().forEach(line => {
        if (line.fillin) return;
        const key = `${line.playerId}-${season}`;
        if (!seasonTotals[key]) {
          const sPlayer = sPlayerMap[line.playerId];
          const sTeam = sPlayer ? sTeamMap[sPlayer.teamId] : null;
          seasonTotals[key] = {
            playerId: line.playerId, season, gp: 0,
            fgm: 0, fga: 0, tpm: 0, tpa: 0, ftm: 0, fta: 0,
            seasonTeamName: sTeam ? sTeam.name : '',
            seasonTeamColor: sTeam ? sTeam.color : '#999'
          };
        }
        const t = seasonTotals[key];
        t.gp++;
        t.fgm += line.fgm || 0; t.fga += line.fga || 0;
        t.tpm += line.tpm || 0; t.tpa += line.tpa || 0;
        t.ftm += line.ftm || 0; t.fta += line.fta || 0;
      });
    });
  });

  const seasonShootingCategories = [
    { key: 'fgPct', label: 'Best FG%',  minAtt: 40, attKey: 'fga', madeKey: 'fgm', threshLabel: 'min 40 FGA' },
    { key: 'tpPct', label: 'Best 3PT%', minAtt: 20, attKey: 'tpa', madeKey: 'tpm', threshLabel: 'min 20 3PA' },
    { key: 'ftPct', label: 'Best FT%',  minAtt: 15, attKey: 'fta', madeKey: 'ftm', threshLabel: 'min 15 FTA' }
  ];

  const seasonRecords = {};
  seasonShootingCategories.forEach(c => seasonRecords[c.key] = null);

  Object.values(seasonTotals).forEach(t => {
    seasonShootingCategories.forEach(({ key, minAtt, attKey, madeKey }) => {
      const attempted = t[attKey];
      if (attempted < minAtt) return;
      const made = t[madeKey];
      const pct = made / attempted * 100;
      if (!seasonRecords[key] || pct > seasonRecords[key].value) {
        const player = playerMap[t.playerId];
        seasonRecords[key] = {
          value: pct,
          playerId: t.playerId,
          playerName: player ? player.name : t.playerId,
          teamName: t.seasonTeamName,
          teamColor: t.seasonTeamColor,
          season: t.season,
          made, attempted
        };
      }
    });
  });

  // Render
  const container = document.getElementById('records-content');
  container.innerHTML = `
    <h2 class="records-section-title">Single-Game Records</h2>
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

    <h2 class="records-section-title">Single-Season Shooting Records</h2>
    <div class="leaders-grid">
      ${seasonShootingCategories.map(({ key, label, threshLabel }) => {
        const r = seasonRecords[key];
        if (!r) return `
          <div class="leader-column record-card">
            <h3 class="leader-title">${label}</h3>
            <div class="leader-list">
              <div class="leader-item">
                <div class="leader-info">
                  <span class="record-date">No qualifier yet (${threshLabel})</span>
                </div>
              </div>
            </div>
          </div>`;
        return `
          <a href="player.html?id=${r.playerId}" class="leader-column record-card">
            <h3 class="leader-title">${label}</h3>
            <div class="leader-list">
              <div class="leader-item">
                <div class="leader-info">
                  <span class="leader-name">${r.playerName}</span>
                  <span class="leader-team" style="color:${r.teamColor}">${r.teamName}</span>
                  <span class="record-date">${r.made}/${r.attempted} &middot; ${OBA.seasonLabels[r.season]} &middot; ${threshLabel}</span>
                </div>
                <span class="leader-stat">${r.value.toFixed(1)}%</span>
              </div>
            </div>
          </a>`;
      }).join('')}
    </div>
  `;
})();
