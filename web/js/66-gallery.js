// ---------- your pictures (page "Your images") ----------
// Kept on the board under /www/img/ (not in the saved data: too big), at 400x300.
function buildGalleryBox() {
  const fs = document.querySelector('fieldset[data-group="gallery"]');
  if (!fs || $('gallerybox')) return;
  const box = document.createElement('div'); box.className = 'trbox'; box.id = 'gallerybox';
  box.innerHTML = `<div class="muted" id="gaInfo"></div><div class="galist" id="gaList"></div>
    <div class="cur"><label class="chk" style="cursor:pointer"><input type="file" id="gaFile" accept="image/*" multiple hidden><span id="gaUp" class="btnlike"></span></label>
    <span class="muted" id="gaSt"></span></div>`;
  fs.querySelector('legend').after(box);
  $('gaFile').addEventListener('change', async ev => {
    const files = [...(ev.target.files || [])]; ev.target.value = '';
    if (!files.length) return;
    if (!deviceInfo) { $('gaSt').textContent = t('im_nodev'); return; }
    state.images = [...(state.images || [])];
    for (let i = 0; i < files.length; i++) {
      $('gaSt').textContent = t('sy_sending', {f: files[i].name, i: i + 1, n: files.length});
      try {
        const jpg = await pictureToJpeg(files[i]);
        const name = `img/${Date.now().toString(36)}${i}.jpg`;
        await xhrUpload(api('/api/fs?path=' + encodeURIComponent('/www/' + name)), new File([jpg], 'p.jpg'), 'file');
        state.images.push({src: name, fit: 'cover', caption: ''});
      } catch (e) { $('gaSt').textContent = t('sy_err', {e: e.message}); break; }
    }
    if (!/^Error|Errore/.test($('gaSt').textContent)) $('gaSt').textContent = '';
    renderGalleryBox(); buildTabs(); scheduleRender(); saveState(true);
  });
  renderGalleryBox();
}

// Cover-crop to 400x300 (the screen), JPEG: about 30 KB per picture.
async function pictureToJpeg(file) {
  const url = URL.createObjectURL(file);
  try {
    const img = await loadLocalImage(url);
    if (!img) throw new Error(t('tr_bad'));
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, W, H);
    const k = Math.max(W / img.naturalWidth, H / img.naturalHeight);
    x.drawImage(img, (W - img.naturalWidth * k) / 2, (H - img.naturalHeight * k) / 2, img.naturalWidth * k, img.naturalHeight * k);
    return await new Promise(res => c.toBlob(res, 'image/jpeg', 0.85));
  } finally { URL.revokeObjectURL(url); }
}

function renderGalleryBox() {
  if (!$('gallerybox')) return;
  $('gaInfo').textContent = t('im_info');
  $('gaUp').textContent = t('im_up');
  const list = state.images || [];
  const changed = () => { scheduleRender(); saveState(true); };
  $('gaList').replaceChildren(...list.map((it, i) => {
    const row = document.createElement('div'); row.className = 'garow';
    const img = document.createElement('img'); img.alt = ''; img.src = boardUrl(it.src);
    const cap = document.createElement('input'); cap.placeholder = t('im_caption'); cap.value = it.caption || '';
    cap.oninput = () => { it.caption = cap.value; changed(); };
    const fit = document.createElement('select');
    for (const k of ['cover', 'contain']) fit.add(new Option(t('im_' + k), k));
    fit.value = it.fit || 'cover'; fit.oninput = () => { it.fit = fit.value; changed(); };
    const show = document.createElement('button'); show.type = 'button'; show.textContent = t('col_preview');
    show.onclick = () => { previewPage = 'images'; previewPart = 0; previewCard = null; state._previewImg = i; buildTabs(); render(); };
    const del = document.createElement('button'); del.type = 'button'; del.textContent = t('remove');
    del.onclick = async () => {
      if (deviceInfo) await fetch(api('/api/fs/delete?path=' + encodeURIComponent('/www/' + it.src)), {method: 'POST'}).catch(() => {});
      state.images = list.filter((_, k) => k !== i);
      renderGalleryBox(); buildTabs(); changed();
    };
    row.append(img, cap, fit, show, del);
    return row;
  }));
}
