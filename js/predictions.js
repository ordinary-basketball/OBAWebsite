(async function() {
  OBA.renderNav('predictions');
  OBA.renderFooter();

  document.getElementById('predictions-content').innerHTML = `
    <div class="predictions-container">
      <div class="predictions-placeholder">
        <div class="predictions-icon">&#x1F3C0;</div>
        <h2>Game Day Predictions</h2>
        <p>Voting form coming soon &mdash; check back before next game day!</p>
      </div>
    </div>
  `;
})();
