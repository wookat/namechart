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
      : '<p class="text-slate-400 col-span-full">Nothing saved yet.</p>';
    list.addEventListener('click', function (e) {
      var rm = e.target.getAttribute && e.target.getAttribute('data-rm');
      if (!rm) return;
      saveFavs(favs().filter(function (f) { return f.slug !== rm; }));
      e.target.parentNode.remove();
      if (!favs().length) list.innerHTML = '<p class="text-slate-400 col-span-full">Nothing saved yet.</p>';
    });
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
