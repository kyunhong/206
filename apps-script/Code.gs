/**
 * 학급특색활동 아이디어 보드 + 진학 상담 고민함 — 구글 Apps Script 백엔드
 *
 * 이 스크립트는 구글 시트에 붙어서 동작한다.
 * - 학생 이름은 시트에만 저장되고, 학생 화면으로는 절대 보내지 않는다.
 * - 선생님은 시트를 열어 이름 확인, 숨김(체크박스), 행 삭제로 관리한다.
 * - 진학 상담 고민은 저장만 하고, 학생 화면으로 내보내는 기능 자체가 없다.
 */

const SHEET_IDEAS = '아이디어';
const SHEET_LIKES = '공감';
const SHEET_SETTINGS = '설정';
const SHEET_COUNSEL = '진학상담';

const COUNSEL_TOPICS = ['성적·공부 방법', '대학·학과 선택', '수시·정시 전형', '진로·미래 고민', '전문대 진학', '위탁교육·취업', '생활기록부', '기타'];
const COUNSEL_LIMITS = { name: 20, hope: 60, content: 2000 };
const COUNSEL_HEADERS = ['제출 시각', '번호', '이름', '고민 분야', '희망 진로·학과', '고민 내용', '처리 상태', '메모'];
const COUNSEL_STATUS = ['접수', '상담 예정', '완료'];

// 2022 개정 교육과정 핵심역량
const COMPETENCIES = ['자기관리', '지식정보처리', '창의적 사고', '심미적 감성', '협력적 소통', '공동체'];
const LIMITS = { name: 20, title: 60, content: 1500, effect: 1000, competencyNote: 600 };

const IDEA_HEADERS = ['번호', '제출 시각', '이름', '활동명', '구체적인 활동 내용', '기대 효과', '핵심 역량', '핵심 역량 설명', '공감 수', '숨김', '작성자 키'];
const COL = { id: 0, createdAt: 1, name: 2, title: 3, content: 4, effect: 5, competencies: 6, note: 7, likes: 8, hidden: 9, owner: 10 };

// ---------- 시트 준비 ----------

/** 처음 한 번 실행: 시트와 머리글을 만들고 권한을 승인받는다. */
function setup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  ideasSheet_();
  likesSheet_();
  settings_();
  counselSheet_();
  const blank = ss.getSheetByName('시트1') || ss.getSheetByName('Sheet1');
  if (blank && ss.getSheets().length > 1 && blank.getLastRow() === 0) ss.deleteSheet(blank);
  ss.setActiveSheet(ss.getSheetByName(SHEET_IDEAS));
}

function ideasSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(SHEET_IDEAS);
  if (sh) return sh;
  sh = ss.insertSheet(SHEET_IDEAS, 0);
  sh.getRange(1, 1, 1, IDEA_HEADERS.length).setValues([IDEA_HEADERS]).setFontWeight('bold').setBackground('#e3efe8');
  sh.setFrozenRows(1);
  sh.getRange('B:B').setNumberFormat('yyyy-mm-dd hh:mm');
  sh.getRange('D:H').setWrap(true).setVerticalAlignment('top');
  [50, 120, 70, 160, 320, 240, 150, 220, 60, 50].forEach((w, i) => sh.setColumnWidth(i + 1, w));
  sh.hideColumns(COL.owner + 1);
  return sh;
}

function likesSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(SHEET_LIKES);
  if (sh) return sh;
  sh = ss.insertSheet(SHEET_LIKES);
  sh.getRange(1, 1, 1, 2).setValues([['아이디어 번호', '브라우저 키']]).setFontWeight('bold');
  sh.setFrozenRows(1);
  sh.hideSheet();
  return sh;
}

function settingsSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(SHEET_SETTINGS);
  if (sh) return sh;
  sh = ss.insertSheet(SHEET_SETTINGS);
  sh.getRange('A1:B2').setValues([['학급 이름', '우리 반'], ['제안 받기', true]]);
  sh.getRange('A1:A2').setFontWeight('bold');
  sh.getRange('B2').insertCheckboxes().check();
  sh.setColumnWidth(1, 120);
  sh.setColumnWidth(2, 200);
  return sh;
}

function settings_() {
  const sh = settingsSheet_();
  // 이전 버전 시트에는 3행(상담 접수)이 없으므로 처음 한 번 채워 넣는다
  if (sh.getRange('A3').getValue() !== '상담 접수 받기') {
    sh.getRange('A3').setValue('상담 접수 받기').setFontWeight('bold');
    sh.getRange('B3').insertCheckboxes().check();
    sh.getRange('A4').setValue('※ B1에 학급 이름을 적어 주세요. B2 체크를 해제하면 아이디어 제안이, B3 체크를 해제하면 상담 접수가 마감됩니다.').setFontColor('#6b6b70');
  }
  const v = sh.getRange('B1:B3').getValues();
  return { className: String(v[0][0] || '우리 반'), open: v[1][0] === true, counselOpen: v[2][0] === true };
}

function counselSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(SHEET_COUNSEL);
  if (sh) {
    // 이전 버전 시트에는 '번호' 열이 없으므로 B열에 끼워 넣는다 (기존 행은 번호 칸이 비어 있게 됨)
    if (sh.getRange('B1').getValue() !== '번호') {
      sh.insertColumnBefore(2);
      sh.getRange('B1').setValue('번호').setFontWeight('bold').setBackground('#e8eef6');
      sh.setColumnWidth(2, 50);
    }
    return sh;
  }
  sh = ss.insertSheet(SHEET_COUNSEL, 1);
  sh.getRange(1, 1, 1, COUNSEL_HEADERS.length).setValues([COUNSEL_HEADERS]).setFontWeight('bold').setBackground('#e8eef6');
  sh.setFrozenRows(1);
  sh.getRange('A:A').setNumberFormat('yyyy-mm-dd hh:mm');
  sh.getRange('D:H').setWrap(true).setVerticalAlignment('top');
  [120, 50, 70, 150, 140, 380, 90, 240].forEach((w, i) => sh.setColumnWidth(i + 1, w));

  // 처리 상태: 드롭다운 + 색 구분
  const status = sh.getRange('G2:G');
  status.setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(COUNSEL_STATUS, true).build());
  const color = (text, bg) => SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo(text).setBackground(bg).setRanges([status]).build();
  sh.setConditionalFormatRules([color('접수', '#fde8e4'), color('상담 예정', '#fff3cd'), color('완료', '#e3efe8')]);
  return sh;
}

// ---------- 웹 요청 ----------
// 학생 화면은 모든 요청을 POST(text/plain)로 보낸다. (CORS 사전요청을 피하고, 브라우저 키를 URL에 남기지 않기 위해)

function doGet() {
  return json_({ ok: true, data: { message: '학급 소통함 API가 동작 중입니다.' } });
}

function doPost(e) {
  try {
    const req = JSON.parse((e.postData && e.postData.contents) || '{}');
    const token = /^[a-zA-Z0-9-]{16,64}$/.test(req.token || '') ? req.token : null;
    switch (req.action) {
      case 'config': return ok_(config_());
      case 'list': return ok_(list_(token));
      case 'submit': return ok_(withLock_(() => submit_(req, token)));
      case 'like': return ok_(withLock_(() => like_(Number(req.id), token)));
      case 'delete': return ok_(withLock_(() => deleteOwn_(Number(req.id), token)));
      case 'counsel': return ok_(withLock_(() => counsel_(req, token)));
      default: throw new UserError('알 수 없는 요청입니다.');
    }
  } catch (err) {
    if (err instanceof UserError) return json_({ ok: false, error: err.message });
    console.error(err);
    return json_({ ok: false, error: '문제가 생겼어요. 잠시 후 다시 시도해 주세요.' });
  }
}

class UserError extends Error {}

const json_ = (obj) => ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
const ok_ = (data) => json_({ ok: true, data });

function withLock_(fn) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) throw new UserError('사용자가 많아요. 잠시 후 다시 시도해 주세요.');
  try { return fn(); } finally { lock.releaseLock(); }
}

function config_() {
  const s = settings_();
  return {
    className: s.className, open: s.open, competencies: COMPETENCIES, limits: LIMITS,
    counselOpen: s.counselOpen, counselTopics: COUNSEL_TOPICS, counselLimits: COUNSEL_LIMITS,
  };
}

function ideaRows_() {
  const sh = ideasSheet_();
  const n = sh.getLastRow() - 1;
  return n > 0 ? sh.getRange(2, 1, n, IDEA_HEADERS.length).getValues() : [];
}

function likeRows_() {
  const sh = likesSheet_();
  const n = sh.getLastRow() - 1;
  return n > 0 ? sh.getRange(2, 1, n, 2).getValues() : [];
}

function list_(token) {
  const likes = likeRows_();
  const count = {};
  const mineLiked = {};
  likes.forEach(([id, voter]) => {
    count[id] = (count[id] || 0) + 1;
    if (token && voter === token) mineLiked[id] = true;
  });
  return ideaRows_()
    .filter((r) => r[COL.id] !== '' && r[COL.hidden] !== true)
    .map((r) => ({
      id: Number(r[COL.id]),
      // 이름(COL.name)과 작성자 키(COL.owner)는 절대 내보내지 않는다
      title: String(r[COL.title]),
      content: String(r[COL.content]),
      effect: String(r[COL.effect]),
      competencies: String(r[COL.competencies]).split(',').map((s) => s.trim()).filter(Boolean),
      competencyNote: String(r[COL.note]),
      likes: count[r[COL.id]] || 0,
      liked: !!mineLiked[r[COL.id]],
      mine: !!token && r[COL.owner] === token,
      createdAt: r[COL.createdAt] instanceof Date ? r[COL.createdAt].toISOString() : '',
    }))
    .sort((a, b) => b.id - a.id);
}

// 시트에서 수식으로 해석되지 않도록 = + - @ 로 시작하는 값은 글자로 고정
const clean_ = (v, max) => {
  const s = typeof v === 'string' ? v.trim().slice(0, max) : '';
  return /^[=+\-@]/.test(s) ? "'" + s : s;
};

// 같은 브라우저에서 1분에 5건까지
function checkRate_(token) {
  if (!token) throw new UserError('잘못된 요청입니다. 새로고침 후 다시 시도해 주세요.');
  const cache = CacheService.getScriptCache();
  const key = 'rate:' + token;
  const n = Number(cache.get(key) || 0);
  if (n >= 5) throw new UserError('너무 빠르게 제출하고 있어요. 잠시 후 다시 시도해 주세요.');
  cache.put(key, String(n + 1), 60);
}

// 진학 상담 고민: 시트에 적기만 하고 아무것도 돌려주지 않는다
function counsel_(req, token) {
  if (!settings_().counselOpen) throw new UserError('지금은 상담 신청을 받고 있지 않아요.');
  checkRate_(token);

  const no = Number(req.no);
  const c = {
    no: Number.isInteger(no) && no >= 1 && no <= 99 ? no : null,
    name: clean_(req.name, COUNSEL_LIMITS.name),
    hope: clean_(req.hope, COUNSEL_LIMITS.hope),
    content: clean_(req.content, COUNSEL_LIMITS.content),
    topics: Array.isArray(req.topics) ? COUNSEL_TOPICS.filter((t) => req.topics.indexOf(t) !== -1) : [],
  };
  const missing = [];
  if (!c.no) missing.push('번호');
  if (!c.name) missing.push('이름');
  if (!c.topics.length) missing.push('고민 분야');
  if (!c.content) missing.push('고민 내용');
  if (missing.length) throw new UserError(missing.join(', ') + '을(를) 입력해 주세요.');

  counselSheet_().appendRow([new Date(), c.no, c.name, c.topics.join(', '), c.hope, c.content, '접수', '']);
  return { ok: true };
}

function submit_(req, token) {
  if (!settings_().open) throw new UserError('지금은 제안을 받고 있지 않아요.');
  checkRate_(token);

  const idea = {
    name: clean_(req.name, LIMITS.name),
    title: clean_(req.title, LIMITS.title),
    content: clean_(req.content, LIMITS.content),
    effect: clean_(req.effect, LIMITS.effect),
    note: clean_(req.competencyNote, LIMITS.competencyNote),
    competencies: Array.isArray(req.competencies) ? COMPETENCIES.filter((c) => req.competencies.indexOf(c) !== -1) : [],
  };
  const missing = [];
  if (!idea.name) missing.push('이름');
  if (!idea.title) missing.push('활동명');
  if (!idea.content) missing.push('구체적인 활동 내용');
  if (!idea.effect) missing.push('기대 효과');
  if (!idea.competencies.length) missing.push('핵심 역량');
  if (missing.length) throw new UserError(missing.join(', ') + '을(를) 입력해 주세요.');

  const sh = ideasSheet_();
  const props = PropertiesService.getScriptProperties();
  const lastId = Math.max(Number(props.getProperty('lastId') || 0), ...ideaRows_().map((r) => Number(r[COL.id]) || 0));
  const id = lastId + 1;
  props.setProperty('lastId', String(id));

  sh.appendRow([id, new Date(), idea.name, idea.title, idea.content, idea.effect, idea.competencies.join(', '), idea.note, 0, false, token]);
  sh.getRange(sh.getLastRow(), COL.hidden + 1).insertCheckboxes();
  return { id };
}

function findIdeaRow_(id) {
  const rows = ideaRows_();
  for (let i = 0; i < rows.length; i++) if (Number(rows[i][COL.id]) === id) return { index: i + 2, row: rows[i] };
  return null;
}

function like_(id, token) {
  if (!token) throw new UserError('잘못된 요청입니다.');
  const found = findIdeaRow_(id);
  if (!found || found.row[COL.hidden] === true) throw new UserError('없는 아이디어예요.');

  const sh = likesSheet_();
  const likes = likeRows_();
  let liked;
  const at = likes.findIndex(([i, v]) => Number(i) === id && v === token);
  if (at !== -1) { sh.deleteRow(at + 2); liked = false; }
  else { sh.appendRow([id, token]); liked = true; }

  const total = likes.filter(([i]) => Number(i) === id).length + (liked ? 1 : -1);
  ideasSheet_().getRange(found.index, COL.likes + 1).setValue(total);
  return { liked, likes: total };
}

function deleteOwn_(id, token) {
  const found = findIdeaRow_(id);
  if (!found || !token || found.row[COL.owner] !== token) throw new UserError('내가 쓴 글만 삭제할 수 있어요.');
  ideasSheet_().deleteRow(found.index);
  return { ok: true };
}
