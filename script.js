const PDF_FILE = 'Display_Portfolio.pdf';

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

  const alreadyCached = !!pageCache[num];

  renderToOffscreen(num).then(off => {
    paintToCanvas(canvasBack, ctxBack, off);
    canvasBack.classList.add('show');
    canvasFront.classList.add('hide');

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

function tagsHtml(tags) {
  return (tags || []).map(t => `<span class="tag ${t.style}">${t.label}</span>`).join('');
}
const FILE_ICON = `<svg class="file-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M8 3h8l4 4v10a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z"/><path d="M8 3v4a2 2 0 0 0 2 2h4"/><path d="M4 8v11a2 2 0 0 0 2 2h9"/></svg>`;
const WEB_ICON  = `<svg class="file-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10z"/></svg>`;
const GAME_ICON = `<svg class="file-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M6 9h12a4 4 0 0 1 4 4l1 5a2.5 2.5 0 0 1-4.5 1.8L16 17H8l-2.5 2.8A2.5 2.5 0 0 1 1 18l1-5a4 4 0 0 1 4-4Z"/><line x1="7.5" y1="12.5" x2="7.5" y2="15.5"/><line x1="6" y1="14" x2="9" y2="14"/><circle cx="16.5" cy="12.5" r="0.9" fill="currentColor" stroke="none"/><circle cx="18.5" cy="14.5" r="0.9" fill="currentColor" stroke="none"/></svg>`;

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

const SIMULATOR_PAGES = new Set();

const projectOverlay = document.getElementById('projectOverlay');
const projectOverlayHost = document.getElementById('projectOverlayHost');
const projectOverlayShadow = projectOverlayHost.attachShadow({ mode: 'open' });

const overlayContentCache = new Map();
const overlayModuleCache = new Map();
let overlayCleanup = null;
let overlayCloseTimer = null;

async function fetchOverlayContent(url) {
  if (overlayContentCache.has(url)) return overlayContentCache.get(url);
  const styleUrl = new URL(`${url}style.css`, window.location.href);
  const [html, css] = await Promise.all([
    fetch(`${url}index.html`, { cache: 'reload' }).then(r => r.text()),
    fetch(styleUrl, { cache: 'reload' }).then(r => r.text())
  ]);
  const doc = new DOMParser().parseFromString(html, 'text/html');
  doc.querySelectorAll('script').forEach(s => s.remove());
  const content = {
    bodyHTML: doc.body.innerHTML,
    css: css
      .replace(/:root/g, ':host')
      .replace(/html\.dark/g, ':host(.dark)')
      .replace(/url\((['"]?)(.*?)\1\)/g, (m, quote, path) => `url('${new URL(path, styleUrl)}')`)
  };
  overlayContentCache.set(url, content);
  return content;
}

async function openProjectOverlay(url) {
  clearTimeout(overlayCloseTimer);
  projectOverlay.classList.add('open');
  projectOverlay.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';

  try {
    const { bodyHTML, css } = await fetchOverlayContent(url);

    projectOverlayShadow.innerHTML = '';
    const styleEl = document.createElement('style');
    styleEl.textContent = css;
    projectOverlayShadow.appendChild(styleEl);
    const wrapper = document.createElement('div');
    wrapper.innerHTML = bodyHTML;
    projectOverlayShadow.append(...wrapper.childNodes);
    projectOverlayHost.classList.toggle('dark', document.documentElement.classList.contains('dark'));

    let modulePromise = overlayModuleCache.get(url);
    if (!modulePromise) {
      const scriptUrl = new URL(`${url}script.js`, window.location.href).href;
      modulePromise = fetch(scriptUrl, { cache: 'reload' })
        .then(r => r.text())
        .then(code => import(URL.createObjectURL(new Blob([code], { type: 'text/javascript' }))));
      overlayModuleCache.set(url, modulePromise);
    }
    const module = await modulePromise;
    if (typeof module.init !== 'function') throw new Error(`${url}script.js has no init() export`);
    overlayCleanup = module.init(projectOverlayShadow, closeProjectOverlay);
  } catch (err) {
    console.error(err);
    closeProjectOverlay();
    window.open(url, '_blank');
  }
}

function closeProjectOverlay() {
  projectOverlay.classList.remove('open');
  projectOverlay.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
  if (overlayCleanup) {
    overlayCleanup();
    overlayCleanup = null;
  }
  clearTimeout(overlayCloseTimer);
  overlayCloseTimer = setTimeout(() => {
    projectOverlayShadow.innerHTML = '';
  }, 300);
}

projectOverlay.addEventListener('click', e => {
  if (e.target === projectOverlay) closeProjectOverlay();
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && projectOverlay.classList.contains('open')) closeProjectOverlay();
});

document.addEventListener('click', e => {
  const link = e.target.closest('a[href]');
  if (link && SIMULATOR_PAGES.has(link.getAttribute('href'))) {
    e.preventDefault();
    openProjectOverlay(link.getAttribute('href'));
  }
});

const imageOverlay = document.getElementById('imageOverlay');
const imageOverlayImg = document.getElementById('imageOverlayImg');
const imageOverlayClose = document.getElementById('imageOverlayClose');
const imageOverlayTitle = document.getElementById('imageOverlayTitle');
const imageOverlayDesc = document.getElementById('imageOverlayDesc');

function openImageOverlay(src, title, desc) {
  imageOverlayImg.src = src;
  imageOverlayImg.alt = title || '';
  imageOverlayTitle.textContent = title || '';
  imageOverlayDesc.textContent = desc || '';
  imageOverlayDesc.hidden = !desc;
  imageOverlay.classList.add('open');
  imageOverlay.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
}

function closeImageOverlay() {
  imageOverlay.classList.remove('open');
  imageOverlay.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
}

document.addEventListener('click', e => {
  if (e.target.closest('.card-img-badges')) return;
  const trigger = e.target.closest('.card-img[data-image]');
  if (trigger) {
    openImageOverlay(trigger.dataset.image, trigger.closest('.card')?.getAttribute('aria-label'), trigger.dataset.desc);
    return;
  }
  if (e.target === imageOverlay || e.target === imageOverlayClose || e.target.closest('#imageOverlayClose')) {
    closeImageOverlay();
  }
});
document.addEventListener('keydown', e => {
  if (e.target.closest('.card-img-badges')) return;
  const trigger = e.target.closest('.card-img[data-image]');
  if (trigger && (e.key === 'Enter' || e.key === ' ')) {
    e.preventDefault();
    openImageOverlay(trigger.dataset.image, trigger.closest('.card')?.getAttribute('aria-label'), trigger.dataset.desc);
    return;
  }
  if (e.key === 'Escape' && imageOverlay.classList.contains('open')) closeImageOverlay();
});

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
        `<a href="${p.simulator}" target="_blank" class="card-btn sim-btn">Simulator</a>`
      );
    }
    else if (p.repo) {
      buttons.push(
        `<a href="${p.repo}" target="_blank" class="card-btn">GitHub</a>`
      );
    }

    if (p.file) {
      buttons.push(
        `<a href="${p.file}" target="_blank" class="card-btn primary" data-prefetch="${p.file}">Read</a>`
      );
    }

    if (p.website) {
      const websiteExternal = isExternal(p.website);
      const websiteTarget = websiteExternal ? ' target="_blank"' : '';
      const websiteLabel = game ? (websiteExternal ? 'Itch.io' : 'Play') : 'Visit';
      buttons.push(
        `<a href="${p.website}"${websiteTarget} class="card-btn primary">${websiteLabel}</a>`
      );
    }

    const actions = buttons.join('');

    const badges = [];
    if (p.simulator) badges.push(`<a href="${p.simulator}" target="_blank" class="sim-badge"><span class="sim-badge-face">Try it live</span></a>`);
    if (game && p.website && !isExternal(p.website)) badges.push(`<a href="${p.website}" class="sim-badge"><span class="sim-badge-face">Play now</span></a>`);

    container.insertAdjacentHTML('beforeend', `
      <div class="embla__slide">
        <div class="card" aria-label="${p.title}">
          <div class="card-img"${p.image ? ` data-image="${p.image}" data-desc="${p.desc || ''}" role="button" tabindex="0" aria-label="Expand image"` : ''}>
            ${badges.length ? `<div class="card-img-badges">${badges.join('')}</div>` : ''}
            <div class="card-img-inner" style="${imgStyle}"></div>
            ${p.image ? '<span class="card-img-hint">Expand image</span>' : ''}
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
}

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
        `<a href="${p.simulator}" target="_blank" class="card-btn sim-btn">Simulator</a>`
      );
      }
      else if (p.repo) {
        buttons.push(
          `<a href="${p.repo}" target="_blank" class="card-btn">GitHub</a>`
        );
      }

      if (p.file) {
        buttons.push(
          `<a href="${p.file}" target="_blank" class="file-btn dl" data-prefetch="${p.file}">Read</a>`
        );
      }

      if (p.website) {
        const websiteExternal = isExternal(p.website);
        const websiteTarget = websiteExternal ? ' target="_blank"' : '';
        const websiteLabel = game ? (websiteExternal ? 'Itch.io' : 'Play') : 'Visit';
        buttons.push(
          `<a href="${p.website}"${websiteTarget} class="file-btn dl">${websiteLabel}</a>`
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

  function activateRow(row) {
    if (row.dataset.image) {
      openImageOverlay(row.dataset.image, row.dataset.title, row.dataset.desc);
      return;
    }
    const url = row.dataset.website || row.dataset.file;
    if (!url) return;
    if (SIMULATOR_PAGES.has(url)) openProjectOverlay(url);
    else if (isExternal(url)) window.open(url, '_blank');
    else window.location.href = url;
  }
  container.querySelectorAll('.file-row').forEach(row => {
    row.addEventListener('click', e => {
      if (e.target.closest('.file-actions')) return;
      activateRow(row);
    });
    row.addEventListener('keydown', e => {
      if ((e.key === 'Enter' || e.key === ' ') && !e.target.closest('.file-actions')) {
        e.preventDefault();
        activateRow(row);
      }
    });
  });
  initFilePreview();
}

function initFilePreview() {

  if (window.matchMedia('(max-width: 860px)').matches) return;
  const card  = document.getElementById('filePreviewCard');
  const img   = document.getElementById('filePreviewImg');
  const title = document.getElementById('filePreviewTitle');
  const desc  = document.getElementById('filePreviewDesc');
  const zone  = document.getElementById('filesInner');

  let warm = false;
  let warmupTimer = null;
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

function initDarkMode() {
  document.getElementById('logoBtn').addEventListener('click', () => {
    const isDark = document.documentElement.classList.toggle('dark');

    if (isDark) localStorage.setItem('t', '');
    else localStorage.removeItem('t');
    document.getElementById('projectOverlayHost')?.classList.toggle('dark', isDark);
  });
}

function initCVFeedback() {
  const link = document.querySelector('.cv-link');
  if (!link) return;
  const colors = ['#4C47E2', '#FF7A59', '#2DD4BF', '#FBBF24', '#F472B6'];

  link.addEventListener('click', () => {

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const rect = link.getBoundingClientRect();

    const originX = -160 + window.scrollX;
    const originY = rect.top + rect.height / 2 + 40 + window.scrollY;
    const count = 50;
    const gravity = 0.0028;
    const maxLifetime = 6000;

    const pieces = [];
    const fragment = document.createDocumentFragment();
    for (let i = 0; i < count; i++) {
      const angle = -0.65 + (Math.random() - 0.7) * 0.5;
      const speed = 1.0 + Math.random() * 1.1;
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
        rotSpeed: (Math.random() < 0.5 ? -1 : 1) * (0.25 + Math.random() * 0.4),
        born: performance.now(),
      });
    }
    document.body.appendChild(fragment);

    let lastFrame = performance.now();
    function frame(now) {
      const dt = Math.min(now - lastFrame, 40);
      lastFrame = now;

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

      window.scrollTo({ top: startY + diff * easeInOutCubic(progress), behavior: 'instant' });
      if (progress < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  });
}

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

const WEB3FORMS_ACCESS_KEY = '4a47d7f7-92b0-4f0e-ace1-ba6eaa1acb15';

function initFeedbackForm() {
  const form = document.getElementById('feedbackForm');
  if (!form) return;
  const messageInput = document.getElementById('feedbackMessage');
  const emailInput = document.getElementById('feedbackEmail');
  const submitBtn = document.getElementById('feedbackSubmit');
  const statusEl = document.getElementById('feedbackStatus');
  let statusTimer = null;

  function setStatus(text, kind) {
    clearTimeout(statusTimer);
    statusEl.textContent = text;
    statusEl.className = 'feedback-status' + (kind ? ' ' + kind : '');
    if (kind) statusTimer = setTimeout(() => setStatus(''), 5000);
  }

  form.addEventListener('submit', async e => {
    e.preventDefault();
    if (form.botcheck.checked) return;

    const message = messageInput.value.trim();
    if (!message) { messageInput.focus(); return; }

    setStatus('');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Sending…';

    const email = emailInput.value.trim();
    const payload = {
      access_key: WEB3FORMS_ACCESS_KEY,
      subject: email ? `New portfolio message from ${email}` : 'New portfolio message (anonymous)',
      from_name: email || 'Anonymous visitor',
      Message: message,
    };
    if (email) payload.email = email;

    try {
      const res = await fetch('https://api.web3forms.com/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || 'Submission failed');

      setStatus('Thanks, sent!', 'success');
      form.reset();
    } catch (err) {
      setStatus('Something went wrong. Try again, or email me directly.', 'error');
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Send';
    }
  });
}

function initTouchSafetyTaps() {
  if (!window.matchMedia('(max-width: 860px)').matches) return;
  const SELECTOR = '.file-row, .site-updated-date, .site-updated-title, .social-icons a, #logoBtn';
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
    if (armed === el) { disarm(); return; }
    e.preventDefault();
    e.stopPropagation();
    disarm();
    armed = el;
    el.classList.add('tap-armed');
    armTimer = setTimeout(disarm, 3000);
  }, true);
}

function initSkillsTicker() {
  const track = document.querySelector('.skills-ticker-track');
  const group = track.querySelector('.skills-ticker-group');

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  let groupWidth = group.offsetWidth;
  let autoSpeed = reducedMotion ? 0 : groupWidth / 45000;
  window.addEventListener('resize', () => {
    groupWidth = group.offsetWidth;
    autoSpeed = reducedMotion ? 0 : groupWidth / 45000;
  });

  let pos = 0;
  let direction = -1;
  let velocity = -autoSpeed;

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
    catch (e) {}
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

  const HARD_THROW = 0.4;

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

async function loadProjects() {
  try {
    const res = await fetch('projects.json');
    if (!res.ok) throw new Error();
    const projects = await res.json();
    projects.forEach(p => { if (p.simulator) SIMULATOR_PAGES.add(p.simulator); });
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
const REPO_CACHE_TTL = 15 * 60 * 1000;

async function fetchRepoUpdated(repoUrl) {
  if (repoUpdatedCache[repoUrl]) return repoUpdatedCache[repoUrl];
  const match = repoUrl.match(/github\.com\/([^/]+)\/([^/]+)/);
  if (!match) return null;

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
  } catch (e) {}

  const promise = fetch(`https://api.github.com/repos/${match[1]}/${match[2]}/commits?per_page=1`)
    .then(r => r.ok ? r.json() : Promise.reject())
    .then(data => {
      const commit = data[0] && data[0].commit;
      if (!commit) return null;
      const info = { date: new Date(commit.committer.date).getTime(), title: commit.message.split('\n')[0] };
      try {
        localStorage.setItem(storageKey, `${Date.now()}|${info.date}|${info.title}`);
      } catch (e) {}
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

initDarkMode();
initEmailCopy();
initSkillsTicker();
initTouchSafetyTaps();
initEasedScroll();
initCVFeedback();
initFeedbackForm();

const cachedProjectCount = localStorage.getItem('pc');
if (cachedProjectCount) document.getElementById('projectCount').textContent = cachedProjectCount;

loadProjects();
initPDF();
document.getElementById('year').textContent = new Date().getFullYear();

let breakpointReloadTimer = null;
window.matchMedia('(max-width: 860px)').addEventListener('change', () => {
  clearTimeout(breakpointReloadTimer);
  breakpointReloadTimer = setTimeout(() => location.reload(), 400);
});
