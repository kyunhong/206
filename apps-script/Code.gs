/**
 * 학급특색활동 아이디어 보드 + 진학 상담 고민함 + 특색활동 고르기 — 구글 Apps Script 백엔드
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

// 진로진학 상담 사전 설문 선택지 (학생 화면의 [data-group] 이름과 같아야 한다)
const COUNSEL_OPTIONS = {
  plan: ['4년제 대학', '전문대', '취업', '위탁교육 후 취업', '군입대', '아직 모르겠음'],
  decision: ['확실히 정했어요', '2~3개로 좁혔어요', '관심 분야만 있어요', '전혀 모르겠어요'],
  fields: ['인문', '사회·상경', '교육', '공학', '자연', '의약·보건', '예체능', '기술·직업'],
  admission: ['학생부교과', '학생부종합', '정시(수능)', '실기·실적', '잘 모르겠음'],
  region: ['서울', '경기·인천', '충청', '그 외 지역', '상관없음'],
  gradeFeel: ['목표에 맞는 편', '조금 부족', '많이 부족', '잘 모르겠음'],
  topics: ['성적·공부 방법', '대학·학과 선택', '수시·정시 전형', '진로·미래 고민', '전문대 진학', '위탁교육·취업', '생활기록부', '기타'],
};
const COUNSEL_LIMITS = { name: 20, hope: 60, content: 2000, request: 1000 };
const COUNSEL_HEADERS = [
  '제출 시각', '번호', '이름', '졸업 후 계획', '진로 결정 정도', '희망 진로·학과', '관심 계열',
  '관심 전형', '희망 지역', '성적 체감',
  '고민 분야', '고민 내용', '선생님이 알아봐 줬으면 하는 것', '처리 상태', '메모',
];
const COUNSEL_STATUS = ['접수', '상담 예정', '완료'];

// 학급특색활동 고르기: 2026학년도 2학년 학급특색활동 운영 계획(안) Ⅳ 세부 운영계획
// 학번은 5자리(학년 1 + 반 2 + 번호 2). 우리 반 학번만 받는다.
const CLASS_ID = '206';
const SHEET_ACTIVITY = '특색활동 선택';
const SHEET_ACTIVITY_SUM = '특색활동 집계';
const ACTIVITY_CATEGORIES = ['탐구·토론', '진로·학습', '공동체·나눔', '문화·창작'];
const ACTIVITIES = [
  { id: 1, cat: '탐구·토론', title: '이슈 탐색 및 토론·알리미 활동', desc: '자신의 진로 및 국내외 주요 시사 이슈를 조사·학습하여 학급 학생들에게 소개하거나, 매일 아침 시사 이슈를 정리하여 학급 게시판 및 뉴스 보드에 공유함. 또한 기사의 정확성·편향성을 분석하여 모둠원들과 토론을 진행함.' },
  { id: 2, cat: '탐구·토론', title: 'NIE(신문 활용 교육) 및 뉴스 비평 활동', desc: '신문 노트 및 진로 관련 뉴스를 활용하여 관심 기사를 읽고 내용을 요약하며 의견을 작성함. 뉴스의 객관성을 검토하고 토론 주제를 정해 모둠별 토론을 실시함.' },
  { id: 3, cat: '문화·창작', title: '학급 축제 위원 활동', desc: '학급 축제 행사의 성공적인 준비와 진행을 위해 축제 준비 위원회를 구성하여 운영함.' },
  { id: 4, cat: '진로·학습', title: '독서 프로그램 (교환 독서)', desc: '계열별·진로별 추천 도서를 읽고 메모나 감상을 나누거나, 학급 친구들과 같은 책을 교환하여 읽고 생각을 공유함.' },
  { id: 5, cat: '문화·창작', title: '학급 요리 활동', desc: '학급 구성원 간의 단합을 위해 각자 가져온 재료로 함께 요리를 만들고 나누어 먹는 활동을 진행함.' },
  { id: 6, cat: '공동체·나눔', title: '모닝콜 활동', desc: '등교 시간이 늦는 친구를 위해 짝을 지정하여 아침마다 등교 연락을 주고받도록 함.' },
  { id: 7, cat: '문화·창작', title: '학급 환경 꾸미기 활동', desc: '성탄절, 할로윈 등 특별한 절기나 기념일에 맞추어 학급의 게시판과 환경을 함께 꾸밈.' },
  { id: 8, cat: '공동체·나눔', title: '지속가능한 발전을 위한 활동 (분리수거 캠페인)', desc: '학급 내 분리수거가 철저히 이루어지도록 담당 학생을 지정하고 지속적인 분리수거 캠페인을 실시함.' },
  { id: 9, cat: '진로·학습', title: '점심시간 자기주도 학습 프로젝트 (아자습! / 학습 도우미 활동)', desc: '점심시간이나 아침 시간을 활용하여 자기주도적으로 자습을 진행하거나, 과목별 우수 학생이 친구들의 학습을 도와줌.' },
  { id: 10, cat: '진로·학습', title: '진로 그룹 활동 및 소개 (진로 멘토링)', desc: '진로가 유사한 친구들끼리 모여 정보를 공유하고, 관심 진로 및 전공 분야의 최근 이슈·핵심 정보를 카드 뉴스로 제작하여 학급 게시판 및 SNS에 공유함.' },
  { id: 11, cat: '문화·창작', title: '학급 구성원 캐리커처 공모전', desc: '미술에 관심 있는 학생들이 학급 구성원들의 특징을 살린 캐리커처를 그려 학급 단체 그림을 완성함.' },
  { id: 12, cat: '탐구·토론', title: '경제 토론 활동', desc: '우리나라의 주요 경제 현안을 바탕으로 모둠원 간 의견을 나누고 토론을 진행함.' },
  { id: 13, cat: '탐구·토론', title: '오늘은 내가 선생님? (학급학술제: 융합 탐구 발표)', desc: '하루 동안 아침 조회부터 종례까지 담임교사의 학급 업무를 대신 해 보거나, 수업 시간에 배운 교과 내용을 기반으로 융합 탐구 주제를 선정·조사하여 보고서를 바탕으로 수업 형태로 발표함.' },
  { id: 14, cat: '문화·창작', title: 'AI는 내 친구', desc: '생성형 AI 도구를 활용하여 자유로운 주제로 나만의 작품을 제작하고 학급 구성원에게 소개함.' },
  { id: 15, cat: '공동체·나눔', title: '오래도록 이어쓰는 오이마켓', desc: '안 쓰는 새 물건이나 깨끗한 물품을 가져와 학급 내에서 서로 사고파는 나눔 장터를 운영함.' },
  { id: 16, cat: '공동체·나눔', title: '학급 문제 해결 프로젝트', desc: '학급 내에서 발생하는 크고 작은 문제나 불편 사항을 스스로 발견하고, 해결 방안을 함께 모색하여 실행함.' },
  { id: 17, cat: '공동체·나눔', title: '1인 1역할', desc: '학급 운영에 필요한 다양한 역할과 책임을 학급 구성원 모두에게 분담하여 수행함.' },
  { id: 18, cat: '진로·학습', title: '한해를 돌아보는 학급 성찰 갤러리 (포트폴리오)', desc: '1년 동안의 학교생활 참여 기록과 명언, 활동 내용을 정리하여 나만의 성장 포트폴리오를 작성하고 서로의 성장을 격려하는 피드백을 주고받음.' },
  { id: 19, cat: '문화·창작', title: '오늘의 명언', desc: '매일 아침 교실 칠판 한구석에 마음을 울리는 명언을 적어 공유함으로써 긍정적인 학급 분위기를 조성함.' },
  { id: 20, cat: '문화·창작', title: '우리 학급 홍보물 만들기', desc: '우리 학급을 홍보하는 홍보물을 설계하고 제작하여 게시하는 활동.' },
  { id: 21, cat: '진로·학습', title: '학급 재능 공유 프로젝트', desc: '자신의 특기나 관심 분야에 대해 친구들에게 짧은 강의, 활동을 진행하고 서로 배움을 나누는 시간을 마련하는 활동.' },
  { id: 22, cat: '문화·창작', title: '미래 학교 설계하기', desc: '미래 학교/학급을 상상하고 조별로 역할 분담 후 설계 및 제작하는 활동.' },
  { id: 23, cat: '문화·창작', title: '오늘의 작품 추천하기', desc: '매주 드라마, 영화, 연극, 뮤지컬을 소개하는 포스터를 만들어 학급 게시판에 부착하기.' },
  { id: 24, cat: '탐구·토론', title: '학급 건강 빅데이터 분석 활동', desc: '교실 뒷판에 학급 친구들의 수면 시간, 아침식사 여부를 확인하는 스티커판을 부착한 후, 한 달간 누적된 데이터로 시각화하여 통계 후 결과를 분석하는 활동.' },
  { id: 25, cat: '공동체·나눔', title: '고민 상담 아이디어 활동', desc: '학급 친구들의 고민거리나 상황을 공유하고 해결책을 포스트잇에 적어 최적의 해결 방안을 선정하는 활동.' },
  { id: 26, cat: '탐구·토론', title: '우리 반 뉴스', desc: "매주/매월 학급에서 발생한 주요 소식과 활동을 선정하여 '우리 반 뉴스'를 제작하여 학급 게시판 또는 온라인 상으로 공유하는 활동." },
];
const ACTIVITY_HEADERS = ['학번', '번호', '이름', '활동 번호', '활동명', '처음 제출', '마지막 수정'];
const ACOL = { sid: 0, no: 1, name: 2, id: 3, title: 4, first: 5, last: 6 };

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
  activitySheet_();
  activitySumSheet_();
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
  }
  // 4행(특색활동 선택)도 같은 방식으로 추가한다. 예전 안내 문구는 4행에 있었으므로 5행으로 옮긴다.
  if (sh.getRange('A4').getValue() !== '특색활동 선택 받기') {
    sh.getRange('A4').setValue('특색활동 선택 받기').setFontWeight('bold').setFontColor(null);
    sh.getRange('B4').insertCheckboxes().check();
    sh.getRange('A5').setValue('※ B1에 학급 이름을 적어 주세요. B2 체크를 해제하면 아이디어 제안이, B3은 상담 접수가, B4는 특색활동 선택이 마감됩니다.').setFontColor('#6b6b70');
  }
  const v = sh.getRange('B1:B4').getValues();
  return {
    className: String(v[0][0] || '우리 반'), open: v[1][0] === true, counselOpen: v[2][0] === true,
    activityOpen: v[3][0] === true,
  };
}

function activitySheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(SHEET_ACTIVITY);
  if (sh) return sh;
  sh = ss.insertSheet(SHEET_ACTIVITY, 0);
  sh.getRange(1, 1, 1, ACTIVITY_HEADERS.length).setValues([ACTIVITY_HEADERS]).setFontWeight('bold').setBackground('#e3efe8');
  sh.setFrozenRows(1);
  sh.getRange('A:A').setNumberFormat('@'); // 학번이 숫자로 바뀌지 않도록
  sh.getRange('F:G').setNumberFormat('yyyy-mm-dd hh:mm');
  [70, 45, 80, 70, 320, 120, 120].forEach((w, i) => sh.setColumnWidth(i + 1, w));
  return sh;
}

// 활동별 희망 인원과 학생 이름. 수식이라 '특색활동 선택' 탭이 바뀌면 저절로 다시 계산된다.
function activitySumSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(SHEET_ACTIVITY_SUM);
  if (sh) return sh;
  sh = ss.insertSheet(SHEET_ACTIVITY_SUM, 1);
  const src = "'" + SHEET_ACTIVITY + "'!";
  const rows = ACTIVITIES.map((a, i) => {
    const r = i + 2;
    return [
      a.id, a.cat, a.title,
      '=COUNTIF(' + src + 'D:D,A' + r + ')',
      '=IFERROR(TEXTJOIN(", ",TRUE,FILTER(' + src + 'C2:C,' + src + 'D2:D=A' + r + ')),"")',
    ];
  });
  sh.getRange(1, 1, 1, 5).setValues([['번호', '분류', '활동명', '희망 인원', '희망 학생']]).setFontWeight('bold').setBackground('#e3efe8');
  sh.getRange(2, 1, rows.length, 5).setValues(rows);
  sh.setFrozenRows(1);
  sh.getRange('C:C').setWrap(true);
  sh.getRange('E:E').setWrap(true);
  [45, 90, 300, 70, 360].forEach((w, i) => sh.setColumnWidth(i + 1, w));
  return sh;
}

function counselSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(SHEET_COUNSEL);
  if (sh) {
    const head = sh.getRange(1, 1, 1, COUNSEL_HEADERS.length).getValues()[0];
    if (head.join('|') === COUNSEL_HEADERS.join('|')) return sh;
    // 질문지 형식이 바뀌었으므로 예전 기록은 이름만 바꿔 그대로 보관하고, 새 탭을 만든다
    let old = SHEET_COUNSEL + '(이전)';
    for (let i = 2; ss.getSheetByName(old); i++) old = SHEET_COUNSEL + '(이전' + i + ')';
    sh.setName(old);
  }
  sh = ss.insertSheet(SHEET_COUNSEL, 1);
  sh.getRange(1, 1, 1, COUNSEL_HEADERS.length).setValues([COUNSEL_HEADERS]).setFontWeight('bold').setBackground('#e8eef6');
  sh.setFrozenRows(1);
  sh.setFrozenColumns(3);
  sh.getRange('A:A').setNumberFormat('yyyy-mm-dd hh:mm');
  sh.getRange('D:O').setWrap(true).setVerticalAlignment('top');
  [120, 45, 70, 110, 120, 130, 130, 130, 110, 100, 150, 320, 240, 90, 220].forEach((w, i) => sh.setColumnWidth(i + 1, w));

  // 처리 상태(N열): 드롭다운 + 색 구분
  const status = sh.getRange('N2:N');
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
      case 'activity': return ok_(withLock_(() => activity_(req, token)));
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
    counselOpen: s.counselOpen, counselOptions: COUNSEL_OPTIONS, counselLimits: COUNSEL_LIMITS,
    activityOpen: s.activityOpen, activities: ACTIVITIES, activityCategories: ACTIVITY_CATEGORIES, classId: CLASS_ID,
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

// 진로진학 상담 설문: 시트에 적기만 하고 아무것도 돌려주지 않는다
function counsel_(req, token) {
  if (!settings_().counselOpen) throw new UserError('지금은 상담 신청을 받고 있지 않아요.');
  checkRate_(token);

  // 목록에 있는 값만 받는다
  const many = (key) => (Array.isArray(req[key]) ? COUNSEL_OPTIONS[key].filter((o) => req[key].indexOf(o) !== -1) : []);
  const one = (key) => (COUNSEL_OPTIONS[key].indexOf(req[key]) !== -1 ? req[key] : '');
  const no = Number(req.no);
  const c = {
    no: Number.isInteger(no) && no >= 1 && no <= 99 ? no : null,
    name: clean_(req.name, COUNSEL_LIMITS.name),
    plan: one('plan'),
    decision: one('decision'),
    hope: clean_(req.hope, COUNSEL_LIMITS.hope),
    fields: many('fields'),
    admission: many('admission'),
    region: many('region'),
    gradeFeel: one('gradeFeel'),
    topics: many('topics'),
    content: clean_(req.content, COUNSEL_LIMITS.content),
    request: clean_(req.request, COUNSEL_LIMITS.request),
  };
  const missing = [];
  if (!c.no) missing.push('번호');
  if (!c.name) missing.push('이름');
  if (!c.plan) missing.push('졸업 후 계획');
  if (!c.topics.length) missing.push('고민 분야');
  if (missing.length) throw new UserError(missing.join(', ') + '을(를) 입력해 주세요.');

  counselSheet_().appendRow([
    new Date(), c.no, c.name, c.plan, c.decision, c.hope, c.fields.join(', '),
    c.admission.join(', '), c.region.join(', '), c.gradeFeel,
    c.topics.join(', '), c.content, c.request, '접수', '',
  ]);
  return { ok: true };
}

// 학급특색활동 고르기: 학번당 한 줄. 다시 내면 그 줄의 활동을 바꾼다.
function activity_(req, token) {
  if (!settings_().activityOpen) throw new UserError('지금은 특색활동 선택을 받고 있지 않아요.');
  checkRate_(token);

  const sid = String(req.sid || '').trim();
  const no = Number(sid.slice(3));
  if (!/^\d{5}$/.test(sid) || sid.slice(0, 3) !== CLASS_ID || no < 1) {
    throw new UserError('학번을 다시 확인해 주세요. 우리 반 학번은 ' + CLASS_ID + '으로 시작하는 5자리예요.');
  }
  const name = clean_(req.name, LIMITS.name);
  if (!name) throw new UserError('이름을 입력해 주세요.');
  const act = ACTIVITIES.filter((a) => a.id === Number(req.activity))[0];
  if (!act) throw new UserError('활동을 하나 골라 주세요.');

  const sh = activitySheet_();
  const n = sh.getLastRow() - 1;
  const rows = n > 0 ? sh.getRange(2, 1, n, ACTIVITY_HEADERS.length).getValues() : [];
  const at = rows.findIndex((r) => String(r[ACOL.sid]) === sid);
  const now = new Date();
  if (at === -1) {
    sh.appendRow([sid, no, name, act.id, act.title, now, now]);
    return { updated: false };
  }
  // 다른 학생이 학번을 잘못 넣어 남의 선택을 덮어쓰지 않도록, 이름이 같을 때만 바꿔 준다
  if (String(rows[at][ACOL.name]).replace(/\s/g, '') !== name.replace(/\s/g, '')) {
    throw new UserError('이 학번은 다른 이름으로 이미 제출됐어요. 학번을 확인하고, 맞다면 선생님께 말해 주세요.');
  }
  sh.getRange(at + 2, ACOL.id + 1, 1, 2).setValues([[act.id, act.title]]);
  sh.getRange(at + 2, ACOL.last + 1).setValue(now);
  return { updated: true };
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
