const chartInstances = {};

const chartColors = [
    '#3b82f6', // Blue
    '#ef4444', // Red
    '#10b981', // Green
    '#f59e0b', // Yellow
    '#8b5cf6', // Purple
    '#ec4899', // Pink
    '#14b8a6', // Teal
    '#f97316', // Orange
    '#64748b', // Gray
    '#84cc16', // Lime
    '#d946ef', // Fuchsia
    '#0ea5e9', // Sky Blue
    '#22c55e', // Emerald
    '#eab308', // Amber
    '#a855f7'  // Violet
];

// Color sets for different chart types
const colorSets = {
    gender: ['#3b82f6', '#ec4899', '#64748b'], // Blue, Pink, Gray
    allergies: ['#ef4444', '#f97316', '#f59e0b', '#84cc16', '#22c55e'], // Reds/Yellows/Greens
    age: ['#3b82f6', '#0ea5e9', '#14b8a6', '#10b981'], // Blues/Greens
    blood: ['#ef4444', '#f97316', '#f59e0b', '#ec4899', '#d946ef'], // Reds/Pinks
    visits: ['#8b5cf6', '#a855f7', '#7c3aed'], // Purples
    department: ['#3b82f6', '#0ea5e9', '#14b8a6', '#10b981', '#84cc16'] // Blues/Greens
};

async function loadChartJs() {
    return new Promise((resolve, reject) => {
        if (typeof Chart === 'function') {
            resolve();
            return;
        }
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/chart.js@4.4.4/dist/chart.umd.min.js';
        script.async = false;
        document.head.appendChild(script);
        script.onload = () => {
            if (typeof Chart === 'function') {
                resolve();
            } else {
                loadFallbackChartJs(resolve, reject);
            }
        };
        script.onerror = () => loadFallbackChartJs(resolve, reject);
    });
}

async function loadFallbackChartJs(resolve, reject) {
    const fallbackScript = document.createElement('script');
    fallbackScript.src = 'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.4/chart.umd.min.js';
    fallbackScript.async = false;
    document.head.appendChild(fallbackScript);
    fallbackScript.onload = () => {
        if (typeof Chart === 'function') {
            resolve();
        } else {
            reject(new Error('Chart.js failed to load'));
        }
    };
    fallbackScript.onerror = () => reject(new Error('Failed to load Chart.js from fallback'));
}

async function createCharts() {
    const userId = document.querySelector('#user_id')?.value || 'anonymous';
    const chartConfigs = [
        {
            id: 'gender-chart',
            title: 'Gender Distribution',
            type: 'pie',
            colorSet: 'gender',
            labels: [],
            getData: () => []
        },
        {
            id: 'allergies-chart',
            title: 'Top Allergies',
            type: 'bar',
            colorSet: 'allergies',
            labels: [],
            getData: () => []
        },
        {
            id: 'age-dist-chart',
            title: 'Age Distribution',
            type: 'bar',
            colorSet: 'age',
            labels: [],
            getData: () => []
        },
        {
            id: 'blood-group-chart',
            title: 'Blood Group Distribution',
            type: 'bar',
            colorSet: 'blood',
            labels: [],
            getData: () => []
        },
        {
            id: 'visits-chart',
            title: 'Visits per Month',
            type: 'line',
            colorSet: 'visits',
            labels: [],
            getData: () => []
        },
        {
            id: 'age-dept-chart',
            title: 'Average Age per Department',
            type: 'bar',
            colorSet: 'department',
            labels: [],
            getData: () => []
        }
    ];

    try {
        await loadChartJs();

        const testCanvas = document.createElement('canvas');
        try {
            new Chart(testCanvas.getContext('2d'), {
                type: 'bar',
                data: { labels: ['Test'], datasets: [{ label: 'Test', data: [1], backgroundColor: '#1e40af' }] },
                options: { responsive: false }
            });
            logAudit('test_chart_success', null, {});
        } catch (testErr) {
            logAudit('test_chart_failure', null, { error: testErr.message });
            throw new Error(`Chart.js test failed: ${testErr.message}`);
        }

        const response = await fetchData('/insights');

        chartConfigs[0].labels = Object.keys(response.gender_distribution || {});
        chartConfigs[0].getData = () => Object.values(response.gender_distribution || {});
        chartConfigs[1].labels = (response.top_allergies || []).map(item => item.name);
        chartConfigs[1].getData = () => (response.top_allergies || []).map(item => item.count);
        chartConfigs[2].labels = (response.age_distribution || []).map(item => item.range);
        chartConfigs[2].getData = () => (response.age_distribution || []).map(item => item.count);
        chartConfigs[3].labels = (response.blood_group_distribution || []).map(item => item.name);
        chartConfigs[3].getData = () => (response.blood_group_distribution || []).map(item => item.count);
        chartConfigs[4].labels = (response.visit_frequency_per_month || []).map(item => item.month);
        chartConfigs[4].getData = () => (response.visit_frequency_per_month || []).map(item => item.count);
        chartConfigs[5].labels = (response.avg_age_per_department || []).map(item => item.department);
        chartConfigs[5].getData = () => (response.avg_age_per_department || []).map(item => item.average_age);

        chartConfigs.forEach((config) => {
            const canvas = document.getElementById(config.id);
            const container = canvas?.parentElement;
            if (!canvas || !container) return;

            container.classList.add('loading');
            const data = config.getData();

            if (data.length === 0) {
                showNoDataMessage(config.id);
                container.classList.remove('loading');
                return;
            }

            if (chartInstances[config.id]) {
                chartInstances[config.id].destroy();
            }

            // Get the appropriate color set for this chart
            const colors = colorSets[config.colorSet] || chartColors;

            chartInstances[config.id] = new Chart(canvas.getContext('2d'), {
                type: config.type,
                data: {
                    labels: config.labels,
                    datasets: [{
                        label: config.title,
                        data,
                        backgroundColor: config.type === 'pie' 
                            ? colors.slice(0, config.labels.length) 
                            : colors[0],
                        borderColor: config.type === 'line' 
                            ? colors[0] 
                            : 'rgba(255, 255, 255, 0.8)',
                        borderWidth: config.type === 'line' ? 3 : 1,
                        hoverBorderWidth: 2,
                        hoverBorderColor: '#000',
                        // For bar charts, use different colors for each bar
                        ...(config.type === 'bar' && {
                            backgroundColor: colors.slice(0, config.labels.length),
                            borderColor: colors.map(c => `${c}cc`)
                        })
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { 
                            display: config.type === 'pie',
                            position: 'right'
                        },
                        title: { 
                            display: true, 
                            text: config.title,
                            font: { size: 16 }
                        },
                        tooltip: {
                            backgroundColor: 'rgba(0, 0, 0, 0.8)',
                            titleFont: { size: 14 },
                            bodyFont: { size: 12 },
                            padding: 10
                        }
                    },
                    scales: config.type !== 'pie' ? {
                        y: { 
                            beginAtZero: true,
                            grid: { color: 'rgba(0, 0, 0, 0.1)' }
                        },
                        x: {
                            grid: { color: 'rgba(0, 0, 0, 0.05)' }
                        }
                    } : undefined,
                    animation: {
                        duration: 1000
                    }
                }
            });

            container.classList.remove('loading');
            logAudit('render_chart', null, { chart: config.id });
        });
    } catch (error) {
        chartConfigs.forEach(config => {
            const container = document.getElementById(config.id)?.parentElement;
            if (container) {
                showNoDataMessage(config.id);
                container.classList.remove('loading');
            }
        });
        logAudit('error_fetch_insights', null, { error: error.message });
    }
}

function showNoDataMessage(chartId) {
    const container = document.getElementById(chartId)?.parentElement;
    if (container) {
        const noDataMessage = container.querySelector('.no-data-message');
        if (noDataMessage) {
            noDataMessage.classList.remove('hidden');
        }
        const canvas = container.querySelector('canvas');
        if (canvas) {
            canvas.classList.add('hidden');
        }
    }
}

async function logAudit(action, patientId, details) {
    const userId = document.querySelector('#user_id')?.value || 'anonymous';
    try {
        await fetch('/audit', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action, patient_id: patientId, user_id: userId, details })
        });
    } catch (error) {
        console.error('Audit log failed:', error.message);
    }
}

createCharts();