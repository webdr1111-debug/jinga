/* 진가 데이터 풀기 (웹앱계획.md 3장) — 화면(app.js)과 검증(sheets/verify_web.py → Node)이 함께 쓴다.
 * search.js 는 크기를 줄이려고 열 순서·번호 사전·브랜드 공통 사진 주소로 줄여 두었다(sheets/export_web.py).
 * 여기서 화면이 쓰는 제품 모양으로 되돌린다:
 *   { b, s, n, ne, c, t, m, g, mt, sb, img, v, x?, rk?, p: { 나라: [현지가, 판매 상태 0·1·2, 공홈 주소, 옵션 가격 범위] } }
 * 공홈 주소·사진 여러 장·제품 정보는 브랜드 파일(brands/*.js)을 읽은 뒤 채운다(addBrand).
 */
// 데이터 파일(manifest.js 등)이 'LUX.rules = …' 처럼 채우는 그릇 — 페이지에서 가장 먼저 읽는다
if (typeof window !== "undefined") window.LUX = window.LUX || {};
(function (root) {
  "use strict";
  const unmid = (m, pre, suf) => !m ? "" : m[0] === "=" ? m.slice(1) : pre + m + suf;
  // 변형 묶음 키: 끝의 '(소재)'를 뺀 이름 — 제품 화면 ② (빌더의 vkey 와 같은 규칙)
  const vkey = (b, n) => b + "|" + String(n || "").replace(/\s*\([^)]*\)\s*$/, "").trim();

  function decodeSearch(S) {
    const F = S.fields, at = k => F.indexOf(k), d = S.dict, cols = S.cols;
    const I = Object.fromEntries(F.map(k => [k, at(k)]));
    return S.rows.map(r => {
      const b = d.b[r[I.b]], im = S.img[b] || ["", ""], pr = {}, opt = r[I.opt] || {};
      const vals = r[I.prices], tiers = r[I.tiers];
      cols.forEach((cc, k) => { if (vals[k] || opt[k]) pr[cc] = [vals[k] || 0, +tiers[k], "", opt[k] || null]; });
      const n = r[I.n], p = { b, s: r[I.s], n, ne: r[I.ne] || n, c: d.c[r[I.c]], t: d.t[r[I.t]], m: d.m[r[I.m]], g: d.g[r[I.g]],
        mt: d.mt[r[I.mt]], sb: d.sb[r[I.sb]], img: unmid(r[I.img], im[0], im[1]), v: vkey(b, n), p: pr };
      const ex = r[I.extra];
      if (ex) { if (ex.x) p.x = ex.x; if (ex.rk) p.rk = ex.rk; if (ex.pc) p.pc = ex.pc; if (ex.ck) p.ck = ex.ck; if (ex.md) p.md = ex.md; if (ex.nc) p.nc = ex.nc; if (ex.cg) p.cg = ex.cg; }  // md 모델 번호 · nc 합친 색상 수 · cg 관세 품목  // ck: 가격 확인 필요 (엑셀 가격DB와 같은 판정)  // pc: 원래 통화로 적힌 칸 {나라: [값, 통화]}
      return p;
    });
  }
  // 브랜드 파일 내용을 제품에 채움: 나라별 공홈 주소(p[나라][2]), 사진 여러 장(imgs), 제품 정보(x)
  function applyBrand(products, data) {
    const bySku = new Map(products.map(p => [p.s, p]));
    for (const [s, u, imgs, x] of data.items) {
      const p = bySku.get(s);
      if (!p) continue;
      for (const [cc, m] of Object.entries(u)) {
        const t = data.url[cc] || ["", ""], url = unmid(m, t[0], t[1]);
        if (!/^https:\/\//.test(url)) continue;
        if (!p.p[cc]) p.p[cc] = [0, 0, "", null];  // 가격은 없고 공홈 페이지만 있는 나라 (제품 화면에 '공홈 ↗'만)
        p.p[cc][2] = url;
      }
      p.imgs = imgs.map(m => unmid(m, data.img[0], data.img[1])).filter(Boolean);
      p.x = { ...(p.x || {}), ...x };
      p.detail = true;
    }
  }
  const api = { decodeSearch, applyBrand, vkey };
  root.LuxData = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
