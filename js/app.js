const state = {
  auth: null,
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
  },
};

const AUTH_STORAGE_KEY = "reforma_fitssey_auth";

const FITSSEY_CONFIG = {
  baseUrlTemplate: "https://app.fitssey.com/{uuid}/api/v4/public",
  defaultStartDate: "2025-10-01",
  defaultStudioUuid: "Reformapilates",
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
};

document.addEventListener("DOMContentLoaded", () => {
  initHelpPopover();
  initAuth();
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
    setStatus("Wylogowano. Wprowadź nowy API Key, aby pobrać dane.", "info");
  });
}

async function loadDefaultData() {
  if (!state.auth?.secret || !state.auth?.studioUuid) {
    setStatus("Brak autoryzacji API. Uzupełnij dane logowania powyżej.", "error");
    return;
  }

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
  }
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
    isPass: /karnet|pass|pakiet/i.test(product),
  };
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
        passMonths: new Set(),
      };
    }

    const stat = clientStats[row.clientKey];
    stat.lifetimeRevenue += row.amount;
    if (row.date > stat.lastPurchaseDate) {
      stat.lastPurchaseDate = row.date;
      stat.name = row.clientName;
    }
    if (row.isPass) stat.passMonths.add(row.month);
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
  if (previousMonth) {
    for (const client of Object.values(clientStats)) {
      const hadPassPrev = client.passMonths.has(previousMonth);
      const hasPassLatest = client.passMonths.has(latestMonth);
      if (!hadPassPrev || hasPassLatest) continue;

      const daysSince = Math.max(0, Math.floor((Date.now() - client.lastPurchaseDate.getTime()) / 86400000));
      contacts.push({
        name: client.name,
        lastPurchaseDate: client.lastPurchaseDate,
        daysSince,
        lifetimeRevenue: client.lifetimeRevenue,
        priority: getPriority(daysSince, client.lifetimeRevenue),
      });
    }
  }

  contacts.sort((a, b) => b.daysSince - a.daysSince || b.lifetimeRevenue - a.lifetimeRevenue);

  const clientsSummary = buildClientsSummary(records, months);

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
    contacts,
    clientsSummary,
  };
}

function renderDashboard(analytics) {
  document.getElementById("dashboard").classList.remove("hidden");
  document.getElementById("status").classList.add("hidden");

  renderRevenueChart(analytics.months, analytics.revenueByMonth);
  renderMrrChart(analytics.months, analytics.mrrByMonth);
  renderUnitEconomicsChart(analytics.months, analytics.arpuByMonth, analytics.avgTicketByMonth);
  renderProductsChart(analytics.productCount);
  renderProductMixChart(analytics.productCount);
  renderCohortChart(analytics.months, analytics.newClientsByMonth, analytics.returningClientsByMonth);
  renderChurnChart(analytics.months, analytics.churnByMonth);
  renderRetentionChart(analytics.months, analytics.retentionByMonth);
  renderActiveClientsChart(analytics.months, analytics.activeClientsByMonth);
  renderLtvSegmentsChart(analytics.ltvSegments);
  renderContactsTable(analytics.contacts);
  renderAllClientsTable(analytics.clientsSummary, analytics.months);
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

function renderContactsTable(contacts) {
  const tbody = document.getElementById("contactTableBody");
  tbody.innerHTML = "";

  if (!contacts.length) {
    const row = document.createElement("tr");
    row.innerHTML = "<td data-label=\"Status\">Brak klientów do kontaktu dla ostatniego miesiąca.</td>";
    tbody.appendChild(row);
    return;
  }

  for (const contact of contacts.slice(0, 50)) {
    const row = document.createElement("tr");
    const dateLabel = new Intl.DateTimeFormat("pl-PL").format(contact.lastPurchaseDate);
    const badgeClass = `recommend recommend-${priorityClass(contact.priority)}`;
    row.innerHTML = `
      <td data-label="Klient">${escapeHtml(contact.name)}</td>
      <td data-label="Ostatni zakup">${dateLabel}</td>
      <td data-label="Dni bez zakupu">${contact.daysSince}</td>
      <td data-label="LTV">${formatCurrency(contact.lifetimeRevenue)}</td>
      <td data-label="Rekomendacja"><span class="${badgeClass}">${contact.priority}</span></td>
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

  const baseHeaders = ["Imię i nazwisko", "Ilość zakupów", "Suma zakupów"];
  for (const title of baseHeaders) {
    const th = document.createElement("th");
    th.textContent = title;
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

  for (const client of clientsSummary) {
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

function safeText(value) {
  return String(value || "").trim();
}

function createMonthlyObject(months, initialValue) {
  const obj = {};
  for (const month of months) obj[month] = initialValue;
  return obj;
}

function getPriority(daysSince, lifetimeRevenue) {
  if (daysSince >= 45 || lifetimeRevenue >= 1200) return "wysoki";
  if (daysSince >= 28 || lifetimeRevenue >= 600) return "średni";
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

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
