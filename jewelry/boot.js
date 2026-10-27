/* 진가 웹앱 시작 (web/pack.py 가 웹앱 묶음에만 넣는다, 2026-10-27)
 * 데이터는 순수 JSON(data/*.json) — 받아서 읽기만 하고 코드로 실행하지 않는다(앱 심사 2.5.2, 웹앱계획.md 10장 '배포 방식 결정').
 * manifest·rules·search·history 를 받아 LUX 에 넣은 뒤 계산(calc.js)·화면(app.js)을 차례로 읽는다.
 * 파일로 여는 web/{jewelry,bag}/index.html 은 지금처럼 data/*.js 를 쓴다(이 파일 없음).
 */
(function () {
  "use strict";
  const get = n => fetch("data/" + n, { credentials: "omit" }).then(r => { if (!r.ok) throw new Error(n + " " + r.status); return r.json(); });
  const load = src => new Promise((ok, no) => {
    const s = document.createElement("script");
    s.src = src; s.onload = ok; s.onerror = () => no(new Error(src));
    document.body.appendChild(s);
  });
  Promise.all(["manifest", "rules", "search", "history"].map(n => get(n + ".json")))
    .then(([m, r, s, h]) => { Object.assign(window.LUX, { manifest: m, rules: r, search: s, history: h }); })
    .catch(() => { /* 데이터 없음 — app.js 가 '가격 데이터가 없어요' 안내 */ })
    .then(() => load("common/calc.js")).then(() => load("common/app.js"))
    .catch(e => { document.getElementById("app").textContent = "화면을 불러오지 못했어요. 다시 열어 주세요. (" + e.message + ")"; });
})();
