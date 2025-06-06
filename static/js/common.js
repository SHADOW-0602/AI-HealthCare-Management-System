const API_BASE = '';

const isValidDate = dateStr => {
    if (!dateStr) return false;
    const regex = /^\d{4}-\d{2}-\d{2}$/;
    if (!regex.test(dateStr)) return false;
    try {
        const date = new Date(dateStr);
        return !isNaN(date.getTime()) && date.getFullYear() >= 1900 && date.getFullYear() <= 2100;
    } catch {
        return false;
    }
};

const compareDates = (startDate, endDate) => {
    if (!startDate || !endDate) return true;
    try {
        return new Date(startDate) <= new Date(endDate);
    } catch {
        return false;
    }
};

const isValidPhone = phone => {
    const cleaned = phone.replace(/[^0-9]/g, '');
    return cleaned.length >= 10 && cleaned.length <= 15;
};

const isValidEmail = email => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

const isValidDepartment = dept => !dept || (dept.length >= 1 && dept.length <= 100);

const normalizeInput = input => {
    if (Array.isArray(input)) return input.filter(s => s).map(s => s.trim()).join('\n').trim();
    return typeof input === 'string' ? input.trim() : '';
};

const manageDateSelection = (inputId, listId, singleSelection = false) => {
    const input = document.getElementById(inputId);
    const list = document.getElementById(listId);
    if (!input || !list) return { dates: [], updateHiddenInput: () => {} };

    const dates = [];
    const existingDates = list.querySelectorAll('.date-item');
    existingDates.forEach(item => {
        const date = item.textContent.split(' ')[0];
        if (isValidDate(date)) dates.push(date);
    });

    input.addEventListener('change', () => {
        const date = input.value;
        if (date && isValidDate(date)) {
            if (singleSelection) {
                dates.length = 0;
                list.innerHTML = '';
            }
            if (!dates.includes(date)) {
                dates.push(date);
                const dateItem = document.createElement('div');
                dateItem.className = 'date-item';
                dateItem.innerHTML = `${date} <span class="remove-date" onclick="removeDate('${inputId}', '${listId}', '${date}')">&times;</span>`;
                list.appendChild(dateItem);
                input.value = '';
                updateHiddenInput();
            }
        }
    });

    let hiddenInput = document.getElementById(`${inputId}-hidden`);
    if (!hiddenInput) {
        hiddenInput = document.createElement('input');
        hiddenInput.type = 'hidden';
        hiddenInput.name = inputId;
        hiddenInput.id = `${inputId}-hidden`;
        input.parentNode.appendChild(hiddenInput);
    }
    hiddenInput.value = dates.join('\n');

    function updateHiddenInput() {
        hiddenInput.value = dates.join('\n');
    }

    return { dates, updateHiddenInput };
};

const removeDate = (inputId, listId, date) => {
    const list = document.getElementById(listId);
    const { dates, updateHiddenInput } = manageDateSelection(inputId, listId);
    const index = dates.indexOf(date);
    if (index > -1) {
        dates.splice(index, 1);
        list.innerHTML = '';
        dates.forEach(d => {
            const dateItem = document.createElement('div');
            dateItem.className = 'date-item';
            dateItem.innerHTML = `${d} <span class="remove-date" onclick="removeDate('${inputId}', '${listId}', '${d}')">&times;</span>`;
            list.appendChild(dateItem);
        });
        updateHiddenInput();
    }
};

const showError = (elementId, message) => {
    const errorDiv = document.getElementById(elementId);
    if (errorDiv) {
        errorDiv.textContent = message;
        errorDiv.classList.remove('hidden');
    }
    console.error(message);
};

const clearError = elementId => {
    const errorDiv = document.getElementById(elementId);
    if (errorDiv) errorDiv.classList.add('hidden');
};

const fetchData = async (url, options = {}) => {
    const userId = document.querySelector('#user_id')?.value || 'anonymous';
    try {
        const response = await fetch(`${API_BASE}${url}${url.includes('?') ? '&' : '?'}user_id=${userId}`, {
            ...options,
            headers: {
                'Content-Type': 'application/json',
                ...options.headers,
            },
        });

        // First check if the response is JSON
        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
            const text = await response.text();
            throw new Error(`Expected JSON but got: ${text.substring(0, 100)}...`);
        }

        const result = await response.json();
        
        if (!response.ok) {
            let message = result.message || 'Request failed';
            if (response.status === 400) message = 'Invalid input data.';
            if (response.status === 404) message = 'Resource not found.';
            if (response.status === 409) message = 'Duplicate data detected.';
            if (response.status === 500) message = 'Server error. Please try again later.';
            throw Object.assign(new Error(message), { status: response.status });
        }
        return result;
    } catch (error) {
        console.error('Fetch error:', error.message, { url, options });
        try {
            // Corrected: Use API_BASE for audit log fetch
            await fetch(`${API_BASE}/audit`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'error_fetch_data',
                    patient_id: null,
                    user_id: userId,
                    details: { error: error.message, url, status: error.status }
                })
            });
        } catch (auditError) {
            console.error('Failed to log audit:', auditError);
        }
        throw error;
    }
};

const formatPatientDetails = patient => {
    const formatDate = dateStr => dateStr ? new Date(dateStr).toLocaleDateString('en-US', {
        year: 'numeric', month: 'long', day: 'numeric'
    }) : 'N/A';

    return `
        <p><strong>Patient ID:</strong> ${patient.patient_id || 'N/A'}</p>
        <p><strong>Name:</strong> ${patient.name || 'N/A'}</p>
        <p><strong>Age:</strong> ${patient.age ?? 'N/A'}</p>
        <p><strong>Gender:</strong> ${patient.gender || 'N/A'}</p>
        <p><strong>Department:</strong> ${patient.department || 'N/A'}</p>
        <p><strong>Blood Group:</strong> ${patient.blood_group || 'N/A'}</p>

        <hr class="section-separator"> <h3>Contact Information</h3>
        <p><strong>Phone:</strong> ${patient.contact_info?.phone || 'N/A'}</p>
        <p><strong>Email:</strong> ${patient.contact_info?.email || 'N/A'}</p>
        <p><strong>Address:</strong> ${patient.contact_info?.address || 'N/A'}</p>
        <p><strong>Emergency Contact:</strong> ${patient.emergency_contact_number || 'N/A'}</p>

        <hr class="section-separator"> <h3>Allergies</h3>
        ${patient.allergies?.length ? `
            <ul>
                ${patient.allergies.map(allergy => `<li>${allergy}</li>`).join('')}
            </ul>
        ` : '<p>No allergies recorded.</p>'}

        <hr class="section-separator"> <h3>Prescriptions</h3>
        ${patient.prescriptions?.length ? `
            <ul>
                ${patient.prescriptions.map(p => `<li>${p}</li>`).join('')}
            </ul>
        ` : '<p>No prescriptions recorded.</p>'}

        <hr class="section-separator"> <h3>Doctor Notes</h3>
        ${patient.doctor_notes?.length ? `
            <ul>
                ${patient.doctor_notes.map(note => `<li>${note}</li>`).join('')}
            </ul>
        ` : '<p>No doctor notes recorded.</p>'}
        
        <hr class="section-separator"> <p><strong>Created At:</strong> ${formatDate(patient.created_at)}</p>
        <p><strong>Updated At:</strong> ${formatDate(patient.updated_at)}</p>
    `;
};

const closeModal = (modalId) => {
    const modal = document.getElementById(modalId);
    if (modal) {
        // Changed to use classList for consistency
        modal.classList.add('hidden');
        document.body.classList.remove('modal-open');
        const userId = document.querySelector('#user_id')?.value || 'anonymous';
        // Corrected: Use API_BASE for audit log fetch
        fetch(`${API_BASE}/audit`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: `close_${modalId}`,
                patient_id: null,
                user_id: userId,
                details: {}
            })
        });
    }
};