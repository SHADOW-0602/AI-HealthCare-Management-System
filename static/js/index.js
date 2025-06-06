document.addEventListener('DOMContentLoaded', () => {
    const patientOverviewSection = document.getElementById('patient-overview');
    if (!patientOverviewSection) {
        console.error('Patient overview section not found');
        showAlert('home-error', 'alert-danger', 'Failed to load dashboard. Please try refreshing the page.');
        return;
    }

    // Setup View All Notes button and modal
    const viewAllNotesBtn = document.getElementById('view-all-notes');
    const modal = document.getElementById('all-notes-modal');
    const closeModalBtn = modal?.querySelector('.close-modal');

    if (viewAllNotesBtn && modal) {
        viewAllNotesBtn.addEventListener('click', () => {
            modal.style.display = 'block';
            modal.classList.remove('hidden');
            document.body.classList.add('modal-open');
            logAudit('view_all_notes', null, { action: 'open_modal' });
        });
    } else {
        console.warn('View All Notes button or modal not found');
        showAlert('home-error', 'alert-danger', 'Unable to open notes modal. Please try refreshing the page.');
    }

    if (closeModalBtn) {
        closeModalBtn.addEventListener('click', () => closeModal('all-notes-modal'));
    }

    if (modal) {
        window.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeModal('all-notes-modal');
            }
        });
    }

    let patients = [];
    let currentPatientIndex = 0;
    let carouselItems = [];

    async function fetchPatientsForOverview() {
        try {
            const data = await fetchData(`/patients?page=1`);
            patients = data.patients || [];
            const carouselContainer = document.getElementById('patient-carousel');

            if (!carouselContainer) {
                throw new Error('Patient carousel element not found');
            }

            carouselContainer.innerHTML = '';
            carouselItems = [];

            if (patients.length > 0) {
                patients.forEach((patient) => {
                    const carouselItem = document.createElement('div');
                    carouselItem.classList.add('carousel-item');
                    carouselItem.innerHTML = `
                        <h3>${patient.name}</h3>
                        <p><strong>Age:</strong> ${patient.age}</p>
                        <p><strong>Gender:</strong> ${patient.gender || 'N/A'}</p>
                        <p><strong>Department:</strong> ${patient.department || 'N/A'}</p>
                        <p><strong>Contact:</strong> ${patient.contact_info.phone}</p>
                    `;
                    carouselContainer.appendChild(carouselItem);
                    carouselItems.push(carouselItem);
                });

                showCarouselItem(currentPatientIndex);

                if (patients.length > 1) {
                    setInterval(() => {
                        const nextPatientIndex = (currentPatientIndex + 1) % patients.length;
                        if (carouselItems[currentPatientIndex]) {
                            carouselItems[currentPatientIndex].classList.remove('active');
                            carouselItems[currentPatientIndex].classList.add('previous');
                        }
                        currentPatientIndex = nextPatientIndex;
                        showCarouselItem(currentPatientIndex);
                        setTimeout(() => {
                            carouselItems.forEach((item, i) => {
                                if (i !== currentPatientIndex) {
                                    item.classList.remove('active', 'previous');
                                    item.style.transform = 'translateX(100%)';
                                    item.style.opacity = '0';
                                    item.style.display = 'none';
                                } else {
                                    item.style.display = 'flex';
                                    item.style.transform = 'translateX(0)';
                                    item.style.opacity = '1';
                                }
                            });
                        }, 800);
                    }, 5000);
                }
            } else {
                carouselContainer.innerHTML = `
                    <div class="carousel-item active">
                        <h3>No Patients Available</h3>
                        <p>Add new patients via the "Add New Patient" link.</p>
                    </div>
                `;
            }

            // Update Quick Stat
            const totalPatients = data.total || 0;
            const newPatients = data.patients.filter(p => {
                const created = new Date(p.created_at);
                const now = new Date();
                return created.getMonth() === now.getMonth() && created.getFullYear() === now.getFullYear();
            }).length;
            document.getElementById('total-patients').textContent = totalPatients;
            document.getElementById('new-patients').textContent = newPatients;
        } catch (error) {
            showAlert('home-error', 'alert-danger', `Error loading patient overview: ${error.message}`);
            logAudit('error_fetch_carousel', null, { error: error.message });
        }
    }

    function showCarouselItem(index) {
        carouselItems.forEach((item, i) => {
            if (i === index) {
                item.classList.add('active');
                item.classList.remove('previous');
                item.style.display = 'flex';
                item.style.transform = 'translateX(0)';
                item.style.opacity = '1';
            } else {
                item.classList.remove('active', 'previous');
                item.style.display = 'none';
                item.style.transform = 'translateX(100%)';
                item.style.opacity = '0';
            }
        });
    }

    async function fetchDoctorNotes() {
        try {
            const data = await fetchData(`/patients?page=1`);
            const allNotes = [];
            data.patients.forEach(patient => {
                if (Array.isArray(patient.doctor_notes) && patient.doctor_notes.length) {
                    patient.doctor_notes.forEach(note => {
                        allNotes.push({
                            patientName: patient.name,
                            note,
                            time: calculateTimeAgo(new Date(patient.updated_at || Date.now()))
                        });
                    });
                }
            });

            const notesList = document.getElementById('notes-list');
            if (notesList) {
                notesList.innerHTML = allNotes.slice(0, 3).map(note => `
                    <div class="note-item">
                        <strong>${note.patientName}:</strong> ${note.note} <small>${note.time}</small>
                    </div>
                `).join('') || '<p class="no-data-message">No recent doctor notes available.</p>';
            }

            const allNotesList = document.getElementById('all-notes-list');
            if (allNotesList) {
                allNotesList.innerHTML = allNotes.map(note => `
                    <div class="note-item">
                        <strong>${note.patientName}:</strong> ${note.note} <small>${note.time}</small>
                    </div>
                `).join('') || '<p class="no-data-message">No doctor notes available.</p>';
            }
        } catch (error) {
            showAlert('notes-list', 'alert-danger', `Error loading doctor notes: ${error.message}`);
            logAudit('error_fetch_notes', null, { error: error.message });
        }
    }

    function calculateTimeAgo(date) {
        const now = new Date();
        const diff = now - date;
        const seconds = Math.floor(diff / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);

        if (days > 1) return `${days} days ago`;
        if (days === 1) return 'Yesterday';
        if (hours >= 1) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
        if (minutes >= 1) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
        return 'Just now';
    }

    window.viewPatientHome = async patientId => {
        try {
            const patient = await fetchData(`/patients/${patientId}`);
            document.getElementById('modalContent').innerHTML = formatPatientDetails(patient);
            const modal = document.getElementById('patientModal');
            modal.classList.remove('hidden');
            document.body.classList.add('modal-open');
            logAudit('view_patient', patientId, { name: patient.name });
        } catch (error) {
            showAlert('home-error', 'alert-danger', `Error viewing patient: ${error.message}`);
        }
    };

    window.searchPatientMedicines = async () => {
        const searchInput = document.getElementById('patient-search');
        const patientInfoDiv = document.getElementById('medicine-suggestions-patient');
        const suggestionsDiv = document.getElementById('medicine-suggestions');
        const loadingDiv = document.getElementById('medicine-suggestions-loading');
        const errorDiv = document.getElementById('medicine-suggestions-error');
        const suggestionsDropdown = document.getElementById('patient-suggestions');
        const name = searchInput.value.trim();
        const patientId = searchInput.dataset.patientId; // Get stored patient_id

        patientInfoDiv.innerHTML = '';
        suggestionsDiv.innerHTML = '<p class="no-data-message">Enter a patient name to see medicine suggestions.</p>';
        suggestionsDropdown.classList.add('hidden');
        clearError('medicine-suggestions-error');

        if (!name) {
            showAlert('medicine-suggestions-error', 'alert-danger', 'Please enter a patient name.');
            loadingDiv.classList.add('hidden');
            return;
        }

        loadingDiv.classList.remove('hidden');

        try {
            let patient;
            if (patientId) {
                // Fetch patient by ID if available (from dropdown selection)
                patient = await fetchData(`/patients/${patientId}`);
            } else {
                // Fallback to name search if no patient_id (manual entry)
                const data = await fetchData(`/patients?name=${encodeURIComponent(name)}&page=1&limit=1`);
                if (data.patients.length === 0) {
                    showAlert('medicine-suggestions-error', 'alert-danger', 'No patient found with that name.');
                    suggestionsDiv.innerHTML = '<p class="no-data-message">No patient found. Try another name.</p>';
                    loadingDiv.classList.add('hidden');
                    return;
                }
                patient = data.patients[0];
            }

            // Rest of the function remains the same...
            const fetchedPatientId = patient.patient_id;

            // Fetch medicine suggestions
            const response = await fetchData(`/patients/${fetchedPatientId}/suggest_medicines`);
            setTimeout(() => {
                loadingDiv.classList.add('hidden');
                if (response.message === 'Medicine suggestions generated successfully') {
                    patientInfoDiv.innerHTML = `
                        <p><strong>Patient:</strong> ${patient.name} (ID: ${fetchedPatientId})</p>
                    `;
                    suggestionsDiv.innerHTML = response.suggestions.length ? `
                        <ul>
                            ${response.suggestions.map(s => `
                                <li>
                                    <strong>${s.medicine}</strong>: ${s.explanation}
                                </li>
                            `).join('')}
                        </ul>
                    ` : '<p class="no-data-message">No medicine suggestions available.</p>';
                    clearError('medicine-suggestions-error');
                } else {
                    patientInfoDiv.innerHTML = `
                        <p><strong>Patient:</strong> ${patient.name} (ID: ${fetchedPatientId})</p>
                    `;
                    showAlert('medicine-suggestions-error', 'alert-danger', response.message || 'Failed to fetch medicine suggestions.');
                    suggestionsDiv.innerHTML = '<p class="no-data-message">No medicine suggestions available.</p>';
                }
            }, 1000);

            logAudit('search_medicine_suggestions', fetchedPatientId, { name: patient.name, patient_id: fetchedPatientId });
        } catch (error) {
            setTimeout(() => {
                loadingDiv.classList.add('hidden');
                showAlert('medicine-suggestions-error', 'alert-danger', `Error fetching medicine suggestions: ${error.message}`);
                suggestionsDiv.innerHTML = '<p class="no-data-message">Enter a patient name to see medicine suggestions.</p>';
                logAudit('error_search_medicine_suggestions', null, { error: error.message, name });
            }, 1000);
        }
    };

    window.showPatientSuggestions = async () => {
        const searchInput = document.getElementById('patient-search');
        const suggestionsDropdown = document.getElementById('patient-suggestions');
        const name = searchInput.value.trim();

        if (!name) {
            suggestionsDropdown.classList.add('hidden');
            return;
        }

        try {
            const data = await fetchData(`/patients?name=${encodeURIComponent(name)}&page=1&limit=10`);
            suggestionsDropdown.innerHTML = '';
            if (data.patients.length === 0) {
                suggestionsDropdown.classList.add('hidden');
                return;
            }

            data.patients.forEach(patient => {
                const suggestionItem = document.createElement('div');
                suggestionItem.className = 'suggestion-item';
                suggestionItem.textContent = `${patient.name} (ID: ${patient.patient_id}, ${patient.contact_info?.phone || 'No phone'})`;
                suggestionItem.dataset.patientId = patient.patient_id;
                suggestionItem.onclick = () => {
                    searchInput.value = patient.name;
                    searchInput.dataset.patientId = patient.patient_id; // Store patient ID
                    suggestionsDropdown.classList.add('hidden');
                };
                suggestionsDropdown.appendChild(suggestionItem);
            });

            suggestionsDropdown.classList.remove('hidden');
        } catch (error) {
            suggestionsDropdown.classList.add('hidden');
            console.error('Error fetching patient suggestions:', error.message);
        }
    };
    
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

    function closeModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.add('hidden');
            document.body.classList.remove('modal-open');
        }
    }

    const patientDetailModal = document.getElementById('patientModal');
    const closePatientDetailModalButton = document.getElementById('modalCloseButton');

    if (closePatientDetailModalButton) {
        closePatientDetailModalButton.addEventListener('click', () => closeModal('patientModal'));
    }
    if (patientDetailModal) {
        patientDetailModal.addEventListener('click', (event) => {
            if (event.target === patientDetailModal) {
                closeModal('patientModal');
            }
        });
    }

    // Log navigation events
    document.querySelectorAll('.navbar-links a').forEach(link => {
        link.addEventListener('click', (e) => {
            logAudit('navigate_page', null, { page: link.getAttribute('href') });
        });
    });

    fetchPatientsForOverview();
    fetchDoctorNotes();
});