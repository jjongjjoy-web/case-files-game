/* ===================================================
   game.js — CASE FILES 게임 핵심 로직 및 인터랙션 제어
   단서 상태 관리, Gemini API 연동, UI 트리거 전담
   =================================================== */

'use strict';

// ─── Gemini API 설정 ───
const GEMINI_API_KEY = 'AIzaSyBj1FZ8LPMjsopKADLU-g4a6n5qRdZ6-ik';
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;

// ─── 단서 데이터베이스 ───
const CLUES = {
  whiskey: {
    id: 'whiskey',
    name: '위스키 잔',
    icon: '🥃',
    desc: '잔 바닥에서 희귀 합성 독극물 성분이 검출됐다. 피해자 외에 이 잔을 만질 수 있는 사람은 극히 제한적이다.',
    suspect: 'elena',
    isKey: true
  },
  receipt: {
    id: 'receipt',
    name: '독극물 구매 영수증',
    icon: '🧾',
    desc: '서랍 깊숙이 숨겨진 영수증. 사망 3일 전 날짜. 구매자 이름란이 찢겨있지만 영수증 번호로 추적하면 엘레나 마쉬의 개인 계좌와 연결된다.',
    suspect: 'elena',
    isKey: true
  },
  spare_key: {
    id: 'spare_key',
    name: '보조 열쇠',
    icon: '🗝️',
    desc: '책상 서랍 깊숙이 숨겨진 펜트하우스 보조 열쇠. 엘레나가 관리하는 열쇠 보관함에서 사라졌던 복사본이다.',
    suspect: 'elena',
    isKey: true
  },
  schedule: {
    id: 'schedule',
    name: '당일 일정표',
    icon: '📅',
    desc: '비서 엘레나가 오후 9시에 공식 퇴근한 뒤 밤 10시 30분에 몰래 재침입한 출입 기록이 포착되었다.',
    suspect: 'elena',
    isKey: true
  },
  notepad: {
    id: 'notepad',
    name: '엘레나의 메모장',
    icon: '📓',
    desc: '서재 구석의 메모장. "독약 준비, 10시 30분 재침입, 증거 인멸 계획" 등 횡령 사실을 덮기 위한 음모가 적혀 있다.',
    suspect: 'elena',
    isKey: true
  },
  letter: {
    id: 'letter',
    name: '협박 편지',
    icon: '📄',
    desc: '사업 파트너 리처드가 빅터에게 보낸 거친 협박 편지. 횡령 혐의를 덮으려 돈을 요구했으나 실제 독살과는 연관성이 약하다.',
    suspect: 'richard',
    isKey: false
  },
  card: {
    id: 'card',
    name: '명함',
    icon: '🎴',
    desc: '책상 위에 놓인 리처드의 명함. 사망 당일 오후에 그가 방문해 빅터와 다투었다는 증거이지만 직접 살해 정황은 아니다.',
    suspect: 'richard',
    isKey: false
  },
  photo: {
    id: 'photo',
    name: '찢어진 사진',
    icon: '🖼️',
    desc: '쓰레기통에 잔인하게 찢겨 버려진 전 부인 나디아 솔의 사진. 그녀를 향한 분노가 느껴지나 독살과는 거리가 멀다.',
    suspect: 'nadia',
    isKey: false
  },
  divorce: {
    id: 'divorce',
    name: '이혼 합의서',
    icon: '📁',
    desc: '금전적 보상 요구가 기재된 이혼 서류. 나디아가 빅터에게 거액을 요구했으나, 독약 구매 경로는 발견되지 않았다.',
    suspect: 'nadia',
    isKey: false
  },
  apron: {
    id: 'apron',
    name: '요리사 앞치마',
    icon: '👨‍🍳',
    desc: '셰프 마커스의 파란 앞치마. 주머니 주변에서 흰 가루가 묻어있으나 분석 결과 단순한 제빵용 전분 가루였다.',
    suspect: 'marcus',
    isKey: false
  },
  window: {
    id: 'window',
    name: '잠긴 창문',
    icon: '🪟',
    desc: '안쪽에서 견고하게 잠긴 창문. 외부 침입 흔적은 없으며 범인은 내부 인물 혹은 열쇠 소지자일 것이다.',
    suspect: null,
    isKey: false
  },
  vial: {
    id: 'vial',
    name: '빈 독극물 용기',
    icon: '🧪',
    desc: '벽난로 구석에 버려진 작은 유리병. 감정 결과 영수증에 적힌 약품명과 일치하는 미량의 액체가 묻어 있다.',
    suspect: null,
    isKey: false
  }
};

// ─── 용의자 설정 ───
const SUSPECTS = {
  elena: {
    id: 'elena',
    name: '엘레나 마쉬',
    role: '피해자의 개인 비서',
    icon: '💃'
  },
  richard: {
    id: 'richard',
    name: '리처드 보스',
    role: '사업 경쟁자',
    icon: '🕶️'
  },
  nadia: {
    id: 'nadia',
    name: '나디아 솔',
    role: '피해자의 전 부인',
    icon: '👠'
  },
  marcus: {
    id: 'marcus',
    name: '마커스 테인',
    role: '전속 셰프',
    icon: '🔪'
  }
};

// ─── 로컬 하드보일드 백업 독백 사전 (API Key 만료/네트워크 차단 대비) ───
const LOCAL_MONOLOGUES = {
  whiskey: "차가운 위스키 잔 바닥에 눌어붙은 투명한 침전물... 빅터가 마지막으로 삼킨 것은 40도짜리 독주였을까, 아니면 누군가의 뒤틀린 악의였을까.",
  receipt: "서랍 깊숙이 숨겨져 있던 독극물 구매 영수증. 사망 3일 전의 날짜, 그리고 지워진 이름... 하지만 금융의 흔적은 지울 수 없지. 결국 한 사람을 가리키고 있다.",
  spare_key: "비서실 금고 구석에서 찾아낸 보조 열쇠다. 복사본이 존재한다는 건, 이 철옹성 같은 펜트하우스가 누군가에겐 문턱조차 없는 놀이터였다는 뜻이겠지.",
  schedule: "일정표는 거짓말을 하지 않는다. 오후 9시에 퇴근 도장을 찍은 비서 엘레나가 10시 30분에 왜 다시 이 방으로 체크인했는가. 어둠 속의 발걸음이다.",
  notepad: "서재 구석에 남겨진 메모장. 삐뚤빼뚤한 글씨체 속에 숨겨진 독약 준비와 재침입 계획... 계획된 살인의 차가운 청사진이로군.",
  letter: "장물 폭로 서한인가. 거칠고 모난 필체 끝에 사업가 리처드 보스의 이글거리는 탐욕이 어려있다. 금전의 균열은 살의의 훌륭한 불씨가 된다.",
  card: "책상 위에 버려지듯 놓인 리처드의 명함. 오늘 오후 그가 이곳에서 무엇을 속삭였는지는 모르지만, 남겨진 카드만이 그의 행적을 증명하고 있다.",
  photo: "반으로 찢겨 쓰레기통에 구겨진 웨딩 사진이라. 전 부인 나디아 솔의 흉터 같은 원망이 단면마다 거칠게 찢겨 나와 방 안을 맴도는군.",
  divorce: "먼지 쌓인 이혼 서류철. 서명란에 흩뿌려진 증오와 거액의 위자료 청구서... 사랑이 끝난 자리에 남는 건 오직 차가운 숫자와 집착뿐이다.",
  apron: "셰프의 앞치마 주머니 안쪽에 묻어 있는 정체불명의 흰 가루. 퉁명스러운 셰프 마커스가 주방의 불길 속에서 은밀하게 반죽하려 한 건 무엇이었을까.",
  window: "창문 걸쇠는 안쪽에서 조여져 있고 유리는 티 없이 매끄럽다. 외부에서 비바람을 뚫고 들어온 침입자는 없다. 어두운 방 안에는 오직 살인자와 빅터 둘뿐이었다.",
  vial: "벽난로 모퉁이에 버려진 작은 유리병. 그 안에 미량으로 남은 독약의 입자는 마치 사냥을 끝낸 포식자가 흘리고 간 이빨 같다."
};

// ─── 게임 런타임 상태 ───
const gameState = {
  foundClueIds: [],
  selectedClueId: null,
  isIntroTyping: false,
  isAICommenting: false,
  threeScene: null,
  activeAccusedId: null,
  typewriterTimer: null
};

// ─── DOM 단축 ───
const $ = id => document.getElementById(id);

// ─── 인트로 브리핑 텍스트 ───
const INTRO_BRIEF =
  "사건 번호 CF-1947-08 / 미술품 딜러 빅터 크레인 독살 사건\n\n" +
  "폭우가 몰아치던 밤, 시내 중심가 펜트하우스 서재에서 빅터 크레인이 쓰러진 채 발견되었다. 사인은 미상의 독극물 중독.\n" +
  "현장은 밀실에 가까웠으며 외부 침입의 흔적은 전무하다.\n\n" +
  "형사, 현장을 조사하고 8개의 단서를 수집하여 퍼즐을 맞추어라.\n" +
  "진실은 이 방 안에 숨겨져 있다.";

/* ═══════════════════════════════════════════
   인트로 화면 및 제어
   ═══════════════════════════════════════════ */
function initIntro() {
  const textEl = $('typewriter-text');
  const startBtn = $('intro-start-btn');
  const skipBtn = $('intro-skip-btn');
  
  gameState.isIntroTyping = true;
  
  // 타자기 타이핑 구동
  let i = 0;
  const interval = setInterval(() => {
    if (!gameState.isIntroTyping) {
      clearInterval(interval);
      return;
    }
    textEl.textContent += INTRO_BRIEF[i];
    i++;
    if (i >= INTRO_BRIEF.length) {
      clearInterval(interval);
      gameState.isIntroTyping = false;
      enableStartBtn();
    }
  }, 35);

  function enableStartBtn() {
    startBtn.style.opacity = '1';
    startBtn.style.pointerEvents = 'auto';
    skipBtn.style.display = 'none';
  }

  // 스킵 제어
  skipBtn.onclick = () => {
    clearInterval(interval);
    gameState.isIntroTyping = false;
    textEl.textContent = INTRO_BRIEF;
    enableStartBtn();
  };

  // 수사 시작
  startBtn.onclick = () => {
    startInvestigation();
  };
}

/* ─── 3D 수사 본부 개시 ─── */
function startInvestigation() {
  $('intro-screen').style.display = 'none';
  const gameScr = $('game-screen');
  gameScr.style.display = 'flex';
  gameScr.classList.add('fade-in');

  // Three.js 씬 초기화 (scene.js 전담)
  setTimeout(() => {
    try {
      gameState.threeScene = new PenthouseScene('game-canvas');
    } catch (err) {
      console.error("Three.js 씬 빌드 오류:", err);
    }
  }, 100);

  // 이벤트 조작부 세팅
  $('accuse-btn').onclick = showAccusationScreen;
  $('accusation-cancel-btn').onclick = hideAccusationScreen;
  $('accusation-confirm-btn').onclick = confirmAccusation;
  $('restart-btn').onclick = () => location.reload();

  updateClueCounterUI();
}

/* ═══════════════════════════════════════════
   단서 발견 및 수집 로직 (scene.js에서 호출됨)
   ═══════════════════════════════════════════ */
async function onClueFound(clueId) {
  const clue = CLUES[clueId];
  if (!clue) return;

  // 이미 발견한 단서인 경우 상세 창 활성화 및 선택 처리만 수행
  if (gameState.foundClueIds.includes(clueId)) {
    selectClue(clueId);
    return;
  }

  // 신규 수집 등록
  gameState.foundClueIds.push(clueId);
  updateClueCounterUI();

  // 1. 인벤토리 목록 렌더링에 노출
  const list = $('clue-list');
  const placeholder = list.querySelector('.no-clues');
  if (placeholder) placeholder.remove();

  const item = document.createElement('div');
  item.className = 'clue-item fade-in';
  item.id = `clue-item-${clueId}`;
  item.innerHTML = `
    <span class="clue-item-icon">${clue.icon}</span>
    <div class="clue-item-body">
      <span class="clue-item-name">${clue.name}</span>
      ${clue.isKey ? '<span class="clue-item-key-badge">[핵심 증거]</span>' : ''}
    </div>
  `;
  item.onclick = () => selectClue(clueId);
  list.appendChild(item);

  // 현재 아이템 선택
  selectClue(clueId);

  // 2. 형사의 냉소적인 AI 독백 가져오기 및 타자기 연출
  const systemPrompt = 
    "당신은 1940년대 하드보일드 누아르 소설의 형사입니다.\n" +
    "방금 수사 현장에서 단서를 발견했습니다.\n" +
    "2~3문장의 짧은 형사 독백을 한국어로 작성하십시오.\n" +
    "누아르 특유의 냉소적이고 시적인 문체를 사용하십시오.\n" +
    "단서의 의미를 암시하되 직접적으로 범인을 지목하지 마십시오.";
  const userMsg = `발견한 단서: ${clue.name} / 내용: ${clue.desc}`;

  // 수사 콘솔 로딩 상태 표기
  $('comment-text').textContent = '형사가 단서를 주시하며 곰곰이 생각에 빠집니다...';
  $('comment-indicator').style.display = 'inline-block';

  let monologueText;
  try {
    monologueText = await fetchGeminiMonologue(systemPrompt, userMsg);
  } catch (err) {
    console.warn("Gemini API 호출 오류 발생 - 로컬 누아르 독백 로드:", err);
    monologueText = LOCAL_MONOLOGUES[clueId] || "수상한 흔적이다... 철저히 쫓아야겠군.";
  }

  // 타자기 연출로 독백 텍스트 뿌리기
  typewriteComment(monologueText);

  // 3. 지목 버튼 해제 조건 감시 (핵심 단서 3개 이상)
  checkAccuseCondition();
}

/* ─── 단서 카운터 갱신 ─── */
function updateClueCounterUI() {
  const total = Object.keys(CLUES).length;
  const collected = gameState.foundClueIds.length;
  $('clues-count-ratio').textContent = `${collected} / ${total}`;
}

/* ─── 단서 상세 보기 ─── */
function selectClue(clueId) {
  gameState.selectedClueId = clueId;
  const clue = CLUES[clueId];

  // UI 리스트의 active 클래스 재편
  document.querySelectorAll('.clue-item').forEach(el => el.classList.remove('active'));
  const activeItem = $(`clue-item-${clueId}`);
  if (activeItem) activeItem.classList.add('active');

  // 상세 설명창 업데이트
  const detailBox = $('clue-detail-content');
  detailBox.innerHTML = `
    <div style="font-size: 16px; font-weight: bold; color: var(--accent); margin-bottom: 8px;">
      ${clue.icon} ${clue.name}
    </div>
    <div style="color: #d8d4c2; line-height: 1.6;">
      ${clue.desc}
    </div>
  `;
}

/* ─── 하단 독백 타자기 애니메이션 ─── */
function typewriteComment(text) {
  if (gameState.typewriterTimer) {
    clearInterval(gameState.typewriterTimer);
  }

  const commentTextEl = $('comment-text');
  const indicator = $('comment-indicator');
  
  commentTextEl.textContent = '';
  indicator.style.display = 'inline-block';

  let index = 0;
  gameState.typewriterTimer = setInterval(() => {
    commentTextEl.textContent += text[index];
    index++;
    if (index >= text.length) {
      clearInterval(gameState.typewriterTimer);
      indicator.style.display = 'none';
    }
  }, 40);
}

/* ─── 지목 조건 확인 ─── */
function checkAccuseCondition() {
  // 핵심 단서 수 세기
  const keyCollectedCount = gameState.foundClueIds.filter(cid => CLUES[cid].isKey).length;
  const accuseBtn = $('accuse-btn');
  const hintEl = $('accuse-btn-hint');

  if (keyCollectedCount >= 3) {
    accuseBtn.disabled = false;
    hintEl.style.color = 'var(--accent)';
    hintEl.textContent = '사건의 전말이 눈앞에 보입니다. 용의자를 지목하십시오.';
  } else {
    accuseBtn.disabled = true;
    hintEl.style.color = 'var(--text-dim)';
    hintEl.textContent = `핵심 단서를 3개 이상 모아야 지목할 수 있습니다. (현재: ${keyCollectedCount}개 수집)`;
  }
}

/* ─── Gemini API 통신 ─── */
async function fetchGeminiMonologue(systemPrompt, userMsg) {
  const contents = [
    {
      role: 'user',
      parts: [{ text: systemPrompt + '\n\n위 설정을 숙지하고 다음 상황에 답하시오.' }]
    },
    {
      role: 'model',
      parts: [{ text: '네, 준비되었습니다. 1940년대 누아르 형사의 목소리로 현장 조사를 해보겠습니다.' }]
    },
    {
      role: 'user',
      parts: [{ text: userMsg }]
    }
  ];

  const resp = await fetch(GEMINI_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents })
  });

  if (!resp.ok) {
    throw new Error(`Gemini API Error (HTTP ${resp.status})`);
  }

  const data = await resp.json();
  if (!data.candidates || !data.candidates[0]) {
    throw new Error('Empty response');
  }
  return data.candidates[0].content.parts[0].text;
}

/* ═══════════════════════════════════════════
   범인 지목 모달 핸들러
   ═══════════════════════════════════════════ */
function showAccusationScreen() {
  const screen = $('accusation-screen');
  screen.style.display = 'flex';

  const grid = $('accusation-grid');
  grid.innerHTML = '';
  gameState.activeAccusedId = null;
  $('accusation-confirm-btn').disabled = true;

  Object.values(SUSPECTS).forEach(s => {
    // 수사 중 발견된 해당 용의자 관련 단서 수 계산
    const relatedCluesCount = gameState.foundClueIds.filter(clueId => {
      const clue = CLUES[clueId];
      return clue && clue.suspect === s.id;
    }).length;

    const card = document.createElement('div');
    card.className = 'accusation-card';
    card.innerHTML = `
      <div class="acc-card-header">
        <span class="acc-card-icon">${s.icon}</span>
        <span class="acc-card-name">${s.name}</span>
        <span class="acc-card-role">${s.role}</span>
      </div>
      <div class="acc-card-desc">관련 단서 ${relatedCluesCount}개 발견</div>
    `;
    card.onclick = () => {
      document.querySelectorAll('.accusation-card').forEach(el => el.classList.remove('selected'));
      card.classList.add('selected');
      gameState.activeAccusedId = s.id;
      $('accusation-confirm-btn').disabled = false;
    };
    grid.appendChild(card);
  });
}

function hideAccusationScreen() {
  $('accusation-screen').style.display = 'none';
}

/* ─── 지목 최종 제출 ─── */
function confirmAccusation() {
  const suspectId = gameState.activeAccusedId;
  if (!suspectId) return;

  hideAccusationScreen();
  showEndingScreen(suspectId === 'elena', suspectId);
}

/* ─── 엔딩 디스플레이 ─── */
function showEndingScreen(isSuccess, suspectId) {
  // 3D 씬 소멸
  if (gameState.threeScene) {
    gameState.threeScene.destroy();
    gameState.threeScene = null;
  }

  $('game-screen').style.display = 'none';
  const resultScr = $('result-screen');
  resultScr.style.display = 'flex';

  const badge = $('result-badge');
  const title = $('result-title');
  const story = $('result-story');

  if (isSuccess) {
    badge.className = 'result-badge success';
    badge.textContent = 'SUCCESS';
    title.className = 'result-title success';
    title.textContent = '빅터 크레인 독살범 검거 성공';
    story.innerHTML = `
      <strong>[수사 전말 - 정의의 복수]</strong><br><br>
      당신은 개인 비서 <strong>엘레나 마쉬</strong>를 지목했고, 자백을 받아냈습니다.<br><br>
      엘레나는 빅터의 사업 자금 장부를 변조해 거액의 회삿돈을 횡령해 오고 있었습니다. 이를 알아챈 빅터가 당일 저녁 격분하여 해고 통보 및 경찰 신고를 예고했습니다.<br><br>
      궁지에 몰린 엘레나는 오후 9시경 알리바이를 대며 퇴근하는 척했으나, 숨겨둔 <strong>서재 보조 열쇠</strong>로 밤 10시 30분에 몰래 재침입했습니다. 그리고 빅터가 늘 마시던 <strong>위스키 잔</strong>에 맹독성 가루를 집어넣었습니다.<br><br>
      나디아 솔의 10시 밀회 편지 수색 흔적이나, 경쟁자 리처드 보스의 협박 편지 등 어수선한 단서가 당신을 방해했으나 당신은 일정표의 10시 30분 체크인 진실과 보조 열쇠의 지문을 대조해 그녀를 구속했습니다.<br><br>
      비바람이 몰아치던 네오누아르 시티의 펜트하우스에 다시 조용한 아침이 밝아옵니다.
    `;
  } else {
    const wrongSus = SUSPECTS[suspectId];
    badge.className = 'result-badge failure';
    badge.textContent = 'FAILED';
    title.className = 'result-title failure';
    title.textContent = '억울한 용의자 구속';
    story.innerHTML = `
      당신은 <strong>${wrongSus.name}</strong>을 살인범으로 체포했으나, 그는 무고한 희생양이었습니다.<br><br>
      당신이 오판한 사이, 진짜 살인마이자 빅터의 비서인 <strong>엘레나 마쉬</strong>는 본인의 횡령 흔적과 모든 유죄 증거를 인멸한 채 리무진을 타고 시내를 빠져나갔습니다.<br><br>
      진범을 가두지 못한 펜트하우스 서재 벽난로의 불씨는 싸늘하게 식어만 가고, 독배를 남긴 자는 영원히 도심의 안개 너머로 숨어버렸습니다.<br><br>
      수사는 실패했습니다. 다시 현장으로 돌아가 증거를 치밀하게 대조하십시오.
    `;
  }
}

// ─── 부트스트랩 ───
document.addEventListener('DOMContentLoaded', () => {
  // 아티스트 스테이트먼트 화면 → 인트로 전환
  const stmtScreen = document.getElementById('statement-screen');
  const introScreen = document.getElementById('intro-screen');
  const enterBtn = document.getElementById('stmt-enter-btn');

  enterBtn.addEventListener('click', () => {
    // 스테이트먼트 화면 페이드아웃
    stmtScreen.style.transition = 'opacity 0.5s ease';
    stmtScreen.style.opacity = '0';
    setTimeout(() => {
      stmtScreen.style.display = 'none';
      // 인트로 화면 표시 후 타자기 시작
      introScreen.style.display = 'flex';
      initIntro();
    }, 500);
  });

  // 3D scene.js 와의 연계를 위해 window 전역 공간에 핵심 인터페이스 바인딩
  window.game = {
    onClueFound: onClueFound
  };
});
