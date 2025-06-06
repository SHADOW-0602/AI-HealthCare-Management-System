document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('add-patient-form');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        clearErrors();
        hideAlert('form-alert');

        const formData = new FormData(form);
        const patientData = {
            name: normalizeInput(formData.get('name')),
            age: parseInt(formData.get('age')) || 0,
            gender: normalizeInput(formData.get('gender')) || null,
            department: normalizeInput(formData.get('department')) || null,
            contact_info: {
                phone: normalizeInput(formData.get('phone')),
                email: normalizeInput(formData.get('email')),
                address: normalizeInput(formData.get('address'))
            },
            allergies: normalizeInput(formData.get('allergies')).split('\n').filter(a => a.trim()),
            emergency_contact_number: normalizeInput(formData.get('emergency_contact_number')),
            prescriptions: normalizeInput(formData.get('prescriptions')).split('\n').filter(p => p.trim()),
            doctor_notes: normalizeInput(formData.get('doctor_notes')).split('\n').filter(n => n.trim()),
            blood_group: normalizeInput(formData.get('blood_group')) || null,
            user_id: document.getElementById('user_id')?.value || 'anonymous'
        };

        // Client-side validations
        if (!patientData.name) return showError('name_error', 'Name is required');
        if (patientData.name.length > 100) return showError('name_error', 'Name must be 1-100 characters');
        if (patientData.age < 0 || patientData.age > 150) return showError('age_error', 'Valid age (0-150) is required');
        if (patientData.gender && patientData.gender.length > 20) return showError('gender_error', 'Gender must be 20 characters or less');
        if (patientData.department && (patientData.department.length < 1 || patientData.department.length > 100)) return showError('department_error', 'Department must be 1-100 characters');
        if (!isValidPhone(patientData.contact_info.phone)) return showError('phone_error', 'Valid phone number (10-15 digits) is required');
        if (!isValidEmail(patientData.contact_info.email)) return showError('email_error', 'Valid email is required');
        if (!patientData.contact_info.address) return showError('address_error', 'Address is required');
        if (!isValidPhone(patientData.emergency_contact_number)) return showError('emergency_contact_error', 'Valid emergency contact number (10-15 digits) is required');
        if (patientData.blood_group && patientData.blood_group.length > 10) return showError('blood_group_error', 'Invalid blood group selection');
        if (patientData.allergies.length > 20) return showError('allergies_error', 'Maximum of 20 allergies allowed');
        if (patientData.allergies.some(a => a.length < 1 || a.length > 100)) return showError('allergies_error', 'Each allergy must be 1-100 characters');
        if (patientData.prescriptions.length > 20) return showError('prescriptions_error', 'Maximum of 20 prescriptions allowed');
        if (patientData.prescriptions.some(p => p.length < 1 || p.length > 100)) return showError('prescriptions_error', 'Each prescription must be 1-100 characters');
        if (patientData.doctor_notes.length > 20) return showError('doctor_notes_error', 'Maximum of 20 notes allowed');
        if (patientData.doctor_notes.some(n => n.length < 1 || n.length > 500)) return showError('doctor_notes_error', 'Each note must be 1-500 characters');

        try {
            const response = await fetchData('/patients', {
                method: 'POST',
                body: JSON.stringify(patientData)
            });
            showAlert('form-alert', 'alert-success', response.message || 'Patient added successfully');
            form.reset();
            logAudit('add_patient_success', response.patient_id, { name: patientData.name, department: patientData.department });
        } catch (error) {
            let errorMessage = error.message || 'Failed to add patient';
            if (error.status === 400) errorMessage = 'Invalid input data. Please check all fields.';
            if (error.status === 409) errorMessage = 'Phone, email, or emergency contact number already exists.';
            showAlert('form-alert', 'alert-danger', errorMessage);
            logAudit('add_patient_failure', null, { error: errorMessage });
        }
    });

    function clearErrors() {
        const errorIds = [
            'name_error', 'age_error', 'gender_error', 'department_error', 'phone_error',
            'email_error', 'address_error', 'emergency_contact_error', 'blood_group_error',
            'allergies_error', 'prescriptions_error', 'doctor_notes_error', 'form_error'
        ];
        errorIds.forEach(id => {
            clearError(id);
            const group = document.getElementById(id)?.closest('.form-group');
            if (group) group.classList.remove('error');
        });
    }

    function showError(elementId, message) {
        const errorDiv = document.getElementById(elementId);
        if (errorDiv) {
            errorDiv.textContent = message;
            errorDiv.classList.remove('hidden');
            const group = errorDiv.closest('.form-group');
            if (group) group.classList.add('error');
        }
    }

    function clearError(elementId) {
        const errorDiv = document.getElementById(elementId);
        if (errorDiv) {
            errorDiv.classList.add('hidden');
            errorDiv.textContent = '';
            const group = errorDiv.closest('.form-group');
            if (group) group.classList.remove('error');
        }
    }

    function showAlert(elementId, alertClass, message) {
        const alertDiv = document.getElementById(elementId);
        if (alertDiv) {
            alertDiv.className = `alert ${alertClass}`;
            alertDiv.textContent = message;
            alertDiv.classList.remove('hidden');
            setTimeout(() => {
                alertDiv.classList.add('fade-out');
                setTimeout(() => alertDiv.classList.add('hidden'), 500);
            }, 3000);
        }
    }

    function hideAlert(elementId) {
        const alertDiv = document.getElementById(elementId);
        if (alertDiv) {
            alertDiv.classList.add('hidden');
            alertDiv.classList.remove('fade-out', 'alert-success', 'alert-danger');
        }
    }

    async function logAudit(action, patientId, details) {
        const userId = document.getElementById('user_id')?.value || 'anonymous';
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
});