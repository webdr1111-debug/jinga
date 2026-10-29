/* 럭스캐너 계산 (웹앱계획.md 7장) — 주얼리·가방이 함께 쓴다. 화면 코드(app.js)와 검증(sheets/calc_ref.py 비교)이 같은 파일을 쓴다.
 * 진가 = 현지가 × (판매세 별도면 1+세율) × 환율 − 환급 + 카드 수수료(환급 전 결제액 기준) + 관세
 * 규칙 값(세율·환급률·관세 기준)은 data/rules.js 에서 온다. 설정(set)은 화면의 설정(5.15절) 값.
 * 브라우저에서는 window.LuxCalc, Node 에서는 require 로 쓴다.
 */
(function (root) {
  "use strict";
  function LuxCalc(rules) {
    const C = rules.countries, FX = rules.fx, CUS = rules.customs;
    const down10 = n => Math.floor(n / 10 + 1e-9) * 10;  // 엑셀 ROUNDDOWN처럼 부동소수 오차(…9.9999)는 올려 봄
    const jpExcluded = b => (rules.jpExcl[b] || [true])[0];  // 표에 없는 브랜드는 할인 제외로 본다(엑셀과 같음)
    const feeRate = set => set.pay === "travel" ? 0 : set.pay === "custom" ? set.fee / 100 : 0.012;
    // 기간 쿠폰 (sheets/config/coupons.json → rules.coupons, 2026-10-28): 기간 안(기기 날짜)이고 켰고 입점 브랜드일 때만
    const pad = n => String(n).padStart(2, "0");
    const today = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
    const cpActive = (cp, day) => (!cp.from || cp.from <= day) && day <= cp.until;
    const coupons = rules.coupons || [];
    const coupon = (c, brand, set) => coupons.find(cp => cp.country === c && (set.cp || {})[cp.id] && cpActive(cp, set.today || today()) && cp.brands.includes(brand) && !(cp.exclude || {})[brand]) || null;  // 입점했지만 쿠폰 제외(exclude)도 뺌

    // 관세 (관세청 여행자 휴대품 방식). afterRefund = 환급 후 결제액(원). force: 설정과 상관없이 계산, simple: 합계에 간이세율 강제
    function customs(afterRefund, grp, set, force, simple) {
      if (!set.customs && !force) return 0;
      // 품목 값이 없으면 공통 값 (보석·시계·가방은 공통 15%·45%·8%·개별소비세 20%, 신발·의류 18%·13%, 액세서리 15%·8%)
      const g = CUS.grp[grp], T = Math.max(0, afterRefund - CUS.allowUsd * FX.US);
      const r1 = g.r1 ?? CUS.r1, r2 = g.r2 ?? CUS.r2, gen = g.gen ?? CUS.gen, ictxR = g.ictx ?? CUS.ictx;
      if (!T) return 0;
      if (afterRefund <= CUS.simpleMax || simple) {  // 간이세율: 기준가격까지 r1, 넘는 금액 r2
        const s = Math.min(T, g.thr) * r1 + Math.max(0, T - g.thr) * r2;
        return down10(s - (set.self ? Math.min(s * CUS.disc, CUS.cap) : 0));
      }
      // 일반 과세: 관세 gen + 개별소비세(기준가격 초과분) + 교육세 30% + 부가세 10%
      const duty = T * gen - (set.self ? Math.min(T * gen * CUS.disc, CUS.cap) : 0);
      const ictx = Math.max(0, T + duty - g.ib) * ictxR;
      return down10(T * CUS.vat + (duty + ictx * (1 + CUS.edu)) * (1 + CUS.vat));
    }
    // 미국 판매세: 하와이·괌은 그 지역에 매장이 있는 브랜드만 (엑셀 '하와이·괌 매장' 표)
    function usTax(brand, set) {
      const st = rules.stores[brand] || [];
      if (set.us === "hawaii" && st[0] === "있음") return 4.712;
      if (set.us === "guam" && st[1] === "있음") return 0;
      if (set.us === "custom") return set.usTax;
      return C.US.tax;
    }
    // 나라 c 에서 현지가 v 인 제품 한 개
    function calc(c, v, grp, brand, set) {
      const k = C[c];
      if (c === "KR") { const krw = v * (1 - set.krDisc / 100); return { krw, refund: 0, fee: 0, duty: 0, net: krw, rate: 0, disc: v - krw }; }
      const tax = c === "US" ? usTax(brand, set) : k.tax, mult = k.incl ? 1 : 1 + tax / 100;
      const cp = c === "JP" ? null : coupon(c, brand, set);  // 기간 쿠폰 (예: 파리 프랭탕 관광청 쿠폰)
      const dept = c === "JP" && set.jpDept && !jpExcluded(brand) ? set.jpRate / 100 : cp ? cp.rate / 100 : 0;  // 일본 백화점 외국인 할인 · 쿠폰
      const price = v * (1 - dept), paid = price * mult, krw = paid * FX[c];
      let rate = 0;
      if (set.refund && paid >= (k.min || 0)) {
        if (c === "JP") rate = (0.10 - (set.jpFeeOn ? set.jpFee / 100 : 0)) / 1.1;  // (소비세 10% − 수수료) ÷ 1.1
        else if (c === "TH") { for (const [a, r] of rules.thTiers) if (paid >= a) rate = r; }  // 태국 구간
        else {
          rate = (k.refund || 0) / 100;
          if (set.euHigh && set.euUp[c] !== undefined && paid >= set.euThr && rate > 0)  // 유럽 고액 상향 (최대 세율÷(1+세율))
            rate = Math.min(Math.max(rate, k.tax / (100 + k.tax)), rate + set.euUp[c] / 100);
        }
      }
      const refund = krw * rate, fee = krw * feeRate(set), duty = customs(krw - refund, grp, set);
      return { krw, refund, fee, duty, net: krw - refund + fee + duty, rate, disc: v * dept * mult * FX[c], tax, cp: cp && cp.id };
    }
    return { calc, customs, usTax, feeRate, jpExcluded, coupons, cpActive, today };
  }
  root.LuxCalc = LuxCalc;
  if (typeof module !== "undefined" && module.exports) module.exports = LuxCalc;
})(typeof window !== "undefined" ? window : globalThis);
