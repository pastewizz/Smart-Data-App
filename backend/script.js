let currentData = null;
const charts = {};

document.addEventListener("DOMContentLoaded", () => {
  initializeFileUpload();
  initializeEventListeners();
});

function initializeFileUpload() {
  const uploadArea = document.getElementById("uploadArea");
  const fileInput = document.getElementById("fileInput");
  const chooseFilesBtn = uploadArea.querySelector("button");

  uploadArea.addEventListener("dragover", (e) => {
    e.preventDefault();
    uploadArea.classList.add("dragover");
  });

  uploadArea.addEventListener("dragleave", (e) => {
    e.preventDefault();
    uploadArea.classList.remove("dragover");
  });

  uploadArea.addEventListener("drop", (e) => {
    e.preventDefault();
    uploadArea.classList.remove("dragover");
    processFiles(e.dataTransfer.files);
  });

  uploadArea.addEventListener("click", () => fileInput.click());
  chooseFilesBtn.addEventListener("click", () => fileInput.click());

  fileInput.addEventListener("change", (e) => processFiles(e.target.files));
}

function initializeEventListeners() {
  document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
    anchor.addEventListener("click", (e) => {
      e.preventDefault();
      document.querySelector(anchor.getAttribute("href")).scrollIntoView({ behavior: "smooth" });
    });
  });

  document.getElementById("basicStatsBtn")?.addEventListener("click", () => performAnalysis("basic_stats"));
  document.getElementById("outliersBtn")?.addEventListener("click", () => performAnalysis("outliers"));
  document.getElementById("correlationsBtn")?.addEventListener("click", () => performAnalysis("correlations"));
  document.getElementById("histogramBtn")?.addEventListener("click", () => performAnalysis("histogram"));
  document.getElementById("scatterPlotBtn")?.addEventListener("click", () => performAnalysis("scatter_plot"));
}

function processFiles(files) {
  if (files.length === 0) {
    alert("No file selected.");
    return;
  }

  const file = files[0];
  const fileExtension = file.name.split(".").pop().toLowerCase();
  console.log("Processing file:", file.name, "Extension:", fileExtension);

  if (!["csv", "json", "xlsx"].includes(fileExtension)) {
    alert("Unsupported file format. Please use CSV, JSON, or Excel (.xlsx).");
    return;
  }

  showLoading();

  const formData = new FormData();
  formData.append("file", file);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  fetch("http://localhost:5000/upload", {
    method: "POST",
    body: formData,
    signal: controller.signal
  })
    .then((response) => {
      clearTimeout(timeoutId);
      console.log("Upload response status:", response.status);
      if (!response.ok) throw new Error(`Upload failed: ${response.statusText}`);
      return response.json();
    })
    .then((data) => {
      console.log("Upload response data:", JSON.stringify(data, null, 2));
      if (data.error) {
        console.error("Upload response error:", data.error);
        throw new Error(data.error);
      }
      if (!data.analysis) {
        console.error("No analysis data in response");
        throw new Error("No analysis data received from server");
      }
      currentData = data.analysis;
      try {
        displayDataPreview(data.analysis.basic_statistics);
        performInitialAnalysis(data.analysis);
      } catch (error) {
        console.error("Error in processing analysis:", error);
        alert(`Error displaying analysis: ${error.message}`);
      }
    })
    .catch((error) => {
      console.error("Upload error:", error);
      alert(`Error processing file: ${error.message}`);
    })
    .finally(() => {
      console.log("Finalizing upload process");
      clearTimeout(timeoutId);
      hideLoading();
    });
}

function performAnalysis(operation) {
  if (!currentData && operation !== "basic_stats") {
    alert("Please upload data first");
    hideLoading();
    return;
  }

  showLoading();
  fetch("http://localhost:5000/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ operation })
  })
    .then((response) => {
      console.log(`Analysis (${operation}) response status:`, response.status);
      if (!response.ok) throw new Error(`Analysis failed: ${response.statusText}`);
      return response.json();
    })
    .then((data) => {
      console.log(`Analysis (${operation}) response data:`, JSON.stringify(data, null, 2));
      if (data.error) {
        console.error(`Analysis (${operation}) error:`, data.error);
        throw new Error(data.error);
      }
      try {
        if (operation === "basic_stats") {
          displayStatistics(data.result);
        } else if (operation === "outliers") {
          displayOutliers(data.result);
        } else if (operation === "correlations") {
          displayCorrelations(data.result);
        } else if (operation === "histogram") {
          createSampleHistogram(data.result);
        } else if (operation === "scatter_plot") {
          createScatterPlot(data.result);
        }
        document.getElementById("analysis-section").scrollIntoView({ behavior: "smooth" });
      } catch (error) {
        console.error(`Error rendering ${operation}:`, error);
        alert(`Error rendering ${operation}: ${error.message}`);
      }
    })
    .catch((error) => {
      console.error(`Analysis error (${operation}):`, error);
      alert(`Error performing ${operation}: ${error.message}`);
    })
    .finally(() => {
      console.log(`Finalizing analysis (${operation})`);
      hideLoading();
    });
}

function createScatterPlot(scatterData) {
  console.log("Creating scatter plot with data:", JSON.stringify(scatterData, null, 2));
  const ctx = document.getElementById("chart3")?.getContext("2d");
  if (!ctx) {
    console.error("Scatter plot canvas (chart3) not found");
    alert("Visualization error: Scatter plot canvas not found.");
    return;
  }
  if (charts.chart3) {
    charts.chart3.destroy();
    console.log("Destroyed existing chart3");
  }

  if (!scatterData || scatterData.error || !scatterData.data || !scatterData.x_column || !scatterData.y_column) {
    console.error("Invalid scatter plot data:", scatterData?.error || "Missing data or columns");
    alert("Not enough valid data for scatter plot.");
    return;
  }

  try {
    charts.chart3 = new Chart(ctx, {
      type: "scatter",
      data: {
        datasets: [{
          label: `${scatterData.y_column} vs ${scatterData.x_column}`,
          data: scatterData.data.map(row => ({
            x: row[scatterData.x_column] || 0,
            y: row[scatterData.y_column] || 0
          })),
          backgroundColor: "rgba(255, 99, 132, 0.6)",
          borderColor: "rgba(255, 99, 132, 1)",
          borderWidth: 1,
        }],
      },
      options: {
        responsive: true,
        plugins: { title: { display: true, text: `Scatter Plot: ${scatterData.y_column} vs ${scatterData.x_column}` } },
        scales: {
          x: { title: { display: true, text: scatterData.x_column } },
          y: { title: { display: true, text: scatterData.y_column } },
        },
      },
    });
    console.log("Scatter plot created successfully");
  } catch (error) {
    console.error("Error creating scatter plot:", error);
    alert(`Error creating scatter plot: ${error.message}`);
  }
}

// Other functions (unchanged from previous version)
function displayDataPreview(stats) {
  const previewSection = document.getElementById("preview-section");
  const table = document.getElementById("dataTable");
  const thead = table.querySelector("thead");
  const tbody = table.querySelector("tbody");

  thead.innerHTML = "";
  tbody.innerHTML = "";

  if (!stats || !stats.columns || stats.shape[0] === 0) {
    alert("No data available for preview.");
    hideLoading();
    return;
  }

  const headerRow = document.createElement("tr");
  stats.columns.forEach((column) => {
    const th = document.createElement("th");
    th.textContent = column;
    headerRow.appendChild(th);
  });
  thead.appendChild(headerRow);

  const summaries = [
    stats.numeric_summary || {},
    stats.categorical_summary || {},
    stats.text_summary || {},
    stats.datetime_summary || {}
  ];
  const hasNumeric = Object.keys(stats.numeric_summary || {}).length > 0;
  const columnsToShow = stats.columns.slice(0, 5);
  const maxRows = Math.min(stats.shape[0], 5);

  for (let i = 0; i < maxRows; i++) {
    const tr = document.createElement("tr");
    columnsToShow.forEach((column) => {
      const td = document.createElement("td");
      let value = '-';
      for (const summary of summaries) {
        if (summary[column]) {
          if (summary[column].mean) {
            value = summary[column].mean.toFixed(2);
          } else if (summary[column].most_frequent) {
            value = summary[column].most_frequent;
          } else if (summary[column].min) {
            value = summary[column].min;
          } else if (summary[column].keyword_count) {
            value = summary[column].keyword_count[0]?.[0] || '-';
          }
          break;
        }
      }
      td.textContent = value;
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  }

  previewSection.style.display = "block";
  previewSection.classList.add("fade-in");
}

function performInitialAnalysis(analysis) {
  if (!analysis) {
    alert("No analysis data received.");
    hideLoading();
    return;
  }

  const analysisSection = document.getElementById("analysis-section");
  const visualizationSection = document.getElementById("visualization-section");

  try {
    displayStatistics(analysis.basic_statistics);
    displayInsights(analysis.insights);
    createInitialCharts(analysis);
  } catch (error) {
    console.error("Error in performInitialAnalysis:", error);
    alert(`Error displaying analysis: ${error.message}`);
  }

  analysisSection.style.display = "block";
  visualizationSection.style.display = (analysis.histogram_data && Object.keys(analysis.histogram_data).length > 0) ? "block" : "none";
  analysisSection.classList.add("fade-in");
  visualizationSection.classList.add("fade-in");
}

function displayStatistics(stats) {
  const container = document.getElementById("statsContainer");
  container.innerHTML = "";

  if (!stats) {
    container.innerHTML = '<p class="text-muted">No statistics available.</p>';
    return;
  }

  const overallStats = [
    { label: "Total Rows", value: stats.shape[0] },
    { label: "Total Columns", value: stats.shape[1] },
    { label: "Numeric Columns", value: Object.keys(stats.numeric_summary || {}).length },
    { label: "Categorical Columns", value: Object.keys(stats.categorical_summary || {}).length },
    { label: "Datetime Columns", value: Object.keys(stats.datetime_summary || {}).length },
    { label: "Text Columns", value: Object.keys(stats.text_summary || {}).length }
  ];

  overallStats.forEach((stat) => {
    const statItem = document.createElement("div");
    statItem.className = "stats-item col-md-3";
    statItem.innerHTML = `
      <h6>${stat.label}</h6>
      <p class="stats-value">${stat.value}</p>
    `;
    container.appendChild(statItem);
  });
}

function displayInsights(insights) {
  const container = document.getElementById("insightsContainer");
  container.innerHTML = "<h6>Data Insights</h6>";

  if (!insights || insights.length === 0) {
    container.innerHTML += '<p class="text-muted">No specific insights detected.</p>';
    return;
  }

  insights.forEach((insight) => {
    const severityClass = {
      'info': 'border-info text-info bg-info-light',
      'warning': 'border-warning text-warning bg-warning-light',
      'critical': 'border-danger text-danger bg-danger-light'
    }[insight.severity] || 'border-info text-info bg-info-light';

    const insightItem = document.createElement("div");
    insightItem.className = `insight-item ${severityClass}`;
    insightItem.innerHTML = `
      <div class="insight-title">${insight.title || 'Untitled'}</div>
      <div class="insight-description">${insight.description || 'No description'}</div>
    `;
    container.appendChild(insightItem);
  });
}

function displayOutliers(outliers) {
  const container = document.getElementById("insightsContainer");
  container.innerHTML = "<h6>Outlier Detection Results</h6>";

  if (!outliers || Object.keys(outliers).length === 0) {
    container.innerHTML += '<p class="text-success">No significant outliers detected.</p>';
    return;
  }

  for (const col in outliers) {
    const outlierItem = document.createElement("div");
    outlierItem.className = "insight-item border-warning text-warning bg-warning-light";
    outlierItem.innerHTML = `
      <div class="insight-title">Outliers in ${col}</div>
      <div class="insight-description">Found ${outliers[col].count} outliers (${outliers[col].percentage.toFixed(2)}%)</div>
    `;
    container.appendChild(outlierItem);
  }
}

function displayCorrelations(correlations) {
  const container = document.getElementById("insightsContainer");
  container.innerHTML = "<h6>Correlation Analysis</h6>";

  if (!correlations || !correlations.strong_correlations || correlations.strong_correlations.length === 0) {
    container.innerHTML += '<p class="text-muted">No strong correlations found.</p>';
    return;
  }

  correlations.strong_correlations.forEach((corr) => {
    const corrItem = document.createElement("div");
    corrItem.className = `insight-item border-${corr.strength.toLowerCase() === 'strong' ? 'success' : 'warning'} text-${corr.strength.toLowerCase() === 'strong' ? 'success' : 'warning'} bg-${corr.strength.toLowerCase() === 'strong' ? 'success' : 'warning'}-light`;
    corrItem.innerHTML = `
      <div class="insight-title">${corr.column1} vs ${corr.column2}</div>
      <div class="insight-description">Correlation: ${corr.correlation.toFixed(3)} (${corr.strength})</div>
    `;
    container.appendChild(corrItem);
  });
}

function createInitialCharts(analysis) {
  if (!analysis || !analysis.basic_statistics) {
    console.error("No valid analysis data for charts");
    return;
  }

  const stats = analysis.basic_statistics;
  const visualizationSection = document.getElementById("visualization-section");
  visualizationSection.innerHTML = "";

  if (Object.keys(stats.numeric_summary || {}).length > 0) {
    visualizationSection.innerHTML = `
      <div class="chart-container"><canvas id="chart1"></canvas></div>
      <div class="chart-container"><canvas id="chart2"></canvas></div>
      <div class="chart-container"><canvas id="chart3"></canvas></div>
    `;
    createColumnDistributionChart(stats);
    createDataTypeChart(stats);
    createSampleHistogram(analysis.histogram_data);
  } else {
    console.log("No numeric data for charts, displaying categorical summary");
    visualizationSection.innerHTML = '<p class="text-muted">No numeric data available for visualizations. Showing categorical summary instead.</p>';
    createCategoricalChart(stats);
  }
}

function createColumnDistributionChart(stats) {
  const ctx = document.getElementById("chart1").getContext("2d");
  if (charts.chart1) charts.chart1.destroy();

  const numericSummary = stats.numeric_summary || {};
  charts.chart1 = new Chart(ctx, {
    type: "bar",
    data: {
      labels: Object.keys(numericSummary),
      datasets: [{
        label: "Mean Values",
        data: Object.values(numericSummary).map(col => col.mean || 0),
        backgroundColor: "rgba(54, 162, 235, 0.8)",
        borderColor: "rgba(54, 162, 235, 1)",
        borderWidth: 2,
      }],
    },
    options: {
      responsive: true,
      plugins: { title: { display: true, text: "Mean Values by Numeric Columns" } },
      scales: { y: { beginAtZero: true } },
    },
  });
}

function createDataTypeChart(stats) {
  const ctx = document.getElementById("chart2").getContext("2d");
  if (charts.chart2) charts.chart2.destroy();

  charts.chart2 = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels: ["Numeric", "Categorical", "Datetime", "Text"],
      datasets: [{
        data: [
          Object.keys(stats.numeric_summary || {}).length,
          Object.keys(stats.categorical_summary || {}).length,
          Object.keys(stats.datetime_summary || {}).length,
          Object.keys(stats.text_summary || {}).length
        ],
        backgroundColor: [
          "rgba(75, 192, 192, 0.8)",
          "rgba(255, 99, 132, 0.8)",
          "rgba(54, 162, 235, 0.8)",
          "rgba(153, 102, 255, 0.8)"
        ],
        borderColor: [
          "rgba(75, 192, 192, 1)",
          "rgba(255, 99, 132, 1)",
          "rgba(54, 162, 235, 1)",
          "rgba(153, 102, 255, 1)"
        ],
        borderWidth: 2,
      }],
    },
    options: {
      responsive: true,
      plugins: { title: { display: true, text: "Data Type Distribution" } },
    },
  });
}

function createCategoricalChart(stats) {
  const visualizationSection = document.getElementById("visualization-section");
  const categoricalSummary = stats.categorical_summary || {};
  if (Object.keys(categoricalSummary).length === 0) {
    visualizationSection.innerHTML = '<p class="text-muted">No categorical data available for visualization.</p>';
    return;
  }

  const firstCol = Object.keys(categoricalSummary)[0];
  const valueCounts = categoricalSummary[firstCol].top_5_values || {};
  const ctx = document.createElement("canvas");
  ctx.id = "chart3";
  visualizationSection.appendChild(ctx);

  charts.chart3 = new Chart(ctx.getContext("2d"), {
    type: "bar",
    data: {
      labels: Object.keys(valueCounts),
      datasets: [{
        label: `Top Values in ${firstCol}`,
        data: Object.values(valueCounts),
        backgroundColor: "rgba(153, 102, 255, 0.8)",
        borderColor: "rgba(153, 102, 255, 1)",
        borderWidth: 2,
      }],
    },
    options: {
      responsive: true,
      plugins: { title: { display: true, text: `Top Values in ${firstCol}` } },
      scales: { y: { beginAtZero: true, title: { display: true, text: "Count" } } },
    },
  });
}

function createSampleHistogram(histogramData) {
  const ctx = document.getElementById("chart3").getContext("2d");
  if (charts.chart3) charts.chart3.destroy();

  if (!histogramData || Object.keys(histogramData).length === 0) {
    alert("No histogram data available.");
    return;
  }

  const col = Object.keys(histogramData)[0];
  if (!col || !histogramData[col]) {
    alert("No numeric data available for histogram.");
    return;
  }

  charts.chart3 = new Chart(ctx, {
    type: "bar",
    data: {
      labels: histogramData[col].labels,
      datasets: [{
        label: `Frequency of ${col}`,
        data: histogramData[col].counts,
        backgroundColor: "rgba(153, 102, 255, 0.8)",
        borderColor: "rgba(153, 102, 255, 1)",
        borderWidth: 2,
      }],
    },
    options: {
      responsive: true,
      plugins: { title: { display: true, text: `Distribution of ${col}` } },
      scales: {
        y: { beginAtZero: true, title: { display: true, text: "Frequency" } },
        x: { title: { display: true, text: col } },
      },
    },
  });
}

function showLoading() {
  console.log("Showing loading modal");
  const modal = new bootstrap.Modal(document.getElementById("loadingModal"), { backdrop: "static" });
  modal.show();
}

function hideLoading() {
  console.log("Hiding loading modal");
  const modal = bootstrap.Modal.getInstance(document.getElementById("loadingModal"));
  if (modal) {
    modal.hide();
  } else {
    console.warn("No active modal instance found");
  }
}