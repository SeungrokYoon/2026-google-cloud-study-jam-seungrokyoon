# =======================================================================
# 🐳 Echo-Menu 3.0: 고성능 pnpm 멀티스테이지 경량화 Dockerfile
# =======================================================================

# 1단계: 빌드 및 의존성 캐싱 스테이지
FROM node:22-slim AS builder

# pnpm 설치 및 작업 폴더 세팅
RUN npm install -g pnpm@10.29.3
WORKDIR /app

# lockfile 기준 패키지 고속 설치
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# 전체 소스 복사 및 Vite 프론트엔드 프로덕션 번들링
COPY . .
RUN pnpm run build

# 프로덕션 운영에 불필요한 devDependencies 원격 트리쉐이킹 (Pruning)
RUN CI=true pnpm prune --prod

# =======================================================================
# 2단계: 최적화 경량화 실행용 스테이지
FROM node:22-slim
WORKDIR /app

# 빌더 스테이지에서 컴파일된 에셋 및 경량 노드 모듈즈 복사
COPY package.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/public/preset_kiosk_data.json ./public/preset_kiosk_data.json
COPY server.js .

# 애플리케이션 포트 개방
EXPOSE 3000

# Express 서버 직송 엔진 기동
CMD ["node", "server.js"]
