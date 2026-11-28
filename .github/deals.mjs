// 아고다 특가 호텔 파일 만들기 (2026-11-28 사용자 '추천대로 · 진행해' — 함수 요청 줄이기)
// jinga 저장소 GitHub Actions(.github/workflows/pages.yml)가 6시간마다 돌림 → deals/{아고다 도시 번호}.json 을 만들고
// 저장소 내용과 같이 GitHub Pages 로 올림(커밋하지 않음). 화면은 https://webdr1111-debug.github.io/jinga/deals/{c}.json 을 읽고,
// 없거나 오래됐으면 예전처럼 luxcanner.com /shop/deals.json(함수)으로 받음.
// 원본: luxcanner-app web/jinga_gh/ — pack.py 가 web/dist/site/.github/ 로 복사(deals-cities.json 은 config/agoda.json 에서 만듦).
// 값 거르기는 web/cf/functions/shop/_deals.js 와 같게: 링크는 우리 cid 제휴 주소만, 사진은 agoda.net https 만.
// API 키는 저장소 Secrets AGODA_API_KEY(사용자가 직접 넣음) — 화면·로그·파일에 남기지 않음. 오류는 상태 번호만 남김.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";

const HERE = new URL(".", import.meta.url);
const cfg = JSON.parse(readFileSync(new URL("deals-cities.json", HERE), "utf8"));
const CID = String(cfg.cid);
if (!/^\d{3,10}$/.test(CID)) throw new Error("cid 모양이 아님");
const CITIES = [...new Set(cfg.cities.map(Number))].filter((c) => Number.isInteger(c) && c > 0);
const KEY = String(process.env.AGODA_API_KEY || "").trim();
const OUT = new URL("../deals/", HERE);
mkdirSync(OUT, { recursive: true });

const API = "https://affiliateapi7643.agoda.com/affiliateservice/lt_v1";
const URL_OK = new RegExp(`^https://www\\.agoda\\.com/(?:[a-z]{2}-[a-z]{2}/)?partners/partnersearch\\.aspx\\?[^\\s"'<>]*\\bcid=${CID}\\b[^\\s"'<>]*$`);
const IMG_OK = /^https?:\/\/pix\d*\.agoda\.net\/[^\s"'<>]+$/;
const num = (v) => (typeof v === "number" && isFinite(v) ? v : null);
const day = (d) => d.toISOString().slice(0, 10);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const auth = KEY.includes(":") ? KEY : `${CID}:${KEY}`;

async function ask(cityId, inD, outD, strict) {
  const body = { criteria: { cityId, checkInDate: inD, checkOutDate: outD, additional: {
    currency: "KRW", language: "ko-kr", maxResult: 15, sortBy: "Recommended",
    discountOnly: strict, minimumStarRating: strict ? 4 : 3, minimumReviewScore: strict ? 8 : 7,
    occupancy: { numberOfAdult: 2, numberOfChildren: 0 } } } };
  const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), 15000);
  try {
    const r = await fetch(API, { method: "POST", signal: ctl.signal, headers: {
      "Content-Type": "application/json", "Accept-Encoding": "gzip,deflate", "Authorization": auth }, body: JSON.stringify(body) });
    if (!r.ok) { console.log("agoda status", cityId, r.status); return []; }
    const j = await r.json();
    return Array.isArray(j.results) ? j.results : [];
  } catch (e) {
    console.log("agoda fetch", cityId, e && e.name);
    return [];
  } finally { clearTimeout(t); }
}

// 체크인 = 오늘(한국 시각)부터 14일 뒤, 1박, 어른 2명 — 화면에 이 기준을 같이 적음 (함수와 같음)
const now = new Date(Date.now() + 9 * 3600e3);
const inD = day(new Date(now.getTime() + 14 * 864e5)), outD = day(new Date(now.getTime() + 15 * 864e5));
let ok = 0, empty = 0;
if (!KEY) console.log("AGODA_API_KEY 없음 — 호텔 파일 없이 올림(화면은 luxcanner.com 함수로 받음)");
else for (const c of CITIES) {
  let rs = await ask(c, inD, outD, true);
  if (rs.length < 3) {
    await sleep(1200);
    const seen = new Set(rs.map((h) => h.hotelId));
    rs = rs.concat((await ask(c, inD, outD, false)).filter((h) => !seen.has(h.hotelId)));
  }
  const items = rs.map((h) => {
    const u = String(h.landingURL || ""), img = String(h.imageURL || "");
    const r = num(h.dailyRate), w = num(h.crossedOutRate), p = num(h.discountPercentage);
    if (!URL_OK.test(u) || !IMG_OK.test(img) || !r || r <= 0 || !h.hotelName) return null;
    return { n: String(h.hotelName).slice(0, 120), img: img.replace(/^http:/, "https:"), u, r: Math.round(r),
      w: w && w > r ? Math.round(w) : null, p: p && p > 0 && p < 100 ? Math.round(p) : null,
      s: num(h.starRating), v: num(h.reviewScore), cur: String(h.currency || "KRW").slice(0, 3) };
  }).filter(Boolean).slice(0, 10);
  if (items.length >= 2) {  // 2곳 미만이면 파일을 안 만듦 → 화면이 함수로 받음
    writeFileSync(new URL(`${c}.json`, OUT), JSON.stringify({ at: new Date().toISOString(), in: inD, out: outD, adults: 2, items }));
    ok++;
  } else empty++;
  await sleep(1200);
}
console.log(`호텔 파일 ${ok}개 · 비어서 안 만듦 ${empty}개 · 도시 ${CITIES.length}개`);
