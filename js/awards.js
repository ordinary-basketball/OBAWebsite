(async function() {
  OBA.renderNav('awards');
  OBA.renderFooter();

  function renderComingSoon(title, icon) {
    return `
      <div class="award-card">
        <div class="award-header">${title}</div>
        <div class="award-body">
          <div class="award-icon">${icon}</div>
          <div class="highlights">Coming soon...</div>
        </div>
      </div>`;
  }

  let html = '';
  try {
    const [awards, players, teams] = await Promise.all([OBA.getAwards(), OBA.getPlayers(), OBA.getTeams()]);
    const playerMap = Object.fromEntries(players.map(p => [p.id, p]));
    const teamMap = Object.fromEntries(teams.map(t => [t.id, t]));

    function playerCard(playerId) {
      const p = playerMap[playerId];
      if (!p) return { name: 'Unknown', teamName: '' };
      const t = teamMap[p.teamId];
      return { name: p.name, teamName: t ? t.name : '', id: p.id };
    }

    function renderAward(title, icon, awardData) {
      if (!awardData) return renderComingSoon(title, icon);
      const p = playerCard(awardData.playerId);
      return `
        <div class="award-card">
          <div class="award-header">${title}</div>
          <div class="award-body">
            <div class="award-icon">${icon}</div>
            <div class="player-name"><a href="player.html?id=${p.id}">${p.name}</a></div>
            <div class="player-team">${p.teamName}</div>
            ${awardData.highlights ? `<div class="highlights">${awardData.highlights}</div>` : ''}
          </div>
        </div>`;
    }

    function renderAllTeam(title, playerIds) {
      if (!playerIds || playerIds.length === 0) return '';
      return `
        <div class="all-team-section">
          <h2>${title}</h2>
          <div class="all-team-list">
            ${playerIds.map(id => {
              const p = playerCard(id);
              return `
                <a href="player.html?id=${p.id}" class="all-team-player">
                  <div class="name">${p.name}</div>
                  <div class="team">${p.teamName}</div>
                </a>`;
            }).join('')}
          </div>
        </div>`;
    }

    // Individual awards
    html += `<div class="awards-grid">`;
    html += renderAward('Most Valuable Player', '\u{1F3C6}', awards.mvp);
    html += renderAward('Defensive Player of the Year', '\u{1F6E1}\u{FE0F}', awards.dpoy);
    html += renderAward('6th Man of the Year', '\u{1F4AA}', awards.sixthMan);
    if (awards.mip !== undefined) {
      html += renderAward('Most Improved Player', '\u{1F4C8}', awards.mip);
    }

    // Fun awards inline
    const fun = awards.funAwards;
    if (fun) {
      if (fun.bestCelebration) html += renderAward('Best Celebration', '\u{1F389}', fun.bestCelebration);
      if (fun.bestTrashTalker) html += renderAward('Best Trash Talker (in love)', '\u{1F5E3}\u{FE0F}', fun.bestTrashTalker);
      if (fun.mrHustle) html += renderAward('Mr. Hustle', '\u{1F525}', fun.mrHustle);
    }
    html += `</div>`;

    if (awards.eligibilityNote) {
      html += `<p class="awards-eligibility">${awards.eligibilityNote}</p>`;
    }

    // All-team selections
    html += renderAllTeam('All-OBA First Team', awards.allOBA);
    html += renderAllTeam('All-OBA Defensive Team', awards.allDefense);

    // Playoff awards
    if (awards.finalsMvp || awards.playoffMvp) {
      html += `<h2 class="awards-section-header">Playoff Awards</h2>`;
      html += `<div class="awards-grid">`;
      if (awards.finalsMvp) html += renderAward('Finals MVP', '\u{1F3C6}', awards.finalsMvp);
      if (awards.playoffMvp) html += renderAward('Playoff MVP', '\u{1F31F}', awards.playoffMvp);
      html += `</div>`;
    }

  } catch (e) {
    html = `
      <div class="awards-grid">
        ${renderComingSoon('Most Valuable Player', '\u{1F3C6}')}
        ${renderComingSoon('Defensive Player of the Year', '\u{1F6E1}\u{FE0F}')}
        ${renderComingSoon('6th Man of the Year', '\u{1F4AA}')}
        ${renderComingSoon('Best Celebration', '\u{1F389}')}
        ${renderComingSoon('Best Trash Talker (in love)', '\u{1F5E3}\u{FE0F}')}
        ${renderComingSoon('Mr. Hustle', '\u{1F525}')}
      </div>
    `;
  }

  document.getElementById('awards-content').innerHTML = html;
})();
