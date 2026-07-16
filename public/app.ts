// ==========================================
// Echo-Menu 3.0: Frontend Core Script (TypeScript)
// ==========================================

// window 객체 전역 타입 확장 선언 (Vite/TS 컴파일용)
declare global {
  interface Window {
    changeCategory: (cat: string) => void;
    selectMenuItem: (id: string) => void;
    cancelPopup: () => void;
    confirmPopup: () => void;
    checkoutCart: () => void;
    insertCardMock: () => void;
    resetKiosk: () => void;
  }
}

// 글로벌 상태 변수
let currentVenueKey: string = "starbucks";
let currentVenueData: any = null;
let currentKioskState: string = "start"; // start, menu, popup, cart_confirm, pay_select, done
let selectedCategory: string = "추천메뉴";
let currentCart: any[] = [];
let targetMenuItem: any = null;
let isVoiceMode: boolean = true; // 최초 온보딩에서 분기됨
let isFreezed: boolean = false; // Screen Freeze 여부
let streamInterval: any = null;

// 가상 손가락 좌표 (시연용: 화면 상의 마우스 위치를 가상 손끝 좌표로 연동)
let fingerX: number = 240;
let fingerY: number = 350;

// Web Audio API 구성
let audioCtx: AudioContext | null = null;
let pannerNode: StereoPannerNode | null = null;
let oscillator: OscillatorNode | null = null;
let beepInterval: any = null;

// DOM Elements
const btnStarbucks = document.getElementById("btn-kiosk-starbucks") as HTMLButtonElement;
const btnMcdonalds = document.getElementById("btn-kiosk-mcdonalds") as HTMLButtonElement;
const kioskStoreName = document.getElementById("kiosk-store-name") as HTMLElement;
const kioskScreenContent = document.getElementById("kiosk-screen-content") as HTMLElement;
const cardSlotMock = document.getElementById("card-slot-mock") as HTMLElement;
const micWaveEffect = document.getElementById("mic-wave-effect") as HTMLElement;
const toggleVoiceOn = document.getElementById("toggle-voice-on") as HTMLInputElement;
const subtitleBox = document.getElementById("subtitle-box") as HTMLElement;
const hapticInstructionText = document.getElementById("haptic-instruction-text") as HTMLElement;
const compassArrowPtr = document.getElementById("compass-arrow-ptr") as HTMLElement;
const compassLabelText = document.getElementById("compass-label-text") as HTMLElement;
const zeroUiTouchpad = document.getElementById("zero-ui-touchpad") as HTMLElement;

const tabLeaderboard = document.getElementById("tab-btn-leaderboard") as HTMLButtonElement;
const tabContribute = document.getElementById("tab-btn-contribute") as HTMLButtonElement;
const paneLeaderboard = document.getElementById("pane-leaderboard") as HTMLElement;
const paneContribute = document.getElementById("pane-contribute") as HTMLElement;
// 다국어 딕셔너리 리소스 (Static Localization - 7개국어 확장)
const locales: any = {
  ko: {
    welcome: "반갑습니다. 소리메뉴입니다. 음성 도움이 필요하십니까? 음성 도움이 필요하시면 화면을 두 번 탭해 주시고, 텍스트 자막 안내만 필요하시면 화면을 길게 눌러주세요.",
    onboardingVoice: "음성 가이드가 활성화되었습니다. 지금 방문하신 음식점이나 매장의 이름을 말씀해 주세요.",
    onboardingText: "자막 가이드 모드가 활성화되었습니다. 키오스크 기기를 정면으로 비춰 주세요.",
    touchpadText: "화면을 더블 탭(Double Tap)하여<br>음성 인식을 켜고 명령을 내리세요",
    navStep1: "1단계. 매장 내 키오스크 탐색을 시작합니다. 휴대폰 후면 카메라를 정면을 향해 들고 천천히 걸어가세요.",
    navStep1Sub: "1단계: 매장 내 키오스크 위치 탐색 중. 폰을 정면으로 들어 비추며 걸어가세요.",
    saveConfirm: "이 언어 선택을 기본값으로 저장할까요? 저장하려면 화면을 더블 탭, 아니면 화면을 길게 눌러 다시 선택해 주세요."
  },
  en: {
    welcome: "Welcome to Echo-Menu. Do you need voice assistance? Double tap for voice guide, or long press for large subtitles.",
    onboardingVoice: "Voice assistance activated. Please say the name of the restaurant you are visiting.",
    onboardingText: "Subtitle guide activated. Please point your camera at the kiosk screen.",
    touchpadText: "Double tap the screen to<br>activate voice input and command",
    navStep1: "Step 1. Starting kiosk search. Please hold your phone forward and walk slowly.",
    navStep1Sub: "Step 1: Finding kiosk... Hold your phone up and face the front.",
    saveConfirm: "Would you like to save this language as default? Double tap to save, or long press to re-select."
  },
  zh: {
    welcome: "欢迎使用声音菜单。您需要语音助手吗？双击屏幕开启语音指南，长按屏幕使用大字幕指南。",
    onboardingVoice: "语音指南已激活。请说出您正在访问的餐厅名称。",
    onboardingText: "字幕指南已激活。请将相机对准自助点餐机屏幕。",
    touchpadText: "双击屏幕<br>激活语音输入和指令",
    navStep1: "步骤 1. 开始搜索自助机。请将手机向前拿并慢走。",
    navStep1Sub: "步骤 1: 寻找自助机中... 拿起手机面向前方。",
    saveConfirm: "是否将此语言保存为默认语言？双击保存，长按重新选择。"
  },
  ja: {
    welcome: "音声メニューへようこそ。音声アシストが必要ですか？音声ガイドが必要な場合はダブルタップ、大文字字幕ガイドは長押ししてください。",
    onboardingVoice: "音声ガイドが有効になりました。訪問中の店舗名を教えてください。",
    onboardingText: "字幕ガイドが有効になりました。カメラをキオスク画面に向けてください。",
    touchpadText: "画面をダブルタップして<br>音声入力とコマンドを有効にします",
    navStep1: "ステップ 1. キオスクの探索を開始します。スマホを前に向けてゆっくり歩いてください。",
    navStep1Sub: "ステップ 1: キオスク探索中... スマ호を前に向けてください。",
    saveConfirm: "この言語をデフォルトとして保存しますか？保存する場合はダブルタップ、再選択する場合は長押ししてください。"
  },
  ru: {
    welcome: "Добро пожаловать в Голосовое меню. Нужна помощь? Дважды коснитесь для аудиогида, зажмите для крупных субтитров.",
    onboardingVoice: "Голосовой гид активирован. Пожалуйста, назовите ресторан, который вы посещаете.",
    onboardingText: "Субтитры активированы. Направьте камеру на экран киоска.",
    touchpadText: "Дважды коснитесь экрана для<br>активации голосового ввода и команд",
    navStep1: "Шаг 1. Поиск киоска. Держите телефон перед собой и идите медленно.",
    navStep1Sub: "Шаг 1: Поиск киоска... Направьте телефон вперед.",
    saveConfirm: "Сохранить этот язык по умолчанию? Дважды коснитесь для сохранения, зажмите для сброса."
  },
  de: {
    welcome: "Willkommen beim Echo-Menu. Benötigen Sie Sprachunterstützung? Doppeltippen für Sprachführung, lange drücken für große Untertitel.",
    onboardingVoice: "Sprachführung aktiviert. Bitte nennen Sie den Namen des Restaurants, das Sie besuchen.",
    onboardingText: "Untertitel aktiviert. Bitte richten Sie die Kamera auf den Kiosk-Bildschirm.",
    touchpadText: "Doppeltippen Sie auf den Bildschirm,<br>um die Spracheingabe zu aktivieren",
    navStep1: "Schritt 1. Kiosk-Suche gestartet. Bitte halten Sie Ihr Telefon nach vorne und gehen Sie langsam.",
    navStep1Sub: "Schritt 1: Kiosk suchen... Halten Sie das Telefon nach vorne.",
    saveConfirm: "Möchten Sie diese Sprache als Standard speichern? Doppeltippen zum Speichern, lange drücken zum Zurücksetzen."
  },
  ar: {
    welcome: "مرحبًا بك في إيكو منيو. هل تحتاج إلى مساعدة صوتية؟ انقر نقرًا مزدوجًا للإرشاد الصوتي، أو اضغط مطولاً للحصول على ترجمة كبيرة.",
    onboardingVoice: "تم تفعيل الإرشاد الصوتي. يرجى ذكر اسم المطعم الذي تزوره.",
    onboardingText: "تم تفعيل الترجمة. يرجى توجيه الكاميرا إلى شاشة الكشك.",
    touchpadText: "انقر نقرًا مزدوجًا على الشاشة<br>لتفعيل الإدخال الصوتي والأوامر",
    navStep1: "الخطوة 1. بدء البحث عن الكشك. يرجى توجيه الهاتف للأمام والمشي ببطء.",
    navStep1Sub: "الخطوة 1: العثور على الكشك... وجه الهاتف للأمام.",
    saveConfirm: "هل ترغب في حفظ هذه اللغة كافتراضية؟ انقر نقرًا مزدوجًا للحفظ، أو اضغط مطولاً لإعادة الاختيار."
  }
};

// 언어 코드 및 순차 낭독 멘트 셋업
const langList: string[] = ["ko", "en", "zh", "ja", "ru", "de", "ar"];
const langSelectorPrompts: any = {
  ko: { text: "한국어로 말할까요? 원하시면 화면을 더블 탭해 주세요.", locale: "ko-KR" },
  en: { text: "Would you like to speak in English? If so, please double tap.", locale: "en-US" },
  zh: { text: "您想用中文交流吗？如果想，请双击屏幕。", locale: "zh-CN" },
  ja: { text: "日本語で話しましょうか？ご希望の場合は、ダブルタップしてください。", locale: "ja-JP" },
  ru: { text: "Хотите говорить по-русски? Если да, дважды коснитесь экрана.", locale: "ru-RU" },
  de: { text: "Möchten Sie auf Deutsch sprechen? Wenn ja, bitte doppeltippen.", locale: "de-DE" },
  ar: { text: "هل ترغب في التحدث باللغة العربية؟ إذا كان الأمر كذلك، يرجى النقر نقرًا مزدوجًا.", locale: "ar-SA" }
};

let userLang: string = "ko";
let t = locales[userLang];
let currentSelectionIndex: number = 0;
let languageLoopTimeout: any = null;
let isSelectingLanguage: boolean = false;
let tempSelectedLang: string = "ko";
let isVoiceTurningOffConfirm: boolean = false; // 음성 기능 해제 확인용 플래그

// --------------------------------------------------
// 1. Accessibility Onboarding & Speech Engine
// --------------------------------------------------

// 브라우저 TTS 발음
function speak(text: string, onEndCallback?: () => void) {
  if (!isVoiceMode && !isVoiceTurningOffConfirm) {
    if (onEndCallback) onEndCallback();
    return;
  }
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  
  // 현재 선택된 언어팩(userLang) 혹은 언어 선택 시의 임시 로케일에 맞춰 음성 매핑
  const currentLocale = isSelectingLanguage 
    ? langSelectorPrompts[tempSelectedLang].locale 
    : (locales[userLang] ? langSelectorPrompts[userLang].locale : "ko-KR");
    
  utterance.lang = currentLocale;
  utterance.rate = 1.0;
  if (onEndCallback) {
    utterance.onend = onEndCallback;
  }
  window.speechSynthesis.speak(utterance);
}

// 최초 진입 시 음성 온보딩 실행
window.addEventListener("DOMContentLoaded", () => {
  loadLeaderboard();
  
  // 브라우저 로컬 저장소 확인
  const savedLang = localStorage.getItem("user_language");
  if (savedLang && locales[savedLang]) {
    // 이미 언어가 영구 저장된 경우: 순차 낭독 생략하고 즉시 해당 다국어로 기동
    userLang = savedLang;
    t = locales[userLang];
    speak(t.welcome);
    updateSubtitle(t.welcome);
  } else {
    // 저장된 언어가 없는 경우: 7개국어 순차 최초 웰컴 가이드 낭독 (외국인 시각장애인 인지 장벽 제거)
    const startNotice = "반갑습니다. 화면을 두 번 탭하여 언어 설정을 시작하세요. " +
                        "Welcome. Double tap to start language selection. " +
                        "欢迎。双击屏幕开始选择语言。 " +
                        "ようこそ。ダブルタップして言語選択を開始します。 " +
                        "Добро пожаловать. Дважды коснитесь для выбора языка. " +
                        "Willkommen. Doppeltippen, um die Sprachauswahl zu starten. " +
                        "مرحبًا. انقر نقرًا مزدوجًا لبدء اختيار اللغة.";
    speak(startNotice);
    updateSubtitle(startNotice);
  }

  // 온보딩 더블탭 및 롱프레스 제스처 바인딩
  zeroUiTouchpad.addEventListener("dblclick", handleTouchpadDoubleTap);

  let pressTimer: number;
  zeroUiTouchpad.addEventListener("mousedown", () => {
    pressTimer = window.setTimeout(handleTouchpadLongPress, 2000);
  });
  zeroUiTouchpad.addEventListener("mouseup", () => clearTimeout(pressTimer));
});

let isPermissionRequested = false;

function initAccessibilityPermissions() {
  if (isPermissionRequested) return;
  isPermissionRequested = true;

  // 1. AudioContext 즉시 활성화 (Autoplay 차단 우회)
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  if (audioCtx && audioCtx.state === "suspended") {
    audioCtx.resume();
  }

  // 2. 카메라/마이크 권한 요청 트리거 및 시각장애인용 음성 안내 코칭
  const permissionNotice = "안내를 시작합니다. 카메라와 마이크 권한 사용을 위해 화면 상단 중앙 부근에 나타난 허용 버튼을 눌러주세요.";
  speak(permissionNotice);
  updateSubtitle("🔒 카메라 및 마이크 권한 요청 중...");

  // 화면 테두리를 황색/녹색 번쩍임으로 점멸하여 가시성 유도
  triggerVisualHapticFlash();

  navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: true })
    .then((stream) => {
      console.log("📹 카메라/마이크 권한 승인 완료");
      speak("권한 승인이 완료되었습니다. 주문 여정을 시작합니다.");
      stream.getTracks().forEach(track => track.stop()); // 자원 해제
    })
    .catch((err) => {
      console.error("❌ 권한 획득 오류:", err);
      speak("카메라 권한 획득 실패. 화면 인식을 위해 설정에서 카메라 권한을 승인해 주셔야 합니다.");
      updateSubtitle("⚠️ 권한 미승인 상태");
    });
}

// 더블탭 액션 핸들러 (상태 머신 분기)
function handleTouchpadDoubleTap() {
  // 최초 더블탭 시 브라우저 오디오 및 비전 하드웨어 권한 획득 온보딩 즉각 트리거
  initAccessibilityPermissions();

  // 0. 음성 기능 끄기 이중 확인 중인 경우 ➔ 더블탭 시 음성 가이드 종료 확정
  if (isVoiceTurningOffConfirm) {
    isVoiceTurningOffConfirm = false;
    isVoiceMode = false;
    toggleVoiceOn.checked = false;
    
    const offMsg = t.turnOffSuccess || locales[userLang].turnOffSuccess;
    updateSubtitle(offMsg);
    speak(offMsg, () => {
      window.speechSynthesis.cancel();
      stopAudioSteering();
    });
    return;
  }

  const savedLang = localStorage.getItem("user_language");
  
  // 1. 아직 언어가 미설정된 대기 상태인 경우 ➔ 순차 언어 낭독 루프 개시
  if (!savedLang && !isSelectingLanguage) {
    isSelectingLanguage = true;
    currentSelectionIndex = 0;
    runLanguageSelectionLoop();
    return;
  }

  // 2. 순차 언어 낭독 중에 탭이 들어온 경우 ➔ 해당 언어 임시 락인 및 "저장할까요?" 컨펌 단계 진입
  if (isSelectingLanguage && !languageLoopTimeout) {
    // 컨펌 단계에서 더블 탭이 들어오면 ➔ 영구 저장 및 주문 0단계 시작
    localStorage.setItem("user_language", tempSelectedLang);
    userLang = tempSelectedLang;
    t = locales[userLang];
    isSelectingLanguage = false;
    
    startVenueIdentificationSequence();
    return;
  }

  if (isSelectingLanguage && languageLoopTimeout) {
    // 낭독 중에 더블 탭이 들어오면 루프 일시 정지하고 컨펌 진행
    clearTimeout(languageLoopTimeout);
    languageLoopTimeout = null;
    
    // 임시 락인 상태에서 컨펌 메시지 재생
    const confirmPrompt = locales[tempSelectedLang].saveConfirm;
    speak(confirmPrompt);
    updateSubtitle(confirmPrompt);
    return;
  }

  // 3. 언어 세팅 완료 후의 일반적인 주문 더블탭 ➔ GPS 기반 주변 매장 추천 및 AI 특정 시퀀스 시작
  if (savedLang) {
    startVenueIdentificationSequence();
  }
}

// 롱프레스 액션 핸들러 (취소 또는 자막모드 전환)
function handleTouchpadLongPress() {
  // 0. 음성 기능 끄기 이중 확인 중인 경우 ➔ 롱프레스 시 끄기 취소 (음성 유지)
  if (isVoiceTurningOffConfirm) {
    isVoiceTurningOffConfirm = false;
    const keepMsg = t.turnOnMsg || locales[userLang].turnOnMsg;
    speak(keepMsg);
    updateSubtitle(keepMsg);
    return;
  }

  // 1. 언어 선택 컨펌 단계에서 롱프레스 ➔ 임시 락인 취소하고 순차 낭독 루프 재개
  if (isSelectingLanguage && !languageLoopTimeout) {
    currentSelectionIndex = (langList.indexOf(tempSelectedLang) + 1) % langList.length;
    speak("Cancelled.", () => {
      runLanguageSelectionLoop();
    });
    return;
  }

  // 2. 그 외 일반 상태 ➔ 자막 전용 모드로 강제 강등
  isVoiceMode = false;
  toggleVoiceOn.checked = false;
  window.speechSynthesis.cancel();
  updateSubtitle(t.onboardingText);
  hapticInstructionText.innerHTML = "자막 모드 작동 중. 화면의 텍스트 안내를 따라 키오스크를 터치하세요.";
  initVenue("starbucks");
}

// 순차 언어 낭독 루프 코어
function runLanguageSelectionLoop() {
  if (!isSelectingLanguage) return;

  const currentLang = langList[currentSelectionIndex];
  tempSelectedLang = currentLang;
  const prompt = langSelectorPrompts[currentLang];

  updateSubtitle(prompt.text);
  
  // 해당 국가의 언어 발음(locale)으로 질문 낭독
  speak(prompt.text, () => {
    // 낭독 완료 후 3.5초간 사용자의 더블탭 입력을 대기함
    languageLoopTimeout = setTimeout(() => {
      if (isSelectingLanguage) {
        // 더블탭이 없었으면 다음 언어로 인덱스 변환하여 루프 재귀 호출
        currentSelectionIndex = (currentSelectionIndex + 1) % langList.length;
        runLanguageSelectionLoop();
      }
    }, 3500);
  });
}

// 음성 ON/OFF 스위치 토글 연동 (시각장애인 실수 방지 확인 락 장착)
toggleVoiceOn.addEventListener("change", (e: any) => {
  if (!e.target.checked) {
    // 억지로 토글을 다시 ON으로 되돌리고 음성으로 끄기 여부 재차 확인
    toggleVoiceOn.checked = true;
    isVoiceTurningOffConfirm = true;
    
    const confirmPrompt = t.turnOffConfirm || locales[userLang].turnOffConfirm;
    speak(confirmPrompt);
    updateSubtitle(confirmPrompt);
  } else {
    // 켤 때는 바로 켜짐
    isVoiceMode = true;
    const activePrompt = t.turnOnMsg || locales[userLang].turnOnMsg;
    speak(activePrompt);
    updateSubtitle(activePrompt);
    startAudioSteering();
  }
});

// 자막 갱신 헬퍼
function updateSubtitle(text: string) {
  subtitleBox.textContent = text;
}

// STT 음성인식 래퍼
function startSpeechRecognition(onResultCallback: (text: string) => void) {
  const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
  if (!SpeechRecognition) {
    updateSubtitle("⚠️ 브라우저가 음성 인식을 지원하지 않습니다.");
    return;
  }
  const recognition = new SpeechRecognition();
  recognition.lang = "ko-KR";
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;

  micWaveEffect.classList.add("listening");
  recognition.start();

  recognition.onresult = (event: any) => {
    const text = event.results[0][0].transcript;
    console.log("🎤 음성인식 인식 결과:", text);
    onResultCallback(text);
  };

  recognition.onspeechend = () => {
    recognition.stop();
    micWaveEffect.classList.remove("listening");
  };

  recognition.onerror = () => {
    micWaveEffect.classList.remove("listening");
    speak("잘 듣지 못했습니다. 화면을 더블 탭하고 다시 말씀해 주세요.");
  };
}

// 주변 매장 자동 GPS 스캔 및 AI 음성 브리핑 개시
function startVenueIdentificationSequence() {
  updateSubtitle("📍 내 주변 매장 스캔 중...");
  
  if ("geolocation" in navigator) {
    navigator.geolocation.getCurrentPosition(async (position) => {
      const lat = position.coords.latitude;
      const lng = position.coords.longitude;
      
      try {
        const response = await fetch("/api/venue-assist", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ gps: { lat, lng } })
        });
        const resData = await response.json();
        
        speak(resData.audioPrompt, () => {
          startSpeechRecognition(handleVenueIdentification);
        });
        updateSubtitle(resData.audioPrompt);
      } catch (err) {
        fallbackVenueIdentificationPrompt();
      }
    }, () => {
      fallbackVenueIdentificationPrompt();
    });
  } else {
    fallbackVenueIdentificationPrompt();
  }
}

function fallbackVenueIdentificationPrompt() {
  const defaultPrompt = "주변 매장 정보를 불러올 수 없습니다. 지금 방문하신 음식점의 이름을 말씀해 주세요.";
  speak(defaultPrompt, () => {
    startSpeechRecognition(handleVenueIdentification);
  });
  updateSubtitle(defaultPrompt);
}

// 온보딩 0단계: 매장명 식별 핸들러
async function handleVenueIdentification(venueName: string) {
  updateSubtitle(`검색한 매장: "${venueName}"`);
  speak(`${venueName} 매장 데이터를 조회하고 있습니다.`);

  // 스마트폰 GPS 획득 시도 (있을 경우 전송)
  let lat = 37.5665;
  let lng = 126.9780;
  if ("geolocation" in navigator) {
    navigator.geolocation.getCurrentPosition((pos) => {
      lat = pos.coords.latitude;
      lng = pos.coords.longitude;
    });
  }

  try {
    const response = await fetch("/api/venue", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: venueName, gps: { lat, lng } })
    });
    const resData = await response.json();

    if (resData.error) {
      speak("등록된 매장을 찾을 수 없습니다. 다시 매장명을 말씀해 주세요.");
      return;
    }

    currentVenueKey = resData.venueKey;
    currentVenueData = resData.data;
    kioskStoreName.textContent = currentVenueData.name;
    
    const confirmedText = `${currentVenueData.name}에 도착하신 것이 맞습니까? 맞으면 더블 탭, 아니면 화면을 길게 눌러 다시 말해주세요.`;
    speak(confirmedText, () => {
      startKioskNavigation();
    });
    updateSubtitle(confirmedText);

  } catch (error) {
    speak("서버 통신 실패. 기본 매장 데이터로 주문을 기동합니다.");
    initVenue("starbucks");
  }
}

// --------------------------------------------------
// 2. Indoor Kiosk Finder (1단계: 매장 내 기기 탐색)
// --------------------------------------------------
function startKioskNavigation() {
  speak("1단계. 매장 내 키오스크 탐색을 시작합니다. 휴대폰 후면 카메라를 정면을 향해 들고 천천히 걸어가세요.", () => {
    startAudioSteering();
    if (streamInterval) clearInterval(streamInterval);
    streamInterval = setInterval(sendVideoFrameToServer, 1000);
  });
  updateSubtitle("1단계: 매장 내 키오스크 위치 탐색 중. 폰을 정면으로 들어 비추며 걸어가세요.");
}

// --------------------------------------------------
// 3. Binaural Audio & Haptic Steering Engine (3D 입체 조향)
// --------------------------------------------------
function startAudioSteering() {
  if (!isVoiceMode) return;
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    pannerNode = audioCtx.createStereoPanner();
    pannerNode.pan.value = 0;
    pannerNode.connect(audioCtx.destination);
  }

  if (beepInterval) clearInterval(beepInterval);
  beepInterval = setInterval(() => {
    if (!audioCtx || isFreezed || !pannerNode) return;
    
    oscillator = audioCtx.createOscillator();
    oscillator.type = "sine";
    
    if (compassLabelText.textContent && compassLabelText.textContent.includes("위로")) {
      oscillator.frequency.setValueAtTime(800, audioCtx.currentTime);
    } else if (compassLabelText.textContent && compassLabelText.textContent.includes("아래로")) {
      oscillator.frequency.setValueAtTime(250, audioCtx.currentTime);
    } else {
      oscillator.frequency.setValueAtTime(440, audioCtx.currentTime);
    }

    oscillator.connect(pannerNode);
    oscillator.start();
    oscillator.stop(audioCtx.currentTime + 0.1);
  }, 800);
}

function stopAudioSteering() {
  if (beepInterval) clearInterval(beepInterval);
  if (oscillator) {
    try { oscillator.stop(); } catch(e) {}
  }
}

// 실시간 조향 업데이트
function updateSteering(direction: string, _distanceText: string) {
  if (!pannerNode || !isVoiceMode) return;

  if (direction === "left") {
    pannerNode.pan.value = -1.0;
    compassArrowPtr.style.transform = "rotate(180deg)";
    compassLabelText.textContent = "왼쪽으로 이동";
    hapticSteer("left");
  } else if (direction === "right") {
    pannerNode.pan.value = 1.0;
    compassArrowPtr.style.transform = "rotate(0deg)";
    compassLabelText.textContent = "오른쪽으로 이동";
    hapticSteer("right");
  } else if (direction === "up") {
    pannerNode.pan.value = 0;
    compassArrowPtr.style.transform = "rotate(270deg)";
    compassLabelText.textContent = "위로 이동";
    hapticSteer("up");
  } else if (direction === "down") {
    pannerNode.pan.value = 0;
    compassArrowPtr.style.transform = "rotate(90deg)";
    compassLabelText.textContent = "아래로 이동";
    hapticSteer("down");
  } else if (direction === "center") {
    pannerNode.pan.value = 0;
    compassArrowPtr.style.transform = "scale(1.2)";
    compassLabelText.textContent = "조준 적중 (Lock)";
    hapticSteer("center");
  }
}

// Vibration API 방향별 리듬 패턴 & iOS용 비주얼 햅틱 펄스 연동
function hapticSteer(pattern: string) {
  // iOS/Safari 등 진동 미지원 기기를 위한 비주얼 햅틱 테두리 펄싱 효과 트리거
  triggerVisualHapticFlash(pattern);

  if (!("vibrate" in navigator)) return;

  if (pattern === "right") {
    // 오른쪽: 길게 한 번
    navigator.vibrate(400);
  } else if (pattern === "left") {
    // 왼쪽: 길게 두 번
    navigator.vibrate([400, 150, 400]);
  } else if (pattern === "up") {
    // 위: 짧게 한 번
    navigator.vibrate(100);
  } else if (pattern === "down") {
    // 아래: 짧게 두 번
    navigator.vibrate([100, 100, 100]);
  } else if (pattern === "center") {
    // 조준 성공 햅틱 락 (1초 연속)
    navigator.vibrate(1000);
  }
}

// iOS 진동 미지원 대응용 비주얼 햅틱 플래시 헬퍼
function triggerVisualHapticFlash(pattern: string) {
  zeroUiTouchpad.className = "zero-ui-touchpad"; // 클래스 리셋 (기존 스타일 유지)
  
  // 리팩토링된 햅틱 클래스 매핑
  const flashClass = `haptic-pulse-${pattern}`;
  zeroUiTouchpad.classList.add(flashClass);
  
  // 펄스 애니메이션이 끝난 후 원복
  const delay = pattern === "center" ? 1000 : (pattern === "left" || pattern === "right" ? 500 : 200);
  setTimeout(() => {
    zeroUiTouchpad.classList.remove(flashClass);
  }, delay);
}

// --------------------------------------------------
// 4. Kiosk Simulator Logic (좌측 에뮬레이터 렌더링)
// --------------------------------------------------
function initVenue(key: string) {
  currentVenueKey = key;
  fetch("/api/venue", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: key === "starbucks" ? "스타벅스" : "맥도날드" })
  })
  .then(res => res.json())
  .then(resData => {
    currentVenueData = resData.data;
    kioskStoreName.textContent = currentVenueData.name;
    renderKioskScreen();
  });
}

btnStarbucks.addEventListener("click", () => {
  btnStarbucks.classList.add("active");
  btnMcdonalds.classList.remove("active");
  initVenue("starbucks");
});
btnMcdonalds.addEventListener("click", () => {
  btnMcdonalds.classList.add("active");
  btnStarbucks.classList.remove("active");
  initVenue("mcdonalds");
});

document.addEventListener("click", (e: any) => {
  if (e.target && e.target.id === "kiosk-start-btn") {
    kioskArrivalOnboarding();
  }
});

function kioskArrivalOnboarding() {
  currentKioskState = "menu";
  renderKioskScreen();

  const arrivalText = "키오스크 앞에 도착했습니다. 바로 주문하시겠습니까, 아니면 메뉴판 전체를 스캔하여 찬찬히 고민해 보시겠습니까? 바로 주문은 1번, 찬찬히 고민은 2번이라고 말해 주세요.";
  speak(arrivalText, () => {
    startSpeechRecognition((text) => {
      if (text.includes("1") || text.includes("바로") || text.includes("주문")) {
        speak("바로 주문 모드입니다. 추천 메뉴에서 원하는 상품을 말씀하세요.");
      } else if (text.includes("2") || text.includes("찬찬히") || text.includes("고민")) {
        triggerSitDownExploration();
      }
    });
  });
  updateSubtitle(arrivalText);
}

function triggerSitDownExploration() {
  isFreezed = true;
  stopAudioSteering();

  const sitDownText = "메뉴판 동기화가 완료되었습니다. 대기 줄의 눈치를 피할 수 있도록 테이블(제자리)로 편안하게 복귀하여 탐색해 주십시오. 화면을 더블 탭하고 버거 메뉴를 보여달라고 요구하세요.";
  speak(sitDownText);
  updateSubtitle(sitDownText);

  zeroUiTouchpad.addEventListener("dblclick", handleVirtualExplorationQuery);
}

function handleVirtualExplorationQuery() {
  if (!isFreezed) return;
  speak("전체 메뉴 탐색 모드입니다. 궁금한 품목을 말씀하세요.", () => {
    startSpeechRecognition((query) => {
      const matches = currentVenueData.menu.filter((item: any) => query.includes(item.name) || item.name.includes(query));
      if (matches.length > 0) {
        const item = matches[0];
        speak(`${item.name}의 가격은 ${item.price}원이며, 설명은 다음과 같습니다. ${item.description}. 장바구니에 담으시려면 '담아줘'라고 말해 주세요.`, () => {
          startSpeechRecognition((confirmText) => {
            if (confirmText.includes("담") || confirmText.includes("응") || confirmText.includes("예")) {
              addToCart(item);
              speak(`${item.name}을 장바구니에 임시 담았습니다. 결제를 완료하기 위해 다시 키오스크 기기 앞으로 복귀해 주세요.`, () => {
                isFreezed = false;
                startAudioSteering();
                currentKioskState = "cart_confirm";
                renderKioskScreen();
              });
            }
          });
        });
      } else {
        speak("해당 메뉴를 찾지 못했습니다. 스타벅스 추천 메뉴인 아이스 아메리카노나 자몽 허니 블랙티 등이 준비되어 있습니다.");
      }
    });
  });
}

function addToCart(item: any) {
  currentCart.push(item);
  targetMenuItem = item;
}

function renderKioskScreen() {
  if (!currentVenueData) return;
  const container = kioskScreenContent;
  container.innerHTML = "";

  if (currentKioskState === "start") {
    container.innerHTML = `
      <div class="kiosk-step" id="kiosk-step-start">
        <div class="kiosk-start-hero">
          <div class="start-logo">🟢</div>
          <h2>반갑습니다. ${currentVenueData.name}입니다.</h2>
          <p>주문을 시작하려면 화면 하단의 버튼을 눌러주세요.</p>
          <button class="kiosk-big-action-btn" id="kiosk-start-btn">주문하기 (Start Order)</button>
        </div>
      </div>`;
    cardSlotMock.querySelector(".slot-light")?.classList.remove("pulsing");
  } 
  
  else if (currentKioskState === "menu") {
    let navHTML = `<div class="kiosk-nav-tabs">`;
    currentVenueData.categories.forEach((cat: string) => {
      const activeClass = cat === selectedCategory ? "active" : "";
      navHTML += `<button class="${activeClass}" onclick="changeCategory('${cat}')">${cat}</button>`;
    });
    navHTML += `</div>`;

    let gridHTML = `<div class="kiosk-menu-grid">`;
    const filteredMenu = currentVenueData.menu.filter((item: any) => item.category === selectedCategory);
    filteredMenu.forEach((item: any) => {
      const isTarget = targetMenuItem && targetMenuItem.id === item.id ? "selected-highlight" : "";
      gridHTML += `
        <div class="kiosk-menu-card ${isTarget}" onclick="selectMenuItem('${item.id}')">
          <div class="card-title">${item.name}</div>
          <div class="card-price">${item.price}원</div>
        </div>`;
    });
    gridHTML += `</div>`;

    const totalAmount = currentCart.reduce((sum, i) => sum + i.price, 0);
    const cartHTML = `
      <div class="kiosk-cart-summary">
        <div class="cart-info">
          <span class="cart-count">담긴 상품: ${currentCart.length}개</span>
          <span class="cart-total">합계: ${totalAmount}원</span>
        </div>
        <button class="kiosk-cart-checkout-btn" onclick="checkoutCart()">🛒 결제하기</button>
      </div>`;

    container.innerHTML = `<div class="kiosk-menu-container">${navHTML}${gridHTML}${cartHTML}</div>`;
  }

  else if (currentKioskState === "popup") {
    const item = targetMenuItem;
    if (!item) return;
    container.innerHTML = `
      <div class="kiosk-popup-overlay">
        <div class="kiosk-popup">
          <h3>${item.name} 옵션 선택</h3>
          <div class="option-group">
            <div class="option-title">선택형 상세 옵션</div>
            <div class="option-choices">
              <button class="option-btn active">${item.options[0] || '기본설정'}</button>
              <button class="option-btn">${item.options[1] || '추가옵션'}</button>
            </div>
          </div>
          <div class="popup-actions">
            <button class="popup-cancel-btn" onclick="cancelPopup()">취소</button>
            <button class="popup-confirm-btn" onclick="confirmPopup()">장바구니 담기</button>
          </div>
        </div>
      </div>`;
  }

  else if (currentKioskState === "cart_confirm") {
    const totalAmount = currentCart.reduce((sum, i) => sum + i.price, 0);
    container.innerHTML = `
      <div class="kiosk-step" style="text-align:center; display:flex; flex-direction:column; gap:20px;">
        <h2 style="font-weight:800; color:#1e293b;">🛒 장바구니 내용 확인</h2>
        <div style="background:white; border:1px solid #cbd5e1; border-radius:12px; padding:20px;">
          ${currentCart.map(i => `<div style="display:flex; justify-content:space-between; margin-bottom:10px; font-weight:700;"><span>${i.name}</span><span>${i.price}원</span></div>`).join("")}
          <div style="border-top:2px solid #cbd5e1; padding-top:10px; margin-top:10px; display:flex; justify-content:space-between; font-weight:800; font-size:1.1rem; color:#dc2626;">
            <span>총 결제금액</span><span>${totalAmount}원</span>
          </div>
        </div>
        <button class="kiosk-big-action-btn" onclick="checkoutCart()">신용카드 결제하기 (Checkout)</button>
      </div>`;
  }

  else if (currentKioskState === "pay_select") {
    container.innerHTML = `
      <div class="kiosk-step kiosk-payment-screen">
        <h2 style="font-weight:800; color:#1e293b;">💳 결제 수단 선택</h2>
        <div class="payment-methods-grid">
          <div class="payment-card-btn active-highlight" onclick="insertCardMock()">
            <span style="font-size:2.5rem;">💳</span>
            <span>신용카드 결제</span>
          </div>
          <div class="payment-card-btn">
            <span style="font-size:2.5rem;">📱</span>
            <span>모바일 바코드 페이</span>
          </div>
        </div>
        <p style="color:#64748b; font-size:0.85rem; font-weight:700;">실물 카드를 아래 슬롯에 꽂아 주세요.</p>
      </div>`;
    cardSlotMock.querySelector(".slot-light")?.classList.add("pulsing");
  }

  else if (currentKioskState === "done") {
    container.innerHTML = `
      <div class="kiosk-step" style="text-align:center;">
        <span style="font-size:4rem; display:block; margin-bottom:20px; animation:bounce 1s infinite alternate;">🎉</span>
        <h2 style="font-weight:800; color:var(--kiosk-primary);">주문 및 결제 완료</h2>
        <p style="color:#64748b; margin-top:10px; font-weight:700;">성공적으로 주문이 접수되었습니다.<br>영수증과 번호표를 챙겨 주세요.</p>
        <button class="kiosk-big-action-btn" style="margin-top:30px; background-color:#64748b;" onclick="resetKiosk()">첫 화면으로</button>
      </div>`;
    cardSlotMock.querySelector(".slot-light")?.classList.remove("pulsing");
  }
}

// 글로벌 리액션 바인딩을 위한 전역 함수 맵핑 (TS window 객체 호환)
window.changeCategory = function(cat: string) {
  selectedCategory = cat;
  renderKioskScreen();
};

window.selectMenuItem = function(id: string) {
  const item = currentVenueData.menu.find((i: any) => i.id === id);
  if (item) {
    targetMenuItem = item;
    currentKioskState = "popup";
    renderKioskScreen();
    speak(`${item.name} 옵션 팝업이 로드되었습니다.`);
  }
};

window.cancelPopup = function() {
  currentKioskState = "menu";
  renderKioskScreen();
};

window.confirmPopup = function() {
  if (targetMenuItem) {
    addToCart(targetMenuItem);
    currentKioskState = "menu";
    renderKioskScreen();
    speak(`${targetMenuItem.name}을 장바구니에 추가했습니다.`);
  }
};

window.checkoutCart = function() {
  currentKioskState = "pay_select";
  renderKioskScreen();
  speak("결제 수단 선택 화면입니다. 신용카드를 카드 투입구에 삽입해 주세요.");
};

window.insertCardMock = function() {
  currentKioskState = "done";
  renderKioskScreen();
  speak("결제가 완료되었습니다. 주문 번호표를 확인해 주십시오. 이용해 주셔서 감사합니다.");
};

window.resetKiosk = function() {
  currentKioskState = "start";
  currentCart = [];
  targetMenuItem = null;
  isFreezed = false;
  renderKioskScreen();
};

// --------------------------------------------------
// 5. Real-Time Video Frame Capture & Gemini Loop
// --------------------------------------------------

function generateKioskMockFrame(): string {
  const canvas = document.createElement("canvas");
  canvas.width = 480;
  canvas.height = 700;
  const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;

  ctx.fillStyle = "#f8fafc";
  ctx.fillRect(0, 0, 480, 700);

  ctx.fillStyle = "#006241"; 
  ctx.fillRect(0, 0, 480, 50);
  ctx.fillStyle = "white";
  ctx.font = "bold 16px sans-serif";
  ctx.fillText(currentVenueData ? currentVenueData.name : "스타벅스", 20, 30);

  if (currentKioskState === "start") {
    ctx.fillStyle = "#006241";
    ctx.fillRect(140, 550, 200, 60);
  } 
  
  else if (currentKioskState === "menu") {
    ctx.fillStyle = "#cbd5e1";
    ctx.fillRect(0, 50, 480, 50);

    if (currentVenueData) {
      currentVenueData.menu.filter((i: any) => i.category === selectedCategory).forEach((item: any) => {
        const bounds = item.button_bounds;
        ctx.fillStyle = "white";
        ctx.strokeStyle = "#cbd5e1";
        ctx.lineWidth = 2;
        ctx.fillRect(bounds[1], bounds[0], bounds[3] - bounds[1], bounds[2] - bounds[0]);
        ctx.strokeRect(bounds[1], bounds[0], bounds[3] - bounds[1], bounds[2] - bounds[0]);

        ctx.fillStyle = "#0f172a";
        ctx.font = "bold 14px sans-serif";
        ctx.fillText(item.name, bounds[1] + 15, bounds[0] + 40);
        ctx.fillText(`${item.price}원`, bounds[1] + 15, bounds[0] + 80);
      });
    }
  } 
  
  else if (currentKioskState === "pay_select") {
    ctx.strokeStyle = "#000";
    ctx.lineWidth = 3;
    ctx.strokeRect(40, 200, 180, 150);
    ctx.strokeRect(260, 200, 180, 150);
  }

  ctx.fillStyle = "rgba(239, 68, 68, 0.6)";
  ctx.beginPath();
  ctx.arc(fingerX, fingerY, 20, 0, Math.PI * 2);
  ctx.fill();

  return canvas.toDataURL("image/jpeg");
}

// 마우스 무브 연동 (PC 테스팅용 백업)
zeroUiTouchpad.addEventListener("mousemove", (e: MouseEvent) => {
  const rect = zeroUiTouchpad.getBoundingClientRect();
  fingerX = Math.floor(((e.clientX - rect.left) / rect.width) * 480);
  fingerY = Math.floor(((e.clientY - rect.top) / rect.height) * 700);
});

// 모바일 멀티터치 제스처 분기 바인딩 (1지: 조향/선택 vs 2지: 화면 정보 낭독 탐색 vs 3지: 뒤로가기)
zeroUiTouchpad.addEventListener("touchstart", handleTouchpadGesture, { passive: false });
zeroUiTouchpad.addEventListener("touchmove", handleTouchpadGesture, { passive: false });
zeroUiTouchpad.addEventListener("touchend", (e: TouchEvent) => {
  // 터치가 완전히 끝나면 비프음 정지
  stopAudioSteering();
});

let lastSpokenTime = 0;
let lastBackNavTime = 0;

function handleTouchpadGesture(e: TouchEvent) {
  e.preventDefault(); // 스크롤 등 브라우저 기본 인터랙션 방지
  const rect = zeroUiTouchpad.getBoundingClientRect();
  const now = Date.now();
  
  if (e.touches.length >= 5) {
    // --------------------------------------------------
    // 0. 주먹 터치 (5개 손가락 이상 넓은 접촉) ➔ "잠시 대기/일시정지 (Pause/Wait Mode)"
    // --------------------------------------------------
    stopAudioSteering(); // 조향 비프음 즉시 차단
    isFreezed = true;   // 분석 영상 프레임 전송 일시 중지
    
    speak("안내를 일시 정지하고 대기 모드로 전환합니다. 다시 시작하려면 화면을 더블 탭해 주세요.");
    updateSubtitle("대기 모드 (일시 정지됨)");
  }
  
  else if (e.touches.length === 3) {
    // --------------------------------------------------
    // 1. 3손가락 터치 (엄지, 검지, 중지) ➔ "뒤로가기 (Back Navigation)"
    // --------------------------------------------------
    stopAudioSteering(); // 조향음 차단
    
    if (now - lastBackNavTime > 2000) { // 2초 디바운스
      lastBackNavTime = now;
      
      if (currentKioskState === "menu" || currentKioskState === "cart") {
        speak("이전 화면으로 돌아갑니다.");
        updateSubtitle("이전 화면으로 이동합니다.");
        currentKioskState = "welcome";
        renderKioskScreen();
      } else if (currentKioskState === "payment") {
        speak("이전 화면으로 돌아갑니다.");
        updateSubtitle("이전 화면으로 이동합니다.");
        currentKioskState = "menu";
        renderKioskScreen();
      } else {
        speak("첫 화면입니다. 뒤로 갈 수 없습니다.");
        updateSubtitle("첫 화면입니다.");
      }
    }
  } 
  
  else if (e.touches.length === 2) {
    // --------------------------------------------------
    // 2. 손가락 2개 터치 ➔ "화면 정보 낭독 탐색 (Explore)"
    // --------------------------------------------------
    stopAudioSteering(); // 조향용 3D 비프음을 차단하여 낭독에 집중시킴
    
    // 두 손가락의 중심 좌표 계산
    const t1 = e.touches[0];
    const t2 = e.touches[1];
    const avgClientX = (t1.clientX + t2.clientX) / 2;
    const avgClientY = (t1.clientY + t2.clientY) / 2;
    
    fingerX = Math.floor(((avgClientX - rect.left) / rect.width) * 480);
    fingerY = Math.floor(((avgClientY - rect.top) / rect.height) * 700);

    // 2지 드래그 시, 1.5초 간격으로 현재 손끝 아래 겹치는 메뉴 정보를 TTS로 실시간 브리핑
    if (now - lastSpokenTime > 1500) {
      lastSpokenTime = now;
      
      if (currentVenueData && currentVenueData.menu) {
        const hoveredItem = currentVenueData.menu.find((item: any) => {
          const bounds = item.button_bounds;
          if (bounds) {
            return (fingerY >= bounds[0] && fingerY <= bounds[2] && fingerX >= bounds[1] && fingerX <= bounds[3]);
          }
          return false;
        });

        if (hoveredItem) {
          const exploreText = `탐색 중: ${hoveredItem.name}, 가격은 ${hoveredItem.price}원입니다.`;
          speak(exploreText);
          updateSubtitle(exploreText);
        } else {
          updateSubtitle("탐색 중: 빈 공간 또는 외곽 영역");
        }
      }
    }
  } 
  
  else if (e.touches.length === 1) {
    // --------------------------------------------------
    // 3. 손가락 1개 터치 ➔ "선택 모드 & 조향 유도 (Aim-Assist / Select)"
    // --------------------------------------------------
    if (isVoiceMode) {
      startAudioSteering(); // 원하는 버튼을 찾도록 비프 조향음을 다시 개시!
    }
    
    const t = e.touches[0];
    fingerX = Math.floor(((t.clientX - rect.left) / rect.width) * 480);
    fingerY = Math.floor(((t.clientY - rect.top) / rect.height) * 700);

    // 조준이 완료된 락인 타겟이 있을 시, 1초 이상 유지되면 자동 탭 장바구니 적재
    if (currentVenueData && currentVenueData.menu) {
      const selectedItem = currentVenueData.menu.find((item: any) => {
        const bounds = item.button_bounds;
        if (bounds) {
          return (fingerY >= bounds[0] && fingerY <= bounds[2] && fingerX >= bounds[1] && fingerX <= bounds[3]);
        }
        return false;
      });

      // 만약 손끝이 정확히 타겟 중심점 근방(조준 완료 영역)에 안착해 있다면 최종 락
      if (selectedItem && targetMenuItem && selectedItem.name === targetMenuItem.name) {
        const distance = Math.hypot(fingerX - (selectedItem.button_bounds[1] + selectedItem.button_bounds[3])/2, fingerY - (selectedItem.button_bounds[0] + selectedItem.button_bounds[2])/2);
        
        if (distance < 15) { // 락인 범위 감지 시 탭 처리
          stopAudioSteering();
          const selectText = `${selectedItem.name}을 장바구니에 담기 위해 최종 선택하셨습니다.`;
          speak(selectText);
          updateSubtitle(selectText);
          
          setTimeout(() => {
            addToCart(selectedItem);
            currentKioskState = "menu";
            renderKioskScreen();
          }, 1000);
        }
      }
    }
  }
}

async function sendVideoFrameToServer() {
  if (isFreezed) return;

  const base64Image = generateKioskMockFrame();
  const payload = {
    image: base64Image,
    targetMenu: targetMenuItem ? targetMenuItem.name : "",
    targetState: currentKioskState,
    venueKey: currentVenueKey
  };

  try {
    const response = await fetch("/api/analyze-frame", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const result = await response.json();

    if (result.error) return;

    updateSubtitle(result.context_message);
    updateSteering(result.steer_direction, result.distance_info);

    if (result.target_hit) {
      handleAutoTriggerAction();
    }

  } catch (err) {
    console.error("Frame send error:", err);
  }
}

function handleAutoTriggerAction() {
  if (currentKioskState === "start") {
    kioskArrivalOnboarding();
  } else if (currentKioskState === "menu" && targetMenuItem) {
    currentKioskState = "popup";
    renderKioskScreen();
  } else if (currentKioskState === "pay_select") {
    insertCardMock();
  }
}

// --------------------------------------------------
// 6. Contributor Dashboard & Leaderboard (게이미피케이션)
// --------------------------------------------------
function loadLeaderboard() {
  fetch("/api/leaderboard")
    .then(res => res.json())
    .then(list => {
      leaderboardTbody.innerHTML = "";
      list.forEach((item: any) => {
        let dinoIcon = "🥚";
        if (item.points > 1200) dinoIcon = "👑🦖";
        else if (item.points > 800) dinoIcon = "🦅";
        else if (item.points > 400) dinoIcon = "🦖";
        else if (item.points > 100) dinoIcon = "🦕";

        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td><strong>${item.rank}위</strong></td>
          <td>${dinoIcon} ${item.username}</td>
          <td><span style="color:var(--accent-green); font-weight:700;">${item.points} pt</span></td>
          <td>${item.views} 회</td>
          <td>${item.updates} 회</td>
        `;
        leaderboardTbody.appendChild(tr);
      });
    });
}

const btnSubmitContribution = document.getElementById("btn-submit-contribution") as HTMLButtonElement;
const contribUsername = document.getElementById("contrib-username") as HTMLInputElement;
const contribVenue = document.getElementById("contrib-venue") as HTMLInputElement;
const contribStatusMsg = document.getElementById("contrib-status-msg") as HTMLElement;

btnSubmitContribution.addEventListener("click", () => {
  const username = contribUsername.value.trim();
  const venueName = contribVenue.value.trim();

  if (!username || !venueName) {
    contribStatusMsg.textContent = "⚠️ 닉네임과 매장명을 입력하세요.";
    return;
  }

  fetch("/api/contribute", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, venueName })
  })
  .then(res => res.json())
  .then(resData => {
    contribStatusMsg.textContent = `🎉 기여 성공! ${resData.data.points}pt 누적됨.`;
    contribUsername.value = "";
    contribVenue.value = "";
    loadLeaderboard();
    setTimeout(() => { contribStatusMsg.textContent = ""; }, 3000);
  });
});

tabLeaderboard.addEventListener("click", () => {
  tabLeaderboard.classList.add("active");
  tabContribute.classList.remove("active");
  paneLeaderboard.classList.add("active");
  paneContribute.classList.remove("active");
});
tabContribute.addEventListener("click", () => {
  tabContribute.classList.add("active");
  tabLeaderboard.classList.remove("active");
  paneContribute.classList.add("active");
  paneLeaderboard.classList.remove("active");
});

// --------------------------------------------------
// 7. Google Maps & Geolocation API 기여 연동
// --------------------------------------------------
const btnGpsRefresh = document.getElementById("btn-gps-refresh") as HTMLButtonElement;
const contribGpsVenues = document.getElementById("contrib-gps-venues") as HTMLSelectElement;
const contribMapCanvas = document.getElementById("contrib-map-canvas") as HTMLElement;

btnGpsRefresh.addEventListener("click", () => {
  if (!("geolocation" in navigator)) {
    alert("GPS를 지원하지 않는 브라우저입니다.");
    return;
  }

  btnGpsRefresh.textContent = "📍 검색 중...";
  navigator.geolocation.getCurrentPosition((position) => {
    const lat = position.coords.latitude;
    const lng = position.coords.longitude;
    
    console.log(`📍 현재 위치 감지: ${lat}, ${lng}`);
    
    // 구글 Places API 연동 흉내내기 (내 위치 주변의 등록된 매장 목록 추천 빌드)
    const mockNearbyPlaces = [
      { name: "스타벅스 신라호텔점", address: "서울특별시 중구 동호로 249", placeId: "chIJs234" },
      { name: "맥도날드 홍대점", address: "서울특별시 마포구 양화로 160", placeId: "chIJmc45" },
      { name: "스타벅스 홍대역점", address: "서울특별시 마포구 양화로 165", placeId: "chIJsb99" },
      { name: "스타벅스 신촌역점", address: "서울특별시 서대문구 신촌로 110", placeId: "chIJsb88" }
    ];

    // 드롭다운 채우기
    contribGpsVenues.innerHTML = '<option value="">🗺️ [추천] 내 위치 주변 매장 선택...</option>';
    mockNearbyPlaces.forEach(place => {
      const opt = document.createElement("option");
      opt.value = place.name;
      opt.setAttribute("data-address", place.address);
      opt.setAttribute("data-place-id", place.placeId);
      opt.textContent = `${place.name} (${place.address.substring(6, 15)}...)`;
      contribGpsVenues.appendChild(opt);
    });

    btnGpsRefresh.textContent = "📍 완료";
    contribStatusMsg.textContent = "🗺️ 내 주변 매장 추천 완료!";
    setTimeout(() => { contribStatusMsg.textContent = ""; }, 2000);
  }, () => {
    btnGpsRefresh.textContent = "📍 실패";
    alert("위치 정보를 가져올 수 없습니다. 권한을 확인하세요.");
  });
});

contribGpsVenues.addEventListener("change", (e: any) => {
  const selectedName = e.target.value;
  if (!selectedName) {
    contribMapCanvas.style.display = "none";
    return;
  }

  contribVenue.value = selectedName;
  contribMapCanvas.style.display = "block";
  renderMiniGoogleMap(selectedName);
});

// --------------------------------------------------
// Google Maps Autocomplete 장소 찾기 검색 연동
// --------------------------------------------------
const contribSearchResults = document.getElementById("contrib-search-results") as HTMLElement;

contribVenue.addEventListener("input", (e: any) => {
  const query = e.target.value.trim();
  if (query.length < 2) {
    contribSearchResults.style.display = "none";
    return;
  }

  // 구글 맵 Autocomplete API 결과 데이터 모사 (검색 쿼리 매칭)
  const mockDb = [
    { name: "스타벅스 강남대로점", address: "서울특별시 강남구 강남대로 390" },
    { name: "스타벅스 강남삼성타운점", address: "서울특별시 강남구 서초대로78길 24" },
    { name: "스타벅스 강남역점", address: "서울특별시 강남구 테헤란로 105" },
    { name: "맥도날드 강남점", address: "서울특별시 강남구 테헤란로 111" },
    { name: "맥도날드 신촌점", address: "서울특별시 서대문구 신촌로 99" }
  ];

  const matched = mockDb.filter(place => place.name.includes(query) || place.address.includes(query));
  
  if (matched.length === 0) {
    contribSearchResults.style.display = "none";
    return;
  }

  contribSearchResults.innerHTML = "";
  contribSearchResults.style.display = "block";

  matched.forEach(place => {
    const div = document.createElement("div");
    div.style.padding = "8px 12px";
    div.style.cursor = "pointer";
    div.style.borderBottom = "1px solid var(--border-color)";
    div.style.fontSize = "0.75rem";
    div.innerHTML = `<strong>${place.name}</strong><br><span style="color:var(--text-secondary);">${place.address}</span>`;
    
    div.addEventListener("click", () => {
      contribVenue.value = place.name;
      contribSearchResults.style.display = "none";
      contribMapCanvas.style.display = "block";
      renderMiniGoogleMap(place.name);
    });
    
    contribSearchResults.appendChild(div);
  });
});

// 클릭 시 Autocomplete 창 닫기 바인딩
document.addEventListener("click", (e: any) => {
  if (e.target !== contribVenue && e.target !== contribSearchResults) {
    contribSearchResults.style.display = "none";
  }
});

function renderMiniGoogleMap(venueName: string) {
  contribMapCanvas.innerHTML = "";
  
  // 가상 지도 핀 드로잉 Canvas 생성
  const mapCanvas = document.createElement("canvas");
  mapCanvas.width = 400;
  mapCanvas.height = 80;
  const ctx = mapCanvas.getContext("2d") as CanvasRenderingContext2D;

  // 지도 배경 그리드 그리기
  ctx.fillStyle = "#e2e8f0";
  ctx.fillRect(0, 0, 400, 80);
  
  ctx.strokeStyle = "#cbd5e1";
  ctx.lineWidth = 1;
  for (let i = 0; i < 400; i += 20) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, 80);
    ctx.stroke();
  }
  for (let j = 0; j < 80; j += 20) {
    ctx.beginPath();
    ctx.moveTo(0, j);
    ctx.lineTo(400, j);
    ctx.stroke();
  }

  // 붉은색 구글 핀 마커 그리기
  ctx.fillStyle = "#ef4444";
  ctx.beginPath();
  ctx.arc(200, 30, 8, 0, Math.PI * 2);
  ctx.fill();
  
  ctx.beginPath();
  ctx.moveTo(192, 30);
  ctx.lineTo(200, 48);
  ctx.lineTo(208, 30);
  ctx.fill();

  // 매장 텍스트 라벨 렌더링
  ctx.fillStyle = "#0f172a";
  ctx.font = "bold 11px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(`📍 ${venueName}`, 200, 68);

  contribMapCanvas.appendChild(mapCanvas);
}

initVenue("starbucks");
