const PAGE_LIMIT = 10;
let currentPage = 1;
let totalPages = 1;

document.addEventListener('DOMContentLoaded', () => {
    if (!document.getElementById('patients-table')) return;

    async function fetchPatients() {
        try {
            const nameFilter = document.getElementById('search-name')?.value.trim() || '';
            const departmentFilter = document.getElementById('search-department')?.value === 'All Departments' ? '' : document.getElementById('search-department')?.value.trim() || '';
            const sortBy = document.getElementById('search-sort')?.value || 'name';
            // Ensure fetchData uses API_BASE, which is already handled in common.js
            const response = await fetchData(`/patients?page=${currentPage}&limit=${PAGE_LIMIT}&name=${encodeURIComponent(nameFilter)}&department=${encodeURIComponent(departmentFilter)}&sort=${sortBy}`);
            totalPages = response.pages || 1;

            const tbody = document.getElementById('patients-table-body');
            tbody.innerHTML = response.patients?.length > 0
                ? response.patients.map(patient => `
                    <tr>
                        <td>${patient.patient_id || 'N/A'}</td>
                        <td>${patient.name || 'N/A'}</td>
                        <td>${patient.age ?? 'N/A'}</td>
                        <td>${patient.gender || 'N/A'}</td>
                        <td>${patient.department || 'N/A'}</td>
                        <td>${patient.contact_info?.phone || 'N/A'}</td>
                        <td>
                            <button class="btn btn-primary" onclick="viewPatient(${patient.patient_id})">View</button>
                        </td>
                    </tr>
                `).join('')
                : '<tr><td colspan="7">No patients found.</td></tr>';

            renderPagination();
        } catch (error) {
            console.error('Error fetching patients:', error.message);
            document.getElementById('patients-table-body').innerHTML = `<tr><td colspan="7">Error: ${error.message}</td></tr>`;
            // Corrected: Use API_BASE for audit log fetch
            await fetch(`${API_BASE}/audit`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'error_fetch_patients',
                    patient_id: null,
                    user_id: document.querySelector('#user_id')?.value || 'anonymous',
                    details: { error: error.message }
                })
            });
        }
    }

    function renderPagination() {
        const paginationContainer = document.getElementById('pagination');
        if (!paginationContainer) return;
        let paginationHTML = `
            <button onclick="changePage(${currentPage - 1})" ${currentPage === 1 ? 'disabled' : ''}>Previous</button>
        `;
        for (let i = 1; i <= totalPages; i++) {
            paginationHTML += `
                <button onclick="changePage(${i})" ${currentPage === i ? 'class="active"' : ''}>${i}</button>
            `;
        }
        paginationHTML += `
            <button onclick="changePage(${currentPage + 1})" ${currentPage === totalPages ? 'disabled' : ''}>Next</button>
        `;
        paginationContainer.innerHTML = paginationHTML;
    }

    window.changePage = (page) => {
        if (page < 1 || page > totalPages) return;
        currentPage = page;
        fetchPatients();
    };

    window.viewPatient = async (patientId) => {
        try {
            // Ensure fetchData uses API_BASE, which is already handled in common.js
            const patient = await fetchData(`/patients/${patientId}`);
            const modalContent = document.getElementById('modalContent');
            if (modalContent) {
                modalContent.innerHTML = formatPatientDetails(patient);
                const modal = document.getElementById('patientModal');
                // Removed redundant style.display = 'block'; - classList.remove('hidden') is sufficient
                modal.classList.remove('hidden');
                // Corrected: Use API_BASE for audit log fetch
                await fetch(`${API_BASE}/audit`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        action: 'view_patient',
                        patient_id: patientId,
                        user_id: document.querySelector('#user_id')?.value || 'anonymous',
                        details: { name: patient.name, department: patient.department }
                    })
                });
            }
        } catch (error) {
            console.error('Error viewing patient:', error.message);
            alert(`Error: ${error.message}`);
            // Corrected: Use API_BASE for audit log fetch
            await fetch(`${API_BASE}/audit`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'error_view_patient',
                    patient_id: patientId,
                    user_id: document.querySelector('#user_id')?.value || 'anonymous',
                    details: { error: error.message }
                })
            });
        }
    };

    const searchName = document.getElementById('search-name');
    const searchDepartment = document.getElementById('search-department');
    const searchSort = document.getElementById('search-sort');
    const resetSearchBtn = document.getElementById('reset-search-btn');

    if (searchName) searchName.addEventListener('input', () => { currentPage = 1; fetchPatients(); });
    if (searchDepartment) searchDepartment.addEventListener('change', () => { currentPage = 1; fetchPatients(); });
    if (searchSort) searchSort.addEventListener('change', () => { currentPage = 1; fetchPatients(); });
    if (resetSearchBtn) {
        resetSearchBtn.addEventListener('click', () => {
            if (searchName) searchName.value = '';
            if (searchDepartment) searchDepartment.value = '';
            if (searchSort) searchSort.value = 'name';
            currentPage = 1;
            fetchPatients();
            // Corrected: Use API_BASE for audit log fetch
            fetch(`${API_BASE}/audit`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'reset_search',
                    patient_id: null,
                    user_id: document.querySelector('#user_id')?.value || 'anonymous',
                    details: {}
                })
            });
        });
    }

    fetchPatients();

    const patientModal = document.getElementById('patientModal');
    if (patientModal) {
        patientModal.addEventListener('click', (event) => {
            if (event.target === patientModal) {
                closeModal('patientModal');
            }
        });
    }

    const closePatientModal = document.getElementById('close-patient-modal');
    if (closePatientModal) {
        closePatientModal.addEventListener('click', () => closeModal('patientModal'));
    }
});