/* 럭스캐너 웹앱 연결 (웹앱계획.md 4.3절) — web/pack.py 가 웹앱 묶음에만 넣는다. 파일로 열면(file://) 아무것도 하지 않는다.
 * 오프라인 저장 스크립트 등록 · 새 버전 알림 띠 · 6시간마다 새 버전 확인 · 저장 유지 요청
 */
(function () {
  "use strict";
  const sw = navigator.serviceWorker;
  if (!sw || !window.isSecureContext || location.protocol === "file:") return;
  const kind = document.documentElement.dataset.kind || "app";
  const KEY = "lux." + kind + ".swCheck", SIX = 6 * 3600e3;
  let applying = false;

  function bar(w) {
    if (document.getElementById("swbar")) return;
    const d = document.createElement("div");
    d.id = "swbar"; d.className = "setbar newbar"; d.setAttribute("role", "status");
    d.innerHTML = '새 가격·화면이 준비됐어요 <button type="button" class="link" data-sw="go">지금 반영</button> <button type="button" class="link" data-sw="later">나중에</button>';
    d.addEventListener("click", e => {
      const a = e.target.getAttribute("data-sw");
      if (a === "go") { applying = true; w.postMessage("skip"); }
      if (a) d.remove();
    });
    const nb = document.getElementById("newbar");
    nb && nb.parentNode ? nb.parentNode.insertBefore(d, nb) : document.body.prepend(d);
  }
  sw.addEventListener("controllerchange", () => { if (applying) location.reload(); });

  // 열거나 새로고침한 직후(아직 아무것도 누르지 않았을 때) 새 판이 준비되면 띠 없이 바로 바꾼다 — 새로고침해도 옛 화면이 보이던 것 (2026-10-28).
  // 보는 중에 준비되면 지금처럼 띠로 묻는다(보던 화면이 갑자기 바뀌지 않게)
  const t0 = Date.now(), EARLY = 20000;
  let touched = false;
  ["pointerdown", "keydown", "scroll"].forEach(e => addEventListener(e, () => { touched = true; }, { once: true, passive: true }));
  function ready(w) {
    if (!touched && Date.now() - t0 < EARLY) { applying = true; w.postMessage("skip"); }  // 바뀌면 controllerchange → 한 번 다시 읽음
    else bar(w);
  }
  const watch = w => w && w.addEventListener("statechange", () => { if (w.state === "installed" && sw.controller) ready(w); });

  sw.register("sw.js", { updateViaCache: "none" }).then(reg => {
    if (reg.waiting && sw.controller) ready(reg.waiting);
    watch(reg.installing);  // 이 스크립트보다 먼저 시작된 새 판 받기도 놓치지 않게
    reg.addEventListener("updatefound", () => watch(reg.installing));
    reg.update().catch(() => {});  // 열 때마다 새 판 확인 (6시간 확인은 켜 둔 채 볼 때)
    const check = () => {
      let last = 0;
      try { last = +localStorage.getItem(KEY) || 0; } catch (e) { /* 저장 불가 */ }
      if (Date.now() - last < SIX) return;
      try { localStorage.setItem(KEY, String(Date.now())); } catch (e) { /* 저장 불가 */ }
      reg.update().catch(() => {});
    };
    document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") check(); });
    setInterval(check, SIX);
  }).catch(() => {});

  // 담은 목록·설정이 지워지지 않게 저장 유지 요청 (브라우저가 거절할 수 있음)
  if (navigator.storage && navigator.storage.persist) navigator.storage.persisted().then(p => p || navigator.storage.persist()).catch(() => {});
})();
