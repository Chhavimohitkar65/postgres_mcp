/**
 * Real-time Data Visualization Manager
 * Handles fetching and updating real-time data for charts
 */
class RealTimeManager {
    constructor() {
        this.charts = {};
        this.dataSets = {};
        this.interval = null;
        this.updateInterval = 5000; // Default: 5 seconds
        this.MAX_DATA_POINTS = 20; // Maximum data points to show in time series charts
    }

    /**
     * Initialize the real-time visualization components
     */
    init() {
        // Set up DOM elements
        this.startBtn = document.getElementById('startMonitoring');
        this.stopBtn = document.getElementById('stopMonitoring');
        this.intervalSelect = document.getElementById('updateInterval');

        if (!this.startBtn || !this.stopBtn || !this.intervalSelect) {
            console.error('Required DOM elements for real-time monitoring not found');
            return;
        }

        // Setup event listeners
        this.startBtn.addEventListener('click', () => this.startMonitoring());
        this.stopBtn.addEventListener('click', () => this.stopMonitoring());
        this.intervalSelect.addEventListener('change', (e) => {
            this.updateInterval = parseInt(e.target.value);
            if (this.interval) {
                this.stopMonitoring();
                this.startMonitoring();
            }
        });

        // Initialize charts
        this.initCharts();
    }

    /**
     * Create the initial charts
     */
    initCharts() {
        // Connection count chart (time series line chart)
        const connectionsCtx = document.getElementById('connectionsChart').getContext('2d');
        this.charts.connections = new Chart(connectionsCtx, {
            type: 'line',
            data: {
                labels: [],
                datasets: [{
                    label: 'Active Connections',
                    data: [],
                    borderColor: 'rgba(54, 162, 235, 1)',
                    backgroundColor: 'rgba(54, 162, 235, 0.2)',
                    borderWidth: 2,
                    tension: 0.3,
                    fill: true
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: {
                    duration: 500
                },
                scales: {
                    x: {
                        type: 'time',
                        time: {
                            unit: 'second',
                            tooltipFormat: 'HH:mm:ss',
                            displayFormats: {
                                second: 'HH:mm:ss'
                            }
                        },
                        title: {
                            display: true,
                            text: 'Time'
                        }
                    },
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: 'Connection Count'
                        }
                    }
                },
                plugins: {
                    legend: {
                        display: true,
                        position: 'top'
                    },
                    tooltip: {
                        mode: 'index',
                        intersect: false
                    }
                }
            }
        });

        // Query execution time chart (time series line chart)
        const queryTimeCtx = document.getElementById('queryTimeChart').getContext('2d');
        this.charts.queryTime = new Chart(queryTimeCtx, {
            type: 'line',
            data: {
                labels: [],
                datasets: [{
                    label: 'Execution Time (ms)',
                    data: [],
                    borderColor: 'rgba(255, 99, 132, 1)',
                    backgroundColor: 'rgba(255, 99, 132, 0.2)',
                    borderWidth: 2,
                    tension: 0.3,
                    fill: true
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: {
                    duration: 500
                },
                scales: {
                    x: {
                        type: 'time',
                        time: {
                            unit: 'second',
                            tooltipFormat: 'HH:mm:ss',
                            displayFormats: {
                                second: 'HH:mm:ss'
                            }
                        },
                        title: {
                            display: true,
                            text: 'Time'
                        }
                    },
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: 'Execution Time (ms)'
                        }
                    }
                },
                plugins: {
                    legend: {
                        display: true,
                        position: 'top'
                    },
                    tooltip: {
                        mode: 'index',
                        intersect: false
                    }
                }
            }
        });

        // Initialize D3.js charts
        this.initActiveTablesChart();
        this.initDbMetricsGauge();

        // Initialize empty datasets
        this.dataSets = {
            connections: [],
            queryTime: [],
            activeTables: [],
            metrics: {
                cpu: 0,
                memory: 0,
                disk: 0
            }
        };
    }

    /**
     * Initialize D3.js active tables chart
     */
    initActiveTablesChart() {
        const container = d3.select('#activeTablesChart');
        container.html(''); // Clear any existing content

        // Set dimensions
        const width = container.node().clientWidth;
        const height = container.node().clientHeight || 250;
        const margin = { top: 20, right: 20, bottom: 40, left: 40 };
        const innerWidth = width - margin.left - margin.right;
        const innerHeight = height - margin.top - margin.bottom;

        // Create SVG
        const svg = container.append('svg')
            .attr('width', width)
            .attr('height', height)
            .append('g')
            .attr('transform', `translate(${margin.left},${margin.top})`);

        // Create scales
        const xScale = d3.scaleBand()
            .range([0, innerWidth])
            .padding(0.1);

        const yScale = d3.scaleLinear()
            .range([innerHeight, 0]);

        // Create axes
        const xAxis = svg.append('g')
            .attr('transform', `translate(0,${innerHeight})`)
            .attr('class', 'x-axis');

        const yAxis = svg.append('g')
            .attr('class', 'y-axis');

        // Add axis labels
        svg.append('text')
            .attr('text-anchor', 'middle')
            .attr('transform', `translate(${innerWidth/2},${innerHeight + margin.bottom - 5})`)
            .text('Table Name')
            .style('font-size', '12px');

        svg.append('text')
            .attr('text-anchor', 'middle')
            .attr('transform', `translate(${-margin.left/2},${innerHeight/2})rotate(-90)`)
            .text('Operations')
            .style('font-size', '12px');

        // Store references for updating
        this.charts.activeTablesElements = {
            svg, xScale, yScale, xAxis, yAxis
        };
    }

    /**
     * Initialize D3.js gauge charts for database metrics
     */
    initDbMetricsGauge() {
        const container = d3.select('#dbMetricsGauge');
        container.html(''); // Clear any existing content

        // Set dimensions
        const width = container.node().clientWidth;
        const height = container.node().clientHeight || 250;
        
        // Create SVG
        const svg = container.append('svg')
            .attr('width', width)
            .attr('height', height);
        
        // Create 3 gauge charts
        this.createGaugeChart(svg, 'CPU', width/2, height/3, width/3, 0);
        this.createGaugeChart(svg, 'Memory', width/4, height*2/3, width/4, 0);
        this.createGaugeChart(svg, 'Disk', width*3/4, height*2/3, width/4, 0);
    }

    /**
     * Create a single gauge chart
     */
    createGaugeChart(svg, name, cx, cy, radius, value) {
        const group = svg.append('g')
            .attr('transform', `translate(${cx},${cy})`);
        
        // Create gauge background
        const background = group.append('path')
            .attr('class', 'gauge-background')
            .attr('d', d3.arc()
                .innerRadius(radius * 0.6)
                .outerRadius(radius * 0.8)
                .startAngle(-Math.PI/2)
                .endAngle(Math.PI/2))
            .attr('fill', '#e0e0e0');
        
        // Create gauge foreground
        const foreground = group.append('path')
            .attr('class', `gauge-value-${name.toLowerCase()}`)
            .attr('d', d3.arc()
                .innerRadius(radius * 0.6)
                .outerRadius(radius * 0.8)
                .startAngle(-Math.PI/2)
                .endAngle(-Math.PI/2 + Math.PI * (value/100)))
            .attr('fill', value < 30 ? '#2ecc71' : value < 70 ? '#f39c12' : '#e74c3c');
        
        // Add text
        group.append('text')
            .attr('class', 'gauge-label')
            .attr('text-anchor', 'middle')
            .attr('dy', radius * 0.2)
            .text(name)
            .style('font-size', '14px')
            .style('font-weight', 'bold');
        
        group.append('text')
            .attr('class', `gauge-value-text-${name.toLowerCase()}`)
            .attr('text-anchor', 'middle')
            .attr('dy', radius * -0.1)
            .text(`${value}%`)
            .style('font-size', '18px');
        
        // Store references for updating
        if (!this.charts.gauges) this.charts.gauges = {};
        this.charts.gauges[name.toLowerCase()] = {
            foreground,
            valueText: group.select(`.gauge-value-text-${name.toLowerCase()}`)
        };
    }

    /**
     * Update gauge value
     */
    updateGauge(name, value) {
        const gauge = this.charts.gauges[name.toLowerCase()];
        const radius = 70; // Approximate value, should match what's used in createGaugeChart

        // Update the arc
        gauge.foreground
            .transition()
            .duration(500)
            .attr('d', d3.arc()
                .innerRadius(radius * 0.6)
                .outerRadius(radius * 0.8)
                .startAngle(-Math.PI/2)
                .endAngle(-Math.PI/2 + Math.PI * (value/100)))
            .attr('fill', value < 30 ? '#2ecc71' : value < 70 ? '#f39c12' : '#e74c3c');
        
        // Update the text
        gauge.valueText.text(`${value}%`);
    }

    /**
     * Start the real-time monitoring
     */
    startMonitoring() {
        if (this.interval) return; // Already running

        // Update UI
        this.startBtn.disabled = true;
        this.stopBtn.disabled = false;

        // Setup data polling
        this.interval = setInterval(() => this.updateData(), this.updateInterval);
        
        // Do an immediate update
        this.updateData();
    }

    /**
     * Stop the real-time monitoring
     */
    stopMonitoring() {
        if (!this.interval) return; // Not running

        // Clear interval
        clearInterval(this.interval);
        this.interval = null;

        // Update UI
        this.startBtn.disabled = false;
        this.stopBtn.disabled = true;
    }

    /**
     * Update all chart data
     */
    async updateData() {
        try {
            // Fetch real-time monitoring data
            const response = await fetch('/api/mcp/monitor');
            const data = await response.json();

            // Update datasets
            this.updateConnectionsData(data.connections);
            this.updateQueryTimeData(data.queries);
            this.updateActiveTablesData(data.tables);
            this.updateDbMetricsData(data.metrics);

            // Update charts
            this.updateCharts();
        } catch (error) {
            console.error('Error updating real-time data:', error);
            // Show error message to user
            const errorMessage = document.createElement('div');
            errorMessage.className = 'error-message';
            errorMessage.textContent = 'Unable to fetch real-time data. Please check your connection.';
            document.querySelector('.realtime-grid').prepend(errorMessage);
        }
    }

    /**
     * Update connections data
     */
    updateConnectionsData(connections) {
        // Add new data point
        const now = new Date();
        this.dataSets.connections.push({
            x: now,
            y: connections
        });

        // Limit data points
        if (this.dataSets.connections.length > this.MAX_DATA_POINTS) {
            this.dataSets.connections.shift();
        }
    }

    /**
     * Update query time data
     */
    updateQueryTimeData(queryTime) {
        // Add new data point
        const now = new Date();
        this.dataSets.queryTime.push({
            x: now,
            y: queryTime
        });

        // Limit data points
        if (this.dataSets.queryTime.length > this.MAX_DATA_POINTS) {
            this.dataSets.queryTime.shift();
        }
    }

    /**
     * Update active tables data
     */
    updateActiveTablesData(tables) {
        this.dataSets.activeTables = tables;
    }

    /**
     * Update database metrics data
     */
    updateDbMetricsData(metrics) {
        this.dataSets.metrics = metrics;
    }

    /**
     * Update all charts with current data
     */
    updateCharts() {
        // Update line charts
        this.charts.connections.data.labels = this.dataSets.connections.map(d => d.x);
        this.charts.connections.data.datasets[0].data = this.dataSets.connections.map(d => d.y);
        this.charts.connections.update();

        this.charts.queryTime.data.labels = this.dataSets.queryTime.map(d => d.x);
        this.charts.queryTime.data.datasets[0].data = this.dataSets.queryTime.map(d => d.y);
        this.charts.queryTime.update();

        // Update active tables chart (D3)
        this.updateActiveTablesChart();

        // Update metrics gauges (D3)
        this.updateGauge('cpu', this.dataSets.metrics.cpu);
        this.updateGauge('memory', this.dataSets.metrics.memory);
        this.updateGauge('disk', this.dataSets.metrics.disk);
    }

    /**
     * Update active tables bar chart
     */
    updateActiveTablesChart() {
        const { svg, xScale, yScale, xAxis, yAxis } = this.charts.activeTablesElements;
        const data = this.dataSets.activeTables;

        // Update scales
        xScale.domain(data.map(d => d.name));
        yScale.domain([0, d3.max(data, d => d.operations) || 10]);

        // Update axes
        xAxis.transition().duration(300).call(d3.axisBottom(xScale));
        yAxis.transition().duration(300).call(d3.axisLeft(yScale));

        // Update bars
        const bars = svg.selectAll('.bar')
            .data(data, d => d.name);

        // Remove old bars
        bars.exit()
            .transition()
            .duration(300)
            .attr('y', yScale(0))
            .attr('height', 0)
            .remove();

        // Add new bars
        bars.enter()
            .append('rect')
            .attr('class', 'bar')
            .attr('x', d => xScale(d.name))
            .attr('width', xScale.bandwidth())
            .attr('y', yScale(0))
            .attr('height', 0)
            .attr('fill', '#9b59b6')
            .merge(bars) // Update existing bars
            .transition()
            .duration(300)
            .attr('x', d => xScale(d.name))
            .attr('width', xScale.bandwidth())
            .attr('y', d => yScale(d.operations))
            .attr('height', d => yScale(0) - yScale(d.operations));
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    const realTimeManager = new RealTimeManager();
    realTimeManager.init();
}); 