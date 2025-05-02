/**
 * Database Connection Module
 * Handles database connections and data fetching
 */

class DatabaseConnection {
    constructor() {
        this.baseUrl = 'http://localhost:5001/api/mcp';
        this.cache = new Map();
        this.cacheDuration = 5 * 60 * 1000; // 5 minutes cache
        this.currentTable = null;
        this.tableData = null;
        this.schema = null;
        this.stats = null;
        
        // Initialize database
        this.init();
    }

    async init() {
        try {
            await this.loadInitialData();
            this.updateUI();
        } catch (error) {
            console.error('Database initialization failed:', error);
            this.showError('Failed to initialize database');
        }
    }

    async loadInitialData() {
        // Load schema and stats in parallel
        const [schema, stats] = await Promise.all([
            this.fetchWithCache('schema'),
            this.fetchWithCache('stats')
        ]);

        this.schema = schema;
        this.stats = stats;
        
        // Extract unique table names
        this.tables = [...new Set(schema.map(s => s.table_name))];
        
        console.log('Initial data loaded:', {
            tableCount: this.tables.length,
            schemaCount: schema.length
        });
    }

    async fetchWithCache(endpoint) {
        const cacheKey = endpoint;
        const cached = this.cache.get(cacheKey);
        
        if (cached && Date.now() - cached.timestamp < this.cacheDuration) {
            console.log(`Using cached ${endpoint} data`);
            return cached.data;
        }

        console.log(`Fetching fresh ${endpoint} data`);
        const response = await fetch(`${this.baseUrl}/${endpoint}`);
        
        if (!response.ok) {
            throw new Error(`Failed to fetch ${endpoint}: ${response.status}`);
        }

        const data = await response.json();
        this.cache.set(cacheKey, {
            data,
            timestamp: Date.now()
        });

        return data;
    }

    async loadTableData(tableName, page = 1, pageSize = 50) {
        if (!tableName) return null;

        try {
            const offset = (page - 1) * pageSize;
            const query = `SELECT * FROM ${tableName} LIMIT ${pageSize} OFFSET ${offset}`;
            
            const response = await fetch(`${this.baseUrl}/execute`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sql: query })
            });

            if (!response.ok) {
                throw new Error(`Failed to fetch table data: ${response.status}`);
            }

            const result = await response.json();
            this.currentTable = tableName;
            this.tableData = result.data;
            
            return result;
        } catch (error) {
            console.error('Error loading table data:', error);
            throw error;
        }
    }

    // Get context for chatbot
    async getChatbotContext() {
        try {
            // Get current database state
            const context = {
                timestamp: Date.now(),
                database: {
                    tables: this.tables,
                    currentTable: this.currentTable,
                    currentData: this.tableData?.slice(0, 5), // Sample of current data
                    schema: this.schema?.filter(s => s.table_name === this.currentTable),
                    stats: this.stats
                },
                metadata: {
                    totalTables: this.tables.length,
                    schemaSize: this.schema.length,
                    hasActiveTable: Boolean(this.currentTable)
                }
            };

            return context;
        } catch (error) {
            console.error('Error getting chatbot context:', error);
            return null;
        }
    }

    // UI Updates
    updateUI() {
        // Update table selector
        const tableSelector = document.getElementById('tableSelector');
        if (tableSelector) {
            tableSelector.innerHTML = `
                <option value="">Select a table</option>
                ${this.tables.map(table => 
                    `<option value="${table}">${table}</option>`
                ).join('')}
            `;

            // Add change listener
            tableSelector.addEventListener('change', (e) => {
                if (e.target.value) {
                    this.loadTableData(e.target.value);
                }
            });
        }

        // Update connection status
        this.updateConnectionStatus(true);
    }

    updateConnectionStatus(success) {
        const statusElement = document.getElementById('connectionStatus');
        if (statusElement) {
            statusElement.className = `connection-status ${success ? 'success' : 'error'}`;
            statusElement.innerHTML = success ? 
                'Connected to database' : 
                'Connection failed <button onclick="database.init()">Retry</button>';
        }
    }

    showError(message) {
        const errorElement = document.getElementById('errorMessage');
        if (errorElement) {
            errorElement.textContent = message;
            errorElement.style.display = 'block';
        }
        this.updateConnectionStatus(false);
    }
}

// Initialize database connection
const database = new DatabaseConnection();

// Export for use in other modules
window.database = database;