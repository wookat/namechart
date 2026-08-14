# Worker 边缘缓存模式（NameChart 参照实现，供 8 线复用）

来源：`src/index.js` 边缘缓存中间件（约 20 行）。验收官第 8 轮定为全线推广模板。

## 原理

Cloudflare Workers **不会自动缓存 fetch handler 的返回值** —— 光设置
`Cache-Control: s-maxage` 响应头对 Worker 生成的 HTML 无效。必须显式用
`caches.default` 读写。命中时不执行路由逻辑、不查 D1。

## 参照实现（Hono 中间件）

```js
const CACHE_VER = 95; // 部署改动渲染/数据时手动 bump，即整体失效旧缓存

const etagOf = async buf => {
  const d = await crypto.subtle.digest('SHA-1', buf);
  return '"' + [...new Uint8Array(d)].map(b => b.toString(16).padStart(2, '0')).join('') + '"';
};
const notModified = res => {
  const h = new Headers();
  for (const k of ['ETag', 'Cache-Control']) if (res.headers.get(k)) h.set(k, res.headers.get(k));
  return new Response(null, { status: 304, headers: h });
};

app.use('*', async (c, next) => {
  if (c.req.method !== 'GET') return next();
  const url = new URL(c.req.url);
  // 不可缓存判定（见下）
  if (url.pathname.startsWith('/api/') || url.pathname === '/search' || url.search) return next();
  const inm = c.req.header('If-None-Match');
  const key = new Request(url.origin + '/__v' + CACHE_VER + url.pathname, { method: 'GET' });
  const hit = await caches.default.match(key);
  if (hit) {
    if (inm && inm === hit.headers.get('ETag')) return notModified(hit);
    return new Response(hit.body, hit);
  }
  await next();
  // 只缓存路由自己声明了 s-maxage 的 200 响应（opt-in，私有页天然被排除）
  if (c.res.status === 200 && (c.res.headers.get('Cache-Control') || '').includes('s-maxage')) {
    const buf = await c.res.arrayBuffer();
    const res = new Response(buf, c.res);
    res.headers.set('ETag', await etagOf(buf));
    c.executionCtx.waitUntil(caches.default.put(key, res.clone()));
    c.res = inm && inm === res.headers.get('ETag') ? notModified(res) : res;
  }
});
```

## Key 设计

- **`/__v<CACHE_VER><pathname>`**：路径前缀拼内容版本号。失效策略 = 部署时 bump
  `CACHE_VER`，旧键整体作废，无需逐条 purge。有写操作改内容的线（如用户提交数据）
  在写路径 bump 存于 KV/D1 的版本号即可，同一模式。
- key 是**合成 URL 的 Request 对象**，与真实路由不冲突。
- **key 不含 query 串** —— 因此带 query 的请求必须整体绕过（读和写都绕过），
  否则 `/page?x=1` 会读到裸 `/page` 的缓存（NameChart 第 1 轮实修过这个缺陷）。

## 不可缓存判定（按顺序全部绕过）

1. 非 GET；
2. `/api/*`（动态接口）；
3. 逐用户/逐查询变化的路由（NameChart 为 `/search`；各线自行列举）；
4. **任何带 query 串的请求**（key 只含 path，见上）；
5. 写侧只缓存 `status === 200` 且 Cache-Control 含 `s-maxage` 的响应 ——
   路由用 no-store（私有页、错误页、重定向）即天然不入缓存。

## ETag / 304

写入时以响应体 SHA-1 生成 ETag；命中且 `If-None-Match` 相同 → 304（省传输）。
304 响应只保留 ETag + Cache-Control 头。

## 验证方法

- `curl -sI <页面>` 二连发：第二次应见 `cf-cache-status: HIT`（zone 代理下）或 TTFB 显著下降；
- 带 `If-None-Match: <ETag>` 复测应得 304；
- `curl -sI "<页面>?x=1"` 不得命中裸路径缓存；
- 部署 bump CACHE_VER 后旧内容立即消失。

## 注意事项

- zone 边缘（Worker 之外的 CDN 层）看不到 CACHE_VER，所以 `s-maxage` 应设上限
  （NameChart 取 1h），限定部署后 stale HTML 的存活期。
- `caches.default` 是 per-colo 的：不同 PoP 各自暖缓存，属预期行为。
