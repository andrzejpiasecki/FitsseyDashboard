const state = {
  auth: null,
  isLoading: false,
  lastAutoRefreshAt: 0,
  allClientsSort: {
    key: "totalAmount",
    dir: "desc",
  },
  allClientsData: {
    clientsSummary: [],
    months: [],
  },
  charts: {
    revenue: null,
    mrr: null,
    unitEconomics: null,
    products: null,
    productMix: null,
    cohort: null,
    churn: null,
    retention: null,
    activeClients: null,
    ltvSegments: null,
    dailyRevenue: null,
  },
};

const barValueLabelsPlugin = {
  id: "barValueLabels",
  afterDatasetsDraw(chart, _args, pluginOptions) {
    if (!pluginOptions?.enabled || chart.config.type !== "bar") return;

    const isHorizontal = chart.options?.indexAxis === "y";
    if (isHorizontal) return;

    const { ctx } = chart;
    const formatter =
      typeof pluginOptions.formatter === "function"
        ? pluginOptions.formatter
        : (value) => String(Math.round(Number(value) || 0));

    ctx.save();
    ctx.font = pluginOptions.font || "700 11px Manrope";
    ctx.fillStyle = pluginOptions.color || "#344054";
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";

    for (let datasetIndex = 0; datasetIndex < chart.data.datasets.length; datasetIndex += 1) {
      const meta = chart.getDatasetMeta(datasetIndex);
      if (meta.hidden) continue;
      const dataset = chart.data.datasets[datasetIndex];
      const data = dataset.data || [];
      meta.data.forEach((bar, index) => {
        const rawValue = Number(data[index]);
        if (!Number.isFinite(rawValue)) return;
        const label = formatter(rawValue, datasetIndex, index, dataset);
        ctx.fillText(label, bar.x, bar.y - 6);
      });
    }

    ctx.restore();
  },
};

const AUTH_STORAGE_KEY = "reforma_fitssey_auth";

const FITSSEY_CONFIG = {
  baseUrlTemplate: "https://app.fitssey.com/{uuid}/api/v4/public",
  defaultStartDate: "2025-10-01",
  defaultStudioUuid: "Reformapilates",
  passActiveDays: 30,
  contactGraceDays: 14,
  contactMaxDaysSinceLastPass: 90,
};

const chartHelpContent = {
  revenue: {
    title: "Przychód miesięczny",
    text: "Pokazuje, ile łącznie wyniósł przychód w każdym miesiącu. Rosnący trend oznacza, że firma zwiększa sprzedaż miesiąc do miesiąca.",
  },
  mrr: {
    title: "MRR i trend miesięczny",
    text: "MRR to przychód powtarzalny z karnetów w danym miesiącu. Wzrost MRR zwykle oznacza stabilniejszy i bardziej przewidywalny biznes.",
  },
  unitEconomics: {
    title: "ARPU i średni koszyk",
    text: "ARPU to średni przychód na aktywnego klienta w miesiącu, a średni koszyk to średnia wartość pojedynczej transakcji. Razem pokazują, czy zarabiasz więcej dzięki liczbie klientów czy wyższej wartości zakupu.",
  },
  products: {
    title: "Sprzedaż wg produktu (TOP 8)",
    text: "Ranking najczęściej kupowanych produktów. Pomaga szybko wykryć bestsellery i produkty, które wymagają lepszej promocji.",
  },
  productMix: {
    title: "Udział produktów (TOP 6)",
    text: "Pokazuje strukturę sprzedaży: jaki procent wszystkich transakcji przypada na najważniejsze produkty. Dobra kontrola miksu zmniejsza ryzyko uzależnienia od jednego produktu.",
  },
  cohort: {
    title: "Nowi vs powracający klienci",
    text: "Porównuje liczbę nowych i powracających klientów w miesiącach. Większy udział powracających zwykle oznacza lepszą lojalność i skuteczniejszą retencję.",
  },
  churn: {
    title: "Trend churn",
    text: "Churn pokazuje, jaki odsetek klientów z poprzedniego miesiąca nie wrócił w kolejnym. Im niższa wartość, tym lepiej dla stabilności przychodów.",
  },
  retention: {
    title: "Retencja m/m",
    text: "Retencja to odwrotność churn: pokazuje, jaki procent klientów został z Tobą z miesiąca na miesiąc. Wysoka retencja to sygnał dobrego dopasowania oferty.",
  },
  activeClients: {
    title: "Aktywni klienci w czasie",
    text: "Pokazuje liczbę unikalnych klientów aktywnych w każdym miesiącu. Dzięki temu widzisz, czy baza klientów rośnie i czy sezonowość wpływa na frekwencję.",
  },
  ltv: {
    title: "LTV segmenty klientów",
    text: "LTV to łączna wartość zakupów klienta w całym okresie. Wykres dzieli klientów na segmenty wartości i pomaga skupić działania CRM na najbardziej rentownych grupach.",
  },
  dailyRevenue: {
    title: "Przychód dzienny",
    text: "Pokazuje przychód od 1. dnia aktualnego miesiąca oraz porównanie do odpowiadających dni z poprzedniego miesiąca na jednym wykresie.",
  },
};

document.addEventListener("DOMContentLoaded", () => {
  Chart.register(barValueLabelsPlugin);
  initHelpPopover();
  initAuth();
  initAutoRefreshOnFocus();
});

function initAuth() {
  const authForm = document.getElementById("authForm");
  const authModeInput = document.getElementById("authModeInput");
  const studioUuidInput = document.getElementById("studioUuidInput");
  const usernameInput = document.getElementById("usernameInput");
  const usernameField = document.getElementById("usernameField");
  const secretLabel = document.getElementById("secretLabel");
  const apiKeyInput = document.getElementById("apiKeyInput");
  const logoutBtn = document.getElementById("logoutBtn");

  const queryUuid = new URLSearchParams(window.location.search).get("studioUuid");
  const storedAuth = getStoredAuth();

  authModeInput.value = storedAuth?.method || "apiKey";
  studioUuidInput.value = (queryUuid || storedAuth?.studioUuid || FITSSEY_CONFIG.defaultStudioUuid || "").trim();
  usernameInput.value = storedAuth?.username || "";
  apiKeyInput.value = storedAuth?.secret || storedAuth?.apiKey || "";

  const updateModeUi = () => {
    const isBasic = authModeInput.value === "basic";
    usernameField.classList.toggle("hidden", !isBasic);
    secretLabel.textContent = isBasic ? "Hasło" : "API Key (Bearer)";
    apiKeyInput.placeholder = isBasic ? "hasło" : "live_...";
  };
  updateModeUi();
  authModeInput.addEventListener("change", updateModeUi);

  if ((storedAuth?.secret || storedAuth?.apiKey) && studioUuidInput.value) {
    state.auth = {
      studioUuid: studioUuidInput.value,
      method: storedAuth?.method || "apiKey",
      username: storedAuth?.username || "",
      secret: storedAuth?.secret || storedAuth?.apiKey || "",
    };
    loadDefaultData();
  } else {
    setStatus("Uzupełnij Studio UUID i API Key, aby pobrać dane z Fitssey API.", "info");
  }

  authForm.addEventListener("submit", (event) => {
    event.preventDefault();

    const method = authModeInput.value;
    const studioUuid = studioUuidInput.value.trim();
    const username = usernameInput.value.trim();
    const secret = apiKeyInput.value.trim();

    if (!studioUuid || !secret) {
      setStatus("Podaj Studio UUID i dane logowania.", "error");
      return;
    }
    if (method === "basic" && !username) {
      setStatus("Podaj użytkownika dla logowania hasłem.", "error");
      return;
    }

    state.auth = { studioUuid, method, username, secret };
    saveStoredAuth(state.auth);
    loadDefaultData();
  });

  logoutBtn.addEventListener("click", () => {
    clearStoredAuth();
    state.auth = null;
    apiKeyInput.value = "";
    destroyAllCharts();
    document.getElementById("dashboard").classList.add("hidden");
    setAuthCardVisible(true);
    setStatus("Wylogowano. Wprowadź nowy API Key, aby pobrać dane.", "info");
  });
}

async function loadDefaultData() {
  if (!state.auth?.secret || !state.auth?.studioUuid) {
    setStatus("Brak autoryzacji API. Uzupełnij dane logowania powyżej.", "error");
    return;
  }
  if (state.isLoading) return;

  state.isLoading = true;
  setLoading(true);
  try {
    setStatus("Ładowanie sprzedaży z API Fitssey...", "info");
    const apiRecords = await fetchSalesRecordsFromApi(state.auth);
    if (!apiRecords.length) {
      throw new Error("API zwróciło pustą listę sprzedaży.");
    }
    const analytics = buildAnalytics(apiRecords);
    renderDashboard(analytics);
    return;
  } catch (error) {
    setStatus(`Nie udało się pobrać danych z API Fitssey. ${error.message || "Sprawdź klucz API i studio UUID."}`, "error");
  } finally {
    state.isLoading = false;
    setLoading(false);
  }
}

function initAutoRefreshOnFocus() {
  const triggerRefresh = () => {
    if (!state.auth?.secret || !state.auth?.studioUuid) return;

    const now = Date.now();
    if (now - state.lastAutoRefreshAt < 8000) return;
    state.lastAutoRefreshAt = now;
    loadDefaultData();
  };

  window.addEventListener("focus", triggerRefresh);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      triggerRefresh();
    }
  });
}

function getStoredAuth() {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.studioUuid) return null;
    const secret = parsed?.secret || parsed?.apiKey;
    if (!secret) return null;
    return {
      method: String(parsed.method || "apiKey"),
      username: String(parsed.username || ""),
      secret: String(secret),
      studioUuid: String(parsed.studioUuid),
    };
  } catch {
    return null;
  }
}

function saveStoredAuth(auth) {
  localStorage.setItem(
    AUTH_STORAGE_KEY,
    JSON.stringify({
      studioUuid: auth.studioUuid,
      method: auth.method || "apiKey",
      username: auth.username || "",
      secret: auth.secret,
    })
  );
}

function clearStoredAuth() {
  localStorage.removeItem(AUTH_STORAGE_KEY);
}

function destroyAllCharts() {
  for (const chartKey of Object.keys(state.charts)) {
    if (state.charts[chartKey]) {
      state.charts[chartKey].destroy();
      state.charts[chartKey] = null;
    }
  }
}

async function fetchSalesRecordsFromApi(auth) {
  const studioUuid = auth?.studioUuid?.trim();
  const secret = auth?.secret?.trim();
  const method = auth?.method || "apiKey";
  if (!studioUuid) {
    throw new Error("Brak Studio UUID.");
  }
  if (!secret) {
    throw new Error("Brak danych autoryzacji.");
  }

  const endDate = new Date().toISOString().slice(0, 10);
  const baseUrl = FITSSEY_CONFIG.baseUrlTemplate.replace("{uuid}", encodeURIComponent(studioUuid));
  const headers = buildAuthHeaders(method, auth?.username || "", secret);

  const count = 200;
  const firstPage = await fetchSalesPage(baseUrl, FITSSEY_CONFIG.defaultStartDate, endDate, 1, count, headers);

  let rows = [];
  if (Array.isArray(firstPage)) {
    rows = firstPage;
  } else if (Array.isArray(firstPage.collection)) {
    rows = [...firstPage.collection];
    const pages = Number(firstPage.pages) || 1;
    for (let page = 2; page <= pages; page += 1) {
      const pagePayload = await fetchSalesPage(baseUrl, FITSSEY_CONFIG.defaultStartDate, endDate, page, count, headers);
      if (Array.isArray(pagePayload?.collection)) {
        rows.push(...pagePayload.collection);
      }
    }
  } else {
    throw new Error("Nieprawidłowy format odpowiedzi API.");
  }

  return rows
    .map(mapApiSalesRowToRecord)
    .filter((record) => record && Number.isFinite(record.amount) && record.amount >= 0)
    .sort((a, b) => a.date - b.date);
}

function buildAuthHeaders(method, username, secret) {
  const headers = { Accept: "application/json" };
  if (method === "basic") {
    const token = btoa(unescape(encodeURIComponent(`${username}:${secret}`)));
    headers.Authorization = `Basic ${token}`;
    return headers;
  }

  headers.Authorization = `Bearer ${secret}`;
  return headers;
}

async function fetchSalesPage(baseUrl, startDate, endDate, page, count, headers) {
  const url = `${baseUrl}/report/finance/sales?startDate=${startDate}&endDate=${endDate}&page=${page}&count=${count}`;
  const response = await fetch(url, {
    method: "GET",
    headers,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Błąd API ${response.status}: ${errorText.slice(0, 120)}`);
  }

  return response.json();
}

function mapApiSalesRowToRecord(row) {
  const date = new Date(row.saleDate);
  if (Number.isNaN(date.getTime())) return null;

  const itemTotalPrice = Number(row.itemTotalPrice);
  const itemPrice = Number(row.itemPrice);
  const amountMinor = Number.isFinite(itemTotalPrice) ? itemTotalPrice : itemPrice;
  const amount = Number.isFinite(amountMinor) ? amountMinor / 100 : 0;

  const product = safeText(row.itemName) || "Produkt";
  const clientName = safeText(row.userFullName) || "Nieznany klient";

  return {
    date,
    month: toMonthKey(date),
    clientName,
    clientKey: clientName.toLowerCase().trim(),
    product,
    amount,
    remainingEntries: extractRemainingEntries(row),
    isPass: /karnet|pass|pakiet/i.test(product),
  };
}

function extractRemainingEntries(row) {
  const candidates = [
    row.remainingEntries,
    row.availableEntries,
    row.activeEntries,
    row.entriesLeft,
    row.leftEntries,
    row?.item?.remainingEntries,
    row?.item?.availableEntries,
    row?.pass?.remainingEntries,
    row?.pass?.availableEntries,
    row?.passInstance?.remainingEntries,
    row?.passInstance?.availableEntries,
  ];

  for (const value of candidates) {
    const numeric = Number(value);
    if (Number.isFinite(numeric)) return numeric;
  }
  return null;
}

function initHelpPopover() {
  const popover = document.getElementById("helpPopover");
  const title = document.getElementById("helpTitle");
  const text = document.getElementById("helpText");
  const closeBtn = document.getElementById("helpCloseBtn");
  const helpButtons = document.querySelectorAll(".help-btn");

  const hasNativePopover = typeof popover.showPopover === "function";

  const isOpen = () => {
    if (hasNativePopover) return popover.matches(":popover-open");
    return !popover.classList.contains("hidden");
  };

  const closePopover = () => {
    if (hasNativePopover) {
      if (popover.matches(":popover-open")) popover.hidePopover();
      return;
    }
    popover.classList.add("hidden");
  };

  const openPopover = (key, button) => {
    const content = chartHelpContent[key];
    if (!content) return;

    title.textContent = content.title;
    text.textContent = content.text;

    const rect = button.getBoundingClientRect();
    const maxLeft = Math.max(8, window.innerWidth - 440);
    const left = Math.max(8, Math.min(rect.left - 190 + rect.width / 2, maxLeft));
    const top = Math.min(window.innerHeight - 180, rect.bottom + 10);
    popover.style.left = `${left}px`;
    popover.style.top = `${top}px`;

    if (hasNativePopover) {
      if (popover.matches(":popover-open")) popover.hidePopover();
      popover.showPopover();
      return;
    }
    popover.classList.remove("hidden");
  };

  for (const button of helpButtons) {
    button.addEventListener("click", () => openPopover(button.dataset.helpKey, button));
  }

  closeBtn.addEventListener("click", closePopover);
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closePopover();
  });

  const closeOnViewportMove = () => {
    if (isOpen()) closePopover();
  };

  window.addEventListener("resize", closeOnViewportMove, { passive: true });
  document.addEventListener("scroll", closeOnViewportMove, { passive: true, capture: true });
  window.addEventListener("wheel", closeOnViewportMove, { passive: true });
  window.addEventListener("touchmove", closeOnViewportMove, { passive: true });
}

function buildAnalytics(records) {
  const months = [...new Set(records.map((r) => r.month))].sort();
  const latestMonth = months[months.length - 1];
  const previousMonth = months.length > 1 ? months[months.length - 2] : null;

  const revenueByMonth = createMonthlyObject(months, 0);
  const passRevenueByMonth = createMonthlyObject(months, 0);
  const salesByMonth = createMonthlyObject(months, 0);
  const uniqueClientsByMonth = {};
  const productCount = {};
  const newClientsByMonth = createMonthlyObject(months, 0);
  const returningClientsByMonth = createMonthlyObject(months, 0);

  const clientFirstMonth = {};
  const clientStats = {};
  for (const row of records) {
    if (!clientFirstMonth[row.clientKey]) clientFirstMonth[row.clientKey] = row.month;
  }

  for (const month of months) uniqueClientsByMonth[month] = new Set();

  for (const row of records) {
    revenueByMonth[row.month] += row.amount;
    salesByMonth[row.month] += 1;
    if (row.isPass) passRevenueByMonth[row.month] += row.amount;
    productCount[row.product] = (productCount[row.product] || 0) + 1;
    uniqueClientsByMonth[row.month].add(row.clientKey);

    if (!clientStats[row.clientKey]) {
      clientStats[row.clientKey] = {
        name: row.clientName,
        lifetimeRevenue: 0,
        lastPurchaseDate: row.date,
        lastPassPurchaseDate: null,
        lastKnownRemainingEntries: null,
        passPurchaseDates: [],
        purchaseMonths: new Set(),
        passMonths: new Set(),
      };
    }

    const stat = clientStats[row.clientKey];
    stat.lifetimeRevenue += row.amount;
    if (row.date > stat.lastPurchaseDate) {
      stat.lastPurchaseDate = row.date;
      stat.name = row.clientName;
    }
    stat.purchaseMonths.add(row.month);
    if (row.isPass) {
      stat.passMonths.add(row.month);
      stat.passPurchaseDates.push(row.date);
      if (!stat.lastPassPurchaseDate || row.date > stat.lastPassPurchaseDate) {
        stat.lastPassPurchaseDate = row.date;
      }
      if (Number.isFinite(row.remainingEntries)) {
        stat.lastKnownRemainingEntries = row.remainingEntries;
      }
    }
  }

  for (const month of months) {
    for (const clientKey of uniqueClientsByMonth[month]) {
      if (clientFirstMonth[clientKey] === month) {
        newClientsByMonth[month] += 1;
      } else {
        returningClientsByMonth[month] += 1;
      }
    }
  }

  const arpuByMonth = createMonthlyObject(months, 0);
  const avgTicketByMonth = createMonthlyObject(months, 0);
  const retentionByMonth = createMonthlyObject(months, 0);
  const churnByMonth = createMonthlyObject(months, 0);

  for (let i = 0; i < months.length; i += 1) {
    const month = months[i];
    const active = uniqueClientsByMonth[month].size;
    arpuByMonth[month] = active ? revenueByMonth[month] / active : 0;
    avgTicketByMonth[month] = salesByMonth[month] ? revenueByMonth[month] / salesByMonth[month] : 0;

    if (i > 0) {
      const prev = uniqueClientsByMonth[months[i - 1]];
      const curr = uniqueClientsByMonth[month];
      const retained = [...prev].filter((clientId) => curr.has(clientId)).length;
      retentionByMonth[month] = prev.size ? (retained / prev.size) * 100 : 0;
      churnByMonth[month] = prev.size ? ((prev.size - retained) / prev.size) * 100 : 0;
    }
  }

  const mrrByMonth = { ...passRevenueByMonth };
  const totalRevenue = records.reduce((sum, row) => sum + row.amount, 0);
  const totalSales = records.length;
  const passSales = records.filter((row) => row.isPass).length;

  const latestRevenue = revenueByMonth[latestMonth] || 0;
  const previousRevenue = previousMonth ? revenueByMonth[previousMonth] || 0 : 0;
  const comparableRevenue = buildComparableMonthToDateRevenue(records);
  const latestMrr = mrrByMonth[latestMonth] || 0;
  const latestActive = uniqueClientsByMonth[latestMonth]?.size || 0;
  const activeClientsByMonth = createMonthlyObject(months, 0);
  for (const month of months) {
    activeClientsByMonth[month] = uniqueClientsByMonth[month].size;
  }
  const latestChurn = churnByMonth[latestMonth] || 0;
  const latestArpu = arpuByMonth[latestMonth] || 0;
  const avgTicket = totalSales ? totalRevenue / totalSales : 0;
  const passShare = totalSales ? (passSales / totalSales) * 100 : 0;

  const contacts = [];
  const expiringPasses = [];
  const hasExplicitEntriesData = Object.values(clientStats).some(
    (client) => Number.isFinite(client.lastKnownRemainingEntries)
  );
  for (const client of Object.values(clientStats)) {
    if (client.lastPassPurchaseDate) {
      const daysSinceLastPass = Math.max(0, Math.floor((Date.now() - client.lastPassPurchaseDate.getTime()) / 86400000));
      const expectedCycleDays = estimatePassCycleDays(client.passPurchaseDates);
      const hasPassLatest = latestMonth ? client.passMonths.has(latestMonth) : false;

      if (hasExplicitEntriesData) {
        if (Number.isFinite(client.lastKnownRemainingEntries) && client.lastKnownRemainingEntries === 1) {
          expiringPasses.push({
            name: client.name,
            lastPassPurchaseDate: client.lastPassPurchaseDate,
            activeEntries: client.lastKnownRemainingEntries,
            lifetimeRevenue: client.lifetimeRevenue,
          });
        }
      } else {
        const nearCycleEnd = daysSinceLastPass >= expectedCycleDays - 5 && daysSinceLastPass <= expectedCycleDays + 7;
        if (nearCycleEnd && !hasPassLatest) {
          expiringPasses.push({
            name: client.name,
            lastPassPurchaseDate: client.lastPassPurchaseDate,
            activeEntries: 1,
            lifetimeRevenue: client.lifetimeRevenue,
          });
        }
      }
    }

    if (!client.lastPassPurchaseDate) continue;

    const hasPassLatest = latestMonth ? client.passMonths.has(latestMonth) : false;
    if (hasPassLatest) continue;

    const daysSinceLastPass = Math.max(0, Math.floor((Date.now() - client.lastPassPurchaseDate.getTime()) / 86400000));
    if (daysSinceLastPass < FITSSEY_CONFIG.contactGraceDays) continue;
    if (daysSinceLastPass > FITSSEY_CONFIG.contactMaxDaysSinceLastPass) continue;

    const hasActiveEntries =
      Number.isFinite(client.lastKnownRemainingEntries) && client.lastKnownRemainingEntries > 0;
    if (hasActiveEntries && daysSinceLastPass < 45) continue;

    const expectedCycleDays = estimatePassCycleDays(client.passPurchaseDates);
    const daysOverdue = daysSinceLastPass - expectedCycleDays;
    const hadPassPrev = previousMonth ? client.passMonths.has(previousMonth) : false;
    const hasPurchaseLatest = latestMonth ? client.purchaseMonths.has(latestMonth) : false;
    const score = calculateContactScore({
      daysSinceLastPass,
      daysOverdue,
      expectedCycleDays,
      lifetimeRevenue: client.lifetimeRevenue,
      hadPassPrev,
      hasPurchaseLatest,
      passCount: client.passPurchaseDates.length,
    });

    if (score < 10 && daysOverdue < 5 && !hadPassPrev) continue;

      contacts.push({
        name: client.name,
        lastPurchaseDate: client.lastPassPurchaseDate,
        daysSince: daysSinceLastPass,
        daysSinceLastPass,
        activeEntries: Number.isFinite(client.lastKnownRemainingEntries) ? client.lastKnownRemainingEntries : null,
        lifetimeRevenue: client.lifetimeRevenue,
        expectedCycleDays,
        score,
        priority: getPriority(score),
      });
  }

  contacts.sort((a, b) => b.score - a.score || b.daysSince - a.daysSince || b.lifetimeRevenue - a.lifetimeRevenue);
  expiringPasses.sort(
    (a, b) =>
      (b.lastPassPurchaseDate?.getTime() || 0) - (a.lastPassPurchaseDate?.getTime() || 0) ||
      b.lifetimeRevenue - a.lifetimeRevenue
  );

  const clientsSummary = buildClientsSummary(records, months);
  const dailyRevenue = buildDailyRevenueSeries(records);
  const newClientSales = [];
  const returningClientSales = [];
  const sortedRecordsByDate = [...records].sort((a, b) => b.date.getTime() - a.date.getTime());
  for (const row of sortedRecordsByDate) {
    const sale = {
      date: row.date,
      clientName: row.clientName,
      product: row.product,
      amount: row.amount,
    };
    if (clientFirstMonth[row.clientKey] === row.month) {
      if (newClientSales.length < 50) newClientSales.push(sale);
    } else if (returningClientSales.length < 50) {
      returningClientSales.push(sale);
    }
    if (newClientSales.length >= 50 && returningClientSales.length >= 50) break;
  }

  const ltvSegments = { "0-500": 0, "500-1000": 0, "1000-2000": 0, "2000+": 0 };
  for (const client of Object.values(clientStats)) {
    const ltv = client.lifetimeRevenue;
    if (ltv < 500) ltvSegments["0-500"] += 1;
    else if (ltv < 1000) ltvSegments["500-1000"] += 1;
    else if (ltv < 2000) ltvSegments["1000-2000"] += 1;
    else ltvSegments["2000+"] += 1;
  }

  return {
    months,
    totalRevenue,
    totalSales,
    latestActive,
    latestRevenue,
    previousRevenue,
    revenueMoMChange: comparableRevenue.revenueMoMChange,
    currentPeriodRevenue: comparableRevenue.currentPeriodRevenue,
    previousPeriodRevenue: comparableRevenue.previousPeriodRevenue,
    previousFullMonthRevenue: comparableRevenue.previousFullMonthRevenue,
    currentPeriodStart: comparableRevenue.currentPeriodStart,
    currentPeriodEnd: comparableRevenue.currentPeriodEnd,
    previousPeriodStart: comparableRevenue.previousPeriodStart,
    previousPeriodEnd: comparableRevenue.previousPeriodEnd,
    previousFullMonthStart: comparableRevenue.previousFullMonthStart,
    previousFullMonthEnd: comparableRevenue.previousFullMonthEnd,
    latestMonth,
    previousMonth,
    latestChurn,
    latestMrr,
    latestArpu,
    avgTicket,
    passShare,
    revenueByMonth,
    mrrByMonth,
    arpuByMonth,
    avgTicketByMonth,
    productCount,
    newClientsByMonth,
    returningClientsByMonth,
    churnByMonth,
    retentionByMonth,
    activeClientsByMonth,
    ltvSegments,
    dailyRevenueLabels: dailyRevenue.labels,
    dailyRevenueValues: dailyRevenue.values,
    dailyRevenuePreviousValues: dailyRevenue.previousValues,
    newClientSales,
    returningClientSales,
    contacts,
    expiringPasses,
    clientsSummary,
  };
}

function renderDashboard(analytics) {
  document.getElementById("dashboard").classList.remove("hidden");
  document.getElementById("status").classList.add("hidden");
  setAuthCardVisible(false);
  renderRevenueSummary(analytics);

  renderRevenueChart(analytics.months, analytics.revenueByMonth);
  renderMrrChart(analytics.months, analytics.mrrByMonth);
  renderProductsChart(analytics.productCount);
  renderCohortChart(analytics.months, analytics.newClientsByMonth, analytics.returningClientsByMonth);
  renderDailyRevenueChart(
    analytics.dailyRevenueLabels,
    analytics.dailyRevenueValues,
    analytics.dailyRevenuePreviousValues
  );
  renderClientSegmentSalesTables(analytics.newClientSales, analytics.returningClientSales);
  renderContactsTable(analytics.contacts);
  renderExpiringPassTable(analytics.expiringPasses);
  state.allClientsData = {
    clientsSummary: analytics.clientsSummary,
    months: analytics.months,
  };
  renderAllClientsTable(analytics.clientsSummary, analytics.months);
}

function renderRevenueSummary(analytics) {
  const currentValue = document.getElementById("currentMonthRevenueValue");
  const previousValue = document.getElementById("previousMonthRevenueValue");
  const previousComparableValue = document.getElementById("previousComparableRevenueValue");
  const currentLabel = document.getElementById("currentMonthRevenueLabel");
  const previousLabel = document.getElementById("previousMonthRevenueLabel");
  const previousComparableLabel = document.getElementById("previousComparableRevenueLabel");
  const changeValue = document.getElementById("revenueMoMValue");
  const changeLabel = document.getElementById("revenueMoMLabel");

  currentValue.textContent = formatCurrency(analytics.currentPeriodRevenue);
  previousValue.textContent = formatCurrency(analytics.previousFullMonthRevenue);
  previousComparableValue.textContent = formatCurrency(analytics.previousPeriodRevenue);
  currentLabel.textContent = `${formatDateShort(analytics.currentPeriodStart)} - ${formatDateShort(analytics.currentPeriodEnd)}`;
  previousLabel.textContent = `${formatDateShort(analytics.previousFullMonthStart)} - ${formatDateShort(analytics.previousFullMonthEnd)}`;
  previousComparableLabel.textContent = `${formatDateShort(analytics.previousPeriodStart)} - ${formatDateShort(analytics.previousPeriodEnd)}`;

  changeValue.classList.remove("revenue-summary-trend-up", "revenue-summary-trend-down", "revenue-summary-trend-flat");
  if (analytics.revenueMoMChange == null) {
    changeValue.textContent = "—";
    changeValue.classList.add("revenue-summary-trend-flat");
    changeLabel.textContent = "Brak porównania m/m";
    return;
  }

  const isUp = analytics.revenueMoMChange > 0;
  const isDown = analytics.revenueMoMChange < 0;
  const arrow = isUp ? "▲" : isDown ? "▼" : "→";
  changeValue.textContent = `${arrow} ${Math.abs(analytics.revenueMoMChange).toFixed(1)}%`;
  changeValue.classList.add(
    isUp ? "revenue-summary-trend-up" : isDown ? "revenue-summary-trend-down" : "revenue-summary-trend-flat"
  );
  changeLabel.textContent = "vs poprzedni miesiąc";
}

function buildComparableMonthToDateRevenue(records) {
  const now = new Date();
  const currentPeriodStart = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
  const currentPeriodEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

  const previousMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const previousPeriodStart = new Date(previousMonthDate.getFullYear(), previousMonthDate.getMonth(), 1, 0, 0, 0, 0);
  const previousMonthLastDay = new Date(previousMonthDate.getFullYear(), previousMonthDate.getMonth() + 1, 0).getDate();
  const comparableDay = Math.min(now.getDate(), previousMonthLastDay);
  const previousPeriodEnd = new Date(
    previousMonthDate.getFullYear(),
    previousMonthDate.getMonth(),
    comparableDay,
    23,
    59,
    59,
    999
  );
  const previousFullMonthEnd = new Date(
    previousMonthDate.getFullYear(),
    previousMonthDate.getMonth() + 1,
    0,
    23,
    59,
    59,
    999
  );

  const currentPeriodRevenue = sumRevenueInRange(records, currentPeriodStart, currentPeriodEnd);
  const previousPeriodRevenue = sumRevenueInRange(records, previousPeriodStart, previousPeriodEnd);
  const previousFullMonthRevenue = sumRevenueInRange(records, previousPeriodStart, previousFullMonthEnd);
  const revenueMoMChange =
    previousPeriodRevenue > 0 ? ((currentPeriodRevenue - previousPeriodRevenue) / previousPeriodRevenue) * 100 : null;

  return {
    currentPeriodRevenue,
    previousPeriodRevenue,
    previousFullMonthRevenue,
    revenueMoMChange,
    currentPeriodStart,
    currentPeriodEnd,
    previousPeriodStart,
    previousPeriodEnd,
    previousFullMonthStart: previousPeriodStart,
    previousFullMonthEnd,
  };
}

function sumRevenueInRange(records, startDate, endDate) {
  let total = 0;
  for (const row of records) {
    const time = row.date.getTime();
    if (time >= startDate.getTime() && time <= endDate.getTime()) {
      total += row.amount;
    }
  }
  return total;
}

function setAuthCardVisible(isVisible) {
  const authCard = document.getElementById("authCard");
  if (!authCard) return;
  authCard.classList.toggle("hidden", !isVisible);
}

function renderRevenueChart(months, series) {
  state.charts.revenue = replaceChart(state.charts.revenue, "revenueChart", {
    type: "bar",
    data: {
      labels: months,
      datasets: [
        {
          label: "Przychód",
          data: months.map((m) => series[m]),
          backgroundColor: "rgba(99, 91, 255, 0.75)",
          borderRadius: 6,
        },
      ],
    },
    options: chartOptionsCurrency(),
  });
}

function renderMrrChart(months, series) {
  state.charts.mrr = replaceChart(state.charts.mrr, "mrrChart", {
    type: "bar",
    data: {
      labels: months,
      datasets: [
        {
          label: "MRR",
          data: months.map((m) => series[m]),
          backgroundColor: "rgba(14, 165, 233, 0.75)",
          borderRadius: 6,
        },
      ],
    },
    options: chartOptionsCurrency(),
  });
}

function renderUnitEconomicsChart(months, arpuByMonth, ticketByMonth) {
  state.charts.unitEconomics = replaceChart(state.charts.unitEconomics, "unitEconomicsChart", {
    type: "line",
    data: {
      labels: months,
      datasets: [
        {
          label: "ARPU",
          data: months.map((m) => arpuByMonth[m]),
          borderColor: "#0ea5e9",
          tension: 0.25,
        },
        {
          label: "Średni koszyk",
          data: months.map((m) => ticketByMonth[m]),
          borderColor: "#10b981",
          tension: 0.25,
        },
      ],
    },
    options: chartOptionsCurrency(),
  });
}

function renderProductsChart(productCount) {
  const topProducts = Object.entries(productCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);

  state.charts.products = replaceChart(state.charts.products, "productsChart", {
    type: "bar",
    data: {
      labels: topProducts.map((p) => trimText(p[0], 26)),
      datasets: [
        {
          label: "Liczba sprzedaży",
          data: topProducts.map((p) => p[1]),
          backgroundColor: "#635bff",
          borderRadius: 6,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      indexAxis: "y",
      scales: { x: { beginAtZero: true } },
      plugins: { legend: { display: false } },
    },
  });
}

function renderProductMixChart(productCount) {
  const top = Object.entries(productCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);

  state.charts.productMix = replaceChart(state.charts.productMix, "productMixChart", {
    type: "doughnut",
    data: {
      labels: top.map((p) => trimText(p[0], 22)),
      datasets: [
        {
          data: top.map((p) => p[1]),
          backgroundColor: ["#635bff", "#0ea5e9", "#10b981", "#f59e0b", "#f97316", "#ef4444"],
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: "bottom" },
      },
    },
  });
}

function renderCohortChart(months, newSeries, returningSeries) {
  state.charts.cohort = replaceChart(state.charts.cohort, "cohortChart", {
    type: "bar",
    data: {
      labels: months,
      datasets: [
        {
          label: "Nowi",
          data: months.map((m) => newSeries[m] || 0),
          backgroundColor: "#0ea5e9",
        },
        {
          label: "Powracający",
          data: months.map((m) => returningSeries[m] || 0),
          backgroundColor: "#22c55e",
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: { stacked: true },
        y: { stacked: true, beginAtZero: true },
      },
    },
  });
}

function renderChurnChart(months, churnByMonth) {
  const churnMonths = months.slice(1);
  state.charts.churn = replaceChart(state.charts.churn, "churnChart", {
    type: "line",
    data: {
      labels: churnMonths,
      datasets: [
        {
          label: "Churn",
          data: churnMonths.map((m) => churnByMonth[m] || 0),
          borderColor: "#ef4444",
          backgroundColor: "rgba(239, 68, 68, 0.15)",
          fill: true,
          tension: 0.25,
        },
      ],
    },
    options: percentChartOptions(),
  });
}

function renderRetentionChart(months, retentionByMonth) {
  const retentionMonths = months.slice(1);
  state.charts.retention = replaceChart(state.charts.retention, "retentionChart", {
    type: "line",
    data: {
      labels: retentionMonths,
      datasets: [
        {
          label: "Retencja",
          data: retentionMonths.map((m) => retentionByMonth[m] || 0),
          borderColor: "#10b981",
          backgroundColor: "rgba(16, 185, 129, 0.14)",
          fill: true,
          tension: 0.25,
        },
      ],
    },
    options: percentChartOptions(),
  });
}

function renderActiveClientsChart(months, activeClientsByMonth) {
  state.charts.activeClients = replaceChart(state.charts.activeClients, "activeClientsChart", {
    type: "line",
    data: {
      labels: months,
      datasets: [
        {
          label: "Aktywni klienci",
          data: months.map((m) => activeClientsByMonth[m] || 0),
          borderColor: "#6366f1",
          backgroundColor: "rgba(99, 102, 241, 0.14)",
          fill: true,
          tension: 0.25,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: "nearest",
        intersect: false,
        axis: "x",
      },
      hover: {
        mode: "nearest",
        intersect: false,
        axis: "x",
      },
      onHover(event, _active, chart) {
        const activeElements = chart.getElementsAtEventForMode(
          event,
          "index",
          { axis: "x", intersect: false },
          false
        );
        chart.setActiveElements(activeElements);
        chart.tooltip.setActiveElements(activeElements, {
          x: event.x,
          y: event.y,
        });
        chart.update("none");
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            precision: 0,
          },
        },
      },
    },
  });
}

function renderLtvSegmentsChart(segments) {
  state.charts.ltvSegments = replaceChart(state.charts.ltvSegments, "ltvSegmentsChart", {
    type: "bar",
    data: {
      labels: Object.keys(segments),
      datasets: [
        {
          label: "Liczba klientów",
          data: Object.values(segments),
          backgroundColor: ["#c4b5fd", "#93c5fd", "#67e8f9", "#34d399"],
          borderRadius: 6,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: { y: { beginAtZero: true } },
      plugins: { legend: { display: false } },
    },
  });
}

function renderDailyRevenueChart(labels, values, previousValues) {
  state.charts.dailyRevenue = replaceChart(state.charts.dailyRevenue, "dailyRevenueChart", {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          label: "Sprzedaż dnia",
          data: values,
          backgroundColor: "rgba(139, 92, 246, 0.7)",
          borderRadius: 4,
        },
        {
          label: "Ten sam dzień poprzedniego miesiąca",
          data: previousValues,
          backgroundColor: "rgba(14, 165, 233, 0.6)",
          borderRadius: 4,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            callback(value) {
              return formatCurrency(value);
            },
          },
        },
        x: {
          ticks: {
            maxTicksLimit: 10,
          },
        },
      },
      plugins: {
        tooltip: {
          mode: "index",
          intersect: false,
          callbacks: {
            label(context) {
              return `${context.dataset.label}: ${formatCurrency(context.raw)}`;
            },
          },
        },
      },
    },
  });
}

function renderClientSegmentSalesTables(newClientSales, returningClientSales) {
  renderSalesTable(
    "newClientSalesTableBody",
    newClientSales,
    "Brak danych o zakupach nowych klientów."
  );
  renderSalesTable(
    "returningClientSalesTableBody",
    returningClientSales,
    "Brak danych o zakupach powracających klientów."
  );
}

function renderSalesTable(tableBodyId, sales, emptyMessage) {
  const tbody = document.getElementById(tableBodyId);
  tbody.innerHTML = "";

  if (!sales.length) {
    const row = document.createElement("tr");
    row.innerHTML = `<td data-label="Status" colspan="4">${emptyMessage}</td>`;
    tbody.appendChild(row);
    return;
  }

  for (const sale of sales) {
    const row = document.createElement("tr");
    const dateLabel = new Intl.DateTimeFormat("pl-PL", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(sale.date);

    row.innerHTML = `
      <td data-label="Data">${dateLabel}</td>
      <td data-label="Klient">${escapeHtml(sale.clientName)}</td>
      <td data-label="Produkt">${escapeHtml(sale.product)}</td>
      <td data-label="Kwota">${formatCurrency(sale.amount)}</td>
    `;
    tbody.appendChild(row);
  }
}

function renderContactsTable(contacts) {
  const tbody = document.getElementById("contactTableBody");
  tbody.innerHTML = "";

  if (!contacts.length) {
    const row = document.createElement("tr");
    row.innerHTML = "<td data-label=\"Status\">Brak klientów do kontaktu dla ostatniego miesiąca.</td>";
    tbody.appendChild(row);
    return;
  }

  for (const contact of contacts.slice(0, 30)) {
    const row = document.createElement("tr");
    const dateLabel = new Intl.DateTimeFormat("pl-PL").format(contact.lastPurchaseDate);
    const badgeClass = `recommend recommend-${priorityClass(contact.priority)}`;
    row.innerHTML = `
      <td data-label="Klient">${escapeHtml(contact.name)}</td>
      <td data-label="Ostatni zakup">${dateLabel}</td>
      <td data-label="Dni bez zakupu">${contact.daysSince}</td>
      <td data-label="Aktywne wejścia">${contact.activeEntries == null ? "-" : contact.activeEntries}</td>
      <td data-label="LTV">${formatCurrency(contact.lifetimeRevenue)}</td>
      <td data-label="Rekomendacja"><span class="${badgeClass}">${contact.priority}</span></td>
    `;
    tbody.appendChild(row);
  }
}

function renderExpiringPassTable(clients) {
  const tbody = document.getElementById("expiringPassTableBody");
  tbody.innerHTML = "";

  if (!clients.length) {
    const row = document.createElement("tr");
    row.innerHTML = "<td data-label=\"Status\" colspan=\"4\">Brak klientów z 1 aktywnym wejściem.</td>";
    tbody.appendChild(row);
    return;
  }

  for (const client of clients.slice(0, 30)) {
    const row = document.createElement("tr");
    const dateLabel = client.lastPassPurchaseDate
      ? new Intl.DateTimeFormat("pl-PL").format(client.lastPassPurchaseDate)
      : "-";

    row.innerHTML = `
      <td data-label="Klient">${escapeHtml(client.name)}</td>
      <td data-label="Ostatni zakup karnetu">${dateLabel}</td>
      <td data-label="Aktywne wejścia">${client.activeEntries}</td>
      <td data-label="LTV">${formatCurrency(client.lifetimeRevenue)}</td>
    `;
    tbody.appendChild(row);
  }
}

function renderAllClientsTable(clientsSummary, months) {
  const displayedMonths = months.slice(-3);
  const headRow = document.getElementById("allClientsHeadRow");
  const tbody = document.getElementById("allClientsTableBody");
  headRow.innerHTML = "";
  tbody.innerHTML = "";

  const baseHeaders = [
    { title: "Imię i nazwisko", sortKey: "name" },
    { title: "Ilość zakupów", sortKey: "purchaseCount" },
    { title: "Suma zakupów", sortKey: "totalAmount" },
  ];
  for (const header of baseHeaders) {
    const th = document.createElement("th");
    th.textContent = renderSortHeaderLabel(header.title, header.sortKey);
    th.style.cursor = "pointer";
    th.addEventListener("click", () => {
      updateAllClientsSort(header.sortKey);
      const data = state.allClientsData;
      renderAllClientsTable(data.clientsSummary, data.months);
    });
    headRow.appendChild(th);
  }
  for (const month of displayedMonths) {
    const th = document.createElement("th");
    th.textContent = formatMonthKey(month);
    headRow.appendChild(th);
  }

  if (!clientsSummary.length) {
    const row = document.createElement("tr");
    row.innerHTML = `<td data-label="Status" colspan="${3 + displayedMonths.length}">Brak danych o klientach.</td>`;
    tbody.appendChild(row);
    return;
  }

  const sortedClients = sortClientsSummary(clientsSummary);
  for (const client of sortedClients) {
    const row = document.createElement("tr");
    const cells = [
      `<td data-label="Imię i nazwisko">${escapeHtml(client.name)}</td>`,
      `<td data-label="Ilość zakupów">${client.purchaseCount}</td>`,
      `<td data-label="Suma zakupów">${formatCurrency(client.totalAmount)}</td>`,
    ];
    for (const month of displayedMonths) {
      const monthData = client.purchasesByMonth[month];
      if (!monthData || monthData.count === 0) {
        cells.push(`<td data-label="${formatMonthKey(month)}" class="month-value">-</td>`);
      } else {
        cells.push(
          `<td data-label="${formatMonthKey(month)}" class="month-value" title="${escapeHtml(monthData.details)}">${monthData.count}</td>`
        );
      }
    }
    row.innerHTML = cells.join("");
    tbody.appendChild(row);
  }
}

function renderSortHeaderLabel(title, sortKey) {
  if (state.allClientsSort.key !== sortKey) return title;
  return `${title} ${state.allClientsSort.dir === "asc" ? "↑" : "↓"}`;
}

function updateAllClientsSort(sortKey) {
  if (state.allClientsSort.key === sortKey) {
    state.allClientsSort.dir = state.allClientsSort.dir === "asc" ? "desc" : "asc";
    return;
  }
  state.allClientsSort.key = sortKey;
  state.allClientsSort.dir = sortKey === "name" ? "asc" : "desc";
}

function sortClientsSummary(clientsSummary) {
  const direction = state.allClientsSort.dir === "asc" ? 1 : -1;
  const sortKey = state.allClientsSort.key;
  const sorted = [...clientsSummary];

  sorted.sort((a, b) => {
    if (sortKey === "name") {
      return a.name.localeCompare(b.name, "pl") * direction;
    }
    const aValue = Number(a[sortKey]) || 0;
    const bValue = Number(b[sortKey]) || 0;
    if (aValue !== bValue) return (aValue - bValue) * direction;
    return a.name.localeCompare(b.name, "pl");
  });

  return sorted;
}

function buildClientsSummary(records, months) {
  const byClient = new Map();

  for (const row of records) {
    if (!byClient.has(row.clientKey)) {
      byClient.set(row.clientKey, {
        name: row.clientName,
        purchaseCount: 0,
        totalAmount: 0,
        months: new Map(),
      });
    }

    const client = byClient.get(row.clientKey);
    client.purchaseCount += 1;
    client.totalAmount += row.amount;

    if (!client.months.has(row.month)) {
      client.months.set(row.month, []);
    }
    client.months.get(row.month).push(row.product);
  }

  const summary = [];
  for (const client of byClient.values()) {
    const purchasesByMonth = {};
    for (const month of months) {
      const productsList = client.months.get(month);
      if (!productsList || !productsList.length) {
        purchasesByMonth[month] = { count: 0, details: "" };
      } else {
        purchasesByMonth[month] = {
          count: productsList.length,
          details: summarizeProducts(productsList),
        };
      }
    }

    summary.push({
      name: client.name,
      purchaseCount: client.purchaseCount,
      totalAmount: client.totalAmount,
      purchasesByMonth,
    });
  }

  return summary.sort(
    (a, b) =>
      b.purchaseCount - a.purchaseCount ||
      b.totalAmount - a.totalAmount ||
      a.name.localeCompare(b.name, "pl")
  );
}

function buildDailyRevenueSeries(records) {
  if (!records.length) {
    return { labels: [], values: [], previousValues: [] };
  }

  const byDay = new Map();
  for (const row of records) {
    const dayKey = toDayKey(row.date);
    byDay.set(dayKey, (byDay.get(dayKey) || 0) + row.amount);
  }

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();
  const previousMonthDate = new Date(currentYear, currentMonth - 1, 1);
  const previousYear = previousMonthDate.getFullYear();
  const previousMonth = previousMonthDate.getMonth();

  const currentMonthLastDay = new Date(currentYear, currentMonth + 1, 0).getDate();
  const previousMonthLastDay = new Date(previousYear, previousMonth + 1, 0).getDate();

  const labels = [];
  const values = [];
  const previousValues = [];
  for (let day = 1; day <= 31; day += 1) {
    labels.push(String(day));

    if (day <= currentMonthLastDay) {
      const currentKey = toDayKeyFromParts(currentYear, currentMonth, day);
      values.push(byDay.get(currentKey) || 0);
    } else {
      values.push(0);
    }

    if (day <= previousMonthLastDay) {
      const previousKey = toDayKeyFromParts(previousYear, previousMonth, day);
      previousValues.push(byDay.get(previousKey) || 0);
    } else {
      previousValues.push(0);
    }
  }

  return { labels, values, previousValues };
}

function toDayKeyFromParts(year, zeroBasedMonth, day) {
  return `${year}-${String(zeroBasedMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function summarizeProducts(products) {
  if (!products.length) return "-";
  const counter = new Map();
  for (const product of products) {
    counter.set(product, (counter.get(product) || 0) + 1);
  }
  return [...counter.entries()]
    .map(([name, count]) => (count > 1 ? `${name} x${count}` : name))
    .join(", ");
}

function formatMonthKey(monthKey) {
  const [year, month] = monthKey.split("-");
  return `${month}/${year}`;
}

function toMonthKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function toDayKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function safeText(value) {
  return String(value || "").trim();
}

function createMonthlyObject(months, initialValue) {
  const obj = {};
  for (const month of months) obj[month] = initialValue;
  return obj;
}

function estimatePassCycleDays(passPurchaseDates) {
  if (!passPurchaseDates || passPurchaseDates.length < 2) return 30;
  const sorted = [...passPurchaseDates].sort((a, b) => a - b);
  const intervals = [];
  for (let i = 1; i < sorted.length; i += 1) {
    const days = Math.round((sorted[i] - sorted[i - 1]) / 86400000);
    if (days >= 7 && days <= 60) intervals.push(days);
  }
  if (!intervals.length) return 30;
  intervals.sort((a, b) => a - b);
  const mid = Math.floor(intervals.length / 2);
  const median = intervals.length % 2 ? intervals[mid] : Math.round((intervals[mid - 1] + intervals[mid]) / 2);
  return Math.max(21, Math.min(35, median));
}

function calculateContactScore({
  daysSinceLastPass,
  daysOverdue,
  expectedCycleDays,
  lifetimeRevenue,
  hadPassPrev,
  hasPurchaseLatest,
  passCount,
}) {
  let score = 0;
  score += Math.max(0, daysOverdue) * 1.6;
  score += Math.min(25, lifetimeRevenue / 250);
  score += Math.min(8, passCount * 1.2);
  if (hadPassPrev) score += 7;
  if (!hasPurchaseLatest) score += 5;
  if (daysSinceLastPass >= expectedCycleDays + 10) score += 8;
  return score;
}

function getPriority(score) {
  if (score >= 35) return "wysoki";
  if (score >= 18) return "średni";
  return "niski";
}

function replaceChart(previousInstance, canvasId, config) {
  if (previousInstance) previousInstance.destroy();
  const canvas = document.getElementById(canvasId);
  return new Chart(canvas, config);
}

function chartOptionsCurrency() {
  return {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          callback(value) {
            return formatCurrency(value);
          },
        },
      },
    },
    plugins: {
      barValueLabels: {
        enabled: true,
        formatter(value) {
          return formatCurrencyShort(value);
        },
      },
      tooltip: {
        callbacks: {
          label(context) {
            return `${context.dataset.label}: ${formatCurrency(context.raw)}`;
          },
        },
      },
    },
  };
}

function percentChartOptions() {
  return {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      y: {
        beginAtZero: true,
        max: 100,
        ticks: {
          callback(value) {
            return `${value}%`;
          },
        },
      },
    },
    plugins: {
      tooltip: {
        callbacks: {
          label(context) {
            return `${context.dataset.label}: ${Number(context.raw).toFixed(1)}%`;
          },
        },
      },
    },
  };
}

function formatCurrency(value) {
  return new Intl.NumberFormat("pl-PL", {
    style: "currency",
    currency: "PLN",
    maximumFractionDigits: 0,
  }).format(value || 0);
}

function formatCurrencyShort(value) {
  return new Intl.NumberFormat("pl-PL", {
    style: "currency",
    currency: "PLN",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value || 0);
}

function formatDateShort(value) {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) return "-";
  return new Intl.DateTimeFormat("pl-PL", {
    day: "2-digit",
    month: "2-digit",
  }).format(value);
}

function trimText(value, max) {
  if (value.length <= max) return value;
  return `${value.slice(0, max - 1)}...`;
}

function priorityClass(priority) {
  if (priority === "wysoki") return "high";
  if (priority === "średni") return "medium";
  return "low";
}

function setStatus(message, kind) {
  const status = document.getElementById("status");
  status.textContent = message;
  status.className = "status";
  status.classList.add(kind === "error" ? "status-error" : "status-info");
}

function setLoading(isLoading) {
  const indicator = document.getElementById("loadingIndicator");
  if (!indicator) return;
  indicator.classList.toggle("hidden", !isLoading);
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
