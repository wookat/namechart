(function () {
  try { navigator.sendBeacon('/api/beacon', JSON.stringify({ p: location.pathname })); } catch (e) { /* noop */ }

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
  svg.addEventListener('mousemove', show);
  svg.addEventListener('touchmove', function (e) { show(e); e.preventDefault(); }, { passive: false });
  svg.addEventListener('touchstart', show);
})();
