type LeaderboardEntry = {
  rank: number;
  username: string;
  points: number;
  views: number;
  updates: number;
};

type NearbyVenue = {
  id?: string;
  name: string;
  address?: string;
};

const form = document.getElementById("contribution-form") as HTMLFormElement;
const usernameInput = document.getElementById("contrib-username") as HTMLInputElement;
const venueInput = document.getElementById("contrib-venue") as HTMLInputElement;
const nearbySelect = document.getElementById("contrib-gps-venues") as HTMLSelectElement;
const gpsButton = document.getElementById("btn-gps-refresh") as HTMLButtonElement;
const statusMessage = document.getElementById("contrib-status-msg") as HTMLElement;
const leaderboardBody = document.getElementById("leaderboard-tbody") as HTMLTableSectionElement;
const contributeTab = document.getElementById("tab-btn-contribute") as HTMLButtonElement;
const leaderboardTab = document.getElementById("tab-btn-leaderboard") as HTMLButtonElement;
const contributePane = document.getElementById("pane-contribute") as HTMLElement;
const leaderboardPane = document.getElementById("pane-leaderboard") as HTMLElement;

function setActiveTab(tab: "contribute" | "leaderboard") {
  const showContribute = tab === "contribute";
  contributeTab.classList.toggle("active", showContribute);
  leaderboardTab.classList.toggle("active", !showContribute);
  contributePane.classList.toggle("active", showContribute);
  leaderboardPane.classList.toggle("active", !showContribute);
  contributeTab.setAttribute("aria-selected", String(showContribute));
  leaderboardTab.setAttribute("aria-selected", String(!showContribute));
}

async function loadLeaderboard() {
  const response = await fetch("/api/leaderboard");
  const entries = await response.json() as LeaderboardEntry[];
  leaderboardBody.replaceChildren();

  entries.forEach((entry) => {
    const row = document.createElement("tr");
    [
      `${entry.rank}위`,
      entry.username,
      `${entry.points} pt`,
      `${entry.views} 회`,
      `${entry.updates} 회`
    ].forEach((value) => {
      const cell = document.createElement("td");
      cell.textContent = value;
      row.appendChild(cell);
    });
    leaderboardBody.appendChild(row);
  });
}

async function findNearbyVenues() {
  if (!navigator.geolocation) {
    statusMessage.textContent = "이 브라우저는 위치 검색을 지원하지 않습니다. 매장 이름을 직접 입력하세요.";
    return;
  }

  gpsButton.disabled = true;
  gpsButton.textContent = "검색 중";
  statusMessage.textContent = "현재 위치에서 가까운 음식점을 찾고 있습니다.";

  navigator.geolocation.getCurrentPosition(async ({ coords }) => {
    try {
      const response = await fetch("/api/venue-assist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gps: { lat: coords.latitude, lng: coords.longitude } })
      });
      const result = await response.json() as { venues?: NearbyVenue[] };
      const venues = result.venues ?? [];

      nearbySelect.replaceChildren(new Option(
        venues.length ? "주변 매장을 선택하세요" : "검색된 주변 매장이 없습니다",
        ""
      ));
      venues.forEach((venue) => {
        nearbySelect.add(new Option(
          venue.address ? `${venue.name} · ${venue.address}` : venue.name,
          venue.name
        ));
      });
      statusMessage.textContent = venues.length
        ? `${venues.length}개의 주변 매장을 찾았습니다.`
        : "주변 매장을 찾지 못했습니다. 매장 이름을 직접 입력하세요.";
    } catch {
      statusMessage.textContent = "주변 매장을 불러오지 못했습니다. 매장 이름을 직접 입력하세요.";
    } finally {
      gpsButton.disabled = false;
      gpsButton.textContent = "현재 위치로 다시 찾기";
    }
  }, () => {
    gpsButton.disabled = false;
    gpsButton.textContent = "현재 위치로 찾기";
    statusMessage.textContent = "위치를 가져올 수 없습니다. 위치 권한을 확인하거나 매장 이름을 직접 입력하세요.";
  });
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const username = usernameInput.value.trim();
  const venueName = venueInput.value.trim();
  if (!username || !venueName) return;

  const response = await fetch("/api/contribute", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, venueName })
  });

  if (!response.ok) {
    statusMessage.textContent = "기여 정보를 저장하지 못했습니다. 잠시 후 다시 시도하세요.";
    return;
  }

  const result = await response.json() as { data: { points: number } };
  statusMessage.textContent = `기여 성공. ${result.data.points}포인트가 누적되었습니다.`;
  form.reset();
  await loadLeaderboard();
});

nearbySelect.addEventListener("change", () => {
  if (nearbySelect.value) venueInput.value = nearbySelect.value;
});
gpsButton.addEventListener("click", findNearbyVenues);
contributeTab.addEventListener("click", () => setActiveTab("contribute"));
leaderboardTab.addEventListener("click", () => setActiveTab("leaderboard"));

void loadLeaderboard();
