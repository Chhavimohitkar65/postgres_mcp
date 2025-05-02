/**
 * Table Visualization Module
 * Contains functions for creating data visualizations
 */

// Create time series chart
function createTimeSeriesChart(canvas, data, dateColumn, valueColumn) {
    const ctx = canvas.getContext('2d');
    
    // Sort data by date
    const sortedData = [...data].sort((a, b) => {
        return new Date(a[dateColumn]) - new Date(b[dateColumn]);
    });
    
    // Prepare chart data
    const chartData = {
        labels: sortedData.map(item => new Date(item[dateColumn])),
        datasets: [{
            label: valueColumn,
            data: sortedData.map(item => item[valueColumn]),
            borderColor: '#3498db',
            backgroundColor: 'rgba(52, 152, 219, 0.1)',
            tension: 0.4,
            pointRadius: 3,
            pointHoverRadius: 5,
            fill: true
        }]
    };
    
    // Create chart
    const chart = new Chart(ctx, {
        type: 'line',
        data: chartData,
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text: `${valueColumn} Over Time`,
                    font: { size: 16 }
                },
                tooltip: {
                    callbacks: {
                        title: (items) => {
                            return new Date(items[0].parsed.x).toLocaleDateString();
                        }
                    }
                }
            },
            scales: {
                x: {
                    type: 'time',
                    time: {
                        unit: 'day',
                        tooltipFormat: 'MMM d, yyyy'
                    },
                    title: {
                        display: true,
                        text: dateColumn
                    }
                },
                y: {
                    title: {
                        display: true,
                        text: valueColumn
                    }
                }
            }
        }
    });
    
    tableAnalysisState.charts.main = chart;
    return chart;
}

// Create scatter plot
function createScatterPlot(canvas, data, xColumn, yColumn) {
    const ctx = canvas.getContext('2d');
    
    // Prepare chart data
    const chartData = {
        datasets: [{
            label: `${xColumn} vs ${yColumn}`,
            data: data.map(item => ({
                x: item[xColumn],
                y: item[yColumn]
            })),
            backgroundColor: 'rgba(52, 152, 219, 0.7)',
            borderColor: '#3498db',
            pointRadius: 5,
            pointHoverRadius: 7
        }]
    };
    
    // Create chart
    const chart = new Chart(ctx, {
        type: 'scatter',
        data: chartData,
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text: `Correlation between ${xColumn} and ${yColumn}`,
                    font: { size: 16 }
                }
            },
            scales: {
                x: {
                    title: {
                        display: true,
                        text: xColumn
                    }
                },
                y: {
                    title: {
                        display: true,
                        text: yColumn
                    }
                }
            }
        }
    });
    
    tableAnalysisState.charts.main = chart;
    return chart;
}

// Create bar chart
function createBarChart(canvas, data, categoryColumn, valueColumn) {
    const ctx = canvas.getContext('2d');
    
    // Group and aggregate data
    const aggregatedData = {};
    data.forEach(item => {
        const category = item[categoryColumn];
        if (category === null || category === undefined) return; // Skip null values
        
        if (!aggregatedData[category]) {
            aggregatedData[category] = 0;
        }
        
        const value = parseFloat(item[valueColumn]);
        if (!isNaN(value)) {
            aggregatedData[category] += value;
        }
    });
    
    // Sort by value (descending)
    const sortedCategories = Object.keys(aggregatedData).sort((a, b) => {
        return aggregatedData[b] - aggregatedData[a];
    });
    
    // Limit to top 15 categories for readability
    const limitedCategories = sortedCategories.slice(0, 15);
    
    // Handle case where there's too many categories
    let displayCategories = limitedCategories;
    let isAbbreviated = false;
    
    // Abbreviate long category names if there are many
    if (limitedCategories.length > 8) {
        isAbbreviated = true;
        displayCategories = limitedCategories.map(cat => {
            if (typeof cat === 'string' && cat.length > 10) {
                return cat.substring(0, 10) + '...';
            }
            return cat;
        });
    }
    
    // Generate colors - more vibrant palette
    const colors = [
        '#4285F4', '#EA4335', '#FBBC05', '#34A853', // Google colors
        '#00ACC1', '#AB47BC', '#FF7043', '#9E9E9E', // Material colors
        '#5C6BC0', '#26A69A', '#EC407A', '#7CB342', 
        '#29B6F6', '#FFA726', '#78909C', '#66BB6A'
    ];
    
    // Prepare chart data
    const chartData = {
        labels: displayCategories,
        datasets: [{
            label: valueColumn,
            data: limitedCategories.map(category => aggregatedData[category]),
            backgroundColor: colors.slice(0, limitedCategories.length),
            borderColor: colors.slice(0, limitedCategories.length).map(c => c),
            borderWidth: 1,
            barPercentage: 0.8,
            maxBarThickness: 35
        }]
    };
    
    // Create chart
    const chart = new Chart(ctx, {
        type: 'bar',
        data: chartData,
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text: `${valueColumn} by ${categoryColumn}`,
                    font: { size: 16, weight: 'bold' }
                },
                tooltip: {
                    callbacks: {
                        title: (context) => {
                            // Show full category name in tooltip if abbreviated
                            return isAbbreviated ? limitedCategories[context[0].dataIndex] : context[0].label;
                        },
                        label: (context) => {
                            return `${valueColumn}: ${formatNumber(context.raw)}`;
                        }
                    }
                },
                legend: {
                    display: false
                }
            },
            scales: {
                x: {
                    title: {
                        display: true,
                        text: categoryColumn,
                        font: { weight: 'bold' }
                    },
                    ticks: {
                        maxRotation: 45,
                        minRotation: 0
                    }
                },
                y: {
                    title: {
                        display: true,
                        text: valueColumn,
                        font: { weight: 'bold' }
                    },
                    ticks: {
                        callback: function(value) {
                            return formatNumber(value);
                        }
                    }
                }
            }
        }
    });
    
    tableAnalysisState.charts.main = chart;
    return chart;
}

// Create pie chart
function createPieChart(canvas, data, categoryColumn) {
    const ctx = canvas.getContext('2d');
    
    // Count occurrences of each category
    const categoryCounts = {};
    data.forEach(item => {
        const category = item[categoryColumn];
        if (!categoryCounts[category]) {
            categoryCounts[category] = 0;
        }
        categoryCounts[category]++;
    });
    
    // Sort by count (descending)
    const sortedCategories = Object.keys(categoryCounts).sort((a, b) => {
        return categoryCounts[b] - categoryCounts[a];
    });
    
    // Limit to top 8 categories for readability, group others
    let limitedCategories = sortedCategories.slice(0, 8);
    const otherCount = sortedCategories.slice(8).reduce((total, category) => {
        return total + categoryCounts[category];
    }, 0);
    
    if (otherCount > 0) {
        limitedCategories.push('Others');
        categoryCounts['Others'] = otherCount;
    }
    
    // Generate colors
    const colors = [
        '#3498db', '#2ecc71', '#e74c3c', '#f39c12', 
        '#9b59b6', '#1abc9c', '#d35400', '#34495e', '#95a5a6'
    ];
    
    // Prepare chart data
    const chartData = {
        labels: limitedCategories,
        datasets: [{
            data: limitedCategories.map(category => categoryCounts[category]),
            backgroundColor: colors,
            borderWidth: 1
        }]
    };
    
    // Create chart
    const chart = new Chart(ctx, {
        type: 'pie',
        data: chartData,
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text: `Distribution of ${categoryColumn}`,
                    font: { size: 16 }
                },
                tooltip: {
                    callbacks: {
                        label: (context) => {
                            const value = context.parsed;
                            const total = context.dataset.data.reduce((total, item) => total + item, 0);
                            const percentage = Math.round((value / total) * 100);
                            return `${context.label}: ${formatNumber(value)} (${percentage}%)`;
                        }
                    }
                },
                legend: {
                    position: 'right'
                }
            }
        }
    });
    
    tableAnalysisState.charts.main = chart;
    return chart;
}

// Create additional visualizations
function createAdditionalVisualizations(container, data, columnTypes) {
    const columns = Object.keys(columnTypes);
    
    // Find numeric and categorical columns
    const numericColumns = columns.filter(col => columnTypes[col] === 'numeric');
    const categoricalColumns = columns.filter(col => columnTypes[col] === 'categorical');
    
    // Create summary stats for numeric columns
    if (numericColumns.length > 0) {
        numericColumns.forEach(column => {
            createNumericSummaryChart(container, data, column);
        });
    }
    
    // Create distribution charts for categorical columns
    if (categoricalColumns.length > 0) {
        categoricalColumns.forEach(column => {
            createCategoricalDistributionChart(container, data, column);
        });
    }
}

// Create summary statistics chart for numeric column
function createNumericSummaryChart(container, data, column) {
    // Extract values and calculate stats
    const values = data.map(item => parseFloat(item[column])).filter(val => !isNaN(val));
    
    if (values.length === 0) return;
    
    const stats = calculateNumericStats(values);
    
    // Create chart container
    const chartCard = document.createElement('div');
    chartCard.className = 'chart-card';
    
    const chartTitle = document.createElement('h3');
    chartTitle.textContent = `${column} - Summary Statistics`;
    
    const canvasContainer = document.createElement('div');
    canvasContainer.style.height = '180px';
    
    const canvas = document.createElement('canvas');
    canvas.id = `summary-${column}`;
    
    canvasContainer.appendChild(canvas);
    chartCard.appendChild(chartTitle);
    chartCard.appendChild(canvasContainer);
    container.appendChild(chartCard);
    
    // Create histogram
    const ctx = canvas.getContext('2d');
    
    // Calculate histogram bins
    const bins = 10;
    const min = stats.min;
    const max = stats.max;
    const binWidth = (max - min) / bins;
    
    const histogram = Array(bins).fill(0);
    
    values.forEach(value => {
        const binIndex = Math.min(Math.floor((value - min) / binWidth), bins - 1);
        histogram[binIndex]++;
    });
    
    // Prepare chart data
    const chartData = {
        labels: Array(bins).fill(0).map((_, i) => Math.round((min + (i * binWidth)) * 100) / 100),
        datasets: [{
            type: 'bar',
            label: 'Frequency',
            data: histogram,
            backgroundColor: 'rgba(52, 152, 219, 0.7)',
            borderColor: '#3498db',
            borderWidth: 1
        }, {
            type: 'line',
            label: 'Average',
            data: Array(bins).fill(stats.mean),
            borderColor: '#e74c3c',
            borderDashed: [5, 5],
            pointRadius: 0
        }]
    };
    
    // Create chart
    const chart = new Chart(ctx, {
        type: 'bar',
        data: chartData,
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    callbacks: {
                        title: (items) => {
                            const index = items[0].dataIndex;
                            const start = Math.round((min + (index * binWidth)) * 100) / 100;
                            const end = Math.round((min + ((index + 1) * binWidth)) * 100) / 100;
                            return `Range: ${start} to ${end}`;
                        }
                    }
                }
            },
            scales: {
                y: {
                    title: {
                        display: true,
                        text: 'Frequency'
                    }
                }
            }
        }
    });
    
    // Add stats below the chart
    const statsTable = document.createElement('table');
    statsTable.className = 'stats-table';
    statsTable.innerHTML = `
        <tr>
            <td>Count: ${formatNumber(values.length)}</td>
            <td>Min: ${formatNumber(stats.min)}</td>
            <td>Max: ${formatNumber(stats.max)}</td>
        </tr>
        <tr>
            <td>Mean: ${formatNumber(stats.mean)}</td>
            <td>Median: ${formatNumber(stats.median)}</td>
            <td>StdDev: ${formatNumber(stats.stdDev)}</td>
        </tr>
    `;
    
    chartCard.appendChild(statsTable);
}

// Create categorical distribution chart
function createCategoricalDistributionChart(container, data, column) {
    // Count occurrences of each category
    const categoryCounts = {};
    data.forEach(item => {
        const category = item[column];
        if (!categoryCounts[category]) {
            categoryCounts[category] = 0;
        }
        categoryCounts[category]++;
    });
    
    // Sort by count (descending)
    const sortedCategories = Object.keys(categoryCounts).sort((a, b) => {
        return categoryCounts[b] - categoryCounts[a];
    });
    
    // Limit to top 10 categories for readability
    const limitedCategories = sortedCategories.slice(0, 10);
    
    // Create chart container
    const chartCard = document.createElement('div');
    chartCard.className = 'chart-card';
    
    const chartTitle = document.createElement('h3');
    chartTitle.textContent = `${column} - Distribution`;
    
    const canvasContainer = document.createElement('div');
    canvasContainer.style.height = '180px';
    
    const canvas = document.createElement('canvas');
    canvas.id = `distribution-${column}`;
    
    canvasContainer.appendChild(canvas);
    chartCard.appendChild(chartTitle);
    chartCard.appendChild(canvasContainer);
    container.appendChild(chartCard);
    
    // Create chart
    const ctx = canvas.getContext('2d');
    
    // Generate colors
    const colors = [
        '#3498db', '#2ecc71', '#e74c3c', '#f39c12', 
        '#9b59b6', '#1abc9c', '#d35400', '#34495e', '#95a5a6', '#7f8c8d'
    ];
    
    // Prepare chart data
    const chartData = {
        labels: limitedCategories,
        datasets: [{
            data: limitedCategories.map(category => categoryCounts[category]),
            backgroundColor: colors.slice(0, limitedCategories.length)
        }]
    };
    
    // Create chart
    const chart = new Chart(ctx, {
        type: 'doughnut',
        data: chartData,
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'right',
                    labels: {
                        boxWidth: 12,
                        padding: 10
                    }
                },
                tooltip: {
                    callbacks: {
                        label: (context) => {
                            const value = context.parsed;
                            const total = context.dataset.data.reduce((total, item) => total + item, 0);
                            const percentage = Math.round((value / total) * 100);
                            return `${context.label}: ${formatNumber(value)} (${percentage}%)`;
                        }
                    }
                }
            },
            cutout: '60%'
        }
    });
}

// Determine column type from data
function determineColumnType(data, column) {
    // Check first 100 values or all rows if less than 100
    const sampleSize = Math.min(100, data.length);
    const sample = data.slice(0, sampleSize);
    
    let numericCount = 0;
    let dateCount = 0;
    let booleanCount = 0;
    let nullCount = 0;
    
    // Count values of each type
    sample.forEach(item => {
        const value = item[column];
        
        // Skip null/undefined values
        if (value === null || value === undefined) {
            nullCount++;
            return;
        }
        
        // Check if date (only if string - dates should be formatted as strings)
        if (typeof value === 'string') {
            const potentialDate = new Date(value);
            if (!isNaN(potentialDate.getTime()) && 
                // Additional check to avoid treating numbers as dates
                (value.includes('-') || value.includes('/') || value.includes('T'))) {
                dateCount++;
                return;
            }
        }
        
        // Check if boolean
        if (value === true || value === false || 
            value === 'true' || value === 'false' || 
            value === 'yes' || value === 'no' ||
            value === 'Y' || value === 'N' ||
            value === 'T' || value === 'F' ||
            value === '1' || value === '0') {
            booleanCount++;
            return;
        }
        
        // Check if numeric
        if (typeof value === 'number' || 
            (typeof value === 'string' && !isNaN(parseFloat(value)) && isFinite(value))) {
            numericCount++;
            return;
        }
    });
    
    // Calculate percentages (excluding nulls)
    const validCount = sampleSize - nullCount;
    const numericPerc = numericCount / validCount;
    const datePerc = dateCount / validCount;
    const booleanPerc = booleanCount / validCount;
    
    // Determine type based on majority
    if (validCount === 0) return 'empty';
    if (numericPerc > 0.8) return 'numeric';
    if (datePerc > 0.8) return 'date';
    if (booleanPerc > 0.8) return 'boolean';
    
    return 'categorical';
}

// Calculate numeric statistics
function calculateNumericStats(values) {
    const sortedValues = [...values].sort((a, b) => a - b);
    
    const min = sortedValues[0];
    const max = sortedValues[sortedValues.length - 1];
    const sum = sortedValues.reduce((acc, val) => acc + val, 0);
    const mean = sum / sortedValues.length;
    
    // Calculate median
    let median;
    if (sortedValues.length % 2 === 0) {
        const mid = sortedValues.length / 2;
        median = (sortedValues[mid - 1] + sortedValues[mid]) / 2;
    } else {
        median = sortedValues[Math.floor(sortedValues.length / 2)];
    }
    
    // Calculate standard deviation
    const squaredDiffs = sortedValues.map(val => Math.pow(val - mean, 2));
    const variance = squaredDiffs.reduce((acc, val) => acc + val, 0) / sortedValues.length;
    const stdDev = Math.sqrt(variance);
    
    return {
        min,
        max,
        mean,
        median,
        stdDev
    };
} 