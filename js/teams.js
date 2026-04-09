(async function() {
  OBA.renderNav('teams');
  OBA.renderFooter();

  const teams = await OBA.getTeams();
  const records = await Promise.all(teams.map(t => OBA.getTeamRecord(t.id)));

  const container = document.getElementById('teams-grid');
  container.innerHTML = teams.map((t, i) => {
    const r = records[i];
    return `
      <a href="team.html?id=${t.id}" class="card team-card">
        <div class="card-header" style="background: linear-gradient(135deg, ${t.color}, ${t.colorSecondary || t.color})">
          <h3>${t.name}</h3>
          <div class="record">${r.wins} - ${r.losses} - ${r.draws}</div>
        </div>
        <div class="card-body">
          <p>View roster &amp; stats &rarr;</p>
        </div>
      </a>`;
  }).join('');
})();
