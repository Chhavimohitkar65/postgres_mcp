/**
 * Main Application Controller
 */
document.addEventListener('DOMContentLoaded', () => {
    // ===== ELEMENT REFERENCES =====
    // Query elements
    const queryInput = document.getElementById('queryInput');
    const executeQueryBtn = document.getElementById('executeQueryBtn');
    const clearQueryBtn = document.getElementById('clearQueryBtn');
    const queryResultsContainer = document.getElementById('queryResultsContainer');
    const queryStatusEl = document.getElementById('queryStatus');
    
    // UI elements
    const loadingOverlay = document.getElementById('loadingOverlay');
    const themeToggle = document.getElementById('themeToggle');
    const refreshBtn = document.getElementById('refreshBtn');
    
    // Metric elements
    const tableCountEl = document.getElementById('tableCount');
    const totalRowsEl = document.getElementById('totalRows');
    const dbSizeEl = document.getElementById('dbSize');
    const querySuccessEl = document.getElementById('querySuccess');

    // ===== UI INTERACTION HANDLERS =====

    // Theme Toggle
    themeToggle.addEventListener('click', () => {
        document.body.classList.toggle('dark-mode');
        const isDarkMode = document.body.classList.contains('dark-mode');
        themeToggle.innerHTML = isDarkMode 
            ? '<i class="ri-sun-line"></i>' 
            : '<i class="ri-moon-line"></i>';
        
        // Store preference
        localStorage.setItem('darkMode', isDarkMode);
    });
    
    // Apply saved theme preference
    if (localStorage.getItem('darkMode') === 'true') {
        document.body.classList.add('dark-mode');
        themeToggle.innerHTML = '<i class="ri-sun-line"></i>';
    }
    
    // Navigation between sections
    document.querySelectorAll('.menu-item[data-section]').forEach(item => {
        item.addEventListener('click', () => {
            // Update active menu item
            document.querySelectorAll('.menu-item[data-section]').forEach(mi => {
                mi.classList.remove('active');
            });
            item.classList.add('active');
            
            // Show the corresponding section
            const sectionId = item.getAttribute('data-section');
            document.querySelectorAll('.content-section').forEach(section => {
                section.classList.remove('active');
            });
            document.getElementById(`${sectionId}-section`)?.classList.add('active');
        });
    });

    // Clear Query Input
    clearQueryBtn.addEventListener('click', () => {
        queryInput.value = '';
        queryResultsContainer.innerHTML = '';
        queryStatusEl.innerHTML = '';
    });

    // Refresh Dashboard
    refreshBtn?.addEventListener('click', () => {
        loadingOverlay.style.display = 'flex';
        Promise.all([
            loadTableCounts(),
            loadDataTypeDistribution(),
            loadQueryPerformance(),
            loadDatabaseMetrics()
        ])
        .finally(() => {
            loadingOverlay.style.display = 'none';
        });
    });

    // ===== DATA/STATE MANAGEMENT =====
    
    // Store insights globally for context
    window.currentInsights = {};

    // Execute Query
    executeQueryBtn.addEventListener('click', async () => {
        const query = queryInput.value.trim();
        
        if (!query) {
            showQueryStatus('Please enter a SQL query or natural language question', 'error');
            return;
        }

        try {
            // Show loading overlay
            loadingOverlay.style.display = 'flex';

            // Send both query and current insights
            const response = await fetch('/api/mcp/query', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ 
                    query,
                    insights: window.currentInsights 
                })
            });
            
            // Parse response
            const result = await response.json();
            
            // Clear previous results
            queryResultsContainer.innerHTML = '';
            queryStatusEl.innerHTML = '';

            if (result.success) {
                // Show success status
                showQueryStatus(`Query successful: ${result.data.length} rows returned`, 'success');

                // Display query results
                displayQueryResults(result.data);
                
                // Analyze the query results for visualization
                analyzeQueryResults(result.data);
            } else {
                showQueryStatus(result.error, 'error');
            }
        } catch (error) {
            showQueryStatus(error.message, 'error');
        } finally {
            // Hide loading overlay
            loadingOverlay.style.display = 'none';
        }
    });

    // ===== UTILITY FUNCTIONS =====

    // Show Query Status
    function showQueryStatus(message, type) {
        queryStatusEl.textContent = message;
        queryStatusEl.className = `query-status ${type}`;
    }
    
    // Format number with commas
    function formatNumber(num) {
        return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    }
    
    // ===== RESULTS DISPLAY FUNCTIONS =====
    
    // Display query results
    function displayQueryResults(data) {
        if (!data || data.length === 0) {
            queryResultsContainer.innerHTML = '<p class="no-results">No results returned</p>';
            return;
        }
        
        // Create results container
        const resultsGrid = document.createElement('div');
        resultsGrid.className = 'results-grid';
        
        // Create table for results
        const table = document.createElement('table');
        table.classList.add('results-table');
        
        // Create table header
        const thead = document.createElement('thead');
        const headerRow = document.createElement('tr');
        Object.keys(data[0]).forEach(key => {
            const th = document.createElement('th');
            th.textContent = key;
            headerRow.appendChild(th);
        });
        thead.appendChild(headerRow);
        table.appendChild(thead);
        
        // Create table body with row limit
        const tbody = document.createElement('tbody');
        
        // Limit to 1000 rows for display
        const displayLimit = 1000;
        const displayCount = Math.min(data.length, displayLimit);
        
        for (let i = 0; i < displayCount; i++) {
            const row = data[i];
            const tr = document.createElement('tr');
            Object.values(row).forEach(value => {
                const td = document.createElement('td');
                td.textContent = value ?? 'NULL';
                tr.appendChild(td);
            });
            tbody.appendChild(tr);
        }
        table.appendChild(tbody);
        
        // Add row count indicator if truncated
        if (data.length > displayLimit) {
            const notice = document.createElement('div');
            notice.className = 'truncation-notice';
            notice.textContent = `Showing ${displayLimit} of ${data.length} rows`;
            resultsGrid.appendChild(notice);
        }
        
        // Append table
        resultsGrid.appendChild(table);
        queryResultsContainer.appendChild(resultsGrid);
        
        // Add chart containers
        const chartsContainer = document.createElement('div');
        chartsContainer.className = 'charts-grid';
        
        const chartTypes = [
            { id: 'queryResultBarChart', title: 'Bar Chart', type: 'bar' },
            { id: 'queryResultPieChart', title: 'Pie Chart', type: 'pie' },
            { id: 'queryResultLineChart', title: 'Line Chart', type: 'line' },
            { id: 'queryResultScatterChart', title: 'Scatter Plot', type: 'scatter' }
        ];
        
        chartTypes.forEach(chart => {
            const chartCard = document.createElement('div');
            chartCard.className = 'chart-card';
            chartCard.innerHTML = `
                <h3>${chart.title}</h3>
                <canvas id="${chart.id}"></canvas>
            `;
            chartsContainer.appendChild(chartCard);
        });
        
        queryResultsContainer.appendChild(chartsContainer);
        
        // Generate visualizations
        generateQueryResultCharts(data);
    }

    // Generate Charts from Query Results
    function generateQueryResultCharts(data) {
        if (!data || data.length === 0) return;
        
        // Limit data points for visualization
        const visualizationLimit = 50; // Limit data points for charts
        let visualizationData = data;
        
        // If data exceeds limit, sample it
        if (data.length > visualizationLimit) {
            visualizationData = sampleDataForVisualization(data, visualizationLimit);
        }
        
        // Get the first row for single-value charts
        const firstRow = visualizationData[0];
        
        // Get keys and values for charts
        const keys = Object.keys(firstRow);
        const values = Object.values(firstRow);
        
        // For numeric columns only
        const numericColumns = keys.filter(key => 
            !isNaN(parseFloat(firstRow[key])) && isFinite(firstRow[key])
        );
        
        // For categorical columns
        const categoricalColumns = keys.filter(key => 
            isNaN(parseFloat(firstRow[key])) || !isFinite(firstRow[key])
        );
        
        // Bar chart: First row values
        customCharts.createBarChart('queryResultBarChart', keys, values, 'Data Distribution');
        
        // Pie chart: First row values (limit to 8 slices)
        const pieKeys = keys.slice(0, 8);
        const pieValues = values.slice(0, 8);
        customCharts.createPieChart('queryResultPieChart', pieKeys, pieValues, 'Data Composition');
        
        // Line chart: If we have multiple rows, use the first numeric column as Y values
        if (visualizationData.length > 1 && numericColumns.length > 0) {
            // Use index or first categorical column as X-axis
            const xValues = categoricalColumns.length > 0 
                ? visualizationData.map(row => row[categoricalColumns[0]])
                : visualizationData.map((_, i) => i + 1);
                
            // Use first numeric column for Y values
            const yValues = visualizationData.map(row => parseFloat(row[numericColumns[0]]));
            
            customCharts.createLineChart('queryResultLineChart', xValues, yValues, 
                `${numericColumns[0]} Trend (Sample)`, { tension: 0.3 });
        } else {
            // Fall back to single row visualization
            customCharts.createLineChart('queryResultLineChart', keys, values, 'Value Distribution');
        }
        
        // Scatter plot: If we have multiple rows and at least 2 numeric columns
        if (visualizationData.length > 1 && numericColumns.length >= 2) {
            const scatterCtx = document.getElementById('queryResultScatterChart').getContext('2d');
            const scatterData = visualizationData.map(row => ({
                x: parseFloat(row[numericColumns[0]]),
                y: parseFloat(row[numericColumns[1]])
            }));
            
            new Chart(scatterCtx, {
                type: 'scatter',
                data: {
                    datasets: [{
                        label: `${numericColumns[0]} vs ${numericColumns[1]}`,
                        data: scatterData,
                        backgroundColor: 'rgba(153, 102, 255, 0.7)',
                        borderColor: 'rgba(153, 102, 255, 1)',
                        borderWidth: 1,
                        pointRadius: 5,
                        pointHoverRadius: 7
                    }]
                },
                options: {
                    responsive: true,
                    plugins: {
                        legend: {
                            position: 'top',
                        },
                        title: {
                            display: true,
                            text: visualizationData.length < data.length 
                                ? 'Correlation Analysis (Sampled Data)'
                                : 'Correlation Analysis'
                        }
                    },
                    scales: {
                        x: {
                            title: {
                                display: true,
                                text: numericColumns[0]
                            }
                        },
                        y: {
                            title: {
                                display: true,
                                text: numericColumns[1]
                            }
                        }
                    }
                }
            });
        }
    }
    
    /**
     * Sample data for visualization to avoid overwhelming charts
     * @param {Array} data - The full dataset
     * @param {Number} limit - Maximum number of data points
     * @returns {Array} Sampled data
     */
    function sampleDataForVisualization(data, limit) {
        if (data.length <= limit) return data;
        
        // For very large datasets, use a systematic sampling approach
        if (data.length > limit * 10) {
            const interval = Math.floor(data.length / limit);
            return data.filter((_, i) => i % interval === 0).slice(0, limit);
        }
        
        // For moderately large datasets, take evenly distributed samples
        const sampledData = [];
        const interval = data.length / limit;
        
        for (let i = 0; i < limit; i++) {
            const index = Math.floor(i * interval);
            sampledData.push(data[index]);
        }
        
        return sampledData;
    }
    
    // Analyze query results and suggest visualizations
    async function analyzeQueryResults(data) {
        try {
            // Call the visualization analyzer endpoint
            const response = await fetch('/api/mcp/visualize', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ data })
            });
            
            const result = await response.json();
            
            if (result.success && result.recommendations) {
                displayVisualizationRecommendations(result.recommendations, data);
            }
        } catch (error) {
            console.error('Error analyzing query results:', error);
        }
    }
    
    // Display visualization recommendations
    function displayVisualizationRecommendations(recommendations, data) {
        if (!recommendations || recommendations.length === 0) return;
        
        // Create recommendations container
        const recommendationsSection = document.createElement('div');
        recommendationsSection.className = 'recommendations-section';
        recommendationsSection.innerHTML = `
            <h3>Suggested Visualizations</h3>
            <div class="recommendations-grid"></div>
        `;
        
        const grid = recommendationsSection.querySelector('.recommendations-grid');
        
        // Add each recommendation
        recommendations.forEach((rec, index) => {
            const card = document.createElement('div');
            card.className = 'chart-card';
            card.innerHTML = `
                <h3>${rec.title || `Recommendation ${index + 1}`}</h3>
                <p>${rec.description || ''}</p>
                <canvas id="recChart${index}"></canvas>
            `;
            grid.appendChild(card);
            
            // Generate the recommended chart
            createRecommendedChart(`recChart${index}`, rec, data);
        });
        
        queryResultsContainer.appendChild(recommendationsSection);
    }

    // Create a chart based on recommendation
    function createRecommendedChart(canvasId, recommendation, data) {
        const type = recommendation.type || 'bar';
        const title = recommendation.title || '';
        const columns = recommendation.columns || {};
        
        // Extract data based on columns
        let chartData = {};
        
        if (type === 'bar' || type === 'line') {
            const xValues = columns.x 
                ? data.map(row => row[columns.x])
                : data.map((_, i) => i + 1);
                
            const yValues = columns.y
                ? data.map(row => parseFloat(row[columns.y]))
                : [];
                
            if (type === 'bar') {
                customCharts.createBarChart(canvasId, xValues, yValues, title);
            } else {
                customCharts.createLineChart(canvasId, xValues, yValues, title);
            }
        } else if (type === 'pie') {
            const labels = columns.labels
                ? data.map(row => row[columns.labels])
                : [];
                
            const values = columns.values
                ? data.map(row => parseFloat(row[columns.values]))
                : [];
                
            customCharts.createPieChart(canvasId, labels, values, title);
        }
    }

    // ===== DATA LOADING FUNCTIONS =====

    // Load Table Counts
    async function loadTableCounts() {
        try {
            const response = await fetch('/api/mcp/stats');
            const data = await response.json();
            
            if (data && data.table_counts) {
                const tableData = data.table_counts;
                
                // Update metrics card
                if (tableCountEl) {
                    tableCountEl.textContent = tableData.length;
                }
                
                // Calculate total rows
                const totalRows = tableData.reduce((sum, table) => sum + (table.row_count || 0), 0);
                if (totalRowsEl) {
                    totalRowsEl.textContent = formatNumber(totalRows);
                }
                
                // Sort tables by row count (descending)
                const sortedData = [...tableData].sort((a, b) => b.row_count - a.row_count);
                
                // Limit display to 1000 rows total or top 15 tables, whichever is smaller
                let displayData = [];
                let currentTotal = 0;
                let otherRowCount = 0;
                
                for (let i = 0; i < sortedData.length; i++) {
                    if (i < 15 && currentTotal < 1000) {
                        displayData.push(sortedData[i]);
                        currentTotal += sortedData[i].row_count;
                    } else {
                        otherRowCount += sortedData[i].row_count;
                    }
                }
                
                // Add an "Other" category if we had to truncate the list
                if (otherRowCount > 0) {
                    displayData.push({
                        table_name: 'Other Tables',
                        row_count: otherRowCount
                    });
                }
                
                // Create bar chart with limited data
                const labels = displayData.map(table => table.table_name);
                const counts = displayData.map(table => table.row_count);
                
                customCharts.createBarChart('tableCountChart', labels, counts, 'Table Row Counts (Limited to 1000 Rows)', {
                    indexAxis: 'y',
                    barThickness: Math.min(20, 200 / labels.length)  // Adjust bar thickness based on count
                });
                
                // Store data for context
                window.currentInsights.table_counts = tableData;
            }
        } catch (error) {
            console.error('Failed to load table counts:', error);
        }
    }

    // Load Data Type Distribution
    async function loadDataTypeDistribution() {
        try {
            const response = await fetch('/api/mcp/stats');
            const data = await response.json();
            
            if (data && data.data_type_distribution) {
                const distributionData = data.data_type_distribution;
                
                // Create pie chart
                const labels = Object.keys(distributionData);
                const counts = Object.values(distributionData);
                customCharts.createPieChart('dataTypeChart', labels, counts, 'Data Type Distribution', {
                    cutout: 40, // Doughnut chart
                });
                
                // Store data for context
                window.currentInsights.data_type_distribution = distributionData;
            }
        } catch (error) {
            console.error('Failed to load data type distribution:', error);
        }
    }

    // Load Query Performance
    async function loadQueryPerformance() {
        try {
            const response = await fetch('/api/mcp/performance');
            let data = await response.json();

            // Update query success rate
            if (querySuccessEl && data.query_success_rate) {
                querySuccessEl.textContent = `${data.query_success_rate}%`;
            }

            // Format data for chart
            let labels, values;
            
            if (Array.isArray(data)) {
                // Array format
                labels = data.map(query => `Query ${query.query_id}`);
                values = data.map(query => query.duration);
            } else {
                // Object format
                labels = Object.keys(data);
                values = Object.values(data);
                
                // Filter out non-numeric properties
                const validIndices = values.map((v, i) => typeof v === 'number' ? i : -1).filter(i => i >= 0);
                labels = validIndices.map(i => labels[i]);
                values = validIndices.map(i => values[i]);
            }

            // Create chart
            customCharts.createLineChart('queryPerformanceChart', labels, values, 'Query Performance', {
                        borderColor: 'rgba(75, 192, 192, 1)',
                tension: 0.3,
                fill: true
            });
            
            // Store data for context
            window.currentInsights.query_performance = Array.isArray(data) ? data : 
                Object.fromEntries(labels.map((label, i) => [label, values[i]]));
        } catch (error) {
            console.error('Failed to load query performance:', error);
        }
    }
    
    // Load Database Metrics
    async function loadDatabaseMetrics() {
        try {
            const response = await fetch('/api/mcp/metrics');
            const data = await response.json();
            
            // Update database size
            if (dbSizeEl && data.size) {
                dbSizeEl.textContent = data.size;
            }
            
            // Additional metrics could be displayed here
        } catch (error) {
            console.error('Failed to load database metrics:', error);
            // Fallback value
            if (dbSizeEl) {
                dbSizeEl.textContent = 'N/A';
            }
        }
    }

    // ===== INITIALIZATION =====
    
    // Initialize application components
    async function initializeApp() {
        // Show loading overlay
        loadingOverlay.style.display = 'flex';
        
        try {
            // Initialize real-time monitoring
            initializeRealTimeMonitoring();
            
            // Initialize advanced visualizations
            const advancedCharts = new AdvancedCharts();
            advancedCharts.initRealtimeActivityChart();
            
            // Initialize table analysis module
            initTableAnalysis();
            
            // Load initial data
            await Promise.all([
                loadTableCounts(),
                loadDataTypeDistribution(),
                loadQueryPerformance(),
                loadDatabaseMetrics()
            ]);
        } catch (error) {
            console.error('Error initializing application:', error);
        } finally {
            // Hide loading overlay
            loadingOverlay.style.display = 'none';
        }
    }
    
    // Start initialization
    initializeApp();
});

function generateChartCard(title, chartId, size = 'medium') {
    const card = document.createElement('div');
    card.className = `chart-card chart-size-${size}`;
    
    const titleElement = document.createElement('h3');
    titleElement.className = 'chart-title';
    titleElement.textContent = title;
    
    const chartContainer = document.createElement('div');
    chartContainer.className = 'chart-container';
    
    const canvas = document.createElement('canvas');
    canvas.id = chartId;
    
    chartContainer.appendChild(canvas);
    card.appendChild(titleElement);
    card.appendChild(chartContainer);
    
    return card;
}

function loadTableCounts() {
    apiClient.getDatabaseSchema()
        .then(schema => {
            if (!schema || !schema.tables) {
                console.error('Invalid schema data');
                return;
            }
            
            // Sort tables by row count (descending)
            const sortedTables = [...schema.tables].sort((a, b) => b.row_count - a.row_count);
            
            // Extract labels and data for visualization
            const labels = [];
            const counts = [];
            let totalRows = 0;
            let includedRows = 0;
            const maxRowsToShow = 1000;
            const maxTablesToShow = 15;
            
            for (let i = 0; i < Math.min(sortedTables.length, maxTablesToShow); i++) {
                if (includedRows >= maxRowsToShow) break;
                
                const table = sortedTables[i];
                totalRows += table.row_count;
                
                // Add this table's data if it won't exceed our display limit
                if (includedRows + table.row_count <= maxRowsToShow) {
                    labels.push(table.table_name);
                    counts.push(table.row_count);
                    includedRows += table.row_count;
                } else {
                    // If this table would exceed our limit, only include part of it
                    const remainingSpace = maxRowsToShow - includedRows;
                    if (remainingSpace > 0) {
                        labels.push(`${table.table_name} (partial)`);
                        counts.push(remainingSpace);
                        includedRows += remainingSpace;
                    }
                    break;
                }
            }
            
            // Add an "Other" category if we didn't include all rows
            if (totalRows > includedRows) {
                labels.push('Other');
                counts.push(totalRows - includedRows);
            }
            
            // Calculate bar thickness based on number of tables
            const barThickness = Math.max(10, Math.min(25, 300 / labels.length));
            
            // Create a chart card with appropriate size based on data
            const size = labels.length > 10 ? 'large' : labels.length > 5 ? 'medium' : 'small';
            const chartCard = generateChartCard('Table Row Counts (Limited to 1000 Rows)', 'tableRowsChart', size);
            document.getElementById('database-charts').appendChild(chartCard);
            
            // Create the chart
            customCharts.createBarChart('tableRowsChart', labels, counts, '', {
                indexAxis: 'y',
                barThickness: barThickness,
                compact: true
            });
        })
        .catch(error => {
            console.error('Failed to load table counts:', error);
            showError('Failed to load table counts. See console for details.');
        });
}

function displayQueryResults(data) {
    resultsContainer.classList.remove('hidden');
    resultsGrid.innerHTML = '';
    
    if (!data || !data.columns || !data.rows) {
        resultsGrid.innerHTML = '<p class="error">No results or invalid data structure</p>';
        return;
    }
    
    // Create results table
    const table = document.createElement('table');
    table.className = 'results-table';
    
    // Create table header
    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    
    data.columns.forEach(column => {
        const th = document.createElement('th');
        th.textContent = column;
        headerRow.appendChild(th);
    });
    
    thead.appendChild(headerRow);
    table.appendChild(thead);
    
    // Create table body
    const tbody = document.createElement('tbody');
    
    // Limit displayed rows for performance
    const displayLimit = 1000;
    const rowsToDisplay = data.rows.slice(0, displayLimit);
    
    rowsToDisplay.forEach(row => {
        const tr = document.createElement('tr');
        
        row.forEach(cell => {
            const td = document.createElement('td');
            // Format cell data appropriately
            if (cell === null) {
                td.innerHTML = '<span class="null-value">NULL</span>';
            } else if (typeof cell === 'object') {
                td.textContent = JSON.stringify(cell);
            } else {
                td.textContent = cell.toString();
            }
            tr.appendChild(td);
        });
        
        tbody.appendChild(tr);
    });
    
    table.appendChild(tbody);
    resultsGrid.appendChild(table);
    
    // Show truncation notice if needed
    if (data.rows.length > displayLimit) {
        const truncationNotice = document.createElement('div');
        truncationNotice.className = 'truncation-notice';
        truncationNotice.textContent = `Showing ${displayLimit} of ${data.rows.length} rows. Download the full results for complete data.`;
        resultsGrid.appendChild(truncationNotice);
    }
    
    // Generate result statistics
    const resultStats = document.createElement('div');
    resultStats.className = 'result-stats';
    resultStats.textContent = `${data.rows.length} rows returned`;
    
    // Add execution time if available
    if (data.execution_time) {
        resultStats.textContent += ` in ${data.execution_time.toFixed(2)} ms`;
    }
    
    resultsGrid.appendChild(resultStats);
    
    // Generate charts for the data if appropriate
    generateQueryResultCharts(data);
}

function generateQueryResultCharts(data) {
    // Clear previous charts
    chartsContainer.innerHTML = '';
    
    if (!data || !data.columns || !data.rows || data.rows.length === 0) {
        return;
    }
    
    // Sample data for visualization if it's large
    const sampleData = sampleDataForVisualization(data);
    
    // Determine if we can generate useful visualizations
    if (sampleData.columns.length <= 1 || sampleData.rows.length === 0) {
        return;
    }
    
    chartsContainer.classList.remove('hidden');
    const chartsGrid = document.createElement('div');
    chartsGrid.className = 'charts-grid';
    
    // Create a numerical columns chart if we have numerical data
    const numericalColumns = findNumericalColumns(sampleData);
    if (numericalColumns.length > 0) {
        createNumericalChart(sampleData, numericalColumns, chartsGrid);
    }
    
    // Create a categorical chart if we have categorical data
    const categoricalColumns = findCategoricalColumns(sampleData);
    if (categoricalColumns.length > 0) {
        createCategoricalChart(sampleData, categoricalColumns, chartsGrid);
    }
    
    // Add the charts grid to the container if we created any charts
    if (chartsGrid.children.length > 0) {
        chartsContainer.appendChild(chartsGrid);
    }
}

/**
 * Sample data for visualization to avoid overwhelming charts
 */
function sampleDataForVisualization(data) {
    const MAX_DATA_POINTS = 50;
    
    if (data.rows.length <= MAX_DATA_POINTS) {
        return data;
    }
    
    // Sample the data
    const sampledRows = [];
    const interval = Math.ceil(data.rows.length / MAX_DATA_POINTS);
    
    for (let i = 0; i < data.rows.length; i += interval) {
        sampledRows.push(data.rows[i]);
    }
    
    return {
        columns: data.columns,
        rows: sampledRows
    };
}

function createNumericalChart(data, numericalColumns, chartsGrid) {
    // Select the first numerical column for visualization
    const numericalCol = numericalColumns[0];
    const numericalIndex = data.columns.indexOf(numericalCol);
    
    if (numericalIndex === -1) return;
    
    // Find a suitable column for the x-axis
    let labelColumn = 0;
    if (numericalIndex === 0 && data.columns.length > 1) {
        labelColumn = 1;
    }
    
    // Extract data for the chart
    const chartLabels = data.rows.map(row => {
        const label = row[labelColumn];
        return label === null ? 'NULL' : label.toString();
    });
    
    const chartData = data.rows.map(row => {
        const val = row[numericalIndex];
        return val === null ? 0 : parseFloat(val);
    });
    
    // Create chart
    const chartTitle = `${data.columns[numericalIndex]} by ${data.columns[labelColumn]}`;
    const chartId = 'numerical-chart';
    const chartSize = data.rows.length > 10 ? 'large' : 'medium';
    
    const chartCard = generateChartCard(chartTitle, chartId, chartSize);
    chartsGrid.appendChild(chartCard);
    
    customCharts.createBarChart(chartId, chartLabels, chartData, '', {
        compact: true
    });
}

function createCategoricalChart(data, categoricalColumns, chartsGrid) {
    // Select the first categorical column for visualization
    const catCol = categoricalColumns[0];
    const catIndex = data.columns.indexOf(catCol);
    
    if (catIndex === -1) return;
    
    // Count frequencies of each category
    const categories = {};
    data.rows.forEach(row => {
        const category = row[catIndex];
        const key = category === null ? 'NULL' : category.toString();
        categories[key] = (categories[key] || 0) + 1;
    });
    
    // Limit to top categories if there are too many
    const maxCategories = 8;
    let sortedCategories = Object.entries(categories)
        .sort((a, b) => b[1] - a[1]);
    
    if (sortedCategories.length > maxCategories) {
        const othersCount = sortedCategories
            .slice(maxCategories - 1)
            .reduce((sum, entry) => sum + entry[1], 0);
        
        sortedCategories = sortedCategories.slice(0, maxCategories - 1);
        sortedCategories.push(['Other', othersCount]);
    }
    
    // Extract data for the chart
    const chartLabels = sortedCategories.map(entry => entry[0]);
    const chartData = sortedCategories.map(entry => entry[1]);
    
    // Create chart
    const chartTitle = `Distribution of ${data.columns[catIndex]}`;
    const chartId = 'categorical-chart';
    const chartSize = 'medium';
    
    const chartCard = generateChartCard(chartTitle, chartId, chartSize);
    chartsGrid.appendChild(chartCard);
    
    customCharts.createPieChart(chartId, chartLabels, chartData, '', {
        compact: true
    });
}