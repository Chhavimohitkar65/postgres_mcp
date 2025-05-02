/**
 * Advanced Visualization Module
 * Provides D3.js-based advanced visualization capabilities
 */
class AdvancedCharts {
    constructor() {
        this.charts = {};
    }

    /**
     * Initialize advanced visualization components
     */
    init() {
        // Listen for visualization type changes
        document.querySelectorAll('.menu-item[data-chart]').forEach(item => {
            item.addEventListener('click', e => {
                const chartType = e.currentTarget.getAttribute('data-chart');
                // Don't reload Chart.js charts, only handle advanced D3 charts
                if (chartType === 'advanced') {
                    this.initRealtimeActivityChart();
                }
            });
        });

        // Initialize real-time activity chart (force-directed graph)
        this.initRealtimeActivityChart();
    }

    /**
     * Initialize real-time activity visualization using force-directed graph
     */
    async initRealtimeActivityChart() {
        const container = d3.select('#realtimeActivityChart');
        
        // Clear any existing content
        container.selectAll('*').remove();
        
        // Get container dimensions
        const width = container.node().getBoundingClientRect().width;
        const height = 400;
        
        // Create SVG
        const svg = container.append('svg')
            .attr('width', width)
            .attr('height', height);
        
        try {
            // Fetch real data from the API
            const response = await fetch('/api/mcp/monitor');
            const data = await response.json();
            
            // Transform API data into nodes and links
            const nodes = [
                { id: "Database", group: 1, size: 30 },
                ...data.tables.map((table, index) => ({
                    id: table.table_name,
                    group: 2,
                    size: Math.min(30, Math.max(15, table.row_count / 1000))
                })),
                ...data.indexes.map((index, i) => ({
                    id: `Index_${i + 1}`,
                    group: 3,
                    size: Math.min(20, Math.max(10, index.scans / 100))
                })),
                { id: "Application", group: 4, size: 25 }
            ];
            
            const links = [
                // Connect database to tables
                ...data.tables.map(table => ({
                    source: "Database",
                    target: table.table_name,
                    value: Math.min(10, Math.max(1, table.row_count / 10000))
                })),
                // Connect tables to indexes
                ...data.indexes.map((index, i) => ({
                    source: index.table,
                    target: `Index_${i + 1}`,
                    value: Math.min(5, Math.max(1, index.scans / 1000))
                })),
                // Connect to application
                ...data.tables.map(table => ({
                    source: table.table_name,
                    target: "Application",
                    value: 1
                }))
            ];
            
            // Define color scale based on group
            const color = d3.scaleOrdinal(d3.schemeCategory10);
            
            // Create force simulation
            const simulation = d3.forceSimulation(nodes)
                .force("link", d3.forceLink(links).id(d => d.id).distance(100))
                .force("charge", d3.forceManyBody().strength(-200))
                .force("center", d3.forceCenter(width / 2, height / 2))
                .force("x", d3.forceX(width / 2).strength(0.1))
                .force("y", d3.forceY(height / 2).strength(0.1));
            
            // Add links
            const link = svg.append("g")
                .selectAll("line")
                .data(links)
                .join("line")
                .attr("stroke", "#999")
                .attr("stroke-opacity", 0.6)
                .attr("stroke-width", d => Math.sqrt(d.value));
            
            // Add nodes
            const node = svg.append("g")
                .selectAll("circle")
                .data(nodes)
                .join("circle")
                .attr("r", d => d.size)
                .attr("fill", d => color(d.group))
                .call(this.drag(simulation));
            
            // Add labels
            const label = svg.append("g")
                .selectAll("text")
                .data(nodes)
                .join("text")
                .text(d => d.id)
                .attr("font-size", "10px")
                .attr("text-anchor", "middle")
                .attr("dy", "0.35em");
            
            // Update positions on each tick
            simulation.on("tick", () => {
                link
                    .attr("x1", d => d.source.x)
                    .attr("y1", d => d.source.y)
                    .attr("x2", d => d.target.x)
                    .attr("y2", d => d.target.y);
                
                node
                    .attr("cx", d => d.x)
                    .attr("cy", d => d.y);
                
                label
                    .attr("x", d => d.x)
                    .attr("y", d => d.y);
            });
            
        } catch (error) {
            console.error('Error initializing activity chart:', error);
            container.append('div')
                .attr('class', 'error-message')
                .text('Unable to load activity chart data');
        }
    }

    /**
     * Create drag behavior for force-directed graph
     */
    drag(simulation) {
        function dragstarted(event, d) {
            if (!event.active) simulation.alphaTarget(0.3).restart();
            d.fx = d.x;
            d.fy = d.y;
        }
        
        function dragged(event, d) {
            d.fx = event.x;
            d.fy = event.y;
        }
        
        function dragended(event, d) {
            if (!event.active) simulation.alphaTarget(0);
            d.fx = null;
            d.fy = null;
        }
        
        return d3.drag()
            .on("start", dragstarted)
            .on("drag", dragged)
            .on("end", dragended);
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    const advancedCharts = new AdvancedCharts();
    advancedCharts.init();
}); 