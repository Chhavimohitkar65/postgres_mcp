# PostgreSQL MCP (Management and Control Platform)

The MCP is a high-performance analytics and visualization platform for PostgreSQL databases. It uses AI to generate optimized SQL queries from natural language, provides visual analysis recommendations, and features efficient row-level access.

## Features

- **Natural Language to SQL**: Convert plain English queries to optimized SQL
- **Smart Visualization Recommendations**: Automatically suggest the best visualization for your data
- **Optimized Row Access**: Efficiently retrieve specific rows using indexing
- **Performance Monitoring**: Track query performance and get optimization suggestions
- **Security**: All queries are validated to prevent SQL injection

## Installation

```bash
# Install dependencies
npm install

# Copy and configure environment variables
cp .env.example .env
# Edit .env with your PostgreSQL credentials and API keys

# Start the server
npm start

# Start with live reload for development
npm run dev
```

## Testing

The MCP includes a comprehensive test suite to validate all endpoints. There are two ways to run the tests:

### Method 1: Start the server first, then run tests

```bash
# In terminal 1: Start the server
npm start

# In terminal 2: Run the tests
npm test
```

### Method 2: Use the all-in-one test script

```bash
# This will start the server, run tests, and shut down the server automatically
npm run test:with-server
```

### Test Configuration

To customize the test configuration, edit the constants at the top of `test.js`:

```javascript
// Configuration
const API_BASE_URL = 'http://localhost:5001/api/mcp';
const ALL_TESTS = true; // Set to false to run only specific tests

// Test data - update with tables that exist in your database
const TEST_TABLE = 'customers'; // Replace with a table that exists in your DB
const TEST_ROW_NUMBER = 1;
const TEST_ROW_ID = 1;
```

### Known Testing Issues

1. **Invalid SQL Test**: The test for executing invalid SQL (e.g., `DROP TABLE`) has been disabled by default because it can crash the server, as the server's validation throws an unhandled exception.

2. **Row-level Tests**: The row-level access tests require that the `TEST_TABLE` exists in your database with at least one row. Update these variables to match your database structure.

3. **Table Names**: Most tests run against the information_schema tables which should exist in any PostgreSQL database. Other tests may require specific tables to be present.

## Environment Configuration

The server connects to PostgreSQL using the configuration in `config.js`. Update the connection parameters as needed:

```javascript
const pool = new Pool({
    host: "localhost",
    port: 5432,
    database: "your_database",
    user: "your_username",
    password: "your_password"
});
```

## API Endpoints

All MCP endpoints are prefixed with `/api/mcp`.

### Schema & Metadata

#### GET `/api/mcp/schema`
Retrieves the database schema (tables and columns)

**Response:**
```json
[
  {
    "table_name": "customers",
    "column_name": "id",
    "data_type": "integer",
    "is_nullable": "NO",
    "column_default": null
  },
  ...
]
```

#### GET `/api/mcp/stats`
Gets database statistics including table counts, data type distribution, and query performance

**Response:**
```json
{
  "table_counts": [
    {"table_name": "customers", "row_count": 1000},
    {"table_name": "orders", "row_count": 5000}
  ],
  "data_type_distribution": {
    "integer": 15,
    "text": 25,
    "timestamp": 8
  },
  "query_performance": {
    "average_response_time": 120,
    "most_common_query_type": "SELECT",
    "query_success_rate": 98.5
  }
}
```

### Natural Language Queries

#### POST `/api/mcp/query`
Process natural language queries and return data

**Input:**
```json
{
  "query": "Show me the top 5 customers by total order amount",
  "insights": {} // Optional: Additional context information 
}
```

**Response:**
```json
{
  "success": true,
  "data": [
    {"customer_id": 42, "name": "ABC Corp", "total_amount": 15420.50},
    ...
  ]
}
```

#### POST `/api/mcp/generate-sql`
Generate SQL from natural language without executing

**Input:**
```json
{
  "query": "Show me all active orders from last week",
  "insights": {} // Optional context
}
```

**Response:**
```json
{
  "sql": "SELECT * FROM orders WHERE status = 'active' AND created_at > NOW() - INTERVAL '7 days'"
}
```

### SQL Execution

#### POST `/api/mcp/execute`
Execute raw SQL queries (SELECT only)

**Input:**
```json
{
  "sql": "SELECT * FROM customers LIMIT 10"
}
```

**Response:**
```json
{
  "data": [
    {"id": 1, "name": "Customer 1", ...},
    ...
  ]
}
```

### Row-Level Access

#### GET `/api/mcp/row/:table/:rowNumber`
Get a specific row by table name and row number

**Example:** `/api/mcp/row/customers/5`

**Response:**
```json
{
  "data": {"id": 5, "name": "Customer 5", ...},
  "_metadata": {
    "table": "customers",
    "rowNumber": 5,
    "executionTime": 12
  }
}
```

#### GET `/api/mcp/row/:table/id/:id`
Get a row by table name and primary key

**Example:** `/api/mcp/row/customers/id/42`

**Response:**
```json
{
  "data": {"id": 42, "name": "Customer 42", ...},
  "_metadata": {
    "table": "customers",
    "id": 42,
    "executionTime": 8
  }
}
```

### Visualization

#### POST `/api/mcp/visualize`
Get visualization recommendations for a dataset

**Input:**
```json
{
  "data": [
    {"date": "2023-01-01", "sales": 1200},
    {"date": "2023-01-02", "sales": 1500},
    ...
  ],
  "query": "Show me sales trend over time"
}
```

**Response:**
```json
{
  "recommendations": [
    {
      "type": "line_chart",
      "suitability": "high",
      "xAxis": "date",
      "yAxis": ["sales"],
      "reason": "Time series data detected"
    },
    ...
  ],
  "metadata": {
    "rowCount": 30,
    "columnCount": 2,
    "columnTypes": {
      "date": "date",
      "sales": "numeric"
    },
    "detectablePatterns": ["time_series"]
  }
}
```

#### POST `/api/mcp/analyze`
Combined endpoint for query execution and visualization recommendation

**Input:**
```json
{
  "query": "Show me monthly sales for the past year",
  "insights": {} // Optional context
}
```

**Response:**
```json
{
  "success": true,
  "data": [
    {"month": "2023-01", "sales": 45000},
    ...
  ],
  "visualization": {
    "recommendations": [
      {
        "type": "line_chart",
        "suitability": "high",
        "xAxis": "month",
        "yAxis": ["sales"],
        "reason": "Time series data detected"
      },
      ...
    ],
    "metadata": {...}
  },
  "_metadata": {
    "executionTime": 156,
    "rowCount": 12
  }
}
```

### Performance Monitoring

#### GET `/api/mcp/performance`
Get query performance metrics

**Response:**
```json
{
  "totalQueries": 1250,
  "averageTime": 85.2,
  "slowestQuery": {
    "query": "SELECT * FROM orders JOIN customers ON orders.customer_id = customers.id WHERE...",
    "time": 3200
  },
  "queryTypes": {
    "SELECT_JOIN": {
      "count": 450,
      "averageTime": 120
    },
    "SELECT": {
      "count": 800,
      "averageTime": 45
    }
  },
  "responseTimeHistory": [...]
}
```

## Natural Language Query Examples

The MCP can understand a wide range of natural language queries, including:

1. **Table Exploration:**
   - "Show me all customers"
   - "List the first 10 orders"
   - "How many products do we have?"

2. **Filtering:**
   - "Find orders created in the last 24 hours"
   - "Show me active customers from New York"
   - "List products with price greater than $100"

3. **Aggregation:**
   - "Show me total sales by month"
   - "What's the average order value by customer category?"
   - "Count orders by status"

4. **Specific Row Access:**
   - "Show me row number 42 in the customers table"
   - "Get the customer with id 123"
   - "Show me the 15th order"

5. **Visualization Queries:**
   - "Show me sales trend over time"
   - "Compare revenue by product category"
   - "Show me the distribution of order values"

## Technical Architecture

The MCP is built with a modular architecture:

- **__init__.js**: Main entry point and request processing
- **query_generation.js**: Natural language to SQL conversion
- **query_validation.js**: SQL security validation
- **execution.js**: Safe query execution
- **visualization_analyzer.js**: Data pattern detection and visualization recommendation
- **stats_collection.js**: Database statistics collection
- **schema_extraction.js**: Database schema extraction
- **router.js**: API routing and endpoint handling

## Security Considerations

- Only SELECT queries are allowed by default
- Queries are validated against forbidden SQL keywords
- Table names are validated against the database schema
- Input validation is performed on all parameters
- Error messages are sanitized to prevent information leakage

## Performance Optimization

The MCP uses several techniques to optimize performance:

- **Primary Key Caching**: Stores table primary keys for faster access
- **Index-Aware Queries**: Generates queries that utilize available indexes
- **Data Sampling**: Uses statistical sampling for large datasets
- **Performance Tracking**: Monitors query execution time

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License. 
