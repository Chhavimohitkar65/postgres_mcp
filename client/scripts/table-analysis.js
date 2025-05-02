/**
 * Table Analysis Module
 * Handles table data retrieval, visualization, and insights generation
 */

// State management
const tableAnalysisState = {
    selectedTable: null,
    rowCount: 1000,
    selectedColumns: [],
    availableColumns: [],
    currentPage: 1,
    pageSize: 50,
    totalPages: 1,
    data: null,
    currentView: 'charts',
    charts: {},
    loading: false
};

// Initialize table analysis module
function initTableAnalysis() {
    // Load table list
    loadTableList();
    
    // Initialize event listeners
    document.getElementById('tableSelector').addEventListener('change', handleTableSelection);
    document.getElementById('rowCount').addEventListener('input', handleRowCountChange);
    document.querySelectorAll('.row-preset').forEach(btn => {
        btn.addEventListener('click', handleRowPresetClick);
    });
    document.getElementById('analyzeTableBtn').addEventListener('click', analyzeTable);
    document.getElementById('refreshTablesBtn').addEventListener('click', loadTableList);
    
    // View toggle buttons
    document.querySelectorAll('.view-controls .view-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const view = btn.getAttribute('data-view');
            switchView(view);
        });
    });
    
    // Initialize pagination if HTML element exists
    if (document.getElementById('prevPage')) {
        document.getElementById('prevPage').addEventListener('click', () => navigateToPage(tableAnalysisState.currentPage - 1));
    }
    if (document.getElementById('nextPage')) {
        document.getElementById('nextPage').addEventListener('click', () => navigateToPage(tableAnalysisState.currentPage + 1));
    }
    
    console.log('Table analysis module initialized');
}

// Helper function to ensure API URLs are correctly formatted
function getApiUrl(endpoint) {
    // Make sure endpoint starts with a slash
    if (!endpoint.startsWith('/')) {
        endpoint = '/' + endpoint;
    }
    
    // Add API prefix if not already present
    if (!endpoint.startsWith('/api/')) {
        endpoint = '/api' + endpoint;
    }
    
    return endpoint;
}

// Load list of tables from the server
async function loadTableList() {
    try {
        setLoading(true);
        const response = await fetch(getApiUrl('/mcp/schema'));
        const schema = await response.json();
        
        const tableSelector = document.getElementById('tableSelector');
        tableSelector.innerHTML = '<option value="">Select a table</option>';
        
        if (schema && schema.tables && Array.isArray(schema.tables)) {
            console.log('Tables loaded:', schema.tables);
            schema.tables.forEach(table => {
                const option = document.createElement('option');
                option.value = table.name;
                option.textContent = table.name + ` (${formatNumber(parseInt(table.row_count) || 0)} rows)`;
                tableSelector.appendChild(option);
            });
        } else {
            console.error('Schema data is not in the expected format:', schema);
            showError('Schema data is not in the expected format');
        }
        
        setLoading(false);
    } catch (error) {
        console.error('Error loading table list:', error);
        showError('Failed to load tables. Please try again.');
        setLoading(false);
    }
}

// Handle table selection change
async function handleTableSelection(event) {
    const tableName = event.target.value;
    tableAnalysisState.selectedTable = tableName;
    
    if (!tableName) {
        clearTableAnalysis();
        return;
    }
    
    // Update table analysis title
    document.getElementById('tableAnalysisTitle').textContent = `Analyzing: ${tableName}`;
    
    try {
        setLoading(true);
        
        // Get table schema to show columns
        // First try the specific table endpoint
        let columns = [];
        try {
            const response = await fetch(getApiUrl(`/mcp/schema/${tableName}`));
            const tableSchema = await response.json();
            
            if (tableSchema && tableSchema.columns) {
                columns = tableSchema.columns;
            }
        } catch (specific_error) {
            console.warn('Specific table schema endpoint failed, trying to extract from main schema:', specific_error);
            
            // Fall back to extracting from main schema if specific endpoint fails
            const mainResponse = await fetch(getApiUrl('/mcp/schema'));
            const mainSchema = await mainResponse.json();
            
            if (mainSchema && mainSchema.columnsMap && mainSchema.columnsMap[tableName]) {
                columns = mainSchema.columnsMap[tableName];
            }
        }
        
        console.log('Columns for', tableName, ':', columns);
        
        // Update column selection
        updateColumnSelector(columns);
        
        setLoading(false);
    } catch (error) {
        console.error('Error loading table schema:', error);
        showError('Failed to load table schema. Please try again.');
        setLoading(false);
    }
}

// Update column selector based on table schema
function updateColumnSelector(columns) {
    const columnSelector = document.getElementById('columnSelector');
    columnSelector.innerHTML = '';
    
    if (!columns || columns.length === 0) {
        columnSelector.innerHTML = '<div class="empty-state">No columns available for this table</div>';
        tableAnalysisState.availableColumns = [];
        tableAnalysisState.selectedColumns = [];
        return;
    }
    
    tableAnalysisState.availableColumns = columns;
    tableAnalysisState.selectedColumns = columns.map(col => col.name);
    
    // Add select/deselect all controls
    const controlsRow = document.createElement('div');
    controlsRow.className = 'column-controls';
    
    const selectAllBtn = document.createElement('button');
    selectAllBtn.className = 'small-btn';
    selectAllBtn.textContent = 'Select All';
    selectAllBtn.addEventListener('click', () => {
        document.querySelectorAll('#columnSelector input[type="checkbox"]').forEach(checkbox => {
            checkbox.checked = true;
        });
        tableAnalysisState.selectedColumns = columns.map(col => col.name);
    });
    
    const deselectAllBtn = document.createElement('button');
    deselectAllBtn.className = 'small-btn';
    deselectAllBtn.textContent = 'Deselect All';
    deselectAllBtn.addEventListener('click', () => {
        document.querySelectorAll('#columnSelector input[type="checkbox"]').forEach(checkbox => {
            checkbox.checked = false;
        });
        tableAnalysisState.selectedColumns = [];
    });
    
    const searchInput = document.createElement('input');
    searchInput.type = 'text';
    searchInput.placeholder = 'Search columns...';
    searchInput.className = 'column-search';
    searchInput.addEventListener('input', (e) => {
        const searchTerm = e.target.value.toLowerCase();
        document.querySelectorAll('.column-item').forEach(item => {
            const columnName = item.querySelector('label').textContent.toLowerCase();
            item.style.display = columnName.includes(searchTerm) ? 'flex' : 'none';
        });
    });
    
    controlsRow.appendChild(selectAllBtn);
    controlsRow.appendChild(deselectAllBtn);
    controlsRow.appendChild(searchInput);
    columnSelector.appendChild(controlsRow);

    // Create a container for column items
    const columnsContainer = document.createElement('div');
    columnsContainer.className = 'columns-container';
    
    // Group columns by type for better organization
    const numericColumns = columns.filter(col => col.type.includes('int') || col.type.includes('float') || col.type.includes('numeric') || col.type.includes('double') || col.type.includes('decimal'));
    const dateColumns = columns.filter(col => col.type.includes('date') || col.type.includes('time'));
    const textColumns = columns.filter(col => col.type.includes('char') || col.type.includes('text'));
    const booleanColumns = columns.filter(col => col.type.includes('bool'));
    const otherColumns = columns.filter(col => 
        !numericColumns.includes(col) && 
        !dateColumns.includes(col) && 
        !textColumns.includes(col) && 
        !booleanColumns.includes(col)
    );
    
    // Function to add column type group
    const addColumnGroup = (title, columnsArray, colorClass) => {
        if (columnsArray.length === 0) return;
        
        const groupTitle = document.createElement('div');
        groupTitle.className = 'column-group-title ' + colorClass;
        groupTitle.textContent = title + ` (${columnsArray.length})`;
        columnsContainer.appendChild(groupTitle);
        
        columnsArray.forEach(column => {
            addColumnItem(column, colorClass);
        });
    };
    
    // Function to add individual column item
    const addColumnItem = (column, colorClass) => {
        const columnItem = document.createElement('div');
        columnItem.className = 'column-item ' + colorClass;
        
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.id = `col-${column.name}`;
        checkbox.value = column.name;
        checkbox.checked = true;
        checkbox.addEventListener('change', handleColumnSelection);
        
        const label = document.createElement('label');
        label.htmlFor = `col-${column.name}`;
        label.textContent = column.name;
        
        const typeSpan = document.createElement('span');
        typeSpan.className = 'column-type';
        typeSpan.title = `Data type: ${column.type}${column.nullable ? ' (nullable)' : ''}`;
        typeSpan.textContent = column.type;
        
        columnItem.appendChild(checkbox);
        columnItem.appendChild(label);
        columnItem.appendChild(typeSpan);
        columnsContainer.appendChild(columnItem);
    };
    
    // Add column groups
    addColumnGroup('Numeric', numericColumns, 'numeric-column');
    addColumnGroup('Date/Time', dateColumns, 'date-column');
    addColumnGroup('Text', textColumns, 'text-column');
    addColumnGroup('Boolean', booleanColumns, 'boolean-column');
    addColumnGroup('Other', otherColumns, 'other-column');
    
    columnSelector.appendChild(columnsContainer);
}

// Handle column selection change
function handleColumnSelection(event) {
    const columnName = event.target.value;
    const isChecked = event.target.checked;
    
    if (isChecked) {
        tableAnalysisState.selectedColumns.push(columnName);
    } else {
        tableAnalysisState.selectedColumns = tableAnalysisState.selectedColumns.filter(col => col !== columnName);
    }
}

// Handle row count input change
function handleRowCountChange(event) {
    const value = parseInt(event.target.value);
    if (!isNaN(value) && value > 0) {
        tableAnalysisState.rowCount = value;
        
        // Update active preset button
        document.querySelectorAll('.row-preset').forEach(btn => {
            btn.classList.remove('active');
            if (parseInt(btn.getAttribute('data-value')) === value) {
                btn.classList.add('active');
            }
        });
    }
}

// Handle row preset button click
function handleRowPresetClick(event) {
    const value = event.target.getAttribute('data-value');
    document.querySelectorAll('.row-preset').forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');
    
    const rowCountInput = document.getElementById('rowCount');
    if (value === 'all') {
        tableAnalysisState.rowCount = -1; // Special value for all rows
        rowCountInput.value = 'All';
        rowCountInput.disabled = true;
    } else {
        const numValue = parseInt(value);
        tableAnalysisState.rowCount = numValue;
        rowCountInput.value = numValue;
        rowCountInput.disabled = false;
    }
}

// Analyze selected table
async function analyzeTable() {
    const selectedTable = tableAnalysisState.selectedTable;
    const rowCount = tableAnalysisState.rowCount;
    const selectedColumns = tableAnalysisState.selectedColumns;
    
    if (!selectedTable) {
        showError('Please select a table to analyze');
        return;
    }
    
    if (selectedColumns.length === 0) {
        showError('Please select at least one column to analyze');
        return;
    }
    
    try {
        setLoading(true);
        
        // Fetch column information if not already loaded
        if (tableAnalysisState.availableColumns.length === 0) {
            try {
                const schemaResponse = await fetch(getApiUrl('/mcp/schema'));
                const schema = await schemaResponse.json();
                
                if (schema.columnsMap && schema.columnsMap[selectedTable]) {
                    tableAnalysisState.availableColumns = schema.columnsMap[selectedTable];
                }
            } catch (error) {
                console.error('Error loading columns:', error);
            }
        }
        
        // Fetch table data with selected columns
        const limit = rowCount === -1 ? 'all' : rowCount;
        const columnsParam = selectedColumns.join(',');
        const response = await fetch(getApiUrl(`/mcp/table/${selectedTable}?limit=${limit}&columns=${columnsParam}`));
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to fetch data');
        }
        
        const result = await response.json();
        
        if (!result.success) {
            throw new Error(result.error || 'Failed to analyze table');
        }
        
        // Store data in state
        tableAnalysisState.data = result.data;
        tableAnalysisState.currentPage = 1;
        tableAnalysisState.totalPages = result.meta.pages || 1;
        
        // Update views
        if (tableAnalysisState.currentView === 'charts') {
            updateChartsView(result.data);
        } else {
            updateDataView(result.data, result.meta);
        }
        
        setLoading(false);
    } catch (error) {
        console.error('Error analyzing table:', error);
        showError(error.message || 'Failed to analyze table. Please try again.');
        setLoading(false);
    }
}

// Update charts view with visualizations of the table data
function updateChartsView(data) {
    if (!data || !Array.isArray(data) || data.length === 0) {
        document.getElementById('mainVisualization').innerHTML = 
            '<div class="empty-state"><p>No data available for visualization</p></div>';
        document.getElementById('additionalChartsContainer').innerHTML = '';
        return;
    }
    
    const mainVisualization = document.getElementById('mainVisualization');
    const additionalChartsContainer = document.getElementById('additionalChartsContainer');
    
    // Clear previous visualizations
    mainVisualization.innerHTML = '';
    additionalChartsContainer.innerHTML = '';
    
    try {
        // Get column types
        const columnTypes = {};
        const firstRow = data[0];
        
        Object.keys(firstRow).forEach(column => {
            const value = firstRow[column];
            
            if (typeof value === 'number') {
                columnTypes[column] = 'number';
            } else if (!isNaN(new Date(value).getTime())) {
                columnTypes[column] = 'date';
            } else if (typeof value === 'boolean') {
                columnTypes[column] = 'boolean';
            } else {
                columnTypes[column] = 'string';
            }
        });
        
        // Create main visualization (summary)
        const mainCanvas = document.createElement('canvas');
        mainCanvas.id = 'mainChart';
        mainVisualization.appendChild(mainCanvas);
        
        createMainVisualization(mainCanvas, data, columnTypes);
        
        // Create additional visualizations
        const numericColumns = Object.keys(columnTypes).filter(col => columnTypes[col] === 'number');
        const categoricalColumns = Object.keys(columnTypes).filter(col => 
            columnTypes[col] === 'string' || columnTypes[col] === 'boolean'
        );
        
        // Create charts for numeric columns (if any)
        if (numericColumns.length > 0) {
            createNumericCharts(data, numericColumns);
        }
        
        // Create charts for categorical columns (if any)
        if (categoricalColumns.length > 0) {
            createCategoricalCharts(data, categoricalColumns);
        }
        
    } catch (error) {
        console.error('Error creating visualizations:', error);
        mainVisualization.innerHTML = 
            `<div class="error-state"><p>Error creating visualizations: ${error.message}</p></div>`;
    }
}

// Create a visualization of the data distribution
function createMainVisualization(canvas, data, columnTypes) {
    // For simplicity, just create a bar chart of row counts
    // In a real application, this would be more sophisticated
    const ctx = canvas.getContext('2d');
    
    // Find a categorical column for grouping
    const categoricalColumns = Object.keys(columnTypes).filter(col => 
        columnTypes[col] === 'string' || columnTypes[col] === 'boolean'
    );
    
    if (categoricalColumns.length === 0) {
        // No categorical columns, show a message
        canvas.parentNode.innerHTML = 
            '<div class="info-message">No categorical columns available for summary visualization</div>';
        return;
    }
    
    // Use the first categorical column
    const groupColumn = categoricalColumns[0];
    
    // Get counts for each value in the group column
    const counts = {};
    data.forEach(row => {
        const value = row[groupColumn] || 'NULL';
        counts[value] = (counts[value] || 0) + 1;
    });
    
    // Sort by count (descending)
    const sortedItems = Object.entries(counts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10); // Limit to top 10
    
    const labels = sortedItems.map(item => item[0]);
    const values = sortedItems.map(item => item[1]);
    
    // Create chart
    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: `Distribution by ${groupColumn}`,
                data: values,
                backgroundColor: 'rgba(54, 162, 235, 0.7)',
                borderColor: 'rgba(54, 162, 235, 1)',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                title: {
                    display: true,
                    text: `Data Distribution by ${groupColumn} (Top 10)`
                },
                legend: {
                    display: false
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Count'
                    }
                },
                x: {
                    title: {
                        display: true,
                        text: groupColumn
                    }
                }
            }
        }
    });
}

// Create charts for numeric columns
function createNumericCharts(data, numericColumns) {
    const container = document.getElementById('additionalChartsContainer');
    
    // Limit to first 4 numeric columns for simplicity
    const columnsToChart = numericColumns.slice(0, 4);
    
    columnsToChart.forEach(column => {
        // Create chart container
        const chartCard = document.createElement('div');
        chartCard.className = 'chart-card chart-size-medium';
        
        const chartTitle = document.createElement('h3');
        chartTitle.className = 'chart-title';
        chartTitle.textContent = `Distribution of ${column}`;
        
        const chartWrapper = document.createElement('div');
        chartWrapper.className = 'chart-container';
        
        const canvas = document.createElement('canvas');
        canvas.id = `chart-${column}`;
        
        chartWrapper.appendChild(canvas);
        chartCard.appendChild(chartTitle);
        chartCard.appendChild(chartWrapper);
        container.appendChild(chartCard);
        
        // Get data for the column
        const values = data.map(row => row[column]).filter(val => val !== null && val !== undefined);
        
        // For simplicity, create a histogram-like chart
        // Group values into bins
        const min = Math.min(...values);
        const max = Math.max(...values);
        const range = max - min;
        const binCount = Math.min(10, Math.ceil(Math.sqrt(values.length)));
        const binSize = range / binCount;
        
        const bins = Array(binCount).fill(0);
        const binLabels = [];
        
        for (let i = 0; i < binCount; i++) {
            const binStart = min + (i * binSize);
            const binEnd = binStart + binSize;
            binLabels.push(`${binStart.toFixed(1)} - ${binEnd.toFixed(1)}`);
        }
        
        values.forEach(value => {
            const binIndex = Math.min(binCount - 1, Math.floor((value - min) / binSize));
            bins[binIndex]++;
        });
        
        // Create chart
        new Chart(canvas.getContext('2d'), {
            type: 'bar',
            data: {
                labels: binLabels,
                datasets: [{
                    label: column,
                    data: bins,
                    backgroundColor: 'rgba(255, 99, 132, 0.7)',
                    borderColor: 'rgba(255, 99, 132, 1)',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: {
                        display: false
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: 'Count'
                        }
                    },
                    x: {
                        title: {
                            display: true,
                            text: column
                        }
                    }
                }
            }
        });
    });
}

// Create charts for categorical columns
function createCategoricalCharts(data, categoricalColumns) {
    const container = document.getElementById('additionalChartsContainer');
    
    // Limit to first 4 categorical columns for simplicity
    const columnsToChart = categoricalColumns.slice(0, 4);
    
    columnsToChart.forEach(column => {
        // Create chart container
        const chartCard = document.createElement('div');
        chartCard.className = 'chart-card chart-size-medium';
        
        const chartTitle = document.createElement('h3');
        chartTitle.className = 'chart-title';
        chartTitle.textContent = `Distribution of ${column}`;
        
        const chartWrapper = document.createElement('div');
        chartWrapper.className = 'chart-container';
        
        const canvas = document.createElement('canvas');
        canvas.id = `chart-${column}`;
        
        chartWrapper.appendChild(canvas);
        chartCard.appendChild(chartTitle);
        chartCard.appendChild(chartWrapper);
        container.appendChild(chartCard);
        
        // Get counts for each value
        const counts = {};
        data.forEach(row => {
            const value = row[column] || 'NULL';
            counts[value] = (counts[value] || 0) + 1;
        });
        
        // Sort by count (descending)
        const sortedItems = Object.entries(counts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10); // Limit to top 10
        
        const labels = sortedItems.map(item => item[0]);
        const values = sortedItems.map(item => item[1]);
        
        // Create chart
        new Chart(canvas.getContext('2d'), {
            type: 'pie',
            data: {
                labels: labels,
                datasets: [{
                    data: values,
                    backgroundColor: [
                        'rgba(255, 99, 132, 0.7)',
                        'rgba(54, 162, 235, 0.7)',
                        'rgba(255, 206, 86, 0.7)',
                        'rgba(75, 192, 192, 0.7)',
                        'rgba(153, 102, 255, 0.7)',
                        'rgba(255, 159, 64, 0.7)',
                        'rgba(199, 199, 199, 0.7)',
                        'rgba(83, 102, 255, 0.7)',
                        'rgba(40, 159, 64, 0.7)',
                        'rgba(210, 199, 199, 0.7)'
                    ],
                    borderColor: [
                        'rgba(255, 99, 132, 1)',
                        'rgba(54, 162, 235, 1)',
                        'rgba(255, 206, 86, 1)',
                        'rgba(75, 192, 192, 1)',
                        'rgba(153, 102, 255, 1)',
                        'rgba(255, 159, 64, 1)',
                        'rgba(199, 199, 199, 1)',
                        'rgba(83, 102, 255, 1)',
                        'rgba(40, 159, 64, 1)',
                        'rgba(210, 199, 199, 1)'
                    ],
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: {
                        position: 'right',
                        labels: {
                            boxWidth: 12,
                            font: {
                                size: 10
                            }
                        }
                    }
                }
            }
        });
    });
}

// Switch between chart view and data view
function switchView(view) {
    // Update current view state
    tableAnalysisState.currentView = view;
    
    // Update UI to show active view button
    document.querySelectorAll('.view-controls .view-btn').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-view') === view);
    });
    
    // Show corresponding view
    document.querySelectorAll('.analysis-view').forEach(viewEl => {
        viewEl.classList.toggle('active', viewEl.id === view + 'View');
    });
    
    // Update view with current data if available
    if (tableAnalysisState.data) {
        if (view === 'charts') {
            updateChartsView(tableAnalysisState.data);
        } else if (view === 'data') {
            updateDataView(tableAnalysisState.data);
        }
    }
}

// Format number with commas
function formatNumber(num) {
    if (num === null || num === undefined) return "0";
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

// Show error message
function showError(message) {
    const toastContainer = document.getElementById('toastContainer') || createToastContainer();
    
    const toast = document.createElement('div');
    toast.className = 'toast error';
    toast.textContent = message;
    
    toastContainer.appendChild(toast);
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
        toast.classList.add('fade-out');
        setTimeout(() => toast.remove(), 500);
    }, 5000);
    
    console.error(message);
}

// Show success/info message
function showMessage(message) {
    const toastContainer = document.getElementById('toastContainer') || createToastContainer();
    
    const toast = document.createElement('div');
    toast.className = 'toast info';
    toast.textContent = message;
    
    toastContainer.appendChild(toast);
    
    // Auto-remove after 3 seconds
    setTimeout(() => {
        toast.classList.add('fade-out');
        setTimeout(() => toast.remove(), 500);
    }, 3000);
}

// Create toast container if it doesn't exist
function createToastContainer() {
    const container = document.createElement('div');
    container.id = 'toastContainer';
    container.className = 'toast-container';
    document.body.appendChild(container);
    return container;
}

// Set loading state
function setLoading(isLoading) {
    const loadingOverlay = document.getElementById('loadingOverlay');
    if (!loadingOverlay) return;
    
    if (isLoading) {
        loadingOverlay.style.display = 'flex';
    } else {
        loadingOverlay.style.display = 'none';
    }
    
    tableAnalysisState.loading = isLoading;
}

// Clear table analysis
function clearTableAnalysis() {
    document.getElementById('tableAnalysisTitle').textContent = 'Select a table to analyze';
    document.getElementById('columnSelector').innerHTML = '';
    document.getElementById('mainVisualization').innerHTML = '<div class="empty-state"><p>Select a table and analyze data to see visualizations</p></div>';
    document.getElementById('additionalChartsContainer').innerHTML = '';
    document.getElementById('insightsContent').innerHTML = '<p class="empty-state">Select a table and analyze data to see insights</p>';
    document.getElementById('dataTableContainer').innerHTML = '';
    
    // Reset state
    tableAnalysisState.selectedTable = null;
    tableAnalysisState.selectedColumns = [];
    tableAnalysisState.availableColumns = [];
    tableAnalysisState.data = null;
}

// Show a success/info message
function showMessage(message) {
    const messageElement = document.createElement('div');
    messageElement.className = 'message-toast';
    messageElement.textContent = message;
    document.body.appendChild(messageElement);
    
    // Automatically remove after 3 seconds
    setTimeout(() => {
        messageElement.classList.add('fade-out');
        setTimeout(() => {
            document.body.removeChild(messageElement);
        }, 500);
    }, 3000);
}

// Update data view with fetched table data
function updateDataView(data, meta) {
    const container = document.getElementById('dataView');
    const dataTableContainer = document.getElementById('dataTableContainer');
    
    if (!data || !Array.isArray(data) || data.length === 0) {
        dataTableContainer.innerHTML = '<div class="empty-state">No data available for this table</div>';
        return;
    }
    
    // Create table
    const table = document.createElement('table');
    table.className = 'data-table';
    
    // Create header
    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    
    const columns = Object.keys(data[0]);
    columns.forEach(column => {
        const th = document.createElement('th');
        th.textContent = column;
        headerRow.appendChild(th);
    });
    
    thead.appendChild(headerRow);
    table.appendChild(thead);
    
    // Create body
    const tbody = document.createElement('tbody');
    
    data.forEach(row => {
        const tr = document.createElement('tr');
        
        columns.forEach(column => {
            const td = document.createElement('td');
            const value = row[column];
            
            if (value === null || value === undefined) {
                td.innerHTML = '<span class="null-value">NULL</span>';
            } else {
                td.textContent = value.toString();
            }
            
            tr.appendChild(td);
        });
        
        tbody.appendChild(tr);
    });
    
    table.appendChild(tbody);
    
    // Clear previous content
    dataTableContainer.innerHTML = '';
    dataTableContainer.appendChild(table);
    
    // Update pagination
    updatePagination(meta);
}

// Update pagination controls
function updatePagination(meta) {
    const paginationContainer = document.getElementById('paginationControls');
    if (!paginationContainer) return;
    
    const { page, pages, total } = meta || { 
        page: tableAnalysisState.currentPage, 
        pages: tableAnalysisState.totalPages, 
        total: 0 
    };
    
    paginationContainer.innerHTML = '';
    
    // Create info text
    const infoSpan = document.createElement('span');
    infoSpan.className = 'pagination-info';
    infoSpan.textContent = `Page ${page} of ${pages} (${formatNumber(total)} rows total)`;
    
    // Create previous button
    const prevBtn = document.createElement('button');
    prevBtn.className = 'pagination-btn';
    prevBtn.innerHTML = '<i class="ri-arrow-left-s-line"></i>';
    prevBtn.disabled = page <= 1;
    prevBtn.addEventListener('click', () => navigateToPage(page - 1));
    
    // Create next button
    const nextBtn = document.createElement('button');
    nextBtn.className = 'pagination-btn';
    nextBtn.innerHTML = '<i class="ri-arrow-right-s-line"></i>';
    nextBtn.disabled = page >= pages;
    nextBtn.addEventListener('click', () => navigateToPage(page + 1));
    
    paginationContainer.appendChild(prevBtn);
    paginationContainer.appendChild(infoSpan);
    paginationContainer.appendChild(nextBtn);
}

// Navigate to a specific page
async function navigateToPage(page) {
    if (page < 1 || page > tableAnalysisState.totalPages || page === tableAnalysisState.currentPage) {
        return;
    }
    
    try {
        setLoading(true);
        
        const selectedTable = tableAnalysisState.selectedTable;
        const selectedColumns = tableAnalysisState.selectedColumns;
        const limit = tableAnalysisState.pageSize;
        
        const columnsParam = selectedColumns.join(',');
        const response = await fetch(getApiUrl(`/mcp/table/${selectedTable}?page=${page}&limit=${limit}&columns=${columnsParam}`));
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to fetch page data');
        }
        
        const result = await response.json();
        
        if (!result.success) {
            throw new Error(result.error || 'Failed to load page data');
        }
        
        // Update state
        tableAnalysisState.data = result.data;
        tableAnalysisState.currentPage = page;
        
        // Update view
        updateDataView(result.data, result.meta);
        
        setLoading(false);
    } catch (error) {
        console.error('Error navigating to page:', error);
        showError('Failed to load page: ' + error.message);
        setLoading(false);
    }
} 