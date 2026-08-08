(function () {
  try { navigator.sendBeacon('/api/beacon', JSON.stringify({ p: location.pathname })); } catch (e) { /* noop */ }

  var inputs = document.querySelectorAll('input[name=q]');
  if (inputs.length) {
    var dl = document.createElement('datalist');
    dl.id = 'nc-suggest';
    document.body.appendChild(dl);
    var t;
    inputs.forEach(function (inp) {
      inp.setAttribute('list', 'nc-suggest');
      inp.addEventListener('input', function () {
        clearTimeout(t);
        var q = inp.value.trim();
        if (q.length < 2) return;
        t = setTimeout(function () {
          fetch('/api/search?q=' + encodeURIComponent(q)).then(function (r) { return r.json(); }).then(function (d) {
            dl.innerHTML = d.results.map(function (r) { return '<option value="' + r.name.replace(/[<>&"]/g, '') + '">'; }).join('');
          }).catch(function () {});
        }, 150);
      });
    });
  }

  function favs() { try { return JSON.parse(localStorage.getItem('nc-favs') || '[]'); } catch (e) { return []; } }
  function saveFavs(a) { try { localStorage.setItem('nc-favs', JSON.stringify(a)); } catch (e) {} }

  var share = document.getElementById('nc-share');
  if (share) share.addEventListener('click', function () {
    if (navigator.share) navigator.share({ title: document.title, url: location.href });
    else navigator.clipboard.writeText(location.href).then(function () { share.textContent = '\u2713 Link copied'; });
  });

  var fav = document.getElementById('nc-fav');
  if (fav) {
    var slug = fav.dataset.slug, name = fav.dataset.name;
    var render = function () {
      var saved = favs().some(function (f) { return f.slug === slug; });
      fav.textContent = saved ? '\u2665 On your shortlist' : '\u2661 Save to shortlist';
    };
    fav.addEventListener('click', function () {
      var a = favs();
      if (a.some(function (f) { return f.slug === slug; })) a = a.filter(function (f) { return f.slug !== slug; });
      else a.push({ slug: slug, name: name });
      saveFavs(a); render();
    });
    render();
  }

  var list = document.getElementById('nc-fav-list');
  if (list) {
    var a = favs();
    list.innerHTML = a.length
      ? a.map(function (f) {
          var s = String(f.slug).replace(/[^a-z'-]/g, ''), n = String(f.name).replace(/[<>&"]/g, '');
          return '<div class="relative rounded-xl bg-white border border-slate-200 p-4 hover:border-indigo-400"><a href="/name/' + s + '" class="font-semibold">' + n + '</a><button data-rm="' + s + '" aria-label="Remove" class="absolute top-2 right-2 text-slate-300 hover:text-rose-500 px-1">\u00d7</button></div>';
        }).join('')
      : '<div class="col-span-full text-center py-10"><svg width="88" height="88" viewBox="0 0 88 88" fill="none" aria-hidden="true" style="margin:0 auto"><circle cx="44" cy="44" r="40" fill="#fdf2f8"/><path d="M44 62c-9-6.5-18-13-18-22a10 10 0 0 1 18-6 10 10 0 0 1 18 6c0 9-9 15.5-18 22Z" fill="#fbcfe8" stroke="#db2777" stroke-width="2" stroke-linejoin="round"/><path d="M32 44l6-8 5 5 6-10 7 13" stroke="#4f46e5" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg><p class="mt-4 font-semibold text-slate-700">Your shortlist is empty</p><p class="mt-1 text-sm text-slate-600">Tap \u2661 on any name page to keep it here.</p><a href="/top/girls" class="inline-block mt-4 rounded-full bg-indigo-600 text-white font-semibold px-5 py-2.5 text-sm">Browse top names \u2192</a></div>';
    list.addEventListener('click', function (e) {
      var rm = e.target.getAttribute && e.target.getAttribute('data-rm');
      if (!rm) return;
      saveFavs(favs().filter(function (f) { return f.slug !== rm; }));
      e.target.parentNode.remove();
      if (!favs().length) list.innerHTML = '<p class="text-slate-500 col-span-full">Nothing saved yet.</p>';
    });
  }

  function seen(k) { try { return localStorage.getItem(k) === '1'; } catch (e) { return true; } }
  function markSeen(k) { try { localStorage.setItem(k, '1'); } catch (e) {} }

  var newDot = document.getElementById('nc-new-dot');
  if (newDot) {
    if (location.pathname === '/matcher') markSeen('nc-seen-matcher');
    else if (!seen('nc-seen-matcher')) {
      newDot.hidden = false;
      document.getElementById('nc-nav-matcher').addEventListener('click', function () { markSeen('nc-seen-matcher'); });
    }
  }

  var tip = document.getElementById('nc-tip');
  if (tip && !seen('nc-tip-fav')) {
    tip.hidden = false;
    document.getElementById('nc-tip-x').addEventListener('click', function () { markSeen('nc-tip-fav'); tip.hidden = true; });
    var favBtn = document.getElementById('nc-fav');
    if (favBtn) favBtn.addEventListener('click', function () { markSeen('nc-tip-fav'); tip.hidden = true; });
  }

  var shareBox = document.getElementById('nc-fav-share');
  if (shareBox) {
    var stored;
    try { stored = JSON.parse(localStorage.getItem('nc-share-link') || 'null'); } catch (e) { stored = null; }
    var renderShare = function () {
      if (!favs().length && !stored) { shareBox.innerHTML = ''; return; }
      if (stored) {
        shareBox.innerHTML = '<div class="rounded-xl bg-indigo-50 border border-indigo-200 p-4 text-sm"><p class="font-semibold text-slate-800">Your share link</p><p class="mt-1"><a class="text-indigo-700 underline break-all" href="' + stored.url + '">' + stored.url + '</a></p><div class="mt-3 flex flex-wrap gap-2"><button id="nc-share-copy" class="rounded-full bg-indigo-600 text-white px-4 py-1.5 font-semibold">Copy link</button><button id="nc-share-revoke" class="rounded-full bg-white border border-slate-300 px-4 py-1.5 text-slate-700">Delete link</button></div><p class="mt-2 text-xs text-slate-600">Anyone with the link can view this snapshot of your list. Deleting the link makes it stop working for everyone.</p></div>';
        document.getElementById('nc-share-copy').addEventListener('click', function () {
          navigator.clipboard.writeText(stored.url).then(function () { document.getElementById('nc-share-copy').textContent = '\u2713 Copied'; });
        });
        document.getElementById('nc-share-revoke').addEventListener('click', function () {
          fetch('/api/share/revoke', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: stored.id, token: stored.token }) })
            .then(function () { stored = null; localStorage.removeItem('nc-share-link'); renderShare(); }).catch(function () {});
        });
      } else {
        shareBox.innerHTML = '<button id="nc-share-make" class="rounded-full bg-indigo-600 text-white px-5 py-2.5 text-sm font-semibold">Share this list \u2192</button><p class="mt-2 text-xs text-slate-600">Creates a link with a snapshot of your current list \u2014 you can delete it anytime.</p>';
        document.getElementById('nc-share-make').addEventListener('click', function () {
          var btn = document.getElementById('nc-share-make');
          btn.disabled = true; btn.textContent = 'Creating\u2026';
          fetch('/api/share', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ slugs: favs().map(function (f) { return f.slug; }) }) })
            .then(function (r) { return r.json(); })
            .then(function (d) {
              if (d.url) { stored = d; localStorage.setItem('nc-share-link', JSON.stringify(d)); renderShare(); }
              else { btn.disabled = false; btn.textContent = d.error || 'Try again'; }
            })
            .catch(function () { btn.disabled = false; btn.textContent = 'Try again'; });
        });
      }
    };
    renderShare();
  }

  var el = document.getElementById('nc-readout');
  var hit = document.getElementById('nc-hit');
  if (!el || !hit) return;
  var d = JSON.parse(el.dataset.series);
  var svg = hit.ownerSVGElement;
  var cur = document.getElementById('nc-cursor');
  var box = svg.viewBox.baseVal, hx = +hit.getAttribute('x'), hw = +hit.getAttribute('width');
  var n = d.f.length;
  function show(ev) {
    var r = svg.getBoundingClientRect();
    var cx = ((ev.touches ? ev.touches[0].clientX : ev.clientX) - r.left) / r.width * box.width;
    var i = Math.round((cx - hx) / hw * (n - 1));
    if (i < 0) i = 0; if (i > n - 1) i = n - 1;
    var yr = d.s + i, g = d.f[i], b = d.m[i];
    cur.setAttribute('x1', hx + i / (n - 1) * hw);
    cur.setAttribute('x2', hx + i / (n - 1) * hw);
    cur.style.display = '';
    el.textContent = yr + ': ' + (g ? g.toLocaleString() + ' girls' : '') + (g && b ? ' \u00b7 ' : '') + (b ? b.toLocaleString() + ' boys' : '') + (!g && !b ? 'no recorded births' : '');
  }
  var defaultText = el.textContent;
  svg.addEventListener('mouseleave', function () { cur.style.display = 'none'; el.textContent = defaultText; });
  svg.addEventListener('mousemove', show);
  svg.addEventListener('touchmove', function (e) { show(e); e.preventDefault(); }, { passive: false });
  svg.addEventListener('touchstart', show);
})();
