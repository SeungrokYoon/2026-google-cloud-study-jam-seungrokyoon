#!/bin/bash
# =======================================================================
# 🚀 Echo-Menu 3.0: 구글 클라우드 원클릭 인프라 프로비저닝 & 배포 스크립트
# =======================================================================

set -e # 에러 발생 시 즉각 중단

# 색상 터미널 출력 정의
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${BLUE}=====================================================${NC}"
echo -e "${GREEN}       Echo-Menu 3.0 GCP One-Click Provisioner        ${NC}"
echo -e "${BLUE}=====================================================${NC}"

# 1. gcloud 로그인 인증 여부 체크
echo -e "${YELLOW}[1/6] 구글 클라우드 CLI 로그인 상태 확인 중...${NC}"
CURRENT_ACCOUNT=$(gcloud auth list --filter=status:ACTIVE --format="value(account)")

if [ -z "$CURRENT_ACCOUNT" ]; then
    echo "⚠️ 활성화된 구글 계정이 없습니다. 브라우저 인증을 먼저 시작합니다."
    gcloud auth login
else
    echo -e "${GREEN}✓ 활성화 계정 감지: $CURRENT_ACCOUNT${NC}"
fi

# 2. GCP 프로젝트 ID 선택
PROJECT_ID=$(gcloud config get-value project)
if [ -z "$PROJECT_ID" ] || [ "$PROJECT_ID" = "(unset)" ]; then
    echo -e "${YELLOW}⚠️ 기본 프로젝트 ID가 세팅되지 않았습니다.${NC}"
    read -p "사용할 GCP 프로젝트 ID를 입력하세요: " INPUT_PROJECT
    gcloud config set project "$INPUT_PROJECT"
    PROJECT_ID="$INPUT_PROJECT"
fi
echo -e "${GREEN}✓ 타겟 GCP 프로젝트 ID: $PROJECT_ID${NC}"

# 3. 필수 GCP API 활성화
echo -e "\n${YELLOW}[2/6] 필수 구글 클라우드 API 일괄 활성화 중 (약 30초 소요)...${NC}"
gcloud services enable \
    run.googleapis.com \
    firestore.googleapis.com \
    bigquery.googleapis.com \
    aiplatform.googleapis.com \
    artifactregistry.googleapis.com \
    cloudbuild.googleapis.com

echo -e "${GREEN}✓ API 활성화 완료.${NC}"

# 4. Cloud Firestore 데이터베이스 자동 생성 (Default Database, Native 모드, 서울 리전)
echo -e "\n${YELLOW}[3/6] Cloud Firestore NoSQL 데이터베이스 생성 중...${NC}"
# 이미 생성되어 있는지 검사 후 생성
if gcloud firestore databases list --format="value(name)" | grep -q "default"; then
    echo -e "${GREEN}✓ Firestore default 데이터베이스가 이미 존재합니다.${NC}"
else
    gcloud firestore databases create \
        --location=asia-northeast3 \
        --type=firestore-native
    echo -e "${GREEN}✓ Firestore 데이터베이스 서울(asia-northeast3) 리전 생성 성공.${NC}"
fi

# 5. BigQuery 로그 테이블 생성
echo -e "\n${YELLOW}[4/6] BigQuery 로그 수집 데이터세트 및 테이블 빌드 중...${NC}"
# 데이터세트 생성
if bq show --dataset "$PROJECT_ID:echo_menu_logs" >/dev/null 2>&1; then
    echo -e "${GREEN}✓ BigQuery echo_menu_logs 데이터세트가 이미 존재합니다.${NC}"
else
    bq --location=asia-northeast3 mk --dataset "$PROJECT_ID:echo_menu_logs"
    echo -e "${GREEN}✓ BigQuery 데이터세트 생성 완료.${NC}"
fi

# 프레임 로그 수집용 스키마 정의 및 테이블 생성
TABLE_ID="echo_menu_logs.frame_analysis_history"
if bq show "$PROJECT_ID:$TABLE_ID" >/dev/null 2>&1; then
    echo -e "${GREEN}✓ BigQuery 로그 테이블이 이미 존재합니다.${NC}"
else
    # 스키마 파일 인라인 생성
    SCHEMA='[
        {"name": "timestamp", "type": "TIMESTAMP", "mode": "REQUIRED"},
        {"name": "uuid", "type": "STRING", "mode": "REQUIRED"},
        {"name": "venueKey", "type": "STRING", "mode": "NULLABLE"},
        {"name": "targetState", "type": "STRING", "mode": "NULLABLE"},
        {"name": "steerDirection", "type": "STRING", "mode": "NULLABLE"},
        {"name": "isTargetHit", "type": "BOOLEAN", "mode": "NULLABLE"},
        {"name": "processingTimeMs", "type": "INTEGER", "mode": "NULLABLE"}
    ]'
    echo "$SCHEMA" > bq_schema.json
    bq mk --table "$PROJECT_ID:$TABLE_ID" bq_schema.json
    rm bq_schema.json
    echo -e "${GREEN}✓ BigQuery 로그 테이블 스키마 빌드 성공.${NC}"
fi

# 6. Cloud Run 소스기반 배포 실행
echo -e "\n${YELLOW}[5/6] Cloud Run 퍼블릭 웹 서비스 소스 기반 다이렉트 배포 시작...${NC}"
echo -e "${YELLOW}   (로컬 코드를 빌드하여 즉시 퍼블릭 HTTPS 주소로 서빙합니다)${NC}"

# 배포 명령어 제안 실행
gcloud run deploy echo-menu-app \
    --source . \
    --region=asia-northeast3 \
    --max-instances=3 \
    --allow-unauthenticated \
    --set-env-vars="GEMINI_API_KEY=YOUR_GEMINI_API_KEY_HERE"

echo -e "\n${GREEN}[6/6] 🎉 인프라 자동화 및 Cloud Run 서버 배포가 최종 완료되었습니다!${NC}"
echo -e "위 안내된 Cloud Run URL 주소로 프론트엔드가 퍼블릭 오픈되었습니다."
echo -e "Gemini API 호출을 실가동하려면 배포된 환경변수에 실제 API Key를 매핑해 주세요."
echo -e "${BLUE}=====================================================${NC}"
