/* 럭스캐너(LUXCANNER, 옛 이름 진가) — 화면 코드 (웹앱계획.md 5장 화면별 명세, 10장 1단계). 주얼리·가방 페이지가 함께 쓴다(2.2절).
 * 데이터: 페이지 폴더의 data/manifest.js · rules.js · search.js · history.js (sheets/export_web.py 가 만듦),
 *         제품 화면을 열 때 data/brands/{브랜드}.js (나라별 공홈 주소·사진·제품 정보)
 * 계산: common/calc.js (7장, 엑셀과 같은 결과 — sheets/verify_web.py 로 확인)
 * 서버 없이 파일로 열어 동작한다(G1). 저장은 이 기기 브라우저(localStorage, lux.{jewelry|bag}.*).
 */
(function () {
  "use strict";
  const LUX = window.LUX || {}, M = LUX.manifest, RU = LUX.rules;
  const app = document.getElementById("app"), fixbar = document.getElementById("fixbar");
  const pageKind = document.documentElement.dataset.kind;
  // 공통 상태 (5.5절): 데이터 없음 · 종류 불일치
  const fail = (h, p) => { app.innerHTML = `<div class="pagehead"><h1>${h}</h1><p class="lead">${p}</p></div>`; };
  if (!M || !RU || !LUX.search) return fail("가격 데이터가 없어요", "이 페이지 폴더의 data/ 를 만들어 주세요 — <code>python -I sheets/export_web.py</code>");
  if (M.kind !== pageKind) return fail("데이터 종류가 페이지와 달라요", `페이지는 ${pageKind}, 데이터는 ${M.kind} 예요. 빌드를 다시 해 주세요.`);
  const kind = M.kind;
  const D = { generated: RU.generated, fx: RU.fx, countries: RU.countries, [kind]: LuxData.decodeSearch(LUX.search), changes: LUX.history || [],
    syn: RU.syn, presets: RU.presets, brandKo: RU.brandKo, subtypes: RU.subtypes, metals: RU.metals, stones: RU.stones,
    jpExcl: RU.jpExcl, stores: RU.stores, thTiers: RU.thTiers, leathers: RU.leathers || [], colors: RU.colors || [] };
  // 이벤트·프로모션·광고 (sheets/config/events.json → data/events.json, 2026-10-29): 기간 안(휴대폰 시각)에만 보임
  const EV = LUX.events && Array.isArray(LUX.events.events) ? { pages: [], ...LUX.events } : { categories: [], events: [], pages: [] };
  // 패션: 데이터 칸을 화면 이름으로 (소재 칸 = 색상 원문, 금속 칸 = 가죽 그룹, 스톤 칸 = 색상 그룹), 모델 번호 없으면 제품번호
  if (kind === "bag") for (const p of D.bag) { p.col = p.m; p.lt = p.mt; p.colg = p.g; p.md = p.md || p.s; }
  // 색상 표시: 원문이 한글이면 그대로, 아니면 한글 색 묶음 · 원문 ('블랙 · Black'), 원문이 번호뿐이면(생로랑 '1000') 한글만 (2026-10-27)
  const colKo = q => { const raw = (q.col || "").trim(), g = q.colg && q.colg !== "정보 없음" ? q.colg : "";
    if (!raw) return g; if (/[가-힣]/.test(raw) || !g) return raw; if (/^[\d\s/.-]+$/.test(raw)) return g;
    return raw.toLowerCase() === g.toLowerCase() ? g : `${g} · ${raw}`; };
  // 종류 이름: 빌더 TYPE_KO 를 내보낸 것(rules.typeName) — 새 종류(몽클레르 '의류' 등)도 화면 코드 수정 없이 (2026-10-27)
  const TYPE_ALL = { ring: "반지", necklace: "목걸이", bracelet: "팔찌", earring: "귀걸이", watch: "시계", bag: "가방", wallet: "지갑", accessory: "액세서리", shoes: "신발", silk: "벨트·스카프·실크 소품", clothing: "의류", ...(RU.typeName || {}) };  // 앞의 값은 데이터에 typeName 이 없을 때만 쓰는 기본값
  // 5) 한글이 하나도 없는 제품 이름(보테가·생로랑 안경·참, 티파니 일부)은 앞에 세부 종류(없으면 종류)를 한글로: '선글라스 · Classic …' (2026-10-27)
  for (const p of D[kind]) if (p.n && !/[가-힣]/.test(p.n)) { const t = p.sb || TYPE_ALL[p.t]; if (t) p.n = `${t} · ${p.n}`; }
  LuxCalc.dated(D.countries, LuxCalc(RU).today());  // 기간 지난 한시 세율은 기본값으로 (RU.countries 와 같은 것이라 계산에도 적용)
  const C = D.countries, CODES = Object.keys(C), TRIP_CODES = CODES.filter(c => c !== "KR");
  // 미리보기(시험)용: ?nokr=브랜드 — 그 브랜드의 한국 가격을 숨겨 '한국에 없는 브랜드' 화면을 확인 (저장하지 않음)
  if (new URLSearchParams(location.search).get("nokr")) { const nb = new URLSearchParams(location.search).get("nokr"); for (const p of D[kind]) if (p.b === nb) delete p.p.KR; }
  // 한국에 없는 브랜드(미키모토 등, A안): 한국 가격이 하나도 없는 브랜드 — 한국 대신 '파는 나라들 진짜가격 평균'을 기준으로 절약률
  const NOKR = new Set([...new Set(D[kind].map(p => p.b))].filter(b => !D[kind].some(p => p.b === b && p.p.KR && p.p.KR[0])));
  const qs = new URLSearchParams(location.search);  // 미리보기용: ?trip=JP,FR — 저장하지 않음
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { if (qs.has("trip")) return; try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* 저장 불가면 이번만 */ } },
  };
  const KEY = k => "lux." + kind + "." + k;  // 앱마다 따로 저장 (2.2절)
  const tripKey = () => KEY("trip"), pickKey = () => KEY("picks");
  const S = { trip: [], picks: [], sel: {} };  // sel: 가방 모델별로 고른 색상 제품번호
  function loadKind() {
    loadSet();
    S.trip = qs.has("trip") ? qs.get("trip").split(",").filter(c => TRIP_CODES.includes(c)).slice(0, 3) : store.get(tripKey(), []);
    S.picks = store.get(pickKey(), []);
    S.sel = {};
  }

  const BUDGET = {
    jewelry: [["~100만", 0, 1e6], ["100~300만", 1e6, 3e6], ["300~500만", 3e6, 5e6], ["500만~", 5e6, Infinity]],
    bag: [["~200만", 0, 2e6], ["200~400만", 2e6, 4e6], ["400~700만", 4e6, 7e6], ["700만~", 7e6, Infinity]],
  };
  const COLG = { "블랙": "#1c1b19", "화이트·아이보리": "#f3f0ea", "베이지·탄": "#d6c3a3", "브라운": "#6b4a32", "레드·핑크": "#b23a48", "블루": "#2e5c9a",
    "그린": "#3f6b4a", "그레이·실버": "#a7a9ac", "옐로·오렌지": "#d9a23a", "퍼플": "#6d4c8c", "멀티": "conic-gradient(#c0392b,#e6b422,#2e86c1,#27ae60,#c0392b)", "정보 없음": "#cfc8bc" };

  // ── 도움 함수 ──
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const safeUrl = u => /^https:\/\//.test(u || "") ? u : "";
  const won = n => "₩" + Math.round(n).toLocaleString("ko-KR");
  const man = n => SET.num === "M" ? (n / 1e6).toFixed(n >= 1e7 ? 1 : 2).replace(/\.?0+$/, "") + "M"  // 설정 '숫자 표기'
    : n >= 1e8 ? (n / 1e8).toFixed(2).replace(/0$/, "") + "억원" : Math.round(n / 1e4).toLocaleString("ko-KR") + "만원";  // 한국 돈은 '85만원' (10-30 사용자)
  const local = (cc, v) => { const cur = C[cc].cur; return (cur === "KRW" ? "₩" : cur + " ") + Number(v).toLocaleString("ko-KR", { maximumFractionDigits: 2 }); };
  // 제품의 현지 가격: 원래 다른 통화로 적힌 칸이면 그 통화로 (계산은 나라 통화로 바꾼 값)
  const localP = (p, cc, v) => p.pc && p.pc[cc] ? `${esc(p.pc[cc][1])} ${Number(p.pc[cc][0]).toLocaleString("ko-KR")} <small>(≈ ${local(cc, Math.round(v))})</small>` : local(cc, v);
  const cc = c => `<span class="cc">${c}</span>`;
  // '진짜가격' 표기 (관세까지 넣은 실제 부담 가격). 2026-10-28 앱 이름이 럭스캐너로 바뀌어 '진·가' 강조는 뺌
  const JINGA = "진짜가격";
  const fxFmt = v => v >= 100 ? v.toLocaleString("ko-KR", { maximumFractionDigits: 2 }) : v >= 1 ? v.toLocaleString("ko-KR", { maximumFractionDigits: 4 }) : v.toLocaleString("ko-KR", { maximumFractionDigits: 5 });
  const nation = c => cc(c) + " " + esc(C[c].n);
  // 둥근 국기 (웹앱계획.md 6장): 나라를 고르거나 나라끼리 훑어보는 곳에만. 국기 + 나라 이름을 늘 함께 (제품 카드 가격 줄은 글자만)
  const flag = c => `<img class="flag" src="common/flags/${c.toLowerCase()}.svg" alt="" width="18" height="18" decoding="sync">`;  // 작은 파일이라 미루지 않음 (다시 그릴 때 빈 동그라미 방지)
  const nationF = c => flag(c) + esc(C[c].n);
  const pct = r => (r >= 0 ? "−" : "+") + Math.abs(Math.round(r * 100)) + "%";
  const median = a => { if (!a.length) return 0; const s = [...a].sort((x, y) => x - y), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
  const isM = () => matchMedia("(max-width: 1023px)").matches;
  const bk = b => (RU.brandName || {})[b] || b;  // 브랜드 한글 이름: 빌더 BR_NAME_KO(엑셀과 같은 표)를 내보낸 것 — 새 브랜드는 빌더 표 한 곳만 고침 (2026-10-27)
  const link = p => "#/p/" + encodeURIComponent(p.b) + "/" + encodeURIComponent(p.s);
  // 공유 링크 (2026-10-29, 임시): web/pack.py 가 만든 제품 공유 페이지(카톡 미리보기 사진·이름) — 파일 이름 규칙은 pack.py share_slug 와 같음
  const SHARE_BASE = "https://webdr1111-debug.github.io/jinga/" + (kind === "bag" ? "fashion" : "jewelry") + "/p/";
  const slugPart = t => Array.from(t).map(c => /^[A-Za-z0-9-]$/.test(c) ? c : Array.from(new TextEncoder().encode(c), x => "_" + x.toString(16).toUpperCase().padStart(2, "0")).join("")).join("");
  const shareUrl = p => SHARE_BASE + slugPart(p.b) + "--" + slugPart(p.s) + ".html";
  function copyLink(btn) {
    const url = btn.dataset.copylink, done = ok => { const o = btn.textContent; btn.textContent = ok ? "✓ 복사했어요" : "복사 못 했어요"; setTimeout(() => { btn.textContent = o; }, 1800); };
    const old = () => { const ta = document.createElement("textarea"); ta.value = url; ta.setAttribute("readonly", ""); ta.style.position = "fixed"; ta.style.opacity = "0";
      document.body.appendChild(ta); ta.select(); let ok = false; try { ok = document.execCommand("copy"); } catch (e) { ok = false; } ta.remove(); return ok; };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(url).then(() => done(true), () => done(old()));
    else done(old());
  }

  // ── 설정 (웹앱계획.md 5.15절). 앱마다 따로 저장 ──
  const DEF = { pay: "card", fee: 1.2, refund: true, customs: true, self: true, krDisc: 0, jpDept: false, jpRate: 5, jpFeeOn: true, jpFee: 1.55, cp: {},
    us: "ny", usTax: 6, euHigh: false, euThr: 5000, euUp: { FR: 1, IT: 1.5, ES: 1 }, off: [], hide: [], tripOnly: false, num: "man", theme: "auto", stale: 30, onboarded: false,
    fxMode: "live", fxCustom: {} };  // 환율: live = 페이지를 열 때마다 받은 최신 환율(못 받으면 마지막 값 → 빌드 값), build = 빌드 환율, custom = 직접 입력
  // 숫자 칸의 범위 (5.15절 '입력 지키기')
  const RANGE = { fee: [0, 10], krDisc: [0, 30], jpRate: [0, 15], jpFee: [0, 3], usTax: [0, 15], euThr: [1000, 50000], "euUp.FR": [0, 3], "euUp.IT": [0, 3], "euUp.ES": [0, 3], stale: [7, 90] };
  const setKey = () => KEY("settings");
  let SET = { ...DEF };
  function loadSet() {
    const s = store.get(setKey(), {});
    SET = { ...DEF, ...s, euUp: { ...DEF.euUp, ...(s.euUp || {}) }, fxCustom: { ...(s.fxCustom || {}) } };
    // 끝난·없어진 쿠폰은 켠 기록도 지움(강제로 끔)
    const cp = Object.fromEntries(Object.entries(s.cp || {}).filter(([id, on]) => on && CALC.coupons.some(c => c.id === id && cpLive(c))));
    SET.cp = cp;
    if (JSON.stringify(cp) !== JSON.stringify(s.cp || {})) store.set(setKey(), SET);
    applyTheme();
    applyFx();  // 저장된 환율 설정(빌드·직접 입력)으로 다시
  }
  function saveSet(patch) { SET = { ...SET, ...patch }; store.set(setKey(), SET); cache.clear(); applyTheme(); applyFx(); }
  function applyTheme() { const r = document.documentElement; SET.theme === "auto" ? r.removeAttribute("data-theme") : r.setAttribute("data-theme", SET.theme); }
  // 기본값과 다른 계산 설정 (띠에 개수로 보여 줌)
  const CALC_KEYS = ["pay", "fee", "refund", "customs", "self", "krDisc", "jpDept", "jpRate", "jpFeeOn", "jpFee", "cp", "us", "usTax", "euHigh", "euThr", "euUp", "off", "tripOnly", "fxMode", "fxCustom"];
  function diffs() {
    return CALC_KEYS.filter(k => JSON.stringify(SET[k]) !== JSON.stringify(DEF[k]))
      .filter(k => !(k === "fee" && SET.pay !== "custom") && !(k === "usTax" && SET.us !== "custom") && !(k === "jpRate" && !SET.jpDept)
        && !(["euThr", "euUp"].includes(k) && !SET.euHigh) && !(k === "self" && !SET.customs) && !(k === "fxCustom" && SET.fxMode !== "custom"));
  }
  const payLabel = () => SET.pay === "travel" ? "트래블카드 0%" : SET.pay === "custom" ? `수수료 ${SET.fee}%` : "신용카드 1.2%";
  const setSummary = () => [payLabel(), SET.refund ? "세금 환급 받음" : "환급 없음", SET.customs ? (SET.self ? "자진신고 관세 포함" : "관세 포함") : "관세 제외"]
    .concat(SET.krDisc ? [`한국 할인 ${SET.krDisc}%`] : [], SET.jpDept ? [`일본 백화점 ${SET.jpRate}%`] : [], cpOn().map(cp => `${cp.short} 쿠폰 ${cp.rate}%`), [fxLabel()]).join(" · ");
  const jpExcluded = b => CALC.jpExcluded(b);
  // 기간 쿠폰 (sheets/config/coupons.json, 2026-10-28): 기간이 지나면 켜 둔 것도 계산에서 빠지고 저장된 설정에서도 지운다
  const cpLive = cp => CALC.cpActive(cp, CALC.today());
  const cpOn = () => CALC.coupons.filter(cp => SET.cp[cp.id] && cpLive(cp));
  // 쿠폰·매장 안내의 공식 링크 (config/coupons.json links): https 만, 새 창
  const offLinks = ls => (ls || []).filter(l => safeUrl(l.url)).map(l => `<a class="link" href="${esc(l.url)}" target="_blank" rel="noopener noreferrer">${esc(l.label)} ↗</a>`).join(" · ");
  const NOTICES = RU.notices || [];

  // ── 계산 (웹앱계획.md 7장) — common/calc.js 를 지금 설정(SET)으로 부른다 ──
  // ── 환율 (2026-10-27): 페이지를 열 때마다 최신 환율을 한 번 받는다. 숫자(JSON)만 받아 검사한 뒤 쓴다(코드는 받지 않음) ──
  const FX_URL = "https://open.er-api.com/v6/latest/KRW";  // ExchangeRate-API 공개 주소(하루 한 번 갱신, 출처 표시 필요)
  const FX_BUILD = {};  // 통화 → 원화 (빌드 때 값)
  for (const c of CODES) FX_BUILD[C[c].cur] = RU.fx[c];
  const CURS = Object.keys(FX_BUILD).filter(k => k !== "KRW");
  const fxOk = (cur, v) => typeof v === "number" && isFinite(v) && v > FX_BUILD[cur] * 0.7 && v < FX_BUILD[cur] * 1.3;  // 빌드 값과 30% 넘게 다르면 안 씀
  let FXL = store.get(KEY("fxLive"), null), fxState = "";  // 마지막으로 받은 최신 환율 {rates, date, at} · 이번에 받기 상태
  if (!FXL || typeof FXL !== "object" || !FXL.rates || !CURS.every(c => fxOk(c, FXL.rates[c]))) FXL = null;
  function fxNow(cur) {
    if (cur === "KRW") return 1;
    if (SET.fxMode === "custom" && fxOk(cur, SET.fxCustom[cur])) return SET.fxCustom[cur];
    if (SET.fxMode !== "build" && FXL) return FXL.rates[cur];
    return FX_BUILD[cur];
  }
  function fxLabel() {
    if (SET.fxMode === "custom") return "환율 직접 입력";
    if (SET.fxMode === "build" || !FXL) return `빌드 환율 ${M.fxDate.slice(5).replace("-", ".")}`;
    return `최신 환율 ${FXL.date.slice(5).replace("-", ".")}`;
  }
  let CALC, CUS = RU.customs;
  function applyFx(first) {
    D.fx = Object.fromEntries(CODES.map(c => [c, fxNow(C[c].cur)]));
    CALC = LuxCalc({ ...RU, fx: D.fx });
    if (!first) cache.clear();  // 처음 한 번은 계산 저장소(cache)가 아직 없음
  }
  applyFx(true);
  async function fetchFx() {
    fxState = "loading";
    try {
      const ctl = new AbortController(), to = setTimeout(() => ctl.abort(), 8000);
      const r = await fetch(FX_URL, { signal: ctl.signal, credentials: "omit", referrerPolicy: "no-referrer", cache: "no-store" });
      clearTimeout(to);
      const j = await r.json();
      if (!j || j.result !== "success" || !j.rates) throw new Error("응답 형식이 달라요");
      const rates = {};
      for (const cur of CURS) {
        const x = j.rates[cur], v = typeof x === "number" && x > 0 ? 1 / x : NaN;  // 1원 = x 외화 → 1외화 = 1/x 원
        if (!fxOk(cur, v)) throw new Error(`${cur} 값이 빌드 환율과 30% 넘게 달라요`);
        rates[cur] = v;
      }
      const date = new Date((+j.time_last_update_unix || Date.now() / 1000) * 1000).toISOString().slice(0, 10);
      FXL = { rates, date, at: Date.now() };
      store.set(KEY("fxLive"), FXL);
      fxState = "ok";
    } catch (e) {
      fxState = "fail:" + (e && e.name === "AbortError" ? "시간 초과" : (e && e.message) || "받기 실패");
    }
    applyFx();
    render();
  }
  const customs = (afterRefund, grp, force, simple) => CALC.customs(afterRefund, grp, SET, force, simple);
  // 관세 품목: 데이터의 품목 번호(빌더 '품목별 관세 기준'), 없으면 시계·패션 = 시계·가방, 그 밖 = 보석
  const CUSG = { 1: "jewel", 2: "watchbag", 3: "wear", 4: "acc" };
  const grpOf = p => CUSG[p.cg] || (kind === "bag" || p.t === "watch" ? "watchbag" : "jewel");
  const calc = (c, v, grp, brand) => CALC.calc(c, v, grp, brand, SET);
  const cache = new Map();
  loadKind();  // 설정(SET)을 정의한 뒤에 불러옴
  function rows(p) {
    if (cache.has(p)) return cache.get(p);
    const g = grpOf(p);
    // 설정 '비교할 나라'·'내 여행지 나라만 비교'로 뺀 나라는 계산에서 뺌 (한국은 늘 포함)
    const use = c => c === "KR" || (!SET.off.includes(c) && (!SET.tripOnly || !S.trip.length || S.trip.includes(c)));
    const r = Object.entries(p.p).filter(([c]) => use(c)).map(([c, [v, t, url, opt]]) => ({ cc: c, v, t, url, opt, ...(v ? calc(c, v, g, p.b) : { net: Infinity }) }));
    cache.set(p, r);
    return r;
  }
  // 기준 나라 (브랜드 화면 '기준 나라' 칩, 여행지 화면에서 브랜드를 고를 때): 그 화면을 그리는 동안만 대표 가격을 이 나라로.
  // 화면마다 처음에 비우므로 다른 화면 가격과 섞이지 않는다 (나라별 계산 캐시 rows 는 기준 나라와 상관없음)
  let AT = null;
  const atOk = c => c && C[c] && c !== "KR" ? c : null;
  const soldAt = (p, c) => rows(p).some(r => r.cc === c && r.t > 0 && r.v);
  // 대표 가격 (5.3절): 내 여행지 중 최저 → 없으면 전체 최저. 살 수 있음·매장 확인(t>0)만
  function rep(p, trip) {
    trip = trip || (AT ? [AT] : S.trip);
    const rs = rows(p), ok = rs.filter(r => r.t > 0 && r.v);
    let kr = rs.find(r => r.cc === "KR" && r.v);
    const all = ok.filter(r => r.cc !== "KR").sort((a, b) => a.net - b.net);
    const inTrip = all.filter(r => trip.includes(r.cc));
    let best, mode;
    if (trip.length && inTrip.length) { best = inTrip[0]; mode = "trip"; }
    else { best = all[0] || (kr && kr.t > 0 ? kr : null); mode = trip.length ? "notrip" : "all"; }
    if (!kr && NOKR.has(p.b) && all.length >= 2) kr = { cc: "KR", ref: true, t: 1, v: 1, net: all.reduce((s2, r) => s2 + r.net, 0) / all.length };  // 나라 평균(가상 기준)
    const save = best && kr ? (kr.net - best.net) / kr.net : null;
    // 가격 확인 필요: 엑셀 가격DB '가격 확인'과 같은 판정(빌더가 정함 — 나라 중간값보다 45% 넘게 싸거나 80% 넘게 비쌈, 나라마다 캐럿·옵션이 다름)
    // (시안의 '2위보다 15% 넘게 쌈' 규칙은 정상 제품을 너무 많이 걸러서 버림 — 2026-10-27)
    const outlier = !!p.ck;
    return { best, kr, save, mode, outlier, all };
  }
  const krLab = R => R.kr && R.kr.ref ? "나라 평균" : "한국";  // A안: 한국에 없는 브랜드는 기준이 '나라 평균'
  function badge(R) {
    if (R.outlier) return `<span class="bdg warn">가격 확인 필요</span>`;
    if (!R.kr) return `<span class="bdg gray">한국 미판매</span>`;
    if (R.save === null || R.save <= 0) return `<span class="bdg kr">한국 최저</span>`;
    return R.kr.ref ? `<span class="bdg save" title="한국 미판매 브랜드 — 파는 나라들 평균 대비">평균 ${pct(R.save)}</span>` : `<span class="bdg save">${pct(R.save)}</span>`;
  }

  // ── 목록 단위: 주얼리 = 제품, 가방 = 모델 묶음 (5.6절) ──
  const list = () => D[kind];
  let models = null;
  // 설정 '관심 없는 브랜드 숨기기'를 뺀 목록 (브랜드를 직접 고른 곳은 itemsAll)
  const items = () => itemsAll().filter(it => !SET.hide.includes(it.ps[0].b));
  function itemsAll() {  // 카드 한 장에 해당하는 단위
    if (kind === "jewelry") return list().map(p => ({ key: p.b + "|" + p.s, ps: [p] }));
    if (!models) {
      const m = new Map();
      for (const p of D.bag) { if (!m.has(p.md)) m.set(p.md, []); m.get(p.md).push(p); }
      models = [...m.entries()].map(([md, ps]) => ({ key: "m|" + md, md, ps }));
    }
    return models;
  }
  // 묶음의 대표: 고른 색, 없으면 대표 가격이 가장 싼 색
  function head(it) {
    if (it.ps.length === 1) return it.ps[0];
    const s = S.sel[it.key];
    return it.ps.find(p => p.s === s) || [...it.ps].sort((a, b) => (rep(a).best?.net ?? Infinity) - (rep(b).best?.net ?? Infinity))[0];
  }
  const itemRep = it => rep(head(it));
  const findP = (b, s) => list().find(p => p.b === b && p.s === s);
  const itemOf = p => kind === "bag" ? itemsAll().find(it => it.md === p.md) : { key: p.b + "|" + p.s, ps: [p] };
  const modelName = p => kind === "bag" ? p.n : p.n;

  // ── 사진 ──
  // 여백 많은 사진 확대(2026-10-28): 빌드가 잰 제품 영역 fb=[x0,y0,x1,y1,가로/세로](0~1000, sheets/img_bbox.py)로
  // 사진을 잘리지 않게(contain) 넣은 뒤 제품이 칸의 약 90%를 채우도록 확대하고 제품 가운데를 칸 가운데로. 최대 2.5배.
  function fitStyle(fb) {
    if (!Array.isArray(fb) || fb.length !== 5) return "";
    const [x0, y0, x1, y1, ar] = fb, a = Math.max(ar, 1) / 1000;
    const dw = Math.min(1, a), dh = Math.min(1, 1 / a), ox = (1 - dw) / 2, oy = (1 - dh) / 2;
    const cw = dw * (x1 - x0) / 1000, ch = dh * (y1 - y0) / 1000;
    if (cw <= 0 || ch <= 0) return "";
    const s = Math.min(0.9 / Math.max(cw, ch), 2.5);
    const cx = ox + dw * (x0 + x1) / 2000, cy = oy + dh * (y0 + y1) / 2000;
    return ` class="fit" style="--s:${s.toFixed(3)};--tx:${((0.5 - cx) * 100).toFixed(2)}%;--ty:${((0.5 - cy) * 100).toFixed(2)}%"`;
  }
  function photo(p, cls) {
    const src = safeUrl(p.img), ph = `<div class="noimg">${esc(bk(p.b))}</div>`;
    return `<div class="ph ${cls || ""}">${src ? `<img loading="lazy" referrerpolicy="no-referrer" src="${esc(src)}" alt="" data-fallback="1"${fitStyle(p.fb)}>` : ph}</div>`;
  }
  // 사진을 못 불러오면 브랜드 칸으로 (인라인 onerror 대신 위임)
  // 브랜드 로고 (브랜드를 고르는 곳에만, 웹앱계획.md 6장). 위키미디어 공용의 로고 파일을 인터넷에서 읽고, 못 읽으면 지금처럼 글자로
  const WM = "https://upload.wikimedia.org/wikipedia/commons/";
  const LOGOS = RU.logos || {};  // 브랜드 로고(위키미디어 공용 경로): sheets/config/brands.csv '로고' 칸을 내보낸 것 — 새 브랜드도 화면 코드 수정 없이 (2026-10-27)
  const brandMark = (b, cls) => `<span class="bmark ${cls || ""}">${LOGOS[b] ? `<img src="${WM + LOGOS[b]}" alt="${esc(b)}" referrerpolicy="no-referrer" data-logo="1">` : ""}<span class="btext">${esc(b.toUpperCase())}</span></span>`;
  document.addEventListener("error", e => {
    const img = e.target;
    if (img.tagName === "IMG" && img.dataset.logo) { img.remove(); return; }  // 로고를 못 읽으면 글자만 남김
    if (img.tagName === "IMG" && img.dataset.fallback) {
      const box = document.createElement("div"); box.className = "noimg"; box.textContent = img.closest("[data-brand]")?.dataset.brand || "";
      img.replaceWith(box);
    }
  }, true);

  // ── 카드 (5.6절) ──
  // 카드 가격 (2026-10-30 사용자: 금액이 잘 보이게): 위에 작은 '최저 🇹🇼대만', 아래 큰 굵은 금액
  function priceLine(R, from = "") {
    if (!R.best) return `<div class="pr">비교할 가격 없음</div>`;
    const opt = R.best.opt ? "부터" : from;
    if (R.mode === "notrip") return `<div class="pr muted">내 여행지에서 안 팜</div><div class="kr">최저 ${nationF(R.best.cc)} ${man(R.best.net)}${opt}</div>`;
    return `<div class="pr"><span class="prl">${R.mode === "all" ? "최저 " : ""}${nationF(R.best.cc)}</span> <span class="amt">${man(R.best.net)}${opt}</span></div>`;
  }
  function card(it, extra) {
    const p = head(it), R = rep(p), on = S.picks.includes(p.b + "|" + p.s);
    const isBag = kind === "bag";
    let from = "";
    if (isBag && it.ps.length > 1) {
      const nets = it.ps.map(q => rep(q).best?.net).filter(Boolean);
      if (Math.max(...nets) - Math.min(...nets) > 1) from = "부터";
    }
    const tags = [badge(R)];
    if (R.best && R.best.t === 2) tags.push(`<span class="bdg stock" title="가장 싼 나라 공홈에서 온라인 품절·미판매예요. 매장 재고를 꼭 확인하세요">재고 확인</span>`);
    if (p.x && p.x["신상"]) tags.push(`<span class="bdg new">신상</span>`);
    if (isBag && it.ps.length > 1) tags.push(`<span class="bdg gray">색상 ${it.ps.length}</span>`);
    const chips = isBag && it.ps.length > 1 ? `<div class="chips" role="group" aria-label="색상">${it.ps.slice(0, 4).map(q =>
      `<button type="button" class="sw ${q === p ? "on" : ""}" data-sel="${esc(it.key)}" data-sku="${esc(q.s)}" title="${esc(colKo(q))}" aria-label="${esc(colKo(q))}" style="background:${COLG[q.colg] || "#999"}"></button>`).join("")}${it.ps.length > 4 ? `<span class="more">+${it.ps.length - 4}</span>` : ""}</div>` : "";
    const name = isBag ? p.n : p.n;
    return `<article class="card" data-brand="${esc(bk(p.b))}">
      <a class="hit" href="${link(p)}" aria-label="${esc(name)}"></a>
      <div class="pw">${photo(p)}<div class="tags">${tags.join("")}</div>
        <button type="button" class="heart ${on ? "on" : ""}" data-pick="${esc(p.b + "|" + p.s)}" aria-label="${on ? "담기 취소" : "담기"}"><svg><use href="#i-heart"/></svg></button></div>
      <div class="body">
        <div class="br">${esc(p.b.toUpperCase())}${!isBag && p.c ? " · " + esc(colName(p.c).toUpperCase()) : ""}</div>
        <div class="nm">${esc(name)}</div>
        ${chips}
        ${priceLine(R, from)}
        <div class="kr">${R.kr ? `${krLab(R)} ${savedAmt(R) ? `<s>${man(R.kr.net)}</s>` : man(R.kr.net)}` : "한국 가격 없음"}${savedAmt(R) ? ` <span class="saved">${man(savedAmt(R))} 아낌</span>` : ""}</div>
        ${extra || ""}
      </div></article>`;
  }
  // 목록 보기 한 줄 (5M.12절: 모바일 찾기·브랜드·여행지 결과의 기본)
  function rowItem(it, extra) {
    const p = head(it), R = rep(p), on = S.picks.includes(p.b + "|" + p.s), amt = savedAmt(R);
    const price = R.best ? `${R.mode === "notrip" ? `<span class="muted">여행지 안 팜 · 최저</span> ` : ""}${cc(R.best.cc)} <b>${man(R.best.net)}</b>` : "가격 없음";
    const tail = amt ? ` <span class="saved">${man(amt)} 아낌</span>` : R.kr && R.save !== null && R.save <= 0 ? ` <span class="kr">한국 최저</span>` : !R.kr ? ` <span class="kr">한국 미판매</span>` : "";
    return `<article class="lrow" data-brand="${esc(bk(p.b))}"><a class="hit" href="${link(p)}" aria-label="${esc(p.n)}"></a>
      <div class="lph">${photo(p)}</div>
      <div class="ltx"><div class="br">${esc(p.b)}${kind === "bag" && it.ps.length > 1 ? ` · 색상 ${it.ps.length}` : ""}</div><div class="lnm">${esc(p.n)}</div>
        <div class="lpr">${price}${tail}${R.best && R.best.t === 2 ? ` <span class="bdg stock">재고 확인</span>` : ""}</div>${extra || ""}</div>
      <button type="button" class="heart ${on ? "on" : ""}" data-pick="${esc(p.b + "|" + p.s)}" aria-label="${on ? "담기 취소" : "담기"}"><svg><use href="#i-heart"/></svg></button></article>`;
  }
  const viewMode = q => q.get("view") || "card";  // 기본 = 카드(사진이 크게), 모바일·PC 같음 (2026-10-26)
  const grid = (its, cls) => `<div class="grid ${cls || ""}">${its.map(it => card(it)).join("")}</div>`;
  const rail = its => `<div class="rail">${its.map(it => card(it)).join("")}</div>`;
  // 모바일은 가로 밀기 대신 세로 목록 줄 (5M.12절, 2026-10-26)
  const lrows = rowsHtml => `<div class="lrows">${rowsHtml.join("")}</div>`;
  const listOrGrid = its => grid(its);  // 첫 화면은 모바일도 사진 카드 2열 (2026-10-26)

  // 로고 '스캔 X' (2026-10-28, 웹앱계획.md '이름·로고 방향') — 머리글은 index.html, 바닥글은 여기서. 색은 style.css --lx-x·--lx-beam
  const SEAL = `<svg class="seal lxm" viewBox="0 0 100 100" aria-hidden="true"><path class="lxx" d="M19 12H36L55.24 44.5H38.24Z M44.76 55.5H61.76L81 88H64Z M75 12H82L61.05 44.5H54.05Z M46.95 55.5H53.95L33 88H26Z"/><rect class="lxb" x="2" y="48.3" width="96" height="3.4"/></svg>`;
  // 매장 재고 경고 (5.4절, 2026-10-27): 공홈에 가격이 있어도 그 나라 매장에 재고가 있다는 뜻은 아님
  const stockNote = (short) => short
    ? `<p class="stocknote sm" role="note"><b>⚠ 매장 재고는 꼭 확인하세요</b> 가격이 있어도 재고가 없거나 사이즈·소재가 다를 수 있어요.</p>`
    : `<div class="stocknote" role="note"><b>⚠ 사러 가기 전에 매장 재고를 꼭 확인하세요</b>
        <p>공식 홈페이지에 가격이 있어도 그 나라 매장에 재고가 있다는 뜻은 아니에요. 인기 제품은 품절이거나 사이즈·소재·캐럿이 다를 수 있어요.
        가기 전에 매장에 전화·메일로 묻거나 공식 홈페이지의 매장 재고 확인·예약을 이용하세요. 가격·세율·환율·환급 조건도 바뀔 수 있어요.</p></div>`;
  // ── 공통 틀 ──
  function frame() {
    // 앱 이름·아이콘은 앱마다 따로 (웹앱계획.md 0.1절): 럭스캐너 주얼리 / 럭스캐너 패션 (패션 앱의 내부 종류 이름은 bag)
    const appName = kind === "bag" ? "패션" : "주얼리";
    document.getElementById("kindName").textContent = appName;
    const other = document.getElementById("otherApp");
    other.textContent = kind === "bag" ? "주얼리" : "패션";  // ↗ 는 style.css .other::after 가 붙임 (두 번 나오던 것, 2026-10-28)
    other.hidden = !M.other || !!window.LUX_APP;  // 다른 앱 페이지가 생기면 manifest 의 other 주소. 앱 안에서는 숨김(다른 앱 열기는 4단계)
    document.getElementById("appIcon").href = "../common/" + (kind === "bag" ? "icon-fashion.svg" : "icon-jewelry.svg");
    document.title = "럭스캐너 " + appName;
    const chip = document.getElementById("tripChip");
    chip.innerHTML = S.trip.length ? S.trip.map(c => esc(C[c].n)).join(" · ") : "내 여행지";  // 머리글 단추 (10-30 사용자: "여행지 고르기" → "내 여행지")
    chip.classList.toggle("set", S.trip.length > 0);
    const n = S.picks.length;
    document.getElementById("pickCnt").textContent = n;
    document.getElementById("pickCntM").textContent = n ? n : "";
    // 기본 설정과 다르게 계산 중이면 머리글 아래 띠 (5.15절)
    const sb = document.getElementById("setbar"), dn = diffs().length;
    sb.hidden = !dn;
    if (dn) sb.innerHTML = `<span class="sbt">기본 설정과 다르게 계산 중 (${dn}개) · ${esc(setSummary())}</span> <a class="link" href="#/settings">보기</a> <button type="button" class="link" data-reset="calc">되돌리기</button>`;
    const footMore = `가격 기준: 공홈 표시가 · 데이터 ${esc(D.generated)} (버전 ${esc(M.version)}) · ${esc(fxLabel())} · ${JINGA} = 공홈가 − 환급 + 결제 수수료 + <b>관세</b>(제품 1개 기준, 면세 $800 공제) — 지금 설정: ${esc(setSummary())}` +
      `<br>각 브랜드와 관계없는 개인 비교입니다 · 브랜드 이름·로고·제품 사진은 각 브랜드의 것 · <b>가격이 있어도 매장 재고·가격은 다를 수 있으니 사러 가기 전에 매장에 꼭 확인하세요</b>`;
    // 모바일 바닥글은 짧게 (5M.12절)
    document.getElementById("foot").innerHTML = isM()
      ? `<span class="fseal">${SEAL}<span class="mark" lang="en">LUXCANNER</span></span><p class="f1">각 브랜드와 관계없는 개인 비교 · 데이터 ${esc(D.generated)}</p><p class="f1"><b>⚠ 가격이 있어도 매장 재고는 꼭 확인하세요</b></p><details class="fmore"><summary>자세히</summary><p>${footMore}</p></details>`
      : `<span class="fseal">${SEAL}<span class="mark" lang="en">LUXCANNER</span></span><span class="tag">the real price of luxury</span>${footMore}`;
  }

  // 일본 백화점 할인을 켤 때 경고 창 (5.15절, 2026-10-27): 외국인 할인 대상 브랜드는 백화점·지점마다 달라 꼭 확인하라고 알림. '켜기'를 눌러야 켜짐
  // 2026-10-30: 이세탄·미쓰코시 게스트 카드는 2025.03.25 발급 끝 → 받는 방법을 앱 쿠폰·한큐 게스트 쿠폰 기준으로
  function jpDeptWarn(onOk) {
    let d = document.getElementById("jpwarn");
    if (!d) { d = document.createElement("dialog"); d.id = "jpwarn"; d.className = "warndlg"; d.setAttribute("aria-labelledby", "jpwarnT"); document.body.appendChild(d); }
    d.innerHTML = `<h3 id="jpwarnT">⚠ 일본 백화점 할인은 쿠폰이 있어야 하고 백화점·지점마다 달라요</h3>
      <ul><li>받는 방법: 이세탄·미쓰코시는 <b>'MITSUKOSHI ISETAN JAPAN' 앱 쿠폰</b>(여권 등록, 그룹 게스트 카드는 2025.03 발급 끝), 후쿠오카 이와타야는 <b>신관 7층 면세 카운터에서 여권으로 받는 게스트 카드</b>, 한큐(하카타 한큐 포함)는 <b>안내 데스크·면세 카운터에서 여권으로 받는 게스트 쿠폰</b>(받은 날부터 7일)이에요. 계산 전에 보여 줘야 해요.</li>
        <li>외국인 ${SET.jpRate}% 할인 대상 브랜드는 <b>백화점과 지점마다 다르고</b> 수시로 바뀌어요. 다카시마야처럼 시계·주얼리·명품 브랜드를 빼는 곳도 있어요.</li>
        <li>럭스캐너는 <b>이세탄·미쓰코시 공식 제외 목록</b>을 기준으로 계산해요. 한큐는 제외 브랜드를 공개하지 않아요. 예: ${kind === "bag" ? "셀린느는 이세탄·미쓰코시에서는 할인되지만 마쓰자카야 나고야·다이마루 삿포로에서는" : "타사키는 이세탄·미쓰코시에서는 할인되지만 다이마루 우메다에서는"} 빠져요.</li>
        <li>세일 상품 제외, 최소 금액, 다른 할인과 중복 안 됨 같은 조건도 있어요.</li></ul>
      <p class="wmain">사러 가기 전에 그 백화점·지점의 면세 카운터나 안내 데스크에 <b>이 브랜드가 할인되는지 꼭 확인하세요.</b></p>
      <form method="dialog" class="row"><button type="submit" class="btn ghost" value="no">취소</button><button type="submit" class="btn" value="ok">확인했어요, 켜기</button></form>`;
    d.returnValue = "";
    d.onclose = () => { if (d.returnValue === "ok") onOk(); };
    if (d.showModal) d.showModal(); else if (confirm("일본 백화점 할인 대상 브랜드는 백화점·지점마다 달라요. 사러 가기 전에 꼭 확인하세요. 켤까요?")) onOk();
  }

  // 기간 쿠폰을 켤 때 경고 창 (2026-10-28): 문구·기간·입점 브랜드는 config/coupons.json 에서. '켜기'를 눌러야 켜짐
  const ymd = s => s ? s.replace(/^(\d{4})-(\d\d)-(\d\d)$/, (_, y, m, d) => `${y}년 ${+m}월 ${+d}일`) : "";
  function cpWarn(cp, onOk) {
    let d = document.getElementById("cpwarn");
    if (!d) { d = document.createElement("dialog"); d.id = "cpwarn"; d.className = "warndlg"; d.setAttribute("aria-labelledby", "cpwarnT"); document.body.appendChild(d); }
    const out = [...new Set(list().map(p => p.b))].filter(b => !cp.brands.includes(b)).map(bk), exc = Object.entries(cp.exclude || {});
    d.innerHTML = `<h3 id="cpwarnT">⚠ ${esc(cp.name)} 할인은 쿠폰이 있어야 해요</h3>
      <ul><li>${esc(cp.how || "")}</li>${(cp.terms || []).map(x => `<li>${esc(x)}</li>`).join("")}
        <li>할인 ${cp.rate}% · 쿠폰 기간 <b>${ymd(cp.until)}까지</b> — 지나면 자동으로 꺼져요.</li>
        <li>입점 브랜드만 할인해요.${out.length ? ` <b>${esc(out.join("·"))}</b>는 입점하지 않아 빠져요.` : ""}</li>
        ${exc.length ? `<li>입점했지만 쿠폰 할인이 안 되는 브랜드: ${exc.map(([b, why]) => `<b>${esc(bk(b))}</b>(${esc(why)})`).join(", ")}</li>` : ""}
        <li>그 밖에도 매장마다 쿠폰이 안 될 수 있어요(공식 제외 목록 없음).</li>
        ${offLinks(cp.links) ? `<li>${offLinks(cp.links)}</li>` : ""}</ul>
      <p class="wmain">사러 가기 전에 그 매장에 <b>쿠폰 할인이 되는지 꼭 확인하세요.</b></p>
      <form method="dialog" class="row"><button type="submit" class="btn ghost" value="no">취소</button><button type="submit" class="btn" value="ok">확인했어요, 켜기</button></form>`;
    d.returnValue = "";
    d.onclose = () => { if (d.returnValue === "ok") onOk(); };
    if (d.showModal) d.showModal(); else if (confirm(`${cp.name} 할인은 쿠폰이 있어야 하고 입점 브랜드만 돼요. 켤까요?`)) onOk();
  }

  // ── 내 여행지 고르기 (5.3절): PC 펼침 / 모바일 바텀 시트 ──
  const panel = document.getElementById("trippanel");
  function openTrip() {
    panel.innerHTML = `<div class="sheet" role="dialog" aria-label="내 여행지">
      <div class="grab"></div>
      <h3>내 여행지 <small>최대 3개 · 한국은 늘 비교 기준</small></h3>
      <p class="plabel">한 번에 고르기</p>
      <div class="presets">${D.presets.map(([n, cs]) => { const codes = cs.map(nm => TRIP_CODES.find(c => C[c].n === nm)).filter(Boolean).slice(0, 3);
        const on = codes.length === S.trip.length && codes.every(c => S.trip.includes(c));
        return codes.length ? `<button type="button" class="tchip sm ${on ? "on" : ""}" data-preset="${codes.join(",")}">${esc(n)}</button>` : ""; }).join("")}</div>
      <p class="plabel">나라 고르기</p>
      <div class="tripgrid">${TRIP_CODES.map(c => `<button type="button" class="tchip ${S.trip.includes(c) ? "on" : ""}" data-trip="${c}">${nationF(c)}</button>`).join("")}</div>
      <p class="msg" id="tripMsg"></p>
      <div class="row"><button type="button" class="btn ghost" data-trip-clear>모두 빼기</button><button type="button" class="btn" data-trip-close>완료</button></div>
    </div>`;
    panel.hidden = false;
  }
  function setTrip(t) { S.trip = t; store.set(tripKey(), t); cache.clear(); render(); }
  function toggleTrip(c) {
    if (S.trip.includes(c)) return setTrip(S.trip.filter(x => x !== c));
    if (S.trip.length >= 3) { const m = document.getElementById("tripMsg"); if (m) m.textContent = "여행지는 3개까지예요. 하나를 빼고 고르세요."; return false; }
    setTrip([...S.trip, c]);
  }

  // ── S-01 첫 화면 (5.7절, 2026-10-25 개편) ──
  let budgetIdx = 0, tripTab = 0, heroIdx = 0, heroList = [], homeMore = false;  // homeMore: 휴대폰 첫 화면 아래쪽 펼침 (2026-10-28)
  const SAVE_MIN = 500_000;  // ④ 비행기값 기준 (왕복 항공권 대략값)
  const HINT = { jewelry: "까르띠에 러브, 300만원 반지", bag: "네버풀, 100만원 지갑" };  // 첫 화면 찾기 칸 예시
  const GIFT = {
    jewelry: [["50만원 이하", 0, 5e5], ["100만원 이하", 5e5, 1e6], ["300만원 이하", 1e6, 3e6], ["그 이상", 3e6, Infinity]],
    bag: [["100만원 이하", 0, 1e6], ["200만원 이하", 1e6, 2e6], ["400만원 이하", 2e6, 4e6], ["그 이상", 4e6, Infinity]],
  };
  const savedAmt = R => R.best && R.kr && R.save > 0 ? R.kr.net - R.best.net : 0;
  // 추천에 넣지 않는 것 (5.7절): 가격 확인 필요, 한국·대표 나라가 '살 수 있음'이 아님, 옵션 가격 범위(캐럿·사이즈마다 값이 다름)
  const clean = R => R.best && R.kr && !R.outlier && R.best.t === 1 && R.kr.t === 1 && !R.best.opt && !R.kr.opt;
  // 첫 화면은 사진이 있는 제품만 (사진 없는 카드가 섞이면 첫인상이 크게 떨어짐)
  const pool = () => items().map(it => ({ it, p: head(it), R: itemRep(it) })).filter(o => o.p.img && clean(o.R) && savedAmt(o.R) > 0);
  const section = (eyebrow, title, desc, more) => `<div class="sh"><p class="eyebrow">${eyebrow}</p><h2>${title}</h2>${desc ? `<p class="desc">${desc}</p>` : ""}${more || ""}</div>`;
  const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

  // 첫 화면 큰 사진 10장 (5.7절 ①, 2026-10-27): 절약률 1~3위 3장(데이터가 바뀔 때만 바뀜) + 대표 컬렉션 7장(열 때마다 무작위)
  //  - 대표 컬렉션 = 브랜드마다 제품이 가장 많은 컬렉션 3개(관리 목록 없음). 한국보다 5% 이상 싼 것, 1~3위·같은 브랜드·같은 컬렉션은 되도록 피함
  //  - 절약률이 높을수록 뽑힐 확률이 큼. 패션은 가방만(첫인상). 고른 7장은 내 여행지를 바꾸거나 새로 열 때까지 유지
  const HERO_RAND = 7, HERO_MIN = 0.05;
  let heroSel = null;
  function heroPick(P, byRate, take, used) {
    const okT0 = o => o.p.img && (kind !== "bag" || o.p.t === "bag");
    // 첫 화면 대표는 '한국보다 N% 싸요'로 보이게 한국 가격이 있는 제품 먼저 (2026-10-29) — 모자라면(내 여행지를 좁게 고른 때) 나라 평균 기준도
    const okK = o => okT0(o) && o.R.kr && !o.R.kr.ref;
    const okT = P.filter(okK).length >= 10 ? okK : okT0;
    const top = take(P.filter(okT).sort(byRate), 3).map((o, i) => ({ ...o, lab: `${o.R.mode === "trip" ? "내 여행지에서" : "이번 주"} 절약률 ${i + 1}위` }));
    const sig = S.trip.join(",") + "|" + top.map(o => o.it.key).join(",");
    if (!heroSel || heroSel.sig !== sig) {
      const cnt = {};
      for (const it of items()) { const p = head(it); if (!p.c || /^(기타|other)/i.test(colName(p.c)) || (kind === "bag" && p.t !== "bag")) continue; const k = p.b + "|" + p.c; cnt[k] = (cnt[k] || 0) + 1; }
      const byB = {};
      for (const [k, n] of Object.entries(cnt)) (byB[k.split("|")[0]] = byB[k.split("|")[0]] || []).push([k, n]);
      const major = new Set(Object.values(byB).flatMap(a => a.sort((x, y) => y[1] - x[1]).slice(0, 3).map(x => x[0])));
      const topKeys = new Set(top.map(o => o.it.key)), topB = new Set(top.map(o => o.p.b));
      let cand = P.filter(o => okT(o) && !topKeys.has(o.it.key) && !used.has(o.it.key) && major.has(o.p.b + "|" + o.p.c));
      const strong = cand.filter(o => o.R.save >= HERO_MIN);
      if (strong.length >= HERO_RAND) cand = strong;  // 5% 넘는 게 모자라면(내 여행지를 좁게 고른 때) 기준을 낮춰 채움
      const out = [], seenB = new Set(), seenC = new Set();
      const draw = (fit) => {
        let pool = cand.filter(o => !out.includes(o) && fit(o));
        while (out.length < HERO_RAND && pool.length) {
          let t = pool.reduce((s2, o) => s2 + Math.max(0.01, o.R.save), 0) * Math.random(), o = pool[pool.length - 1];
          for (const x of pool) { t -= Math.max(0.01, x.R.save); if (t <= 0) { o = x; break; } }
          out.push(o); seenB.add(o.p.b); seenC.add(o.p.b + "|" + o.p.c);
          pool = pool.filter(x => x !== o && fit(x));
        }
      };
      draw(o => !topB.has(o.p.b) && !seenB.has(o.p.b));  // ① 1~3위에 없던 브랜드, 브랜드마다 1장
      draw(o => !seenB.has(o.p.b));                       // ② 1~3위 브랜드도 허용
      draw(o => !seenC.has(o.p.b + "|" + o.p.c));          // ③ 모자라면 같은 브랜드, 다른 컬렉션
      heroSel = { sig, keys: out.map(o => o.it.key) };
    }
    const rnd = heroSel.keys.map(k => P.find(o => o.it.key === k)).filter(Boolean)
      .map(o => ({ ...o, lab: `대표 컬렉션 · ${bk(o.p.b)} ${colName(o.p.c)}` }));
    rnd.forEach(o => used.add(o.it.key));
    // 순서: 1위 → 대표 2 → 2위 → 대표 2 → 3위 → 대표 3
    const order = [top[0], rnd[0], rnd[1], top[1], rnd[2], rnd[3], top[2], rnd[4], rnd[5], rnd[6]];
    return order.filter(Boolean);
  }
  // 첫 화면 제목 (2026-10-29 '같은 명품, 가장 싸게 사는 나라'). 휴대폰은 상품 장마다 사진 위에 넣어 넘길 때 같이 넘어감 — 이벤트 배너 장에는 없음
  const heroTopHTML = (first = true) => `<p class="eyebrow">The Real Price · 16 Countries</p>
        <h1${first ? "" : ' aria-hidden="true"'}>같은 명품, <em>가장 싸게</em> 사는 나라</h1>
        <p class="hchk"><span>✓ 환급</span><span>✓ 카드 수수료</span><span>✓ 관세</span><b>까지 넣은 진짜 가격</b></p>`;
  function featHTML(i) {
    const o = heroList[i % Math.max(1, heroList.length)];
    if (!o) return "";
    const p = o.p, R = o.R;
    // 사진을 크게 + 절약률을 사진 위 큰 숫자로 (첫인상, 2026-10-26). '30% · 한국보다 싸요' + 사진 위 국기·나라 이름 (2026-10-29)
    const cc = R.best.cc, cheaper = R.save > 0;
    return `<a class="feat" href="${link(p)}" data-brand="${esc(bk(p.b))}"><div class="fimg">${isM() ? `<div class="htop">${heroTopHTML(i === 0)}</div>` : ""}${photo(p, "big")}<span class="fpct">${cheaper ? Math.round(R.save * 100) + "%" : pct(R.save)}<small>${krLab(R)}보다${cheaper ? " 이득" : ""}</small></span>
      <span class="fcc">${flag(cc)}${esc(C[cc].n)}</span></div>
      <div class="ftx"><p class="eyebrow">${esc(o.lab || (R.mode === "trip" ? "내 여행지에서 가장 싸게 사는 제품" : "이번 주 가장 싸게 사는 제품"))}</p>
        <div class="br">${esc(p.b)}</div><div class="fname">${esc(p.n)}</div>
        <div class="fsave">${esc(C[R.best.cc].n)}에서 사면 <b>${won(savedAmt(R))}</b> 아껴요</div>
        <div class="fsub">${krLab(R)} ${won(R.kr.net)} → ${esc(C[R.best.cc].n)} ${JINGA} ${won(R.best.net)} · 관세 포함</div></div></a>`;
  }
  // 대표 제품 넘김 (2026-10-28, 모바일에서 2px 점을 누르기 힘들던 것): 손가락으로 밀어 넘기는 가로 칸(scroll-snap) + 큰 이전·다음 단추 + '3 / 10'.
  // 사용자가 만지거나 단추를 누르면 자동 넘김을 20초 멈춤
  let heroHold = 0;
  // 이벤트 묶음 페이지 배너 (sheets/config/events.json pages[].banner): 제품 10장 뒤 11·12번째… 노출 기간 안에만 (2026-10-29)
  let heroBanners = [];
  const heroCount = () => heroList.length + heroBanners.length;
  // 배너 그림: 웹은 data/ 주소 그대로, 앱은 서명 목록의 sha256 을 확인한 뒤(LUXDATA.img) 넣음
  const evImg = (b, cls) => b && b.image ? `<img class="${cls}" data-evimg="${esc(b.image)}" alt="${esc(b.alt || "")}" decoding="async">` : "";
  const evImgFill = () => document.querySelectorAll("img[data-evimg]:not([src])").forEach(im => {
    const n = im.dataset.evimg;
    (window.LUXDATA && LUXDATA.img ? LUXDATA.img(n) : Promise.resolve("data/" + n)).then(u => { im.src = u; }).catch(() => im.remove());
  });
  const bannerHTML = pg => `<a class="feat fban${pg.banner.image ? " hasimg" : ""}" href="#/events/${esc(pg.id)}">${evImg(pg.banner, "fbimg")}<div class="fbin">
      ${pg.banner.eyebrow ? `<p class="eyebrow">${esc(pg.banner.eyebrow)}</p>` : ""}<h2>${esc(pg.banner.title)}</h2>
      ${pg.banner.text ? `<p class="fbt">${esc(pg.banner.text)}</p>` : ""}<span class="fbcta">${esc(pg.banner.cta || "자세히 보기")} ›</span>
      <p class="fbwhen">${evDate(pg.until)}까지</p></div></a>`;
  function heroHTML() {
    heroBanners = livePages().filter(pg => pg.banner).slice(0, 3);
    const n = heroCount();
    return `<div class="htrack" id="hTrack" aria-roledescription="carousel" aria-label="이번 주 싸게 사는 제품">${heroList.map((_, j) =>
      `<div class="hslide" role="group" aria-roledescription="slide" aria-label="${j + 1} / ${n}">${featHTML(j)}</div>`).join("")}${heroBanners.map((pg, j) =>
      `<div class="hslide" role="group" aria-roledescription="slide" aria-label="${heroList.length + j + 1} / ${n} 이벤트">${bannerHTML(pg)}</div>`).join("")}</div>
      ${n > 1 ? `<div class="hctl"><button type="button" class="hbtn" data-hnav="-1" aria-label="이전 제품"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg></button>
        <span class="hcount" aria-live="polite"><b id="hNow">${heroIdx % n + 1}</b> / ${n}</span>
        <span class="hbar"><i id="hBar" style="width:${(heroIdx % n + 1) / n * 100}%"></i></span>
        <button type="button" class="hbtn" data-hnav="1" aria-label="다음 제품"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg></button></div>` : ""}`;
  }
  function heroMark() {
    const n = Math.max(1, heroCount()), a = document.getElementById("hNow"), b = document.getElementById("hBar");
    if (a) a.textContent = heroIdx % n + 1;
    if (b) b.style.width = (heroIdx % n + 1) / n * 100 + "%";
  }
  function heroGo(i, smooth) {
    const tr = document.getElementById("hTrack"), n = heroCount();
    if (!tr || !n) return;
    heroIdx = (i + n) % n;
    tr.scrollTo({ left: heroIdx * tr.clientWidth, behavior: smooth && !reduced() ? "smooth" : "auto" });
    heroMark();
  }
  function heroInit() {
    const tr = document.getElementById("hTrack");
    if (!tr || tr.dataset.ready) return;
    tr.dataset.ready = "1";
    // 휴대폰: 사진 위에 겹친 문구의 실제 높이 → --hth (휴대폰 글자 크기를 키우면 문구가 두 줄이 되어 할인율과 겹치던 것, 2026-10-29)
    const tops = [...document.querySelectorAll(".hero.hm .htop")], top = tops[0], hm = document.querySelector(".hero.hm");
    if (top) {
      // 제목·확인 줄은 한 줄씩(style.css nowrap) — 휴대폰 글자 크기를 키워 넘치면 그 줄만 글자를 줄여 폭에 맞춤
      // 안드로이드 앱은 시스템 글자 크기(textZoom)를 넣은 값에 한 번 더 곱함 → 읽은 크기로 계산하면 다시 커져 계속 넘침(10-29 휴대폰).
      // 그래서 '넣은 값 × (폭 ÷ 실제 폭)'으로만 줄임 — 곱해지는 배율과 상관없이 맞음
      const fit = el => { if (!el) return; el.style.fontSize = "";
        if (el.scrollWidth <= el.clientWidth + 1) return;
        let fs = parseFloat(getComputedStyle(el).fontSize);
        for (let i = 0; i < 6; i++) {
          el.style.fontSize = fs + "px";
          const w = el.clientWidth, sw = el.scrollWidth;
          if (sw <= w + 1) break;
          fs = Math.floor(fs * w / sw * 0.98 * 10) / 10;
        } };
      const set = () => { if (!top.isConnected) return; const h = top.querySelector("h1"), c = top.querySelector(".hchk"); fit(h); fit(c);
        tops.slice(1).forEach(x => { x.querySelector("h1").style.fontSize = h.style.fontSize; x.querySelector(".hchk").style.fontSize = c.style.fontSize; });  // 장마다 같은 글이라 첫 장 값을 그대로
        hm.style.setProperty("--hth", Math.ceil(top.offsetHeight) + "px");
        // 사진 높이 = 화면에 남은 높이 (10-30 사용자: 상품 이름·넘김 단추까지 한 화면에) — 상태 표시줄·안내 띠·글자 크기를 실제로 재서
        const f = hm.querySelector(".hslide .feat"), ctl = hm.querySelector(".hctl"), bar = document.getElementById("bottombar");
        if (f && ctl) {
          const barH = bar && getComputedStyle(bar).display !== "none" ? bar.offsetHeight : 0;
          const avail = innerHeight - (hm.getBoundingClientRect().top + scrollY) - top.offsetHeight - f.querySelector(".ftx").offsetHeight - ctl.offsetHeight - barH - 8;
          hm.style.setProperty("--php", Math.round(Math.max(170, Math.min(460, avail))) + "px");
        } };
      set();
      if (window.ResizeObserver) new ResizeObserver(set).observe(top);
      // 글꼴(제목 명조)이 늦게 내려오면 폭이 넓어지는데 상자 크기는 그대로라 위 관찰로는 못 잡음 → 글꼴을 다 받은 뒤·잠시 뒤에 다시 맞춤 (10-29 휴대폰에서 제목이 잘리던 것)
      if (document.fonts) { document.fonts.ready.then(set); document.fonts.addEventListener && document.fonts.addEventListener("loadingdone", set); }
      [300, 1500].forEach(ms => setTimeout(set, ms));
      addEventListener("resize", () => setTimeout(set, 100));
    }
    evImgFill();  // 배너 그림
    heroGo(heroIdx, false);  // 다시 그려도 보던 장에 머묾
    let t;
    tr.addEventListener("scroll", () => { clearTimeout(t); t = setTimeout(() => {
      const i = Math.round(tr.scrollLeft / Math.max(1, tr.clientWidth)); if (i !== heroIdx) { heroIdx = i; heroMark(); } }, 80); }, { passive: true });
    const hold = () => { heroHold = Date.now() + 20000; };
    ["pointerdown", "touchstart", "wheel", "focusin"].forEach(e => tr.addEventListener(e, hold, { passive: true }));
  }
  // 나라 순위 (③): 관세 포함 진가로 '한국보다 싼 제품 수 × 중간 절약률'
  function board() {
    // 관세를 넣으면 전체 중간 절약률은 대부분 마이너스라서, 한국보다 싼 제품만의 중간 절약률을 쓴다
    return TRIP_CODES.map(c => ({ c, ...countryStats(c) })).filter(o => o.cheaper > 0)
      .map(o => ({ ...o, score: o.cheaper * o.medCheap })).sort((a, b) => b.score - a.score);
  }
  // 아이콘 제품 (②): 브랜드마다 제품 수가 가장 많은 컬렉션에서 한국 가격이 중간인 제품 (인기 순위 데이터가 오면 그 1위로)
  // ② 아이콘 제품 가격표 (2026-10-27 개편): 관리할 목록 없이 '컬렉션'을 열 때마다 무작위로, 진짜가격 500만원 이하 입문 제품을 한 줄씩
  //  - 컬렉션 후보: 제품 5개 이상, 이름 없음·'기타' 제외 / 브랜드를 먼저 고르고(공평) 그 안에서 컬렉션 / 한 번에 같은 브랜드 1개
  //  - 최근에 본 컬렉션은 덜 뽑힘(휴대폰에 기억) / 내 여행지가 있으면 그 나라에서 아끼는 컬렉션을 더 자주
  //  - 컬렉션 안: 500만 이하 중 가장 싼 제품(입문가). 주얼리는 종류(반지·목걸이·팔찌·귀걸이·시계)가 겹치지 않게, 패션은 가방 먼저·지갑은 2줄까지
  const ICON_CAP = 5_000_000, ICON_MIN = 5;
  let iconPick = null;  // 고른 결과는 다시 섞기 전까지 유지(다른 화면 갔다 와도 같음), 가격은 그릴 때마다 지금 설정으로
  const iconSeenKey = () => KEY("iconSeen");
  function icons() {
    if (iconPick) return iconPick.map(k => { const it = items().find(x => x.key === k.key); return it ? { it, p: head(it), R: itemRep(it), col: k.col } : null; }).filter(Boolean);
    const okType = t => kind !== "bag" || t === "bag" || t === "wallet";
    const byCol = {};
    for (const it of items()) {
      const p = head(it), c = colName(p.c).trim();
      if (!c || c === "기타" || /^other/i.test(c)) continue;
      const k = p.b + "|" + p.c;
      (byCol[k] = byCol[k] || { b: p.b, c: p.c, n: 0, cand: [] }).n++;
      const R = itemRep(it);
      if (okType(p.t) && p.img && clean(R) && R.best.net <= ICON_CAP) byCol[k].cand.push({ it, p, R });
    }
    const seen = store.get(iconSeenKey(), []);
    const byBrand = {};
    for (const [k, v] of Object.entries(byCol)) {
      if (v.n < ICON_MIN || !v.cand.length) continue;
      v.cand.sort((a, b) => a.R.best.net - b.R.best.net);
      const tripWin = S.trip.length && v.cand.some(o => o.R.mode === "trip" && o.R.save > 0);
      v.w = (seen.includes(k) ? 0.15 : 1) * (tripWin ? 2 : 1) * Math.sqrt(v.n);  // 제품이 많은 컬렉션(대표 라인)일수록 조금 더
      (byBrand[v.b] = byBrand[v.b] || []).push([k, v]);
    }
    const pickW = arr => { let t = arr.reduce((s, [, v]) => s + v.w, 0) * Math.random(); for (const x of arr) { t -= x[1].w; if (t <= 0) return x; } return arr[arr.length - 1]; };
    const brands = Object.keys(byBrand).sort(() => Math.random() - 0.5);
    const n = 8 + 3, out = [], types = new Set();  // 8개(휴대폰 2개×4줄, PC 4개×2줄) +3: 첫 화면 위쪽에 이미 나온 제품을 빼고도 채우려고
    let wallets = 0;
    for (const b of brands) {
      if (out.length >= n) break;
      const cols = [...byBrand[b]];
      while (cols.length) {
        const x = pickW(cols); cols.splice(cols.indexOf(x), 1);
        const [k, v] = x;
        let o;
        if (kind === "bag") {
          o = v.cand.find(c => c.p.t === "bag") || (wallets < 2 ? v.cand.find(c => c.p.t === "wallet") : null);
          if (o && o.p.t === "wallet") wallets++;
        } else {
          o = v.cand.find(c => !types.has(c.p.t)) || v.cand[0];
        }
        if (!o) continue;
        types.add(o.p.t);
        out.push({ ...o, col: k });
        break;
      }
    }
    iconPick = out.map(o => ({ key: o.it.key, col: o.col }));
    store.set(iconSeenKey(), [...out.map(o => o.col), ...seen.filter(k => !out.some(o => o.col === k))].slice(0, 40));
    return out;
  }
  // 카드 아래 한 줄: 컬렉션 · 이 컬렉션 500만 이하 N개(찾기 화면과 같은 개수) · 지난 수집 대비 ▲▼
  function iconExtra(o) {
    const p = o.p, R = o.R, colQ = `#/search?brand=${encodeURIComponent(p.b)}&c=${encodeURIComponent(p.c)}&pmax=${ICON_CAP}`;
    const F = filterState(new URLSearchParams(colQ.split("?")[1]));
    const cnt = items().filter(it => test({ it, p: head(it), R: itemRep(it) }, F)).length;
    const ch = D.changes.find(c => c.b === p.b && c.s === p.s && c.cc === (R.best && R.best.cc)) || D.changes.find(c => c.b === p.b && c.s === p.s && c.cc === "KR");
    const chg = ch && Math.abs(ch.r) >= 0.01 ? `<span class="ichg ${ch.r > 0 ? "up" : "dn"}" title="${esc(C[ch.cc].n)} 지난 수집 대비">${esc(C[ch.cc].n)} ${ch.r > 0 ? "▲" : "▼"}${Math.abs(Math.round(ch.r * 100))}%</span>` : "";
    return `<div class="icol"><a class="imore" href="${esc(colQ)}"><span class="icn">${esc(colName(p.c))}</span><span>${man(ICON_CAP)} 이하 ${cnt}개 ›</span></a>${chg}</div>`;
  }
  function ibars(o) {
    const p = o.p, R = o.R, rs = rows(p).filter(r => r.cc !== "KR" && r.t > 0 && r.v).sort((a, b) => a.net - b.net);
    const mine = rs.filter(r => S.trip.includes(r.cc)), top = (mine.length ? [...mine, ...rs.filter(r => !S.trip.includes(r.cc))] : rs).slice(0, 3);
    const lines = [...top, R.kr], mx = Math.max(...lines.map(r => r.net));
    return `<ul class="ibars">${lines.map(r => `<li class="${r.cc === "KR" ? "kr" : r === R.best ? "top" : ""}"><span>${cc(r.cc)} ${esc(C[r.cc].n)}</span><span class="bar"><i style="width:${r.net / mx * 100}%"></i></span><b>${man(r.net)}</b></li>`).join("")}</ul>`;
  }
  let iconsAll = false, colAll = false;
  function iconCard(o) {
    const p = o.p, R = o.R;
    const col = colName(p.c);
    return `<article class="icard" data-brand="${esc(bk(p.b))}"><a class="hit" href="${link(p)}" aria-label="${esc(p.n)}"></a>
      <div class="pw">${photo(p)}</div>
      <div class="body"><div class="br">${esc(p.b)}${col && kind === "jewelry" ? ` · <a class="colink" href="#/brand/${encodeURIComponent(p.b)}?c=${encodeURIComponent(p.c)}">${esc(col)}</a>` : ""}</div>
        <div class="nm">${esc(p.n)}</div>
        ${ibars(o)}
        ${savedAmt(R) ? `<div class="saved" style="margin-top:12px">${man(savedAmt(R))} 아낌 (${pct(R.save)})</div>` : ""}</div></article>`;
  }
  // 예시 계산 (⑦): 같은 값 두 개를 따로 계산한 관세 합 vs 실제(합계에서 $800 한 번만)
  function twoItems(each) { const g = kind === "bag" ? "watchbag" : "jewel"; return { split: customs(each, g) * 2, real: customs(each * 2, g) }; }

  // 여러 개를 한 나라에서 사는 합계 (5.7절 ①b·⑥b). 관세는 합계에서 $800를 한 번만 뺀다 — ⑦ '면세는 한 번만'과 같은 시안용 간이 방식
  // 정식 버전은 7장 규칙(제품마다 1,000만원 일반 과세 판단)으로 계산
  function basket(ps, cc) {
    let net = 0, simpleBase = 0, duty = 0;
    const g = ps.some(q => grpOf(q) === "watchbag") ? "watchbag" : "jewel";
    for (const p of ps) {
      const r = rows(p).find(x => x.cc === cc);
      if (!r || !r.v || (cc !== "KR" && r.t !== 1)) return null;  // 한 개라도 못 사면 그 나라는 뺌
      if (cc === "KR") { net += r.net; continue; }
      net += r.net - r.duty;
      const b = r.krw - r.refund;
      if (b <= CUS.simpleMax) simpleBase += b; else duty += customs(b, g);  // 1,000만원 넘는 한 개는 그 제품만 일반 과세
    }
    // 1,000만원 이하 제품들은 합계에 간이세율, $800는 한 번만
    return cc === "KR" ? net : net + duty + (simpleBase ? customs(simpleBase, g, false, true) : 0);
  }
  // ①b 내 쇼핑 계산: 담은 제품(없으면 아이콘 3개 예시)을 내 여행지(없으면 16개 나라)에서 한 번에 살 때
  function shopCalc() {
    const mine = S.picks.map(k => { const i = k.indexOf("|"); return findP(k.slice(0, i), k.slice(i + 1)); }).filter(Boolean);
    // 담은 게 없으면 예시: 한국 50만~200만원 제품 중 많이 아끼는 것, 브랜드 하나씩 3개 (선물·첫 구매 규모)
    const ex = [], seen = new Set();
    if (!mine.length) for (const o of pool().filter(o => o.R.kr.net >= 5e5 && o.R.kr.net <= 2e6).sort((a, b) => savedAmt(b.R) - savedAmt(a.R)))
      if (ex.length < 3 && !seen.has(o.p.b)) { seen.add(o.p.b); ex.push(o.p); }
    const sample = !mine.length, ps = sample ? ex : mine.slice(0, 10);
    if (!ps.length) return "";
    const kr = basket(ps, "KR");
    const cands = (S.trip.length ? S.trip : TRIP_CODES).map(c => ({ c, net: basket(ps, c) })).filter(o => o.net !== null).sort((a, b) => a.net - b.net);
    const best = cands[0], save = best && kr ? kr - best.net : 0;
    // 합계 때문에 관세가 느는 경우 알림: 따로 계산한 진가 합 vs 함께 산 진가
    const bRows = best ? ps.map(p => rows(p).find(x => x.cc === best.c)) : [];
    const apart = bRows.reduce((n, r) => n + r.net, 0), extra = best ? best.net - apart : 0;
    const g = ps.some(q => grpOf(q) === "watchbag") ? "watchbag" : "jewel", thr = CUS.grp[g].thr;
    const taxable = bRows.reduce((n, r) => n + r.krw - r.refund, 0) - CUS.allowUsd * D.fx.US;
    const why = taxable > thr ? `합계(환급 후 − $800)가 ${man(thr)}을 넘는 부분은 45%예요` : "$800 면세는 산 물건 전체에서 한 번만 빠져요";
    const head = !kr ? "한국 가격이 없는 제품이 있어요"
      : !best ? (S.trip.length ? "내 여행지에서는 이 제품들을 다 살 수 없어요" : "이 제품들을 모두 파는 나라가 없어요")
      : save > 0 ? `${nationF(best.c)}에서 ${ps.length}개 사면 <b>${won(save)}</b> 아껴요`
      : `한국에서 사는 게 ${won(-save)} 싸요`;
    const lines = [...cands.slice(0, 3), ...(kr ? [{ c: "KR", net: kr }] : [])];
    const mx = Math.max(...lines.map(o => o.net));
    return `<section class="sec shop" id="h-calc">${section("Your Basket", "내 쇼핑 계산", "", sample ? `<a class="link" href="#/search">제품 찾아 담기</a>` : `<a class="link" href="#/picks">담은 목록</a>`)}
      <div class="shopbox">
        <div class="shopits">${ps.slice(0, 5).map(p => `<a href="${link(p)}" title="${esc(p.n)}" data-brand="${esc(bk(p.b))}">${photo(p)}</a>`).join("")}${ps.length > 5 ? `<span class="more">+${ps.length - 5}</span>` : ""}</div>
        <p class="shopnote">${sample ? "예시 · 많이 아끼는 제품 3개 — ♡로 담으면 내 제품으로 계산해요" : `담은 제품 ${ps.length}개`} · ${S.trip.length ? "내 여행지 기준" : "16개 나라 중"}</p>
        <div class="shophead">${head}</div>
        ${kr && best ? `<ul class="ibars shopbars">${lines.map(o => `<li class="${o.c === "KR" ? "kr" : o === best ? "top" : ""}"><span>${cc(o.c)} ${esc(C[o.c].n)}</span><span class="bar"><i style="width:${o.net / mx * 100}%"></i></span><b>${man(o.net)}</b></li>`).join("")}</ul>` : ""}
        ${extra >= 1e4 ? `<p class="shopwarn">하나씩 볼 때보다 관세가 <b>${won(extra)}</b> 늘어요 — ${why}</p>` : ""}
        <p class="shopfoot">합계 ${JINGA} · 관세는 산 물건 전체에서 $800를 한 번만 빼요${S.trip.length ? "" : ` · <button type="button" class="link" data-trip-open>내 여행지로 계산</button>`}</p>
      </div></section>`;
  }
  // ⑥b 예물: 웨딩 밴드를 '한 쌍(2개)' 진가로 — 솔리테어는 캐럿마다 값이 달라 뺌(11.2절)
  const BRIDAL = ["밴드", "이터니티"];
  function bridal() {
    if (kind !== "jewelry") return "";
    const pair = p => {
      const kr = basket([p, p], "KR");
      const cs = (S.trip.length ? S.trip : TRIP_CODES).map(c => ({ c, net: basket([p, p], c) })).filter(o => o.net !== null).sort((a, b) => a.net - b.net);
      return kr && cs[0] && cs[0].net < kr ? { kr, best: cs[0], save: kr - cs[0].net } : null;
    };
    const all = items().map(it => ({ it, p: head(it), R: itemRep(it) }))
      .filter(o => o.p.t === "ring" && BRIDAL.includes(o.p.sb) && o.p.img && clean(o.R))
      .map(o => ({ ...o, pr: pair(o.p) })).filter(o => o.pr)
      .sort((a, b) => b.pr.save / b.pr.kr - a.pr.save / a.pr.kr);
    const seen = new Set(), pick = [];  // 브랜드마다 하나씩 먼저
    for (const o of all) if (!seen.has(o.p.b)) { seen.add(o.p.b); pick.push(o); }
    for (const o of all) if (!pick.includes(o)) pick.push(o);
    const show = pick.slice(0, isM() ? 4 : 8);
    if (!show.length) return "";
    return `<section class="sec" id="h-bridal">${section("Bridal", "예물 반지", "웨딩 밴드 한 쌍(2개)을 살 때 — 관세도 2개 합계로", `<a class="link" href="#/search?type=ring&sub=${encodeURIComponent("밴드")}&pmax=all">예물 모두 보기</a>`)}
      <div class="grid">${show.map(o => card(o.it, `<div class="pair">한 쌍 ${cc(o.pr.best.c)} <b>${man(o.pr.best.net)}</b> · 한국 ${man(o.pr.kr)} · <span class="saved">${man(o.pr.save)} 아낌</span></div>`)).join("")}</div></section>`;
  }
  // ④ 비행기값 뽑는 제품 — 고른 결과는 '↻'를 누르거나 내 여행지를 바꾸기 전까지 유지(다른 화면 갔다 와도 같음)
  let flightSel = null;
  function flightSection(used) {
    const n = isM() ? 4 : 8, sig = S.trip.join(",");
    const ok = o => o.p.img && clean(o.R) && savedAmt(o.R) >= SAVE_MIN && !used.has(o.it.key);
    const candIn = c => {  // c 가 있으면 그 나라 기준(AT), 없으면 내 여행지 기준
      const keep = AT; AT = c || null;
      const out = items().map(it => ({ it, p: head(it), R: itemRep(it) })).filter(o => ok(o) && (!c ? o.R.mode === "trip" : o.R.best.cc === c));
      AT = keep; return out;
    };
    if (!flightSel || flightSel.sig !== sig) {
      let c = null, cand = [];
      if (S.trip.length) cand = candIn(null);
      else for (const x of [...TRIP_CODES].sort(() => Math.random() - 0.5)) { const cs = candIn(x); if (cs.length >= n) { c = x; cand = cs; break; } if (cs.length > cand.length) { c = x; cand = cs; } }
      // 무작위로 섞고 브랜드가 겹치지 않게 먼저, 모자라면 같은 브랜드도
      cand.sort(() => Math.random() - 0.5);
      const pick = [], seenB = new Set();
      for (const o of cand) if (pick.length < n && !seenB.has(o.p.b)) { seenB.add(o.p.b); pick.push(o); }
      for (const o of cand) if (pick.length < n && !pick.includes(o)) pick.push(o);
      flightSel = { sig, c, keys: pick.map(o => o.it.key) };
    }
    const c = flightSel.c, its = flightSel.keys.map(k => items().find(it => it.key === k)).filter(Boolean);
    its.forEach(it => used.add(it.key));
    const keep = AT; AT = c;  // 카드 가격도 그 나라 기준
    const where = S.trip.length ? `내 여행지(${S.trip.map(x => esc(C[x].n)).join("·")})` : `${flag(c || "JP")}${esc(C[c || "JP"].n)}`;
    const body = its.length ? listOrGrid(its) : `<p class="empty">지금은 ${S.trip.length ? "내 여행지에서" : "이 나라에서"} ${man(SAVE_MIN)} 넘게 아끼는 제품이 없어요.</p>`;
    AT = keep;
    return `<section class="sec" id="h-flight">${section("Worth the Flight", `${where}에서 비행기값 뽑는 제품`,
        `관세까지 넣고도 ${man(SAVE_MIN)} 넘게 아끼는 제품 · ${S.trip.length ? "고른 나라 안에서" : "나라를"} 열 때마다 바꿔 보여 줘요`,
        `<span class="shlinks"><button type="button" class="link" data-flightshuffle>↻ ${S.trip.length ? "다시 뽑기" : "다른 나라"}</button>${c ? ` <a class="link" href="#/country/${c}">${esc(C[c].n)} 모두 보기</a>` : ""}</span>`)}
      ${body}</section>`;
  }
  function home() {
    const used = new Set(), P = pool();
    const take = (arr, n) => { const out = []; for (const o of arr) { if (out.length >= n) break; if (!used.has(o.it.key)) { used.add(o.it.key); out.push(o); } } return out; };
    const brd = board();
    // 첫 화면 추천은 절약률 순 (2026-10-26, 목록 기본 정렬과 같게). 같으면 절약 금액 큰 것 먼저
    const byRate = (a, b) => (b.R.save ?? -9) - (a.R.save ?? -9) || savedAmt(b.R) - savedAmt(a.R);
    // ① 히어로
    heroList = heroPick(P, byRate, take, used);
    // 휴대폰 (2026-10-29): 제목('같은 명품, 가장 싸게 사는 나라' — 10-29 사용자: 고급스럽고 직접적으로)과 대표 제품 카드가 한 화면에 — 찾기 칸·칩은 카드 아래로
    const heroRest = `<form class="hsearch" data-search role="search"><input name="q" placeholder="${isM() ? `예: ${HINT[kind]}` : `브랜드 · 제품 이름 · 예산 — 예: ${HINT[kind]}`}" aria-label="브랜드, 제품 이름, 예산으로 찾기" autocomplete="off"><button type="submit" aria-label="찾기"><svg><use href="#i-search"/></svg></button></form>
        ${templates()}
        <div class="hchips"><span>어디로 가세요?</span>${brd.slice(0, 5).map(o => `<button type="button" class="tchip ${S.trip.includes(o.c) ? "on" : ""}" data-trip="${o.c}">${nationF(o.c)}</button>`).join("")}</div>`;
    const heroFeat = `<div class="herofeat" id="heroFeat">${heroHTML()}</div>`;
    let html = isM()
      ? `<section class="hero hm">${heroFeat}<div class="herotx hrest">${heroRest}</div></section>`
      : `<section class="hero"><div class="herotx">${heroTopHTML()}${heroRest}</div>${heroFeat}</section>`;
    setTimeout(heroInit, 0);
    // ①a 믿음 띠: 어디서 · 몇 개 · 언제 · 무엇을 넣었는지 (5.7절)
    html += `<div class="trust"><span>${TRIP_CODES.length + 1}개국 공식 홈페이지</span><span>${kind === "bag" ? "패션" : "주얼리"} ${list().length.toLocaleString("ko-KR")}개</span><span>${esc(D.generated.slice(5).replace("-", "."))} 수집</span><span>환급 · 카드 수수료 · 관세 포함</span><a class="link" href="#/settings">계산 방법</a></div>`;
    html += evStrip(liveEvents(), "#/events");  // 진행 중인 이벤트 (2026-10-29)
    // 모바일: 구역 바로 가기 칩 (5M.12절)
    if (isM()) html += `<nav class="jump" aria-label="바로 가기">${[["h-calc", "내 쇼핑"], ["h-icons", "아이콘"], ["h-where", S.trip.length ? "내 여행지" : "나라 순위"], ["h-flight", "비행기값"], ["h-price", "가격 변동"], ["h-gift", "선물"], ...(kind === "jewelry" ? [["h-bridal", "예물"]] : []), ["h-good", "알아 두면"], ["h-bq", "브랜드"]]
      .map(([id, l]) => `<button type="button" class="tchip sm" data-jump="${id}">${l}</button>`).join("")}</nav>`;
    html += brandQuick();
    html += onboardCard();
    // ①b 내 쇼핑 계산 (휴대폰은 아래 '더 보기' 안으로)
    const calcHtml = shopCalc();
    if (!isM()) html += calcHtml;
    // ② 아이콘 제품 가격표
    const ic = icons().filter(o => !used.has(o.it.key)).slice(0, isM() ? 4 : 8); ic.forEach(o => used.add(o.it.key));
    if (ic.length) html += `<section class="sec" id="h-icons">${section("The Icons", "아이콘 제품 가격표", `브랜드 컬렉션을 ${man(ICON_CAP)} 이하 입문 제품으로 — 나라별 ${JINGA}, 열 때마다 바뀌어요`,
        `<button type="button" class="link" data-iconshuffle>↻ 다른 컬렉션</button>`)}
      <div class="grid icong2">${ic.map(o => card(o.it, iconExtra(o))).join("")}</div></section>`;
    // ③ 지금 유리한 나라 / 내 여행지 추천
    if (!S.trip.length) {
      html += `<section class="sec" id="h-where">${section("Where to Buy", "지금 유리한 나라", "관세까지 넣고 한국보다 싼 제품이 많고, 많이 아끼는 순서", `<a class="link" href="#/country">모든 나라</a>`)}
        ${isM() ? `<ol class="rank">${brd.slice(0, 5).map((o, i) => `<li><a class="hit" href="#/country/${o.c}" aria-label="${esc(C[o.c].n)}"></a><span class="rk">${i + 1}</span><span class="nn">${nationF(o.c)}</span>
            <span class="rv"><b>${o.cheaper}</b>개 쌈 · 중간 ${pct(o.medCheap)}</span><button type="button" class="tchip sm" data-trip="${o.c}" aria-label="${esc(C[o.c].n)} 내 여행지로">✈</button></li>`).join("")}</ol>`
        : `<div class="board">${brd.slice(0, 5).map((o, i) => {
          const ths = P.filter(x => rep(x.p, []).best?.cc === o.c && x.p.img).map(x => ({ ...x, R: rep(x.p, []) })).sort(byRate).slice(0, 3);
          return `<div class="ncell"><a class="hit" href="#/country/${o.c}" aria-label="${esc(C[o.c].n)}"></a>
            <span class="rk">No. ${i + 1}</span><span class="nn">${nationF(o.c)}</span>
            <span class="big">${o.cheaper}<small>한국보다 싼 제품 · 그 제품들은 중간 ${pct(o.medCheap)}</small></span>
            <div class="thumbs" data-brand="">${ths.map(x => photo(x.p)).join("")}</div>
            <button type="button" class="tchip sm" data-trip="${o.c}">✈ 내 여행지로</button></div>`;
        }).join("")}</div>`}</section>`;
    } else {
      const t = S.trip[tripTab % S.trip.length];
      const mine = P.filter(o => o.R.best.cc === t).sort(byRate);
      html += `<section class="sec" id="h-where">${section("Your Journey", "내 여행지 추천", "내 여행지 중 이 나라가 가장 싼 제품, 절약률 높은 순서", `<button type="button" class="link" data-trip-open>여행지 바꾸기</button>`)}
        <div class="tabs">${S.trip.map((c, i) => `<button type="button" class="tab ${c === t ? "on" : ""}" data-triptab="${i}">${nationF(c)}</button>`).join("")}</div>
        ${mine.length ? listOrGrid(take(mine, isM() ? 4 : 8).map(o => o.it)) : `<p class="empty">이 나라는 한국보다 싼 제품이 없어요. <a class="link" href="#/country/${t}?tab=kr">한국이 더 싼 제품</a></p>`}
        <div class="center"><a class="more" href="#/country/${t}">${esc(C[t].n)} 모두 보기</a></div></section>`;
    }
    // ④ 비행기값 뽑는 제품 (2026-10-27): 열 때마다 무작위 — 내 여행지가 없으면 나라 하나를 무작위로 골라 그 나라에서,
    //    내 여행지가 있으면 고른 나라들 안에서. 관세까지 넣고 50만원 넘게 아끼는 제품 중 브랜드가 겹치지 않게
    html += flightSection(used);
    const cut = html.length;  // 휴대폰: 여기부터 아래는 '더 보기'로 접음 (첫 화면이 6,000px 넘던 것, 2026-10-28)
    // ⑤ 한국 가격이 바뀌었어요 (한국 먼저, 해외는 ±3% 이상)
    const ch = [...D.changes.filter(c => c.cc === "KR"), ...D.changes.filter(c => c.cc !== "KR" && Math.abs(c.r) >= 0.03).sort((a, b) => a.r - b.r)];
    const chCards = [];
    for (const c of ch) {
      const p = findP(c.b, c.s); if (!p) continue;
      const it = itemOf(p); if (used.has(it.key)) continue; used.add(it.key);
      const amt = (c.nw - c.o) * D.fx[c.cc];
      const chg = `<div class="chg ${c.r < 0 ? "down" : "up"}">${c.r < 0 ? "▼" : "▲"} ${cc(c.cc)} ${esc(C[c.cc].n)} ${c.r > 0 ? "+" : "−"}${Math.abs(c.r * 100).toFixed(1)}% (${c.r > 0 ? "+" : "−"}${man(Math.abs(amt))})</div>`;
      chCards.push(card(it, chg));
      if (chCards.length >= 4) break;
    }
    if (chCards.length) html += `<section class="sec" id="h-price">${section("Price Watch", "가격이 바뀌었어요", "한국 가격 변동을 먼저, 해외는 3% 넘게 바뀐 것만", `<a class="link" href="#/changes">모두 보기</a>`)}
      <div class="grid">${chCards.join("")}</div></section>`;
    // ⑥ 선물 예산별
    const G = GIFT[kind], [, lo, hi] = G[budgetIdx];
    const gifts = take(P.filter(o => o.R.best.net >= lo && o.R.best.net < hi).sort(byRate), isM() ? 4 : 8);
    html += `<section class="sec" id="h-gift">${section("Gifting", "선물 예산별", `관세까지 넣은 ${JINGA} 기준`, "")}
      <div class="tabs">${G.map((x, i) => `<button type="button" class="tab ${i === budgetIdx ? "on" : ""}" data-budget="${i}">${x[0]}</button>`).join("")}</div>
      ${gifts.length ? listOrGrid(gifts.map(o => o.it)) : `<p class="empty">이 구간에는 한국보다 싼 제품이 없어요.</p>`}</section>`;
    // ⑥b 예물 (주얼리)
    html += bridal();
    // ⑦ 알아 두면 이득 (데이터로 계산)
    const two = twoItems(3_000_000);
    const refundTop = TRIP_CODES.filter(c => C[c].refund).sort((a, b) => C[b].refund - C[a].refund)[0];
    let wall;
    if (kind === "jewelry") {
      const over = items().map(it => itemRep(it)).filter(R => R.kr && R.kr.net > 1e7 && R.best);
      const krWins = over.filter(R => R.save <= 0).length;
      wall = { eb: "The 10M Line", num: `${over.length ? Math.round(krWins / over.length * 100) : 0}%`, t: "1,000만원의 벽",
        body: `한 개 가격(환급 후)이 1,000만원을 넘으면 간이세율 대신 일반 과세(관세·개별소비세·교육세·부가세)예요. 한국 가격 1,000만원 넘는 제품 ${over.length}개 중 ${krWins}개는 한국이 더 싸요.` };
    } else {
      const g = customs(5_000_000, "watchbag"), j = customs(5_000_000, "jewel");
      wall = { eb: "From 1.92M", num: "45%", t: "가방은 192만원부터 45%",
        body: `과세가격(환급 후 − $800)이 1,923,000원을 넘는 부분은 15%가 아니라 45%예요. 환급 후 500만원 가방의 관세는 약 ${man(g)} — 같은 값 보석(${man(j)})보다 많아요.` };
    }
    const facts = [wall,
      { eb: "Duty-free Once", num: `+${man(two.real - two.split)}`, t: "$800 면세는 한 번만",
        body: `면세 한도는 산 물건 전체에서 한 번만 빼요. 환급 후 300만원짜리 두 개를 사면 관세가 제품별 계산 합(${man(two.split)})보다 많은 약 ${man(two.real)}이에요. 담은 목록은 합계로 계산해요.`,
        more: `<a class="link" href="#/picks">담은 목록</a>` },
      { eb: "Best Refund", num: `${C[refundTop].refund}%`, t: `환급률 1위 · ${esc(C[refundTop].n)}`,
        body: `실효 환급률 약 ${C[refundTop].refund}%${C[refundTop].min ? `, 최소 구매 ${local(refundTop, C[refundTop].min)}` : ", 최소 구매 금액 없음"}. ${esc(C[refundTop].how)}`,
        more: `<a class="link" href="#/country/${refundTop}">${esc(C[refundTop].n)} 보기</a>` }];
    // 모바일: 가로 밀기 대신 접힌 제목 3줄 (누르면 펼침)
    html += `<section class="sec" id="h-good">${section("Good to Know", "알아 두면 이득", "", "")}${isM()
      ? `<div class="factl">${facts.map(f => `<details class="factd"><summary><span class="num">${f.num}</span><b>${f.t}</b></summary><p>${f.body}</p>${f.more || ""}</details>`).join("")}</div>`
      : `<div class="facts">${facts.map(f => `<div class="fact"><p class="eyebrow">${f.eb}</p><div class="num">${f.num}</div><h4>${f.t}</h4><p>${f.body}</p>${f.more || ""}</div>`).join("")}</div>`}</section>`;
    // ⑧ 브랜드 (PC: 브랜드 칸. 휴대폰은 위쪽 '브랜드로 찾기'로 대신)
    if (!isM()) html += `<section class="sec" id="h-brand">${section("Maisons", "브랜드", "", "")}<div class="brands">${brandTiles()}</div></section>`;
    if (isM()) {
      const tail = html.slice(cut);
      html = html.slice(0, cut) + (homeMore
        ? `<div class="hmore">${calcHtml}${tail}</div><div class="center"><button type="button" class="more" data-homemore="0">접기 ↑</button></div>`
        : `<div class="center hmorebtn"><button type="button" class="btn ghost wide" data-homemore="1">더 보기<small>내 쇼핑 계산 · 가격 변동 · 선물 · 알아 두면</small></button></div>`);
    }
    return html;
  }
  // 대표 제품 자동 넘김 (5초, 움직임 줄이기·마우스 올림·사용자가 만진 뒤 20초는 멈춤) — 가로 칸만 밀어서 입력 중인 검색어가 지워지지 않게
  setInterval(() => {
    const el = document.getElementById("heroFeat");
    if (!el || heroCount() < 2 || document.hidden || reduced() || el.matches(":hover") || Date.now() < heroHold) return;
    heroInit();
    heroGo(heroIdx + 1, true);
  }, 5000);
  function countryRank(ps) {
    const by = {};
    for (const p of ps) {
      const kr = rows(p).find(r => r.cc === "KR" && r.v); if (!kr) continue;
      for (const r of rows(p)) if (r.cc !== "KR" && r.t > 0 && r.v) (by[r.cc] = by[r.cc] || []).push((kr.net - r.net) / kr.net);
    }
    return Object.entries(by).filter(([, a]) => a.length >= Math.min(3, ps.length)).map(([c, a]) => ({ cc: c, m: median(a) })).sort((a, b) => b.m - a.m);
  }

  // ── 찾기·필터 판 (5.6a절): 검색창 → 빠른 칩 → 필터 더 보기 ──
  // 가격 범위 (진가 기준, 만원 단위로 움직임). 기본 0~400만, 막대 끝(2,000만)은 '제한 없음'
  const PR = { def: [0, Infinity], top: 2e7, step: 1e5 };  // 기본은 가격 제한 없음 (2026-10-27: 0~400만 기본값이 검색 결과를 크게 줄여 뺌)
  const SAVES = [["", "상관없음"], ["0", "한국보다 싼 것만"], ["10", "10% 이상"], ["20", "20% 이상"], ["30", "30% 이상"]];
  const SORTS = [["", "절약률 순"], ["amt", "절약 금액 순"], ["low", "진짜가격 낮은 순"], ["high", "진짜가격 높은 순"], ["new", "신상 순"], ["spread", "나라마다 가격 차이 큰 순"]];
  const isBag = () => kind === "bag";
  const stoneKey = () => isBag() ? "color" : "stone";
  const fMat = p => isBag() ? p.lt : p.mt;
  const fStone = p => isBag() ? p.colg : p.g;
  const matLabel = v => v === "골드(색상 미표기)" ? "골드(기타)" : v;
  const colName = c => { const m = /^(.*?)\s*\(([^)]*)\)\s*$/.exec(c || ""); return m && /[가-힣]/.test(m[2]) ? m[2].trim() : (c || "").replace(/\s*\(.*\)/, "").trim(); };  // 컬렉션은 한글 이름 먼저 (2026-10-27)
  const csv = (q, k) => (q.get(k) || "").split(",").filter(Boolean);
  const squash = s => (s || "").toLowerCase().replace(/[\s\-·]/g, "");
  const SYN = new Map(D.syn.map(([a, b]) => [squash(a), b.toLowerCase()]));
  const hayCache = new Map();
  function hay(p) {
    const k = p.b + "|" + p.s;
    if (!hayCache.has(k)) hayCache.set(k, [p.n, p.ne, p.b, D.brandKo[p.b], p.c, p.s, TYPE_ALL[p.t], p.sb, fMat(p), fStone(p), p.col].join(" ").toLowerCase());
    return hayCache.get(k);
  }
  // 단어 하나: 그대로 / 띄어쓰기·하이픈 무시 / 동의어(엑셀 '설정' 시트 표)로 찾는다
  // 띄어쓰기·하이픈 무시는 낱말 첫머리에서 시작할 때만 ('티스마일' → '티 스마일' O, '러브' → '컬러 브레이슬릿' X — 엑셀 '비교' 시트와 같은 결과)
  const loose = new Map();
  const looseRe = sq => {
    if (!loose.has(sq)) loose.set(sq, sq.length < 2 ? null : new RegExp("(?:^|[^0-9a-z가-힣])" + [...sq].map(ch => ch.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("[\\s\\-·]*"), "i"));
    return loose.get(sq);
  };
  function wordHit(p, w) {
    const h = hay(p), lw = w.toLowerCase(), sq = squash(w), syn = SYN.get(sq), re = looseRe(sq);
    return h.includes(lw) || (re ? re.test(h) : false) || (syn ? h.includes(syn) : false);
  }
  // 검색어 단어를 조건 칩으로 바꿀 사전: 단어 → [키, 값]
  function wordDict() {
    const d = new Map(), add = (w, k, v) => { const s = squash(w); if (s && !d.has(s)) d.set(s, [k, v]); };
    for (const b of new Set(list().map(p => p.b))) { add(b, "brand", b); (D.brandKo[b] || "").split(/\s+/).forEach(w => add(w, "brand", b)); }
    for (const t of new Set(list().map(p => p.t))) add(TYPE_ALL[t], "type", t);
    for (const [t, subs] of Object.entries(D.subtypes)) if (list().some(p => p.t === t)) subs.forEach(s => add(s, "sub", t + "|" + s));
    (isBag() ? D.leathers : D.metals).forEach(m => add(m, "mat", m));
    if (!isBag()) { add("옐로골드", "mat", "옐로우골드"); add("핑크골드", "mat", "로즈골드"); add("다이아", "stone", "다이아몬드"); add("진주", "stone", "컬러스톤·진주"); }
    (isBag() ? D.colors : D.stones).forEach(s => { add(s, stoneKey(), s); s.split("·").forEach(x => add(x, stoneKey(), s)); });
    return d;
  }
  // 엔터를 누르면: 조건이 되는 단어는 칩으로, 나머지는 검색어로 남긴다
  let lastConverted = [];
  // 금액 말 → 가격 범위 (참값 기준): '300만원', '300만원 이하/까지/미만', '100만원 이상/부터', '100~300만', '300만원대', '1억 이하'
  function priceWords(text, params, got) {
    const won = (n, u) => Math.round(parseFloat(String(n).replace(/,/g, "")) * (u === "억" ? 1e8 : 1e4));
    text = text.replace(/(\d[\d,.]*)\s*(만|억)?\s*원?\s*[~\-]\s*(\d[\d,.]*)\s*(만|억)\s*원?(\s*(이하|까지|미만|사이))?/g, (m, a, ua, b, ub) => {
      params.set("pmin", won(a, ua || ub)); params.set("pmax", won(b, ub)); got.push(m.trim()); return " "; });
    text = text.replace(/(\d[\d,.]*)\s*(만|억)\s*원?\s*(이하|까지|미만|이상|부터|넘는|대)?/g, (m, a, u, suf) => {
      const v = won(a, u);
      if (suf === "이상" || suf === "부터" || suf === "넘는") { params.set("pmin", v); params.delete("pmax"); }
      else if (suf === "대") { const step = won(10 ** (String(parseInt(a, 10)).length - 1), u); params.set("pmin", v); params.set("pmax", v + step - 1); }
      else { params.set("pmax", v); params.delete("pmin"); }  // '300만원' 만 쓰면 그 금액 이하
      got.push(m.trim()); return " "; });
    return text;
  }
  function convertQuery(text, params) {
    const dict = wordDict(), rest = [], got = [];
    text = priceWords(text, params, got);
    for (const w of text.trim().split(/\s+/).filter(Boolean)) {
      const hit = dict.get(squash(w));
      if (!hit) { rest.push(w); continue; }
      let [k, v] = hit;
      if (k === "sub") { const [t, s] = v.split("|"); params.set("type", t); k = "sub"; v = s; }
      const cur = (params.get(k) || "").split(",").filter(Boolean);
      if (k === "type") params.set("type", v);
      else if (!cur.includes(v)) params.set(k, [...cur, v].join(","));
      got.push(w);
    }
    rest.length ? params.set("q", rest.join(" ")) : params.delete("q");
    lastConverted = got;
    return params;
  }
  function filterState(q) {
    const s = q.get("q") || "";
    return { q: s, words: s.trim().split(/\s+/).filter(Boolean), brand: csv(q, "brand"), c: csv(q, "c"), type: q.get("type") || "", sub: csv(q, "sub"),
      mat: csv(q, "mat"), stone: csv(q, stoneKey()), pmin: Math.max(0, +q.get("pmin") || 0),
      pmax: !q.has("pmax") ? PR.def[1] : q.get("pmax") === "all" ? Infinity : (+q.get("pmax") || Infinity),
      cheap: q.get("cheap") || "", save: q.has("save") ? q.get("save") : "", buy: q.get("buy") === "1", nw: q.get("new") === "1",
      chk: q.get("chk") !== "0", sort: q.get("sort") || "" };
  }
  function test(o, F, skip) {
    const p = o.p, R = o.R, v = R.best ? R.best.net : Infinity;
    if (skip !== "brand" && F.brand.length && !F.brand.includes(p.b)) return false;
    if (skip !== "c" && F.c.length && !F.c.includes(p.c)) return false;
    if (skip !== "type" && F.type && p.t !== F.type) return false;
    if (skip !== "sub" && F.sub.length && !F.sub.includes(p.sb)) return false;
    if (skip !== "mat" && F.mat.length && !F.mat.includes(fMat(p))) return false;
    if (skip !== "stone" && F.stone.length && !F.stone.includes(fStone(p))) return false;
    if (skip !== "price") {
      if (F.pmin && v < F.pmin) return false;
      if (v > F.pmax) return false;
    }
    if (skip !== "cheap" && F.cheap && (F.cheap === "trip" ? !S.trip.includes(o.ab) : o.ab !== F.cheap)) return false;
    if (skip !== "save" && F.save !== "" && !(R.save > 0 && R.save * 100 >= +F.save)) return false;
    if (skip !== "buy" && F.buy && !(R.best && R.best.t === 1)) return false;
    if (skip !== "new" && F.nw && !(p.x && (p.x["신상"] || p.x["한정판"]))) return false;
    if (skip !== "chk" && F.chk && R.outlier) return false;
    if (skip !== "q" && F.words.length && !F.words.every(w => o.it.ps.some(x => wordHit(x, w)))) return false;  // 패션은 색상 중 하나라도 맞으면
    return true;
  }
  const spread = R => { const a = R.all.map(r => r.net); return a.length > 1 ? (Math.max(...a) - Math.min(...a)) / Math.min(...a) : 0; };
  const SORTERS = {
    "": (a, b) => (b.R.save ?? -9) - (a.R.save ?? -9) || savedAmt(b.R) - savedAmt(a.R),
    amt: (a, b) => savedAmt(b.R) - savedAmt(a.R) || (b.R.save ?? -9) - (a.R.save ?? -9),
    low: (a, b) => (a.R.best?.net ?? Infinity) - (b.R.best?.net ?? Infinity),
    high: (a, b) => (b.R.best?.net ?? 0) - (a.R.best?.net ?? 0),
    new: (a, b) => (+!!(b.p.x && b.p.x["신상"]) - +!!(a.p.x && a.p.x["신상"])) || savedAmt(b.R) - savedAmt(a.R),
    spread: (a, b) => spread(b.R) - spread(a.R),
  };
  const PAGE = () => isM() ? 12 : 24;  // 한 번에 보여 줄 개수 (모바일 12, 5M.12절)
  let panelOpen = false, quickOpen = "", acOpen = false, showN = 0;  // 0 = 첫 묶음
  function filterView(base, q, lock) {
    lock = lock || {};
    const F = filterState(q);
    if (lock.brand) F.brand = [lock.brand];
    // 숨긴 브랜드도 브랜드를 직접 고르면 보임(엑셀과 같음)
    const all = itemsAll().filter(it => !SET.hide.includes(it.ps[0].b) || lock.brand === it.ps[0].b || F.brand.includes(it.ps[0].b))
      .map(it => { const p = head(it); return { it, p, R: itemRep(it), ab: rep(p, []).best?.cc }; })
      .filter(o => !lock.at || soldAt(o.p, lock.at));  // 기준 나라: 그 나라 공홈에서 파는 제품만
    const res = all.filter(o => test(o, F)).sort(SORTERS[F.sort] || SORTERS[""]);
    const url = (set, drop) => {
      const u = new URLSearchParams(q);
      for (const [k, v] of Object.entries(set || {})) (v === "" || v === null || v === undefined) ? u.delete(k) : u.set(k, v);
      (drop || []).forEach(k => u.delete(k));
      const s = u.toString(); return base + (s ? "?" + s : "");
    };
    const toggle = (k, v, cur) => url({ [k]: (cur.includes(v) ? cur.filter(x => x !== v) : [...cur, v]).join(",") });
    // 칸별 개수: 이 칸만 빼고 나머지 조건을 다 적용했을 때 그 값을 가진 제품 수
    const countBy = (skip, fn) => { const m = new Map(); for (const o of all) if (test(o, F, skip)) { const v = fn(o); m.set(v, (m.get(v) || 0) + 1); } return m; };
    const opt = (label, href, on, n, extra) => `<a class="fopt ${on ? "on" : ""} ${n === 0 && !on ? "zero" : ""}" href="${esc(href)}">${extra || ""}${esc(label)}${n === undefined ? "" : ` <small>${n}</small>`}</a>`;
    const brands = [...new Set(all.map(o => o.p.b))];
    const oneBrand = lock.brand || (F.brand.length === 1 ? F.brand[0] : "");
    const types = [...new Set(all.map(o => o.p.t))];
    const sec = (title, body, cls = "") => `<section class="fsec ${cls}"><h4>${title}</h4><div class="fopts">${body}</div></section>`;
    // 필터 더 보기 (3단계)
    const cB = countBy("brand", o => o.p.b), cC = countBy("c", o => o.p.c), cT = countBy("type", o => o.p.t), cS = countBy("sub", o => o.p.sb),
      cM = countBy("mat", o => fMat(o.p)), cSt = countBy("stone", o => fStone(o.p)), cCh = countBy("cheap", o => o.ab);
    const subs = F.type ? (D.subtypes[F.type] || []) : [];
    const panel = [
      lock.brand ? "" : sec("브랜드", brands.sort((a, b) => (cB.get(b) || 0) - (cB.get(a) || 0)).map(b => opt("", toggle("brand", b, F.brand), F.brand.includes(b), cB.get(b) || 0, brandMark(b, "sm"))).join("")),
      (() => { const cs = oneBrand ? [...new Set(all.filter(o => o.p.b === oneBrand).map(o => o.p.c).filter(Boolean))] : [];  // 값이 없는 칸은 숨김
        return cs.length ? sec(isBag() ? "라인" : "컬렉션", cs.sort((a, b) => (cC.get(b) || 0) - (cC.get(a) || 0)).map(c => opt(colName(c), toggle("c", c, F.c), F.c.includes(c), cC.get(c) || 0)).join("")) : ""; })(),
      sec("종류", types.map(t => opt(TYPE_ALL[t], url({ type: F.type === t ? "" : t }, ["sub"]), F.type === t, cT.get(t) || 0)).join(""), subs.length ? "hassub" : ""),
      // 세부 종류는 고른 종류에 딸린 것 — 들여쓰고 왼쪽 선으로 묶음 (2026-10-30 사용자: 상위 필터와 구분이 안 됨)
      subs.length ? sec(`<span aria-hidden="true">└ </span>${esc(TYPE_ALL[F.type])} 세부 종류`, subs.map(s => opt(s, toggle("sub", s, F.sub), F.sub.includes(s), cS.get(s) || 0)).join(""), "fsubs") : "",
      sec(isBag() ? "가죽·소재" : "소재", (isBag() ? D.leathers : D.metals).map(m => opt(matLabel(m), toggle("mat", m, F.mat), F.mat.includes(m), cM.get(m) || 0)).join("")),
      sec(isBag() ? "색상" : "스톤", (isBag() ? D.colors : D.stones).map(s => opt(s, toggle(stoneKey(), s, F.stone), F.stone.includes(s), cSt.get(s) || 0,
        isBag() ? `<i class="dotc" style="background:${COLG[s] || "#999"}"></i>` : "")).join("")),
      sec(`가격대 <small>${JINGA} 기준</small>`, priceRange(F)),
      sec("어디서 가장 싸요?", (S.trip.length ? opt("내 여행지 중", url({ cheap: F.cheap === "trip" ? "" : "trip" }), F.cheap === "trip") : "") +
        TRIP_CODES.filter(c => cCh.get(c)).map(c => opt(C[c].n, url({ cheap: F.cheap === c ? "" : c }), F.cheap === c, cCh.get(c), flag(c))).join("")),
      sec("한국보다 얼마나 싸야 해요?", SAVES.map(([v, l]) => opt(l, url({ save: v }), F.save === v)).join("")),
      sec("그 밖에", opt("살 수 있는 것만", url({ buy: F.buy ? "" : "1" }), F.buy) + (isBag() ? "" : opt("신상·한정판", url({ new: F.nw ? "" : "1" }), F.nw)) +
        opt("가격 확인 필요 빼기", url({ chk: F.chk ? "0" : "" }), F.chk)),
    ].join("");
    // 켠 조건 칩 (지울 수 있게)
    // 칩에 안 보이는 기본 조건('가격 확인 필요 빼기')이 뺀 개수 — 결과 수가 브랜드 제품 수보다 적은 이유를 보여 줌
    const hidChk = F.chk ? all.filter(o => test(o, F, "chk")).length - res.length : 0;
    const act = [];
    if (F.q) act.push([`"${F.q}"`, url({ q: "" })]);
    if (!lock.brand) F.brand.forEach(b => act.push([bk(b), toggle("brand", b, F.brand)]));
    F.c.forEach(c => act.push([colName(c), toggle("c", c, F.c)]));
    if (F.type) act.push([TYPE_ALL[F.type], url({ type: "" }, ["sub"])]);
    F.sub.forEach(s => act.push([s, toggle("sub", s, F.sub)]));
    F.mat.forEach(m => act.push([matLabel(m), toggle("mat", m, F.mat)]));
    F.stone.forEach(s => act.push([s, toggle(stoneKey(), s, F.stone)]));
    if (F.pmin || F.pmax !== Infinity) act.push([rangeLabel(F), url({ pmax: "all" }, ["pmin"])]);  // 기본 0~400만도 칩으로 보여 줌(✕ = 제한 없음)
    if (F.cheap) act.push([F.cheap === "trip" ? "내 여행지 중 가장 쌈" : C[F.cheap].n + "이(가) 가장 쌈", url({ cheap: "" })]);
    if (F.save !== "") act.push([SAVES.find(s => s[0] === F.save)?.[1] || "", url({ save: "" })]);
    if (F.buy) act.push(["살 수 있는 것만", url({ buy: "" })]);
    if (F.nw) act.push(["신상·한정판", url({ new: "" })]);
    if (!F.chk) act.push(["가격 확인 필요 포함", url({ chk: "" })]);
    const moreN = [F.brand.length && !lock.brand, F.c.length, F.sub.length, F.mat.length, F.stone.length, F.cheap, F.buy, F.nw, !F.chk].filter(Boolean).length;
    // 결과가 없을 때: 조건 하나를 빼면 나오는 개수 (많이 늘어나는 순 최대 3개)
    let empty = "";
    if (!res.length) {
      const tries = [["q", "검색어", { q: "" }], ["brand", "브랜드", { brand: "" }], ["c", "컬렉션", { c: "" }], ["type", "종류", { type: "", sub: "" }], ["sub", "세부 종류", { sub: "" }],
        ["mat", "소재", { mat: "" }], ["stone", isBag() ? "색상" : "스톤", { [stoneKey()]: "" }], ["price", "가격대", { pmin: "", pmax: "all" }], ["cheap", "나라", { cheap: "" }],
        ["save", "절약률", { save: "" }], ["buy", "살 수 있는 것만", { buy: "" }], ["new", "신상", { new: "" }]]
        .map(([k, l, set]) => [l, url(set), all.filter(o => test(o, F, k)).length]).filter(x => x[2] > 0).sort((a, b) => b[2] - a[2]).slice(0, 3);
      empty = `<div class="empty"><p>${F.q ? `‘${esc(F.q)}’에 맞는 제품이 없어요.` : "조건에 맞는 제품이 없어요."}</p>
        ${tries.length ? `<p class="note">조건을 하나 빼면 이만큼 있어요</p><div class="chiprow center">${tries.map(([l, h, n]) => `<a class="tchip" href="${esc(h)}">${esc(l)} 빼기 → ${n}개</a>`).join("")}</div>` : ""}
        ${otherHint(F)}</div>`;
    }
    // 자동 완성 (검색창 아래, 입력 중일 때만)
    let ac = "";
    if (acOpen && !F.q) {  // 빈 검색창을 눌렀을 때: 최근 검색어 + 많이 찾는 말 (2026-10-28)
      const rec = store.get(KEY("recent"), []).slice(0, 5), pop = POPULAR[kind].filter(x => !rec.includes(x)).slice(0, 5);
      const li = (k, v) => `<li><a href="#/search?q=${encodeURIComponent(v)}"><small>${k}</small> ${esc(v)}</a></li>`;
      if (rec.length || pop.length) ac = `<ul class="ac" role="listbox">${rec.map(v => li("최근", v)).join("")}${pop.map(v => li("많이 찾는", v)).join("")}</ul>`;
    } else if (acOpen && F.q.length >= 1) {
      const w = F.q.toLowerCase(), sw = squash(F.q), hits = [];
      brands.filter(b => (b + " " + (D.brandKo[b] || "")).toLowerCase().includes(w)).slice(0, 2).forEach(b => hits.push(["브랜드", bk(b), "#/brand/" + encodeURIComponent(b)]));
      [...new Set(all.map(o => o.p.b + "|" + (o.p.c || "")))].filter(x => squash(x.split("|")[1]).includes(sw)).slice(0, 3)
        .forEach(x => { const [b, c] = x.split("|"); hits.push([bk(b), colName(c), "#/brand/" + encodeURIComponent(b) + "?c=" + encodeURIComponent(c)]); });
      res.slice(0, 8 - hits.length).forEach(o => hits.push([bk(o.p.b), o.p.n, link(o.p)]));
      if (hits.length) ac = `<ul class="ac" role="listbox">${hits.map(([k, v, h]) => `<li><a href="${esc(h)}"><small>${esc(k)}</small> ${esc(v)}</a></li>`).join("")}</ul>`;
    }
    const conv = lastConverted.length ? `<p class="conv">이렇게 찾았어요 — 조건 ${lastConverted.map(w => `<b>${esc(w)}</b>`).join(" · ")}${F.q ? ` · 검색어 <b>“${esc(F.q)}”</b>` : ""}</p>` : "";
    // 빠른 단추로 펼친 목록: 위 단추 줄과 같은 모양이라 한 줄 더 생긴 것처럼 보이던 것 → 옅은 판 + 누른 단추를 가리키는 꼬리 + 제목·닫기 (10-30 사용자)
    const qpop = (k, title, body, cls = "") => `<div class="qpop" role="group" aria-label="${title}"><div class="qphead"><b>${title}</b><button type="button" class="link" data-quick="${k}">닫기</button></div><div class="qsub ${cls}">${body}</div></div>`;
    const quickRow = quickOpen === "brand" ? qpop("brand", "브랜드 고르기 · 여러 개", [...brands].sort((a, b) => (cB.get(b) || 0) - (cB.get(a) || 0)).map(b => opt("", toggle("brand", b, F.brand), F.brand.includes(b), cB.get(b) || 0, brandMark(b, "sm"))).join(""), "qbrand")
      : quickOpen === "type" ? qpop("type", "종류 고르기", types.map(t => opt(TYPE_ALL[t], url({ type: F.type === t ? "" : t }, ["sub"]), F.type === t, cT.get(t) || 0)).join(""))
      : quickOpen === "price" ? qpop("price", `가격대 · ${JINGA} 기준`, priceRange(F)) : "";
    const qo = k => `${quickOpen === k ? " open" : ""}" aria-expanded="${quickOpen === k}`;
    const lim = showN || PAGE(), shown = res.slice(0, lim);
    return `<div class="fbar${quickOpen || panelOpen ? "" : " stick"}">
      <form class="fsearch" data-search role="search"><svg><use href="#i-search"/></svg><input id="fq" name="q" value="${esc(F.q)}" placeholder="${isM() ? "이름·제품번호로 찾기" : isBag() ? "제품 이름, 제품번호, 라인 — 예: 보테가 토트백 블랙" : "제품 이름, 제품번호, 컬렉션 — 예: 까르띠에 반지 러브"}" aria-label="찾기" autocomplete="off" data-live><button type="submit" class="link">찾기</button>${ac}</form>
      ${conv}
      <div class="qchips">
        ${lock.brand ? "" : `<button type="button" class="qchip ${F.brand.length ? "on" : ""}${qo("brand")}" data-quick="brand"><span class="qtx">${F.brand.length ? esc(F.brand.map(bk).join("·")) : "브랜드"}</span>&nbsp;▾</button>`}
        <button type="button" class="qchip ${F.type ? "on" : ""}${qo("type")}" data-quick="type">${F.type ? esc(TYPE_ALL[F.type]) : "종류"} ▾</button>
        <button type="button" class="qchip ${F.pmin || F.pmax !== Infinity ? "on" : ""}${qo("price")}" data-quick="price">${esc(F.pmin || F.pmax !== Infinity ? rangeLabel(F) : "가격대")} ▾</button>
        <a class="qchip ${F.save === "0" ? "on" : ""}" href="${esc(url({ save: F.save === "0" ? "" : "0" }))}">한국보다 싼 것만</a>
        ${lock.at ? `<span class="qchip on" title="가격을 이 나라 기준으로 보여 줘요">${flag(lock.at)}${esc(C[lock.at].n)} 기준</span>` : `<button type="button" class="qchip ${S.trip.length ? "on" : ""}" data-trip-open>✈ ${S.trip.length ? S.trip.map(c => esc(C[c].n)).join("·") : "내 여행지"}</button>`}
        <button type="button" class="qchip more" data-fpanel>필터 더 보기${moreN ? ` (${moreN})` : ""}</button>
      </div>${quickRow}
    </div>
    <div class="fl ${panelOpen ? "open" : ""}">
      <aside class="fpanel" aria-label="필터"><div class="fphead"><b>필터</b><button type="button" class="link" data-fpanel>닫기</button></div>${panel}
        <div class="fpfoot"><a class="btn ghost" href="${esc(lock.reset || base)}">초기화</a><button type="button" class="btn" data-fpanel>결과 ${res.length}개 보기</button></div></aside>
      <div class="fmain">
        <div class="ftool"><b class="cnt2">${res.length}개</b>${hidChk ? `<span class="hidnote">가격 확인 필요 ${hidChk}개 뺌 <a class="link" href="${esc(url({ chk: "0" }))}">포함</a></span>` : ""}${act.map(([l, h]) => `<a class="achip" href="${esc(h)}">${esc(l)} ✕</a>`).join("")}${act.length ? `<a class="link" href="${esc(lock.reset || (lock.brand ? base : "#/search"))}">모두 지우기</a>` : ""}
          <span class="sp"></span><span class="vtog" role="group" aria-label="보기"><a class="${viewMode(q) === "list" ? "on" : ""}" href="${esc(url({ view: "list" }))}">목록</a><a class="${viewMode(q) === "card" ? "on" : ""}" href="${esc(url({ view: "" }))}">카드</a></span><select data-sort aria-label="정렬">${SORTS.map(([k, l]) => `<option value="${esc(url({ sort: k }))}" ${k === F.sort ? "selected" : ""}>${l}</option>`).join("")}</select></div>
        ${!lock.noResults && res.length ? stockNote(true) : ""}
        ${lock.noResults ? "" : res.length ? (viewMode(q) === "list" ? `<div class="lrows">${shown.map(o => rowItem(o.it)).join("")}</div>`
          : `<div class="grid ${panelOpen && !isM() ? "g3" : ""}">${shown.map(o => card(o.it)).join("")}</div>`) : empty}
        ${!lock.noResults && res.length > lim ? `<button type="button" class="btn ghost wide" data-moreF>${PAGE()}개 더 보기 (${res.length - lim}개 남음)</button>` : ""}
      </div></div>`;
  }
  // 가격 범위: 두 손잡이 막대 + 숫자 칸(만원). 손을 떼거나 [적용]을 누르면 반영
  const rangeLabel = F => `${F.pmin ? man(F.pmin) : "0"}~${F.pmax === Infinity ? "제한 없음" : man(F.pmax)}`;
  function priceRange(F) {
    const mx = F.pmax === Infinity ? PR.top : Math.min(F.pmax, PR.top), mn = Math.min(F.pmin, mx);
    const pct = v => (v / PR.top * 100).toFixed(2);
    return `<form class="prange" data-prange>
      <div class="pr-out" aria-live="polite">${esc(rangeLabel(F))}</div>
      <div class="pr-track" style="--a:${pct(mn)}%;--b:${pct(mx)}%">
        <input type="range" name="rmin" min="0" max="${PR.top}" step="${PR.step}" value="${mn}" aria-label="최소 가격">
        <input type="range" name="rmax" min="0" max="${PR.top}" step="${PR.step}" value="${mx}" aria-label="최대 가격"></div>
      <div class="pr-scale"><span>0</span><span>${man(PR.top)}+</span></div>
      <div class="pr-num"><input name="pmin" inputmode="numeric" value="${mn / 1e4}" aria-label="최소 가격(만원)"> ~ <input name="pmax" inputmode="numeric" value="${F.pmax === Infinity ? "" : mx / 1e4}" placeholder="제한 없음" aria-label="최대 가격(만원)"> 만원
        <button type="submit" class="link">적용</button><a class="link" href="#" data-prdef>제한 없음</a></div></form>`;
  }
  // 다른 앱 안내: 주얼리 앱에서 패션 종류 말, 패션 앱에서 주얼리 종류 말을 찾을 때
  function otherHint(F) {
    const other = isBag() ? ["반지", "목걸이", "팔찌", "귀걸이", "시계", "주얼리"] : ["가방", "지갑", "신발", "백", "스카프", "벨트", "패션"];
    return F.words.some(w => other.some(o => w.includes(o))) ? `<p class="note">${isBag() ? "주얼리는 럭스캐너 주얼리에서" : "패션은 럭스캐너 패션에서"} 찾아요 ↗</p>` : "";
  }

  // ── S-06 찾기 ──
  function search(q) {
    const F = filterState(q), noCond = !F.q && [...q.keys()].filter(k => k !== "sort").length === 0;
    const recent = store.get(KEY("recent"), []);
    const popular = POPULAR[kind];
    return `<div class="pagehead center inl"><h1>찾기</h1><p class="eyebrow">Search</p></div>
      ${filterView("#/search", q, noCond ? { noResults: true } : {})}
      ${noCond ? `<div class="sec">
        ${recent.length ? `<div class="sh"><p class="eyebrow">Recent</p><h3>최근 검색어</h3><button type="button" class="link" data-recent-clear>지우기</button></div><div class="chiprow center">${recent.map(r => `<a class="tchip" href="#/search?q=${encodeURIComponent(r)}">${esc(r)}</a>`).join("")}</div>` : ""}
        <div class="sh" style="margin-top:48px"><p class="eyebrow">Popular</p><h3>많이 찾는 말</h3></div><div class="chiprow center">${popular.map(r => `<a class="tchip" href="#/search?q=${encodeURIComponent(r)}">${esc(r)}</a>`).join("")}</div>
        <div class="sh" style="margin-top:48px"><p class="eyebrow">Maisons</p><h3>브랜드로 보기</h3></div><div class="brands">${brandTiles()}</div></div>` : ""}`;
  }
  const POPULAR = { bag: ["안디아모", "카세트", "조디", "인트레치아토", "레이디 디올", "트리옹프"], jewelry: ["러브", "알함브라", "저스트 앵 끌루", "세르펜티", "티 스마일"] };
  // 검색 템플릿 (첫 화면 검색창 아래): 조건이 다 들어간 찾기 (2026-10-27)
  const TEMPLATES = {
    jewelry: [
      ["까르띠에 러브 팔찌", { brand: "Cartier", c: "LOVE (러브)", type: "bracelet" }],
      ["반클리프 알함브라", { brand: "Van Cleef & Arpels", q: "알함브라" }],
      ["불가리 세르펜티", { brand: "Bulgari", q: "세르펜티" }],
      ["티파니 하트", { brand: "Tiffany & Co.", q: "하트" }],
      ["100만원 이하 선물", { pmax: 1000000, save: 0 }],
      ["300만원 이하", { pmax: 3000000, save: 0 }],
      ["예물 반지", { type: "ring", sub: "밴드" }],
      ["일본이 가장 싼 것", { cheap: "JP" }],
    ],
    bag: [
      ["루이비통 네버풀", { brand: "Louis Vuitton", q: "네버풀" }],
      ["디올 레이디 디올", { brand: "Dior", q: "레이디 디올" }],
      ["보테가 인트레치아토", { brand: "Bottega Veneta", q: "인트레치아토" }],
      ["샤넬 가방", { brand: "Chanel", type: "bag" }],
      ["100만원 이하 지갑", { type: "wallet", pmax: 1000000, save: 0 }],
      ["300만원 이하 가방", { type: "bag", pmax: 3000000, save: 0 }],
      ["스카프·트윌리", { type: "silk", sub: "스카프·트윌리" }],
      ["일본이 가장 싼 것", { cheap: "JP" }],
    ],
  };
  const templates = () => {
    const t = (TEMPLATES[kind] || []).slice(0, isM() ? 6 : 8);  // 휴대폰은 6개(두세 줄)
    return t.length ? `<div class="htpl" aria-label="이렇게 찾아 보세요">${t.map(([l, q]) => `<a class="tchip sm" href="#/search?${esc(new URLSearchParams(q).toString())}">${esc(l)}</a>`).join("")}</div>` : "";
  };
  // 브랜드로 찾기 (첫 화면 위쪽): 제품 많은 순 로고 — PC 12개, 휴대폰 6개 + 모든 브랜드
  function brandQuick() {
    const cnt = {};
    for (const p of list()) cnt[p.b] = (cnt[p.b] || 0) + 1;
    const bs = Object.keys(cnt).sort((a, b) => cnt[b] - cnt[a]).slice(0, isM() ? 6 : 12);
    return `<section class="bquick" id="h-bq"><div class="bqh"><b>브랜드로 찾기</b><a class="link" href="#/brand">모든 브랜드 ${Object.keys(cnt).length}</a></div>
      <div class="bqgrid">${bs.map(b => `<a class="blogo" href="#/brand/${encodeURIComponent(b)}" aria-label="${esc(bk(b))}">${brandMark(b, "lg")}</a>`).join("")}</div></section>`;
  }
  function brandTiles() {
    const by = {};
    for (const it of itemsAll()) { const p = head(it); (by[p.b] = by[p.b] || []).push(it); }
    return Object.entries(by).sort((a, b) => b[1].length - a[1].length).map(([b, its]) => {
      const cnt = {}; for (const it of its) { const R = itemRep(it); if (R.best) cnt[R.best.cc] = (cnt[R.best.cc] || 0) + 1; }
      const best = Object.entries(cnt).sort((a, c) => c[1] - a[1])[0];
      return `<a class="tile" href="#/brand/${encodeURIComponent(b)}"><b>${brandMark(b, "lg")}</b><span>${esc(bk(b))} · ${kind === "bag" ? "모델" : "제품"} ${its.length}개${SET.hide.includes(b) ? " · 숨김" : ""}</span>${best ? `<span class="tbest">추천 ${nationF(best[0])}</span>` : ""}</a>`;
    }).join("");
  }

  // ── S-02a 여행지 목록 / S-02 여행지 (5.8절) ──
  function countryStats(c) {
    let cheapest = 0, cheaper = 0, total = 0; const saves = [];
    for (const it of items()) {
      const p = head(it), rs = rows(p), r = rs.find(x => x.cc === c && x.t > 0 && x.v), kr = rs.find(x => x.cc === "KR" && x.v);
      if (!r) continue; total++;
      const all = rep(p, []); if (all.best && all.best.cc === c) cheapest++;
      if (kr) { const s = (kr.net - r.net) / kr.net; saves.push(s); if (s > 0) cheaper++; }
    }
    return { cheapest, cheaper, total, med: median(saves), medCheap: median(saves.filter(s => s > 0)) };  // medCheap: 한국보다 싼 제품만의 중간 절약률
  }
  function countries() {
    const st = TRIP_CODES.map(c => ({ c, ...countryStats(c) })).filter(o => o.total).sort((a, b) => b.cheapest - a.cheapest);
    return `<div class="pagehead"><h1>여행지</h1><p class="lead">어느 나라가 유리한지 비교하고 내 여행지를 고르세요. (최대 3개)</p></div>
      <div class="clist">${st.map(o => `<article class="ccard ${S.trip.includes(o.c) ? "mine" : ""}">
        <a class="hit" href="#/country/${o.c}" aria-label="${esc(C[o.c].n)}"></a>
        <div class="ctop"><span class="cname">${nationF(o.c)}</span>
          <button type="button" class="tchip sm ${S.trip.includes(o.c) ? "on" : ""}" data-trip="${o.c}">${S.trip.includes(o.c) ? "✈ 내 여행지" : "+ 여행지"}</button></div>
        <div class="stats"><div><b>${o.cheapest}</b><span>가장 싼 제품</span></div><div><b>${o.total ? Math.round(o.cheaper / o.total * 100) : 0}%</b><span>한국보다 쌈</span></div>
          <div><b>${C[o.c].refund ? C[o.c].refund + "%" : "없음"}</b><span>환급률</span></div></div>
        <div class="note">중간 절약률 ${pct(o.med)}</div></article>`).join("")}</div>`;
  }
  let countryShow = 0;  // 0 = 첫 묶음 (PAGE)
  function country(c, q) {
    if (!C[c] || c === "KR") return notFound();
    const brandF = q.get("brand") || "";
    if (brandF) return countryBrand(c, brandF, q);  // 브랜드를 고르면 브랜드 상세처럼 (기준 나라 = 이 나라)
    const tab = q.get("tab") === "kr" ? "kr" : "cheap";
    const st = countryStats(c), k = C[c], inTrip = S.trip.includes(c);
    const per = {}, cheap = [], krCheaper = [];
    for (const it of items()) {
      const p = head(it), rs = rows(p), r = rs.find(x => x.cc === c && x.t > 0 && x.v), kr = rs.find(x => x.cc === "KR" && x.v);
      if (!r || !kr) continue;
      const s = (kr.net - r.net) / kr.net;
      (per[p.b] = per[p.b] || []).push(s);
      if (brandF && p.b !== brandF) continue;
      (s > 0 ? cheap : krCheaper).push({ it, s, net: r.net });
    }
    const bars = Object.entries(per).map(([b, a]) => ({ b, m: median(a), n: a.length })).sort((a, b) => b.m - a.m);
    const mx = Math.max(0.01, ...bars.map(x => Math.abs(x.m)));
    const listA = (tab === "kr" ? krCheaper.sort((a, b) => a.s - b.s) : cheap.sort((a, b) => b.s - a.s));
    const base = `#/country/${c}`, qp = (o) => { const u = new URLSearchParams(q); for (const [kk, v] of Object.entries(o)) v ? u.set(kk, v) : u.delete(kk); const s = u.toString(); return base + (s ? "?" + s : ""); };
    const here = o => `<div class="here">${cc(c)} ${man(o.net)} · 한국 대비 ${pct(o.s)}</div>`;
    const cLim = countryShow || PAGE();
    const cards = listA.slice(0, cLim).map(o => viewMode(q) === "list" ? rowItem(o.it, here(o)) : card(o.it, here(o))).join("");
    return `<nav class="crumb"><a href="#/">홈</a> › <a href="#/country">여행지</a> › ${esc(k.n)}</nav>${evStrip(liveEvents().filter(e => e.countries.includes(c)), "#/events?cc=" + c)}
      <div class="pagehead row"><div><h1>${nationF(c)}</h1><p class="lead">통화 ${esc(k.cur)} · 환율 ₩${fxFmt(D.fx[c])} (${esc(fxLabel())}) · 데이터 ${esc(D.generated)}</p>${stockNote(true)}</div>
        <button type="button" class="btn ${inTrip ? "ghost" : ""}" data-trip="${c}">${inTrip ? "✈ 내 여행지에서 빼기" : "✈ 내 여행지에 넣기"}</button></div>
      <div class="kpis"><div><b>${st.cheapest}</b><span>${esc(k.n)}이(가) 가장 싼 제품</span></div><div><b>${st.cheaper}</b><span>한국보다 싼 제품 (${st.total}개 중)</span></div><div><b>${pct(st.med)}</b><span>중간 절약률</span></div></div>
      <section class="sec"><div class="sh"><h3>브랜드별 절약</h3>${brandF ? `<a class="link" href="${qp({ brand: "" })}">브랜드 거르기 풀기 ✕</a>` : `<span class="note">막대를 누르면 그 브랜드만</span>`}</div>
        <ol class="rank wide">${(isM() && !barsAll ? bars.slice(0, 5) : bars).map(x => `<li class="${x.b === brandF ? "mine" : ""}"><a href="${qp({ brand: x.b === brandF ? "" : x.b })}">${esc(bk(x.b))} <small>${x.n}</small></a><span class="bar"><i style="width:${Math.max(3, Math.abs(x.m) / mx * 100)}%" class="${x.m < 0 ? "neg" : ""}"></i></span><b>${pct(x.m)}</b></li>`).join("")}</ol>${isM() && bars.length > 5 ? `<button type="button" class="link" data-barsall>${barsAll ? "접기" : `브랜드 ${bars.length - 5}개 더 보기`}</button>` : ""}</section>
      <section class="sec"><div class="tabs">
        <a class="tab ${tab === "cheap" ? "on" : ""}" href="${qp({ tab: "" })}">이 나라가 싼 제품 ${cheap.length}</a>
        <a class="tab ${tab === "kr" ? "on" : ""}" href="${qp({ tab: "kr" })}">한국이 더 싼 제품 ${krCheaper.length}</a></div>
        ${listA.length ? `<div class="${viewMode(q) === "list" ? "lrows" : "grid"}">${cards}</div>` : `<p class="empty">해당 제품이 없어요.</p>`}
        ${listA.length > cLim ? `<button type="button" class="btn ghost wide" data-moreC>${PAGE()}개 더 보기 (${listA.length - cLim}개 남음)</button>` : ""}</section>
      <section class="sec info"><div class="sh"><h3>${esc(k.n)}에서 살 때</h3></div>
        <ul><li>환급: ${k.refund ? `실효 환급률 약 <b>${k.refund}%</b>, 최소 구매 ${local(c, k.min)}` : "관광객 환급 없음"}</li>
        ${k.how ? `<li>방법: ${esc(k.how)}</li>` : ""}${k.incl ? "" : `<li>공홈 가격은 세금 별도 → 판매세 ${k.tax}%를 더해 계산</li>`}
        <li>한국 입국 때 면세 한도 $800 — 넘으면 관세. ${JINGA}에 포함돼 있어요(제품 1개 기준, 자진신고 감면). 여러 개를 사면 한도를 한 번만 빼므로 실제 관세가 더 커요</li></ul></section>`;
  }

  // ── S-03 브랜드 (가방 모델 카드 화면) ──
  let brandShow = 24;
  function brands() {
    return `<div class="pagehead"><h1>브랜드</h1></div><div class="brands">${brandTiles()}</div>`;
  }
  // 기준 나라 칩 (브랜드 화면): [가장 싼 나라 / 내 여행지] + 이 브랜드를 파는 나라(한국보다 싼 제품이 많은 순)
  function atChips(b, its, href, cur) {
    const n = {}, cheap = {};
    for (const it of its) { const p = head(it), kr = rows(p).find(r => r.cc === "KR" && r.v);
      for (const r of rows(p)) if (r.cc !== "KR" && r.t > 0 && r.v) { n[r.cc] = (n[r.cc] || 0) + 1; if (kr && r.net < kr.net) cheap[r.cc] = (cheap[r.cc] || 0) + 1; } }
    const cs = TRIP_CODES.filter(c => n[c]).sort((a, x) => (cheap[x] || 0) - (cheap[a] || 0) || n[x] - n[a]);  // 칩 숫자: 한국보다 싼 제품 수 (한국에 없는 브랜드는 그 나라에서 파는 제품 수)
    const cut = isM() && !atAll ? cs.filter((c, i) => i < 5 || c === cur) : cs, rest = cs.length - cut.length;
    return `<div class="atrow"><span class="atl">기준 나라</span><div class="chiprow ${isM() ? "wrapm" : "scroll"}">
      <a class="tchip ${!cur ? "on" : ""}" href="${esc(href(""))}">${S.trip.length ? "✈ 내 여행지" : "가장 싼 나라"}</a>
      ${cut.map(c => `<a class="tchip ${c === cur ? "on" : ""}" href="${esc(href(c))}">${flag(c)}${esc(C[c].n)} <small>${NOKR.has(b) ? n[c] : (cheap[c] || 0)}</small></a>`).join("")}
      ${rest > 0 ? `<button type="button" class="tchip more" data-atall>+${rest}개 나라</button>` : isM() && atAll ? `<button type="button" class="tchip more" data-atall>접기</button>` : ""}</div></div>`;
  }
  let atAll = false;
  // 기준 나라에서 이 브랜드: 파는 제품 · 한국보다 싼 제품 · 중간 절약률
  function atStats(its, c) {
    const ss = [];
    for (const it of its) { const p = head(it), rs = rows(p), r = rs.find(x => x.cc === c && x.t > 0 && x.v), kr = rs.find(x => x.cc === "KR" && x.v); if (r && kr) ss.push((kr.net - r.net) / kr.net); }
    const sold = its.filter(it => soldAt(head(it), c)).length;
    return `<div class="kpis"><div><b>${sold}</b><span>${esc(C[c].n)}에서 파는 ${kind === "bag" ? "모델" : "제품"}</span></div><div><b>${ss.filter(x => x > 0).length}</b><span>한국보다 싼 ${kind === "bag" ? "모델" : "제품"}</span></div><div><b>${ss.length ? pct(median(ss)) : "—"}</b><span>중간 절약률</span></div></div>`;
  }
  function colChips(cols, col, qc) {
    const ent = Object.entries(cols).sort((x, y) => y[1] - x[1]);
    if (ent.length < 2) return "";
    // 모바일: 가로 밀기 대신 줄바꿈, 처음엔 5개(고른 컬렉션은 늘 보임) + [+N개 더]
    const cut = isM() && !colAll ? ent.filter(([c], i) => i < 5 || c === col) : ent, rest = ent.length - cut.length;
    return `<div class="chiprow ${isM() ? "wrapm" : "scroll"}"><a class="tchip ${!col ? "on" : ""}" href="${qc("")}">전체</a>${cut.map(([c, n]) => `<a class="tchip ${c === col ? "on" : ""}" href="${qc(c)}">${esc(colName(c))} <small>${n}</small></a>`).join("")}${rest > 0 ? `<button type="button" class="tchip more" data-colall>+${rest}개 더</button>` : isM() && colAll ? `<button type="button" class="tchip more" data-colall>접기</button>` : ""}</div>`;
  }
  function brand(b, q) {
    const its = itemsAll().filter(it => head(it).b === b);
    if (!its.length) return notFound();
    AT = atOk(q.get("at"));
    const col = q.get("c") || "", cols = {};
    for (const it of its) { const p = head(it); if (p.c && (!AT || soldAt(p, AT))) cols[p.c] = (cols[p.c] || 0) + 1; }
    const base = "#/brand/" + encodeURIComponent(b);
    const withQ = set => { const u = new URLSearchParams(q); for (const [k, v] of Object.entries(set)) v ? u.set(k, v) : u.delete(k); const s = u.toString(); return base + (s ? "?" + s : ""); };
    return `<nav class="crumb"><a href="#/">홈</a> › <a href="#/brand">브랜드</a> › ${esc(bk(b))}</nav>
      <div class="pagehead"><h1>${esc(b.toUpperCase())}</h1><p class="lead">${esc(bk(b))} · ${kind === "bag" ? `모델 ${its.length}개 (제품 ${its.reduce((n, it) => n + it.ps.length, 0)}개)` : `제품 ${its.length}개`}${AT ? ` · <b>${flag(AT)}${esc(C[AT].n)} 기준</b> <a class="link" href="#/country/${AT}?brand=${encodeURIComponent(b)}">${esc(C[AT].n)} 여행지 화면 ›</a>` : ""}</p>
        <p class="note">럭스캐너는 ${esc(bk(b))}와(과) 관계없는 개인 가격 비교 서비스예요. 가격은 각 나라 공식 홈페이지 기준이에요.</p></div>
      ${atChips(b, its, c => withQ({ at: c }), AT)}
      ${AT ? atStats(its, AT) : ""}
      ${colChips(cols, col, c => withQ({ c }))}
      ${filterView(base, q, { brand: b, at: AT })}`;
  }
  // 여행지 화면에서 브랜드를 고르면: 브랜드 상세와 같은 화면, 가격은 그 나라 기준 (2026-10-27)
  function countryBrand(c, b, q) {
    const its = itemsAll().filter(it => head(it).b === b);
    if (!its.length) return notFound();
    AT = c;
    const k = C[c], inTrip = S.trip.includes(c), col = q.get("c") || "", cols = {};
    for (const it of its) { const p = head(it); if (p.c && soldAt(p, c)) cols[p.c] = (cols[p.c] || 0) + 1; }
    const base = `#/country/${c}`;
    const withQ = set => { const u = new URLSearchParams(q); for (const [kk, v] of Object.entries(set)) v ? u.set(kk, v) : u.delete(kk); const s = u.toString(); return base + (s ? "?" + s : ""); };
    return `<nav class="crumb"><a href="#/">홈</a> › <a href="#/country">여행지</a> › <a href="${base}">${esc(k.n)}</a> › ${esc(bk(b))}</nav>
      <div class="pagehead row"><div><h1>${flag(c)}${esc(k.n)}에서 사는 ${esc(b.toUpperCase())}</h1>
        <p class="lead">가격은 ${esc(k.n)} ${JINGA} 기준 · 통화 ${esc(k.cur)} · 환율 ₩${fxFmt(D.fx[c])} (${esc(fxLabel())}) · <a class="link" href="#/brand/${encodeURIComponent(b)}">다른 나라와 비교 ›</a></p>${stockNote(true)}</div>
        <button type="button" class="btn ${inTrip ? "ghost" : ""}" data-trip="${c}">${inTrip ? "✈ 내 여행지에서 빼기" : "✈ 내 여행지에 넣기"}</button></div>
      ${atStats(its, c)}
      ${colChips(cols, col, cc2 => withQ({ c: cc2 }))}
      ${filterView(base, q, { brand: b, at: c, reset: `${base}?brand=${encodeURIComponent(b)}` })}`;
  }

  // ── S-05 제품 (5.11절) ──
  const openRow = new Set();
  let allNations = false, barsAll = false;  // 모바일 제품 화면: 접힌 나라까지 보기
  // 브랜드 상세 파일 (data/brands/*.js) — 제품 화면을 열 때만 읽는다 (3.5절)
  const brandState = {};
  LUX.addBrand = (b, data) => { LuxData.applyBrand(D[kind].filter(p => p.b === b), data); brandState[b] = "ok"; cache.clear(); };
  function loadBrand(b) {
    if (brandState[b]) return;
    // 한 파일본(휴대폰용, build_single.py): 브랜드 상세가 페이지 안에 JSON 으로 들어 있음
    const inl = document.getElementById("lux-brand:" + b);
    if (inl) { try { LUX.addBrand(b, JSON.parse(inl.textContent)); } catch (e) { brandState[b] = "fail"; } return; }
    const f = M.brandFiles && M.brandFiles[b];
    if (!f) { brandState[b] = "fail"; return; }
    brandState[b] = "loading";
    const done = () => { if (location.hash.startsWith("#/p/")) render(); };
    // 웹앱 묶음(web/pack.py): 데이터가 순수 JSON — 코드로 실행하지 않고 읽기만 (앱 심사 2.5.2, 웹앱계획.md 10장)
    if (/\.json$/.test(f)) {
      (window.LUXDATA ? LUXDATA.get(f)  // 앱: 앱 안 데이터 → 서명된 목록의 sha256 이 맞는 받은 파일 (web/app/appboot.js)
        : fetch("data/" + f, { credentials: "omit" }).then(r => { if (!r.ok) throw new Error(r.status); return r.json(); }))
        .then(d => LUX.addBrand(b, d)).catch(() => { brandState[b] = "fail"; }).then(done);
      return;
    }
    const el = document.createElement("script");
    el.src = "data/" + f;
    el.onload = () => { if (brandState[b] !== "ok") brandState[b] = "fail"; if (location.hash.startsWith("#/p/")) render(); };
    el.onerror = () => { brandState[b] = "fail"; if (location.hash.startsWith("#/p/")) render(); };
    document.head.appendChild(el);
  }
  let pImg = 0, pImgKey = "";
  function product(b, s) {
    const p = findP(b, s);
    if (p && !p.detail) loadBrand(p.b);
    if (p && pImgKey !== p.b + "|" + p.s) { pImg = 0; pImgKey = p.b + "|" + p.s; }
    if (!p) return `<div class="pagehead"><h1>이 제품은 이번 데이터에 없어요</h1><p class="lead">판매가 끝났거나 제품번호가 바뀌었을 수 있어요.</p><a class="btn" href="#/search">찾기</a></div>`;
    const R = rep(p), rs = rows(p), on = S.picks.includes(p.b + "|" + p.s);
    const isBag = kind === "bag";
    // ② 변형: 주얼리 = 같은 모델의 다른 소재·폭(시안 규칙: 이름 끝 괄호를 뺀 이름이 같음), 가방 = 같은 모델의 다른 색
    const vars = isBag ? D.bag.filter(q => q.md === p.md) : D.jewelry.filter(q => q.v === p.v);
    const varHtml = vars.length > 1 ? `<div class="vars"><span class="vl">${isBag ? "색상" : "소재·크기"}</span>${vars.map(q => isBag
      ? `<a class="sw big ${q === p ? "on" : ""}" href="${link(q)}" title="${esc(colKo(q))}" aria-label="${esc(colKo(q))}" style="background:${COLG[q.colg] || "#999"}"></a>`
      : (() => { const lab = (q.n.match(/\(([^)]*)\)\s*$/) || [, q.s])[1];  // 긴 소재 설명은 칩에서 줄이고 전체는 title 로
          return `<a class="tchip sm vchip ${q === p ? "on" : ""}" href="${link(q)}" title="${esc(lab)}">${esc(lab.length > 28 ? lab.slice(0, 27) + "…" : lab)}</a>`; })()).join("")}
      ${isBag ? `<span class="vname">${esc(colKo(p))}</span>` : ""}</div>` : "";
    // ③ 나라별: 내 여행지 맨 위 고정 → 나머지 싼 순 → 한국(기준) → 비교 불가 회색
    const ok = rs.filter(r => r.t > 0 && r.v && r.cc !== "KR"), bad = rs.filter(r => !(r.t > 0 && r.v) && r.cc !== "KR"), kr = rs.find(r => r.cc === "KR");
    const mine = ok.filter(r => S.trip.includes(r.cc)).sort((a, b2) => a.net - b2.net), rest = ok.filter(r => !S.trip.includes(r.cc)).sort((a, b2) => a.net - b2.net);
    const order = [...mine, ...rest, ...(kr ? [kr] : []), ...bad];
    const krNet = kr && kr.v ? kr.net : null, minNet = Math.min(...ok.map(r => r.net));
    const status = r => r.cc === "KR" ? "기준" : !(r.t > 0 && r.v) ? "비교 불가" : r.t === 2 ? "매장 확인" : "";
    const vs = r => krNet && r.v && r.cc !== "KR" ? pct((krNet - r.net) / krNet) : "";
    const optTxt = r => r.opt ? ` <small>(${r.opt.map(x => Number(x).toLocaleString("ko-KR")).join("~")})</small>` : "";
    // 나라별 공홈 링크 (https 주소만, 새 창, 6.1절)
    const olink = r => safeUrl(r.url) ? `<a class="olink" href="${esc(r.url)}" target="_blank" rel="noopener noreferrer" title="${esc(C[r.cc].n)} 공식 홈페이지에서 보기">공홈 ↗</a>` : "";
    // 계산 과정 + 그 자리에서 켜는 설정 (5.15절 '보는 화면에서 바로 바꾸기')
    // 켜기 안내 금액은 할인액이 아니라 실제 진가 차이(할인으로 환급·수수료·관세도 함께 바뀜)
    const jpTip = r => r.cc !== "JP" || !r.v ? "" : SET.jpDept ? (r.disc ? "" : " · 이 브랜드는 일본 백화점 할인 제외")
      : jpExcluded(p.b) ? "" : `<br><button type="button" class="link" data-set="jpDept" data-val="true">일본 백화점 할인을 켜면 ${JINGA} −${won(r.net - CALC.calc("JP", r.v, grpOf(p), p.b, { ...SET, jpDept: true }).net)} · 켜기</button>`;
    const cpTip = r => !r.v || r.cp ? "" : CALC.coupons.filter(cp => cp.country === r.cc && cpLive(cp)).map(cp => !cp.brands.includes(p.b)
        ? (SET.cp[cp.id] ? ` · ${esc(cp.short)}에 이 브랜드가 없어 쿠폰 할인 제외` : "")
        : (cp.exclude || {})[p.b] ? (SET.cp[cp.id] ? ` · ${esc(cp.short)}에서 이 브랜드는 쿠폰 할인 제외(${esc(cp.exclude[p.b])})` : "")
        : `<br><button type="button" class="link" data-cp="${esc(cp.id)}">${esc(cp.name)}에서 사면(쿠폰 ${cp.rate}%, ${ymd(cp.until)}까지) ${JINGA} −${won(r.net - CALC.calc(r.cc, r.v, grpOf(p), p.b, { ...SET, cp: { ...SET.cp, [cp.id]: true } }).net)} · 켜기</button>${offLinks(cp.links) ? " · " + offLinks(cp.links) : ""}`).join("");
    const esTip = r => !r.v ? "" : NOTICES.filter(n => n.country === r.cc && n.tip).map(n => `<br><span class="note">${esc(n.tip)}</span>${offLinks(n.links) ? " " + offLinks(n.links) : ""}`).join("");
    // 할인은 원화로 바꾸기 전에 (판매가 − 할인 = 결제액 → 원화) — 할인을 끝에 따로 적으면 '판매가 → 원화' 숫자가 안 맞아 보였다(2026-10-27)
    const discPart = r => !r.disc ? "" : r.cc === "JP"
      ? ` − 백화점 할인 ${SET.jpRate}% ${local("JP", Math.round(r.v * SET.jpRate / 100))} = ${local("JP", Math.round(r.v * (1 - SET.jpRate / 100)))}`
      : r.cp ? (cp => ` − ${esc(cp.short)} 쿠폰 ${cp.rate}% ${local(r.cc, Math.round(r.v * cp.rate / 100))} = ${local(r.cc, Math.round(r.v * (1 - cp.rate / 100)))}`)(CALC.coupons.find(c => c.id === r.cp))
      : r.cc === "KR" ? ` − 한국 할인 ${SET.krDisc}% ${won(r.disc)}` : "";
    const brk = r => `<div class="brk">${r.v ? `${localP(p, r.cc, r.v)}${discPart(r)}${C[r.cc].incl ? "" : ` + 판매세 ${r.tax ?? C[r.cc].tax}%`} → 원화 ${won(r.krw)}
      · 환급 ${r.rate ? `−${won(r.refund)} (${(r.rate * 100).toFixed(2)}%, 최소 ${local(r.cc, C[r.cc].min)} ${r.v >= C[r.cc].min ? "충족" : "미달"})` : "없음"}
      · 카드 수수료 +${won(r.fee)} (${payLabel()}) · 관세 ${r.duty ? "+" + won(r.duty) : r.cc === "KR" ? "없음" : !SET.customs ? "설정에서 뺌" : "0 (면세 한도 $800 이내)"}${r.duty ? ` (면세 $800 공제${SET.self ? ", 자진신고 감면" : ""})` : ""}${jpTip(r)}${cpTip(r)}${esTip(r)}${r.cc !== "KR" ? `<br><span class="stk">⚠ ${esc(C[r.cc].n)} 매장 재고는 공홈 재고 확인·매장 문의로 꼭 확인하세요${r.t === 2 ? " — 지금 공홈 온라인 품절·미판매" : ""}</span>` : ""}` : "가격 정보 없음"}</div>`;
    const conclusion = R.best ? (R.save !== null && R.save <= 0 ? `<b>한국에서 사는 게 가장 싸요</b> · ${R.mode === "trip" ? "내 여행지" : "해외"} 최저는 ${nationF(R.best.cc)}` : R.mode === "trip" ? `내 여행지 중 <b>${nationF(R.best.cc)}</b>이(가) 가장 싸요` : R.mode === "notrip" ? `내 여행지에서는 안 팔아요 · 전체 최저는 <b>${nationF(R.best.cc)}</b>` : `가장 싼 곳은 <b>${nationF(R.best.cc)}</b>`) : "가격을 비교할 수 있는 나라가 없어요";
    let table;
    if (isM()) {
      // 모바일 (5M.12절): 한 줄 카드, 현지 가격·공홈은 펼쳤을 때. 내 여행지 + 싼 나라 5개만 보이고 나머지는 접음
      const keep = new Set([...mine.map(r => r.cc), ...rest.slice(0, 5).map(r => r.cc), "KR"]);
      const hidden = order.filter(r => !keep.has(r.cc));
      const shownN = allNations ? order : order.filter(r => keep.has(r.cc));
      table = `<div class="ncards">${shownN.map(r => `<div class="ncard ${S.trip.includes(r.cc) ? "mine" : ""} ${status(r) === "비교 불가" ? "dim" : ""} ${r.net === minNet ? "best" : ""}">
        <button type="button" class="nhead" data-row="${r.cc}" aria-expanded="${openRow.has(r.cc)}"><span>${S.trip.includes(r.cc) ? "✈ " : ""}${nationF(r.cc)}${r.net === minNet ? ` <em>최저</em>` : ""}</span>
          <span class="nnum">${r.v ? won(r.net) : "—"} <small>${vs(r) || status(r)}</small></span><span class="car">${openRow.has(r.cc) ? "▴" : "▾"}</span></button>
        ${openRow.has(r.cc) ? `<div class="nsub"><span>${r.v ? localP(p, r.cc, r.v) : esc(status(r))}${status(r) && r.v ? ` · ${r.t === 2 ? `<span class="stk">${status(r)}</span>` : status(r)}` : ""}${optTxt(r)}</span>${olink(r)}</div>${brk(r)}` : ""}</div>`).join("")}</div>
        ${hidden.length ? `<button type="button" class="btn ghost wide" data-allnations>${allNations ? "접기" : `나머지 ${hidden.length}개 나라 보기`}</button>` : ""}`;
    } else {
      table = `<table class="ntable"><thead><tr><th>나라</th><th>공홈가(현지)</th><th>원화</th><th>환급</th><th>카드</th><th>관세</th><th>${JINGA}</th><th>한국 대비</th><th>상태</th><th>공홈</th></tr></thead><tbody>${order.map(r => `
        <tr class="${S.trip.includes(r.cc) ? "mine" : ""} ${status(r) === "비교 불가" ? "dim" : ""} ${r.net === minNet ? "best" : ""}" data-row="${r.cc}" tabindex="0">
          <td>${S.trip.includes(r.cc) ? "✈ " : ""}${nationF(r.cc)}</td><td>${r.v ? localP(p, r.cc, r.v) : "—"}${optTxt(r)}</td><td>${r.v ? won(r.krw) : ""}</td>
          <td>${r.refund ? "−" + won(r.refund) : r.v ? "0" : ""}</td><td>${r.fee ? "+" + won(r.fee) : r.v ? "0" : ""}</td><td>${r.duty ? "+" + won(r.duty) : r.v ? "0" : ""}</td><td><b>${r.v ? won(r.net) : ""}</b></td><td>${vs(r)}</td><td>${r.t === 2 ? `<span class="stk">${status(r)}</span>` : status(r)}</td><td>${olink(r)}</td></tr>
        ${openRow.has(r.cc) ? `<tr class="brkrow"><td colspan="10">${brk(r)}</td></tr>` : ""}`).join("")}</tbody></table>`;
    }
    const bars = ok.concat(kr && kr.v ? [kr] : []).sort((a, b2) => a.net - b2.net), mx = Math.max(...bars.map(r => r.net));
    const spec = Object.entries(p.x || {}).filter(([, v]) => v !== "" && v !== null && v !== false);
    const info = isBag ? [["색상", colKo(p)], ["모델 번호", p.md], ["제품번호", p.s]] : [["소재", /[가-힣]/.test(p.m || "") || !p.mt || p.mt === "기타" ? p.m : (p.m.length > 30 ? matLabel(p.mt) : `${matLabel(p.mt)} (${p.m})`)]  /* 원문이 길면(구찌는 소재 칸에 제품 이름) 한글 분류만 */, ["스톤", p.g], ["종류", TYPE_ALL[p.t] || p.t], ...spec.map(([k, v]) => [k, v === true ? "예" : v])];
    const same = isBag ? [] : D.jewelry.filter(q => q.b === p.b && q.c === p.c && q.v !== p.v).map(q => ({ q, R: rep(q) })).sort((a, b2) => (b2.R.save ?? -9) - (a.R.save ?? -9)).slice(0, 6).map(o => itemOf(o.q));
    const kurl = safeUrl((p.p.KR || [])[2]) || safeUrl(Object.values(p.p).map(x => x[2]).find(Boolean));
    if (isM() && R.best) {
      // 제품 화면 아래 띠 하나 (2026-10-28): 아래 메뉴 대신 '가장 싼 곳 · 진짜가격 · 아끼는 금액 + 담기'
      fixbar.innerHTML = `<div class="fxinfo"><span class="fxwhere">가장 싼 곳 ${cc(R.best.cc)} ${esc(C[R.best.cc].n)}</span><span><b>${won(R.best.net)}</b>${R.save > 0 && R.kr ? ` <span class="save">${esc(krLab(R))}보다 ${won(R.kr.net - R.best.net)} 아껴요</span>` : ""}</span></div><button type="button" class="btn" data-pick="${esc(p.b + "|" + p.s)}">${on ? "♥ 담음" : "♡ 담기"}</button>`;
      fixbar.hidden = false;
    }
    return `<nav class="crumb"><a href="#/">홈</a> › <a href="#/brand/${encodeURIComponent(p.b)}">${esc(bk(p.b))}</a>${p.c ? ` › <a href="#/brand/${encodeURIComponent(p.b)}?c=${encodeURIComponent(p.c)}">${esc(colName(p.c))}</a>` : ""}</nav>
      <section class="pd" data-brand="${esc(bk(p.b))}">
        <div class="pdimg">${photo(p.imgs && p.imgs[pImg] ? { ...p, img: p.imgs[pImg] } : p, "big")}
          ${p.imgs && p.imgs.length > 1 ? `<div class="pthumbs">${p.imgs.map((u, i) => `<button type="button" class="${i === pImg ? "on" : ""}" data-pimg="${i}" aria-label="사진 ${i + 1}">${photo({ ...p, img: u })}</button>`).join("")}</div>` : ""}
          ${brandState[p.b] === "loading" ? `<p class="note">나라별 공홈 주소를 읽는 중…</p>` : brandState[p.b] === "fail" ? `<p class="note">공홈 주소 파일을 읽지 못했어요 (data/brands)</p>` : ""}</div>
        <div class="pdtx">
          <div class="br">${esc(p.b.toUpperCase())}${p.c ? " · " + esc(colName(p.c).toUpperCase()) : ""}</div>
          <h1 class="${isM() ? "clamp2" : ""}" data-expand>${esc(p.n)}</h1>
          <div class="sku">제품번호 ${esc(p.s)}${p.ne ? " · " + esc(p.ne) : ""}</div>
          <div class="verdict">${R.best ? `<div>${conclusion}</div><div class="vnum">${won(R.best.net)} ${R.save !== null ? (R.save > 0 ? `<span class="save">${krLab(R)}보다 ${pct(R.save)} (${won(R.kr.net - R.best.net)})</span>` : `<span class="kr">한국이 더 싸거나 같아요</span>`) : `<span class="kr">한국 미판매</span>`}</div>${R.outlier ? `<div class="warnline">가격 확인 필요 — ${esc(p.ck)}</div>` : ""}` : conclusion}</div>
          ${!R.best ? "" : R.best.t === 2 && R.best.cc !== "KR"
            ? `<p class="stocknote sm" role="note"><b>⚠ ${esc(C[R.best.cc].n)} 공홈은 지금 온라인 품절·미판매예요</b> 매장에 재고가 있는지 꼭 확인하세요.</p>`
            : stockNote(true)}
          ${varHtml}
          <div class="acts"><button type="button" class="btn" data-pick="${esc(p.b + "|" + p.s)}">${on ? "♥ 담음" : "♡ 담기"}</button>${kurl ? `<a class="btn ghost" href="${esc(kurl)}" target="_blank" rel="noopener noreferrer">공홈에서 보기 ↗</a>` : ""}<button type="button" class="btn ghost" data-copylink="${esc(shareUrl(p))}">링크 복사</button></div>
          ${stockNote()}
        </div></section>
      <section class="sec"><div class="sh"><h3>나라별 ${JINGA}</h3><span class="note">내 여행지 먼저 · 행을 누르면 계산 과정</span><a class="link" href="#/settings">${esc(setSummary())} ✎</a></div>${table}</section>
      <div class="two">
        ${isM() ? "" : `<section class="sec"><div class="sh"><h3>나라별 막대</h3></div><ol class="rank wide">${bars.map(r => `<li class="${S.trip.includes(r.cc) ? "mine" : ""} ${r.net === minNet ? "best" : ""}">${nationF(r.cc)}<span class="bar"><i style="width:${r.net / mx * 100}%" class="${r.cc === "KR" ? "krbar" : ""}"></i></span><b>${man(r.net)}</b></li>`).join("")}</ol></section>`}
        <section class="sec"><div class="sh"><h3>제품 정보</h3></div><dl class="spec">${info.filter(([, v]) => v).map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(String(v).slice(0, 300))}</dd>`).join("")}</dl>
          </section>
      </div>
      ${same.length ? `<section class="sec"><div class="sh"><h3>같은 컬렉션</h3></div>${isM() ? lrows(same.slice(0, 4).map(it => rowItem(it))) : grid(same, "g6")}</section>` : ""}`;
  }

  // ── S-09 설정 (5.15절): 질문으로 묻고, 바꾸는 즉시 미리보기 제품의 진가가 바뀜 ──
  const segBtns = (key, opts) => `<div class="seg" role="radiogroup">${opts.map(([v, l]) => {
    const on = JSON.stringify(SET[key]) === JSON.stringify(v);
    return `<button type="button" class="${on ? "on" : ""}" role="radio" aria-checked="${on}" data-set="${key}" data-val="${esc(JSON.stringify(v))}">${l}</button>`; }).join("")}</div>`;
  const numIn = (key, unit, step) => {
    const [mn, mx] = RANGE[key], v = key.includes(".") ? SET.euUp[key.split(".")[1]] : SET[key];
    return `<span class="numf"><input type="number" inputmode="decimal" data-num="${key}" min="${mn}" max="${mx}" step="${step || "any"}" value="${v}" aria-label="${key}"> ${unit}</span><span class="err" data-err="${key}"></span>`;
  };
  const q = (title, body, effect, extra) => `<div class="qrow"><div class="qt"><h4>${title}</h4>${effect ? `<p class="eff">${effect}</p>` : ""}</div><div class="qa">${body}${extra || ""}</div></div>`;
  // 미리보기 제품: 주얼리는 까르띠에 러브 팔찌(있으면), 패션은 일본·한국 가격이 있는 가방, 아니면 일본·한국 가격이 있는 첫 제품
  function sampleProduct() {
    return list().find(p => p.s === "B6067517") || (kind === "bag" && list().find(p => p.b === "Louis Vuitton" && p.t === "bag" && p.p.KR && p.p.JP && p.img && !p.n.includes(p.s)))
      || list().find(p => p.p.KR && p.p.JP && p.img) || list()[0];
  }
  function withDefaults(fn) { const keep = SET; SET = { ...DEF, onboarded: keep.onboarded, num: keep.num, theme: keep.theme }; cache.clear(); const r = fn(); SET = keep; cache.clear(); return r; }
  function previewCard() {
    const p = sampleProduct(), R = rep(p), base = withDefaults(() => rows(p).map(r => ({ cc: r.cc, net: r.net })));
    const show = (S.trip.length ? S.trip : R.all.slice(0, 3).map(r => r.cc)).filter(c => p.p[c]);
    const line = c => { const r = rows(p).find(x => x.cc === c), b = base.find(x => x.cc === c);
      if (!r || !r.v) return `<li><span class="pvn">${nationF(c)}</span><span class="pvp note">비교 안 함</span></li>`;
      const ch = b && Math.round(b.net) !== Math.round(r.net);
      // 나라 이름은 한 줄로 두고, 칸이 좁으면 값 묶음이 다음 줄 오른쪽으로 내려감
      return `<li><span class="pvn">${nationF(c)}</span><span class="pvp">${ch ? `<s>${won(b.net)}</s> → ` : ""}<b>${won(r.net)}</b></span></li>`; };
    return `<div class="pv" data-brand="${esc(bk(p.b))}">${photo(p)}<div class="pvtx"><p class="eyebrow">미리보기</p><div class="br">${esc(p.b)}</div><div class="nm">${esc(p.n)}</div>
      <ul class="pvl">${["KR", ...show.filter(c => c !== "KR")].map(line).join("")}</ul>
      <p class="note">설정을 바꾸면 바로 바뀌어요. 줄 그은 값은 기본 설정일 때.</p></div></div>`;
  }
  function settings(q2) {
    const d = diffs(), jpRate = ((0.10 - (SET.jpFeeOn ? SET.jpFee / 100 : 0)) / 1.1 * 100).toFixed(1);
    const sampleJp = (() => { const p = sampleProduct(); return p.p.JP ? !jpExcluded(p.b) : false; })();
    // 나라별 옵션: 내 여행지에 있는 나라를 위로
    const country = [
      { cs: ["JP"], html: q("일본 백화점에서 사요?", segBtns("jpDept", [[false, "아니요"], [true, "네"]]),
        `켜면 외국인 할인 ${SET.jpRate}%를 빼요. 이세탄·미쓰코시 앱 쿠폰, 이와타야 게스트 카드, 한큐 게스트 쿠폰(모두 여권)이 있어야 해요. <b class="stk">할인 대상 브랜드는 백화점·지점마다 달라 꼭 확인하세요.</b> 이세탄·미쓰코시 기준 할인 제외 브랜드(${Object.entries(D.jpExcl).filter(([, v]) => v[0]).map(([b]) => bk(b)).slice(0, 6).join("·")} 등)는 자동으로 빠져요.`,
        SET.jpDept ? `<div class="sub">할인율 ${numIn("jpRate", "%", "0.5")}</div>` : "") },
      { cs: ["US"], html: q("미국 어디서 사요?", segBtns("us", [["ny", "뉴욕 8.875%"], ["hawaii", "하와이 4.712%"], ["guam", "괌 0%"], ["custom", "직접 입력"]]),
        "하와이·괌 세율은 그 지역에 매장이 있는 브랜드에만 써요(없으면 뉴욕 세율).", SET.us === "custom" ? `<div class="sub">판매세 ${numIn("usTax", "%", "0.1")}</div>` : "") },
      ...CALC.coupons.map(cp => ({ cs: [cp.country], html: cpLive(cp)
        ? q(`${esc(cp.name)}에서 사요?`, `<div class="seg" role="radiogroup">${[[false, "아니요"], [true, "네"]].map(([v, l]) => { const on = !!SET.cp[cp.id] === v;
            return `<button type="button" class="${on ? "on" : ""}" role="radio" aria-checked="${on}" data-cp="${esc(cp.id)}" data-val="${v}">${l}</button>`; }).join("")}</div>`,
          `${offLinks(cp.links) ? `<span class="olinks">${offLinks(cp.links)}</span><br>` : ""}켜면 쿠폰 할인 ${cp.rate}%를 빼요 — <b>입점 브랜드만</b>(${cp.brands.length - Object.keys(cp.exclude || {}).length}개${Object.keys(cp.exclude || {}).length ? `, 쿠폰 제외 ${Object.keys(cp.exclude).map(bk).join("·")}` : ""}). <b class="stk">쿠폰·조건을 꼭 확인하세요.</b> 쿠폰 기간 ${ymd(cp.until)}까지, 지나면 자동으로 꺼져요. 다른 매장에서 사면 끄세요.`)
        : q(`${esc(cp.name)} 쿠폰`, `<p class="note">${cp.from && CALC.today() < cp.from ? `${ymd(cp.from)}부터` : `기간 끝남(${ymd(cp.until)})`}</p>`, "지금은 쿠폰을 쓸 수 없어 계산에 넣지 않아요.") })),
      ...NOTICES.map(n => ({ cs: [n.country], html: q(esc(n.title), `<p class="note">${offLinks(n.links) || "계산에 넣지 않아요."}</p>`, esc(n.text)) })),
      { cs: ["FR", "IT", "ES"], html: q("유럽 한 매장에서 €5,000 넘게 사요?", segBtns("euHigh", [[false, "아니요"], [true, "네"]]),
        "켜면 프랑스 +1%p · 이탈리아 +1.5%p · 스페인 +1%p 높은 환급률로 계산해요(추정치 — 환급사 계산기로 확인).") },
      { cs: ["TH"], html: q("태국은 많이 살수록 환급률이 높아요", `<p class="note">${D.thTiers.map(([a, r]) => `${a.toLocaleString("ko-KR")}바트 ${(r * 100).toFixed(1)}%`).join(" · ")}</p>`, "자동으로 계산해요. 바꿀 것은 없어요.") },
    ];
    const mine = country.filter(x => x.cs.some(c => S.trip.includes(c))), rest = country.filter(x => !mine.includes(x));
    const refTable = (head, rowsH) => `<table class="ref"><thead><tr>${head.map(h => `<th>${h}</th>`).join("")}</tr></thead><tbody>${rowsH.map(r => `<tr>${r.map(x => `<td>${x}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
    // 보던 화면으로 돌아가기 (띠의 [보기]·⚙·'설정 요약 ✎'로 들어온 경우) — 5.15절
    const back = backTo ? `<a class="backlink" href="#${esc(backTo)}">← 보던 화면으로 <small>${esc(routeName(backTo))}</small></a>` : "";
    return `${back}<div class="pagehead center"><p class="eyebrow">Settings</p><h1>설정</h1>
        <p class="lead">지금 계산 기준: <b>${esc(setSummary())}</b></p></div>
      <div class="setwrap">
        <div class="setmain">
          <section class="setsec"><div class="sth"><h3>내 상황</h3><button type="button" class="link" data-reset="pay,fee,refund,customs,self,krDisc">이 묶음 기본값으로</button></div>
            ${q("어떻게 결제하세요?", segBtns("pay", [["card", "신용카드 1.2%"], ["travel", "트래블카드 0%"], ["custom", "직접 입력"]]),
              "해외 결제 수수료예요. 원화 결제(DCC)는 3~8%가 더 붙으니 현지 통화로 결제하세요.", SET.pay === "custom" ? `<div class="sub">수수료 ${numIn("fee", "%", "0.1")}</div>` : "")}
            ${q("출국할 때 세금 환급을 받으세요?", segBtns("refund", [[true, "받아요"], [false, "안 받아요"]]),
              SET.refund ? `예: 일본은 약 ${jpRate}%, 프랑스는 약 ${C.FR.refund}%가 빠져요.` : "환급 없이 현지 가격 그대로 계산해요.")}
            ${q("한국 들어올 때 세관에 신고하세요?", segBtns("customs", [[true, "신고해요"], [false, "관세 없이 볼게요"]]),
              SET.customs ? "면세 한도 $800을 넘는 만큼 관세를 더해요(제품 1개 기준)." : "관세를 빼고 보면 해외가 실제보다 싸 보여요.",
              SET.customs ? `<div class="sub">${segBtns("self", [[true, "자진신고 (관세 30% 감면, 최대 20만원)"], [false, "감면 없이"]])}</div>` : "")}
            ${q("한국에서 살 때 받는 할인이 있어요?", segBtns("krDisc", [[0, "없어요"], [SET.krDisc || 5, "있어요"]]),
              "백화점 상품권·카드 할인 등. 한국 가격에서 빼고 비교해요.", SET.krDisc ? `<div class="sub">할인율 ${numIn("krDisc", "%", "0.5")}</div>` : "")}
            ${q("어디로 가세요?", `<button type="button" class="tchip" data-trip-open>✈ ${S.trip.length ? S.trip.map(c => esc(C[c].n)).join(" · ") : "여행지 고르기"}</button>`,
              "고르면 그 나라 옵션이 아래 '나라별 옵션' 맨 위로 올라와요.")}
          </section>
          <details class="setsec" ${isM() ? "" : "open"}><summary class="sth"><h3>나라별 옵션</h3></summary><div class="right"><button type="button" class="link" data-reset="jpDept,jpRate,cp,us,usTax,euHigh">이 묶음 기본값으로</button></div>
            ${mine.length ? `<p class="plabel">내 여행지</p>${mine.map(x => x.html).join("")}` : ""}
            ${rest.length ? `<details class="more2" ${mine.length ? "" : "open"}><summary>${mine.length ? "다른 나라 옵션 보기" : "나라별 옵션"}</summary>${rest.map(x => x.html).join("")}</details>` : ""}
          </details>
          <details class="setsec" ${isM() ? "" : "open"}><summary class="sth"><h3>보기</h3></summary><div class="right"><button type="button" class="link" data-reset="off,hide,tripOnly,num,theme">이 묶음 기본값으로</button></div>
            ${q("비교할 나라", `<div class="fopts">${TRIP_CODES.map(c => `<button type="button" class="fopt ${SET.off.includes(c) ? "" : "on"}" data-toggle-off="${c}">${flag(c)}${esc(C[c].n)}</button>`).join("")}</div>`, "끈 나라는 가장 싼 나라·순위 계산에서 빠져요. 한국은 늘 비교해요.")}
            ${q("내 여행지 나라만 비교", segBtns("tripOnly", [[false, "모든 나라"], [true, "한국 + 내 여행지만"]]))}
            ${q("관심 없는 브랜드 숨기기", `<div class="fopts">${[...new Set(list().map(p => p.b))].map(b => `<button type="button" class="fopt ${SET.hide.includes(b) ? "" : "on"}" data-toggle-hide="${esc(b)}">${brandMark(b, "sm")}</button>`).join("")}</div>`, "숨긴 브랜드도 브랜드를 직접 고르면 보여요.")}
            ${q("숫자 표기", segBtns("num", [["man", "812만"], ["M", "8.1M"]]))}
            ${q("화면 밝기", segBtns("theme", [["auto", "기기 따름"], ["light", "밝게"], ["dark", "어둡게"]]))}
          </details>
          <details class="setsec" ${isM() ? "" : "open"} id="set-fx"><summary class="sth"><h3>환율</h3></summary><div class="right"><button type="button" class="link" data-reset="fxMode,fxCustom">이 묶음 기본값으로</button></div>
            ${q("어떤 환율로 계산할까요?", segBtns("fxMode", [["live", "최신 환율"], ["build", `빌드 환율 (${M.fxDate.slice(5).replace("-", ".")})`], ["custom", "직접 입력"]]),
              SET.fxMode === "live" ? (FXL ? `${FXL.date} 기준 최신 환율로 계산해요. 페이지를 열 때마다 한 번 새로 받아요.` : "최신 환율을 아직 받지 못해서 빌드 환율로 계산하고 있어요.")
                : SET.fxMode === "build" ? "가격을 모은 날의 환율이에요. 엑셀 계산과 같아요." : "통화마다 원하는 값(예: 카드 청구 환율)을 넣어요. 빈칸은 최신(없으면 빌드) 환율을 써요.",
              `<div class="sub"><button type="button" class="btn ghost" data-fx-fetch ${fxState === "loading" ? "disabled" : ""}>${fxState === "loading" ? "받는 중…" : "최신 환율 다시 받기"}</button>
                <span class="note" id="fxMsg">${fxState.startsWith("fail:") ? "받지 못했어요 — " + esc(fxState.slice(5)) + (FXL ? ` (마지막 값 ${FXL.date} 사용)` : " (빌드 환율 사용)") : fxState === "ok" ? "방금 받았어요" : ""}</span></div>`)}
            <table class="ref fxt"><thead><tr><th>통화</th><th>빌드 ${esc(M.fxDate.slice(5))}</th><th>최신 ${FXL ? esc(FXL.date.slice(5)) : "—"}</th><th>지금 계산</th></tr></thead><tbody>
              ${CURS.map(cur => `<tr><td>${esc(cur)} <small>${esc(CODES.filter(c => C[c].cur === cur).map(c => C[c].n).join("·"))}</small></td><td>${fxFmt(FX_BUILD[cur])}</td><td>${FXL ? fxFmt(FXL.rates[cur]) : "—"}</td>
                <td>${SET.fxMode === "custom" ? `<input class="fxin" type="number" inputmode="decimal" step="any" data-fx="${esc(cur)}" value="${SET.fxCustom[cur] ?? ""}" placeholder="${fxFmt(FXL ? FXL.rates[cur] : FX_BUILD[cur])}" aria-label="${esc(cur)} 1단위 원화">` : `<b>${fxFmt(fxNow(cur))}</b>`}</td></tr>`).join("")}
            </tbody></table>
            <p class="note" data-err="fx"></p>
            <p class="note">통화 1단위의 원화 값이에요. 시장 환율이라 카드 청구 환율과 1% 안팎 다를 수 있어요. 최신 환율은 <a class="link" href="https://www.exchangerate-api.com" target="_blank" rel="noopener noreferrer">Rates By Exchange Rate API</a>에서 받아요(이 기기 주소 외에는 아무것도 보내지 않아요).</p>
          </details>
          <details class="setsec adv"><summary><h3>고급 설정</h3></summary>
            ${q("일본 택스리펀드 수수료", segBtns("jpFeeOn", [[true, "반영"], [false, "없이(최대 9.09%)"]]), `일본 환급률 = (10% − 수수료) ÷ 1.1 → 지금 약 ${jpRate}%`, SET.jpFeeOn ? `<div class="sub">수수료율 ${numIn("jpFee", "%", "0.05")}</div>` : "")}
            ${q("유럽 고액 기준 금액·상향 폭", `<div class="sub">기준 ${numIn("euThr", "€", "100")}</div><div class="sub">프랑스 ${numIn("euUp.FR", "%p", "0.1")} 이탈리아 ${numIn("euUp.IT", "%p", "0.1")} 스페인 ${numIn("euUp.ES", "%p", "0.1")}</div>`, "'유럽 한 매장에서 €5,000 넘게 사요?'를 켰을 때만 써요.")}
            ${q("오래된 가격 경고", numIn("stale", "일", "1"), "수집한 지 이 일수가 지난 나라 가격에 '오래된 가격'을 표시해요(엑셀과 같은 30일 기본).")}
          </details>
          <details class="setsec adv"><summary><h3>계산 기준 보기</h3><span class="note">법·제도로 정해진 값 — 바꿀 수 없어요</span></summary>
            <h4 class="refh">관세 (관세청 여행자 휴대품 기준, 2026-10-25 확인)</h4>
            ${refTable(["항목", "값"], [["면세 한도", "$800 (한 사람 전체에서 한 번)"], ["간이세율", "보석: 4,808,000원까지 15%, 넘는 부분 45% · 시계·가방: 1,923,000원까지 15%, 넘는 부분 45%"],
              ["간이세율 적용 배제", "한 개 과세가격 1,000만원 초과 → 일반 과세"], ["일반 과세", "관세 8% + 개별소비세 20%(보석 500만·시계·가방 200만원 넘는 부분) + 교육세 30% + 부가세 10%"],
              ["자진신고 감면", "관세의 30%, 최대 20만원"]])}
            <h4 class="refh">나라별 세금·환급 (빌드 ${esc(D.generated)} · 환율은 지금 계산에 쓰는 값)</h4>
            ${refTable(["나라", "세율", "실효 환급률", "최소 구매", "환율"], TRIP_CODES.map(c => [nationF(c), C[c].tax + "%" + (C[c].incl ? "" : " (별도)"), C[c].refund ? C[c].refund + "%" : "없음", C[c].min ? local(c, C[c].min) : "—", "₩" + fxFmt(D.fx[c])]))}
            <h4 class="refh">태국 환급률 구간</h4>
            ${refTable(["구매액", "환급률"], D.thTiers.map(([a, r]) => [a.toLocaleString("ko-KR") + "바트 이상", (r * 100).toFixed(1) + "%"]))}
            <h4 class="refh">일본 백화점 할인 제외 브랜드 (이세탄·미쓰코시 기준 · 앱 쿠폰·이와타야 게스트 카드·한큐 게스트 쿠폰)</h4>
            ${refTable(["브랜드", "할인", "근거"], Object.entries(D.jpExcl).map(([b, [ex, why]]) => [esc(bk(b)), ex ? "제외" : "가능", esc(why)]))}
            <h4 class="refh">기간 쿠폰</h4>
            ${refTable(["쿠폰", "할인", "기간", "할인 브랜드", "입점했지만 제외", "근거"], CALC.coupons.map(cp => [esc(cp.name) + (cpLive(cp) ? "" : " (지금 못 씀)"), cp.rate + "%", `${cp.from ? esc(cp.from) + " ~ " : "~ "}${esc(cp.until)}`,
              esc(cp.brands.filter(b => !(cp.exclude || {})[b]).map(bk).join("·")), esc(Object.entries(cp.exclude || {}).map(([b, w]) => `${bk(b)}(${w})`).join(", ") || "알려진 것 없음"), `<a class="link" href="${esc(cp.source)}" target="_blank" rel="noopener noreferrer">쿠폰 ↗</a> ${esc(cp.checked || "")} 확인 · 브랜드 ${esc(cp.brandsChecked || "")} 확인`]))}
            <h4 class="refh">하와이·괌 매장</h4>
            ${refTable(["브랜드", "하와이", "괌"], Object.entries(D.stores).map(([b, [h, g]]) => [esc(bk(b)), esc(h), esc(g)]))}
          </details>
          <details class="setsec" ${isM() ? "" : "open"}><summary class="sth"><h3>데이터·백업</h3></summary>
            ${q("데이터", `<p class="note">버전 ${esc(M.version)} · 데이터 ${esc(D.generated)} · ${esc(fxLabel())} · 제품 ${list().length.toLocaleString("ko-KR")}개</p><a class="link" href="#/settings/status">데이터 상태 보기</a>`)}
            ${q("담은 목록·설정 백업", `<button type="button" class="btn ghost" data-export>파일로 내보내기</button> <label class="btn ghost">파일에서 가져오기<input type="file" accept="application/json,.json" data-import hidden></label><p class="note" id="impMsg"></p>`, "이 기기에만 저장돼요. 브라우저를 바꾸기 전에 내보내 두세요.")}
          </details>
          <div class="center setend">${backTo ? `<a class="btn" href="#${esc(backTo)}">설정 끝 · 보던 화면으로</a>` : ""}<button type="button" class="btn ghost" data-reset="all">모든 설정 기본값으로</button></div>
        </div>
        <aside class="setside">${previewCard()}${d.length ? `<p class="note">기본값과 다른 설정 ${d.length}개</p>` : ""}</aside>
      </div>`;
  }
  // 처음 3가지 질문 (첫 화면 히어로 아래, 한 번 답하면 다시 안 나옴)
  const onbQs = () => `<div class="onbq"><span>결제는</span>${segBtns("pay", [["card", "신용카드"], ["travel", "트래블카드"]])}</div>
    <div class="onbq"><span>세금 환급은</span>${segBtns("refund", [[true, "받아요"], [false, "안 받아요"]])}</div>
    <div class="onbq"><span>세관 신고는</span>${segBtns("customs", [[true, "해요"], [false, "관세 없이"]])}</div>`;
  let onbSheet = false;  // 모바일: 세 가지 질문 아래 판이 열려 있음
  function openOnbSheet() {
    panel.innerHTML = `<div class="sheet" role="dialog" aria-label="세 가지 질문"><div class="grab"></div><h3>세 가지만 알려 주세요 <small>나중에 설정에서 바꿀 수 있어요</small></h3>
      ${onbQs()}<div class="row"><button type="button" class="link" data-onboard>건너뛰기</button><button type="button" class="btn" data-onboard>완료</button></div></div>`;
    panel.hidden = false;
  }
  const onboardCard = () => SET.onboarded ? "" : isM()
    ? `<div class="onbband"><span>세 가지만 알려 주시면 더 정확해져요</span><button type="button" class="btn" data-onb-open>시작</button><button type="button" class="link" data-onboard aria-label="닫기">✕</button></div>`
    : `<section class="onb"><div><p class="eyebrow">3 Questions</p><h3>세 가지만 알려 주시면 더 정확해져요</h3></div>
    <div class="onbq"><span>결제는</span>${segBtns("pay", [["card", "신용카드"], ["travel", "트래블카드"]])}</div>
    <div class="onbq"><span>세금 환급은</span>${segBtns("refund", [[true, "받아요"], [false, "안 받아요"]])}</div>
    <div class="onbq"><span>세관 신고는</span>${segBtns("customs", [[true, "해요"], [false, "관세 없이"]])}</div>
    <div class="onbbtn"><button type="button" class="btn" data-onboard>완료</button><button type="button" class="link" data-onboard>건너뛰기</button></div></section>`;
  // 백업 (4.2a절): 형식을 확인한 값만 가져옴
  function exportBackup() {
    const data = { app: "jinga", kind, version: 1, picks: S.picks, trip: S.trip, settings: SET };
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
    a.download = `jinga-${kind === "bag" ? "fashion" : "jewelry"}-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
  function importBackup(file) {
    const msg = t => { const m = document.getElementById("impMsg"); if (m) m.textContent = t; };
    if (file.size > 200_000) return msg("파일이 너무 커요.");
    file.text().then(txt => {
      let d; try { d = JSON.parse(txt); } catch (e) { return msg("백업 파일 형식이 아니에요."); }
      if (!d || !["jinga", "chamgap"].includes(d.app) || d.kind !== kind) return msg(kind === "bag" ? "럭스캐너 패션 백업 파일이 아니에요." : "럭스캐너 주얼리 백업 파일이 아니에요.");
      const picks = Array.isArray(d.picks) ? d.picks.filter(x => typeof x === "string" && /^[^|]{1,60}\|[\w.\-]{1,40}$/.test(x)).slice(0, 500) : [];
      const trip = Array.isArray(d.trip) ? d.trip.filter(c => TRIP_CODES.includes(c)).slice(0, 3) : [];
      const s = {}, src = d.settings || {};
      for (const [k, v] of Object.entries(DEF)) if (k in src && typeof src[k] === typeof v && !(Array.isArray(v) && !Array.isArray(src[k]))) s[k] = src[k];
      if (s.off) s.off = s.off.filter(c => TRIP_CODES.includes(c));
      if (s.hide) s.hide = s.hide.filter(b => typeof b === "string").slice(0, 50);
      if (s.fxMode && !["live", "build", "custom"].includes(s.fxMode)) delete s.fxMode;
      if (s.fxCustom) s.fxCustom = Object.fromEntries(Object.entries(s.fxCustom).filter(([c, v]) => CURS.includes(c) && fxOk(c, v)));
      for (const [k, [mn, mx]] of Object.entries(RANGE)) if (!k.includes(".") && k in s && !(s[k] >= mn && s[k] <= mx)) delete s[k];
      const dropped = (Array.isArray(d.picks) ? d.picks.length : 0) - picks.length;
      S.picks = picks; store.set(pickKey(), picks); S.trip = trip; store.set(tripKey(), trip); saveSet(s);
      render(); setTimeout(() => msg(`가져왔어요. 담은 제품 ${picks.length}개${dropped ? ` (형식이 맞지 않는 ${dropped}개는 뺐어요)` : ""}.`), 50);
    });
  }

  // ── S-08 담은 목록 (5.14절): 한 나라에서 다 살 때 합계 진가, 관세는 합계로 ──
  function picks() {
    const all = S.picks.map(k => { const i = k.indexOf("|"); return findP(k.slice(0, i), k.slice(i + 1)); });
    const ps = all.filter(Boolean), gone = all.length - ps.length;
    const head = `<div class="pagehead center"><p class="eyebrow">Picks</p><h1>담은 목록</h1>`;
    if (!ps.length) return `${head}<p class="lead">${gone ? `담은 제품 ${gone}개가 이번 데이터에 없어요. ` : ""}아직 담은 제품이 없어요. 제품의 ♡를 누르면 여기 모여요.</p><a class="btn" href="#/search">제품 찾기</a></div>`;
    const kr = basket(ps, "KR");
    const cs = TRIP_CODES.map(c => ({ c, net: basket(ps, c) })), can = cs.filter(o => o.net !== null).sort((a, b) => a.net - b.net);
    const part = cs.filter(o => o.net === null).map(o => o.c);
    const order = [...can.filter(o => S.trip.includes(o.c)), ...can.filter(o => !S.trip.includes(o.c))];
    const best = can[0], mx = Math.max(kr || 0, ...can.map(o => o.net));
    const line = o => `<li class="${S.trip.includes(o.c) ? "mine" : ""} ${o === best ? "best" : ""}"><span>${S.trip.includes(o.c) ? "✈ " : ""}${nationF(o.c)}</span><span class="bar"><i style="width:${o.net / mx * 100}%"></i></span><b>${won(o.net)}</b><small>${kr ? (kr > o.net ? `${won(kr - o.net)} 아낌` : `한국보다 ${won(o.net - kr)} 비쌈`) : ""}</small></li>`;
    return `${head}<p class="lead">${ps.length}개 · 한 나라에서 함께 살 때 합계 ${JINGA} · 관세는 합계에서 $800를 한 번만 빼요</p></div>
      <section class="sec shop"><div class="shopbox">
        ${stockNote(true)}
        <div class="shophead">${!best ? "이 제품들을 모두 파는 나라가 없어요" : kr && kr > best.net ? `${nationF(best.c)}에서 다 사면 <b>${won(kr - best.net)}</b> 아껴요` : kr ? "한국에서 사는 게 가장 싸요" : `가장 싼 곳은 ${nationF(best.c)}`}</div>
        <ol class="plist">${kr ? `<li class="kr"><span>${nationF("KR")} <small>기준</small></span><span class="bar"><i style="width:${kr / mx * 100}%"></i></span><b>${won(kr)}</b><small></small></li>` : ""}${order.map(line).join("")}</ol>
        ${part.length ? `<p class="shopfoot">일부만 파는 나라 ${part.length}곳은 뺐어요 (${part.map(c => esc(C[c].n)).join(" · ")})</p>` : ""}
        <p class="shopfoot">1,000만원 이하 제품은 합계에 간이세율, 넘는 제품은 그 제품만 일반 과세 (7장) · 지금 설정: ${esc(setSummary())} <a class="link" href="#/settings">바꾸기</a></p>
      </div></section>
      <section class="sec"><div class="sh"><h2>담은 제품</h2>${gone ? `<p class="note">이번 데이터에 없는 제품 ${gone}개는 뺐어요</p>` : ""}</div>${grid(ps.map(itemOf))}</section>`;
  }
  // ── S-07 가격 변동 (5.13절): 한국 변동 먼저, 오른·내린 ──
  function changesPage(q) {
    const all = D.changes.map(c => ({ c, p: findP(c.b, c.s) })).filter(o => o.p);
    const tab = q.get("tab") || (all.some(o => o.c.cc === "KR") || !all.length ? "kr" : "abroad");  // 한국 변동이 없으면 해외 칸부터 (2026-10-28)
    const pick = { kr: o => o.c.cc === "KR", abroad: o => o.c.cc !== "KR", up: o => o.c.r > 0, down: o => o.c.r < 0 }[tab] || (() => true);
    const rowsC = all.filter(pick).sort((a, b) => (b.c.d || "").localeCompare(a.c.d || "") || Math.abs(b.c.r) - Math.abs(a.c.r));
    const n = f => all.filter(f).length;
    const tabs = [["kr", "한국", n(o => o.c.cc === "KR")], ["abroad", "해외", n(o => o.c.cc !== "KR")], ["up", "오름", n(o => o.c.r > 0)], ["down", "내림", n(o => o.c.r < 0)]];
    const big = o => Math.abs(o.c.r) >= 0.5;  // 절반 넘게 바뀐 값은 수집 오류일 수 있음
    return `<div class="pagehead center"><p class="eyebrow">Price Watch</p><h1>가격 변동</h1><p class="lead">지난 수집과 비교해 공홈 가격이 바뀐 제품 · 데이터 ${esc(D.generated)}</p></div>
      <div class="tabs">${tabs.map(([k, l, c]) => `<button type="button" class="tab ${k === tab ? "on" : ""}" data-chtab="${k}">${l} <small>${c}</small></button>`).join("")}</div>
      ${rowsC.length ? `<div class="lrows">${rowsC.map(o => rowItem(itemOf(o.p), `<div class="chg ${o.c.r < 0 ? "down" : "up"}">${o.c.r < 0 ? "▼" : "▲"} ${cc(o.c.cc)} ${esc(C[o.c.cc].n)} ${local(o.c.cc, o.c.o)} → ${local(o.c.cc, o.c.nw)} (${o.c.r > 0 ? "+" : "−"}${Math.abs(o.c.r * 100).toFixed(1)}%) · ${esc((o.c.d || "").slice(5))}${big(o) ? ` · <span class="warn">값 확인 필요</span>` : ""}</div>`)).join("")}</div>`
        : `<p class="empty">이 구분에는 바뀐 제품이 없어요.</p>`}`;
  }
  // ── S-09a 데이터 상태 (5.15절): 브랜드 × 나라, 가격이 있는 제품 비율 ──
  function status() {
    const by = {};
    for (const p of list()) (by[p.b] = by[p.b] || []).push(p);
    const today = new Date(), days = d => d ? Math.floor((today - new Date(d + "T00:00:00")) / 864e5) : null;
    const stale = CODES.filter(c => days(M.priceDate[c]) > SET.stale);
    const cell = (ps, c) => { const k = ps.filter(p => p.p[c] && p.p[c][0]).length, r = k / ps.length;
      return `<td style="--a:${(0.08 + r * 0.6).toFixed(2)}" title="${esc(C[c].n)} · ${k}/${ps.length}개 · 수집 ${esc(M.priceDate[c] || "")}">${k ? Math.round(r * 100) + "%" : "—"}</td>`; };
    return `<nav class="crumb"><a href="#/settings">설정</a> › 데이터 상태</nav>
      <div class="pagehead"><h1>데이터 상태</h1><p class="lead">버전 ${esc(M.version)} · 만든 때 ${esc(M.builtAt.replace("T", " ").slice(0, 16))} UTC · 환율 ${esc(M.fxDate)} · 제품 ${list().length.toLocaleString("ko-KR")}개</p>
        ${stale.length ? `<p class="warnline">오래된 가격(${SET.stale}일 초과): ${stale.map(c => esc(C[c].n)).join(" · ")}</p>` : `<p class="note">모든 나라 가격이 ${SET.stale}일 안에 수집됐어요 (설정 '오래된 가격 경고')</p>`}</div>
      <div class="stwrap"><table class="sttable"><thead><tr><th>브랜드</th><th>제품</th>${CODES.map(c => `<th title="${esc(C[c].n)}">${c}</th>`).join("")}</tr></thead>
        <tbody>${Object.entries(by).sort((a, b) => b[1].length - a[1].length).map(([b, ps]) => `<tr><th>${esc(bk(b))}</th><td>${ps.length}</td>${CODES.map(c => cell(ps, c)).join("")}</tr>`).join("")}</tbody></table></div>
      <p class="note">칸 = 그 나라 공홈 가격이 있는 제품 비율 (진할수록 많음). 칸에 마우스를 올리면 개수·수집일.</p>`;
  }
  const notFound = () => `<div class="pagehead"><h1>찾는 화면이 없어요</h1><a class="btn" href="#/">첫 화면</a> <a class="btn ghost" href="#/search">찾기</a></div>`;

  // ── 주소 → 화면 ──
  let lastRoute = "";
  // 설정에 들어오기 전 화면과 스크롤 위치 — 돌아가면 그 자리로
  let backTo = "", backY = 0, restoreY = null;
  const routeName = r => { const s = r.split("?")[0].split("/")[1] || ""; return ({ "": "첫 화면", p: "제품", search: "찾기", brand: "브랜드", country: "여행지", picks: "담은 목록", changes: "가격 변동", events: "이벤트" })[s] || ""; };
  // ── 이벤트 (2026-10-29): 종류·지역으로 골라 보기. YYYY-MM-DD 는 휴대폰 날짜로 그날 0시~끝날 24시 ──
  const evTime = (s, end) => {
    if (!s) return end ? Infinity : -Infinity;
    const m = /^(\d{4})-(\d\d)-(\d\d)$/.exec(s);
    if (m) return end ? new Date(+m[1], m[2] - 1, +m[3] + 1).getTime() - 1 : new Date(+m[1], m[2] - 1, +m[3]).getTime();
    const t = Date.parse(s); return isNaN(t) ? (end ? -Infinity : Infinity) : t;
  };
  const evLive = e => { const now = Date.now(); return evTime(e.from, false) <= now && now <= evTime(e.until, true); };
  // 미리보기 (2026-10-29): 웹 주소 뒤 ?preview=1 (예: #/events?preview=1) — 샘플("sample": true)·시작 전 이벤트도 보임. 앱에는 주소창이 없어 못 들어감
  const evPreview = () => !window.LUX_APP && /[?&]preview=1(&|$)/.test(location.hash);
  const liveEvents = () => { const pv = evPreview(), now = Date.now();
    return EV.events.filter(e => pv ? now <= evTime(e.until, true) : evLive(e) && !e.sample)
      .sort((a, b) => (b.priority || 0) - (a.priority || 0) || evTime(a.until, true) - evTime(b.until, true)); };
  const catName = id => (EV.categories.find(c => c.id === id) || {}).name || id;
  const evDate = s => s ? s.slice(5, 10).replace("-", ".") : "";
  const dLeft = e => { const d = Math.ceil((evTime(e.until, true) - Date.now()) / 864e5); return d <= 1 ? "오늘 끝" : d <= 7 ? `D-${d - 1}` : ""; };
  const evStrip = (l, h) => l.length ? `<a class="evstrip" href="${h}"><span class="evcat">이벤트</span><span class="evt">${esc(l[0].title)}${l.length > 1 ? ` 외 ${l.length - 1}개` : ""}</span><span class="evgo">›</span></a>` : "";
  const evCard = e => {
    const links = (e.links || []).filter(l => safeUrl(l.url));
    return `<article class="evcard${e.sponsor ? " ad" : ""}">
      <div class="evtop">${e.sponsor && e.category === "ad" ? "" : `<span class="evcat">${esc(catName(e.category))}</span>`}${e.sponsor ? `<span class="evad">광고 · ${esc(e.sponsor)}</span>` : ""}
        <span class="evwhere">${e.countries.length ? e.countries.filter(c => C[c]).map(nationF).join(" ") : "모든 지역"}</span></div>
      ${e.sample || evTime(e.from, false) > Date.now() ? `<p class="evpv">${e.sample ? "샘플" : ""}${e.sample && evTime(e.from, false) > Date.now() ? " · " : ""}${evTime(e.from, false) > Date.now() ? `시작 전 · ${evDate(e.from)}부터` : ""} — 미리보기에만 보여요</p>` : ""}
      <h3>${esc(e.title)}</h3>${e.text ? `<p>${esc(e.text)}</p>` : ""}
      ${e.brands.length ? `<p class="evbr">${e.brands.map(b => esc(bk(b))).join(" · ")}</p>` : ""}
      <p class="evwhen">${e.period ? `행사 ${esc(e.period)}` : `${e.from ? evDate(e.from) + " ~ " : "~ "}${evDate(e.until)}`}${!e.period && dLeft(e) ? ` <b>${dLeft(e)}</b>` : ""}</p>
      ${links.length ? `<p class="evlinks">${links.map(l => `<a class="link" href="${esc(l.url)}" target="_blank" rel="noopener noreferrer${e.sponsor ? " sponsored" : ""}">${esc(l.label)} ↗</a>`).join(" · ")}</p>` : ""}
    </article>`;
  };
  // 묶음 페이지 (2026-10-29): 노출 기간 안의 것만. 미리보기(?preview=1)는 샘플·시작 전도
  const livePages = () => { const pv = evPreview(), now = Date.now();
    return (EV.pages || []).filter(pg => pv ? now <= evTime(pg.until, true) : !pg.sample && evTime(pg.from, false) <= now && now <= evTime(pg.until, true)); };
  function eventPage(id) {
    const pg = (EV.pages || []).find(x => x.id === id);
    if (!pg || !livePages().includes(pg)) return `<div class="pagehead center"><h1>이벤트가 끝났어요</h1><p class="lead"><a class="link" href="#/events">진행 중인 이벤트 보기</a></p></div>`;
    const evs = pg.events.map(i => EV.events.find(e => e.id === i)).filter(Boolean);
    setTimeout(evImgFill, 0);
    return `<nav class="crumb"><a href="#/">홈</a> › <a href="#/events">이벤트</a> › ${esc(pg.title)}</nav>
      ${pg.banner && pg.banner.image ? `<div class="evhero">${evImg(pg.banner, "evheroimg")}</div>` : ""}
      <div class="pagehead center evphead">${pg.banner && pg.banner.eyebrow ? `<p class="eyebrow">${esc(pg.banner.eyebrow)}</p>` : ""}<h1>${esc(pg.title)}</h1>${pg.sub ? `<p class="lead">${esc(pg.sub)}</p>` : ""}
        <p class="evwhen">이 페이지는 ${evDate(pg.until)}까지 보여요</p></div>
      <div class="evlist">${evs.map(evCard).join("")}</div>
      <p class="note center evnote">행사·카드 조건은 바뀔 수 있어요. 사러 가기 전에 공식 안내와 매장에서 꼭 확인하세요. 럭스캐너는 각 매장·카드사와 관계없는 정보 모음이에요.</p>`;
  }
  function eventsPage(q) {
    const all = liveEvents(), cat = q.get("cat") || "", cc = q.get("cc") || "";
    const inCat = e => !cat || e.category === cat, inCc = e => !cc || !e.countries.length || e.countries.includes(cc);
    const shown = all.filter(e => inCat(e) && inCc(e));
    const href = (k, v) => { const p = new URLSearchParams(q); v ? p.set(k, v) : p.delete(k); const s = p.toString(); return "#/events" + (s ? "?" + s : ""); };
    const cats = EV.categories.filter(c => all.some(e => e.category === c.id && inCc(e)));
    const ccs = [...new Set(all.filter(inCat).flatMap(e => e.countries))].filter(c => C[c]).sort((a, b) => TRIP_CODES.indexOf(a) - TRIP_CODES.indexOf(b));
    const chip = (on, h, label, n) => `<a class="tchip ${on ? "on" : ""}" href="${h}">${label}${n !== undefined ? ` <small>${n}</small>` : ""}</a>`;
    return `<div class="pagehead center"><p class="eyebrow">Events</p><h1>이벤트</h1><p class="lead">해외 매장 프로모션·세일·면세 행사 — 기간 안에만 보여요</p></div>
      ${evPreview() ? `<p class="evpvbar">미리보기 — 샘플과 시작 전 이벤트도 보여요. 일반 화면·앱에는 보이지 않아요. <a class="link" href="#/events">미리보기 끄기</a></p>` : ""}
      ${livePages().length ? `<div class="evpages">${livePages().map(pg => `<a class="evpage" href="#/events/${esc(pg.id)}${evPreview() ? "?preview=1" : ""}"><b>${esc(pg.title)}</b><small>${esc(pg.sub)}</small><span class="evgo">›</span></a>`).join("")}</div>` : ""}
      <div class="evfilter"><div class="chiprow"><span class="evlab">종류</span>${chip(!cat, href("cat", ""), "전체", all.filter(inCc).length)}${cats.map(c => chip(cat === c.id, href("cat", c.id), esc(c.name), all.filter(e => e.category === c.id && inCc(e)).length)).join("")}</div>
        <div class="chiprow"><span class="evlab">지역</span>${chip(!cc, href("cc", ""), "전체")}${ccs.map(c => chip(cc === c, href("cc", c), nationF(c))).join("")}</div></div>
      ${shown.length ? `<div class="evlist">${shown.map(evCard).join("")}</div>` : `<p class="empty">${all.length ? "이 조건에 맞는 이벤트가 없어요." : "지금 진행 중인 이벤트가 없어요."}</p>`}
      <p class="note center evnote">이벤트 조건은 매장·브랜드마다 달라요. 사러 가기 전에 공식 안내를 꼭 확인하세요.${all.some(e => e.sponsor) ? " '광고' 표시는 광고주가 낸 안내예요." : ""}</p>`;
  }
  // 뒤로 가기 (앱, 2026-10-29): 화면 위 ‹ 버튼 + 안드로이드 뒤로 키. 열린 판을 먼저 닫고, 앱 안에서 옮겨 온 화면이면 이전 화면, 아니면 첫 화면.
  // 깊이는 history.state.d 에 적어 둠(새 화면 = 이전 깊이 + 1, 뒤로 온 화면 = 적어 둔 값)
  let navDepth = 0;
  const isHome = () => (location.hash.slice(1) || "/").split("?")[0] === "/";
  const backBtn = document.getElementById("backBtn");
  function trackNav() {
    const st = history.state;
    if (st && typeof st.d === "number") navDepth = st.d;
    else { navDepth = isHome() ? 0 : navDepth + 1; history.replaceState({ ...(st || {}), d: navDepth }, ""); }
    const show = !!window.LUX_APP && !isHome();
    if (backBtn) backBtn.hidden = !show;
    document.body.classList.toggle("canback", show);
  }
  function goBack() {  // 한 일이 있으면 true (첫 화면에서 닫을 판도 없으면 false → 안드로이드는 앱 닫기)
    if (!panel.hidden) { panel.hidden = true; onbSheet = false; return true; }
    if (panelOpen) { panelOpen = false; document.body.classList.remove("noscroll"); render(); return true; }
    if (acOpen) { acOpen = false; render(); return true; }
    if (isHome()) return false;
    if (navDepth > 0) {
      const was = location.hash;
      history.back();
      setTimeout(() => { if (location.hash === was) location.hash = "#/"; }, 400);  // 되돌아갈 기록이 없었으면 첫 화면으로
    } else location.hash = "#/";
    return true;
  }
  // 뒤로 가기 때 보던 자리 (2026-10-30 사용자: 제품 화면에서 돌아오면 목록 맨 위로 가서 다시 스크롤해야 함)
  // 화면을 떠날 때 스크롤·'더 보기'로 늘린 개수를 주소별로 적어 두고, 뒤로(기록에 이미 있는 화면으로) 돌아오면 되살림
  const memo = new Map();
  if ("scrollRestoration" in history) history.scrollRestoration = "manual";
  function saveSpot() {
    if (!lastRoute) return;
    memo.delete(lastRoute); memo.set(lastRoute, { y: window.scrollY, showN, countryShow, brandShow, homeMore });
    if (memo.size > 60) memo.delete(memo.keys().next().value);
  }
  function render() {
    const back = !!(history.state && typeof history.state.d === "number");  // 새로 연 화면은 아직 d 가 없음 → 기록에 있는 화면으로 돌아온 것
    trackNav();
    const raw = location.hash.slice(1) || "/", [path, qstr] = raw.split("?"), q = new URLSearchParams(qstr || "");
    const seg = path.split("/").filter(Boolean).map(decodeURIComponent);
    const inSet = path === "/settings", wasSet = lastRoute.split("?")[0] === "/settings";
    if (inSet && !wasSet && lastRoute) { backTo = lastRoute; backY = window.scrollY; }
    if (!inSet && wasSet) { if (raw === backTo) restoreY = backY; backTo = ""; }
    if (raw !== lastRoute) { openRow.clear(); if (lastRoute.split("?")[0] !== path) { countryShow = 0; brandShow = 24; panelOpen = false; quickOpen = ""; allNations = false; barsAll = false; } }
    const spot = back && raw !== lastRoute && memo.get(raw);
    if (spot) { showN = spot.showN; countryShow = spot.countryShow; brandShow = spot.brandShow; homeMore = spot.homeMore; restoreY = spot.y; }
    fixbar.hidden = true; panel.hidden = true;
    AT = null;  // 기준 나라는 그 화면(브랜드 ?at=, 여행지+브랜드)에서만
    let html, r = seg[0] || "home";
    if (!seg.length) html = home();
    else if (r === "country") html = seg[1] ? country(seg[1], q) : countries();
    else if (r === "brand" && seg[2] === "c" && seg[3]) { location.replace("#/brand/" + encodeURIComponent(seg[1]) + "?c=" + encodeURIComponent(seg[3])); return; }  // S-04 컬렉션 → 브랜드 화면의 컬렉션 칩
    else if (r === "brand") html = seg[1] ? brand(seg[1], q) : brands();
    else if (r === "p") html = product(seg[1], seg[2]);
    else if (r === "search") html = search(q);
    else if (r === "settings") html = seg[1] === "status" ? status() : settings(q);
    else if (r === "picks") html = picks();
    else if (r === "changes") html = changesPage(q);
    else if (r === "events") html = seg[1] ? eventPage(seg[1]) : eventsPage(q);
    else html = notFound();
    // 필터 판이 열린 채 조건을 바꾸면 판이 다시 그려진다 — 보던 위치를 지켜서 아래쪽 필터를 이어서 고를 수 있게
    AT = null;
    const fpOld = app.querySelector(".fl.open .fpanel"), fpTop = fpOld ? fpOld.scrollTop : 0;
    app.innerHTML = html;
    const fpNew = app.querySelector(".fl.open .fpanel");
    const qp = app.querySelector(".qpop"), qc = app.querySelector(".qchip.open");  // 펼친 판의 꼬리를 누른 단추 가운데로
    if (qp && qc) { const cr = qc.getBoundingClientRect(), pr = qp.getBoundingClientRect();
      qp.style.setProperty("--qx", Math.round(cr.left + cr.width / 2 - pr.left) + "px");
      qp.classList.toggle("noarrow", pr.top - cr.bottom > 24); }  // 사이에 단추 줄이 하나 더 있으면 꼬리가 엉뚱한 단추를 가리킴 → 숨김
    if (fpNew && fpOld) fpNew.scrollTop = fpTop;
    document.body.classList.toggle("noscroll", !!fpNew && isM());  // 판이 열려 있는 동안 뒤 페이지는 멈춤
    document.querySelectorAll("[data-r]").forEach(a => a.classList.toggle("on", a.dataset.r === r));
    document.body.classList.toggle("hasfix", !fixbar.hidden);
    if (onbSheet && !SET.onboarded && isM()) openOnbSheet();
    frame();
    if (restoreY !== null) { window.scrollTo(0, restoreY); restoreY = null; }
    else if (raw !== lastRoute && raw.split("?")[0] !== lastRoute.split("?")[0]) window.scrollTo(0, 0);
    lastRoute = raw;
  }

  // ── 누르기 ──
  document.addEventListener("click", e => {
    if (e.target.closest("a.olink")) return;
    const ex = e.target.closest("[data-expand]"); if (ex) { ex.classList.toggle("clamp2"); return; }  // 긴 제품 이름 펼치기  // 공홈 링크는 새 창으로만 (행 펼치기와 겹치지 않게)
    const t = e.target.closest("button, [data-row], a.tchip[data-trip]");
    if (!t) { if (!panel.hidden && (!e.target.closest("#trippanel") || e.target === panel) && !e.target.closest("#tripChip")) { panel.hidden = true; onbSheet = false; } return; }  // 휴대폰: 판 바깥 어두운 곳(= #trippanel 자신)을 눌러도 닫힘
    if (t.id === "tripChip" || t.hasAttribute("data-trip-open")) { if (panel.hidden) openTrip(); else panel.hidden = true; return; }
    if (t.id === "otherApp") { if (M.other) location.href = M.other; return; }
    if (t.hasAttribute("data-fx-fetch")) { fetchFx(); render(); return; }
    if (t.hasAttribute("data-newbar-close")) { document.getElementById("newbar").hidden = true; return; }
    if (t.dataset.chtab) { location.hash = "#/changes?tab=" + t.dataset.chtab; return; }
    if (t.dataset.pimg !== undefined) { pImg = +t.dataset.pimg; render(); return; }
    if (t.dataset.trip) {
      e.preventDefault(); const inPanel = !!t.closest("#trippanel");
      if (toggleTrip(t.dataset.trip) === false) return;
      if (inPanel) openTrip();
      return;
    }
    if (t.hasAttribute("data-trip-clear")) { setTrip([]); openTrip(); return; }
    if (t.dataset.preset) { setTrip(t.dataset.preset.split(",")); openTrip(); return; }
    if (t.dataset.quick) { quickOpen = quickOpen === t.dataset.quick ? "" : t.dataset.quick; render(); return; }
    if (t.hasAttribute("data-fpanel")) { panelOpen = !panelOpen; render(); if (panelOpen && isM()) document.body.classList.add("noscroll"); else document.body.classList.remove("noscroll"); return; }
    if (t.hasAttribute("data-moreF")) { showN = (showN || PAGE()) + PAGE(); render(); return; }
    if (t.hasAttribute("data-allnations")) { allNations = !allNations; render(); return; }
    if (t.hasAttribute("data-barsall")) { barsAll = !barsAll; render(); return; }
    if (t.hasAttribute("data-recent-clear")) { store.set(KEY("recent"), []); render(); return; }
    // 설정 (5.15절)
    if (t.dataset.set === "jpDept" && t.dataset.val === "true" && !SET.jpDept) { jpDeptWarn(() => { saveSet({ jpDept: true }); render(); }); return; }  // 켜기 전에 경고
    if (t.dataset.cp) {  // 기간 쿠폰 켜기(경고 창 뒤)·끄기
      const cp = CALC.coupons.find(c => c.id === t.dataset.cp);
      if (!cp) return;
      if (t.dataset.val === "false") { const n = { ...SET.cp }; delete n[cp.id]; saveSet({ cp: n }); render(); return; }
      if (!SET.cp[cp.id] && cpLive(cp)) cpWarn(cp, () => { saveSet({ cp: { ...SET.cp, [cp.id]: true } }); render(); });
      return;
    }
    if (t.dataset.set) { saveSet({ [t.dataset.set]: JSON.parse(t.dataset.val) }); render(); return; }
    if (t.dataset.toggleOff) { const c = t.dataset.toggleOff; saveSet({ off: SET.off.includes(c) ? SET.off.filter(x => x !== c) : [...SET.off, c] }); render(); return; }
    if (t.dataset.toggleHide) { const b = t.dataset.toggleHide; saveSet({ hide: SET.hide.includes(b) ? SET.hide.filter(x => x !== b) : [...SET.hide, b] }); render(); return; }
    if (t.dataset.reset) {
      const keys = t.dataset.reset === "all" ? Object.keys(DEF).filter(k => k !== "onboarded") : t.dataset.reset === "calc" ? CALC_KEYS : t.dataset.reset.split(",");
      if (keys.includes("pay")) keys.push("fee"); if (keys.includes("us")) keys.push("usTax"); if (keys.includes("euHigh")) keys.push("euThr", "euUp");
      saveSet(Object.fromEntries(keys.map(k => [k, JSON.parse(JSON.stringify(DEF[k]))]))); render(); return;
    }
    if (t.hasAttribute("data-onboard")) { onbSheet = false; saveSet({ onboarded: true }); render(); return; }
    if (t.hasAttribute("data-onb-open")) { onbSheet = true; openOnbSheet(); return; }
    if (t.dataset.jump) {
      const go = () => { const el = document.getElementById(t.dataset.jump); if (el) window.scrollTo({ top: el.getBoundingClientRect().top + scrollY - 70, behavior: reduced() ? "auto" : "smooth" }); };
      if (!document.getElementById(t.dataset.jump) && !homeMore) { homeMore = true; render(); setTimeout(go, 50); } else go();  // 접힌 구역이면 펼친 뒤 이동
      return;
    }
    if (t.dataset.homemore) { homeMore = t.dataset.homemore === "1"; const y = scrollY; render(); window.scrollTo(0, y); return; }
    if (t.hasAttribute("data-export")) { exportBackup(); return; }
    if (t.hasAttribute("data-trip-close")) { panel.hidden = true; return; }
    if (t.dataset.pick) {
      const k = t.dataset.pick;
      S.picks = S.picks.includes(k) ? S.picks.filter(x => x !== k) : [...S.picks, k].slice(0, 50);
      store.set(pickKey(), S.picks); render(); return;
    }
    if (t.dataset.copylink) { copyLink(t); return; }
    if (t.dataset.sel) { S.sel[t.dataset.sel] = t.dataset.sku; render(); return; }
    if (t.dataset.hnav) { heroHold = Date.now() + 20000; heroGo(heroIdx + +t.dataset.hnav, true); return; }
    if (t.dataset.budget) { budgetIdx = +t.dataset.budget; render(); return; }
    if (t.hasAttribute("data-iconsall")) { iconsAll = !iconsAll; render(); return; }
    if (t.hasAttribute("data-atall")) { atAll = !atAll; render(); return; }
    if (t.hasAttribute("data-flightshuffle")) { flightSel = null; render(); document.getElementById("h-flight")?.scrollIntoView({ block: "start" }); return; }
    if (t.hasAttribute("data-iconshuffle")) { iconPick = null; render(); document.getElementById("h-icons")?.scrollIntoView({ block: "start" }); return; }
    if (t.hasAttribute("data-colall")) { colAll = !colAll; render(); return; }
    if (t.dataset.triptab) { tripTab = +t.dataset.triptab; render(); return; }
    if (t.hasAttribute("data-moreC")) { countryShow = (countryShow || PAGE()) + PAGE(); render(); return; }
    if (t.hasAttribute("data-moreB")) { brandShow += 24; render(); return; }
    if (t.dataset.row) { const c = t.dataset.row; openRow.has(c) ? openRow.delete(c) : openRow.add(c); render(); }
  });
  document.addEventListener("keydown", e => {
    if (e.key === "Escape" && !panel.hidden) { panel.hidden = true; onbSheet = false; }
    if (e.key === "Enter" && e.target.dataset && e.target.dataset.row && e.target.tagName === "TR") e.target.click();
  });
  document.addEventListener("change", e => {
    const t = e.target;
    if (t.matches("select[data-sort]")) location.hash = t.value;
    if (t.matches("input[data-nav]")) location.hash = t.dataset.nav;
    if (t.matches("input[data-import]") && t.files[0]) importBackup(t.files[0]);
    if (t.matches("input[data-fx]")) {  // 환율 직접 입력: 빌드 값의 ±30% 안만 (빈칸 = 최신/빌드 값)
      const cur = t.dataset.fx, v = t.value === "" ? null : Number(t.value), err = document.querySelector('[data-err="fx"]');
      if (v !== null && !fxOk(cur, v)) { if (err) err.textContent = `${cur}: 빌드 환율(${fxFmt(FX_BUILD[cur])})의 ±30% 안으로 넣어 주세요`; return; }
      const fc = { ...SET.fxCustom }; if (v === null) delete fc[cur]; else fc[cur] = v;
      saveSet({ fxCustom: fc }); render();
    }
    if (t.matches("input[data-num]")) {  // 범위를 넘으면 칸 아래에 안내하고 적용하지 않음
      const k = t.dataset.num, [mn, mx] = RANGE[k], v = Number(t.value), err = document.querySelector(`[data-err="${k}"]`);
      if (!(t.value !== "" && v >= mn && v <= mx)) { if (err) err.textContent = `${mn}~${mx} 사이로 넣어 주세요`; return; }
      if (err) err.textContent = "";
      if (k.startsWith("euUp.")) saveSet({ euUp: { ...SET.euUp, [k.slice(5)]: v } }); else saveSet({ [k]: v });
      render();
    }
  });
  // 찾기 (5.6a·5.12절): 제품번호가 정확히 하나 맞으면 바로 제품 화면, 아니면 조건이 되는 단어를 칩으로 바꿈
  let keepConv = false;
  const curBase = () => { const raw = location.hash.slice(1) || "/", path = raw.split("?")[0]; return { path, q: new URLSearchParams(raw.split("?")[1] || "") }; };
  // 가격 범위 반영: 제한 없음(기본)이면 주소에서 뺌
  function setRange(mn, mx) {
    const { path, q } = curBase();
    if (mx >= PR.top) mx = Infinity;
    mn > 0 ? q.set("pmin", mn) : q.delete("pmin");
    if (mx === PR.def[1]) q.delete("pmax"); else q.set("pmax", mx === Infinity ? "all" : mx);
    showN = 0; location.hash = "#" + path + (q.toString() ? "?" + q : "");
  }
  document.addEventListener("input", e => {
    const t = e.target, f = t.closest && t.closest("form[data-prange]");
    if (!f || t.type !== "range") return;
    let a = +f.elements.rmin.value, b = +f.elements.rmax.value;
    if (a > b) { t.name === "rmin" ? (a = b, t.value = b) : (b = a, t.value = a); }  // 손잡이가 엇갈리지 않게
    const tr = f.querySelector(".pr-track");
    tr.style.setProperty("--a", (a / PR.top * 100) + "%"); tr.style.setProperty("--b", (b / PR.top * 100) + "%");
    f.elements.pmin.value = a / 1e4; f.elements.pmax.value = b >= PR.top ? "" : b / 1e4;
    f.querySelector(".pr-out").textContent = rangeLabel({ pmin: a, pmax: b >= PR.top ? Infinity : b });
  });
  document.addEventListener("change", e => {
    const t = e.target, f = t.closest && t.closest("form[data-prange]");
    if (f && t.type === "range") setRange(+f.elements.rmin.value, +f.elements.rmax.value);
  });
  document.addEventListener("click", e => {
    const d = e.target.closest && e.target.closest("[data-prdef]");
    if (d) { e.preventDefault(); setRange(...PR.def); }
  });
  document.addEventListener("submit", e => {
    const pf = e.target.closest("form[data-prange]");
    if (pf) {
      e.preventDefault();
      const n = s => Math.max(0, Math.round(+String(s).replace(/[^\d.]/g, "") * 1e4) || 0), mn = n(pf.elements.pmin.value), mx = pf.elements.pmax.value.trim() ? n(pf.elements.pmax.value) : Infinity;
      setRange(Math.min(mn, mx), Math.max(mn, mx)); return;
    }
    const f = e.target.closest("form[data-search]"); if (!f) return;
    e.preventDefault();
    const text = (f.elements.q.value || "").trim(), k = text.toLowerCase().replace(/[\s-]/g, "");
    const hit = k ? list().filter(p => p.s.toLowerCase().replace(/-/g, "") === k) : [];
    acOpen = false;
    if (text) { const rk = KEY("recent"); store.set(rk, [text, ...store.get(rk, []).filter(x => x !== text)].slice(0, 10)); }
    if (hit.length === 1) { location.hash = link(hit[0]); return; }
    const inBar = !!f.closest(".fbar"), { path, q } = curBase();
    const params = convertQuery(text, inBar ? q : new URLSearchParams());
    keepConv = true;
    const target = (inBar ? "#" + path : "#/search") + (params.toString() ? "?" + params : "");
    if (target === location.hash) { keepConv = false; render(); } else location.hash = target;
  });
  // 빈 찾기 칸을 누르면 최근·많이 찾는 말 (2026-10-28)
  document.addEventListener("focusin", e => {
    if (e.target.id !== "fq" || e.target.value.trim() || acOpen) return;
    acOpen = true; render();
    const inp = document.getElementById("fq"); if (inp) inp.focus();
  });
  document.addEventListener("pointerdown", e => {
    if (acOpen && !e.target.closest(".fsearch")) { acOpen = false; setTimeout(render, 0); }
  });
  // 입력하는 대로 결과·자동 완성 (주소만 바꾸고 다시 그린 뒤 입력 칸에 커서를 되돌림)
  let liveT = 0;
  document.addEventListener("input", e => {
    if (!e.target.matches("input[data-live]")) return;
    clearTimeout(liveT);
    const val = e.target.value;
    liveT = setTimeout(() => {
      const { path, q } = curBase();
      // 값이 그대로면 다시 그리지 않음 — 휴대폰에서 한글 입력을 마치며(키보드 내림) 같은 값의 input 이 한 번 더 오는데,
      // 그때 다시 그리면 바로 누른 '더 보기'가 12개로 돌아가고 키보드가 다시 올라왔다
      if ((q.get("q") || "") === (val.trim() ? val : "")) return;
      const typing = document.activeElement && document.activeElement.id === "fq";
      val.trim() ? q.set("q", val) : q.delete("q");
      lastConverted = []; acOpen = !!val.trim() && typing; showN = 0;
      history.replaceState(history.state, "", "#" + path + (q.toString() ? "?" + q : ""));  // state = 뒤로 가기 깊이(navDepth) 유지
      render();
      const inp = document.getElementById("fq");
      if (inp && typing) { inp.focus(); inp.setSelectionRange(inp.value.length, inp.value.length); }  // 입력 중일 때만 커서를 되돌림
    }, 200);
  });
  // 모바일: 아래로 내리면 머리글 숨김, 올리면 다시 보임. 1.5화면 넘게 내려가면 '맨 위로' (5M.12절)
  let lastY = 0;
  const toTop = document.getElementById("toTop");
  window.addEventListener("scroll", () => {
    const y = scrollY;
    if (isM()) document.body.classList.toggle("hidehead", y > 120 && y > lastY && panel.hidden);
    else document.body.classList.remove("hidehead");
    // '맨 위로'는 위로 올릴 때만 (내려가며 '더 보기'를 누를 때 오른쪽 아래에서 겹치지 않게)
    if (toTop) toTop.hidden = y < innerHeight * 1.5 || (isM() && y > lastY);
    lastY = y;
  }, { passive: true });
  if (toTop) toTop.addEventListener("click", () => window.scrollTo({ top: 0, behavior: reduced() ? "auto" : "smooth" }));
  if (backBtn) backBtn.addEventListener("click", () => { goBack(); });
  // 안드로이드 뒤로 키 (@capacitor/app): 앱 안에서만. 첫 화면에서 닫을 것도 없으면 앱 닫기
  const Cap = window.Capacitor;
  const CapApp = Cap && Cap.isNativePlatform && Cap.isNativePlatform() && ((Cap.Plugins && Cap.Plugins.App) || (Cap.registerPlugin && Cap.registerPlugin("App")));
  if (CapApp) CapApp.addListener("backButton", () => { if (!goBack()) CapApp.exitApp(); });
  window.addEventListener("hashchange", () => { saveSpot(); if (!keepConv) lastConverted = []; keepConv = false; acOpen = false; showN = 0; document.body.classList.remove("noscroll"); render(); });
  let wasM = isM();
  window.addEventListener("resize", () => { if (isM() !== wasM) { wasM = isM(); render(); } });
  // 새 데이터 알림 띠 (4.2절): 마지막으로 본 버전과 다르면 한 번 알려 줌
  const seen = store.get(KEY("lastVersion"), null);
  if (seen && seen !== M.version) {
    const nb = document.getElementById("newbar");
    nb.innerHTML = `새 가격이 반영됐어요 (${esc(M.fxDate.slice(5).replace("-", "."))}) · 오른 제품 ${M.changes.up} · 내린 제품 ${M.changes.down} <a class="link" href="#/changes">변동 보기</a> <button type="button" class="link" data-newbar-close>닫기</button>`;
    nb.hidden = false;
  }
  store.set(KEY("lastVersion"), M.version);
  render();
  fetchFx();  // 페이지를 열 때마다 최신 환율을 한 번 받음 (화면은 먼저 띄우고, 받으면 다시 계산)
})();
