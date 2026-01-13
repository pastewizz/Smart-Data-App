```javascript
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

    if (!uploadArea || !fileInput || !chooseFilesBtn) {
        console.error("Upload elements not found: uploadArea, fileInput, or chooseFilesBtn missing");
        alert("Upload functionality is not properly initialized. Check HTML elements.");
        return;
    }

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

    fileInput.addEventListener("change", (e) => {
        console.log("File input changed, processing files");
        processFiles(e.target.files);
    });
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
    document.getElementById("filterBtn")?.addEventListener("click", () => applyFilter());
}

function processFiles(files) {
    if (!files || files.length === 0) {
        console.error("No files selected for upload");
        alert("No file selected.");
        return;
    }

    const file = files[0];
    const fileExtension = file.name.split(".").pop().toLowerCase();
    console.log("Processing file:", file.name, "Extension:", fileExtension);

    if (!["csv", "xlsx"].includes(fileExtension)) {
        console.error("Unsupported file format:", fileExtension);
        alert("Unsupported file format. Please use CSV or Excel (.xlsx).");
        return;
    }

    showLoading();

    const formData = new FormData();
    formData.append("file", file);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
        controller.abort();
        console.error("Upload request timed out");
        alert("Upload request timed out.");
        hideLoading();
    }, 10000);

    fetch("/upload", {
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
                console.error("Upload error:", data.error);
                throw new Error(data.error);
            }
            currentData = data.analysis;
            displayDataPreview(data.analysis.basic_statistics);
            displayInsights(data.analysis.insights);
            populateFilterColumns(data.analysis.basic_statistics);
            createInitialCharts(data.analysis);
            document.getElementById("analysis-section").style.display = "block";
            document.getElementById("visualization-section").style.display = "block";
        })
        .catch((error) => {
            console.error("Upload error:", error);
            alert(`Error processing file: ${error.message}`);
        })
        .finally(() => {
            console.log("Finalizing upload process");
            hideLoading();
        });
}

function performAnalysis(operation) {
    if (!currentData) {
        console.error("No data available for analysis. Please upload a file first.");
        alert("Please upload data first");
        hideLoading();
        return;
    }

    showLoading();
    fetch("/analyze", {
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
                displayNoResults(operation, data.error);
                return;
            }
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
        })
        .catch((error) => {
            console.error(`Analysis error (${operation}):`, error);
            displayNoResults(operation, error.message);
        })
        .finally(() => {
            console.log(`Finalizing analysis (${operation})`);
            hideLoading();
        });
}

function applyFilter() {
    const column = document.getElementById("columnSelect")?.value;
    const minValue = document.getElementById("minValue")?.value;
    const maxValue = document.getElementById("maxValue")?.value;

    if (!column || (!minValue && !maxValue)) {
        console.error("Filter parameters missing");
        alert("Please select a column and specify at least one filter value.");
        return;
    }

    showLoading();
    fetch("/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ operation: "filter", column, minValue, maxValue })
    })
        .then((response) => {
            console.log("Filter response status:", response.status);
            if (!response.ok) throw new Error(`Filter failed: ${response.statusText}`);
            return response.json();
        })
        .then((data) => {
            console.log("Filter response data:", JSON.stringify(data, null, 2));
            if (data.error) {
                console.error("Filter error:", data.error);
                throw new Error(data.error);
            }
            currentData = data.result;
            displayDataPreview(data.result.basic_statistics);
            displayInsights(data.result.insights);
            createInitialCharts(data.result);
            document.getElementById("analysis-section").style.display = "block";
            document.getElementById("visualization-section").style.display = "block";
        })
        .catch((error) => {
            console.error("Filter error:", error);
            alert(`Error applying filter: ${error.message}`);
        })
        .finally(() => {
            console.log("Finalizing filter process");
            hideLoading();
        });
}

function populateFilterColumns(stats) {
    const columnSelect = document.getElementById("columnSelect");
    if (!columnSelect) {
        console.error("Filter column select element not found");
        return;
    }
    columnSelect.innerHTML = '<option value="">Select Column</option>';
    Object.keys(stats.numeric_summary || {}).forEach(col => {
        const option = document.createElement("option");
        option.value = col;
        option.textContent = col;
        columnSelect.appendChild(option);
    });
}

function displayNoResults(operation, message) {
    const container = document.getElementById("insightsContainer");
    container.innerHTML = `<h6>${operation.replace('_', ' ').toUpperCase()} Results</h6>`;
    container.innerHTML += `<p class="text-muted">${message}</p>`;
}

function displayDataPreview(stats) {
    const previewSection = document.getElementById("preview-section");
    const table = document.getElementById("dataTable");
    const thead = table.querySelector("thead");
    const tbody = table.querySelector("tbody");

    thead.innerHTML = "";
    tbody.innerHTML = "";

    if (!stats || !stats.columns || stats.shape[0] === 0) {
        console.error("No data available for preview");
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

    const numericSummary = stats.numeric_summary || {};
    const maxRows = Math.min(stats.shape[0], 5);
    for (let i = 0; i < maxRows; i++) {
        const tr = document.createElement("tr");
        stats.columns.forEach((column) => {
            const td = document.createElement("td");
            const value = numericSummary[column]?.mean?.toFixed(2) || '-';
            td.textContent = value;
            tr.appendChild(td);
        });
        tbody.appendChild(tr);
    }

    previewSection.style.display = "block";
    previewSection.classList.add("fade-in");
}

function displayStatistics(stats) {
    const container = document.getElementById("statsContainer");
    container.innerHTML = "<h6>Statistics</h6>";

    if (!stats || !stats.shape) {
        console.error("No statistics data available");
        container.innerHTML += '<p class="text-muted">No statistics available.</p>';
        return;
    }

    const overallStats = [
        { label: "Total Rows", value: stats.shape[0] },
        { label: "Total Columns", value: stats.shape[1] },
        { label: "Numeric Columns", value: Object.keys(stats.numeric_summary || {}).length }
    ];

    overallStats.forEach((stat) => {
        const statItem = document.createElement("div");
        statItem.className = "stats-item col-md-3";
        statItem.innerHTML = `<h6>${stat.label}</h6><p class="stats-value">${stat.value}</p>`;
        container.appendChild(statItem);
    });
}

function displayInsights(insights) {
    const container = document.getElementById("insightsContainer");
    container.innerHTML = "<h6>Data Insights</h6>";

    if (!insights || insights.length === 0) {
        console.error("No insights data available");
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
        console.error("No outliers detected");
        container.innerHTML += '<p class="text-success">No significant outliers detected.</p>';
        return;
    }

    for (const col in outliers) {
        const outlierItem = document.createElement("div");
        outlierItem.className = "insight-item border-warning text-warning bg-warning-light";
        outlierItem.innerHTML = `
            <div class="insight-title">Outliers in ${col}</div>
            <div class="insight-description">Found ${outliers[col].count} outliers (${outliers[col].percentage.toFixed(2)}%): ${outliers[col].outlier_values.join(', ')}</div>
        `;
        container.appendChild(outlierItem);
    }
}

function displayCorrelations(correlations) {
    const container = document.getElementById("insightsContainer");
    container.innerHTML = "<h6>Correlation Analysis</h6>";

    if (!correlations || !correlations.strong_correlations || correlations.strong_correlations.length === 0) {
        console.error("No strong correlations found");
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
    const visualizationSection = document.getElementById("visualization-section");
    visualizationSection.innerHTML = "";

    if (!analysis || !analysis.basic_statistics) {
        console.error("No valid analysis data for charts");
        visualizationSection.innerHTML = '<p class="text-muted">No chart data available.</p>';
        return;
    }

    visualizationSection.innerHTML = `
        <div class="chart-container"><canvas id="chart1"></canvas></div>
        <div class="chart-container"><canvas id="chart3"></canvas></div>
    `;
    createColumnDistributionChart(analysis.basic_statistics);
    createSampleHistogram(analysis.histogram_data);
    visualizationSection.style.display = "block";
}

function createColumnDistributionChart(stats) {
    const ctx = document.getElementById("chart1")?.getContext("2d");
    if (!ctx) {
        console.error("Chart1 canvas not found");
        return;
    }
    if (charts.chart1) charts.chart1.destroy();

    const numericSummary = stats.numeric_summary || {};
    if (Object.keys(numericSummary).length === 0) {
        console.error("No numeric data for column distribution chart");
        document.getElementById("visualization-section").innerHTML = '<p class="text-muted">No numeric data for charts.</p>';
        return;
    }

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

function createSampleHistogram(histogramData) {
    const ctx = document.getElementById("chart3")?.getContext("2d");
    if (!ctx) {
        console.error("Chart3 canvas not found");
        return;
    }
    if (charts.chart3) charts.chart3.destroy();

    if (!histogramData || Object.keys(histogramData).length === 0) {
        console.error("No histogram data available");
        document.getElementById("visualization-section").innerHTML = '<p class="text-muted">No histogram data available.</p>';
        return;
    }

    const col = Object.keys(histogramData)[0];
    if (!col || !histogramData[col]) {
        console.error("No numeric data for histogram");
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

function createScatterPlot(scatterData) {
    console.log("Creating scatter plot with data:", JSON.stringify(scatterData, null, 2));
    const ctx = document.getElementById("chart3")?.getContext("2d");
    if (!ctx) {
        console.error("Chart3 canvas not found");
        document.getElementById("insightsContainer").innerHTML = '<h6>Scatter Plot Results</h6><p class="text-muted">Visualization error: Scatter plot canvas not found.</p>';
        return;
    }
    if (charts.chart3) charts.chart3.destroy();

    if (!scatterData || scatterData.error || !scatterData.data || !scatterData.x_column || !scatterData.y_column) {
        console.error("Invalid scatter plot data:", scatterData?.error || "Missing data or columns");
        document.getElementById("insightsContainer").innerHTML = '<h6>Scatter Plot Results</h6><p class="text-muted">No valid data for scatter plot.</p>';
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
                    pointRadius: 5,
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
        document.getElementById("insightsContainer").innerHTML = `<h6>Scatter Plot Results</h6><p class="text-muted">Error creating scatter plot: ${error.message}</p>`;
    }
}

function showLoading() {
    console.log("Showing loading modal");
    const modalElement = document.getElementById("loadingModal");
    if (!modalElement) {
        console.error("Loading modal element not found");
        return;
    }
    const modal = new bootstrap.Modal(modalElement, { backdrop: "static" });
    modal.show();
}

function hideLoading() {
    console.log("Hiding loading modal");
    const modalElement = document.getElementById("loadingModal");
    const modal = bootstrap.Modal.getInstance(modalElement);
    if (modal) modal.hide();
}
```