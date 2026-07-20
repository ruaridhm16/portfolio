const PDF_FILE = 'Display_Portfolio.pdf';

// ── PDF.JS ──
pdfjsLib.GlobalWorkerOptions.workerSrc =
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

let pdfDoc      = null;
let currentPage = 1;
let totalPages  = 0;
let rendering   = false;
const pageCache = {};

const canvasFront = document.getElementById('pdfCanvas');
const canvasBack  = document.getElementById('pdfCanvasNext');
const ctxFront    = canvasFront.getContext('2d');
const ctxBack     = canvasBack.getContext('2d');
const loadingEl   = document.getElementById('pdfLoading');
const controls    = document.getElementById('pdfControls');
const pageInfo    = document.getElementById('pdfPageInfo');
const zonePrev    = document.getElementById('pdfZonePrev');
const zoneNext    = document.getElementById('pdfZoneNext');

function renderToOffscreen(pageNum) {
  if (pageCache[pageNum]) return Promise.resolve(pageCache[pageNum]);
  return pdfDoc.getPage(pageNum).then(page => {
    const viewer = document.getElementById('pdfViewer');
    const dpr    = Math.min(window.devicePixelRatio || 1, 2);
    const scale  = (viewer.clientWidth / page.getViewport({ scale: 1 }).width) * dpr;
    const vp     = page.getViewport({ scale });
    const off    = document.createElement('canvas');
    off.width    = vp.width;
    off.height   = vp.height;
    return page.render({ canvasContext: off.getContext('2d'), viewport: vp }).promise.then(() => {
      pageCache[pageNum] = off;
      return off;
    });
  });
}

function paintToCanvas(target, ctx, off) {
  target.width  = off.width;
  target.height = off.height;
  ctx.drawImage(off, 0, 0);
}

function showPage(num) {
  if (rendering) return;
  rendering = true;

  // If already cached, skip the loading flash entirely
  const alreadyCached = !!pageCache[num];

  renderToOffscreen(num).then(off => {
    paintToCanvas(canvasBack, ctxBack, off);
    canvasBack.classList.add('show');
    canvasFront.classList.add('hide');

    // Faster swap if cached (no render lag)
    const delay = alreadyCached ? 80 : 220;
    setTimeout(() => {
      paintToCanvas(canvasFront, ctxFront, off);
      canvasFront.classList.remove('hide');
      canvasBack.classList.remove('show');
      rendering = false;

      loadingEl.classList.add('hidden');
      controls.style.display = 'flex';
      pageInfo.textContent = `${num} / ${totalPages}`;
      zonePrev.classList.toggle('hidden-btn', num <= 1);
      zoneNext.classList.toggle('hidden-btn', num >= totalPages);

      // Pre-render neighbours silently
      if (num + 1 <= totalPages) renderToOffscreen(num + 1);
      if (num - 1 >= 1)          renderToOffscreen(num - 1);
    }, delay);
  });
}

function goNext() { if (currentPage < totalPages && !rendering) { currentPage++; showPage(currentPage); } }
function goPrev() { if (currentPage > 1 && !rendering)          { currentPage--; showPage(currentPage); } }

function initPDF() {
  pdfjsLib.getDocument({
    url: PDF_FILE,
    disableRange: false,
    disableStream: false,
    // Pre-fetch the first 32KB so page 1 starts immediately
    rangeChunkSize: 32768,
  }).promise.then(pdf => {
    pdfDoc     = pdf;
    totalPages = pdf.numPages;
    showPage(1);
    preparePrintPages();
  }).catch(() => {
    loadingEl.querySelector('span').textContent = 'Could not load portfolio PDF.';
  });
}

let printPagesReady = false;
async function preparePrintPages() {
  if (printPagesReady || !pdfDoc) return;
  printPagesReady = true;
  const container = document.getElementById('printPdfPages');
  try {
    for (let i = 1; i <= totalPages; i++) {
      const page = await pdfDoc.getPage(i);
      const vp = page.getViewport({ scale: 2 });
      const canvas = document.createElement('canvas');
      canvas.width = vp.width;
      canvas.height = vp.height;
      await page.render({ canvasContext: canvas.getContext('2d'), viewport: vp }).promise;
      const img = document.createElement('img');
      img.src = canvas.toDataURL('image/jpeg', 0.85);
      img.alt = `Portfolio page ${i}`;
      container.appendChild(img);
    }
  } catch (err) {
    printPagesReady = false;
  }
}
window.addEventListener('beforeprint', preparePrintPages);

zonePrev.addEventListener('click', goPrev);
zoneNext.addEventListener('click', goNext);

document.addEventListener('keydown', e => {
  if (e.key === 'ArrowRight' || e.key === 'ArrowDown') goNext();
  if (e.key === 'ArrowLeft'  || e.key === 'ArrowUp')   goPrev();
});

// ── HELPERS ──
function tagsHtml(tags) {
  return (tags || []).map(t => `<span class="tag ${t.style}">${t.label}</span>`).join('');
}
const FILE_ICON = `<svg class="file-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M8 3h8l4 4v10a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z"/><path d="M8 3v4a2 2 0 0 0 2 2h4"/><path d="M4 8v11a2 2 0 0 0 2 2h9"/></svg>`;
const WEB_ICON  = `<svg class="file-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10z"/></svg>`;
const GAME_ICON = `<svg class="file-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M6 9h12a4 4 0 0 1 4 4l1 5a2.5 2.5 0 0 1-4.5 1.8L16 17H8l-2.5 2.8A2.5 2.5 0 0 1 1 18l1-5a4 4 0 0 1 4-4Z"/><line x1="7.5" y1="12.5" x2="7.5" y2="15.5"/><line x1="6" y1="14" x2="9" y2="14"/><circle cx="16.5" cy="12.5" r="0.9" fill="currentColor" stroke="none"/><circle cx="18.5" cy="14.5" r="0.9" fill="currentColor" stroke="none"/></svg>`;

// Discipline icons — keyed by each project's primary (first) tag, so the
// row icon reflects what kind of project it is, not just how you open it.
const DISCIPLINE_ICONS = {
  'product design engineering': `<svg class="file-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.8 2.8-2-2Z"/></svg>`,
  'software engineering':      `<svg class="file-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><polyline points="9 6 3 12 9 18"/><polyline points="15 6 21 12 15 18"/></svg>`,
  'physical computing':        `<svg class="file-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="7" y="7" width="10" height="10" rx="1.5"/><path d="M9 3v4M15 3v4M9 17v4M15 17v4M3 9h4M3 15h4M17 9h4M17 15h4"/></svg>`,
  'finite element analysis':   `<svg class="file-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4 18 12 4 20 18Z"/><path d="M8 18 12 10 16 18M4 18h16M12 4v14"/></svg>`,
  'aerodynamics':               `<svg class="file-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 8h11a2.5 2.5 0 1 0-2.2-3.6"/><path d="M3 13h15a2.5 2.5 0 1 1-2.2 3.6"/><path d="M3 18h8"/></svg>`,
  'thermodynamics':             `<svg class="file-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 14.5V5a2 2 0 1 0-4 0v9.5a4 4 0 1 0 4 0Z"/><line x1="10" y1="8" x2="12.5" y2="8"/></svg>`,
  'sustainable design':        `<svg class="file-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M20 4C10 4 4 10 4 18c8 0 14-6 14-14Z"/><path d="M6 18c4-4 8-7 12-12"/></svg>`,
  'human centred design':      `<svg class="file-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="7" r="3.2"/><path d="M5 20c0-4 3.1-6.5 7-6.5s7 2.5 7 6.5"/></svg>`,
  'design principles':         `<svg class="file-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="5.5" r="1.6"/><path d="M12 7 5 20h4l3-6 3 6h4Z"/></svg>`,
  'materials':                  `<svg class="file-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 3 3 8l9 5 9-5Z"/><path d="M3 12l9 5 9-5M3 16l9 5 9-5"/></svg>`,
  'figma':                      `<svg class="file-icon" width="9" height="13" viewBox="0 0 38 57" fill="currentColor"><path d="M19 28.5a9.5 9.5 0 1 1 19 0 9.5 9.5 0 0 1-19 0Z"/><path d="M0 47.5A9.5 9.5 0 0 1 9.5 38H19v9.5a9.5 9.5 0 1 1-19 0Z"/><path d="M19 0v19h9.5a9.5 9.5 0 1 0 0-19H19Z"/><path d="M0 9.5A9.5 9.5 0 0 0 9.5 19H19V0H9.5A9.5 9.5 0 0 0 0 9.5Z"/><path d="M0 28.5A9.5 9.5 0 0 0 9.5 38H19V19H9.5A9.5 9.5 0 0 0 0 28.5Z"/></svg>`
};

function isGame(p) {
  const website = (p.website || '').toLowerCase();
  const tags = (p.tags || []).map(t => (t.label || '').toLowerCase());
  return website.includes('itch.io') || tags.some(t => t.includes('game'));
}

function isExternal(url) { return /^https?:\/\//i.test(url || ''); }

function projectIcon(p) {
  if (isGame(p)) return GAME_ICON;
  const primaryTag = ((p.tags || [])[0] || {}).label;
  const discipline = DISCIPLINE_ICONS[(primaryTag || '').toLowerCase()];
  if (discipline) return discipline;
  return p.website ? WEB_ICON : FILE_ICON;
}

const prefetchedFiles = new Set();
function prefetchFile(url) {
  if (!url || prefetchedFiles.has(url)) return;
  prefetchedFiles.add(url);
  fetch(url, { mode: 'same-origin' }).catch(() => {});
}
function handlePrefetchIntent(e) {
  const el = e.target.closest('[data-prefetch]');
  if (el) prefetchFile(el.dataset.prefetch);
}
document.addEventListener('mouseover', handlePrefetchIntent);
document.addEventListener('touchstart', handlePrefetchIntent, { passive: true });
document.addEventListener('focusin', handlePrefetchIntent);

// ── RENDER CAROUSEL ──
function renderCarousel(projects) {
  const container = document.getElementById('carouselContainer');
  container.innerHTML = '';

  const featured = projects.filter(p => p.featured);

  if (!featured.length) {
    container.innerHTML = '<div class="loading">No featured projects yet.</div>';
    return;
  }

  featured.forEach(p => {
    const imgStyle = p.image ? `background-image:url('${p.image}')` : '';
    const game = isGame(p);

    const buttons = [];

    if (p.simulator) {
      buttons.push(
        `<a href="${p.simulator}" target="_blank" class="card-btn">Simulator</a>`
      );
    }
    else if (p.repo) {
      buttons.push(
        `<a href="${p.repo}" target="_blank" class="card-btn">GitHub</a>`
      );
    }


    if (p.file) {
      buttons.push(
        `<a href="${p.file}" download class="card-btn" data-prefetch="${p.file}">Download</a>`
      );

      buttons.push(
        `<a href="${p.file}" target="_blank" class="card-btn primary" data-prefetch="${p.file}">View</a>`
      );
    }

    if (p.website) {
      const websiteTarget = isExternal(p.website) ? ' target="_blank"' : '';
      buttons.push(
        `<a href="${p.website}"${websiteTarget} class="card-btn primary">${
          game ? 'Play' : 'Visit'
        }</a>`
      );
    }

    const actions = buttons.join('');

    container.insertAdjacentHTML('beforeend', `
      <div class="embla__slide">
        <div class="card" tabindex="0" role="link" aria-label="${p.title}" data-website="${p.website || ''}" data-file="${p.file || ''}">
          <div class="card-img">
            <div class="card-img-inner" style="${imgStyle}"></div>
          </div>
          <div class="card-body">
            <div class="card-tags">${tagsHtml(p.tags)}</div>
            <div class="card-title">${p.title}</div>
            <div class="card-desc">${p.desc}</div>
            <div class="card-actions">${actions}</div>
          </div>
        </div>
      </div>`);
  });

  function goToCard(card) {
    const url = card.dataset.website || card.dataset.file;
    if (!url) return;
    if (isExternal(url)) window.open(url, '_blank');
    else window.location.href = url;
  }

  container.querySelectorAll('.card').forEach(card => {
    card.addEventListener('click', e => {
      if (e.target.closest('.card-actions')) return;
      goToCard(card);
    });

    card.addEventListener('keydown', e => {
      if ((e.key === 'Enter' || e.key === ' ') && !e.target.closest('.card-actions')) {
        e.preventDefault();
        goToCard(card);
      }
    });
  });
}

// ── RENDER ALL FILES ──
function renderFiles(projects) {
  const container = document.getElementById('filesInner');
  container.innerHTML = '';

  const groups = {};
  projects.forEach(p => {
    if (!groups[p.group]) groups[p.group] = [];
    groups[p.group].push(p);
  });

  Object.entries(groups).forEach(([groupName, items]) => {
    const rows = items.map(p => {
      const game = isGame(p);
      const icon = projectIcon(p);

      const buttons = [];

      if (p.simulator) {
      buttons.push(
        `<a href="${p.simulator}" target="_blank" class="card-btn">Simulator</a>`
      );
      }
      else if (p.repo) {
        buttons.push(
          `<a href="${p.repo}" target="_blank" class="card-btn">GitHub</a>`
        );
      }

      if (p.file) {
        buttons.push(
          `<a href="${p.file}" download class="file-btn" data-prefetch="${p.file}">Download</a>`
        );

        buttons.push(
          `<a href="${p.file}" target="_blank" class="file-btn dl" data-prefetch="${p.file}">View</a>`
        );
      }

      if (p.website) {
        const websiteTarget = isExternal(p.website) ? ' target="_blank"' : '';
        buttons.push(
          `<a href="${p.website}"${websiteTarget} class="file-btn dl">${
            game ? 'Play' : 'Visit'
          }</a>`
        );
      }

      const actions = buttons.join('');

      const expand = p.desc
        ? `<div class="file-expand"><div class="file-expand-inner">
            ${p.image ? `<div class="file-expand-img" style="background-image:url('${p.image}')"></div>` : ''}
            <p class="file-expand-desc">${p.desc}</p>
          </div></div>`
        : '';

      return `<div class="file-row" tabindex="0" role="link" aria-label="${p.title}" data-title="${p.title}" data-desc="${p.desc || ''}" data-image="${p.image || ''}" data-website="${p.website || ''}" data-file="${p.file || ''}">
        <div class="file-row-main">
          <div class="file-info">${icon}<span class="file-name">${p.title}</span></div>
          <div class="tags">${tagsHtml(p.tags)}</div>
          <div class="file-actions">${actions}</div>
        </div>
        ${expand}
      </div>`;
    }).join('');

    container.insertAdjacentHTML(
      'beforeend',
      `<div class="file-group"><div class="group-label">${groupName}</div>${rows}</div>`
    );
  });

  function goToRow(row) {
    const url = row.dataset.website || row.dataset.file;
    if (!url) return;
    if (isExternal(url)) window.open(url, '_blank');
    else window.location.href = url;
  }
  container.querySelectorAll('.file-row').forEach(row => {
    row.addEventListener('click', e => {
      if (e.target.closest('.file-actions')) return;
      goToRow(row);
    });
    row.addEventListener('keydown', e => {
      if ((e.key === 'Enter' || e.key === ' ') && !e.target.closest('.file-actions')) {
        e.preventDefault();
        goToRow(row);
      }
    });
  });
  initFilePreview();
}

// ── FLOATING FILE PREVIEW ──
function initFilePreview() {
  // Below the mobile breakpoint, initTouchSafetyTaps handles this instead —
  // keyed off viewport width (not hover capability) so it matches the same
  // breakpoint the rest of the layout uses, and so testing by resizing a
  // regular desktop browser window actually reflects mobile behaviour.
  if (window.matchMedia('(max-width: 860px)').matches) return;
  const card  = document.getElementById('filePreviewCard');
  const img   = document.getElementById('filePreviewImg');
  const title = document.getElementById('filePreviewTitle');
  const desc  = document.getElementById('filePreviewDesc');
  const zone  = document.getElementById('filesInner');

  let warm = false;        // once true, cards switch instantly
  let warmupTimer = null;  // the one-time 0.5s grace period on first entry
  let activeRow = null;
  let lastX = 0, lastY = 0;

  function renderCard(row) {
    if (!row || !row.dataset.desc) return;
    title.textContent = row.dataset.title;
    desc.textContent  = row.dataset.desc;
    if (row.dataset.image) {
      img.style.backgroundImage = `url('${row.dataset.image}')`;
      img.style.display = 'block';
    } else {
      img.style.display = 'none';
    }
    card.classList.add('visible');
    position(row);
  }

  // Anchored to the row itself (top-right corner, flipping below if there's
  // no room above) — no cursor-tracking, it just sits still while shown.
  function position(row) {
    const rect = row.getBoundingClientRect();
    const cw = card.offsetWidth, ch = card.offsetHeight;
    let left = rect.left + rect.width / 2 - cw / 2;
    left = Math.max(12, Math.min(left, window.innerWidth - cw - 12));
    let top = rect.top - ch - 10;
    if (top < 12) top = rect.bottom + 10;
    top = Math.max(12, Math.min(top, window.innerHeight - ch - 12));
    card.style.left = left + 'px';
    card.style.top  = top + 'px';
  }

  function hide() {
    card.classList.remove('visible');
    activeRow = null;
  }

  // First row hovered after entering the section waits 0.5s before showing
  // anything (so a mouse that only landed there mid-scroll doesn't pop a
  // card while you're still reading). Everything after that is instant,
  // until the mouse leaves the whole section.
  function focusRow(row) {
    if (!row.dataset.desc) { hide(); return; }
    if (row === activeRow) { position(row); return; }
    activeRow = row;
    if (warm) {
      renderCard(row);
    } else if (!warmupTimer) {
      warmupTimer = setTimeout(() => {
        warm = true;
        warmupTimer = null;
        if (activeRow) renderCard(activeRow);
      }, 500);
    }
  }

  document.querySelectorAll('.file-row').forEach(row => {
    row.addEventListener('mouseenter', e => {
      lastX = e.clientX; lastY = e.clientY;
      focusRow(row);
    });
    row.addEventListener('mouseleave', () => {
      setTimeout(() => { if (activeRow === row) hide(); }, 50);
    });
  });

  document.addEventListener('mousemove', e => {
    lastX = e.clientX; lastY = e.clientY;
  }, { passive: true });

  // A row can slide under a stationary cursor while the page scrolls —
  // mouseenter alone never fires for that, so re-check on every scroll.
  window.addEventListener('scroll', () => {
    if (!zone.contains(document.elementFromPoint(lastX, lastY))) return;
    const row = document.elementFromPoint(lastX, lastY).closest('.file-row');
    if (row) focusRow(row);
    else if (activeRow) hide();
  }, { passive: true, capture: true });

  zone.addEventListener('mouseleave', () => {
    clearTimeout(warmupTimer);
    warmupTimer = null;
    warm = false;
    hide();
  });
}

// ── SCATTER (disabled — uncomment this block + the init call below to bring it back) ──
/*
const SCATTER = [
  {x:-6,y:22,r:4},{x:-10,y:10,r:2},{x:-6,y:12,r:-3},{x:0,y:2,r:-3},{x:0,y:-6,r:2},
  {x:0,y:6,r:-1},{x:0,y:-11,r:-2},{x:0,y:4,r:4},{x:4,y:-8,r:3},{x:6,y:10,r:-2},
  {x:-3,y:-4,r:3},{x:3,y:7,r:-2},{x:-4,y:3,r:1},{x:2,y:-3,r:-2},{x:-2,y:5,r:2},
  {x:4,y:-2,r:-1},{x:-3,y:2,r:2},{x:1,y:-4,r:-1},{x:-2,y:4,r:2},{x:3,y:-2,r:-1}
];
function initScatter_DISABLED(el) {
  const text = el.textContent.trim(); el.textContent = '';
  const outers = [], inners = [];
  text.split('').forEach(char => {
    const outer = document.createElement('span'); outer.className = 's-outer';
    const inner = document.createElement('span'); inner.className = 's-inner';
    const ch    = document.createElement('span'); ch.className = 's-char';
    ch.textContent = char === ' ' ? ' ' : char;
    inner.appendChild(ch); outer.appendChild(inner); el.appendChild(outer);
    outers.push(outer); inners.push(inner);
  });
  let floats = [];
  el.addEventListener('mouseenter', () => {
    outers.forEach((outer, i) => {
      const s = SCATTER[i % SCATTER.length];
      gsap.to(outer, { xPercent:s.x, yPercent:s.y, rotation:s.r, duration:0.22, ease:'power3.inOut' });
      floats.push(gsap.to(inners[i], {
        keyframes:[{yPercent:0,duration:0},{yPercent:-2,duration:2.5,ease:'power3.inOut'},{yPercent:0,duration:2.5,ease:'power3.inOut'}],
        repeat:-1, delay:Math.random()*0.3
      }));
    });
  });
  el.addEventListener('mouseleave', () => {
    floats.forEach(t => t.kill()); floats = [];
    outers.forEach((outer, i) => {
      gsap.to(outer, { xPercent:0, yPercent:0, rotation:0, duration:0.3, ease:'power3.inOut' });
      gsap.to(inners[i], { yPercent:0, duration:0.3, ease:'power3.inOut' });
    });
  });
}
*/

// ── CAROUSEL — native scroll, no snapping, custom scrollbar ──
function initCarousel() {
  const node   = document.getElementById('embla');
  const track  = document.getElementById('carouselScrollbar');
  const thumb  = document.getElementById('carouselThumb');

  function maxScroll() { return node.scrollWidth - node.clientWidth; }

  function sync() {
    const max = maxScroll();
    if (max <= 0) {
      track.classList.add('hidden');
      return;
    }
    track.classList.remove('hidden');
    const thumbRatio = node.clientWidth / node.scrollWidth;
    const thumbWidth = Math.max(thumbRatio * track.clientWidth, 36);
    const thumbTravel = track.clientWidth - thumbWidth;
    thumb.style.width = thumbWidth + 'px';
    thumb.style.left  = ((node.scrollLeft / max) * thumbTravel) + 'px';
  }

  node.addEventListener('scroll', sync, { passive: true });
  window.addEventListener('resize', sync);

  // Remember how far through the carousel they'd scrolled, so coming
  // back (e.g. after opening a project and hitting back) doesn't just
  // dump them back at the start
  const SCROLL_KEY = 'cs';
  const savedScroll = parseInt(localStorage.getItem(SCROLL_KEY), 10);
  if (!isNaN(savedScroll)) node.scrollLeft = savedScroll;
  let scrollSaveTimer = null;
  node.addEventListener('scroll', () => {
    clearTimeout(scrollSaveTimer);
    scrollSaveTimer = setTimeout(() => {
      localStorage.setItem(SCROLL_KEY, Math.round(node.scrollLeft));
    }, 150);
  }, { passive: true });

  // Drag the thumb itself
  let dragging = false, startX = 0, startScrollLeft = 0;
  thumb.addEventListener('pointerdown', e => {
    dragging = true;
    startX = e.clientX;
    startScrollLeft = node.scrollLeft;
    thumb.classList.add('dragging');
    thumb.setPointerCapture(e.pointerId);
  });
  thumb.addEventListener('pointermove', e => {
    if (!dragging) return;
    const thumbTravel = track.clientWidth - thumb.offsetWidth;
    if (thumbTravel <= 0) return;
    const dx = e.clientX - startX;
    node.scrollLeft = startScrollLeft + dx * (maxScroll() / thumbTravel);
  });
  const stopDrag = () => { dragging = false; thumb.classList.remove('dragging'); };
  thumb.addEventListener('pointerup', stopDrag);
  thumb.addEventListener('pointercancel', stopDrag);

  // Click anywhere on the track to jump straight there
  track.addEventListener('pointerdown', e => {
    if (e.target === thumb) return;
    const rect = track.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    node.scrollLeft = ratio * maxScroll();
  });

  sync();

  const slides = node.querySelectorAll('.embla__slide');
  const obs = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        const idx = Array.from(slides).indexOf(e.target);
        setTimeout(() => e.target.classList.add('in'), idx * 30);
        obs.unobserve(e.target);
      }
    });
  }, { threshold: 0.1 });
  slides.forEach(s => obs.observe(s));
}

// ── DARK MODE ──
function initDarkMode() {
  document.getElementById('logoBtn').addEventListener('click', () => {
    const isDark = document.documentElement.classList.toggle('dark');
    // Key present = dark, key absent = light — never write the word
    // "light" at all, since that's the default anyway.
    if (isDark) localStorage.setItem('t', '');
    else localStorage.removeItem('t');
  });
}

// ── CV DOWNLOAD: small particle burst as a bit of positive feedback ──
function initCVFeedback() {
  const link = document.querySelector('.cv-link');
  if (!link) return;
  const colors = ['#4C47E2', '#FF7A59', '#2DD4BF', '#FBBF24', '#F472B6'];

  link.addEventListener('click', () => {
    // Checked fresh on every click (not cached at page load) in case the
    // OS setting changes without a reload — and this is the one and only
    // gate: reduced motion means no confetti at all, full stop.
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const rect = link.getBoundingClientRect();
    // Document-relative (position: absolute), not viewport-relative —
    // getBoundingClientRect() is viewport coordinates, so scroll offset
    // has to be added to place these correctly in the page itself.
    const originX = -160 + window.scrollX;
    const originY = rect.top + rect.height / 2 + 40 + window.scrollY;
    const count = 50;
    const gravity = 0.0028; // px/ms² — accumulated onto vy every frame
    const maxLifetime = 6000; // hard safety cap in case a piece is oddly slow to leave the screen

    // One shared rAF loop updates every piece (not one loop per piece),
    // and only ever writes `transform` — compositor-only, no layout —
    // so this stays cheap even at high counts.
    const pieces = [];
    const fragment = document.createDocumentFragment(); // one DOM insertion for all 50, not 50 separate ones
    for (let i = 0; i < count; i++) {
      const angle = -0.65 + (Math.random() - 0.7) * 0.5; // steep up-and-right, ~±14° of variation
      const speed = 1.0 + Math.random() * 1.1; // px/ms — genuinely fast, not a gentle toss
      const w = 5 + Math.random() * 4;
      const h = w * (1.6 + Math.random() * 0.8);

      const el = document.createElement('div');
      el.className = 'cv-burst-dot';
      el.style.left = originX + 'px';
      el.style.top = originY + 'px';
      el.style.width = `${w}px`;
      el.style.height = `${h}px`;
      el.style.background = colors[i % colors.length];
      el.style.borderRadius = Math.random() < 0.3 ? '2px' : '0';
      fragment.appendChild(el);

      pieces.push({
        el, x: 0, y: 0,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        rot: 0,
        rotSpeed: (Math.random() < 0.5 ? -1 : 1) * (0.25 + Math.random() * 0.4), // deg/ms
        born: performance.now(),
      });
    }
    document.body.appendChild(fragment);

    let lastFrame = performance.now();
    function frame(now) {
      const dt = Math.min(now - lastFrame, 40);
      lastFrame = now;
      // Re-checked every frame since these are document coordinates now —
      // if the page is scrolled mid-flight, "off the visible screen"
      // should track wherever the viewport actually is at that moment.
      const maxX = window.scrollX + window.innerWidth + 100;
      const maxY = window.scrollY + window.innerHeight + 100;

      for (let i = pieces.length - 1; i >= 0; i--) {
        const p = pieces[i];
        p.vy += gravity * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.rot += p.rotSpeed * dt;

        const offscreen = originX + p.x > maxX || originY + p.y > maxY;
        if (offscreen || now - p.born > maxLifetime) {
          p.el.remove();
          pieces.splice(i, 1);
          continue;
        }
        p.el.style.transform = `translate(${p.x}px, ${p.y}px) rotate(${p.rot}deg)`;
      }
      if (pieces.length) requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  });
}

// ── EASED SCROLL — "Scroll for more" gets a custom eased jump instead of
// the browser's default (fairly linear) smooth scroll ──
function initEasedScroll() {
  const link = document.getElementById('scrollHint');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function easeInOutCubic(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  link.addEventListener('click', e => {
    e.preventDefault();
    const target = document.querySelector(link.getAttribute('href'));
    if (!target) return;
    const targetY = target.getBoundingClientRect().top + window.scrollY;

    if (reducedMotion) { window.scrollTo(0, targetY); return; }

    const startY = window.scrollY;
    const diff = targetY - startY;
    const duration = 900;
    const startTime = performance.now();

    function step(now) {
      const progress = Math.min((now - startTime) / duration, 1);
      // 'auto' just means "do whatever scroll-behavior says", which is
      // 'smooth' here — so the browser was re-smoothing *between* every
      // one of these rAF steps too, fighting our own easing. 'instant'
      // actually bypasses CSS scroll-behavior for this call.
      window.scrollTo({ top: startY + diff * easeInOutCubic(progress), behavior: 'instant' });
      if (progress < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  });
}

// ── EMAIL: COPY TO CLIPBOARD INSTEAD OF OPENING A MAIL CLIENT ──
function initEmailCopy() {
  document.querySelectorAll('a[href^="mailto:"]').forEach(link => {
    const email = link.getAttribute('href').slice('mailto:'.length);
    link.setAttribute('data-tooltip', 'Copy Email');
    link.addEventListener('click', e => {
      e.preventDefault();
      navigator.clipboard.writeText(email).then(() => {
        link.setAttribute('data-tooltip', 'Copied!');
        setTimeout(() => link.setAttribute('data-tooltip', 'Copy Email'), 1200);
      });
    });
  });
}

// ── TOUCH SAFETY TAPS ──
// On touch, there's no hover to preview what a tap will do, so the first
// tap on anything that "goes somewhere" just shows what it would do
// (tooltip / inline preview), and a second tap on the same thing actually
// follows through. Tapping anything else cancels it.
function initTouchSafetyTaps() {
  if (!window.matchMedia('(max-width: 860px)').matches) return;
  const SELECTOR = '.file-row, .card, .site-updated-date, .site-updated-title, .social-icons a, #logoBtn';
  let armed = null;
  let armTimer = null;

  function disarm() {
    if (armed) armed.classList.remove('tap-armed');
    armed = null;
    clearTimeout(armTimer);
  }

  document.addEventListener('click', e => {
    if (e.target.closest('.card-actions, .file-actions')) { disarm(); return; }
    const el = e.target.closest(SELECTOR);
    if (!el) { disarm(); return; }
    if (armed === el) { disarm(); return; } // second tap — let it through
    e.preventDefault();
    e.stopPropagation();
    disarm();
    armed = el;
    el.classList.add('tap-armed');
    armTimer = setTimeout(disarm, 3000);
  }, true);
}

// ── SKILLS TICKER — draggable, throws with momentum, settles back into a steady scroll ──
function initSkillsTicker() {
  const track = document.querySelector('.skills-ticker-track');
  const group = track.querySelector('.skills-ticker-group');
  // No idle drift and no post-release momentum for anyone who's asked
  // their OS to reduce motion — dragging by hand still works fine since
  // that's user-driven, not an animation.
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  let groupWidth = group.offsetWidth;
  let autoSpeed = reducedMotion ? 0 : groupWidth / 45000; // px/ms — matches the old 45s-per-loop pace
  window.addEventListener('resize', () => {
    groupWidth = group.offsetWidth;
    autoSpeed = reducedMotion ? 0 : groupWidth / 45000;
  });

  let pos = 0;
  let direction = -1; // -1 = normal leftward drift, flips to +1 after a hard rightward throw
  let velocity = -autoSpeed;

  // Restore where it was and which way it was headed — one key, two
  // fields packed into a single delimited string (rounded to whole
  // pixels) rather than JSON, and only ever written on tab-hide/unload
  // (see below), not on every frame.
  const TICKER_KEY = 'sk';
  const savedTicker = localStorage.getItem(TICKER_KEY);
  if (savedTicker) {
    const sep = savedTicker.indexOf('|');
    const savedPos = Number(savedTicker.slice(0, sep));
    if (!Number.isNaN(savedPos)) {
      pos = savedPos;
      direction = savedTicker.slice(sep + 1) === '1' ? 1 : -1;
      velocity = direction * autoSpeed;
    }
  }
  function saveTickerState() {
    try { localStorage.setItem(TICKER_KEY, `${Math.round(pos)}|${direction === 1 ? '1' : '0'}`); }
    catch (e) { /* storage full/unavailable — fine, just skip saving */ }
  }
  document.addEventListener('visibilitychange', () => { if (document.hidden) saveTickerState(); });
  window.addEventListener('pagehide', saveTickerState);

  let dragging = false;
  let dragStartX = 0;
  let dragStartPos = 0;
  let lastX = 0;
  let lastT = 0;
  let flingVelocity = 0;

  function wrapPos(p) {
    if (groupWidth <= 0) return p;
    p = p % groupWidth;
    if (p > 0) p -= groupWidth;
    return p;
  }

  track.addEventListener('pointerdown', e => {
    dragging = true;
    track.classList.add('dragging');
    track.setPointerCapture(e.pointerId);
    dragStartX = e.clientX;
    dragStartPos = pos;
    lastX = e.clientX;
    lastT = performance.now();
    flingVelocity = 0;
  });

  track.addEventListener('pointermove', e => {
    if (!dragging) return;
    const now = performance.now();
    const dt = now - lastT || 16;
    flingVelocity = (e.clientX - lastX) / dt;
    pos = dragStartPos + (e.clientX - dragStartX);
    lastX = e.clientX;
    lastT = now;
  });

  const HARD_THROW = 0.4; // px/ms — above this, the throw resets which way it idles

  function endDrag() {
    if (!dragging) return;
    dragging = false;
    track.classList.remove('dragging');
    if (reducedMotion) { velocity = 0; return; }
    const flingSpeed = Math.min(Math.abs(flingVelocity), 3);
    if (flingSpeed > HARD_THROW) {
      direction = flingVelocity > 0 ? 1 : -1;
    }
    velocity = Math.sign(flingVelocity || direction) * Math.max(flingSpeed, autoSpeed);
  }
  track.addEventListener('pointerup', endDrag);
  track.addEventListener('pointercancel', endDrag);

  let lastFrame = performance.now();
  function frame(now) {
    const dt = Math.min(now - lastFrame, 50);
    lastFrame = now;
    if (!dragging && document.hasFocus()) {
      // Momentum eases back into the steady drift speed, in whichever
      // direction the last hard throw set
      const target = direction * autoSpeed;
      velocity += (target - velocity) * Math.min(dt / 400, 1);
      pos += velocity * dt;
    }
    pos = wrapPos(pos);
    track.style.transform = `translateX(${pos}px)`;
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

// ── LOAD PROJECTS ──
async function loadProjects() {
  try {
    const res = await fetch('projects.json');
    if (!res.ok) throw new Error();
    const projects = await res.json();
    renderCarousel(projects);
    renderFiles(projects);
    initCarousel();
    initRepoUpdated();
    document.getElementById('projectCount').textContent = projects.length;
    localStorage.setItem('pc', projects.length);
  } catch (err) {
    document.getElementById('carouselContainer').innerHTML =
      `<div class="loading">Couldn't load the projects right now.</div>`;
    console.error(err);
  }
}

// ── LIVE "LAST UPDATED" FROM GITHUB ──
function timeAgo(dateStr) {
  const mins = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
  if (mins < 60) return mins <= 1 ? 'just now' : `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
}

const repoUpdatedCache = {};
const REPO_CACHE_TTL = 15 * 60 * 1000; // 15 minutes — plenty fresh, far fewer GitHub API calls

async function fetchRepoUpdated(repoUrl) {
  if (repoUpdatedCache[repoUrl]) return repoUpdatedCache[repoUrl];
  const match = repoUrl.match(/github\.com\/([^/]+)\/([^/]+)/);
  if (!match) return null;

  // Key is just "owner/repo" (no scheme/host, no "repoUpdated:" prefix)
  // and the value is three pipe-delimited fields — epoch millis for both
  // timestamps rather than ISO-8601 strings — instead of JSON, which
  // would otherwise spend a couple dozen bytes per entry on repeated key
  // names, quotes, braces and colons that carry no actual information.
  const storageKey = `r:${match[1]}/${match[2]}`;
  try {
    const raw = localStorage.getItem(storageKey);
    if (raw) {
      const sep1 = raw.indexOf('|');
      const sep2 = raw.indexOf('|', sep1 + 1);
      const fetchedAt = Number(raw.slice(0, sep1));
      if (Date.now() - fetchedAt < REPO_CACHE_TTL) {
        const info = { date: Number(raw.slice(sep1 + 1, sep2)), title: raw.slice(sep2 + 1) };
        repoUpdatedCache[repoUrl] = Promise.resolve(info);
        return repoUpdatedCache[repoUrl];
      }
    }
  } catch (e) { /* ignore bad/missing cache entries */ }

  const promise = fetch(`https://api.github.com/repos/${match[1]}/${match[2]}/commits?per_page=1`)
    .then(r => r.ok ? r.json() : Promise.reject())
    .then(data => {
      const commit = data[0] && data[0].commit;
      if (!commit) return null;
      const info = { date: new Date(commit.committer.date).getTime(), title: commit.message.split('\n')[0] };
      try {
        localStorage.setItem(storageKey, `${Date.now()}|${info.date}|${info.title}`);
      } catch (e) { /* storage full/unavailable — fine, just skip caching */ }
      return info;
    })
    .catch(() => null);
  repoUpdatedCache[repoUrl] = promise;
  return promise;
}

function initRepoUpdated() {
  document.querySelectorAll('[data-repo]').forEach(el => {
    const label = el.id === 'siteUpdated' ? 'Last updated' : 'Updated';
    fetchRepoUpdated(el.dataset.repo).then(info => {
      if (!info) return;
      if (el.id === 'siteUpdated') {
        el.querySelector('.site-updated-date').textContent = `${label} ${timeAgo(info.date)}`;
        el.querySelector('.site-updated-title').textContent = info.title;
      } else {
        el.textContent = `${label} ${timeAgo(info.date)}`;
      }
    });
  });
}

// ── INIT ──
// This script sits at the end of the body, so everything above is already
// parsed — no need to wait for the window 'load' event (which would also
// wait on fonts/images and delay the PDF/project fetches for no reason).
// Scatter effect — disabled. Uncomment to bring it back:
// if (!window.matchMedia('(max-width: 860px)').matches) {
//   document.querySelectorAll('[data-scatter]').forEach(initScatter);
// }
initDarkMode();
initEmailCopy();
initSkillsTicker();
initTouchSafetyTaps();
initEasedScroll();
initCVFeedback();

// Show the last known project count immediately (instead of "—") while
// the fresh fetch is still in flight — loadProjects() overwrites both
// this and the cached value once it resolves.
const cachedProjectCount = localStorage.getItem('pc');
if (cachedProjectCount) document.getElementById('projectCount').textContent = cachedProjectCount;

loadProjects();
initPDF();
document.getElementById('year').textContent = new Date().getFullYear();

// Desktop-vs-mobile interaction (hover-preview vs tap-to-expand, scatter
// effect, etc.) is decided once at load — reload if the window is dragged
// across that breakpoint so it re-evaluates for the new size, same as a
// real visitor would get landing fresh at that width.
let breakpointReloadTimer = null;
window.matchMedia('(max-width: 860px)').addEventListener('change', () => {
  clearTimeout(breakpointReloadTimer);
  breakpointReloadTimer = setTimeout(() => location.reload(), 400);
});
