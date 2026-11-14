(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const cfg = window.FILMBIN_CONFIG || {};
  const apiBase = String(cfg.apiBase || '').replace(/\/$/, '');
  const configured = /^https?:\/\//.test(apiBase) && !apiBase.includes('YOUR-ACCOUNT');
  const imageUrl = id => apiBase + '/api/media/' + encodeURIComponent(id);
  const state = { flyers: [], events: [], category: 'all', event: 'all', query: '', sort: 'title' };
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

  // Cover-only tiles are shown exclusively in Special events, never in the main flyer wall.
  // Existing named event flyers work before the owner adds a custom cover.
  function eventCollections() {
    const groups = new Map();
    for (const f of state.flyers) {
      if (categoryOf(f) !== 'Special Event' || !String(f.event_name || '').trim()) continue;
      const name = f.event_name.trim(), key = name.toLocaleLowerCase();
      if (!groups.has(key)) groups.set(key, {name, flyers:[]});
      groups.get(key).flyers.push(f);
    }
    for (const metadata of state.events) {
      const group = groups.get(String(metadata.name||'').trim().toLocaleLowerCase());
      if(group) {group.name = metadata.name; group.description = metadata.description||''; group.cover_image_id = metadata.cover_image_id;}
    }
    return [...groups.values()].sort((a,b)=>a.name.localeCompare(b.name,undefined,{sensitivity:'base',numeric:true}));
  }
  function makeEventTile(event) {
    const button = make('button','event-tile'); button.type='button';
    button.setAttribute('aria-label',`Open ${event.name} event collection with ${event.flyers.length} flyers`);
    const artwork=make('div','event-cover');
    const img=new Image();
    img.loading='lazy'; img.decoding='async';
    img.src=imageUrl(event.cover_image_id || event.flyers[0].image_id);
    img.alt=event.cover_image_id ? `${event.name} special event cover artwork` : `${event.name} flyer artwork`;
    artwork.append(img);
    const details=make('div','event-tile-details');
    details.append(make('h3','event-title',event.name),make('span','event-count',`${event.flyers.length} ${event.flyers.length===1?'flyer':'flyers'}`));
    if(event.description) details.append(make('p','event-description',event.description));
    button.append(artwork,details);
    button.addEventListener('click',()=>{
      state.event=event.name;state.query='';$('search').value='';
      render();document.getElementById('gallery').scrollIntoView({block:'start'});
    });
    return button;
  }
  function render() {
    const eventIndex = state.category === 'Special Event' && state.event === 'all';
    $('event-grid').hidden = !eventIndex;
    $('flyer-grid').hidden = eventIndex;
    $('event-navigation').hidden = !(!eventIndex && state.category==='Special Event');
    if (eventIndex) {
      const term=state.query;
      const groups=eventCollections().filter(e=>!term||e.name.toLocaleLowerCase().includes(term)||e.flyers.some(f=>`${f.title} ${f.description||''}`.toLowerCase().includes(term)));
      $('event-grid').replaceChildren(...groups.map(makeEventTile));
      $('results-count').textContent=`${groups.length} ${groups.length===1?'event collection':'event collections'}`;
      $('empty-state').hidden=groups.length>0;
      if(!groups.length){$('empty-heading').textContent='No special event collections yet.';$('empty-description').textContent='Published Special Event flyers appear here under their event name.';}
      return;
    }
    if(state.category==='Special Event' && state.event!=='all') $('active-event-name').textContent=state.event;
    const filtered = state.flyers.filter(f =>
      (state.category === 'all' || categoryOf(f) === state.category) &&
      (state.event === 'all' || (categoryOf(f) === 'Special Event' && String(f.event_name||'').trim().toLocaleLowerCase() === state.event.toLocaleLowerCase())) &&
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
        : 'Once you publish your custom flyers through Owner Access, they will fill this gallery.';
    }
  }

  document.querySelectorAll('[data-filter]').forEach(button => button.addEventListener('click', () => {
    state.category = button.dataset.filter;
    state.event = 'all';
    document.querySelectorAll('[data-filter]').forEach(item => {
      const active = item === button;
      item.classList.toggle('active', active);
      item.setAttribute('aria-pressed', String(active));
    });
    render();
  }));
  $('events-back').addEventListener('click',()=>{state.event='all';render();});
  $('search').addEventListener('input', event => { state.query = event.target.value.trim().toLowerCase(); render(); });
  $('sort').addEventListener('change', event => { state.sort = event.target.value; render(); });

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
      state.events = Array.isArray(data.events) ? data.events : [];
      if (data.settings?.hero_title) $('hero-heading').textContent = data.settings.hero_title;
      if (data.settings?.hero_description) $('hero-description').textContent = data.settings.hero_description;
      if (data.settings?.footer_note) $('footer-note').textContent = data.settings.footer_note;
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
