(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const cfg = window.FILMBIN_CONFIG || {};
  const apiBase = String(cfg.apiBase || '').replace(/\/$/, '');
  const configured = /^https?:\/\//.test(apiBase) && !apiBase.includes('YOUR-ACCOUNT');
  const imageUrl = id => apiBase + '/api/media/' + encodeURIComponent(id);
  const state = { flyers: [], category: 'all', event: 'all', query: '', sort: 'title' };
  const categories = {
    'Movie Flyer': 'Movie flyer',
    'Marathon': 'Marathon flyer',
    'Special Event': 'Special event',
    'Other': 'Other artwork'
  };
  const categoryOf = f => Object.hasOwn(categories, f.category) ? f.category : 'Other';
  const labelOf = f => categoryOf(f) === 'Special Event' && String(f.event_name || '').trim() ? `Special event · ${f.event_name.trim()}` : categories[categoryOf(f)];
  const publishedTime = f => Date.parse(f.published_at || f.created_at || '') || 0;
  const make = (tag, className, contents) => {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (contents !== undefined) element.textContent = contents;
    return element;
  };
  const modal = $('flyer-dialog');
  $('year').textContent = new Date().getFullYear();
  const ownerUrl = cfg.ownerUrl || (configured ? apiBase + '/' : '');
  const owner = $('owner-link');
  if (/^https?:\/\//.test(ownerUrl)) {
    owner.href = ownerUrl; owner.target = '_blank'; owner.rel = 'noopener noreferrer';
  } // Until Cloudflare is connected, the link opens a clear local setup notice.

  function openFlyer(flyer) {
    $('dialog-img').src = imageUrl(flyer.image_id);
    $('dialog-img').alt = `Original custom flyer: ${flyer.title}`;
    $('dialog-title').textContent = flyer.title;
    $('dialog-category').textContent = labelOf(flyer);
    $('dialog-description').textContent = flyer.description || '';
    $('dialog-description').hidden = !flyer.description;
    $('dialog-original').href = imageUrl(flyer.image_id);
    modal.showModal();
  }
  $('dialog-close').addEventListener('click', () => modal.close());
  modal.addEventListener('click', event => { if (event.target === modal) modal.close(); });
  modal.addEventListener('close', () => $('dialog-img').removeAttribute('src'));

  function makePoster(flyer) {
    const article = make('article', 'poster');
    const button = make('button', 'poster-open');
    button.type = 'button';
    button.setAttribute('aria-label', `View ${flyer.title} in full`);
    const frame = make('div', 'poster-frame');
    const img = new Image();
    img.src = imageUrl(flyer.image_id);
    img.alt = `Custom movie flyer artwork: ${flyer.title}`;
    img.loading = 'lazy';
    img.decoding = 'async';
    frame.append(img);
    const info = make('div', 'poster-info');
    const mainInfo = make('div', 'poster-info-text');
    mainInfo.append(make('h3', 'poster-title', flyer.title), make('p', 'poster-type', labelOf(flyer)));
    info.append(mainInfo);
    if (flyer.is_featured === 1 || flyer.is_featured === true) info.append(make('p', 'poster-featured', 'FEATURED'));
    button.append(frame, info);
    button.addEventListener('click', () => openFlyer(flyer));
    article.append(button);
    return article;
  }

  function render() {
    const filtered = state.flyers.filter(f =>
      (state.category === 'all' || categoryOf(f) === state.category) &&
      (state.event === 'all' || (categoryOf(f) === 'Special Event' && f.event_name === state.event)) &&
      (!state.query || `${f.title} ${f.description || ''} ${labelOf(f)}`.toLowerCase().includes(state.query))
    );
    filtered.sort((a, b) => {
      if (state.sort === 'title') return a.title.localeCompare(b.title, undefined, { sensitivity: 'base', numeric: true }) || a.id.localeCompare(b.id);
      if (state.sort === 'oldest') return publishedTime(a) - publishedTime(b);
      const aFeatured = a.is_featured === 1 || a.is_featured === true ? 1 : 0;
      const bFeatured = b.is_featured === 1 || b.is_featured === true ? 1 : 0;
      return bFeatured - aFeatured || publishedTime(b) - publishedTime(a);
    });
    $('flyer-grid').replaceChildren(...filtered.map(makePoster));
    $('results-count').textContent = `${filtered.length} ${filtered.length === 1 ? 'flyer' : 'flyers'}`;
    const empty = filtered.length === 0;
    $('empty-state').hidden = !empty;
    if (empty) {
      const limited = state.category !== 'all' || state.query;
      $('empty-heading').textContent = limited ? 'No matching flyers.' : 'Your flyer collection will appear here.';
      $('empty-description').textContent = limited
        ? 'Try a different category or search term.'
        : 'Once you publish your custom flyers through Owner Access, they will fill this gallery. No demo posters are presented as your artwork.';
    }
  }

  document.querySelectorAll('[data-filter]').forEach(button => button.addEventListener('click', () => {
    state.category = button.dataset.filter;
    state.event = 'all'; $('event-filter').value = 'all';
    $('event-filter-wrap').hidden = state.category !== 'Special Event';
    document.querySelectorAll('[data-filter]').forEach(item => {
      const active = item === button;
      item.classList.toggle('active', active);
      item.setAttribute('aria-pressed', String(active));
    });
    render();
  }));
  $('event-filter').addEventListener('change', event => { state.event = event.target.value; render(); });
  function updateEvents() {
    const select = $('event-filter');
    const events = [...new Set(state.flyers.filter(f => categoryOf(f) === 'Special Event').map(f => String(f.event_name || '').trim()).filter(Boolean))].sort((a,b) => a.localeCompare(b));
    select.replaceChildren(new Option('All events', 'all'), ...events.map(name => new Option(name, name)));
    select.value = 'all'; state.event = 'all';
  }
  $('search').addEventListener('input', event => { state.query = event.target.value.trim().toLowerCase(); render(); });
  $('sort').addEventListener('change', event => { state.sort = event.target.value; render(); });

  function renderSections(sections) {
    const container = $('site-sections');
    const published = Array.isArray(sections) ? sections.filter(s => s && typeof s.title === 'string' && s.title.trim()) : [];
    container.hidden = published.length === 0;
    container.replaceChildren(...published.map(section => {
      const block = make('section', 'editorial-section');
      block.append(make('h2', '', section.title), make('p', '', section.body || ''));
      return block;
    }));
  }

  async function load() {
    if (!configured) {
      state.flyers = [];
      render();
      $('empty-heading').textContent = 'Your flyers will be shown here.';
      $('empty-description').textContent = 'This local preview has not been connected to the Cloudflare gallery API. Once connected, your published movie flyers will appear in this artwork wall.';
      return;
    }
    try {
      const response = await fetch(apiBase + '/api/public/bootstrap', { credentials: 'omit' });
      if (!response.ok) throw new Error(`Gallery API returned ${response.status}`);
      const data = await response.json();
      state.flyers = (Array.isArray(data.flyers) ? data.flyers : []).filter(f => f && f.image_id && typeof f.title === 'string');
      updateEvents();
      if (data.settings?.hero_title) $('hero-heading').textContent = data.settings.hero_title;
      if (data.settings?.hero_description) $('hero-description').textContent = data.settings.hero_description;
      if (data.settings?.footer_note) $('footer-note').textContent = data.settings.footer_note;
      renderSections(data.sections);
      render();
    } catch (error) {
      console.error('Could not load FilmBin gallery:', error);
      state.flyers = [];
      render();
      $('empty-heading').textContent = 'The flyer gallery could not load.';
      $('empty-description').textContent = 'The gallery service is temporarily unavailable. Please try again later.';
    }
  }
  load();
})();
