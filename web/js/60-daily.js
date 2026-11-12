// ---------- Pokémon of the day: pool info + new draw ----------
function buildDailyBox() {
  const fs = document.querySelector('fieldset[data-group="power"]');
  if (!fs || $('dailybox')) return;
  const box = document.createElement('div'); box.className = 'trbox'; box.id = 'dailybox';
  box.innerHTML = `<div class="row" style="margin-top:0"><button type="button" id="dlShuffle"></button><span class="muted" id="dlInfo"></span></div>`;
  fs.querySelector('.grid').after(box);
  $('dlShuffle').textContent = t('daily_shuffle');
  $('dlShuffle').onclick = () => { state.dailySeed = (Date.now() % 2147483647) || 1; renderDailyBox(); scheduleRender(); };
  renderDailyBox();
}
function renderDailyBox() {
  if (!$('dailybox')) return;
  $('dailybox').style.display = state.pg_daily ? '' : 'none';
  const ids = dailyIds();
  const next = dailySchedule(ids.length, 4).map(([when, k]) => fmtWhen(when) + ' #' + ids[k]).join(' · ');
  $('dlInfo').textContent = t('daily_info', {t: ids[dailyPickNow(ids.length)], n: ids.length, l: ids.map(i => '#' + i).join(' ')}) +
    (ids.length > 1 ? '\n' + t('daily_next', {l: next}) : '');
}

