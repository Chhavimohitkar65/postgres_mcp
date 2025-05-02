const express = require("express");
const cors = require("cors");
const path = require("path");
const mcpRouter = require("./mcp/router");

const app = express();

// Configure CORS to allow all origins since we're serving frontend from same server
app.use(cors());

app.use(express.json());

// Use MCP router for all /api/mcp endpoints BEFORE static file serving
app.use("/api/mcp", mcpRouter);

// Serve static files from the client directory
app.use(express.static(path.join(__dirname, '../client')));

// Catch-all route to serve index.html for non-API routes
app.get('*', (req, res, next) => {
    // Skip this middleware for API routes
    if (req.path.startsWith('/api/')) {
        return next();
    }
    res.sendFile(path.join(__dirname, '../client/index.html'));
});

// Start Server
const PORT = process.env.PORT || 5001;
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`API endpoints available at http://localhost:${PORT}/api/mcp`);
    console.log('Connected to PostgreSQL database');
});
