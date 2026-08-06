import { ImageResponse } from 'workers-og';
import { fmt, expandSeries, genderOf, END_YEAR } from './html.js';

// 1200x630 share card with the name, headline stats and a sparkline of the series.
export async function ogImage(c, r) {
  const fontRes = await c.env.ASSETS.fetch('https://assets.local/fonts/inter-bold.woff');
  const font = await fontRes.arrayBuffer();

  const { f, m } = expandSeries(JSON.parse(r.series));
  const tot = f.map((v, i) => v + m[i]);
  // Downsample to bars so the trend renders with plain flexbox (Satori-safe).
  const BARS = 73;
  const per = Math.ceil(tot.length / BARS);
  const bars = [];
  for (let i = 0; i < tot.length; i += per) {
    bars.push(Math.max(...tot.slice(i, i + per)));
  }
  const max = Math.max(1, ...bars);
  const g = genderOf(r);
  const accent = g === 'girl' ? '#ec4899' : g === 'boy' ? '#3b82f6' : '#a855f7';
  const primaryRank = g === 'boy'
    ? (r.latest_rank_m && r.latest_rank_m <= 1000 && `#${r.latest_rank_m} boy name ${END_YEAR}`)
    : (r.latest_rank_f && r.latest_rank_f <= 1000 && `#${r.latest_rank_f} girl name ${END_YEAR}`);
  const rank = primaryRank || '';

  const html = `
  <div style="display:flex;flex-direction:column;width:1200px;height:630px;background:linear-gradient(135deg,#312e81,#4f46e5 55%,#7c3aed);color:#fff;font-family:Inter;padding:60px 80px;">
    <div style="display:flex;align-items:baseline;justify-content:space-between;">
      <div style="display:flex;font-size:96px;font-weight:700;">${r.name}</div>
      <div style="display:flex;font-size:30px;color:#c7d2fe;">namechart.zalize.com</div>
    </div>
    <div style="display:flex;font-size:32px;color:#e0e7ff;margin-top:8px;">${fmt(r.total)} babies since ${r.first_year} · peaked ${r.peak_year}${rank ? ` · ${rank}` : ''}</div>
    <div style="display:flex;align-items:flex-end;height:200px;width:100%;margin-top:50px;">
      ${bars.map(v => `<div style="display:flex;width:10px;margin-right:4px;height:${Math.max(4, Math.round((v / max) * 200))}px;background:${accent};"></div>`).join('')}
    </div>
    <div style="display:flex;font-size:26px;color:#c7d2fe;margin-top:36px;">1880–${END_YEAR} · 146 years of U.S. baby name data — free, no ads</div>
  </div>`;

  return new ImageResponse(html, {
    width: 1200,
    height: 630,
    fonts: [{ name: 'Inter', data: font, weight: 700 }],
  });
}

// 1200x630 share card for compare pages: both names with overlaid bar trends.
export async function ogCompare(c, a, b) {
  const fontRes = await c.env.ASSETS.fetch('https://assets.local/fonts/inter-bold.woff');
  const font = await fontRes.arrayBuffer();

  const BARS = 73;
  const tot = r => {
    const { f, m } = expandSeries(JSON.parse(r.series));
    return f.map((v, i) => v + m[i]);
  };
  const ds = arr => {
    const per = Math.ceil(arr.length / BARS);
    const out = [];
    for (let i = 0; i < arr.length; i += per) out.push(Math.max(...arr.slice(i, i + per)));
    return out;
  };
  const ba = ds(tot(a)), bb = ds(tot(b));
  const max = Math.max(1, ...ba, ...bb);
  const h = v => Math.max(3, Math.round((v / max) * 170));
  const row = (bars, color) => `<div style="display:flex;align-items:flex-end;height:170px;width:100%;">${bars.map(v => `<div style="display:flex;width:10px;margin-right:4px;height:${h(v)}px;background:${color};"></div>`).join('')}</div>`;

  const html = `
  <div style="display:flex;flex-direction:column;width:1200px;height:630px;background:linear-gradient(135deg,#312e81,#4f46e5 55%,#7c3aed);color:#fff;font-family:Inter;padding:56px 80px;">
    <div style="display:flex;align-items:baseline;justify-content:space-between;">
      <div style="display:flex;font-size:64px;font-weight:700;">${a.name} <span style="color:#a5b4fc;margin:0 18px;">vs</span> ${b.name}</div>
      <div style="display:flex;font-size:30px;color:#c7d2fe;">namechart.zalize.com</div>
    </div>
    <div style="display:flex;align-items:center;font-size:28px;color:#e0e7ff;margin-top:6px;"><div style="display:flex;width:22px;height:22px;background:#818cf8;border-radius:4px;margin-right:12px;"></div>${a.name}: ${fmt(a.total)} babies<div style="display:flex;width:22px;height:22px;background:#fbbf24;border-radius:4px;margin:0 12px 0 36px;"></div>${b.name}: ${fmt(b.total)} babies</div>
    <div style="display:flex;flex-direction:column;margin-top:34px;">
      ${row(ba, '#818cf8')}
      <div style="display:flex;height:12px;"></div>
      ${row(bb, '#fbbf24')}
    </div>
    <div style="display:flex;font-size:24px;color:#c7d2fe;margin-top:auto;">1880–${END_YEAR} · 146 years of U.S. baby name data — free, no ads</div>
  </div>`;

  return new ImageResponse(html, {
    width: 1200,
    height: 630,
    fonts: [{ name: 'Inter', data: font, weight: 700 }],
  });
}

// 1200x630 share card for list-style pages: big title + name chips.
export async function ogList(c, title, names) {
  const fontRes = await c.env.ASSETS.fetch('https://assets.local/fonts/inter-bold.woff');
  const font = await fontRes.arrayBuffer();

  const chips = names.slice(0, 12).map(n =>
    `<div style="display:flex;font-size:34px;background:rgba(255,255,255,0.14);border-radius:9999px;padding:10px 28px;margin:0 14px 18px 0;">${n}</div>`).join('');
  const html = `
  <div style="display:flex;flex-direction:column;width:1200px;height:630px;background:linear-gradient(135deg,#312e81,#4f46e5 55%,#7c3aed);color:#fff;font-family:Inter;padding:60px 80px;">
    <div style="display:flex;align-items:baseline;justify-content:space-between;">
      <div style="display:flex;font-size:64px;font-weight:700;">${title}</div>
      <div style="display:flex;font-size:30px;color:#c7d2fe;">namechart.zalize.com</div>
    </div>
    <div style="display:flex;flex-wrap:wrap;margin-top:44px;">${chips}</div>
    <div style="display:flex;font-size:26px;color:#c7d2fe;margin-top:auto;">146 years of U.S. baby name data — free, no ads</div>
  </div>`;

  return new ImageResponse(html, {
    width: 1200,
    height: 630,
    fonts: [{ name: 'Inter', data: font, weight: 700 }],
  });
}
