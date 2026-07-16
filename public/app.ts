// ==========================================
// Echo-Menu 3.0: Frontend Core Script (TypeScript)
// ==========================================

export {};

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
let isPauseMode: boolean = false;
let streamInterval: any = null;
let cameraStream: MediaStream | null = null;

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
const cameraFeed = document.getElementById("camera-feed") as HTMLVideoElement;
const micActivationBtn = document.getElementById("mic-activation-btn") as HTMLButtonElement;
const flowKicker = document.getElementById("flow-kicker") as HTMLElement;
const flowTitle = document.getElementById("flow-title") as HTMLElement;
const flowDescription = document.getElementById("flow-description") as HTMLElement;
const flowPrimaryAction = document.getElementById("flow-primary-action") as HTMLButtonElement;
const repeatGuidanceBtn = document.getElementById("repeat-guidance") as HTMLButtonElement;
const currentLanguageLabel = document.getElementById("current-language-label") as HTMLElement;
const languageStatus = document.getElementById("language-status") as HTMLElement;
const venueFallbackForm = document.getElementById("venue-fallback-form") as HTMLFormElement;
const manualVenueName = document.getElementById("manual-venue-name") as HTMLInputElement;
const navAssist = document.getElementById("nav-assist") as HTMLButtonElement;
const navContribute = document.getElementById("nav-contribute") as HTMLButtonElement;
const assistView = document.getElementById("assist-view") as HTMLElement;
const contributeView = document.getElementById("contribute-view") as HTMLElement;
const permissionChoiceSurface = document.getElementById("permission-choice-surface") as HTMLElement;

const tabLeaderboard = document.getElementById("tab-btn-leaderboard") as HTMLButtonElement;
const tabContribute = document.getElementById("tab-btn-contribute") as HTMLButtonElement;
const paneLeaderboard = document.getElementById("pane-leaderboard") as HTMLElement;
const paneContribute = document.getElementById("pane-contribute") as HTMLElement;
const leaderboardTbody = document.getElementById("leaderboard-tbody") as HTMLTableSectionElement;

type JourneyStep = "language" | "permission" | "venue" | "menu" | "payment";

const journeyOrder: JourneyStep[] = ["language", "permission", "venue", "menu", "payment"];
const journeyStepLabels: Record<JourneyStep, string> = {
  language: "1단계 · 언어 선택",
  permission: "2단계 · 기기 권한",
  venue: "3단계 · 매장 확인",
  menu: "4단계 · 메뉴 탐색",
  payment: "5단계 · 결제 안내"
};

function setJourneyStep(
  step: JourneyStep,
  title: string,
  description: string,
  actionLabel: string,
  options: { showLanguage?: boolean; showVenueInput?: boolean } = {}
) {
  const activeIndex = journeyOrder.indexOf(step);
  document.querySelectorAll<HTMLElement>("[data-journey-step]").forEach((item) => {
    const itemStep = item.dataset.journeyStep as JourneyStep;
    const itemIndex = journeyOrder.indexOf(itemStep);
    item.classList.toggle("active", itemStep === step);
    item.classList.toggle("complete", itemIndex < activeIndex);
    if (itemStep === step) item.setAttribute("aria-current", "step");
    else item.removeAttribute("aria-current");
  });

  flowKicker.textContent = journeyStepLabels[step];
  flowTitle.textContent = title;
  flowDescription.textContent = description;
  flowPrimaryAction.textContent = actionLabel;
  languageStatus.hidden = !options.showLanguage;
  venueFallbackForm.hidden = !options.showVenueInput;
}

function showAppView(view: "assist" | "contribute") {
  const showAssist = view === "assist";
  assistView.hidden = !showAssist;
  contributeView.hidden = showAssist;
  navAssist.classList.toggle("active", showAssist);
  navContribute.classList.toggle("active", !showAssist);
  navAssist.setAttribute("aria-pressed", String(showAssist));
  navContribute.setAttribute("aria-pressed", String(!showAssist));
}
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

// [추가] 배리어프리 권한 획득 성공여부 트래킹
let isPermissionGranted: boolean = false;
let isPermissionChoicePending: boolean = false;
let permissionTapCount: number = 0;
let permissionTapTimer: number | null = null;
let onboardingState: "looping" | "confirming" | "completed" = "looping";
let venueConfirmationPending: boolean = false;
let isKioskNavigationActive: boolean = false;
let pendingMenuConfirmation: boolean = false;
let pendingVenueAnswer: string | null = null;
let nearbyVenueCandidates: Array<{ id?: string; name: string; address?: string }> = [];

const languageNames: Record<string, string> = {
  ko: "한국어",
  en: "English",
  zh: "中文",
  ja: "日本語",
  ru: "Русский",
  de: "Deutsch",
  ar: "العربية"
};

// 다국어 권한 낭독 리소스
const permissionLocales: any = {
  ko: {
    permissionNotice: "안내를 시작합니다. 카메라와 마이크 권한 사용을 위해 화면 상단 중앙 부근에 나타난 허용 버튼을 눌러주세요.",
    requestPermissionText: "카메라 및 마이크 권한 요청 중...",
    permissionSuccess: "권한 승인이 완료되었습니다. 주변 매장 탐색을 시작합니다.",
    permissionSuccessSub: "권한 승인 완료",
    permissionFail: "카메라 권한 획득 실패. 화면 인식을 위해 설정에서 카메라 권한을 승인해 주셔야 합니다.",
    permissionFailSub: "권한 미승인 상태"
  },
  en: {
    permissionNotice: "Starting guidance. To allow camera and microphone access, please click the Allow button near the top center of the screen.",
    requestPermissionText: "Requesting camera & microphone permissions...",
    permissionSuccess: "Permissions granted. Starting nearby restaurant search.",
    permissionSuccessSub: "Permissions Granted",
    permissionFail: "Camera permission denied. Please allow camera access in settings to scan kiosk screens.",
    permissionFailSub: "Permissions Denied"
  },
  zh: {
    permissionNotice: "开始向导。如需允许相机和麦克风权限，请点击屏幕上方中央附近的允许按钮。",
    requestPermissionText: "正在请求相机和麦克风权限...",
    permissionSuccess: "权限已批准。开始搜索附近的餐厅。",
    permissionSuccessSub: "权限已批准",
    permissionFail: "获取相机权限失败。请在设置中允许相机访问以扫描自助机屏幕。",
    permissionFailSub: "权限未批准"
  },
  ja: {
    permissionNotice: "案内を開始します。カメラとマイクの権限を許可するために、画面上部中央付近に表示される許可ボタンを押してください。",
    requestPermissionText: "カメラとマイクの権限を要求中...",
    permissionSuccess: "権限が承认されました。周辺の店舗検索を開始します。",
    permissionSuccessSub: "権限承認完了",
    permissionFail: "カメラ権限の取得に失敗しました。画面認識のため、設定からカメラの権限を許可してください。",
    permissionFailSub: "権限未承認状態"
  },
  ru: {
    permissionNotice: "Начинаем руководство. Чтобы разрешить доступ к камере и микрофону, нажмите кнопку Разрешить в верхней центральной части экрана.",
    requestPermissionText: "Запрос разрешений для камеры и микрофона...",
    permissionSuccess: "Разрешения предоставлены. Начинаем поиск ближайших заведений.",
    permissionSuccessSub: "Разрешения предоставлены",
    permissionFail: "Ошибка получения доступа к камере. Пожалуйста, включите доступ к камере в настройках.",
    permissionFailSub: "Разрешения отклонены"
  },
  de: {
    permissionNotice: "Anleitung wird gestartet. Um den Zugriff auf Kamera und Mikrofon zu erlauben, klicken Sie bitte auf die Schaltfläche Erlauben oben in der Mitte des Bildschirms.",
    requestPermissionText: "Kamera- und Mikrofonberechtigungen werden angefordert...",
    permissionSuccess: "Berechtigungen erteilt. Suche nach Restaurants in der Nähe wird gestartet.",
    permissionSuccessSub: "Berechtigungen Erteilt",
    permissionFail: "Kameraberechtigung verweigert. Bitte erlauben Sie den Kamerazugriff in den Einstellungen.",
    permissionFailSub: "Berechtigungen Verweigert"
  },
  ar: {
    permissionNotice: "بدء الإرشاد. للسماح بالوصول إلى الكاميرا والميكروفون، يرجى النقر فوق زر السماح بالقرب من أعلى وسط الشاشة.",
    requestPermissionText: "جاري طلب أذونات الكاميرا والميكروفون...",
    permissionSuccess: "تم منح الأذونات. بدء البحث عن المطاعم القريبة.",
    permissionSuccessSub: "تم منح الأذونات",
    permissionFail: "فشل الحصول على إذن الكاميرا. يرجى السماح بالوصول إلى الكاميرا في الإعدادات.",
    permissionFailSub: "الأذونات مرفوضة"
  }
};

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

function playAnswerCue(onComplete: () => void) {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  }

  if (audioCtx.state === "suspended") {
    audioCtx.resume();
  }

  const now = audioCtx.currentTime;
  [660, 880].forEach((frequency, index) => {
    const cue = audioCtx!.createOscillator();
    const gain = audioCtx!.createGain();
    const startAt = now + index * 0.22;
    cue.frequency.value = frequency;
    cue.type = "sine";
    gain.gain.setValueAtTime(0.0001, startAt);
    gain.gain.exponentialRampToValueAtTime(0.16, startAt + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, startAt + 0.18);
    cue.connect(gain);
    gain.connect(audioCtx!.destination);
    cue.start(startAt);
    cue.stop(startAt + 0.2);
  });

  window.setTimeout(onComplete, 480);
}

function captureVenueAnswer() {
  updateSubtitle("띵동 소리가 난 뒤 음식점 이름을 말씀해 주세요.");
  playAnswerCue(() => {
    updateSubtitle("지금 방문한 음식점 이름을 말씀해 주세요.");
    hapticInstructionText.textContent = "매장 이름을 듣고 있습니다.";
    startSpeechRecognition((answer) => {
      pendingVenueAnswer = answer.trim();
      const reviewMessage = `${pendingVenueAnswer}로 들었습니다. 제출하려면 화면을 톡톡 두 번 두드리세요.`;
      speak(reviewMessage);
      updateSubtitle(reviewMessage);
      hapticInstructionText.textContent = "답변을 제출하려면 화면을 두 번 탭하세요. 다시 말하려면 안내 다시 듣기를 누르세요.";
      setJourneyStep(
        "venue",
        `${pendingVenueAnswer}로 들었습니다`,
        "답변이 맞으면 화면을 두 번 탭해 제출하세요.",
        "이 답변 제출",
        { showVenueInput: true }
      );
    });
  });
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

    // 시작하기 위해 더블탭 유도
    const welcomeMsg = t.welcome;
    speak(welcomeMsg);
    updateSubtitle(welcomeMsg);
    onboardingState = "completed";
    currentLanguageLabel.textContent = languageNames[userLang];
    hapticInstructionText.textContent = "기기 권한 안내를 시작하려면 화면을 두 번 탭하세요.";
    setJourneyStep(
      "permission",
      "카메라와 마이크를 준비합니다",
      "화면을 두 번 탭하면 권한 요청과 음성 안내가 함께 시작됩니다.",
      "카메라·마이크 허용하기"
    );
  } else {
    // 저장된 언어가 없는 경우: 즉시 7개국어 순차 최초 웰컴 가이드 낭독 루프 가동 (외국인 인지 장벽 원천 제거)
    isSelectingLanguage = true;
    onboardingState = "looping";
    currentSelectionIndex = 0;
    setJourneyStep(
      "language",
      "안내 언어를 듣고 있습니다",
      "원하는 언어가 들리면 화면을 두 번 탭하거나 아래 버튼을 누르세요.",
      "현재 언어 선택",
      { showLanguage: true }
    );
    runLanguageSelectionLoop();
  }

  // 온보딩 더블탭 및 롱프레스 제스처 바인딩
  zeroUiTouchpad.addEventListener("dblclick", handleTouchpadDoubleTap);

  let pressTimer: number;
  zeroUiTouchpad.addEventListener("mousedown", () => {
    pressTimer = window.setTimeout(handleTouchpadLongPress, 2000);
  });
  zeroUiTouchpad.addEventListener("mouseup", () => clearTimeout(pressTimer));
  zeroUiTouchpad.addEventListener("mouseleave", () => clearTimeout(pressTimer));
  zeroUiTouchpad.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      handleTouchpadDoubleTap();
    }
  });

  flowPrimaryAction.addEventListener("click", handleTouchpadDoubleTap);
  micActivationBtn.addEventListener("click", handleTouchpadDoubleTap);
  repeatGuidanceBtn.addEventListener("click", () => {
    if (pendingVenueAnswer) {
      pendingVenueAnswer = null;
      speak("띵동 소리가 들리면 음식점 이름을 다시 대답해 주세요.", captureVenueAnswer);
      return;
    }
    const guidance = subtitleBox.textContent?.trim();
    if (guidance) speak(guidance);
  });

  venueFallbackForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const venueName = manualVenueName.value.trim();
    if (!venueName) {
      updateSubtitle("매장 이름을 입력한 뒤 매장 찾기를 눌러주세요.");
      manualVenueName.focus();
      return;
    }
    handleVenueIdentification(venueName);
  });

  navAssist.addEventListener("click", () => showAppView("assist"));
  navContribute.addEventListener("click", () => showAppView("contribute"));
});

let isPermissionRequested = false;

function showPermissionChoice() {
  if (isPermissionRequested || isPermissionGranted) return;

  isPermissionChoicePending = true;
  permissionTapCount = 0;
  if (permissionTapTimer !== null) clearTimeout(permissionTapTimer);
  permissionTapTimer = null;
  permissionChoiceSurface.hidden = false;
  permissionChoiceSurface.focus();

  const prompt = "카메라와 마이크를 사용할까요? 허락은 화면 아무 곳이나 한 번, 사용하지 않기는 두 번 탭하세요. 한 번 탭하면 브라우저 권한 창이 열립니다.";
  speak(prompt);
  updateSubtitle(prompt);
  hapticInstructionText.textContent = "한 번 탭하면 허용을 진행하고, 두 번 탭하면 사용하지 않습니다.";
  setJourneyStep(
    "permission",
    "카메라와 마이크를 사용할까요?",
    "화면 아무 곳이나 한 번 탭하면 허용, 두 번 탭하면 사용하지 않습니다.",
    "권한 선택"
  );
}

function resolvePermissionChoice(allow: boolean) {
  if (!isPermissionChoicePending) return;

  isPermissionChoicePending = false;
  permissionTapCount = 0;
  if (permissionTapTimer !== null) clearTimeout(permissionTapTimer);
  permissionTapTimer = null;
  permissionChoiceSurface.hidden = true;

  if (allow) {
    const browserPrompt = "허락을 선택했습니다. 이제 브라우저 권한 창이 열리면 허용 버튼을 눌러주세요.";
    speak(browserPrompt);
    updateSubtitle(browserPrompt);
    initAccessibilityPermissions();
    return;
  }

  const declinedPrompt = "카메라와 마이크를 사용하지 않습니다. 영상 인식과 음성 안내를 사용하려면 권한이 필요합니다. 언제든 다시 선택할 수 있습니다.";
  speak(declinedPrompt);
  updateSubtitle(declinedPrompt);
  hapticInstructionText.textContent = "권한을 다시 선택하려면 아래 버튼을 누르거나 화면을 두 번 탭하세요.";
  setJourneyStep(
    "permission",
    "권한을 사용하지 않습니다",
    "영상 인식과 음성 안내를 사용하려면 카메라와 마이크 권한이 필요합니다.",
    "권한 다시 선택"
  );
}

function registerPermissionTap() {
  if (!isPermissionChoicePending) return;

  permissionTapCount += 1;
  if (permissionTapCount >= 2) {
    resolvePermissionChoice(false);
    return;
  }

  navigator.vibrate?.(40);
  permissionTapTimer = window.setTimeout(() => resolvePermissionChoice(true), 360);
}

permissionChoiceSurface.addEventListener("pointerup", registerPermissionTap);
permissionChoiceSurface.addEventListener("click", (event) => {
  if (event.detail === 0) resolvePermissionChoice(true);
});
permissionChoiceSurface.addEventListener("keydown", (event) => {
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    resolvePermissionChoice(true);
  } else if (event.key === "Escape") {
    event.preventDefault();
    resolvePermissionChoice(false);
  }
});

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

  const pLocale = permissionLocales[userLang] || permissionLocales["en"];

  // 2. 카메라/마이크 권한 요청 트리거 및 시각장애인용 음성 안내 코칭
  const permissionNotice = pLocale.permissionNotice;
  speak(permissionNotice);
  updateSubtitle("🔒 " + pLocale.requestPermissionText);
  hapticInstructionText.textContent = "브라우저 상단의 허용 버튼을 눌러 카메라와 마이크를 연결하세요.";
  setJourneyStep(
    "permission",
    "브라우저 권한을 확인하세요",
    "카메라는 키오스크 화면을 읽고, 마이크는 매장과 메뉴 이름을 듣는 데 사용합니다.",
    "권한 요청 중…"
  );
  flowPrimaryAction.disabled = true;

  // 화면 테두리를 황색/녹색 번쩍임으로 점멸하여 가시성 유도
  triggerVisualHapticFlash("center");

  if (!navigator.mediaDevices?.getUserMedia) {
    isPermissionRequested = false;
    flowPrimaryAction.disabled = false;
    updateSubtitle("이 브라우저에서는 카메라를 사용할 수 없습니다. 보안 연결인지 확인하거나 다른 브라우저에서 다시 시도하세요.");
    setJourneyStep(
      "permission",
      "카메라를 연결할 수 없습니다",
      "보안 연결을 확인하거나 카메라를 지원하는 브라우저에서 다시 시도하세요.",
      "권한 다시 시도"
    );
    return;
  }

  navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: true })
    .then(async (stream) => {
      console.log("📹 카메라/마이크 권한 승인 완료");
      isPermissionGranted = true;
      const videoTracks = stream.getVideoTracks();
      stream.getAudioTracks().forEach((track) => track.stop());
      cameraStream = videoTracks.length > 0 ? new MediaStream(videoTracks) : stream;
      cameraFeed.srcObject = cameraStream;
      void cameraFeed.play().catch(() => undefined);

      const successNotice = pLocale.permissionSuccess;
      flowPrimaryAction.disabled = false;
      setJourneyStep(
        "venue",
        "주변 매장을 찾습니다",
        "현재 위치에서 가까운 매장을 불러온 뒤 이름을 음성으로 확인합니다.",
        "매장 검색 다시 시작",
        { showVenueInput: true }
      );
      speak(successNotice, () => {
        // [중요] 권한 획득 성공 즉시 다음 단계인 GPS 기반 매장 매칭으로 오토-플레이 진입! (불필요 탭 요구 차단)
        startVenueIdentificationSequence();
      });
      updateSubtitle("✅ " + pLocale.permissionSuccessSub);
    })
    .catch((err) => {
      console.error("❌ 권한 획득 오류:", err);
      isPermissionRequested = false;
      flowPrimaryAction.disabled = false;
      speak(pLocale.permissionFail);
      updateSubtitle("⚠️ " + pLocale.permissionFailSub);
      hapticInstructionText.textContent = "브라우저 설정에서 카메라와 마이크를 허용한 뒤 다시 시도하세요.";
      setJourneyStep(
        "permission",
        "권한이 필요합니다",
        "브라우저 설정에서 카메라와 마이크를 허용한 뒤 다시 시도하세요.",
        "권한 다시 시도"
      );
    });
}

// 더블탭 액션 핸들러 (상태 머신 분기)
function handleTouchpadDoubleTap() {
  // 0. 음성 기능 끄기 이중 확인 중인 경우 ➔ 더블탭 시 음성 가이드 종료 확정
  if (isVoiceTurningOffConfirm) {
    isVoiceTurningOffConfirm = false;
    isVoiceMode = false;
    toggleVoiceOn.checked = false;

    const offMsg = "음성 안내를 껐습니다. 화면의 자막 안내는 계속 표시됩니다.";
    updateSubtitle(offMsg);
    speak(offMsg, () => {
      window.speechSynthesis.cancel();
      stopAudioSteering();
    });
    return;
  }

  if (venueConfirmationPending) {
    venueConfirmationPending = false;
    startKioskNavigation();
    return;
  }

  if (pendingVenueAnswer) {
    const answer = pendingVenueAnswer;
    pendingVenueAnswer = null;
    handleVenueIdentification(answer);
    return;
  }

  if (isKioskNavigationActive) {
    isKioskNavigationActive = false;
    kioskArrivalOnboarding();
    return;
  }

  if (isPauseMode) {
    isPauseMode = false;
    isFreezed = false;
    startAudioSteering();
    const resumeMessage = "안내를 다시 시작합니다.";
    speak(resumeMessage);
    updateSubtitle(resumeMessage);
    hapticInstructionText.textContent = "한 손가락은 방향 안내, 두 손가락은 메뉴 탐색에 사용하세요.";
    return;
  }

  if (isFreezed && currentVenueData) {
    handleVirtualExplorationQuery();
    return;
  }

  if (pendingMenuConfirmation && targetMenuItem) {
    pendingMenuConfirmation = false;
    addToCart(targetMenuItem);
    currentKioskState = "cart_confirm";
    renderKioskScreen();
    const cartMessage = `${targetMenuItem.name}을 장바구니에 담았습니다. 결제로 이동하려면 아래 버튼을 누르세요.`;
    speak(cartMessage);
    updateSubtitle(cartMessage);
    hapticInstructionText.textContent = "결제로 이동하거나 세 손가락으로 이전 단계로 돌아갈 수 있습니다.";
    setJourneyStep(
      "menu",
      "장바구니에 담았습니다",
      `${targetMenuItem.name}, ${targetMenuItem.price}원`,
      "결제로 이동"
    );
    return;
  }

  if (currentKioskState === "menu" && currentVenueData) {
    const menuPrompt = "원하는 메뉴 이름을 말씀해 주세요.";
    speak(menuPrompt, () => {
      startSpeechRecognition((query) => {
        const item = currentVenueData.menu.find((candidate: any) =>
          query.includes(candidate.name) || candidate.name.includes(query)
        );
        if (!item) {
          updateSubtitle("해당 메뉴를 찾지 못했습니다. 다른 이름으로 다시 말해 주세요.");
          return;
        }
        targetMenuItem = item;
        selectedCategory = item.category;
        pendingMenuConfirmation = true;
        renderKioskScreen();
        const targetMessage = `${item.name}, 가격은 ${item.price}원입니다. 장바구니에 담으려면 아래 버튼을 누르거나 한 손가락으로 방향음을 따라 이동하세요.`;
        speak(targetMessage);
        updateSubtitle(targetMessage);
        hapticInstructionText.textContent = "버튼으로 담거나 한 손가락으로 실제 키오스크의 목표 위치를 찾으세요.";
        setJourneyStep(
          "menu",
          item.name,
          `${item.description || "선택한 메뉴"} · ${item.price}원`,
          "이 메뉴 담기"
        );
      });
    });
    updateSubtitle(menuPrompt);
    return;
  }

  if (currentKioskState === "cart_confirm") {
    window.checkoutCart();
    return;
  }

  if (currentKioskState === "pay_select") {
    window.insertCardMock();
    return;
  }

  if (currentKioskState === "done") {
    window.resetKiosk();
    startVenueIdentificationSequence();
    return;
  }

  const savedLang = localStorage.getItem("user_language");

  // 1. 아직 언어가 미설정된 대기 상태인 경우 ➔ 순차 언어 낭독 루프 개시
  if (!savedLang && !isSelectingLanguage) {
    isSelectingLanguage = true;
    onboardingState = "looping";
    currentSelectionIndex = 0;
    runLanguageSelectionLoop();
    return;
  }

  // 2. 순차 언어 낭독 중에 탭이 들어온 경우 ➔ 해당 언어 임시 락인 및 "저장할까요?" 컨펌 단계 진입
  if (isSelectingLanguage && onboardingState === "looping") {
    onboardingState = "confirming";
    if (languageLoopTimeout) {
      clearTimeout(languageLoopTimeout);
      languageLoopTimeout = null;
    }

    // 임시 락인 상태에서 컨펌 메시지 재생
    const confirmPrompt = locales[tempSelectedLang].saveConfirm;
    speak(confirmPrompt);
    updateSubtitle(confirmPrompt);
    hapticInstructionText.textContent = "이 언어를 저장하려면 다시 두 번 탭하세요. 다른 언어를 들으려면 길게 누르세요.";
    setJourneyStep(
      "language",
      `${languageNames[tempSelectedLang]}를 선택했습니다`,
      "이 언어를 기본 안내 언어로 저장할까요?",
      "이 언어로 계속",
      { showLanguage: true }
    );
    return;
  }

  // 3. 임시 락인 상태에서 수락 더블 탭 ➔ 영구 저장 및 권한 획득 온보딩 시작
  if (isSelectingLanguage && onboardingState === "confirming") {
    localStorage.setItem("user_language", tempSelectedLang);
    userLang = tempSelectedLang;
    t = locales[userLang];
    isSelectingLanguage = false;
    onboardingState = "completed";
    currentLanguageLabel.textContent = languageNames[userLang];
    hapticInstructionText.textContent = "브라우저 권한 안내를 시작합니다.";
    setJourneyStep(
      "permission",
      "카메라와 마이크를 준비합니다",
      "권한 요청이 열리면 브라우저 상단의 허용 버튼을 눌러주세요.",
      "카메라·마이크 허용하기"
    );

    showPermissionChoice();
    return;
  }

  // 4. 언어 세팅 완료 후의 일반적인 주문 더블탭
  if (savedLang) {
    if (!isPermissionGranted) {
      showPermissionChoice();
    } else {
      startVenueIdentificationSequence();
    }
  }
}

// 롱프레스 액션 핸들러 (취소 또는 자막모드 전환)
function handleTouchpadLongPress() {
  // 0. 음성 기능 끄기 이중 확인 중인 경우 ➔ 롱프레스 시 끄기 취소 (음성 유지)
  if (isVoiceTurningOffConfirm) {
    isVoiceTurningOffConfirm = false;
    const keepMsg = "음성 안내를 계속 사용합니다.";
    speak(keepMsg);
    updateSubtitle(keepMsg);
    return;
  }

  if (venueConfirmationPending) {
    venueConfirmationPending = false;
    updateSubtitle("매장 확인을 취소했습니다. 매장 이름을 다시 말하거나 직접 입력해 주세요.");
    setJourneyStep(
      "venue",
      "매장을 다시 확인합니다",
      "매장 이름을 말하거나 아래 입력란에 직접 입력하세요.",
      "음성으로 매장 말하기",
      { showVenueInput: true }
    );
    startVenueIdentificationSequence();
    return;
  }

  // 1. 언어 선택 컨펌 단계에서 롱프레스 ➔ 임시 락인 취소하고 순차 낭독 루프 재개
  if (isSelectingLanguage && onboardingState === "confirming") {
    onboardingState = "looping";
    currentSelectionIndex = (langList.indexOf(tempSelectedLang) + 1) % langList.length;
    hapticInstructionText.textContent = "다음 언어를 듣고 있습니다. 원하는 언어에서 두 번 탭하세요.";
    setJourneyStep(
      "language",
      "다음 안내 언어를 듣습니다",
      "원하는 언어가 들리면 화면을 두 번 탭하거나 아래 버튼을 누르세요.",
      "현재 언어 선택",
      { showLanguage: true }
    );
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
  hapticInstructionText.textContent = "자막 안내를 사용합니다. 아래 단계 실행 버튼으로 계속할 수 있습니다.";
  setJourneyStep(
    isPermissionGranted ? "venue" : "permission",
    "자막 안내를 사용합니다",
    "음성 없이도 현재 안내와 단계 실행 버튼으로 주문을 이어갈 수 있습니다.",
    isPermissionGranted ? "주변 매장 찾기" : "카메라·마이크 허용하기",
    { showVenueInput: isPermissionGranted }
  );
}

// 순차 언어 낭독 루프 코어
function runLanguageSelectionLoop() {
  if (!isSelectingLanguage || onboardingState !== "looping") return;

  const currentLang = langList[currentSelectionIndex];
  tempSelectedLang = currentLang;
  const prompt = langSelectorPrompts[currentLang];

  currentLanguageLabel.textContent = languageNames[currentLang];
  updateSubtitle(prompt.text);

  // 해당 국가의 언어 발음(locale)으로 질문 낭독
  speak(prompt.text, () => {
    // 낭독 완료 후 3.5초간 사용자의 더블탭 입력을 대기함
    if (onboardingState === "looping") {
      languageLoopTimeout = setTimeout(() => {
        if (isSelectingLanguage && onboardingState === "looping") {
          // 더블탭이 없었으면 다음 언어로 인덱스 변환하여 루프 재귀 호출
          currentSelectionIndex = (currentSelectionIndex + 1) % langList.length;
          runLanguageSelectionLoop();
        }
      }, 3500);
    }
  });
}

// 음성 ON/OFF 스위치 토글 연동 (시각장애인 실수 방지 확인 락 장착)
toggleVoiceOn.addEventListener("change", (e: any) => {
  if (!e.target.checked) {
    // 억지로 토글을 다시 ON으로 되돌리고 음성으로 끄기 여부 재차 확인
    toggleVoiceOn.checked = true;
    isVoiceTurningOffConfirm = true;

    const confirmPrompt = "음성 안내를 끌까요? 끄려면 화면을 두 번 탭하고, 계속 사용하려면 길게 누르세요.";
    speak(confirmPrompt);
    updateSubtitle(confirmPrompt);
  } else {
    // 켤 때는 바로 켜짐
    isVoiceMode = true;
    const activePrompt = "음성 안내가 켜졌습니다.";
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
    updateSubtitle("이 브라우저는 음성 인식을 지원하지 않습니다. 매장 이름을 직접 입력해 주세요.");
    venueFallbackForm.hidden = false;
    manualVenueName.focus();
    return;
  }
  const recognition = new SpeechRecognition();
  recognition.lang = langSelectorPrompts[userLang]?.locale || "ko-KR";
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;
  recognition.continuous = false;

  let receivedResult = false;
  let recognitionFailed = false;
  let recognitionTimer: number | null = null;

  const finishListening = () => {
    micWaveEffect.classList.remove("listening");
    if (recognitionTimer !== null) clearTimeout(recognitionTimer);
    recognitionTimer = null;
  };

  recognition.onresult = (event: any) => {
    const text = event.results[0][0].transcript.trim();
    if (!text) return;
    receivedResult = true;
    finishListening();
    console.log("🎤 음성인식 인식 결과:", text);
    onResultCallback(text);
  };

  recognition.onaudiostart = () => {
    updateSubtitle("마이크가 켜졌습니다. 띵동 소리 뒤에 말씀해 주세요.");
  };

  recognition.onspeechstart = () => {
    updateSubtitle("음성을 듣고 있습니다. 말씀을 마치면 잠시 기다려주세요.");
  };

  recognition.onspeechend = () => {
    recognition.stop();
  };

  recognition.onerror = (event: any) => {
    recognitionFailed = true;
    finishListening();
    const messages: Record<string, string> = {
      "not-allowed": "마이크 권한이 꺼져 있습니다. 브라우저 설정에서 마이크를 허용한 뒤 다시 시도해 주세요.",
      "service-not-allowed": "이 브라우저에서 음성 인식 사용이 차단되었습니다. 브라우저 설정을 확인해 주세요.",
      "audio-capture": "마이크를 사용할 수 없습니다. 다른 앱이 마이크를 사용 중인지 확인한 뒤 다시 시도해 주세요.",
      "no-speech": "음성을 듣지 못했습니다. 띵동 소리가 끝난 뒤 음식점 이름을 다시 말씀해 주세요.",
      network: "음성 인식 서버에 연결하지 못했습니다. 네트워크를 확인한 뒤 다시 시도해 주세요."
    };
    const retryMessage = messages[event.error] || "음성을 정확히 듣지 못했습니다. 다시 말하거나 매장 이름을 직접 입력해 주세요.";
    speak(retryMessage);
    updateSubtitle(retryMessage);
    hapticInstructionText.textContent = "안내 다시 듣기를 눌러 재시도하거나 매장 이름을 직접 입력하세요.";
    venueFallbackForm.hidden = false;
  };

  recognition.onend = () => {
    finishListening();
    if (receivedResult || recognitionFailed) return;
    const retryMessage = "음성이 입력되기 전에 듣기가 끝났습니다. 띵동 소리 뒤에 다시 말씀해 주세요.";
    speak(retryMessage);
    updateSubtitle(retryMessage);
  };

  micWaveEffect.classList.add("listening");
  recognitionTimer = window.setTimeout(() => {
    if (receivedResult || recognitionFailed) return;
    recognitionFailed = true;
    recognition.stop();
    finishListening();
    const timeoutMessage = "10초 동안 음성을 듣지 못했습니다. 안내 다시 듣기를 눌러 재시도해 주세요.";
    speak(timeoutMessage);
    updateSubtitle(timeoutMessage);
  }, 10_000);

  try {
    recognition.start();
  } catch (error) {
    recognitionFailed = true;
    finishListening();
    const startErrorMessage = "마이크를 시작하지 못했습니다. 잠시 기다린 뒤 다시 시도해 주세요.";
    speak(startErrorMessage);
    updateSubtitle(startErrorMessage);
  }
}

// 주변 매장 자동 GPS 스캔 및 AI 음성 브리핑 개시
function startVenueIdentificationSequence() {
  venueConfirmationPending = false;
  pendingVenueAnswer = null;
  const scanningMessage = "내 주변 매장을 찾고 있습니다…";
  updateSubtitle(scanningMessage);
  hapticInstructionText.textContent = "주변 매장을 불러온 뒤 매장 이름을 말씀해 주세요.";
  setJourneyStep(
    "venue",
    "주변 매장을 찾고 있습니다",
    "위치 사용이 어렵거나 음성 인식이 되지 않으면 매장 이름을 직접 입력하세요.",
    "주변 매장 다시 찾기",
    { showVenueInput: true }
  );

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
        nearbyVenueCandidates = Array.isArray(resData.venues) ? resData.venues : [];
        const promptWithAnswerGuide = `${resData.audioPrompt} 이어서 띵동 소리가 들리면 대답해 주세요.`;
        speak(promptWithAnswerGuide, captureVenueAnswer);
        updateSubtitle(promptWithAnswerGuide);
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
  nearbyVenueCandidates = [];
  speak(`${defaultPrompt} 이어서 띵동 소리가 들리면 대답해 주세요.`, captureVenueAnswer);
  updateSubtitle(defaultPrompt);
  setJourneyStep(
    "venue",
    "매장 이름을 알려주세요",
    "음성으로 말하거나 아래 입력란에 매장 이름을 직접 입력하세요.",
    "음성으로 매장 말하기",
    { showVenueInput: true }
  );
}

// 온보딩 0단계: 매장명 식별 핸들러
async function handleVenueIdentification(venueName: string) {
  updateSubtitle(`검색한 매장: "${venueName}"`);
  speak(`${venueName} 매장 데이터를 조회하고 있습니다.`);
  setJourneyStep(
    "venue",
    "매장 정보를 확인하고 있습니다",
    `${venueName}의 키오스크 데이터를 불러옵니다.`,
    "확인 중…"
  );
  flowPrimaryAction.disabled = true;

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
      body: JSON.stringify({ name: venueName, gps: { lat, lng }, nearbyVenues: nearbyVenueCandidates })
    });
    const resData = await response.json();

    if (resData.error) {
      speak("등록된 매장을 찾을 수 없습니다. 다시 매장명을 말씀해 주세요.");
      flowPrimaryAction.disabled = false;
      setJourneyStep(
        "venue",
        "매장을 찾지 못했습니다",
        "매장 이름이나 지점명을 바꿔 다시 검색하세요.",
        "다시 말하기",
        { showVenueInput: true }
      );
      return;
    }

    currentVenueKey = resData.venueKey;
    currentVenueData = resData.data;
    kioskStoreName.textContent = currentVenueData.name;

    venueConfirmationPending = true;
    flowPrimaryAction.disabled = false;
    const confirmedText = `${currentVenueData.name}에 도착하신 것이 맞습니까? 맞으면 두 번 탭하고, 아니면 화면을 길게 눌러 다시 말해 주세요.`;
    speak(confirmedText);
    updateSubtitle(confirmedText);
    hapticInstructionText.textContent = "매장이 맞으면 두 번 탭하세요. 아니면 길게 눌러 다시 찾으세요.";
    setJourneyStep(
      "venue",
      currentVenueData.name,
      "현재 매장이 맞는지 확인해 주세요.",
      "이 매장이 맞습니다",
      { showVenueInput: true }
    );

  } catch (error) {
    flowPrimaryAction.disabled = false;
    const errorMessage = "매장 정보를 불러오지 못했습니다. 네트워크를 확인한 뒤 다시 시도하세요.";
    speak(errorMessage);
    updateSubtitle(errorMessage);
    setJourneyStep(
      "venue",
      "매장 정보를 불러오지 못했습니다",
      "네트워크를 확인한 뒤 다시 검색하거나 매장 이름을 직접 입력하세요.",
      "다시 시도",
      { showVenueInput: true }
    );
  }
}

// --------------------------------------------------
// 2. Indoor Kiosk Finder (1단계: 매장 내 기기 탐색)
// --------------------------------------------------
function startKioskNavigation() {
  isKioskNavigationActive = true;
  speak("1단계. 매장 내 키오스크 탐색을 시작합니다. 휴대폰 후면 카메라를 정면을 향해 들고 천천히 걸어가세요.", () => {
    startAudioSteering();
    if (streamInterval) clearInterval(streamInterval);
    streamInterval = setInterval(sendVideoFrameToServer, 1000);
  });
  updateSubtitle("1단계: 매장 내 키오스크 위치 탐색 중. 폰을 정면으로 들어 비추며 걸어가세요.");
  hapticInstructionText.textContent = "키오스크 앞에 도착하면 화면을 두 번 탭하세요.";
  setJourneyStep(
    "menu",
    "키오스크를 찾고 있습니다",
    "휴대폰 후면 카메라를 정면으로 들고 천천히 이동하세요.",
    "키오스크 앞에 도착했습니다"
  );
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
  btnStarbucks.setAttribute("aria-pressed", "true");
  btnMcdonalds.setAttribute("aria-pressed", "false");
  initVenue("starbucks");
});
btnMcdonalds.addEventListener("click", () => {
  btnMcdonalds.classList.add("active");
  btnStarbucks.classList.remove("active");
  btnMcdonalds.setAttribute("aria-pressed", "true");
  btnStarbucks.setAttribute("aria-pressed", "false");
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
  setJourneyStep(
    "menu",
    "키오스크 앞에 도착했습니다",
    "바로 주문하거나 메뉴판을 음성으로 천천히 탐색할 수 있습니다.",
    "원하는 메뉴 말하기"
  );
  hapticInstructionText.textContent = "메뉴 이름을 말하려면 두 번 탭하세요. 두 손가락으로 화면을 훑어 메뉴를 들을 수도 있습니다.";

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
  setJourneyStep(
    "menu",
    "전체 메뉴 탐색 모드",
    "편한 자리에서 메뉴 이름을 말해 가격과 설명을 들을 수 있습니다.",
    "메뉴 이름 말하기"
  );
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
          <div class="start-logo" aria-hidden="true"></div>
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
        <button type="button" class="kiosk-menu-card ${isTarget}" onclick="selectMenuItem('${item.id}')">
          <div class="card-title">${item.name}</div>
          <div class="card-price">${item.price}원</div>
        </button>`;
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
        <div class="kiosk-popup" role="dialog" aria-modal="true" aria-labelledby="kiosk-popup-title">
          <h3 id="kiosk-popup-title">${item.name} 옵션 선택</h3>
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
          <button type="button" class="payment-card-btn active-highlight" onclick="insertCardMock()">
            <span style="font-size:2.5rem;">💳</span>
            <span>신용카드 결제</span>
          </button>
          <button type="button" class="payment-card-btn">
            <span style="font-size:2.5rem;">📱</span>
            <span>모바일 바코드 페이</span>
          </button>
        </div>
        <p style="color:#64748b; font-size:0.85rem; font-weight:700;">실물 카드를 아래 슬롯에 꽂아 주세요.</p>
      </div>`;
    cardSlotMock.querySelector(".slot-light")?.classList.add("pulsing");
  }

  else if (currentKioskState === "done") {
    container.innerHTML = `
      <div class="kiosk-step" style="text-align:center;">
        <span style="font-size:4rem; display:block; margin-bottom:20px;" aria-hidden="true">✓</span>
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
    const cartMessage = `${targetMenuItem.name}을 장바구니에 추가했습니다.`;
    speak(cartMessage);
    updateSubtitle(cartMessage);
    setJourneyStep(
      "menu",
      "메뉴를 장바구니에 담았습니다",
      "다른 메뉴를 찾거나 결제로 이동하세요.",
      "다른 메뉴 말하기"
    );
  }
};

window.checkoutCart = function() {
  currentKioskState = "pay_select";
  renderKioskScreen();
  const paymentMessage = "결제 수단 선택 화면입니다. 신용카드를 카드 투입구에 삽입해 주세요.";
  speak(paymentMessage);
  updateSubtitle(paymentMessage);
  hapticInstructionText.textContent = "카드 투입구 위치를 방향음으로 안내합니다.";
  setJourneyStep(
    "payment",
    "신용카드를 준비하세요",
    "방향음을 따라 키오스크 아래의 카드 투입구를 찾으세요.",
    "카드 삽입 완료"
  );
};

window.insertCardMock = function() {
  currentKioskState = "done";
  renderKioskScreen();
  const doneMessage = "결제가 완료되었습니다. 주문 번호표를 확인해 주세요. 이용해 주셔서 감사합니다.";
  speak(doneMessage);
  updateSubtitle(doneMessage);
  hapticInstructionText.textContent = "주문이 완료되었습니다. 새 주문은 아래 버튼으로 시작하세요.";
  setJourneyStep(
    "payment",
    "주문이 완료되었습니다",
    "영수증과 주문 번호표를 챙겨 주세요.",
    "새 주문 시작"
  );
};

window.resetKiosk = function() {
  currentKioskState = "start";
  currentCart = [];
  targetMenuItem = null;
  pendingMenuConfirmation = false;
  isFreezed = false;
  renderKioskScreen();
};

// --------------------------------------------------
// 5. Real-Time Video Frame Capture & Gemini Loop
// --------------------------------------------------

function captureCameraFrame(): string | null {
  if (
    !cameraStream ||
    cameraFeed.readyState < HTMLMediaElement.HAVE_CURRENT_DATA ||
    cameraFeed.videoWidth === 0 ||
    cameraFeed.videoHeight === 0
  ) {
    return null;
  }

  const canvas = document.createElement("canvas");
  canvas.width = cameraFeed.videoWidth;
  canvas.height = cameraFeed.videoHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  ctx.drawImage(cameraFeed, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.72);
}

// 마우스 무브 연동 (PC 테스팅용 백업)
zeroUiTouchpad.addEventListener("mousemove", (e: MouseEvent) => {
  const rect = zeroUiTouchpad.getBoundingClientRect();
  fingerX = Math.floor(((e.clientX - rect.left) / rect.width) * 480);
  fingerY = Math.floor(((e.clientY - rect.top) / rect.height) * 700);
});

// 모바일 멀티터치와 실제 더블 탭/롱프레스 판정
let touchStartedAt = 0;
let touchStartX = 0;
let touchStartY = 0;
let lastTapAt = 0;
let touchMoved = false;
let touchLongPressTriggered = false;
let touchLongPressTimer: number | null = null;

zeroUiTouchpad.addEventListener("touchstart", (event) => {
  if (event.touches.length === 1) {
    touchStartedAt = Date.now();
    touchStartX = event.touches[0].clientX;
    touchStartY = event.touches[0].clientY;
    touchMoved = false;
    touchLongPressTriggered = false;
    touchLongPressTimer = window.setTimeout(() => {
      touchLongPressTriggered = true;
      handleTouchpadLongPress();
    }, 1000);
  } else if (touchLongPressTimer !== null) {
    clearTimeout(touchLongPressTimer);
    touchLongPressTimer = null;
  }
  handleTouchpadGesture(event);
}, { passive: false });

zeroUiTouchpad.addEventListener("touchmove", (event) => {
  if (event.touches.length === 1) {
    const movedDistance = Math.hypot(
      event.touches[0].clientX - touchStartX,
      event.touches[0].clientY - touchStartY
    );
    if (movedDistance > 18) {
      touchMoved = true;
      if (touchLongPressTimer !== null) clearTimeout(touchLongPressTimer);
      touchLongPressTimer = null;
    }
  }
  handleTouchpadGesture(event);
}, { passive: false });

zeroUiTouchpad.addEventListener("touchend", () => {
  if (touchLongPressTimer !== null) clearTimeout(touchLongPressTimer);
  touchLongPressTimer = null;
  stopAudioSteering();

  const now = Date.now();
  const isTap = !touchMoved && !touchLongPressTriggered && now - touchStartedAt <= 320;
  if (!isTap) return;

  if (now - lastTapAt <= 450) {
    lastTapAt = 0;
    handleTouchpadDoubleTap();
  } else {
    lastTapAt = now;
  }
});

let lastSpokenTime = 0;
let lastBackNavTime = 0;

function handleTouchpadGesture(e: TouchEvent) {
  e.preventDefault(); // 스크롤 등 브라우저 기본 인터랙션 방지
  const rect = zeroUiTouchpad.getBoundingClientRect();
  const now = Date.now();

  if (!currentVenueData && e.touches.length <= 2) return;

  if (e.touches.length >= 5) {
    // --------------------------------------------------
    // 0. 주먹 터치 (5개 손가락 이상 넓은 접촉) ➔ "잠시 대기/일시정지 (Pause/Wait Mode)"
    // --------------------------------------------------
    if (isPauseMode) return;
    stopAudioSteering(); // 조향 비프음 즉시 차단
    isPauseMode = true;
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

      if (currentKioskState === "menu" || currentKioskState === "cart_confirm") {
        speak("이전 화면으로 돌아갑니다.");
        updateSubtitle("이전 화면으로 이동합니다.");
        currentKioskState = "start";
        renderKioskScreen();
      } else if (currentKioskState === "pay_select") {
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

  const base64Image = captureCameraFrame();
  if (!base64Image) return;
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
    window.insertCardMock();
  }
}

window.addEventListener("pagehide", () => {
  cameraStream?.getTracks().forEach((track) => track.stop());
});

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

const contributionForm = document.getElementById("contribution-form") as HTMLFormElement;
const contribUsername = document.getElementById("contrib-username") as HTMLInputElement;
const contribVenue = document.getElementById("contrib-venue") as HTMLInputElement;
const contribStatusMsg = document.getElementById("contrib-status-msg") as HTMLElement;

contributionForm.addEventListener("submit", (event) => {
  event.preventDefault();
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
  tabLeaderboard.setAttribute("aria-selected", "true");
  tabContribute.setAttribute("aria-selected", "false");
});
tabContribute.addEventListener("click", () => {
  tabContribute.classList.add("active");
  tabLeaderboard.classList.remove("active");
  paneContribute.classList.add("active");
  paneLeaderboard.classList.remove("active");
  tabContribute.setAttribute("aria-selected", "true");
  tabLeaderboard.setAttribute("aria-selected", "false");
});

// --------------------------------------------------
// 7. Google Maps & Geolocation API 기여 연동
// --------------------------------------------------
const btnGpsRefresh = document.getElementById("btn-gps-refresh") as HTMLButtonElement;
const contribGpsVenues = document.getElementById("contrib-gps-venues") as HTMLSelectElement;
const contribMapCanvas = document.getElementById("contrib-map-canvas") as HTMLElement;

btnGpsRefresh.addEventListener("click", () => {
  if (!("geolocation" in navigator)) {
    contribStatusMsg.textContent = "이 브라우저는 위치 검색을 지원하지 않습니다. 매장 이름을 직접 입력하세요.";
    return;
  }

  btnGpsRefresh.textContent = "검색 중…";
  btnGpsRefresh.disabled = true;
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

    btnGpsRefresh.textContent = "주변 매장 다시 찾기";
    btnGpsRefresh.disabled = false;
    contribStatusMsg.textContent = "내 주변 매장을 불러왔습니다.";
    setTimeout(() => { contribStatusMsg.textContent = ""; }, 2000);
  }, () => {
    btnGpsRefresh.textContent = "현재 위치로 찾기";
    btnGpsRefresh.disabled = false;
    contribStatusMsg.textContent = "위치를 가져올 수 없습니다. 위치 권한을 확인하거나 매장 이름을 직접 입력하세요.";
  });
});

contribGpsVenues.addEventListener("change", (e: any) => {
  const selectedName = e.target.value;
  if (!selectedName) {
    contribMapCanvas.hidden = true;
    return;
  }

  contribVenue.value = selectedName;
  contribMapCanvas.hidden = false;
  renderMiniGoogleMap(selectedName);
});

// --------------------------------------------------
// Google Maps Autocomplete 장소 찾기 검색 연동
// --------------------------------------------------
const contribSearchResults = document.getElementById("contrib-search-results") as HTMLElement;

contribVenue.addEventListener("input", (e: any) => {
  const query = e.target.value.trim();
  if (query.length < 2) {
    contribSearchResults.hidden = true;
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
    contribSearchResults.hidden = true;
    return;
  }

  contribSearchResults.innerHTML = "";
  contribSearchResults.hidden = false;

  matched.forEach(place => {
    const option = document.createElement("button");
    option.type = "button";
    option.className = "search-result-option";
    option.setAttribute("role", "option");
    option.innerHTML = `<strong>${place.name}</strong><span>${place.address}</span>`;

    option.addEventListener("click", () => {
      contribVenue.value = place.name;
      contribSearchResults.hidden = true;
      contribMapCanvas.hidden = false;
      renderMiniGoogleMap(place.name);
    });

    contribSearchResults.appendChild(option);
  });
});

// 클릭 시 Autocomplete 창 닫기 바인딩
document.addEventListener("click", (e: any) => {
  if (e.target !== contribVenue && !contribSearchResults.contains(e.target)) {
    contribSearchResults.hidden = true;
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
