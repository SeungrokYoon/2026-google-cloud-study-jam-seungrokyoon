import { expect, test, type Page } from "@playwright/test";

async function installBrowserStubs(page: Page) {
  await page.route("**/api/venue-assist", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({
      venues: [],
      source: "test",
      audioPrompt: "지금 방문한 음식점은 어디인가요?"
    })
  }));

  await page.addInitScript(() => {
    localStorage.clear();

    Object.defineProperty(window, "speechSynthesis", {
      configurable: true,
      value: {
        cancel() {},
        speak(utterance: SpeechSynthesisUtterance) {
          window.setTimeout(() => utterance.onend?.({} as SpeechSynthesisEvent), 0);
        }
      }
    });

    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: {
        async getUserMedia() {
          (window as any).__getUserMediaCalls = ((window as any).__getUserMediaCalls || 0) + 1;
          const stream = new MediaStream();
          Object.defineProperty(stream, "getAudioTracks", {
            value: () => [{
              stop() {
                (window as any).__audioTrackStops = ((window as any).__audioTrackStops || 0) + 1;
              }
            }]
          });
          return stream;
        }
      }
    });

    Object.defineProperty(navigator, "geolocation", {
      configurable: true,
      value: {
        getCurrentPosition(success: PositionCallback) {
          success({ coords: { latitude: 37.5665, longitude: 126.978 } } as GeolocationPosition);
        }
      }
    });

    (window as any).__speechQueue = ["스타벅스", "1", "아이스 아메리카노"];
    class RecognitionMock {
      lang = "ko-KR";
      interimResults = false;
      maxAlternatives = 1;
      onresult?: (event: any) => void;
      onspeechend?: () => void;
      onerror?: (event: any) => void;

      start() {
        const speechError = (window as any).__speechError;
        if (speechError) {
          window.setTimeout(() => this.onerror?.({ error: speechError }), 0);
          return;
        }
        const transcript = (window as any).__speechQueue.shift() || "스타벅스";
        window.setTimeout(() => {
          this.onresult?.({ results: [[{ transcript }]] });
          this.onspeechend?.();
        }, 0);
      }

      stop() {}
    }

    (window as any).SpeechRecognition = RecognitionMock;
    (window as any).webkitSpeechRecognition = RecognitionMock;
  });
}

async function doubleTapTouchpad(page: Page, xRatio = 0.5, yRatio = 0.5) {
  const box = await page.locator("#zero-ui-touchpad").boundingBox();
  if (!box) throw new Error("터치패드 위치를 찾지 못했습니다.");
  const x = box.x + box.width * xRatio;
  const y = box.y + box.height * yRatio;
  await page.touchscreen.tap(x, y);
  await page.waitForTimeout(90);
  await page.touchscreen.tap(x, y);
}

test("모바일 주문 흐름을 화면 전체 제스처로 완료한다", async ({ page }) => {
  await installBrowserStubs(page);
  await page.goto("/");

  await expect(page.getByText("시연 화면")).toHaveCount(0);
  await expect(page.locator("#flow-title")).toHaveText("안내 언어를 듣고 있습니다");
  await expect(page.locator("#contribution-form")).toHaveCount(0);
  await expect(page.locator("#zero-ui-touchpad > #camera-feed")).toHaveCount(1);
  await expect(page.locator("#nav-contribute")).toHaveAttribute("href", "/contribute");
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBe(0);

  const touchpadBox = await page.locator("#zero-ui-touchpad").boundingBox();
  expect(touchpadBox).not.toBeNull();
  expect(touchpadBox!.width).toBeGreaterThanOrEqual(360);
  expect(touchpadBox!.height).toBeGreaterThanOrEqual(560);

  await doubleTapTouchpad(page, 0.12, 0.18);
  await expect(page.locator("#flow-primary-action")).toHaveText("이 언어로 계속");
  await doubleTapTouchpad(page);

  await expect(page.locator("#permission-choice-surface")).toBeVisible();
  expect(await page.evaluate(() => (window as any).__getUserMediaCalls || 0)).toBe(0);
  await page.touchscreen.tap(24, 180);
  await page.waitForTimeout(500);
  expect(await page.evaluate(() => (window as any).__getUserMediaCalls || 0)).toBe(1);
  expect(await page.evaluate(() => (window as any).__audioTrackStops || 0)).toBe(1);

  await expect(page.locator("#flow-title")).toHaveText("스타벅스로 들었습니다", { timeout: 10_000 });
  await expect(page.locator("#flow-primary-action")).toHaveText("이 답변 제출");
  await doubleTapTouchpad(page, 0.88, 0.5);
  await expect(page.locator("#flow-primary-action")).toHaveText("이 매장이 맞습니다", { timeout: 10_000 });
  await doubleTapTouchpad(page, 0.88, 0.5);
  await expect(page.locator("#flow-title")).toHaveText("키오스크를 찾고 있습니다");

  await doubleTapTouchpad(page, 0.88, 0.5);
  await expect(page.locator("#flow-title")).toHaveText("키오스크 앞에 도착했습니다");

  await doubleTapTouchpad(page, 0.88, 0.5);
  await expect(page.locator("#flow-title")).toHaveText("아이스 아메리카노");
  await expect(page.locator("#flow-primary-action")).toHaveText("이 메뉴 담기");

  await doubleTapTouchpad(page, 0.88, 0.5);
  await expect(page.locator("#flow-title")).toHaveText("장바구니에 담았습니다");
  await doubleTapTouchpad(page, 0.88, 0.5);
  await expect(page.locator("#flow-title")).toHaveText("신용카드를 준비하세요");

  await doubleTapTouchpad(page, 0.88, 0.5);
  await expect(page.locator("#flow-title")).toHaveText("주문이 완료되었습니다");
});

test("권한 선택에서 화면 두 번 탭은 마이크와 카메라 요청을 거절한다", async ({ page }) => {
  await installBrowserStubs(page);
  await page.goto("/");

  await doubleTapTouchpad(page);
  await doubleTapTouchpad(page);
  await expect(page.locator("#permission-choice-surface")).toBeVisible();

  await page.touchscreen.tap(30, 190);
  await page.waitForTimeout(90);
  await page.touchscreen.tap(30, 190);
  await page.waitForTimeout(500);

  expect(await page.evaluate(() => (window as any).__getUserMediaCalls || 0)).toBe(0);
  await expect(page.locator("#permission-choice-surface")).toBeHidden();
  await expect(page.locator("#flow-title")).toHaveText("권한을 사용하지 않습니다");
  await expect(page.locator("#flow-primary-action")).toHaveText("권한 다시 선택");
});

test("마이크 캡처 실패 원인을 구체적인 음성 안내로 구분한다", async ({ page }) => {
  await installBrowserStubs(page);
  await page.goto("/");
  await page.evaluate(() => { (window as any).__speechError = "audio-capture"; });

  await doubleTapTouchpad(page);
  await doubleTapTouchpad(page);
  await page.touchscreen.tap(24, 180);

  await expect(page.locator("#subtitle-box")).toContainText("다른 앱이 마이크를 사용 중인지 확인", { timeout: 10_000 });
});

test("기여 기능은 주문 화면과 분리되어 동작한다", async ({ page }) => {
  await installBrowserStubs(page);
  await page.goto("/contribute");

  await expect(page).toHaveURL(/\/contribute$/);
  await expect(page.locator("#zero-ui-touchpad")).toHaveCount(0);
  await expect(page.locator("#contribution-form")).toBeVisible();

  await page.locator("#contrib-username").fill("접근성테스터");
  await page.locator("#contrib-venue").fill("스타벅스 강남역점");
  await page.locator("#btn-submit-contribution").click();
  await expect(page.locator("#contrib-status-msg")).toContainText("기여 성공");
});
