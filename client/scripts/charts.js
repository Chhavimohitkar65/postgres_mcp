/**
 * Enhanced Chart Manager
 * Provides reusable chart creation and management functions
 */
class CustomCharts {
    constructor() {
        this.colors = [
            '#3498db', '#2ecc71', '#e74c3c', '#f39c12', 
            '#9b59b6', '#1abc9c', '#34495e', '#2980b9'
        ];
        this.charts = {}; // Store chart instances for updating
        
        // Color schemes for charts
        this.colorSchemes = {
            categorical: [
                'rgba(54, 162, 235, 0.7)', 'rgba(75, 192, 192, 0.7)', 
                'rgba(255, 99, 132, 0.7)', 'rgba(255, 159, 64, 0.7)',
                'rgba(153, 102, 255, 0.7)', 'rgba(255, 205, 86, 0.7)',
                'rgba(201, 203, 207, 0.7)', 'rgba(100, 120, 140, 0.7)'
            ],
            sequential: [
                'rgba(66, 133, 244, 0.8)', 'rgba(52, 120, 235, 0.8)', 
                'rgba(33, 107, 227, 0.8)', 'rgba(25, 95, 218, 0.8)',
                'rgba(18, 84, 210, 0.8)', 'rgba(12, 73, 201, 0.8)'
            ],
            diverging: [
                'rgba(220, 57, 18, 0.7)', 'rgba(240, 100, 60, 0.7)', 
                'rgba(250, 160, 105, 0.7)', 'rgba(200, 200, 200, 0.7)',
                'rgba(140, 180, 220, 0.7)', 'rgba(75, 150, 200, 0.7)',
                'rgba(25, 120, 180, 0.7)'
            ]
        };
    }

    /**
     * Initialize chart resizing behavior
     */
    init() {
        // Handle window resize for all charts
        window.addEventListener('resize', this.handleResize.bind(this));
        
        // Listen for menu item clicks to show different chart types
        document.querySelectorAll('.menu-item[data-chart]').forEach(item => {
            item.addEventListener('click', e => {
                const chartType = e.currentTarget.getAttribute('data-chart');
                this.showChartType(chartType);
            });
        });

        // Listen for view toggle (grid vs list)
        document.getElementById('gridViewBtn')?.addEventListener('click', () => {
            document.querySelectorAll('.charts-grid').forEach(grid => {
                grid.style.gridTemplateColumns = 'repeat(2, 1fr)';
            });
            this.updateChartsLayout();
        });

        document.getElementById('listViewBtn')?.addEventListener('click', () => {
            document.querySelectorAll('.charts-grid').forEach(grid => {
                grid.style.gridTemplateColumns = '1fr';
            });
            this.updateChartsLayout();
        });
    }

    /**
     * Handle window resize to update all charts
     */
    handleResize() {
        // Update all stored chart instances
        Object.values(this.charts).forEach(chart => {
            if (chart && typeof chart.resize === 'function') {
                chart.resize();
            }
        });
    }

    /**
     * Show charts based on selected type
     */
    showChartType(type) {
        const chartCards = document.querySelectorAll('.chart-card');
        
        if (type === 'all') {
            chartCards.forEach(card => card.style.display = 'block');
            return;
        }
        
        chartCards.forEach(card => {
            const chartType = this.getChartTypeFromCanvas(card);
            if (chartType === type || (type === 'advanced' && !['bar', 'pie', 'line'].includes(chartType))) {
                card.style.display = 'block';
            } else {
                card.style.display = 'none';
            }
        });
        
        this.updateChartsLayout();
    }
    
    /**
     * Get chart type from container
     */
    getChartTypeFromCanvas(container) {
        const canvas = container.querySelector('canvas');
        if (!canvas) return 'advanced';
        
        const chartId = canvas.id;
        if (chartId.includes('Bar')) return 'bar';
        if (chartId.includes('Pie')) return 'pie';
        if (chartId.includes('Line')) return 'line';
        return 'advanced';
    }
    
    /**
     * Update charts layout after view changes
     */
    updateChartsLayout() {
        setTimeout(() => {
            Object.values(this.charts).forEach(chart => {
                if (chart && typeof chart.update === 'function') {
                    chart.update();
                }
            });
        }, 300);
    }

    // Common chart options with static sizing
    commonOptions = {
        responsive: true,
        maintainAspectRatio: true,
        aspectRatio: 2,
        layout: {
            padding: {
                top: 10,
                right: 10,
                bottom: 10,
                left: 10
            }
        },
        plugins: {
            legend: {
                position: 'top',
                labels: {
                    boxWidth: 12,
                    padding: 8,
                    font: {
                        size: 11
                    }
                }
            },
            tooltip: {
                padding: 8,
                titleFont: {
                    size: 12
                },
                bodyFont: {
                    size: 11
                }
            }
        },
        scales: {
            x: {
                grid: {
                    display: false
                },
                ticks: {
                    maxRotation: 45,
                    minRotation: 45,
                    font: {
                        size: 10
                    }
                }
            },
            y: {
                beginAtZero: true,
                grid: {
                    color: 'rgba(0, 0, 0, 0.05)'
                },
                ticks: {
                    font: {
                        size: 10
                    }
                }
            }
        }
    };

    /**
     * Create a bar chart with enhanced options
     */
    createBarChart(canvasId, labels, data, title, options = {}) {
        // Destroy existing chart if it exists
        if (this.charts[canvasId]) {
            this.charts[canvasId].destroy();
        }
        
        const canvas = document.getElementById(canvasId);
        if (!canvas) {
            console.error(`Canvas element with ID ${canvasId} not found`);
            return;
        }
        
        const ctx = canvas.getContext('2d');
        
        // Default configuration
        const defaultOptions = {
            indexAxis: 'x',
            colorScheme: this.colorSchemes.categorical,
            backgroundColor: 'rgba(54, 162, 235, 0.6)',
            borderColor: 'rgba(54, 162, 235, 1)',
            borderWidth: 1,
            barThickness: 'flex',
            maxBarThickness: 25,
            compact: true // Enable compact mode by default
        };
        
        // Merge with provided options
        const chartOptions = { ...defaultOptions, ...options };
        
        // Handle color array for multiple datasets
        let datasets;
        if (Array.isArray(data[0])) {
            // Multiple datasets
            datasets = data.map((dataSet, i) => ({
                label: options.datasetLabels?.[i] || `Dataset ${i+1}`,
                data: dataSet,
                backgroundColor: Array.isArray(chartOptions.backgroundColor) 
                    ? chartOptions.backgroundColor[i % chartOptions.backgroundColor.length] 
                    : chartOptions.colorScheme[i % chartOptions.colorScheme.length],
                borderColor: Array.isArray(chartOptions.borderColor) 
                    ? chartOptions.borderColor[i % chartOptions.borderColor.length] 
                    : chartOptions.colorScheme[i % chartOptions.colorScheme.length].replace('0.6', '1'),
                borderWidth: chartOptions.borderWidth,
                barThickness: chartOptions.barThickness,
                maxBarThickness: chartOptions.maxBarThickness
            }));
        } else {
            // Single dataset
            datasets = [{
                label: title,
                data: data,
                backgroundColor: chartOptions.backgroundColor,
                borderColor: chartOptions.borderColor,
                borderWidth: chartOptions.borderWidth,
                barThickness: chartOptions.barThickness,
                maxBarThickness: chartOptions.maxBarThickness
            }];
        }
        
        // Handle large datasets with special configurations
        const isLargeDataset = labels.length > 15;
        
        // Create chart
        this.charts[canvasId] = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: datasets
            },
            options: {
                ...this.commonOptions,
                plugins: {
                    ...this.commonOptions.plugins,
                    title: {
                        display: true,
                        text: title,
                        font: {
                            size: 14
                        },
                        padding: {
                            bottom: 10
                        }
                    }
                }
            }
        });
        
        return this.charts[canvasId];
    }

    /**
     * Create a pie chart with enhanced options
     */
    createPieChart(canvasId, labels, data, title, options = {}) {
        // Destroy existing chart if it exists
        if (this.charts[canvasId]) {
            this.charts[canvasId].destroy();
        }
        
        const canvas = document.getElementById(canvasId);
        if (!canvas) {
            console.error(`Canvas element with ID ${canvasId} not found`);
            return;
        }
        
        const ctx = canvas.getContext('2d');
        
        // Default configuration
        const defaultOptions = {
            colorScheme: this.colorSchemes.categorical,
            borderColor: '#fff',
            borderWidth: 1,
            cutout: 0, // 0 for pie, non-zero for doughnut
            rotation: 0,
            compact: true // Enable compact mode by default
        };
        
        // Merge with provided options
        const chartOptions = { ...defaultOptions, ...options };
        
        // Determine colors based on data length
        const backgroundColor = data.map((_, i) => 
            chartOptions.colorScheme[i % chartOptions.colorScheme.length]
        );
        
        // Create chart
        this.charts[canvasId] = new Chart(ctx, {
            type: chartOptions.cutout > 0 ? 'doughnut' : 'pie',
            data: {
                labels: labels,
                datasets: [{
                    label: title,
                    data: data,
                    backgroundColor: backgroundColor,
                    borderColor: chartOptions.borderColor,
                    borderWidth: chartOptions.borderWidth
                }]
            },
            options: {
                ...this.commonOptions,
                plugins: {
                    ...this.commonOptions.plugins,
                    title: {
                        display: true,
                        text: title,
                        font: {
                            size: 14
                        },
                        padding: {
                            bottom: 10
                        }
                    }
                }
            }
        });
        
        return this.charts[canvasId];
    }

    /**
     * Create a line chart with enhanced options
     */
    createLineChart(canvasId, labels, data, title, options = {}) {
        // Destroy existing chart if it exists
        if (this.charts[canvasId]) {
            this.charts[canvasId].destroy();
        }
        
        const canvas = document.getElementById(canvasId);
        if (!canvas) {
            console.error(`Canvas element with ID ${canvasId} not found`);
            return;
        }
        
        const ctx = canvas.getContext('2d');
        
        // Default configuration
        const defaultOptions = {
            colorScheme: this.colorSchemes.categorical,
            borderColor: 'rgba(75, 192, 192, 1)',
            backgroundColor: 'rgba(75, 192, 192, 0.2)',
            borderWidth: 2,
            tension: 0.4,
            fill: false,
            pointRadius: 2,
            compact: true // Enable compact mode by default
        };
        
        // Merge with provided options
        const chartOptions = { ...defaultOptions, ...options };
        
        // Handle multiple datasets
        let datasets;
        if (Array.isArray(data[0])) {
            // Multiple datasets
            datasets = data.map((dataSet, i) => ({
                label: options.datasetLabels?.[i] || `Dataset ${i+1}`,
                data: dataSet,
                borderColor: Array.isArray(chartOptions.borderColor) 
                    ? chartOptions.borderColor[i % chartOptions.borderColor.length] 
                    : chartOptions.colorScheme[i % chartOptions.colorScheme.length],
                backgroundColor: Array.isArray(chartOptions.backgroundColor) 
                    ? chartOptions.backgroundColor[i % chartOptions.backgroundColor.length] 
                    : chartOptions.colorScheme[i % chartOptions.colorScheme.length].replace('0.7', '0.2'),
                borderWidth: chartOptions.borderWidth,
                tension: chartOptions.tension,
                fill: chartOptions.fill,
                pointRadius: chartOptions.pointRadius
            }));
        } else {
            // Single dataset
            datasets = [{
                label: title,
                data: data,
                borderColor: chartOptions.borderColor,
                backgroundColor: chartOptions.backgroundColor,
                borderWidth: chartOptions.borderWidth,
                tension: chartOptions.tension,
                fill: chartOptions.fill,
                pointRadius: chartOptions.pointRadius
            }];
        }
        
        // Create chart
        this.charts[canvasId] = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: datasets
            },
            options: {
                ...this.commonOptions,
                plugins: {
                    ...this.commonOptions.plugins,
                    title: {
                        display: true,
                        text: title,
                        font: {
                            size: 14
                        },
                        padding: {
                            bottom: 10
                        }
                    }
                }
            }
        });
        
        return this.charts[canvasId];
    }
}

const customCharts = new CustomCharts();

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    customCharts.init();
});