// Global State
let mayData = [];
let juneData = [];
let googleTrackingLog = [];
let currentMonth = 'june'; // 'may' | 'june' | 'compare'
let currentTab = 'overview'; // 'overview' | 'channels' | 'roas'
let activeChart = null;

// Currency & number formatting helpers
const formatCurrency = (val) => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0
  }).format(val);
};

const formatPct = (val) => {
  return val.toFixed(1) + '%';
};

const parseNumber = (val) => {
  if (val === undefined || val === null) return 0;
  if (typeof val === 'number') return val;
  let cleaned = val.toString().replace(/[₹,%\s]/g, '').trim();
  if (cleaned === '' || cleaned === '-' || cleaned === 'NaN') return 0;
  return parseFloat(cleaned) || 0;
};

// Start initialization on DOM load
document.addEventListener('DOMContentLoaded', () => {
  initApp();
});

async function initApp() {
  try {
    // 1. Fetch CSV files
    const [mayRes, juneRes] = await Promise.all([
      fetch('May_Daily_Summary - Daily Summery.csv').then(r => r.text()),
      fetch('June  - Daily Summery.csv').then(r => r.text())
    ]);

    // 2. Parse CSV files
    const parsedMay = Papa.parse(mayRes.trim(), { skipEmptyLines: true }).data;
    const parsedJune = Papa.parse(juneRes.trim(), { skipEmptyLines: true }).data;

    // 3. Process data structures
    mayData = processCsvRows(parsedMay, 'May');
    juneData = processCsvRows(parsedJune, 'Jun');
    googleTrackingLog = extractGoogleTracking(parsedJune);

    // Initialize Lucide Icons
    lucide.createIcons();

    // 4. Setup Event Listeners
    setupEventListeners();

    // 5. Initial Render
    renderDashboard();

  } catch (error) {
    console.error("Error initializing dashboard data:", error);
    alert("Could not load CSV files. Make sure you are running this app using a local web server.");
  }
}

// Convert raw CSV rows to clean JSON objects
function processCsvRows(rows, monthLabel) {
  const data = [];
  // Skip the header row (index 0)
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row[0] || row[0].trim() === "" || row[0].includes("Date")) continue;

    data.push({
      date: row[0],
      monthLabel: monthLabel,
      dayIndex: i, // 1-based day
      week: row[1],
      websiteGmv: parseNumber(row[2]),
      metaAdsSpends: parseNumber(row[3]),
      googleAdsSpends: parseNumber(row[4]),
      websiteAdsSpends: parseNumber(row[5]),
      metaRoas: parseNumber(row[6]),
      googleAdsRoas: parseNumber(row[7]),
      avgRoas: parseNumber(row[8]),
      amazonGmv: parseNumber(row[9]),
      amazonAdsSpends: parseNumber(row[10]),
      amazonRoas: parseNumber(row[11]),
      blinkitGmv: parseNumber(row[12]),
      blinkitAdsSpends: parseNumber(row[13]),
      blinkitRoas: parseNumber(row[14]),
      firstcryGmv: parseNumber(row[15]),
      momsStoreGmv: parseNumber(row[16]),
      totalGmv: parseNumber(row[17]),
      growthDegrowth: row[18],
      dabblePlan: parseNumber(row[19]),
      dabbleAct: parseNumber(row[20]),
      dabbleAch: row[21],
      allPlan: parseNumber(row[22]),
      allAct: parseNumber(row[23]),
      allAch: row[24]
    });
  }
  return data;
}

// Extract the side-table Google Ads topups from June sheet
function extractGoogleTracking(rows) {
  const log = [];
  // Header row is index 0. Let's look for columns index 27 (Date), 28 (Amount), 29 (Track), 30 (Note)
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (row.length > 27 && row[27] && row[27].trim() !== "" && row[27] !== "Date") {
      log.push({
        date: row[27],
        amount: parseNumber(row[28]),
        track: row[29] || 'Paid',
        note: row[30] || ''
      });
    }
  }
  return log;
}

// Set up UI Event Listeners
function setupEventListeners() {
  // Month selectors
  document.querySelectorAll('.month-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('.month-btn').forEach(b => b.classList.remove('active'));
      const target = e.currentTarget;
      target.classList.add('active');
      currentMonth = target.dataset.month;
      renderDashboard();
    });
  });

  // Tab selectors
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      const target = e.currentTarget;
      target.classList.add('active');
      currentTab = target.dataset.tab;
      renderCharts();
    });
  });

  // Table search
  const searchInput = document.getElementById('table-search');
  searchInput.addEventListener('input', () => {
    filterAndRenderTable(searchInput.value);
  });

  // Export CSV
  document.getElementById('export-csv-btn').addEventListener('click', () => {
    exportCurrentDataToCsv();
  });

  // Table Sort logic
  document.querySelectorAll('.data-table th[data-sort]').forEach(th => {
    th.addEventListener('click', () => {
      const field = th.dataset.sort;
      const currentOrder = th.dataset.order || 'asc';
      const newOrder = currentOrder === 'asc' ? 'desc' : 'asc';
      th.dataset.order = newOrder;
      
      // Update icon visual
      document.querySelectorAll('.data-table th i').forEach(icon => {
        icon.className = 'sort-icon';
        icon.setAttribute('data-lucide', 'arrow-up-down');
      });
      const icon = th.querySelector('i');
      icon.setAttribute('data-lucide', newOrder === 'asc' ? 'arrow-up' : 'arrow-down');
      lucide.createIcons();

      sortTableByField(field, newOrder);
    });
  });
}

// Main render function orchestrating DOM updates
function renderDashboard() {
  const currentDataset = getActiveDataset();
  const summary = calculateAggregates(currentDataset);
  
  // Render KPI cards
  updateKpis(summary);

  // Render Target cards
  updateTargets(currentDataset);

  // Render Sidebar
  renderSidebar(summary);

  // Render Google ledger (only relevant/populated from June details, hidden/shown)
  renderGoogleLedger();

  // Render Chart
  renderCharts();

  // Populate Table
  populateTable(currentDataset);
}

// Get the currently selected dataset
function getActiveDataset() {
  if (currentMonth === 'may') return mayData;
  if (currentMonth === 'june') return juneData;
  // If compare view, return June for primary table display or merge
  return juneData;
}

// Compute P&L aggregates
function calculateAggregates(dataset) {
  let gmv = 0;
  let spends = 0;
  let webGmv = 0;
  let amazonGmv = 0;
  let blinkitGmv = 0;
  let firstcryGmv = 0;
  let momsStoreGmv = 0;
  
  let webSpends = 0;
  let amazonSpends = 0;
  let blinkitSpends = 0;
  
  dataset.forEach(d => {
    gmv += d.totalGmv;
    spends += d.metaAdsSpends + d.googleAdsSpends + d.amazonAdsSpends + d.blinkitAdsSpends;
    webGmv += d.websiteGmv;
    amazonGmv += d.amazonGmv;
    blinkitGmv += d.blinkitGmv;
    firstcryGmv += d.firstcryGmv;
    momsStoreGmv += d.momsStoreGmv;

    webSpends += d.metaAdsSpends + d.googleAdsSpends;
    amazonSpends += d.amazonAdsSpends;
    blinkitSpends += d.blinkitAdsSpends;
  });

  const blendedRoas = spends > 0 ? (gmv / spends) : 0;
  const webShare = gmv > 0 ? (webGmv / gmv) : 0;

  return {
    gmv,
    spends,
    blendedRoas,
    webShare,
    webGmv,
    amazonGmv,
    blinkitGmv,
    firstcryGmv,
    momsStoreGmv,
    webSpends,
    amazonSpends,
    blinkitSpends
  };
}

// Update the top KPI values and sparklines
function updateKpis(summary) {
  const gmvEl = document.getElementById('kpi-total-gmv');
  const spendsEl = document.getElementById('kpi-total-spends');
  const roasEl = document.getElementById('kpi-blended-roas');
  const shareEl = document.getElementById('kpi-website-share');

  gmvEl.textContent = formatCurrency(summary.gmv);
  spendsEl.textContent = formatCurrency(summary.spends);
  roasEl.textContent = summary.blendedRoas.toFixed(2) + 'x';
  shareEl.textContent = formatPct(summary.webShare * 100);

  // Compute MoM percentage variations
  const maySummary = calculateAggregates(mayData);
  const juneSummary = calculateAggregates(juneData);

  // Growth percentages
  const gmvGrowth = ((juneSummary.gmv - maySummary.gmv) / maySummary.gmv) * 100;
  const spendsGrowth = ((juneSummary.spends - maySummary.spends) / maySummary.spends) * 100;
  const roasDiff = juneSummary.blendedRoas - maySummary.blendedRoas;

  // Trend containers
  const gmvTrendEl = document.getElementById('trend-gmv');
  const gmvTrendPctEl = document.getElementById('trend-gmv-pct');
  const spendsTrendEl = document.getElementById('trend-spends');
  const spendsTrendPctEl = document.getElementById('trend-spends-pct');
  const roasTrendEl = document.getElementById('trend-roas');
  const roasTrendValEl = document.getElementById('trend-roas-val');

  if (currentMonth === 'compare' || currentMonth === 'june') {
    // Show June vs May MoM Growth
    updateTrendIndicator(gmvTrendEl, gmvTrendPctEl, gmvGrowth, true);
    updateTrendIndicator(spendsTrendEl, spendsTrendPctEl, spendsGrowth, false); // spends growth is indigo (neutral/cost)
    
    // Update ROAS difference indicator
    roasTrendValEl.textContent = (roasDiff >= 0 ? '+' : '') + roasDiff.toFixed(2);
    const roasIconName = roasDiff >= 0 ? 'arrow-up-right' : 'arrow-down-right';
    const roasColorClass = roasDiff >= 0 ? 'text-emerald' : 'text-rose';
    roasTrendEl.className = `kpi-trend ${roasColorClass}`;
    const roasIconEl = roasTrendEl.querySelector('.trend-icon');
    if (roasIconEl) {
      roasIconEl.outerHTML = `<i data-lucide="${roasIconName}" class="trend-icon"></i>`;
    }
  } else {
    // May month selected - no MoM trend since May is the base month
    gmvTrendPctEl.textContent = 'Base Month';
    gmvTrendEl.className = 'kpi-trend text-muted';
    const gmvIconEl = gmvTrendEl.querySelector('.trend-icon');
    if (gmvIconEl) {
      gmvIconEl.outerHTML = `<i data-lucide="minus" class="trend-icon"></i>`;
    }

    spendsTrendPctEl.textContent = 'Base Month';
    spendsTrendEl.className = 'kpi-trend text-muted';
    const spendsIconEl = spendsTrendEl.querySelector('.trend-icon');
    if (spendsIconEl) {
      spendsIconEl.outerHTML = `<i data-lucide="minus" class="trend-icon"></i>`;
    }

    roasTrendValEl.textContent = 'Base Month';
    roasTrendEl.className = 'kpi-trend text-muted';
    const roasIconEl = roasTrendEl.querySelector('.trend-icon');
    if (roasIconEl) {
      roasIconEl.outerHTML = `<i data-lucide="minus" class="trend-icon"></i>`;
    }
  }

  lucide.createIcons();
}

function updateTrendIndicator(element, textElement, val, positiveIsGreen) {
  const isUp = val >= 0;
  textElement.textContent = (isUp ? '+' : '') + val.toFixed(1) + '%';
  
  const iconName = isUp ? 'arrow-up-right' : 'arrow-down-right';
  const colorClass = isUp 
    ? (positiveIsGreen ? 'text-emerald' : 'text-indigo') 
    : (positiveIsGreen ? 'text-rose' : 'text-emerald');
  
  element.className = `kpi-trend ${colorClass}`;
  
  const iconEl = element.querySelector('.trend-icon');
  if (iconEl) {
    iconEl.outerHTML = `<i data-lucide="${iconName}" class="trend-icon"></i>`;
  }
}

// Update the plan progress targets cards
function updateTargets(dataset) {
  // Grab the plan numbers from the first entry of the active month
  let planRow = dataset[0] || {};
  
  // Fallback to June first row if we are in Compare mode
  if (currentMonth === 'compare') {
    planRow = juneData[0] || {};
  }

  const dabblePlan = planRow.dabblePlan || 0;
  const dabbleAct = planRow.dabbleAct || 0;
  const dabbleAchStr = planRow.dabbleAch || '0%';

  const allPlan = planRow.allPlan || 0;
  const allAct = planRow.allAct || 0;
  const allAchStr = planRow.allAch || '0%';

  document.getElementById('target-dabble-plan').textContent = formatCurrency(dabblePlan);
  document.getElementById('target-dabble-act').textContent = formatCurrency(dabbleAct);
  document.getElementById('target-dabble-ach-badge').textContent = dabbleAchStr + ' Achieved';

  document.getElementById('target-all-plan').textContent = formatCurrency(allPlan);
  document.getElementById('target-all-act').textContent = formatCurrency(allAct);
  document.getElementById('target-all-ach-badge').textContent = allAchStr + ' Achieved';

  // Set widths
  const dabbleAchNum = Math.min(100, parseNumber(dabbleAchStr));
  const allAchNum = Math.min(100, parseNumber(allAchStr));

  document.getElementById('target-dabble-bar').style.width = dabbleAchNum + '%';
  document.getElementById('target-all-bar').style.width = allAchNum + '%';
}

// Render channel contribution list on side panel
function renderSidebar(summary) {
  const container = document.getElementById('channel-contribution-list');
  container.innerHTML = '';

  const channels = [
    { name: 'Website', gmv: summary.webGmv, color: '#10b981' },
    { name: 'Amazon', gmv: summary.amazonGmv, color: '#6366f1' },
    { name: 'BlinkIT', gmv: summary.blinkitGmv, color: '#f59e0b' },
    { name: 'FirstCry', gmv: summary.firstcryGmv, color: '#8b5cf6' },
    { name: 'The Moms Store', gmv: summary.momsStoreGmv, color: '#ec4899' }
  ];

  // Sort channels by GMV descending
  channels.sort((a, b) => b.gmv - a.gmv);

  channels.forEach(ch => {
    const pct = summary.gmv > 0 ? (ch.gmv / summary.gmv) * 100 : 0;
    
    const div = document.createElement('div');
    div.className = 'channel-item';
    div.innerHTML = `
      <div class="channel-info">
        <span class="channel-dot" style="color: ${ch.color}; background-color: ${ch.color}"></span>
        <span class="channel-name">${ch.name}</span>
      </div>
      <div class="channel-stats">
        <span class="channel-val">${formatCurrency(ch.gmv)}</span>
        <span class="channel-pct">${pct.toFixed(1)}% share</span>
      </div>
    `;
    container.appendChild(div);
  });
}

// Render Google Top-up ledger list
function renderGoogleLedger() {
  const countEl = document.getElementById('google-tracking-count');
  const listEl = document.getElementById('google-ledger-list');
  const totalEl = document.getElementById('google-total-topup');

  countEl.textContent = googleTrackingLog.length + ' top-ups';
  listEl.innerHTML = '';

  let totalAmount = 0;
  googleTrackingLog.forEach(log => {
    totalAmount += log.amount;
    const row = document.createElement('div');
    row.className = 'ledger-row';
    row.innerHTML = `
      <span class="ledger-date">${log.date}</span>
      <span class="ledger-amount">${formatCurrency(log.amount)}</span>
      <span class="ledger-status">${log.track}</span>
    `;
    listEl.appendChild(row);
  });

  totalEl.textContent = formatCurrency(totalAmount);
}

// ==========================================
// Charting Suite (ApexCharts)
// ==========================================
function renderCharts() {
  const chartEl = document.getElementById('main-analytics-chart');
  if (!chartEl) return;

  // Clear previous chart
  if (activeChart) {
    activeChart.destroy();
  }

  let options = {};
  
  if (currentMonth === 'compare') {
    options = getMoMCompareChartOptions();
  } else {
    const dataset = currentMonth === 'may' ? mayData : juneData;
    
    if (currentTab === 'overview') {
      options = getOverviewChartOptions(dataset);
    } else if (currentTab === 'channels') {
      options = getChannelMixChartOptions(dataset);
    } else if (currentTab === 'roas') {
      options = getRoasChartOptions(dataset);
    }
  }

  activeChart = new ApexCharts(chartEl, options);
  activeChart.render();
  
  // Set tab container state
  const tabsContainer = document.querySelector('.tabs-container');
  const subLabelEl = document.getElementById('chart-sub-label');
  
  if (currentMonth === 'compare') {
    tabsContainer.style.display = 'none';
    subLabelEl.textContent = 'Day-by-Day GMV Comparison (June vs May)';
  } else {
    tabsContainer.style.display = 'flex';
    if (currentTab === 'overview') subLabelEl.textContent = 'Daily GMV revenue vs Ad spend timeline';
    if (currentTab === 'channels') subLabelEl.textContent = 'Volume distribution across platforms';
    if (currentTab === 'roas') subLabelEl.textContent = 'Daily Return on Ad Spend (ROAS) trends';
  }
}

// Chart Option Generators
function getOverviewChartOptions(dataset) {
  const dates = dataset.map(d => d.date);
  const gmvs = dataset.map(d => d.totalGmv);
  const spends = dataset.map(d => d.metaAdsSpends + d.googleAdsSpends + d.amazonAdsSpends + d.blinkitAdsSpends);
  const roas = dataset.map(d => d.avgRoas);

  return {
    series: [
      { name: 'Total GMV', type: 'column', data: gmvs },
      { name: 'Total Ad Spend', type: 'area', data: spends },
      { name: 'Blended ROAS', type: 'line', data: roas }
    ],
    chart: {
      height: 380,
      type: 'line',
      stacked: false,
      toolbar: { show: false },
      background: 'transparent'
    },
    stroke: {
      width: [0, 2, 3],
      curve: 'smooth'
    },
    plotOptions: {
      bar: { columnWidth: '50%', borderRadius: 4 }
    },
    fill: {
      opacity: [0.85, 0.25, 1],
      gradient: {
        inverseColors: false,
        shade: 'dark',
        type: "vertical",
        opacityFrom: [0.85, 0.4, 1],
        opacityTo: [0.85, 0.05, 1],
        stops: [0, 100, 100, 100]
      }
    },
    colors: ['#10b981', '#6366f1', '#f59e0b'],
    labels: dates,
    markers: { size: [0, 0, 4] },
    xaxis: {
      type: 'category',
      labels: {
        style: { colors: '#9ca3af', fontFamily: 'Plus Jakarta Sans' }
      }
    },
    yaxis: [
      {
        title: {
          text: "Revenue & Marketing Spend",
          style: { color: '#9ca3af', fontFamily: 'Plus Jakarta Sans' }
        },
        labels: {
          style: { colors: '#9ca3af' },
          formatter: (val) => '₹' + (val / 1000).toFixed(0) + 'k'
        }
      },
      {
        opposite: true,
        title: {
          text: "ROAS (multiplier)",
          style: { color: '#9ca3af', fontFamily: 'Plus Jakarta Sans' }
        },
        labels: {
          style: { colors: '#9ca3af' },
          formatter: (val) => val.toFixed(1) + 'x'
        }
      }
    ],
    grid: {
      borderColor: 'rgba(255, 255, 255, 0.05)'
    },
    legend: {
      labels: { colors: '#9ca3af', fontFamily: 'Plus Jakarta Sans' }
    },
    theme: { mode: 'dark' }
  };
}

function getChannelMixChartOptions(dataset) {
  const summary = calculateAggregates(dataset);
  
  return {
    series: [summary.webGmv, summary.amazonGmv, summary.blinkitGmv, summary.firstcryGmv, summary.momsStoreGmv],
    chart: {
      type: 'donut',
      height: 350,
      background: 'transparent'
    },
    labels: ['Website', 'Amazon', 'BlinkIT', 'FirstCry', 'The Moms Store'],
    colors: ['#10b981', '#6366f1', '#f59e0b', '#8b5cf6', '#ec4899'],
    stroke: { show: false },
    dataLabels: { enabled: true },
    legend: {
      position: 'bottom',
      labels: { colors: '#9ca3af', fontFamily: 'Plus Jakarta Sans' }
    },
    plotOptions: {
      pie: {
        donut: {
          size: '70%',
          background: 'transparent',
          labels: {
            show: true,
            name: { show: true, fontSize: '14px', fontFamily: 'Plus Jakarta Sans', color: '#9ca3af' },
            value: {
              show: true,
              fontSize: '20px',
              fontFamily: 'Plus Jakarta Sans',
              fontWeight: 800,
              color: '#ffffff',
              formatter: (val) => '₹' + (val / 1000).toFixed(0) + 'k'
            },
            total: {
              show: true,
              label: 'Total GMV',
              color: '#9ca3af',
              formatter: (w) => {
                const total = w.globals.seriesTotals.reduce((a, b) => a + b, 0);
                return '₹' + (total / 100000).toFixed(1) + 'L';
              }
            }
          }
        }
      }
    },
    theme: { mode: 'dark' }
  };
}

function getRoasChartOptions(dataset) {
  const dates = dataset.map(d => d.date);
  const metaRoas = dataset.map(d => d.metaRoas);
  const googleRoas = dataset.map(d => d.googleAdsRoas);
  const amazonRoas = dataset.map(d => d.amazonRoas);
  const blinkitRoas = dataset.map(d => d.blinkitRoas);

  return {
    series: [
      { name: 'Meta ROAS', data: metaRoas },
      { name: 'Google ROAS', data: googleRoas },
      { name: 'Amazon ROAS', data: amazonRoas },
      { name: 'BlinkIT ROAS', data: blinkitRoas }
    ],
    chart: {
      height: 380,
      type: 'line',
      toolbar: { show: false },
      background: 'transparent'
    },
    stroke: {
      width: 3,
      curve: 'smooth'
    },
    colors: ['#10b981', '#6366f1', '#f59e0b', '#ec4899'],
    xaxis: {
      categories: dates,
      labels: {
        style: { colors: '#9ca3af', fontFamily: 'Plus Jakarta Sans' }
      }
    },
    yaxis: {
      title: {
        text: "ROAS (multiplier)",
        style: { color: '#9ca3af', fontFamily: 'Plus Jakarta Sans' }
      },
      labels: {
        style: { colors: '#9ca3af' },
        formatter: (val) => val.toFixed(1) + 'x'
      }
    },
    grid: {
      borderColor: 'rgba(255, 255, 255, 0.05)'
    },
    legend: {
      labels: { colors: '#9ca3af', fontFamily: 'Plus Jakarta Sans' }
    },
    theme: { mode: 'dark' }
  };
}

function getMoMCompareChartOptions() {
  // Find matching daily indices (Day 1 to 31)
  const maxDays = Math.max(mayData.length, juneData.length);
  const categories = Array.from({ length: maxDays }, (_, i) => `Day ${i + 1}`);

  const mayGmvList = Array(maxDays).fill(0);
  const juneGmvList = Array(maxDays).fill(0);

  mayData.forEach((d, index) => { mayGmvList[index] = d.totalGmv; });
  juneData.forEach((d, index) => { juneGmvList[index] = d.totalGmv; });

  return {
    series: [
      { name: 'May GMV', data: mayGmvList },
      { name: 'June GMV', data: juneGmvList }
    ],
    chart: {
      height: 380,
      type: 'area',
      toolbar: { show: false },
      background: 'transparent'
    },
    stroke: {
      width: 2.5,
      curve: 'smooth'
    },
    fill: {
      type: 'gradient',
      gradient: {
        opacityFrom: 0.2,
        opacityTo: 0.01,
      }
    },
    colors: ['#6366f1', '#10b981'],
    xaxis: {
      categories: categories,
      labels: {
        style: { colors: '#9ca3af', fontFamily: 'Plus Jakarta Sans' }
      }
    },
    yaxis: {
      title: {
        text: "Daily GMV Revenue",
        style: { color: '#9ca3af', fontFamily: 'Plus Jakarta Sans' }
      },
      labels: {
        style: { colors: '#9ca3af' },
        formatter: (val) => '₹' + (val / 1000).toFixed(0) + 'k'
      }
    },
    grid: {
      borderColor: 'rgba(255, 255, 255, 0.05)'
    },
    legend: {
      labels: { colors: '#9ca3af', fontFamily: 'Plus Jakarta Sans' }
    },
    theme: { mode: 'dark' }
  };
}

// ==========================================
// Data Table Rendering Suite
// ==========================================
let tableData = []; // Cache dataset for filtering and sorting

function populateTable(dataset) {
  tableData = [...dataset];
  renderTableRows(tableData);
}

function renderTableRows(data) {
  const tbody = document.getElementById('table-body');
  tbody.innerHTML = '';

  if (data.length === 0) {
    tbody.innerHTML = `<tr><td colspan="11" class="text-center">No transactions found</td></tr>`;
    return;
  }

  data.forEach((row, i) => {
    // Growth styling
    const growthVal = parseNumber(row.growthDegrowth);
    let growthClass = '';
    let rowBgClass = '';
    if (row.growthDegrowth) {
      const isPositive = !row.growthDegrowth.toString().includes('-');
      growthClass = isPositive ? 'text-emerald font-bold' : 'text-rose';
      rowBgClass = isPositive ? 'highlight-row-growth' : 'highlight-row-degrowth';
    }

    const tr = document.createElement('tr');
    tr.className = rowBgClass;
    tr.innerHTML = `
      <td class="font-bold">${row.date}</td>
      <td>${formatCurrency(row.websiteGmv)}</td>
      <td>${formatCurrency(row.websiteAdsSpends)}</td>
      <td>${row.metaRoas ? row.metaRoas.toFixed(2) + 'x' : '-'}</td>
      <td>${row.googleAdsRoas ? row.googleAdsRoas.toFixed(2) + 'x' : '-'}</td>
      <td>${formatCurrency(row.amazonGmv)}</td>
      <td>${formatCurrency(row.amazonAdsSpends)}</td>
      <td>${formatCurrency(row.blinkitGmv)}</td>
      <td>${formatCurrency(row.blinkitAdsSpends)}</td>
      <td class="font-bold text-primary">${formatCurrency(row.totalGmv)}</td>
      <span class="${growthClass}">${row.growthDegrowth || '-'}</span>
    `;
    
    // Fix last column to align nicely
    const lastTd = document.createElement('td');
    lastTd.className = growthClass;
    lastTd.textContent = row.growthDegrowth || '-';
    tr.appendChild(lastTd);
    
    tbody.appendChild(tr);
  });
}

function filterAndRenderTable(query) {
  const cleanQuery = query.toLowerCase().trim();
  if (cleanQuery === '') {
    renderTableRows(tableData);
    return;
  }

  const filtered = tableData.filter(d => {
    return d.date.toLowerCase().includes(cleanQuery) || 
           d.week.toLowerCase().includes(cleanQuery) ||
           d.totalGmv.toString().includes(cleanQuery);
  });
  
  renderTableRows(filtered);
}

function sortTableByField(field, order) {
  tableData.sort((a, b) => {
    let valA, valB;
    
    // Mapping display titles to data object fields
    if (field === 'Date') {
      // Map Month names / Date strings
      valA = a.dayIndex;
      valB = b.dayIndex;
    } else if (field === 'Website GMV') {
      valA = a.websiteGmv;
      valB = b.websiteGmv;
    } else if (field === 'Website Ads Spends') {
      valA = a.websiteAdsSpends;
      valB = b.websiteAdsSpends;
    } else if (field === 'Meta ROAS') {
      valA = a.metaRoas;
      valB = b.metaRoas;
    } else if (field === 'Google Ads ROAS') {
      valA = a.googleAdsRoas;
      valB = b.googleAdsRoas;
    } else if (field === 'Amazon GMV') {
      valA = a.amazonGmv;
      valB = b.amazonGmv;
    } else if (field === 'Amazon Ads Spends') {
      valA = a.amazonAdsSpends;
      valB = b.amazonAdsSpends;
    } else if (field === 'BlinkIT GMV') {
      valA = a.blinkitGmv;
      valB = b.blinkitGmv;
    } else if (field === 'BlinkIT Ads Spend') {
      valA = a.blinkitAdsSpends;
      valB = b.blinkitAdsSpends;
    } else if (field === 'Total GMV') {
      valA = a.totalGmv;
      valB = b.totalGmv;
    } else if (field === 'Growth-Degrowth') {
      valA = parseNumber(a.growthDegrowth);
      valB = parseNumber(b.growthDegrowth);
    } else {
      valA = a[field] || 0;
      valB = b[field] || 0;
    }

    if (order === 'asc') {
      return valA > valB ? 1 : -1;
    } else {
      return valA < valB ? 1 : -1;
    }
  });

  renderTableRows(tableData);
}

// Export parsed list to CSV
function exportCurrentDataToCsv() {
  const activeDataset = getActiveDataset();
  if (activeDataset.length === 0) return;

  const headers = [
    'Date', 'Week', 'Website GMV', 'Website Ads Spend', 'Meta ROAS', 
    'Google ROAS', 'Amazon GMV', 'Amazon Spend', 'BlinkIT GMV', 'BlinkIT Spend', 
    'Total GMV', 'Growth-Degrowth'
  ];

  const rows = activeDataset.map(d => [
    d.date, d.week, d.websiteGmv, d.websiteAdsSpends, d.metaRoas,
    d.googleAdsRoas, d.amazonGmv, d.amazonAdsSpends, d.blinkitGmv, d.blinkitAdsSpends,
    d.totalGmv, d.growthDegrowth
  ]);

  let csvContent = "data:text/csv;charset=utf-8," 
    + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
  
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", `PL_Dashboard_Export_${currentMonth.toUpperCase()}.csv`);
  document.body.appendChild(link);
  
  link.click();
  document.body.removeChild(link);
}
