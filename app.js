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

let config = { competencies: [], counselTopics: [] };
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

// ---------- 진학 상담 고민 ----------
// 민감한 내용이라 임시 저장하지 않고, 제출 후에는 화면에서도 지운다
const topics = new Set();

const renderTopicChips = () => {
  $('#topicChips').replaceChildren(...(config.counselTopics || []).map((t) => {
    const b = el('button', { class: 'chip', type: 'button', 'aria-pressed': String(topics.has(t)) }, t);
    b.addEventListener('click', () => {
      topics.has(t) ? topics.delete(t) : topics.add(t);
      b.setAttribute('aria-pressed', String(topics.has(t)));
    });
    return b;
  }));
};

const resetCounsel = () => {
  $('#counselForm').reset();
  topics.clear();
  renderTopicChips();
  $('#cContent').dispatchEvent(new Event('input'));
  $('#counselError').textContent = '';
};

$('#counselForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  $('#counselError').textContent = '';
  const no = $('#cNo').value.trim();
  if (!/^\d{1,2}$/.test(no) || Number(no) < 1) {
    $('#counselError').textContent = '번호를 숫자로 적어 주세요.';
    $('#cNo').focus();
    return;
  }
  const btn = $('#counselBtn');
  const label = btn.textContent;
  btn.disabled = true;
  btn.textContent = '보내는 중…';
  try {
    await api('counsel', { no: Number(no), name: $('#cName').value, hope: $('#cHope').value, content: $('#cContent').value, topics: [...topics] });
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
  window.scrollTo(0, 0);
});

// ---------- 화면 전환 (#ideas, #counsel, 그 외는 메뉴) ----------
// 화면 제목은 index.html 각 section의 data-title에서 가져온다
let ideasStarted = false;

const route = () => {
  const view = location.hash === '#ideas' || location.hash === '#counsel' ? location.hash.slice(1) : 'home';
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
  $('#list').replaceChildren(el('div', { class: 'empty' }, '아이디어를 불러오는 중…'));
  route();
  try {
    config = await api('config');
  } catch (e) {
    $('#list').replaceChildren(el('div', { class: 'empty' }, e.message));
    $('#counselError').textContent = e.message;
    toast(e.message);
    return;
  }
  $('#className').textContent = config.className;
  $('#closedNotice').hidden = config.open;
  $('#submitBtn').disabled = !config.open;
  $('#counselClosed').hidden = config.counselOpen;
  $('#counselBtn').disabled = !config.counselOpen;
  loadDraft();
  renderFilters();
  renderCompChips();
  renderTopicChips();
  document.querySelectorAll('textarea').forEach((t) => t.dispatchEvent(new Event('input')));
  route();
})();
