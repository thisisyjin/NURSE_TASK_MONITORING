const CAT = [
        ['CPR 진행', 'H', 42, 1],
        ['Central line 삽입 준비·보조', 'H', 30],
        ['Intubation 준비·보조', 'H', 30],
        ['수술 전 준비', 'H', 30],
        ['시술 전 준비(CAG)', 'H', 25],
        ['수혈(PRBC)', 'H', 25],
        ['A-line 삽입 준비·보조', 'H', 20],
        ['도뇨관 삽입', 'M', 15],
        ['중환자실 입원 준비', 'M', 15, 1],
        ['정맥 항생제', 'M', 10],
        ['항생제(패혈성 쇼크)', 'M', 10],
        ['승압제 투여 시작', 'M', 10, 1],
        ['채혈', 'M', 10],
        ['조영 검사 전 준비', 'M', 10],
        ['정맥 주사(IV push)', 'L', 5],
        ['에피네프린 투여', 'L', 5, 1],
        ['수액 교체', 'L', 5],
        ['경구약', 'L', 3],
      ];
      const VS_MIN = 3;
      const vsLoad = (p) => Math.round((60 / p.vs) * VS_MIN);
      const vsTxt = (v) => (v >= 60 ? v / 60 + '시간마다' : v + '분마다');
      const EVENTS = ['환자 상태 악화', '섬망·초조 행동'];
      const CATMAP = Object.fromEntries(
        CAT.map((c) => [c[0], { cat: c[1], min: c[2] }]),
      );
      const DUE = {
          '항생제(패혈성 쇼크)': 60,
          'CPR 진행': 5,
          '에피네프린 투여': 5,
          'Intubation 준비·보조': 10,
        },
        DUE_DEF = 30,
        PRIO_EARLY = 10,
        CAP_PER_NURSE = 50;
      const dueOf = (n, o) =>
        Math.max(5, (DUE[o.name] || DUE_DEF) - (n.prio ? PRIO_EARLY : 0));
      const KTAS_LOAD = { 1: 20, 2: 15, 3: 10, 4: 5, 5: 3 };
      const newsLoad = (v) => (v == null ? 0 : v >= 7 ? 10 : v >= 5 ? 5 : 0);
      const nst = (v) =>
        v == null ? -1 : v >= 7 ? 3 : v >= 5 ? 2 : v >= 2 ? 1 : 0;
      const NSTXT = ['양호', '주의', '위험', '고위험'];
      const newsUp = (p) =>
        p.news != null && p.newsPrev != null && nst(p.news) > nst(p.newsPrev);
      const LV = (m) => (m > 50 ? 'hi' : m >= 30 ? 'mid' : 'ok');
      const LVTXT = { ok: '여유', mid: '보통', hi: '높음' };
      const ROLE_BASE = { '6구역': 'mid', 소생실: 'ok', 'A-plus 지원': 'ok' };
      const CPCR_AT = 9 * 60 + 30;
      const FULL = {
        leader: '근무조 리더간호사 (전체)',
        np: '응급전문간호사 (전체)',
      };
      let S,
        seq = 0,
        autoT = null;
      const $ = (id) => document.getElementById(id);
      const fmt = (t) =>
        String(Math.floor(t / 60)).padStart(2, '0') +
        ':' +
        String(t % 60).padStart(2, '0');
      function toast(msg) {
        const el = $('toast');
        el.textContent = msg;
        el.classList.add('show');
        clearTimeout(toast.t);
        toast.t = setTimeout(() => el.classList.remove('show'), 2600);
      }

      function order(name, at) {
        return { id: ++seq, name, at, ...CATMAP[name] };
      }
      function pt(id, nm, bed, reg, ktas, news, newsPrev, vs, orders, sched) {
        return {
          id,
          nm,
          bed,
          reg,
          ktas,
          news,
          newsPrev,
          vs,
          avpu: 'A',
          orders,
          sched,
        };
      }
      function init() {
        seq = 0;
        const t0 = 9 * 60;
        S = {
          t: t0,
          view: 'leader',
          hiSince: {},
          help: {},
          events: [],
          supports: [],
          done: {},
          supMin: {},
          cpr: null,
          cap3Since: null,
          decline: [],
          demoEvent: 0,
          nurses: [
            {
              id: 'n1',
              name: '김서연',
              role: '1구역',
              patients: [
                pt(
                  '1-01',
                  '김가온',
                  '1구역 01병상',
                  '41013827',
                  2,
                  6,
                  3,
                  120,
                  [
                    order('수혈(PRBC)', t0 - 40),
                    order('채혈', t0 - 35),
                    order('정맥 항생제', t0 - 10),
                  ],
                  [['조영 검사 전 준비', t0 + 40]],
                ),
                pt(
                  '1-02',
                  '이나래',
                  '1구역 02병상',
                  '41025164',
                  3,
                  3,
                  3,
                  240,
                  [
                    order('수술 전 준비', t0 - 5),
                    order('정맥 주사(IV push)', t0 - 5),
                  ],
                  [],
                ),
                pt(
                  '1-03',
                  '박도담',
                  '1구역 03병상',
                  '41039402',
                  3,
                  2,
                  2,
                  240,
                  [order('경구약', t0)],
                  [['시술 전 준비(CAG)', t0 + 30]],
                ),
              ],
            },
            {
              id: 'n2',
              name: '박도윤',
              role: '2구역',
              prio: true,
              patients: [
                pt(
                  '2-01',
                  '최하람',
                  '2구역 01병상',
                  '42017735',
                  3,
                  4,
                  4,
                  240,
                  [
                    order('정맥 주사(IV push)', t0 - 5),
                    order('항생제(패혈성 쇼크)', t0 - 25),
                  ],
                  [],
                ),
                pt(
                  '2-02',
                  '정새봄',
                  '2구역 02병상',
                  '42026018',
                  4,
                  1,
                  1,
                  480,
                  [],
                  [['채혈', t0 + 20]],
                ),
              ],
            },
            {
              id: 'n3',
              name: '이하은',
              role: '3구역',
              patients: [
                pt(
                  '3-01',
                  '강다온',
                  '3구역 01병상',
                  '43018841',
                  2,
                  4,
                  4,
                  120,
                  [order('도뇨관 삽입', t0 - 15)],
                  [],
                ),
                pt(
                  '3-02',
                  '윤보람',
                  '3구역 02병상',
                  '43023376',
                  3,
                  2,
                  2,
                  240,
                  [order('채혈', t0 - 5)],
                  [['조영 검사 전 준비', t0 + 50]],
                ),
              ],
            },
            {
              id: 'n4',
              name: '최민준',
              role: '5구역',
              patients: [
                pt(
                  '5-01',
                  '장누리',
                  '5구역 01병상',
                  '45015290',
                  4,
                  0,
                  0,
                  480,
                  [],
                  [],
                ),
                pt(
                  '5-02',
                  '임한결',
                  '5구역 02병상',
                  '45027463',
                  5,
                  0,
                  0,
                  480,
                  [order('경구약', t0 - 5)],
                  [],
                ),
              ],
            },
            {
              id: 'n5',
              name: '정유나',
              role: '6구역',
              patients: [
                pt(
                  '6-01',
                  '한바다',
                  '6구역',
                  '46012958',
                  4,
                  0,
                  0,
                  480,
                  [order('수액 교체', t0 - 10)],
                  [],
                ),
                pt('6-02', '문가윤', '6구역', '46024107', 4, 1, 1, 480, [], []),
                pt(
                  '6-03',
                  '배시온',
                  '6구역',
                  '46036682',
                  5,
                  0,
                  0,
                  480,
                  [order('경구약', t0 - 5)],
                  [],
                ),
                pt(
                  '6-04',
                  '조하늘',
                  '6구역',
                  '46041539',
                  4,
                  2,
                  2,
                  480,
                  [],
                  [['채혈', t0 + 30]],
                ),
                pt('6-05', '홍다빈', '6구역', '46058274', 4, 1, 1, 480, [], []),
                pt('6-06', '류지안', '6구역', '46063915', 5, 0, 0, 480, [], []),
              ],
            },
            { id: 'n6', name: '한지호', role: '소생실', patients: [] },
          ],
        };
        S.nurses.forEach((n) => {
          S.done[n.id] = 0;
          S.supMin[n.id] = 0;
        });
        render();
      }
      const nurse = (id) => S.nurses.find((n) => n.id === id);
      const isFull = () => !!FULL[S.view];
      const activeSup = (s) => !s.end && s.accepted;
      function loadOf(n) {
        if (!n.patients.length) return null;
        let base = 0,
          vsl = 0,
          pend = 0,
          late = 0;
        n.patients.forEach((p) => {
          base += KTAS_LOAD[p.ktas] + newsLoad(p.news);
          vsl += vsLoad(p);
          p.orders.forEach((o) => {
            pend += o.min;
            if (S.t - o.at >= dueOf(n, o)) late++;
          });
        });
        let fc = base + vsl + pend;
        n.patients.forEach((p) => {
          p.sched.forEach(([nm, at]) => {
            if (at - S.t <= 60) fc += CATMAP[nm].min;
          });
          if (newsUp(p)) fc += 5;
        });
        const sups = S.supports.filter((s) => s.to === n.id && activeSup(s));
        let now = base + vsl + pend;
        if (sups.length) {
          const k = Math.max(0.35, 1 - 0.4 * sups.length);
          now = Math.round(now * k);
          fc = Math.round(fc * k);
        }
        const ev = S.events.find((e) => e.nurse === n.id && !e.end);
        return { now, base, vsl, pend, late, fc, sup: sups[0], sups, ev };
      }
      function level(n) {
        const L = loadOf(n);
        if (!L) return ROLE_BASE[n.role] || 'ok';
        if (L.ev) return 'hi';
        return LV(L.now);
      }
      const supportBy = (id) => S.supports.find((s) => s.from === id && !s.end);

      function capacity() {
        const pn = S.nurses.filter((n) => n.patients.length);
        const total = pn.reduce((a, n) => a + loadOf(n).now, 0);
        return { total, limit: pn.length * CAP_PER_NURSE, n: pn.length };
      }
      function recommend(target, exclude = []) {
        return S.nurses
          .filter(
            (n) =>
              n.id !== target &&
              !exclude.includes(n.id) &&
              !supportBy(n.id) &&
              !n.prio &&
              level(n) !== 'hi' &&
              !S.decline.some((d) => d.from === n.id && d.to === target),
          )
          .sort(
            (a, b) =>
              (level(a) === 'ok' ? 0 : 1) - (level(b) === 'ok' ? 0 : 1) ||
              (loadOf(a)?.now ?? 0) - (loadOf(b)?.now ?? 0),
          )[0];
      }
      function alerts() {
        const list = [];
        if (S.cpr && !S.cpr.closed) {
          const c = S.cpr,
            el = S.t - c.start;
          const phase =
            c.phase === 0
              ? `CPR 진행 중 (${el}분 경과)`
              : c.phase === 1
                ? `ROSC (${fmt(c.rosc)}) · 소생 후 처치`
                : '안정화 · 중환자실 입원 준비';
          const team = S.supports.filter(
            (s) => s.to === 'n6' && s.cpr && !s.end,
          );
          const ev = S.events.find((e) => e.pid === 'R-01' && !e.end);
          list.push({
            st: 'E',
            cpr: true,
            txt: `소생실 R-01 CPCR · ${phase} · 한지호 '높음' (사유: ${ev ? ev.type : 'CPCR'})`,
            act: team.length
              ? `CPR 팀: ${team.map((s) => `${nurse(s.from).name}(${s.role})`).join(', ')} · 응급전문간호사 현장 지원`
              : 'CPR 팀 즉시 배정 (흉부압박 교대 · 약물 투여·기록) · 응급전문간호사 현장 지원',
          });
        }
        const cap = capacity();
        if (cap.total > cap.limit) {
          const long = S.cap3Since != null && S.t - S.cap3Since >= 30;
          const urgent =
            S.cpr && !S.cpr.closed && S.supports.some((s) => s.cpr && !s.end);
          if (long || urgent)
            list.push({
              st: 4,
              aplus: !nurse('n7'),
              txt: `인력 부족 지속${urgent ? ' (CPR 팀 투입으로 구역 공백)' : ' (3단계 30분 이상)'} · 근무조 업무량 ${cap.total}분 / 인력 기준 ${cap.limit}분`,
              act: '간호관리자 · 부서 간 지원 검토 (A-plus팀)',
            });
          else
            list.push({
              st: 3,
              txt: `인력 적정성 초과: 근무조 업무량 ${cap.total}분 / 인력 기준 ${cap.limit}분`,
              act: '간호관리자 보고 및 추가 인력 지원 요청',
            });
        }
        S.nurses.forEach((n) => {
          const L = loadOf(n),
            lv = level(n),
            help = S.help[n.id];
          if (n.id === 'n6' && S.cpr && !S.cpr.closed) return;
          if (L && L.ev && !L.sup) {
            list.push({
              st: 2,
              nurse: n.id,
              txt: `${n.name} (${n.role}) · 간호요구 급증: ${L.ev.type} (${L.ev.pid})`,
              act: '즉시 근무조 간호사 지원, 담당 환자 재배정',
            });
            return;
          }
          if (L && L.sup) return;
          if (lv === 'hi' || help) {
            const since = S.hiSince[n.id];
            const long = since != null && S.t - since >= 30;
            const st = long || (L && L.late >= (n.prio ? 1 : 2)) ? 2 : 1;
            const why = help
              ? '"지원 필요" 표시'
              : st === 2
                ? long
                  ? "'높음' 30분 이상 지속"
                  : `수행 기준 초과 처방 ${L.late}건`
                : "업무량 '높음' 도달";
            list.push({
              st,
              nurse: n.id,
              txt: `${n.name} (${n.role}) · ${why}`,
              act:
                st === 2
                  ? '근무조 리더간호사·응급전문간호사: 근무조 지원 또는 환자 재배정'
                  : '근무조 리더간호사: 동료 간 자발적 지원',
            });
          } else if (L && L.fc > 50 && lv !== 'hi') {
            list.push({
              st: 0,
              nurse: n.id,
              txt: `${n.name} · 1시간 뒤 '높음' 예측 (${L.fc}분)`,
              act: '선제적 지원 준비',
            });
          }
        });
        const ord = { E: 9, 4: 4, 3: 3, 2: 2, 1: 1, 0: 0 };
        return list.sort((a, b) => ord[b.st] - ord[a.st]);
      }

      function render() {
        $('clock').textContent = fmt(S.t);
        const opts = [
          ['leader', FULL.leader],
          ['np', FULL.np],
          ...S.nurses.map((n) => [n.id, `간호사: ${n.name}`]),
        ];
        $('viewSel').innerHTML = opts
          .map(
            ([v, l]) =>
              `<option value="${v}" ${v === S.view ? 'selected' : ''}>${l}</option>`,
          )
          .join('');
        const full = isFull();
        const mySup =
          !full && S.supports.find((s) => s.from === S.view && activeSup(s));
        $('cards').innerHTML = S.nurses
          .map((n) =>
            card(n, full || S.view === n.id || (mySup && mySup.to === n.id)),
          )
          .join('');
        const al = alerts();
        $('alertCount').textContent = al.length && full ? `${al.length}건` : '';
        $('alerts').innerHTML = !full
          ? mySup
            ? `<div class="alert a1"><div><span class="st">지원 중</span> · ${nurse(mySup.to).name} 간호사 화면이 함께 표시됩니다. 대신 수행한 처방은 본인 수행으로 기록됩니다.</div></div>`
            : '<div class="empty">지원 알림은 근무조 리더간호사·응급전문간호사 화면에 표시됩니다. 동료의 업무량 단계는 카드에서 확인하세요.</div>'
          : al.length
            ? al
                .map((a) => {
                  let btn = '';
                  if (
                    a.cpr &&
                    !S.supports.some((s) => s.cpr && !s.end) &&
                    S.cpr.phase === 0
                  ) {
                    const t1 = recommend('n6'),
                      t2 = t1 && recommend('n6', [t1.id]);
                    btn = t1
                      ? `<button class="sm pri" data-act="cprteam" data-a="${t1.id}" data-b="${t2 ? t2.id : ''}">CPR 팀 배정: ${t1.name}${t2 ? '·' + t2.name : ''}</button>`
                      : '';
                  } else if (
                    a.cpr &&
                    S.cpr.phase >= 1 &&
                    S.supports.some((s) => s.cpr && !s.end)
                  )
                    btn = `<button class="sm" data-act="cprend">CPR 팀 지원 종료</button>`;
                  else if (a.aplus)
                    btn = `<button class="sm pri" data-act="aplus">A-plus팀 지원 요청</button>`;
                  else if (a.nurse) {
                    const rec = recommend(a.nurse);
                    if (rec)
                      btn = `<button class="sm pri" data-act="assign" data-to="${a.nurse}" data-from="${rec.id}">${rec.name} 지원 배정</button>`;
                  }
                  const lab =
                    a.st === 'E' ? '긴급' : a.st ? `${a.st}단계` : '예측';
                  return `<div class="alert a${a.st}"><div><span class="st">${lab}</span> · ${a.txt}</div><div class="row"><span class="empty">${a.act}</span>${btn}</div></div>`;
                })
                .join('')
            : '<div class="empty">현재 지원이 필요한 간호사가 없습니다.</div>';
        $('supTbl').querySelector('tbody').innerHTML =
          S.supports.length || S.decline.length
            ? [
                ...S.supports
                  .slice()
                  .reverse()
                  .map(
                    (s) =>
                      `<tr><td>${nurse(s.from).name}</td><td>${nurse(s.to).name}${s.role ? ` (${s.role})` : ''}</td><td>${fmt(s.start)}</td><td class="n">${!s.accepted ? '수락 대기' : s.end ? s.end - s.start + '분' : '진행 중'}</td><td class="n">${s.tasks}건</td></tr>`,
                  ),
                ...S.decline.map(
                  (d) =>
                    `<tr><td>${nurse(d.from).name}</td><td>${nurse(d.to).name}</td><td>${fmt(d.t)}</td><td colspan="2" class="empty">거절: ${d.why}</td></tr>`,
                ),
              ].join('')
            : '<tr><td colspan="5" class="empty">아직 지원 기록이 없습니다.</td></tr>';
        const cap = capacity(),
          cpct = Math.min(100, (cap.total / (cap.limit * 1.4)) * 100),
          lpct = (cap.limit / (cap.limit * 1.4)) * 100,
          clv =
            cap.total > cap.limit
              ? 'hi'
              : cap.total > cap.limit * 0.8
                ? 'mid'
                : 'ok';
        $('capBox').innerHTML =
          `<div class="mrow"><span>근무조 업무량 / 인력 기준</span><b>${cap.total}분 / ${cap.limit}분</b></div><div class="track" aria-hidden="true"><i class="s-${clv}" style="width:${cpct}%"></i><span class="tick" style="left:${lpct}%"></span></div><div class="mrow" style="margin-top:6px"><span>환자 담당 ${cap.n}명 × ${CAP_PER_NURSE}분 (시연 기준)</span><span class="lvl l-${clv}">${{ ok: '적정', mid: '주의', hi: '초과' }[clv]}</span></div>`;
        $('dueTbl').querySelector('tbody').innerHTML = S.nurses
          .filter((n) => n.patients.length)
          .map((n) => {
            const os = n.patients.flatMap((p) => p.orders);
            const mx = os.reduce((a, o) => Math.max(a, S.t - o.at), 0);
            const ov = os.filter((o) => S.t - o.at >= dueOf(n, o)).length;
            return `<tr><td>${n.role}</td><td class="n">${os.length}건</td><td class="n">${mx}분</td><td class="n" style="color:${ov ? 'var(--hi)' : 'inherit'}">${ov}건</td></tr>`;
          })
          .join('');
        $('catTbl').querySelector('tbody').innerHTML =
          CAT.map(
            ([nm, c, m]) =>
              `<tr><td>${nm}</td><td class="cat-${c.toLowerCase()}">${{ H: '높음', M: '중간', L: '낮음' }[c]}</td><td class="n">${m}</td></tr>`,
          ).join('') +
          `<tr><td>활력징후 측정</td><td>처방 주기별</td><td class="n">회당 ${VS_MIN}</td></tr><tr><td>간호요구 급증 (${EVENTS.join(', ')}, CPCR)</td><td class="cat-h">즉시 높음</td><td class="n">–</td></tr>`;
      }
      function ptLine(n, p, helpers) {
        const newsTxt =
          p.cpr && p.news == null
            ? '<span class="cpr">CPR 중</span>'
            : `<span class="${newsUp(p) ? 'news-up' : ''}">${p.news}${newsUp(p) ? ` ↑ (${NSTXT[nst(p.newsPrev)]} → ${NSTXT[nst(p.news)]})` : ''}</span>`;
        return `<div class="pt"><div class="pth"><b>${p.id} ${p.nm} <span class="ktas">KTAS ${p.ktas}</span></b><span>활력 ${vsTxt(p.vs)} · NEWS ${newsTxt}${p.avpu !== 'A' ? ` · <span class="news-up">AVPU ${p.avpu}</span>` : ''}</span></div>
    <div class="pid">${p.bed} · ${p.reg}</div>
    ${p.orders
      .map(
        (o) =>
          `<div class="ord ${S.t - o.at >= dueOf(n, o) ? 'late' : ''}"><span>${o.name} <span class="w">${o.min}분 · 대기 ${Math.max(0, S.t - o.at)}/기준 ${dueOf(n, o)}분</span></span><span class="acts">${isFull() || S.view === n.id ? `<button class="sm" data-act="do" data-n="${n.id}" data-p="${p.id}" data-o="${o.id}" data-by="${n.id}">수행</button>` : ''}${helpers
            .filter((h) => isFull() || S.view === h.from)
            .map(
              (h) =>
                `<button class="sm" data-act="do" data-n="${n.id}" data-p="${p.id}" data-o="${o.id}" data-by="${h.from}">${nurse(h.from).name} 수행</button>`,
            )
            .join('')}</span></div>`,
      )
      .join('')}
    ${p.sched
      .filter(([, at]) => at - S.t <= 60)
      .map(
        ([nm, at]) =>
          `<div class="ord"><span>예정: ${nm} <span class="w">${fmt(at)}</span></span></div>`,
      )
      .join('')}</div>`;
      }
      function card(n, detail) {
        const L = loadOf(n),
          lv = level(n),
          help = S.help[n.id],
          full = isFull();
        const sup = supportBy(n.id);
        const head = `<div class="stripe s-${lv}"></div><div class="hd"><div><div class="name">${n.name}</div><div class="role">${n.role}${L ? ` · 환자 ${n.patients.length}명` : n.coverBy ? ' · 환자 A-plus 지원간호사에게 임시 인계' : n.role === '소생실' ? ' · 대기 (환자 없음)' : ' · 역할 기본 단계'}</div></div><span class="lvl l-${lv}">${LVTXT[lv]}</span></div>`;
        const evWhy =
          L && L.ev
            ? `<span class="chip hi">'높음' 사유: ${L.ev.type} · ${L.ev.pid}</span>`
            : '';
        const flags = [
          n.prio && full ? '<span class="chip ac">지원 우선 대상</span>' : '',
          evWhy,
          help ? '<span class="chip hi">지원 필요 표시</span>' : '',
          L
            ? L.sups
                .map(
                  (s) =>
                    `<span class="chip ac">${nurse(s.from).name} 지원 중${s.role ? ` (${s.role})` : ''}</span>`,
                )
                .join('')
            : '',
          sup
            ? `<span class="chip ac">${nurse(sup.to).name} ${sup.accepted ? '지원 중' : '지원 배정 · 수락 대기'}</span>`
            : '',
        ].join('');
        const req =
          sup && !sup.accepted && (S.view === n.id || full)
            ? `<div class="req"><div><b>지원 배정 알림</b> · ${nurse(sup.to).name}(${nurse(sup.to).role}) 지원 요청 (${fmt(sup.start)})</div><div class="row">${S.view === n.id ? `<button class="sm pri" data-act="accept" data-from="${n.id}">수락</button>${['휴식', '중증 환자 전담', '다른 업무'].map((w) => `<button class="sm" data-act="decline" data-from="${n.id}" data-why="${w}">거절: ${w}</button>`).join('')}` : `<span class="empty">간호사 화면에서 수락·거절</span><button class="sm" data-act="view" data-v="${n.id}">${n.name} 화면 보기</button>`}</div></div>`
            : '';
        if (!detail)
          return `<article class="card">${head}<div class="flags">${flags}</div>${req}<div class="peer">${L ? '동료 화면에는 업무량 단계만 표시됩니다.' : n.role === '소생실' ? `소생실 대기 중 (현재 환자 없음)${S.cpr ? '' : ` · ${fmt(CPCR_AT)} CPCR 환자 내원 예정 (시연)`}` : '담당 환자 없이 역할 기본 단계로 표시합니다.'}</div></article>`;
        let meter = '';
        if (L) {
          const pct = (v) => Math.min(100, (v / 80) * 100);
          meter = `<div class="meter"><div class="mrow"><span>현재 업무량</span><b>${L.now}분</b></div><div class="mrow"><span>관찰 ${L.base} · 활력 ${L.vsl} · 대기 처방 ${L.pend}${L.sup ? ' · 지원 반영' : ''}</span><span>1시간 뒤 <b>${L.fc}분</b></span></div>
      <div class="track" aria-hidden="true"><i class="fc s-${LV(L.fc)}" style="width:${pct(L.fc)}%"></i><i class="s-${lv}" style="width:${pct(L.now)}%"></i><span class="tick" style="left:${pct(30)}%"></span><span class="tick" style="left:${pct(50)}%"></span></div></div>`;
        }
        const lateChip =
          L && L.late
            ? `<span class="chip hi">수행 기준 초과 ${L.late}건</span>`
            : '';
        const helpers = S.supports.filter((s) => s.to === n.id && activeSup(s));
        const pts = L
          ? `<div class="pts">${n.patients.map((p) => ptLine(n, p, helpers)).join('')}</div>`
          : '';
        const own = full || S.view === n.id;
        const ft = own
          ? `<div class="ft"><button class="sm ${help ? 'warn' : ''}" data-act="help" data-n="${n.id}">${help ? '지원 필요 해제' : '지원 필요'}</button>${L && L.ev ? `<button class="sm" data-act="evend" data-n="${n.id}">상황 종료</button>` : ''}${L && full ? `<button class="sm" data-act="prio" data-n="${n.id}">${n.prio ? '우선 대상 해제' : '우선 대상 지정'}</button>` : ''}<span class="grow"></span>${sup && sup.accepted ? `<button class="sm" data-act="end" data-from="${n.id}">지원 종료</button>` : ''}</div>`
          : `<div class="ft"><span class="empty">지원 중인 간호사의 화면입니다. 대신 수행하면 수행자는 본인으로 기록됩니다.</span></div>`;
        return `<article class="card">${head}${meter}<div class="flags">${flags}${lateChip}</div>${req}${pts}${ft}</article>`;
      }

      function trackHigh() {
        S.nurses.forEach((n) => {
          const hi = level(n) === 'hi';
          if (hi && S.hiSince[n.id] == null) S.hiSince[n.id] = S.t;
          if (!hi) delete S.hiSince[n.id];
        });
        const cap = capacity();
        if (cap.total > cap.limit) {
          if (S.cap3Since == null) S.cap3Since = S.t;
        } else S.cap3Since = null;
      }
      function cprAdvance() {
        const c = S.cpr;
        if (!c || c.closed) return;
        const n = nurse('n6'),
          p = S.nurses.flatMap((x) => x.patients).find((x) => x.id === 'R-01');
        if (!p) return;
        const owner = S.nurses.find((x) => x.patients.includes(p));
        const el = S.t - c.start;
        if (c.phase === 0 && el >= 15) {
          c.phase = 1;
          c.rosc = c.start + 15;
          p.orders = p.orders.filter(
            (o) => o.name !== 'CPR 진행' && o.name !== '에피네프린 투여',
          );
          p.news = 9;
          p.newsPrev = 9;
          p.vs = 15;
          p.avpu = 'U';
          [
            'A-line 삽입 준비·보조',
            'Central line 삽입 준비·보조',
            '승압제 투여 시작',
          ].forEach((nm) => p.orders.push(order(nm, S.t)));
          const ev = S.events.find((e) => e.nurse === owner.id && !e.end);
          if (ev) ev.type = 'ROSC 후 집중 처치';
          toast(
            `R-01 ROSC (${fmt(c.rosc)}) · 소생 후 처치 처방 3건 발생 · 한지호 '높음' 유지`,
          );
        } else if (c.phase === 1 && el >= 30) {
          c.phase = 2;
          p.newsPrev = p.news;
          p.news = 7;
          p.vs = 30;
          p.orders.push(order('중환자실 입원 준비', S.t));
          toast('R-01 안정화 · 중환자실 입원 준비 · CPR 팀 지원 종료 가능');
        }
      }
      function step(mins) {
        const pick = (a) => a[Math.floor(Math.random() * a.length)];
        S.t += mins;
        S.nurses.forEach((n) =>
          n.patients.forEach((p) => {
            if (p.cpr) return;
            p.newsPrev = p.news;
            if (Math.random() < 0.18)
              p.news = Math.min(9, p.news + 1 + (Math.random() < 0.3 ? 1 : 0));
            else if (Math.random() < 0.15 && p.news > 0) p.news -= 1;
            p.sched = p.sched.filter(([nm, at]) => {
              if (at <= S.t) {
                p.orders.push(order(nm, at));
                return false;
              }
              return true;
            });
            if (p.news >= 7) {
              if (p.vs > 15) p.vs = 15;
              if (Math.random() < 0.4)
                p.orders.push(
                  order(
                    pick([
                      '정맥 주사(IV push)',
                      '채혈',
                      'A-line 삽입 준비·보조',
                    ]),
                    S.t,
                  ),
                );
            } else if (p.news >= 5 && p.vs > 60) p.vs = 60;
          }),
        );
        if (!S.cpr && S.t >= CPCR_AT) triggerCPCR(true);
        else cprAdvance();
        if (Math.random() < 0.7) newOrder(true);
        trackHigh();
        render();
      }
      function newOrder(silent) {
        const pts = S.nurses.flatMap((n) =>
          n.patients.filter((p) => !p.cpr).map((p) => [n, p]),
        );
        const [n, p] = pts[Math.floor(Math.random() * pts.length)];
        const pool = CAT.filter((c) => !c[3]);
        const nm = pool[Math.floor(Math.random() * pool.length)][0];
        if (CATMAP[nm].cat === 'H' && Math.random() < 0.5)
          p.sched.push([nm, S.t + 30 + Math.floor(Math.random() * 3) * 10]);
        else p.orders.push(order(nm, S.t));
        if (!silent) {
          trackHigh();
          render();
          toast(
            `${p.id} ${p.nm} 처방 발생: ${nm} (${CATMAP[nm].min}분 · 담당 ${n.name})`,
          );
        }
      }
      function startSupport(from, to, extra = {}) {
        S.supports.push({
          from,
          to,
          start: S.t,
          end: null,
          tasks: 0,
          accepted: false,
          ...extra,
        });
        delete S.help[to];
      }
      document.addEventListener('click', (e) => {
        const b = e.target.closest('button[data-act]');
        if (!b) return;
        const d = b.dataset;
        if (d.act === 'do') {
          const n = nurse(d.n),
            p = n.patients.find((x) => x.id === d.p),
            i = p.orders.findIndex((o) => o.id == d.o),
            o = p.orders[i];
          p.orders.splice(i, 1);
          S.done[d.by] += o.min;
          if (d.by !== d.n) {
            const s = S.supports.find(
              (x) => x.from === d.by && x.to === d.n && activeSup(x),
            );
            if (s) s.tasks++;
          }
          toast(
            `${p.id} ${o.name} 수행 기록 · 수행자 ${nurse(d.by).name} (${o.min}분 귀속)`,
          );
        } else if (d.act === 'help') {
          S.help[d.n] = !S.help[d.n];
          toast(
            S.help[d.n]
              ? '"지원 필요"를 표시했습니다.'
              : '"지원 필요" 표시를 해제했습니다.',
          );
        } else if (d.act === 'assign') {
          startSupport(d.from, d.to);
          toast(
            `${nurse(d.from).name} 간호사에게 지원 배정 알림을 보냈습니다. 간호사 화면에서 수락하면 지원이 시작됩니다.`,
          );
        } else if (d.act === 'accept') {
          const s = supportBy(d.from);
          s.accepted = true;
          s.start = S.t;
          toast(
            `${nurse(d.from).name} → ${nurse(s.to).name} 지원 수락 · ${nurse(s.to).name} 화면이 함께 표시됩니다.`,
          );
        } else if (d.act === 'decline') {
          const s = supportBy(d.from);
          S.supports.splice(S.supports.indexOf(s), 1);
          S.decline.push({ from: d.from, to: s.to, t: S.t, why: d.why });
          toast(
            `지원 거절 · 사유: ${d.why}. 근무조 리더간호사 화면에 다른 지원자가 추천됩니다.`,
          );
        } else if (d.act === 'view') {
          S.view = d.v;
        } else if (d.act === 'prio') {
          const n = nurse(d.n);
          n.prio = !n.prio;
          toast(
            n.prio
              ? `${n.name} 간호사를 지원 우선 대상으로 지정했습니다. 알림 기준을 ${PRIO_EARLY}분 앞당겨 적용합니다.`
              : `${n.name} 간호사의 지원 우선 대상 지정을 해제했습니다.`,
          );
        } else if (d.act === 'evend') {
          const ev = S.events.find((x) => x.nurse === d.n && !x.end);
          ev.end = S.t;
          if (ev.pid === 'R-01' && S.cpr) {
            S.cpr.closed = true;
            S.supports
              .filter((s) => s.cpr && !s.end)
              .forEach((s) => {
                s.end = Math.max(S.t, s.start + 5);
                S.supMin[s.from] += s.end - s.start;
              });
            toast('CPCR 상황 종료 · CPR 팀 지원 기록을 저장했습니다.');
          } else toast(`간호요구 급증 상황 종료 · ${ev.type} (${ev.pid})`);
        } else if (d.act === 'end') {
          const s = supportBy(d.from);
          s.end = Math.max(S.t, s.start + 5);
          S.supMin[d.from] += s.end - s.start;
          toast(`지원 종료 · ${s.end - s.start}분, 수행 ${s.tasks}건 기록`);
        } else if (d.act === 'cprend') {
          const ts = S.supports.filter((s) => s.cpr && !s.end);
          ts.forEach((s) => {
            s.end = Math.max(S.t, s.start + 5);
            S.supMin[s.from] += s.end - s.start;
          });
          toast(
            `CPR 팀 지원 종료 · ${ts.map((s) => `${nurse(s.from).name} ${s.end - s.start}분`).join(', ')} 기록 · 원래 구역으로 복귀`,
          );
        } else if (d.act === 'cprteam') {
          [
            [d.a, '흉부압박 교대'],
            [d.b, '약물 투여·기록'],
          ]
            .filter(([id]) => id)
            .forEach(([id, role]) =>
              S.supports.push({
                from: id,
                to: 'n6',
                start: S.t,
                end: null,
                tasks: 0,
                accepted: true,
                cpr: true,
                role,
              }),
            );
          toast(
            'CPR 팀 배정 (긴급 · 자동 수락) · 팀원 구역에 공백이 생겨 4단계 알림을 확인하세요.',
          );
        } else if (d.act === 'aplus') {
          const n7 = {
            id: 'n7',
            name: 'A-plus 지원간호사',
            role: 'A-plus 지원',
            patients: [],
          };
          S.nurses.push(n7);
          S.done.n7 = 0;
          S.supMin.n7 = 0;
          const team = S.supports
            .filter((s) => s.cpr && !s.end)
            .map((s) => nurse(s.from))
            .sort((a, b) => b.patients.length - a.patients.length);
          if (
            S.cpr &&
            !S.cpr.closed &&
            team.length &&
            team[0].patients.length
          ) {
            const src = team[0];
            n7.patients = src.patients;
            src.patients = [];
            n7.role = `${src.role} (A-plus 지원)`;
            src.coverBy = 'n7';
            toast(
              `A-plus팀 지원 도착 · ${src.name}(CPR 팀)의 ${src.role} 환자 ${n7.patients.length}명 임시 담당`,
            );
          } else
            toast(
              'A-plus팀 지원 간호사가 근무조에 합류했습니다. 지원 배정 대상으로 추천됩니다.',
            );
        }
        trackHigh();
        render();
      });
      $('viewSel').addEventListener('change', (e) => {
        S.view = e.target.value;
        render();
      });
      $('btnStep').addEventListener('click', () => step(15));
      $('btnOrder').addEventListener('click', () => newOrder(false));
      $('btnEvent').addEventListener('click', () => {
        if (!S.demoEvent) {
          const n = nurse('n4'),
            p = n.patients.find((x) => x.id === '5-02');
          S.demoEvent = 1;
          p.newsPrev = p.news;
          p.news = 5;
          p.avpu = 'V';
          if (p.vs > 60) p.vs = 60;
          S.events.push({
            nurse: n.id,
            pid: p.id,
            type: '환자 상태 악화',
            start: S.t,
            end: null,
          });
          trackHigh();
          render();
          return toast(
            `간호요구 급증: 5-02 ${p.nm} NEWS 0 → 5 (양호 → 위험), AVPU A → V · 담당 최민준 즉시 '높음'`,
          );
        }
        const cand = S.nurses.filter(
          (n) =>
            n.patients.length &&
            !S.events.find((e) => e.nurse === n.id && !e.end),
        );
        if (!cand.length)
          return toast(
            '모든 환자 담당 간호사에게 간호요구 급증 상황이 진행 중입니다.',
          );
        const n = cand[Math.floor(Math.random() * cand.length)],
          ps = n.patients.filter((p) => !p.cpr),
          p = ps[Math.floor(Math.random() * ps.length)];
        const type = EVENTS[Math.floor(Math.random() * EVENTS.length)];
        S.events.push({ nurse: n.id, pid: p.id, type, start: S.t, end: null });
        trackHigh();
        render();
        toast(`간호요구 급증: ${type} (${p.id} ${p.nm} · 담당 ${n.name})`);
      });
      function triggerCPCR(auto) {
        if (S.cpr)
          return toast(
            S.cpr.closed
              ? '이번 시연의 CPCR 상황은 종료되었습니다. 초기화 후 다시 시연하세요.'
              : '소생실 CPCR 상황이 진행 중입니다.',
          );
        const n = nurse('n6');
        const mine = supportBy('n6');
        if (mine) {
          if (mine.accepted) {
            mine.end = Math.max(S.t, mine.start + 5);
            S.supMin.n6 += mine.end - mine.start;
          } else S.supports.splice(S.supports.indexOf(mine), 1);
        }
        n.patients.push({
          id: 'R-01',
          nm: '무명남',
          bed: '소생실 01',
          reg: '49010137 (신원 미확인)',
          ktas: 1,
          news: null,
          newsPrev: null,
          vs: 5,
          avpu: 'U',
          cpr: true,
          orders: [
            order('CPR 진행', S.t),
            order('에피네프린 투여', S.t),
            order('Intubation 준비·보조', S.t),
            order('채혈', S.t),
          ],
          sched: [],
        });
        S.events.push({
          nurse: 'n6',
          pid: 'R-01',
          type: 'CPCR',
          start: S.t,
          end: null,
        });
        S.cpr = { start: S.t, phase: 0, rosc: null, closed: false };
        if (!isFull()) S.view = 'leader';
        trackHigh();
        render();
        toast(
          `${fmt(S.t)} 소생실 R-01 CPCR 환자 내원 (내원 시 심정지) · 한지호 즉시 '높음'${mine ? ' · 진행 중이던 지원 자동 종료' : ''} · 긴급 알림`,
        );
      }
      $('btnCPCR').addEventListener('click', () => triggerCPCR(false));
      $('btnReset').addEventListener('click', () => {
        stopAuto();
        init();
        toast('초기 상태로 되돌렸습니다.');
      });
      function stopAuto() {
        clearInterval(autoT);
        autoT = null;
        const b = $('btnAuto');
        b.classList.remove('on');
        b.setAttribute('aria-pressed', 'false');
        b.textContent = '자동 진행';
      }
      $('btnAuto').addEventListener('click', () => {
        if (autoT) return stopAuto();
        autoT = setInterval(() => step(5), 2000);
        const b = $('btnAuto');
        b.classList.add('on');
        b.setAttribute('aria-pressed', 'true');
        b.textContent = '자동 진행 중지';
      });
      init();
      trackHigh();
      render();
