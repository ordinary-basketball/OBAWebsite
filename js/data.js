// OBA Data Loading Utilities
const OBA = {
  seasons: ['exhibition', 'season1', 'season2'],
  seasonLabels: { exhibition: 'Exhibition', season1: 'Season 1', season2: 'Season 2' },
  currentSeason: localStorage.getItem('obaSeason') || 'season2',
  cache: {},

  async fetchJSON(path) {
    if (this.cache[path]) return this.cache[path];
    const res = await fetch(path);
    const data = await res.json();
    this.cache[path] = data;
    return data;
  },

  async getTeams(season) {
    season = season || this.currentSeason;
    return this.fetchJSON(`data/seasons/${season}/teams.json`);
  },

  async getPlayers(season) {
    season = season || this.currentSeason;
    return this.fetchJSON(`data/seasons/${season}/players.json`);
  },

  async getGames(season) {
    season = season || this.currentSeason;
    return this.fetchJSON(`data/seasons/${season}/games.json`);
  },

  async getAwards(season) {
    season = season || this.currentSeason;
    return this.fetchJSON(`data/seasons/${season}/awards.json`);
  },

  async getPhotos(season) {
    season = season || this.currentSeason;
    return this.fetchJSON(`data/seasons/${season}/photos.json`);
  },

  async getPowerRankings(season) {
    season = season || this.currentSeason;
    return this.fetchJSON(`data/seasons/${season}/power-rankings.json`);
  },

  async getPredictions(season) {
    season = season || this.currentSeason;
    return this.fetchJSON(`data/seasons/${season}/predictions.json`);
  },

  async getTeam(teamId) {
    const teams = await this.getTeams();
    return teams.find(t => t.id === teamId);
  },

  async getPlayer(playerId) {
    const players = await this.getPlayers();
    return players.find(p => p.id === playerId);
  },

  async getTeamPlayers(teamId) {
    const players = await this.getPlayers();
    return players.filter(p => p.teamId === teamId);
  },

  async getTeamRecord(teamId, season) {
    const games = await this.getGames(season);
    let wins = 0, losses = 0, draws = 0;
    games.filter(g => !g.round).forEach(g => {
      if (g.homeTeam === teamId) {
        g.homeScore > g.awayScore ? wins++ : g.homeScore < g.awayScore ? losses++ : draws++;
      } else if (g.awayTeam === teamId) {
        g.awayScore > g.homeScore ? wins++ : g.awayScore < g.homeScore ? losses++ : draws++;
      }
    });
    return { wins, losses, draws };
  },

  async getPlayerSeasonStats(playerId, season) {
    const games = await this.getGames(season);
    const stats = { gp: 0, pts: 0, reb: 0, ast: 0, stl: 0, blk: 0, to: 0, fgm: 0, fga: 0, tpm: 0, tpa: 0, ftm: 0, fta: 0 };
    const gameLogs = [];

    games.forEach(g => {
      let line = null, forTeam = null;
      for (const [tid, box] of Object.entries(g.boxScore)) {
        const found = box.find(b => b.playerId === playerId);
        if (found) { line = found; forTeam = tid; break; }
      }
      if (line) {
        if (!g.round && !line.fillin) {
          stats.gp++;
          Object.keys(stats).forEach(k => {
            if (k !== 'gp') stats[k] += line[k] || 0;
          });
        }
        gameLogs.push({ gameId: g.id, date: g.date, round: g.round, fillin: line.fillin, forTeam, homeTeam: g.homeTeam, awayTeam: g.awayTeam, homeScore: g.homeScore, awayScore: g.awayScore, ...line });
      }
    });

    return { totals: stats, gameLogs };
  },

  calcAverages(totals) {
    const gp = totals.gp || 1;
    return {
      ppg: (totals.pts / gp).toFixed(1),
      rpg: (totals.reb / gp).toFixed(1),
      apg: (totals.ast / gp).toFixed(1),
      spg: (totals.stl / gp).toFixed(1),
      bpg: (totals.blk / gp).toFixed(1),
      topg: (totals.to / gp).toFixed(1),
      fgPct: totals.fga ? (totals.fgm / totals.fga * 100).toFixed(1) : '0.0',
      tpPct: totals.tpa ? (totals.tpm / totals.tpa * 100).toFixed(1) : '0.0',
      ftPct: totals.fta ? (totals.ftm / totals.fta * 100).toFixed(1) : '0.0',
      fgmpg: (totals.fgm / gp).toFixed(1),
      fgapg: (totals.fga / gp).toFixed(1),
      tpmpg: (totals.tpm / gp).toFixed(1),
      tpapg: (totals.tpa / gp).toFixed(1),
      ftmpg: (totals.ftm / gp).toFixed(1),
      ftapg: (totals.fta / gp).toFixed(1),
    };
  },

  formatDate(dateStr) {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  },

  getParam(name) {
    return new URLSearchParams(window.location.search).get(name);
  },

  // Build shared navigation HTML
  renderNav(activePage) {
    const links = [
      { href: 'index.html', label: 'Home', id: 'home' },
      { href: 'schedule.html', label: 'Schedule', id: 'schedule' },
      { href: 'teams.html', label: 'Teams', id: 'teams' },
      // { href: 'photos.html', label: 'Photos', id: 'photos' },
      { href: 'power-rankings.html', label: 'Rankings', id: 'power-rankings' },
      { href: 'predictions.html', label: 'Predictions', id: 'predictions' },
      { href: 'records.html', label: 'Records', id: 'records' },
      { href: 'awards.html', label: 'Awards', id: 'awards' },
    ];
    const nav = document.getElementById('site-nav');
    if (!nav) return;
    const seasonOptions = this.seasons.map(s =>
      `<option value="${s}" ${s === this.currentSeason ? 'selected' : ''}>${this.seasonLabels[s]}</option>`
    ).join('');
    nav.innerHTML = `
      <div class="nav-inner">
        <a href="index.html" class="nav-logo"><img src="images/OBALogo.png" alt="OBA" class="nav-logo-img">OBA</a>
        <button class="nav-toggle" onclick="document.querySelector('.nav-links').classList.toggle('open')" aria-label="Menu">&#9776;</button>
        <ul class="nav-links">
          ${links.map(l => `<li><a href="${l.href}" class="${activePage === l.id ? 'active' : ''}">${l.label}</a></li>`).join('')}
          <li class="season-selector">
            <select id="season-select" onchange="OBA.switchSeason(this.value)">
              ${seasonOptions}
            </select>
          </li>
        </ul>
      </div>
    `;
  },

  switchSeason(season) {
    localStorage.setItem('obaSeason', season);
    // Go to index page when switching seasons (team/player/game IDs may not exist across seasons)
    window.location.href = 'index.html';
  },

  renderFooter() {
    const footer = document.getElementById('site-footer');
    if (!footer) return;
    footer.innerHTML = `<p>&copy; ${new Date().getFullYear()} Ordinary Basketball Association &mdash; A Church Basketball League</p>`;
  }
};
