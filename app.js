// 학생용 화면
const $ = (s) => document.querySelector(s);

const token = (() => {
  let t = null;
  try { t = localStorage.getItem('clientToken'); } catch {}
  if (!t) {
    t = crypto.randomUUID ? crypto.randomUUID() : Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, '0')).join('');
    try { localStorage.setItem('clientToken', t); } catch {}
  }
  return t;
})();

const API_URL = (window.APP_CONFIG && window.APP_CONFIG.API_URL) || '';

// Apps Script 웹 앱은 CORS 사전요청을 받지 못하므로 text/plain POST로 보낸다
const api = async (action, payload = {}) => {
  if (!API_URL) throw new Error('config.js에 Apps Script 주소(API_URL)를 먼저 넣어 주세요.');
  let res;
  try {
    res = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action, token, ...payload }),
    });
  } catch {
    throw new Error('서버에 연결할 수 없어요. 인터넷 연결을 확인해 주세요.');
  }
  const data = await res.json().catch(() => null);
  if (!data) throw new Error('서버 응답을 읽을 수 없어요. 잠시 후 다시 시도해 주세요.');
  if (!data.ok) throw new Error(data.error || '문제가 생겼어요. 다시 시도해 주세요.');
  return data.data;
};

const toast = (msg) => {
  const el = $('#toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toast.t);
  toast.t = setTimeout(() => el.classList.remove('show'), 2200);
};

const el = (tag, attrs = {}, ...children) => {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') n.className = v;
    else if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
    else n.setAttribute(k, v);
  }
  for (const c of children.flat()) if (c != null) n.append(c);
  return n;
};

let config = { competencies: [], counselOptions: {} };
let ideas = [];
let filter = null;
const selected = new Set();

// ---------- 탭 ----------
const showTab = (name) => {
  document.querySelectorAll('.tabs button').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === name)));
  $('#board').hidden = name !== 'board';
  $('#write').hidden = name !== 'write';
  window.scrollTo(0, 0);
};
document.querySelectorAll('.tabs button').forEach((b) => b.addEventListener('click', () => showTab(b.dataset.tab)));

// ---------- 목록 ----------
const timeAgo = (iso) => {
  const d = (Date.now() - new Date(iso)) / 1000;
  if (!iso || Number.isNaN(d)) return '';
  if (d < 60) return '방금 전';
  if (d < 3600) return `${Math.floor(d / 60)}분 전`;
  if (d < 86400) return `${Math.floor(d / 3600)}시간 전`;
  return `${Math.floor(d / 86400)}일 전`;
};

const renderFilters = () => {
  const box = $('#filters');
  box.replaceChildren(
    ...[null, ...config.competencies].map((c) =>
      el('button', { class: 'chip', type: 'button', 'aria-pressed': String(filter === c), onclick: () => { filter = c; renderFilters(); renderList(); } }, c || '전체'))
  );
};

const card = (idea, no) => {
  const likeBtn = el('button', { class: 'btn small like', type: 'button', 'aria-pressed': String(idea.liked), 'aria-label': '공감' },
    idea.liked ? '♥' : '♡', el('span', {}, String(idea.likes)));
  const paintLike = () => {
    likeBtn.setAttribute('aria-pressed', String(idea.liked));
    likeBtn.replaceChildren(idea.liked ? '♥' : '♡', el('span', {}, String(idea.likes)));
  };
  likeBtn.addEventListener('click', async () => {
    // 응답이 1~2초 걸리므로 먼저 화면에 반영하고, 실패하면 되돌린다
    const before = { liked: idea.liked, likes: idea.likes };
    idea.liked = !idea.liked;
    idea.likes += idea.liked ? 1 : -1;
    paintLike();
    likeBtn.disabled = true;
    try {
      Object.assign(idea, await api('like', { id: idea.id }));
    } catch (e) {
      Object.assign(idea, before);
      toast(e.message);
    } finally {
      likeBtn.disabled = false;
      paintLike();
    }
  });

  const c = el('article', { class: 'card' },
    el('div', { class: 'meta' },
      el('span', {}, `익명 제안 #${no}`, idea.mine ? el('span', { class: 'mine-badge' }, '내 글') : null),
      el('span', {}, timeAgo(idea.createdAt))),
    el('h2', {}, idea.title),
    el('div', { class: 'tags' }, idea.competencies.map((t) => el('span', { class: 'tag' }, t))),
    el('h3', {}, '구체적인 활동 내용'),
    el('p', {}, idea.content),
    el('div', { class: 'collapse' },
      el('h3', {}, '기대 효과'),
      el('p', {}, idea.effect),
      idea.competencyNote ? [el('h3', {}, '핵심 역량'), el('p', {}, idea.competencyNote)] : null),
  );
  const more = el('button', { class: 'more', type: 'button' }, '더 보기 ▾');
  more.addEventListener('click', () => {
    c.classList.toggle('open');
    more.textContent = c.classList.contains('open') ? '접기 ▴' : '더 보기 ▾';
  });
  const actions = el('div', { class: 'actions' }, likeBtn);
  if (idea.mine) {
    actions.append(el('button', {
      class: 'btn small danger', type: 'button',
      onclick: async () => {
        if (!confirm('내 아이디어를 삭제할까요?')) return;
        try { await api('delete', { id: idea.id }); toast('삭제했어요.'); load(); } catch (e) { toast(e.message); }
      },
    }, '삭제'));
  }
  actions.append(more);
  c.append(actions);
  return c;
};

const renderList = () => {
  // 번호는 제출 순서 기준(1번이 가장 먼저)
  const numbered = [...ideas].sort((a, b) => a.id - b.id).map((x, i) => [x, i + 1]);
  let rows = numbered.filter(([x]) => !filter || x.competencies.includes(filter));
  rows.sort($('#sort').value === 'like' ? (a, b) => b[0].likes - a[0].likes || b[0].id - a[0].id : (a, b) => b[0].id - a[0].id);
  $('#count').textContent = `아이디어 ${ideas.length}개`;
  $('#list').replaceChildren(
    ...(rows.length ? rows.map(([x, n]) => card(x, n))
      : [el('div', { class: 'empty' }, ideas.length ? '이 역량에 해당하는 아이디어가 아직 없어요.' : '아직 아이디어가 없어요.\n첫 번째로 제안해 보세요!')])
  );
};
$('#sort').addEventListener('change', renderList);

const load = async () => {
  try { ideas = await api('list'); renderList(); } catch (e) { toast(e.message); }
};

// ---------- 작성 폼 ----------
const renderCompChips = () => {
  $('#compChips').replaceChildren(...config.competencies.map((c) => {
    const b = el('button', { class: 'chip', type: 'button', 'aria-pressed': String(selected.has(c)) }, c);
    b.addEventListener('click', () => {
      selected.has(c) ? selected.delete(c) : selected.add(c);
      b.setAttribute('aria-pressed', String(selected.has(c)));
    });
    return b;
  }));
};

document.querySelectorAll('.counter').forEach((cnt) => {
  const ta = document.getElementById(cnt.dataset.for);
  const upd = () => (cnt.textContent = `${ta.value.length} / ${ta.maxLength}`);
  ta.addEventListener('input', upd);
  upd();
});

// 작성 중인 내용 임시 저장 (이 기기의 브라우저에만 남는다)
const DRAFT_KEY = 'ideaDraft';
const fields = ['name', 'title', 'content', 'effect', 'competencyNote'];
const saveDraft = () => {
  try { localStorage.setItem(DRAFT_KEY, JSON.stringify({ ...Object.fromEntries(fields.map((f) => [f, $('#' + f).value])), competencies: [...selected] })); } catch {}
};
const loadDraft = () => {
  try {
    const d = JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null');
    if (!d) return;
    fields.forEach((f) => { if (d[f]) $('#' + f).value = d[f]; });
    (d.competencies || []).forEach((c) => selected.add(c));
  } catch {}
};
$('#form').addEventListener('input', saveDraft);
$('#compChips').addEventListener('click', saveDraft);

$('#form').addEventListener('submit', async (e) => {
  e.preventDefault();
  $('#formError').textContent = '';
  const body = { ...Object.fromEntries(fields.map((f) => [f, $('#' + f).value])), competencies: [...selected] };
  const btn = $('#submitBtn');
  const label = btn.textContent; // 버튼 글자는 index.html에 적힌 그대로 되돌린다
  btn.disabled = true;
  btn.textContent = '제출하는 중…';
  try {
    await api('submit', body);
    const name = $('#name').value;
    $('#form').reset();
    $('#name').value = name; // 이름은 다음 제안을 위해 남겨둔다
    selected.clear();
    renderCompChips();
    document.querySelectorAll('textarea').forEach((t) => t.dispatchEvent(new Event('input')));
    try { localStorage.removeItem(DRAFT_KEY); } catch {}
    toast('제출 완료! 친구들에게는 익명으로 보여요.');
    await load();
    showTab('board');
  } catch (err) {
    $('#formError').textContent = err.message;
  } finally {
    btn.disabled = !config.open;
    btn.textContent = label;
  }
});

// ---------- 진로진학 상담 사전 설문 (3단계) ----------
// 민감한 내용이라 임시 저장하지 않고, 제출 후에는 화면에서도 지운다.
// 선택지 목록은 서버 config.counselOptions에서 받아 [data-group] 칸에 채운다.
const picks = {}; // 그룹 이름 -> 고른 값(Set)
const chipGroups = [...document.querySelectorAll('#counsel [data-group]')];
const steps = [...document.querySelectorAll('#counsel .step')];
let step = 1;

const renderCounselChips = () => {
  chipGroups.forEach((g) => {
    const name = g.dataset.group;
    const single = g.hasAttribute('data-single');
    const chosen = (picks[name] = picks[name] || new Set());
    g.replaceChildren(...((config.counselOptions || {})[name] || []).map((opt) => {
      const b = el('button', { class: 'chip', type: 'button', 'aria-pressed': String(chosen.has(opt)) }, opt);
      b.addEventListener('click', () => {
        const on = !chosen.has(opt);
        if (single) chosen.clear();
        on ? chosen.add(opt) : chosen.delete(opt);
        g.querySelectorAll('.chip').forEach((c) => c.setAttribute('aria-pressed', String(chosen.has(c.textContent))));
      });
      return b;
    }));
  });
};
const picked = (name) => [...(picks[name] || [])];

const showStep = (n) => {
  step = n;
  steps.forEach((f) => (f.hidden = Number(f.dataset.step) !== n));
  const cur = steps[n - 1];
  $('#stepCount').textContent = `${n} / ${steps.length} · ${cur.dataset.name}`;
  $('#stepBar').style.width = `${(n / steps.length) * 100}%`;
  $('#stepPrev').hidden = n === 1;
  $('#stepNext').hidden = n === steps.length;
  $('#counselBtn').hidden = n !== steps.length;
  $('#counselError').textContent = '';
  window.scrollTo(0, 0);
};

// 단계별 필수 항목 확인. 문제가 있으면 안내 문구를 돌려준다.
const checkStep = (n) => {
  if (n === 1) {
    const no = $('#cNo').value.trim();
    if (!/^\d{1,2}$/.test(no) || Number(no) < 1) return ['번호를 숫자로 적어 주세요.', $('#cNo')];
    if (!$('#cName').value.trim()) return ['이름을 적어 주세요.', $('#cName')];
    if (!picked('plan').length) return ['졸업 후 계획을 하나 골라 주세요.'];
  }
  if (n === 3 && !picked('topics').length) return ['고민 분야를 하나 이상 골라 주세요.'];
  return null;
};

const goNext = () => {
  const bad = checkStep(step);
  if (bad) {
    $('#counselError').textContent = bad[0];
    if (bad[1]) bad[1].focus();
    return;
  }
  showStep(step + 1);
};
$('#stepNext').addEventListener('click', goNext);
$('#stepPrev').addEventListener('click', () => showStep(step - 1));

const resetCounsel = () => {
  $('#counselForm').reset();
  Object.values(picks).forEach((set) => set.clear());
  renderCounselChips();
  $('#cContent').dispatchEvent(new Event('input'));
  $('#cRequest').dispatchEvent(new Event('input'));
  showStep(1);
};

$('#counselForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  // 입력 칸에서 엔터를 누르면 제출 대신 다음 단계로
  if (step < steps.length) return goNext();
  const bad = checkStep(1) || checkStep(3);
  if (bad) { $('#counselError').textContent = bad[0]; return; }

  const btn = $('#counselBtn');
  const label = btn.textContent;
  btn.disabled = true;
  btn.textContent = '보내는 중…';
  const v = (id) => $(id).value;
  try {
    await api('counsel', {
      no: Number(v('#cNo').trim()), name: v('#cName'),
      plan: picked('plan')[0] || '', decision: picked('decision')[0] || '', hope: v('#cHope'), fields: picked('fields'),
      admission: picked('admission'), region: picked('region'), gradeFeel: picked('gradeFeel')[0] || '',
      topics: picked('topics'), content: v('#cContent'), request: v('#cRequest'),
    });
    resetCounsel();
    $('#counselForm').hidden = true;
    $('#counselDone').hidden = false;
    window.scrollTo(0, 0);
  } catch (err) {
    $('#counselError').textContent = err.message;
  } finally {
    btn.disabled = !config.counselOpen;
    btn.textContent = label;
  }
});

$('#counselAgain').addEventListener('click', () => {
  $('#counselDone').hidden = true;
  $('#counselForm').hidden = false;
  showStep(1);
});

// ---------- 학급특색활동 고르기 ----------
// 마지막으로 낸 학번·이름·활동은 이 기기에만 기억해 두고, 다시 들어오면 채워 준다.
const ACT_KEY = 'activityChoice';
let actFilter = null;
let actPick = null; // 고른 활동 번호

const actById = (id) => (config.activities || []).find((a) => a.id === id);

const sidHint = () => {
  const sid = $('#aSid').value.trim();
  const hint = $('#aSidHint');
  hint.classList.remove('bad');
  if (!sid) { hint.textContent = ''; return; }
  if (/^\d{5}$/.test(sid) && sid.startsWith(config.classId || '') && Number(sid.slice(3)) >= 1) {
    hint.textContent = `${sid[0]}학년 ${Number(sid.slice(1, 3))}반 ${Number(sid.slice(3))}번`;
  } else if (sid.length === 5) {
    hint.textContent = `우리 반 학번은 ${config.classId}으로 시작하는 5자리예요.`;
    hint.classList.add('bad');
  } else {
    hint.textContent = '학번 5자리를 입력해 주세요.';
  }
};
$('#aSid').addEventListener('input', () => {
  $('#aSid').value = $('#aSid').value.replace(/\D/g, '');
  sidHint();
});

const paintPick = () => {
  const a = actById(actPick);
  $('#pickNow').textContent = a ? `${a.id}. ${a.title}` : '활동을 하나 골라 주세요';
  $('#pickNow').classList.toggle('on', !!a);
  document.querySelectorAll('#activityList .act').forEach((c) => {
    const on = Number(c.dataset.id) === actPick;
    c.classList.toggle('picked', on);
    c.querySelector('input').checked = on;
  });
};

const renderActivityFilters = () => {
  $('#activityFilters').replaceChildren(
    ...[null, ...(config.activityCategories || [])].map((c) =>
      el('button', { class: 'chip', type: 'button', 'aria-pressed': String(actFilter === c), onclick: () => { actFilter = c; renderActivityFilters(); renderActivities(); } }, c || '전체'))
  );
};

const actCard = (a) => {
  const radio = el('input', { type: 'radio', name: 'activity', value: String(a.id) });
  // 라디오는 원래 해제가 안 되므로, 이미 고른 카드를 다시 누르면 직접 해제한다
  radio.addEventListener('click', () => {
    actPick = actPick === a.id ? null : a.id;
    $('#activityError').textContent = '';
    paintPick();
  });
  const more = el('button', { class: 'more', type: 'button', 'aria-expanded': 'false' }, '자세히 ▾');
  const c = el('div', { class: 'act', 'data-id': String(a.id) },
    el('label', { class: 'act-pick' },
      radio,
      el('span', { class: 'act-no' }, String(a.id)),
      el('span', { class: 'act-body' },
        el('span', { class: 'act-title' }, a.title),
        el('span', { class: 'act-cat' }, a.cat))),
    el('p', { class: 'act-desc' }, a.desc),
    more);
  more.addEventListener('click', () => {
    const open = c.classList.toggle('open');
    more.setAttribute('aria-expanded', String(open));
    more.textContent = open ? '접기 ▴' : '자세히 ▾';
  });
  return c;
};

const renderActivities = () => {
  const all = config.activities || [];
  const rows = all.filter((a) => !actFilter || a.cat === actFilter);
  $('#activityCount').textContent = actFilter ? `${actFilter} ${rows.length}개` : `활동 ${all.length}개`;
  $('#activityList').replaceChildren(...rows.map(actCard));
  paintPick();
};

const loadChoice = () => {
  try { return JSON.parse(localStorage.getItem(ACT_KEY) || 'null'); } catch { return null; }
};
const showMine = () => {
  const d = loadChoice();
  const a = d && actById(d.activity);
  $('#activityMine').hidden = !a;
  if (a) $('#activityMine').replaceChildren(el('strong', {}, '이 기기에서 이미 제출했어요.'), el('br'), `${d.sid} ${d.name} · ${a.id}. ${a.title}`);
};

$('#activityForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const err = $('#activityError');
  err.textContent = '';
  const sid = $('#aSid').value.trim();
  const name = $('#aName').value.trim();
  if (!/^\d{5}$/.test(sid) || !sid.startsWith(config.classId) || Number(sid.slice(3)) < 1) {
    err.textContent = `학번을 확인해 주세요. 우리 반 학번은 ${config.classId}으로 시작하는 5자리예요.`;
    $('#aSid').focus();
    return;
  }
  if (!name) { err.textContent = '이름을 입력해 주세요.'; $('#aName').focus(); return; }
  const a = actById(actPick);
  if (!a) { err.textContent = '활동을 하나 골라 주세요.'; return; }
  if (!confirm(`${sid} ${name}\n${a.id}. ${a.title}\n\n이 활동으로 제출할까요?`)) return;

  const btn = $('#activityBtn');
  const label = btn.textContent;
  btn.disabled = true;
  btn.textContent = '보내는 중…';
  try {
    const r = await api('activity', { sid, name, activity: a.id });
    try { localStorage.setItem(ACT_KEY, JSON.stringify({ sid, name, activity: a.id })); } catch {}
    $('#activityDoneTitle').textContent = r.updated ? '선택을 바꿨어요.' : '제출했어요.';
    $('#activityDoneText').textContent = `${a.id}. ${a.title}`;
    $('#activityForm').hidden = true;
    $('#activityMine').hidden = true;
    $('#activityDone').hidden = false;
    window.scrollTo(0, 0);
  } catch (ex) {
    err.textContent = ex.message;
  } finally {
    btn.disabled = !config.activityOpen;
    btn.textContent = label;
  }
});

$('#activityAgain').addEventListener('click', () => {
  $('#activityDone').hidden = true;
  $('#activityForm').hidden = false;
  showMine();
  window.scrollTo(0, 0);
});

const startActivity = () => {
  const d = loadChoice();
  if (d) {
    if (!$('#aSid').value) $('#aSid').value = d.sid || '';
    if (!$('#aName').value) $('#aName').value = d.name || '';
    if (actPick == null && actById(d.activity)) actPick = d.activity;
  }
  sidHint();
  showMine();
  renderActivityFilters();
  renderActivities();
};

// ---------- 화면 전환 (#ideas, #counsel, #activity, 그 외는 메뉴) ----------
// 화면 제목은 index.html 각 section의 data-title에서 가져온다
let ideasStarted = false;
const VIEWS = ['ideas', 'counsel', 'activity'];

const route = () => {
  const view = VIEWS.includes(location.hash.slice(1)) ? location.hash.slice(1) : 'home';
  document.querySelectorAll('[data-view]').forEach((s) => (s.hidden = s.dataset.view !== view));
  const title = $(`[data-view="${view}"]`).dataset.title || '';
  $('#backLink').hidden = view === 'home';
  $('#ideaTabs').hidden = view !== 'ideas';
  $('#className').hidden = view === 'home';
  $('#pageTitle').textContent = title || config.className || '';
  document.title = `${config.className || ''} ${title}`.trim();
  if (view === 'counsel') {
    $('#counselDone').hidden = true;
    $('#counselForm').hidden = false;
  }
  if (view === 'activity') {
    $('#activityDone').hidden = true;
    $('#activityForm').hidden = false;
    showMine();
  }
  if (view === 'ideas' && !ideasStarted && config.competencies.length) {
    ideasStarted = true;
    load();
    setInterval(() => { if (!document.hidden && location.hash === '#ideas') load(); }, 60000);
  }
  window.scrollTo(0, 0);
};
window.addEventListener('hashchange', route);

// ---------- 시작 ----------
(async () => {
  $('#submitBtn').disabled = true;
  $('#counselBtn').disabled = true;
  $('#activityBtn').disabled = true;
  showStep(1);
  $('#list').replaceChildren(el('div', { class: 'empty' }, '아이디어를 불러오는 중…'));
  $('#activityList').replaceChildren(el('div', { class: 'empty' }, '활동 목록을 불러오는 중…'));
  route();
  try {
    config = await api('config');
  } catch (e) {
    $('#list').replaceChildren(el('div', { class: 'empty' }, e.message));
    $('#activityList').replaceChildren(el('div', { class: 'empty' }, e.message));
    $('#counselError').textContent = e.message;
    toast(e.message);
    return;
  }
  $('#className').textContent = config.className;
  $('#closedNotice').hidden = config.open;
  $('#submitBtn').disabled = !config.open;
  $('#counselClosed').hidden = config.counselOpen;
  $('#counselBtn').disabled = !config.counselOpen;
  $('#activityClosed').hidden = config.activityOpen;
  $('#activityBtn').disabled = !config.activityOpen;
  startActivity();
  loadDraft();
  renderFilters();
  renderCompChips();
  renderCounselChips();
  document.querySelectorAll('textarea').forEach((t) => t.dispatchEvent(new Event('input')));
  route();
})();
