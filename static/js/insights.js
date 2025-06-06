document.addEventListener('DOMContentLoaded', () => {
    async function initializeInsights() {
        try {
            await createCharts();
            logAudit('view_insights', null, {});
        } catch (error) {
            console.error('Error initializing insights:', error.message);
            logAudit('error_insights_init', null, { error: error.message });
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

    initializeInsights();
});
