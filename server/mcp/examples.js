const fewShotExamples = [
    {
        query: "How many tables are there in the database?",
        sql: "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';"
    },
    {
        query: "List all customers",
        sql: "SELECT * FROM customers;"
    },
    {
        query: "Show active orders",
        sql: "SELECT * FROM orders WHERE status = 'active';"
    },
    {
        query: "Show me row number 5 in customers table",
        sql: "SELECT * FROM customers ORDER BY id LIMIT 1 OFFSET 4;"
    },
    {
        query: "Get customer with id 123",
        sql: "SELECT * FROM customers WHERE id = 123;"
    },
    {
        query: "Show the 10th row in the products table",
        sql: "SELECT * FROM products ORDER BY id LIMIT 1 OFFSET 9;"
    },
    {
        query: "Find orders created in the last 24 hours",
        sql: "SELECT * FROM orders WHERE created_at > NOW() - INTERVAL '24 hours';"
    },
    {
        query: "Show me top 5 customers by purchase amount",
        sql: "SELECT c.*, SUM(o.total_amount) as total_spent FROM customers c JOIN orders o ON c.id = o.customer_id GROUP BY c.id ORDER BY total_spent DESC LIMIT 5;"
    }
];

function getFewShotExamples() {
    return fewShotExamples.map(ex => `Query: ${ex.query}\nSQL: ${ex.sql}`).join('\n\n');
}

module.exports = getFewShotExamples; 