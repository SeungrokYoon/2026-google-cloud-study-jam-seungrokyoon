# Backend System Architecture (be.md)

본 문서는 Express.js 프레임워크 기반 백엔드 단([server.js](file:///Users/seungrokyoon/Documents/00_Dev_Master/2026-google-studyjam-hakerthon/server.js))의 설계와 Gemini AI, 데이터베이스 및 캐시 연동에 관한 기술 명세서입니다.

---

## 🔌 1. REST API 라우트 설계 및 기능 명세

### 1-1. `/api/venue-assist` (POST)
* **목적:** 사용자의 Geolocation GPS 위경도를 수신하여 반경 100m 이내의 매장 목록을 Firestore NoSQL에서 쿼리합니다.
* **출력:** 매장 목록 및 안내용 오디오 브리핑 TTS 텍스트 멘트.

### 1-2. `/api/venue` (POST)
* **목적:** 주변 후보 매장 목록과 사용자가 발음한 모호한 매칭 답변("맥날", "스벅")을 받아 **Gemini 2.5 Flash**를 연동하여 올바른 실제 데이터베이스 Key("맥도날드 홍대점")를 최종 락인(Fuzzy Venue Match)합니다.
* **출력:** 락인 완료된 매장 메타데이터 및 카테고리별 전체 메뉴 템플릿(픽셀 2D 좌표 포함).

### 1-3. `/api/analyze-frame` (POST)
* **목적:** 사용자가 전송한 1초 주기 압축 이미지(Base64)와 목표 타겟 메뉴 정보를 받아 Gemini AI로 실시간 프레임을 분석합니다.
* **동작:** 프레임 내의 키오스크 화면 경계를 검출하고 목표 메뉴 버튼의 실물 모니터 내 2D 픽셀 범위 좌표(`[Y1, X1, Y2, X2]`)를 역산해 프론트엔드 캐시에 응답합니다.

### 1-4. `/api/leaderboard` (GET)
* **목적:** 일반 기여자의 명예의 전당 통계를 위해 BigQuery에 적재된 누적 점수 테이블을 쿼리하여 상위 100위 랭킹 어레이 목록을 반환합니다.

### 1-5. `/api/auth/google` (POST)
* **목적:** 프론트엔드에서 획득한 Google ID Token(JWT)을 전송받아 유효성을 검증하고 기여자의 세션을 인가합니다.
* **동작:** `google-auth-library` 클라이언트의 `OAuth2Client.verifyIdToken`을 구동하여 서명 위조 여부를 판단하고, 통과 시 이메일 주소를 Firestore Document ID로 하는 `contributors/{email}` 내의 기여 포인트 및 100레벨 공룡 데이터를 Upsert 처리합니다.

---

## 🧠 2. Gemini 2.5 Flash 비전 판독 및 모호성 해결 로직
* **Fuzzy Matching API:** 사용자가 말한 단어와 GPS 주변 100m 이내 매장 메타데이터 목록을 System Instruction 프롬프트에 얹어 `gemini-2.5-flash` 모델을 통해 의미론적으로 대조 판별합니다.
* **비전 2D 좌표 리턴:** 실시간 비디오 프레임이 송신되면 이미지 바운딩 박스 인지 능력을 발휘하여, 키오스크 실물 액정 경계 내에서 목표 메뉴가 위치한 Y/X 픽셀 절대 범위를 반환해 프론트엔드가 60FPS Local Aim-Assist 연산을 구동할 수 있게 데이터 근간을 제공합니다.

---

## ⚡ 3. 분산 Rate Limiting 및 Memorystore Redis 연동
* Cloud Run Auto-scaling으로 인스턴스가 스케일아웃(최대 3개 인스턴스) 될 때 발생할 수 있는 로컬 메모리 카운트 불일치를 격리합니다.
* `express-rate-limit` 미들웨어 단에 `rate-limit-redis` 및 `ioredis` 어댑터를 부착하여, 모든 컨테이너가 동일한 **Google Memorystore Redis** 중앙 인스턴스를 바라보도록 공유 캐시 세션을 동기화하여 IP당 호출 제약 일관성을 보장합니다.

---

## 📊 4. BigQuery 로그 실시간 스트리밍 적재 (Streaming Inserts)
* 기여자가 기여하거나 사용자가 실시간 조향 성공 시, 백엔드는 BigQuery SDK를 사용해 `echo_menu_logs.frame_analysis_history` 테이블에 데이터 행을 **실시간 스트리밍 적재(`insertAll`)** 합니다.
* 이 방식은 배치 적재와 달리 0.5초 이내에 BigQuery 테이블에 바로 반영되므로, **Looker Studio 임베딩 대시보드** 상에 실시간 명예의 전당 스코어 보드가 지연 없이 표시됩니다.

---

## 📦 5. 런타임 및 의존성 관리 (Runtime & Package Management)
* **백엔드 런타임:** **Node.js LTS (v22)** 런타임과 경량 웹 프레임워크인 **Express.js**를 조합하여 최소의 메모리 오버헤드로 API 엔드포인트를 초고속 전개합니다.
* **패키지 매니저 (pnpm):** 패키지 관리 도구로 **`pnpm`**을 통일 적용합니다. 가상 저장소(Virtual Store) 기반의 고유 구조를 통해 컨테이너 도커라이징(`Dockerfile`) 시 레이어 캐싱 효율을 극대화하고 백엔드 서버 콜드 스타트 빌드 시간을 75% 이상 감축합니다.

