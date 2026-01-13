document.addEventListener('DOMContentLoaded', function() {
    // Global variables
    let currentFileId = null;
    let availableColumns = [];
    let currentHistogramChart = null;
    let currentScatterChart = null;
    
    // Navigation
    const navLinks = document.querySelectorAll('.main-nav a');
    const sections = document.querySelectorAll('.section');
    
    navLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const targetId = this.getAttribute('href');
            
            // Update active nav link
            navLinks.forEach(navLink => navLink.parentElement.classList.remove('active'));
            this.parentElement.classList.add('active');
            
            // Show target section
            sections.forEach(section => section.classList.remove('active'));
            document.querySelector(targetId).classList.add('active');
        });
    });
    
    // File upload handling
    const fileInput = document.getElementById('file-input');
    const fileInfo = document.getElementById('file-info');
    const uploadBtn = document.getElementById('upload-btn');
    const uploadForm = document.getElementById('upload-form');
    const previewTable = document.getElementById('preview-table');
    
    fileInput.addEventListener('change', function() {
        if (this.files.length > 0) {
            const file = this.files[0];
            fileInfo.textContent = `${file.name} (${formatFileSize(file.size)})`;
            uploadBtn.disabled = false;
            
            // Preview file (first 5 rows)
            previewFile(file);
        } else {
            fileInfo.textContent = 'No file selected';
            uploadBtn.disabled = true;
        }
    });
    
    uploadForm.addEventListener('submit', function(e) {
        e.preventDefault();
        if (!fileInput.files.length) return;
        
        const file = fileInput.files[0];
        uploadFile(file);
    });
    
    function formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2) + ' ' + sizes[i]);
    }
    
    function previewFile(file) {
        const reader = new FileReader();
        
        reader.onload = function(e) {
            const content = e.target.result;
            let rows = [];
            
            if (file.name.endsWith('.csv')) {
                rows = content.split('\n').slice(0, 6).map(row => row.split(','));
            } else if (file.name.endsWith('.xlsx')) {
                previewTable.innerHTML = '<tr><td colspan="10">Excel preview not available. Upload to see data.</td></tr>';
                return;
            }
            
            // Clear previous preview
            previewTable.innerHTML = '';
            
            // Create header
            const thead = document.createElement('thead');
            const headerRow = document.createElement('tr');
            
            if (rows.length > 0) {
                rows[0].forEach((cell, index) => {
                    const th = document.createElement('th');
                    th.textContent = `Column ${index + 1}`;
                    headerRow.appendChild(th);
                });
            }
            
            thead.appendChild(headerRow);
            previewTable.appendChild(thead);
            
            // Create body
            const tbody = document.createElement('tbody');
            
            rows.slice(1, 6).forEach(row => {
                const tr = document.createElement('tr');
                row.forEach(cell => {
                    const td = document.createElement('td');
                    td.textContent = cell.length > 50 ? cell.substring(0, 50) + '...' : cell;
                    tr.appendChild(td);
                });
                tbody.appendChild(tr);
            });
            
            previewTable.appendChild(tbody);
        };
        
        if (file.name.endsWith('.csv')) {
            reader.readAsText(file);
        } else {
            previewTable.innerHTML = '<tr><td colspan="10">Excel preview not available. Upload to see data.</td></tr>';
        }
    }
    
    function uploadFile(file) {
    const uploadProgress = document.getElementById('upload-progress');
    const progressFill = document.getElementById('progress-fill');
    const progressText = document.getElementById('progress-text');
    const uploadBtn = document.getElementById('upload-btn');

    // Stage 1: Uploading
    uploadProgress.style.display = 'block';
    uploadBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Analysing...';
    uploadBtn.disabled = true;

    const xhr = new XMLHttpRequest();
    const formData = new FormData();
    formData.append('file', file);

    xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
            const percent = Math.round((e.loaded / e.total) * 100);
            progressFill.style.width = `${percent}%`;
            progressText.textContent = `${percent}% Uploaded`;
            
            // Update button text during upload
            if (percent < 50) {
                uploadBtn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> calculating...`;
            } else {
                uploadBtn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Almost done...`;
            }
        }
    });

    xhr.open('POST', '/upload', true);
    
    xhr.onloadstart = function() {
        uploadBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Starting upload...';
    };

    xhr.onload = function() {
        if (xhr.status === 200) {
            const data = JSON.parse(xhr.responseText);
            
            // Stage 2: Processing
            uploadBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Analyzing file...';
            
            if (data.success) {
                currentFileId = data.filename;
                availableColumns = data.available_columns || [];
                
                // Stage 3: Finalizing
                uploadBtn.innerHTML = '<i class="fas fa-check"></i> Analysis complete!';
                setTimeout(() => {
                    uploadBtn.innerHTML = '<i class="fas fa-rocket"></i> Upload & Analyze';
                    uploadBtn.disabled = false;
                }, 2000);
                
                updateColumnSelector();
                document.querySelector('.main-nav li:nth-child(2) a').click();
                loadBasicStats();
            } else {
                uploadBtn.innerHTML = '<i class="fas fa-exclamation-triangle"></i> Upload failed';
                uploadBtn.disabled = false;
            }
        } else {
            uploadBtn.innerHTML = '<i class="fas fa-exclamation-triangle"></i> Upload error';
            uploadBtn.disabled = false;
        }
        uploadProgress.style.display = 'none';
    };
    
    xhr.onerror = function() {
        uploadBtn.innerHTML = '<i class="fas fa-exclamation-triangle"></i> Connection error';
        uploadBtn.disabled = false;
        uploadProgress.style.display = 'none';
    };
    
    xhr.send(formData);
}
    
    // Analysis tabs
    const tabButtons = document.querySelectorAll('.tab-btn');
    
    tabButtons.forEach(button => {
        button.addEventListener('click', function() {
            const tabId = this.getAttribute('data-tab');
            
            // Update active tab button
            tabButtons.forEach(btn => btn.classList.remove('active'));
            this.classList.add('active');
            
            // Show corresponding tab content
            document.querySelectorAll('.tab-content').forEach(content => {
                content.classList.remove('active');
            });
            document.getElementById(tabId).classList.add('active');
            
            // Load content if needed
            if (tabId === 'basic-stats') {
                loadBasicStats();
            } else if (tabId === 'outliers') {
                loadOutliers();
            } else if (tabId === 'correlations') {
                loadCorrelations();
            } else if (tabId === 'histogram') {
                loadHistogram();
            } else if (tabId === 'scatter') {
                loadScatterPlot();
            } else if (tabId === 'data-quality') {
                loadDataQuality();
            }
        });
    });
    
    // Column selection
    const columnSelect = document.getElementById('column-select');
    const applyColumnsBtn = document.getElementById('apply-columns');
    
    function updateColumnSelector() {
        columnSelect.innerHTML = '';
        availableColumns.forEach(col => {
            const option = document.createElement('option');
            option.value = col;
            option.textContent = col;
            columnSelect.appendChild(option);
        });
        
        // Initialize multiselect
        $(columnSelect).select2({
            placeholder: "Select columns to analyze",
            width: '100%'
        });
    }
    
    applyColumnsBtn.addEventListener('click', function() {
        const selectedColumns = Array.from(columnSelect.selectedOptions).map(opt => opt.value);
        
        // Reload current tab with selected columns
        const activeTab = document.querySelector('.tab-content.active').id;
        
        if (activeTab === 'basic-stats') {
            loadBasicStats(selectedColumns);
        } else if (activeTab === 'outliers') {
            loadOutliers(selectedColumns);
        } else if (activeTab === 'correlations') {
            loadCorrelations(selectedColumns);
        } else if (activeTab === 'histogram') {
            loadHistogram(selectedColumns);
        } else if (activeTab === 'scatter') {
            loadScatterPlot(selectedColumns);
        } else if (activeTab === 'data-quality') {
            loadDataQuality(selectedColumns);
        }
    });
    
    // Data loading functions
    /* Enhanced app.js with support for categorical, text, and datetime data types */

// ... [retain your entire existing code before loadBasicStats() as-is] ...

function loadBasicStats(columns = null) {
    if (!currentFileId) return;

    const endpoint = '/analyze';
    const payload = {
        operation: 'basic_stats',
        file_id: currentFileId
    };

    if (columns && columns.length > 0) {
        payload.columns = columns;
    }

    fetch(endpoint, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
    })
    .then(response => response.json())
   .then(data => {
    if (data.success && data.result) {
        displayBasicStats(data.result.numeric_summary);
        displayCategoricalStats(data.result.categorical_summary);
        displayTextStats(data.result.text_summary);
        displayDatetimeStats(data.result.datetime_summary);
    } else {
        showNotification(data.error || 'Failed to load statistics', 'error');
    }
})

    .catch(error => {
        showNotification('Error loading basic stats: ' + error.message, 'error');
    });
}

function displayBasicStats(stats) {
    const container = document.getElementById('basic-stats-content');
    container.innerHTML = '';

    if (stats && Object.keys(stats).length > 0) {
        for (const [column, values] of Object.entries(stats)) {
            const statCard = document.createElement('div');
            statCard.className = 'stat-card';

            statCard.innerHTML = `
                <h4>${column}</h4>
                <div class="stat-value">Mean: ${typeof values.mean === 'number' ? values.mean.toFixed(2) : 'N/A'}</div>
                <div class="stat-description">
                    <span>Min: ${typeof values.min === 'number' ? values.min.toFixed(2) : 'N/A'}</span> |
                    <span>Max: ${typeof values.max === 'number' ? values.max.toFixed(2) : 'N/A'}</span>
                </div>
                <div class="stat-description">
                    <span>Std: ${typeof values.std === 'number' ? values.std.toFixed(2) : 'N/A'}</span> |
                    <span>Median: ${typeof values.median === 'number' ? values.median.toFixed(2) : 'N/A'}</span>
                </div>
            `;

            container.appendChild(statCard);
        }
    } else {
        container.innerHTML = '<div class="no-data">No numeric columns found for analysis</div>';
    }
}

function displayCategoricalStats(stats) {
    const container = document.getElementById('categorical-stats-content');
    container.innerHTML = '';

    if (stats && Object.keys(stats).length > 0) {
        for (const [column, data] of Object.entries(stats)) {
            const card = document.createElement('div');
            card.className = 'stat-card';

            const topValues = Object.entries(data.top_values || {}).slice(0, 3)
                .map(([val, count]) => `${val}: ${count}`).join(', ');

            card.innerHTML = `
                <h4>${column}</h4>
                <div class="stat-value">Most frequent: ${data.most_frequent || 'N/A'}</div>
                <div class="stat-description">Top values: ${topValues || 'N/A'}</div>
            `;
            container.appendChild(card);
        }
    } else {
        container.innerHTML = '<div class="no-data">No categorical columns found</div>';
    }
}

function displayTextStats(stats) {
    const container = document.getElementById('text-stats-content');
    container.innerHTML = '';

    if (stats && Object.keys(stats).length > 0) {
        for (const [column, data] of Object.entries(stats)) {
            const card = document.createElement('div');
            card.className = 'stat-card';

            card.innerHTML = `
                <h4>${column}</h4>
                <div class="stat-value">Avg Length: ${typeof data.avg_length === 'number' ? data.avg_length.toFixed(2) : 'N/A'}</div>
                <div class="stat-description">Most common: ${data.most_common_value || 'N/A'}</div>
            `;
            container.appendChild(card);
        }
    } else {
        container.innerHTML = '<div class="no-data">No text columns found</div>';
    }
}

function displayDatetimeStats(stats) {
    const container = document.getElementById('datetime-stats-content');
    container.innerHTML = '';

    if (stats && Object.keys(stats).length > 0) {
        for (const [column, data] of Object.entries(stats)) {
            const card = document.createElement('div');
            card.className = 'stat-card';

            card.innerHTML = `
                <h4>${column}</h4>
                <div class="stat-value">Range: ${data.min_date || 'N/A'} → ${data.max_date || 'N/A'}</div>
                <div class="stat-description">Days span: ${typeof data.time_span_days === 'number' ? data.time_span_days : 'N/A'}</div>
            `;
            container.appendChild(card);
        }
    } else {
        container.innerHTML = '<div class="no-data">No datetime columns found</div>';
    }
}

    
    function loadOutliers(columns = null) {
        if (!currentFileId) return;
        
        const endpoint = '/analyze';
        const payload = {
            operation: 'outliers',
            file_id: currentFileId
        };
        
        if (columns && columns.length > 0) {
            payload.columns = columns;
        }
        
        fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                displayOutliers(data.result);
            } else {
                showNotification(data.error || 'Failed to load outliers', 'error');
            }
        })
        .catch(error => {
            showNotification('Error loading outliers: ' + error.message, 'error');
        });
    }
    
    function displayOutliers(outliers) {
        const container = document.getElementById('outliers-content');
        container.innerHTML = '';
        
        if (Object.keys(outliers).length === 0) {
            container.innerHTML = '<div class="no-data">No outliers detected in numeric columns</div>';
            return;
        }
        
        for (const [column, data] of Object.entries(outliers)) {
            const outlierCard = document.createElement('div');
            outlierCard.className = 'stat-card';
            
            const severity = data.percentage > 5 ? 'warning' : 'info';
            
            outlierCard.innerHTML = `
                <h4 class="${severity}">${column}</h4>
                <div class="stat-value">${data.count} outliers (${data.percentage.toFixed(2)}%)</div>
                <div class="stat-description">
                    <strong>Sample values:</strong> ${data.outlier_values.slice(0, 5).join(', ')}
                </div>
            `;
            
            container.appendChild(outlierCard);
        }
    }
    
    function loadCorrelations(columns = null) {
        if (!currentFileId) return;
        
        const endpoint = '/analyze';
        const payload = {
            operation: 'correlations',
            file_id: currentFileId
        };
        
        if (columns && columns.length > 0) {
            payload.columns = columns;
        }
        
        fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                displayCorrelations(data.result);
            } else {
                showNotification(data.error || 'Failed to load correlations', 'error');
            }
        })
        .catch(error => {
            showNotification('Error loading correlations: ' + error.message, 'error');
        });
    }
    
    function displayCorrelations(correlations) {
        const matrixContainer = document.getElementById('correlation-matrix');
        const strongContainer = document.getElementById('strong-correlations');
        
        matrixContainer.innerHTML = '';
        strongContainer.innerHTML = '';
        
        if (correlations.error) {
            matrixContainer.innerHTML = `<div class="no-data">${correlations.error}</div>`;
            return;
        }
        
        // Display strong correlations
        if (correlations.strong_correlations && correlations.strong_correlations.length > 0) {
            strongContainer.innerHTML = '<h3>Strong Correlations</h3>';
            
            correlations.strong_correlations.forEach(corr => {
                const corrCard = document.createElement('div');
                corrCard.className = 'stat-card';
                
                corrCard.innerHTML = `
                    <h4>${corr.column1} ↔ ${corr.column2}</h4>
                    <div class="stat-value">${corr.correlation.toFixed(3)} (${corr.strength})</div>
                `;
                
                strongContainer.appendChild(corrCard);
            });
        } else {
            strongContainer.innerHTML = '<div class="no-data">No strong correlations found</div>';
        }
    }
    
    function loadHistogram(columns = null) {
        if (!currentFileId) return;
        
        const endpoint = '/analyze';
        const payload = {
            operation: 'histogram',
            file_id: currentFileId
        };
        
        if (columns && columns.length > 0) {
            payload.columns = columns;
        }
        
        fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                displayHistogram(data.result);
            } else {
                showNotification(data.error || 'Failed to load histogram', 'error');
            }
        })
        .catch(error => {
            showNotification('Error loading histogram: ' + error.message, 'error');
        });
    }
    
    function displayHistogram(histogramData) {
        const chartCanvas = document.getElementById('histogram-chart');
        const columnSelect = document.getElementById('histogram-column-select');
        
        columnSelect.innerHTML = '';
        
        if (Object.keys(histogramData).length === 0) {
            if (currentHistogramChart) {
                currentHistogramChart.destroy();
            }
            chartCanvas.parentElement.innerHTML = '<div class="no-data">No numeric columns available for histogram</div>';
            return;
        }
        
        // Populate column selector
        Object.keys(histogramData).forEach(col => {
            const option = document.createElement('option');
            option.value = col;
            option.textContent = col;
            columnSelect.appendChild(option);
        });
        
        // Display first column by default
        const firstColumn = Object.keys(histogramData)[0];
        renderHistogramChart(histogramData[firstColumn], firstColumn);
        
        // Add event listener for column change
        columnSelect.addEventListener('change', function() {
            const selectedCol = this.value;
            renderHistogramChart(histogramData[selectedCol], selectedCol);
        });
    }
    
    function renderHistogramChart(histogramData, columnName) {
        if (currentHistogramChart) {
            currentHistogramChart.destroy();
        }
        
        const ctx = document.getElementById('histogram-chart').getContext('2d');
        
        currentHistogramChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: histogramData.labels,
                datasets: [{
                    label: `Distribution of ${columnName}`,
                    data: histogramData.counts,
                    backgroundColor: 'rgba(67, 97, 238, 0.7)',
                    borderColor: 'rgba(67, 97, 238, 1)',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: 'Frequency'
                        }
                    },
                    x: {
                        title: {
                            display: true,
                            text: 'Value Range'
                        }
                    }
                }
            }
        });
    }
    
    function loadScatterPlot(columns = null) {
        if (!currentFileId) return;
        
        const endpoint = '/analyze';
        const payload = {
            operation: 'scatter_plot',
            file_id: currentFileId
        };
        
        if (columns && columns.length > 0) {
            payload.columns = columns;
        }
        
        fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                displayScatterPlot(data.result);
            } else {
                showNotification(data.error || 'Failed to load scatter plot', 'error');
            }
        })
        .catch(error => {
            showNotification('Error loading scatter plot: ' + error.message, 'error');
        });
    }
    
    function displayScatterPlot(scatterData) {
        const chartCanvas = document.getElementById('scatter-chart');
        const xAxisSelect = document.getElementById('x-axis-select');
        const yAxisSelect = document.getElementById('y-axis-select');
        
        xAxisSelect.innerHTML = '';
        yAxisSelect.innerHTML = '';
        
        if (scatterData.error) {
            if (currentScatterChart) {
                currentScatterChart.destroy();
            }
            chartCanvas.parentElement.innerHTML = `<div class="no-data">${scatterData.error}</div>`;
            return;
        }
        
        // Get all numeric columns for selection
        const numericColumns = availableColumns.filter(col => {
            return scatterData.data.some(item => item[col] !== undefined && typeof item[col] === 'number');
        });
        
        if (numericColumns.length < 2) {
            chartCanvas.parentElement.innerHTML = '<div class="no-data">Need at least two numeric columns for scatter plot</div>';
            return;
        }
        
        // Populate axis selectors
        numericColumns.forEach(col => {
            const option1 = document.createElement('option');
            option1.value = col;
            option1.textContent = col;
            xAxisSelect.appendChild(option1.cloneNode(true));
            
            const option2 = option1.cloneNode(true);
            yAxisSelect.appendChild(option2);
        });
        
        // Set default selections
        xAxisSelect.value = scatterData.x_column || numericColumns[0];
        yAxisSelect.value = scatterData.y_column || numericColumns[1];
        
        // Render initial chart
        renderScatterChart(
            scatterData.data,
            xAxisSelect.value,
            yAxisSelect.value
        );
        
        // Add event listeners for axis changes
        xAxisSelect.addEventListener('change', updateScatterChart);
        yAxisSelect.addEventListener('change', updateScatterChart);
        
        function updateScatterChart() {
            renderScatterChart(
                scatterData.data,
                xAxisSelect.value,
                yAxisSelect.value
            );
        }
    }
    
    function renderScatterChart(data, xColumn, yColumn) {
        if (currentScatterChart) {
            currentScatterChart.destroy();
        }
        
        const filteredData = data.filter(item => 
            item[xColumn] !== null && item[yColumn] !== null
        );
        
        const ctx = document.getElementById('scatter-chart').getContext('2d');
        
        currentScatterChart = new Chart(ctx, {
            type: 'scatter',
            data: {
                datasets: [{
                    label: `${xColumn} vs ${yColumn}`,
                    data: filteredData.map(item => ({
                        x: item[xColumn],
                        y: item[yColumn]
                    })),
                    backgroundColor: 'rgba(239, 35, 60, 0.7)',
                    borderColor: 'rgba(239, 35, 60, 1)',
                    borderWidth: 1,
                    pointRadius: 5
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: {
                        title: {
                            display: true,
                            text: xColumn
                        }
                    },
                    y: {
                        title: {
                            display: true,
                            text: yColumn
                        }
                    }
                }
            }
        });
    }
    
    function loadDataQuality(columns = null) {
        if (!currentFileId) return;
        
        const endpoint = '/analyze';
        const payload = {
            operation: 'data_quality',
            file_id: currentFileId
        };
        
        if (columns && columns.length > 0) {
            payload.columns = columns;
        }
        
        fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                displayDataQuality(data.result);
            } else {
                showNotification(data.error || 'Failed to load data quality report', 'error');
            }
        })
        .catch(error => {
            showNotification('Error loading data quality report: ' + error.message, 'error');
        });
    }
    
    function displayDataQuality(qualityData) {
        const container = document.getElementById('quality-metrics');
        container.innerHTML = '';
        
        // Missing values
        const missingCard = document.createElement('div');
        missingCard.className = 'stat-card';
        
        const missingValues = Object.values(qualityData.missing_values).reduce((a, b) => a + b, 0);
        const totalCells = Object.keys(qualityData.missing_values).length * qualityData.shape[0];
        const missingPercentage = (missingValues / totalCells) * 100;
        
        missingCard.innerHTML = `
            <h4>Missing Values</h4>
            <div class="stat-value">${missingValues} missing (${missingPercentage.toFixed(2)}%)</div>
            <div class="stat-description">
                <strong>Columns with missing values:</strong> 
                ${Object.entries(qualityData.missing_values)
                    .filter(([_, count]) => count > 0)
                    .map(([col, count]) => `${col} (${count})`)
                    .join(', ')}
            </div>
        `;
        
        container.appendChild(missingCard);
        
        // Duplicates
        const dupCard = document.createElement('div');
        dupCard.className = 'stat-card';
        
        dupCard.innerHTML = `
            <h4>Duplicate Rows</h4>
            <div class="stat-value">${qualityData.duplicates} duplicates</div>
        `;
        
        container.appendChild(dupCard);
        
        // Empty/Constant columns
        if (qualityData.empty_columns.length > 0 || qualityData.constant_columns.length > 0) {
            const issueCard = document.createElement('div');
            issueCard.className = 'stat-card';
            
            let issues = [];
            if (qualityData.empty_columns.length > 0) {
                issues.push(`Empty columns: ${qualityData.empty_columns.join(', ')}`);
            }
            if (qualityData.constant_columns.length > 0) {
                issues.push(`Constant columns: ${qualityData.constant_columns.join(', ')}`);
            }
            
            issueCard.innerHTML = `
                <h4 class="warning">Data Quality Issues</h4>
                <div class="stat-description">
                    ${issues.join('<br>')}
                </div>
            `;
            
            container.appendChild(issueCard);
        }
    }
    
    // Insights section
    const refreshInsightsBtn = document.getElementById('refresh-insights');
    
    refreshInsightsBtn.addEventListener('click', function() {
        loadInsights();
    });
    
    function loadInsights(columns = null) {
        if (!currentFileId) return;
        
        const endpoint = '/analyze';
        const payload = {
            operation: 'insights',
            file_id: currentFileId
        };
        
        if (columns && columns.length > 0) {
            payload.columns = columns;
        }
        
        refreshInsightsBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Generating...';
        refreshInsightsBtn.disabled = true;
        
        fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                displayInsights(data.result);
                showNotification('Insights generated successfully!', 'success');
            } else {
                showNotification(data.error || 'Failed to generate insights', 'error');
            }
        })
        .catch(error => {
            showNotification('Error generating insights: ' + error.message, 'error');
        })
        .finally(() => {
            refreshInsightsBtn.innerHTML = '<i class="fas fa-sync-alt"></i> Generate New Insights';
            refreshInsightsBtn.disabled = false;
        });
    }
    
    function displayInsights(insights) {
        const container = document.getElementById('insights-container');
        container.innerHTML = '';
        
        if (!insights || insights.length === 0) {
            container.innerHTML = '<div class="no-data">No insights generated</div>';
            return;
        }
        
        insights.forEach(insight => {
            const insightCard = document.createElement('div');
            insightCard.className = `insight-card ${insight.severity || 'info'}`;
            
            let icon = '';
            if (insight.severity === 'warning') {
                icon = '<i class="fas fa-exclamation-triangle"></i>';
            } else if (insight.severity === 'danger') {
                icon = '<i class="fas fa-exclamation-circle"></i>';
            } else {
                icon = '<i class="fas fa-info-circle"></i>';
            }
            
            insightCard.innerHTML = `
                <h3>${icon} ${insight.title}</h3>
                <p>${insight.description}</p>
            `;
            
            container.appendChild(insightCard);
        });
    }
    
    // Helper functions
    function showNotification(message, type = 'info') {
        // In a real app, you might use a proper notification library
        alert(`${type.toUpperCase()}: ${message}`);
    }
    
    // Initialize
    if (window.location.hash) {
        const targetSection = document.querySelector(window.location.hash);
        if (targetSection) {
            document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
            targetSection.classList.add('active');
            
            const navItem = document.querySelector(`.main-nav a[href="${window.location.hash}"]`);
            if (navItem) {
                document.querySelectorAll('.main-nav li').forEach(li => li.classList.remove('active'));
                navItem.parentElement.classList.add('active');
            }
        }
    }
    
    // Load jQuery and Select2 (needed for multiselect)
    const jqueryScript = document.createElement('script');
    jqueryScript.src = 'https://code.jquery.com/jquery-3.6.0.min.js';
    document.head.appendChild(jqueryScript);
    
    jqueryScript.onload = function() {
        const select2Script = document.createElement('script');
        select2Script.src = 'https://cdn.jsdelivr.net/npm/select2@4.1.0-rc.0/dist/js/select2.min.js';
        document.head.appendChild(select2Script);
        
        const select2Style = document.createElement('link');
        select2Style.rel = 'stylesheet';
        select2Style.href = 'https://cdn.jsdelivr.net/npm/select2@4.1.0-rc.0/dist/css/select2.min.css';
        document.head.appendChild(select2Style);
    };
});