document.addEventListener('DOMContentLoaded', () => {
    const patientTableBody = document.getElementById('patient-table-body');
    const editPatientForm = document.getElementById('edit-patient-form');
    const editPatientModal = document.getElementById('edit-patient-modal');
    const closeEditModal = document.getElementById('close-edit-modal');

    async function fetchPatients() {
        try {
            // Updated to use API_BASE which is now '/api'
            const data = await fetchData(`${API_BASE}/patients?limit=100&page=1`);
            const patients = data.patients || [];
            patientTableBody.innerHTML = patients.length ? patients.map(patient => `
            <tr data-patient-id="${patient.patient_id}">
                <td>${patient.patient_id}</td>
                <td>${patient.name}</td>
                <td>${patient.age}</td>
                <td>${patient.gender || 'N/A'}</td>
                <td>${patient.department || 'N/A'}</td>
                <td>
                    <button class="btn btn-primary edit-patient-btn">Edit</button>
                    <button class="btn btn-danger delete-patient-btn">Delete</button>
                </td>
            </tr>
        `).join('') : '<tr><td colspan="6">No patients found.</td></tr>';
        } catch (error) {
            showAlert('table_error', 'alert-danger', `Error loading patients: ${error.message}`);
            logAudit('error_fetch_patients', null, { error: error.message });
        }
    }

    // Event delegation for edit and delete buttons
    patientTableBody.addEventListener('click', async (e) => {
        console.log('Click event triggered', e.target);
        if (e.target.classList.contains('edit-patient-btn')) {
            const patientId = e.target.closest('tr').dataset.patientId;
            console.log('Edit button clicked for patientId:', patientId);
            await editPatient(patientId);
        } else if (e.target.classList.contains('delete-patient-btn')) {
            const patientId = e.target.closest('tr').dataset.patientId;
            console.log('Delete button clicked for patientId:', patientId);
            await deletePatient(patientId);
        }
    });

    window.editPatient = async (patientId) => {
        console.log('editPatient called with patientId:', patientId);
        try {
            console.log('Fetching patient data from:', `${API_BASE}/patients/${patientId}`);
            const patient = await fetchData(`${API_BASE}/patients/${patientId}`);
            console.log('Patient data received:', patient);
            document.getElementById('edit_patient_id').value = patient.patient_id || '';
            document.getElementById('edit_name').value = patient.name || '';
            document.getElementById('edit_age').value = patient.age || '';
            document.getElementById('edit_gender').value = patient.gender || '';
            document.getElementById('edit_department').value = patient.department || '';
            document.getElementById('edit_phone').value = patient.contact_info?.phone || '';
            document.getElementById('edit_email').value = patient.contact_info?.email || '';
            document.getElementById('edit_address').value = patient.contact_info?.address || '';
            document.getElementById('edit_emergency_contact').value = patient.emergency_contact_number || '';
            document.getElementById('edit_blood_group').value = patient.blood_group || '';
            document.getElementById('edit_allergies').value = patient.allergies?.join('\n') || '';
            document.getElementById('edit_prescriptions').value = patient.prescriptions?.join('\n') || '';
            document.getElementById('edit_doctor_notes').value = patient.doctor_notes?.join('\n') || '';
            console.log('Showing modal...');
            editPatientModal.classList.remove('hidden');
            logAudit('open_edit_patient', patientId, { name: patient.name });
        } catch (error) {
            console.error('Error in editPatient:', error);
            showAlert('table_error', 'alert-danger', `Error loading patient: ${error.message}`);
            logAudit('error_open_edit_patient', patientId, { error: error.message });
        }
    };

    window.deletePatient = async (patientId) => {
        if (!confirm('Are you sure you want to delete this patient?')) return;
        try {
            // Updated to use API_BASE which is now '/api'
            await fetchData(`${API_BASE}/patients/${patientId}`, { method: 'DELETE' });
            showAlert('table_error', 'alert-success', 'Patient deleted successfully');
            fetchPatients();
            logAudit('delete_patient', patientId, {});
        } catch (error) {
            showAlert('table_error', 'alert-danger', `Error deleting patient: ${error.message}`);
            logAudit('error_delete_patient', patientId, { error: error.message });
        }
    };

    if (editPatientForm) {
        editPatientForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            clearErrors();
            hideAlert('edit-form-alert');

            const formData = new FormData(editPatientForm);
            const patientData = {
                patient_id: formData.get('patient_id'),
                name: normalizeInput(formData.get('name')),
                age: parseInt(formData.get('age')) || 0,
                gender: normalizeInput(formData.get('gender')) || null,
                department: normalizeInput(formData.get('department')) || null,
                contact_info: {
                    phone: normalizeInput(formData.get('phone')) || '',
                    email: normalizeInput(formData.get('email')) || '',
                    address: normalizeInput(formData.get('address')) || ''
                },
                allergies: normalizeInput(formData.get('allergies')).split('\n').filter(a => a.trim()),
                emergency_contact_number: normalizeInput(formData.get('emergency_contact')),
                prescriptions: normalizeInput(formData.get('prescriptions')).split('\n').filter(p => p.trim()),
                doctor_notes: normalizeInput(formData.get('doctor_notes')).split('\n').filter(n => n.trim()),
                blood_group: normalizeInput(formData.get('blood_group')) || null,
                user_id: document.getElementById('user_id')?.value || 'anonymous'
            };

            // Client-side validations
            if (!patientData.name) return showError('edit_name_error', 'Name is required');
            if (patientData.name.length > 100) return showError('edit_name_error', 'Name must be 1-100 characters');
            if (patientData.age < 0 || patientData.age > 150) return showError('edit_age_error', 'Valid age (0-150) is required');
            if (patientData.gender && patientData.gender.length > 20) return showError('edit_gender_error', 'Gender must be 20 characters or less');
            if (patientData.department && (patientData.department.length < 1 || patientData.department.length > 100)) return showError('edit_department_error', 'Department must be 1-100 characters');
            if (!isValidPhone(patientData.contact_info.phone)) return showError('edit_phone_error', 'Valid phone number (10-15 digits) is required');
            if (!isValidEmail(patientData.contact_info.email)) return showError('edit_email_error', 'Valid email is required');
            if (!patientData.contact_info.address) return showError('edit_address_error', 'Address is required');
            if (!isValidPhone(patientData.emergency_contact_number)) return showError('edit_emergency_contact_error', 'Valid emergency contact number (10-15 digits) is required');
            if (patientData.blood_group && patientData.blood_group.length > 10) return showError('edit_blood_group_error', 'Invalid blood group selection');
            if (patientData.allergies.length > 20) return showError('edit_allergies_error', 'Maximum of 20 allergies allowed');
            if (patientData.allergies.some(a => a.length < 1 || a.length > 100)) return showError('edit_allergies_error', 'Each allergy must be 1-100 characters');
            if (patientData.prescriptions.length > 20) return showError('edit_prescriptions_error', 'Maximum of 20 prescriptions allowed');
            if (patientData.prescriptions.some(p => p.length < 1 || p.length > 100)) return showError('edit_prescriptions_error', 'Each prescription must be 1-100 characters');
            if (patientData.doctor_notes.length > 20) return showError('edit_doctor_notes_error', 'Maximum of 20 notes allowed');
            if (patientData.doctor_notes.some(n => n.length < 1 || n.length > 500)) return showError('edit_doctor_notes_error', 'Each note must be 1-500 characters');

            try {
                // Updated to use API_BASE which is now '/api'
                await fetchData(`${API_BASE}/patients/${patientData.patient_id}`, {
                    method: 'PUT',
                    body: JSON.stringify(patientData)
                });
                showAlert('edit-form-alert', 'alert-success', 'Patient updated successfully');
                editPatientModal.classList.add('hidden');
                fetchPatients();
                logAudit('update_patient', patientData.patient_id, { name: patientData.name });
            } catch (error) {
                let errorMessage = error.message || 'Failed to update patient';
                if (error.status === 400) errorMessage = 'Invalid input data. Please check all fields.';
                if (error.status === 409) errorMessage = 'Phone, email, or emergency contact number already exists.';
                showAlert('edit-form-alert', 'alert-danger', errorMessage);
                logAudit('error_update_patient', patientData.patient_id, { error: errorMessage });
            }
        });
    }

    if (closeEditModal) {
        closeEditModal.addEventListener('click', () => editPatientModal.classList.add('hidden'));
    }

    if (editPatientModal) {
        window.addEventListener('click', (e) => {
            if (e.target === editPatientModal && !e.target.closest('.modal-content')) {
                editPatientModal.classList.add('hidden');
            }
        });
    }

    function clearErrors() {
        const errorIds = [
            'edit_name_error', 'edit_age_error', 'edit_gender_error', 'edit_department_error', 'edit_phone_error',
            'edit_email_error', 'edit_address_error', 'edit_emergency_contact_error', 'edit_blood_group_error',
            'edit_allergies_error', 'edit_prescriptions_error', 'edit_doctor_notes_error', 'edit_form_error'
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
            // Updated to use API_BASE which is now '/api'
            await fetch(`${API_BASE}/audit`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action, patient_id: patientId, user_id: userId, details })
            });
        } catch (error) {
            console.error('Audit log failed:', error);
        }
    }

    fetchPatients();
});