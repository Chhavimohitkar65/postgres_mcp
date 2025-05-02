/**
 * Table Data Module
 * Handles data table display and pagination with enhanced UX
 */

// Table data state
const tableDataState = {
    currentPage: 1,
    pageSize: 50,
    sortColumn: null,
    sortDirection: 'asc',
    filters: {},
    data: null,
    columns: null,
    total: 0,
    totalPages: 0
};

// Format number with appropriate separators and decimals
function formatNumber(value) {
    if (Number.isInteger(value)) {
        return value.toLocaleString();
    }
    return value.toLocaleString(undefined, { 
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}

// Show loading state
function showLoading() {
    const container = document.getElementById('dataTableContainer');
    if (!container) return;
    
    container.innerHTML = `
        <div class="table-loader">
            <div class="spinner"></div>
            <p>Loading data...</p>
        </div>
    `;
}

// Show empty state with helpful message
function showEmptyState(message = 'No data available', suggestion = 'Try selecting a different table or adjusting your filters') {
    const container = document.getElementById('dataTableContainer');
    if (!container) return;
    
    container.innerHTML = `
        <div class="empty-state">
            <i class="ri-file-list-3-line"></i>
            <p>${message}</p>
            <div class="suggestion">${suggestion}</div>
        </div>
    `;
}

// Show error message
function showError(message) {
    const container = document.getElementById('dataTableContainer');
    if (!container) return;
    
    container.innerHTML = `
        <div class="error-state">
            <i class="ri-error-warning-line"></i>
            <p>${message}</p>
            <button onclick="retryLoadData()" class="retry-btn">
                <i class="ri-refresh-line"></i> Retry
            </button>
        </div>
    `;
}

// Update data view with new data
function updateDataView(data, options = {}) {
    console.log('[TableData] Updating data view:', { dataLength: data?.length, options });
    
    // Update state
    tableDataState.data = data;
    tableDataState.total = options.total || 0;
    tableDataState.totalPages = options.totalPages || 0;
    tableDataState.columns = options.columns || [];
    
    // Render table
    renderDataTable();
}

// Render data table
function renderDataTable() {
    console.log('[TableData] Rendering data table...');
    
    const container = document.getElementById('dataTableContainer');
    if (!container) {
        console.warn('[TableData] Container not found');
        return;
    }
    
    if (!tableDataState.data || !tableDataState.columns) {
        console.warn('[TableData] No data or columns available');
        showEmptyState();
        return;
    }
    
    // Create table structure
    const table = document.createElement('table');
    table.className = 'data-table';
    
    // Create header
    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    
    tableDataState.columns.forEach(column => {
        const th = document.createElement('th');
        th.textContent = formatColumnName(column);
        th.addEventListener('click', () => sortTable(column));
        
        // Add sort indicator if this column is sorted
        if (tableDataState.sortColumn === column) {
            th.classList.add('sorted');
            th.classList.add(tableDataState.sortDirection);
        }
        
        headerRow.appendChild(th);
    });
    
    thead.appendChild(headerRow);
    table.appendChild(thead);
    
    // Create body
    const tbody = document.createElement('tbody');
    
    tableDataState.data.forEach(row => {
        const tr = document.createElement('tr');
        
        tableDataState.columns.forEach(column => {
            const td = document.createElement('td');
            td.innerHTML = formatTableCell(row[column]);
            tr.appendChild(td);
        });
        
        tbody.appendChild(tr);
    });
    
    table.appendChild(tbody);
    
    // Clear container and add table
    container.innerHTML = '';
    container.appendChild(table);
    
    // Add pagination controls
    renderPaginationControls();
    
    console.log('[TableData] Table rendered successfully');
}

// Format column name for display
function formatColumnName(column) {
    return column
        .split('_')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
}

// Format table cell based on data type
function formatTableCell(value) {
    if (value === null || value === undefined) {
        return '<span class="null-value">NULL</span>';
    }
    
    if (typeof value === 'boolean') {
        return value ? 
            '<span class="boolean true">True</span>' : 
            '<span class="boolean false">False</span>';
    }
    
    if (typeof value === 'number') {
        return formatNumber(value);
    }
    
    if (value instanceof Date || !isNaN(Date.parse(value))) {
        return formatDate(value);
    }
    
    if (typeof value === 'object') {
        return `<pre class="json">${JSON.stringify(value, null, 2)}</pre>`;
    }
    
    return value.toString();
}

// Format date in a readable format
function formatDate(value) {
    const date = new Date(value);
    return date.toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// Sort table by column
function sortTable(column) {
    console.log('[TableData] Sorting by column:', column);
    
    if (tableDataState.sortColumn === column) {
        // Toggle direction if same column
        tableDataState.sortDirection = 
            tableDataState.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
        // New column, default to ascending
        tableDataState.sortColumn = column;
        tableDataState.sortDirection = 'asc';
    }
    
    // Re-fetch data with new sort
    if (typeof database !== 'undefined') {
        const tableName = document.getElementById('tableSelector').value;
        if (tableName) {
            database.getTableData(tableName, {
                page: tableDataState.currentPage,
                pageSize: tableDataState.pageSize,
                sortColumn: tableDataState.sortColumn,
                sortDirection: tableDataState.sortDirection,
                filters: tableDataState.filters
            }).then(({ data, total, totalPages }) => {
                updateDataView(data, { 
                    total, 
                    totalPages, 
                    columns: tableDataState.columns 
                });
            }).catch(error => {
                console.error('[TableData] Sort error:', error);
                showError('Failed to sort data');
            });
        }
    }
}

// Render pagination controls
function renderPaginationControls() {
    console.log('[TableData] Rendering pagination controls...');
    
    const container = document.getElementById('dataTableContainer');
    if (!container) return;
    
    const paginationDiv = document.createElement('div');
    paginationDiv.className = 'pagination-controls';
    
    // Add pagination info
    const info = document.createElement('div');
    info.className = 'pagination-info';
    const start = (tableDataState.currentPage - 1) * tableDataState.pageSize + 1;
    const end = Math.min(start + tableDataState.pageSize - 1, tableDataState.total);
    info.textContent = `Showing ${start}-${end} of ${tableDataState.total} rows`;
    
    // Add page buttons
    const buttons = document.createElement('div');
    buttons.className = 'pagination-buttons';
    
    // First page button
    const firstBtn = document.createElement('button');
    firstBtn.innerHTML = '<i class="ri-arrow-left-double-line"></i>';
    firstBtn.disabled = tableDataState.currentPage === 1;
    firstBtn.onclick = () => changePage(1);
    
    // Previous page button
    const prevBtn = document.createElement('button');
    prevBtn.innerHTML = '<i class="ri-arrow-left-s-line"></i>';
    prevBtn.disabled = tableDataState.currentPage === 1;
    prevBtn.onclick = () => changePage(tableDataState.currentPage - 1);
    
    // Page number
    const pageNum = document.createElement('span');
    pageNum.className = 'page-number';
    pageNum.textContent = `Page ${tableDataState.currentPage} of ${tableDataState.totalPages}`;
    
    // Next page button
    const nextBtn = document.createElement('button');
    nextBtn.innerHTML = '<i class="ri-arrow-right-s-line"></i>';
    nextBtn.disabled = tableDataState.currentPage === tableDataState.totalPages;
    nextBtn.onclick = () => changePage(tableDataState.currentPage + 1);
    
    // Last page button
    const lastBtn = document.createElement('button');
    lastBtn.innerHTML = '<i class="ri-arrow-right-double-line"></i>';
    lastBtn.disabled = tableDataState.currentPage === tableDataState.totalPages;
    lastBtn.onclick = () => changePage(tableDataState.totalPages);
    
    buttons.append(firstBtn, prevBtn, pageNum, nextBtn, lastBtn);
    paginationDiv.append(info, buttons);
    container.appendChild(paginationDiv);
}

// Change page
async function changePage(page) {
    console.log('[TableData] Changing to page:', page);
    
    if (page < 1 || page > tableDataState.totalPages) return;
    
    tableDataState.currentPage = page;
    
    try {
        const tableName = document.getElementById('tableSelector').value;
        if (!tableName) return;
        
        showLoading();
        
        const { data, total, totalPages } = await database.getTableData(tableName, {
            page: tableDataState.currentPage,
            pageSize: tableDataState.pageSize,
            sortColumn: tableDataState.sortColumn,
            sortDirection: tableDataState.sortDirection,
            filters: tableDataState.filters
        });
        
        updateDataView(data, { 
            total, 
            totalPages, 
            columns: tableDataState.columns 
        });
    } catch (error) {
        console.error('[TableData] Page change error:', error);
        showError('Failed to change page');
    }
}

// Initialize table functionality
document.addEventListener('DOMContentLoaded', () => {
    console.log('[TableData] Initializing table functionality...');
    
    // Add event listener for table selection
    const tableSelector = document.getElementById('tableSelector');
    if (tableSelector) {
        console.log('[TableData] Table selector found, adding event listener');
        tableSelector.addEventListener('change', async (e) => {
            const selectedTable = e.target.value;
            if (!selectedTable) return;
            
            console.log('[TableData] Table selected:', selectedTable);
            
            try {
                showLoading();
                console.log('[TableData] Fetching data for table:', selectedTable);
                
                const data = await database.getTableData(selectedTable);
                console.log('[TableData] Data received:', {
                    rowCount: data.data?.length || 0,
                    total: data.total,
                    totalPages: data.totalPages,
                    columnCount: data.columns?.length || 0
                });
                
                updateDataView(data.data, {
                    total: data.total,
                    totalPages: data.totalPages,
                    columns: data.columns
                });
            } catch (err) {
                console.error('[TableData] Error loading table data:', err);
                showError(`Failed to load table data: ${err.message}`);
            }
        });
    } else {
        console.warn('[TableData] Table selector element not found');
    }
    
    // Add event listener for row count changes
    const rowCount = document.getElementById('rowCount');
    if (rowCount) {
        console.log('[TableData] Row count selector found, adding event listener');
        rowCount.addEventListener('change', (e) => {
            const value = parseInt(e.target.value);
            if (!isNaN(value) && value > 0) {
                console.log('[TableData] Rows per page changed to:', value);
                tableDataState.pageSize = value;
                renderDataTable();
            }
        });
    } else {
        console.warn('[TableData] Row count selector element not found');
    }
});

// Export functions
window.updateDataView = updateDataView;
window.renderDataTable = renderDataTable;
window.showEmptyState = showEmptyState;

class TableDataManager {
    constructor() {
        this.currentPage = 1;
        this.pageSize = 50;
        this.totalPages = 1;
        this.total = 0;
        this.currentTable = null;
        this.setupEventListeners();
    }

    setupEventListeners() {
        document.getElementById('prevPage')?.addEventListener('click', () => this.changePage(this.currentPage - 1));
        document.getElementById('nextPage')?.addEventListener('click', () => this.changePage(this.currentPage + 1));
        document.getElementById('firstPage')?.addEventListener('click', () => this.changePage(1));
        document.getElementById('lastPage')?.addEventListener('click', () => this.changePage(this.totalPages));
        document.getElementById('pageSizeSelect')?.addEventListener('change', (e) => {
            this.pageSize = parseInt(e.target.value);
            this.currentPage = 1;
            this.fetchTableData(this.currentTable);
        });
    }

    async fetchTableData(tableName, page = 1) {
        try {
            this.showLoading();
            this.currentTable = tableName;
            this.currentPage = page;

            const response = await fetch('/api/mcp/execute', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    sql: `SELECT * FROM ${tableName}`,
                    page: this.currentPage,
                    pageSize: this.pageSize
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();
            this.updateDataView(result);
        } catch (error) {
            console.error('Error fetching data:', error);
            this.showError(`Failed to fetch data: ${error.message}`);
        } finally {
            this.hideLoading();
        }
    }

    updateDataView(result) {
        const { data, pagination, columns } = result;
        this.total = pagination.total;
        this.totalPages = pagination.totalPages;
        this.currentPage = pagination.page;

        if (!data || data.length === 0) {
            this.showEmptyState();
            return;
        }

        this.renderDataTable(data, columns);
        this.updatePaginationControls();
    }

    renderDataTable(data, columns) {
        const container = document.getElementById('dataTableContainer');
        if (!container) return;

        const table = document.createElement('table');
        table.className = 'data-table';

        // Create header
        const thead = document.createElement('thead');
        const headerRow = document.createElement('tr');
        columns.forEach(column => {
            const th = document.createElement('th');
            th.textContent = column.column_name;
            th.setAttribute('data-type', column.data_type);
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
                td.textContent = row[column.column_name] ?? '';
                td.setAttribute('data-type', column.data_type);
                tr.appendChild(td);
            });
            tbody.appendChild(tr);
        });
        table.appendChild(tbody);

        // Clear and update container
        container.innerHTML = '';
        container.appendChild(table);
    }

    updatePaginationControls() {
        const paginationInfo = document.getElementById('paginationInfo');
        if (paginationInfo) {
            paginationInfo.textContent = `Showing page ${this.currentPage} of ${this.totalPages} (${this.total} total records)`;
        }

        // Update button states
        document.getElementById('prevPage')?.classList.toggle('disabled', this.currentPage === 1);
        document.getElementById('nextPage')?.classList.toggle('disabled', this.currentPage === this.totalPages);
        document.getElementById('firstPage')?.classList.toggle('disabled', this.currentPage === 1);
        document.getElementById('lastPage')?.classList.toggle('disabled', this.currentPage === this.totalPages);

        // Update page size select
        const pageSizeSelect = document.getElementById('pageSizeSelect');
        if (pageSizeSelect && !pageSizeSelect.value) {
            pageSizeSelect.value = this.pageSize;
        }
    }

    async changePage(newPage) {
        if (newPage < 1 || newPage > this.totalPages || newPage === this.currentPage) {
            return;
        }
        await this.fetchTableData(this.currentTable, newPage);
    }

    showLoading() {
        const loadingState = document.getElementById('loadingState');
        if (loadingState) {
            loadingState.style.display = 'flex';
        }
    }

    hideLoading() {
        const loadingState = document.getElementById('loadingState');
        if (loadingState) {
            loadingState.style.display = 'none';
        }
    }

    showError(message) {
        const errorState = document.getElementById('errorState');
        if (errorState) {
            const errorMessage = errorState.querySelector('.error-message');
            if (errorMessage) {
                errorMessage.textContent = message;
            }
            errorState.style.display = 'flex';
        }
    }

    showEmptyState() {
        const container = document.getElementById('dataTableContainer');
        if (container) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-database"></i>
                    <p>No data available</p>
                </div>
            `;
        }
    }
}

// Initialize the table data manager
const tableDataManager = new TableDataManager();
window.tableDataManager = tableDataManager; // Make it globally accessible 