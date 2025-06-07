# Patient Management System

## Overview
The Patient Management System is a web application built with Flask, MongoDB, and JavaScript to streamline healthcare data management. It allows healthcare providers to manage patient records, generate AI-powered medicine suggestions using the Cohere API, and visualize patient data through interactive charts. The system emphasizes data integrity, auditability, and a user-friendly interface.

### Key Features
- **Patient Management**: Create, read, update, and delete (CRUD) patient records with details like name, age, contact info, allergies, prescriptions, and doctor notes.
- **Medicine Suggestions**: AI-driven recommendations via Cohere API, ensuring safety by avoiding allergens.
- **Insights Dashboard**: Interactive Chart.js visualizations for gender, age, blood group distributions, visit frequency, and average age per department.
- **Audit Logging**: Tracks all user actions for accountability and compliance.
- **Responsive UI**: Built with vanilla JavaScript, featuring pagination, search, and modal-based interactions.
- **Data Validation**: Enforced by Pydantic on the backend and client-side checks.

## Tech Stack
- **Backend**: Flask, MongoDB, Pydantic, Cohere API
- **Frontend**: Vanilla JavaScript, Chart.js, Tailwind CSS (assumed for styling)
- **Other**: Python (dotenv, pymongo), JSON logging

## Prerequisites
- Python 3.8+
- MongoDB (local or cloud instance, e.g., MongoDB Atlas)
- Node.js (for frontend dependencies, if any)
- Cohere API key
- Git

## Setup Instructions

### 1. Clone the Repository
```bash
git clone https://github.com/your-username/patient-management-system.git
cd patient-management-system
```

### 2. Set Up Environment Variables
Create a `.env` file in the root directory with the following:
```env
MONGO_URI=mongodb://localhost:27017/your_database
DB_NAME=patient_management
COHERE_API_KEY=your_cohere_api_key
PORT=5000
```
- Replace `MONGO_URI` with your MongoDB connection string.
- Replace `DB_NAME` with your database name.
- Obtain `COHERE_API_KEY` from [Cohere](https://cohere.ai/).

### 3. Install Backend Dependencies
```bash
pip install -r requirements.txt
```
Ensure the following packages are included in `requirements.txt`:
```
flask==2.3.3
pymongo==4.8.0
python-dotenv==1.0.1
flask-cors==4.0.1
pydantic==2.8.2
cohere==5.9.2
python-dateutil==2.9.0
```

### 4. Set Up Frontend
- Copy static files (HTML, CSS, JS) to the `static` and `templates` folders as per the codebase.
- Ensure `Chart.js` is accessible via CDN (included in `charts.js`).
- No additional frontend build steps are required since the app uses vanilla JavaScript.

### 5. Initialize MongoDB
- Ensure MongoDB is running locally or connect to a cloud instance.
- The application automatically creates `patients`, `counters`, and `audit_logs` collections with schema validation and indexes on startup.

### 6. Run the Application
```bash
python app.py
```
- The app runs on `http://localhost:5000` (or the port specified in `.env`).
- Access the UI in a browser or test API endpoints using tools like Postman.

## Project Structure
```
patient-management-system/
├── app.py              # Flask backend with API endpoints
├── static/             # Static assets (CSS, JS)
│   ├── common.js       # Shared utility functions
│   ├── index.js        # Homepage logic
│   ├── patients.js     # Patient listing and search
│   ├── add_patient.js  # Add patient form handling
│   ├── settings.js     # Edit/delete patient functionality
│   ├── charts.js       # Chart.js visualization logic
│   ├── insights.js     # Insights page initialization
├── templates/          # HTML templates (index.html, patients.html, etc.)
├── .env               # Environment variables (not tracked)
├── requirements.txt    # Python dependencies
└── README.md          # This file
```

## Usage
1. **Homepage**: View a patient carousel, recent doctor notes, and search for medicine suggestions.
2. **Patients Page**: List patients with pagination, search by name/department, and view details in a modal.
3. **Add Patient**: Submit a form to add a new patient with validated inputs.
4. **Settings Page**: Edit or delete existing patient records.
5. **Insights Page**: Visualize patient data through charts (e.g., gender distribution, top allergies).
6. **API Endpoints**:
   - `GET /patients`: List patients with pagination and filters.
   - `POST /patients`: Add a new patient.
   - `GET /patients/<id>`: Retrieve patient details.
   - `PUT /patients/<id>`: Update patient data.
   - `DELETE /patients/<id>`: Delete a patient.
   - `GET /patients/<id>/suggest_medicines`: Get AI-generated medicine suggestions.
   - `GET /insights`: Fetch data for charts.
   - `POST /audit`: Log user actions.

## Example API Request
**Add a Patient**:
```bash
curl -X POST http://localhost:5000/patients \
-H "Content-Type: application/json" \
-d '{
    "name": "John Doe",
    "age": 30,
    "gender": "Male",
    "contact_info": {
        "phone": "1234567890",
        "email": "john@example.com",
        "address": "123 Main St"
    },
    "emergency_contact_number": "0987654321",
    "allergies": ["Penicillin"],
    "blood_group": "O+",
    "department": "Cardiology",
    "prescriptions": [],
    "doctor_notes": [],
    "user_id": "anonymous"
}'
```

## Contributing
1. Fork the repository.
2. Create a feature branch (`git checkout -b feature/your-feature`).
3. Commit changes (`git commit -m "Add your feature"`).
4. Push to the branch (`git push origin feature/your-feature`).
5. Open a pull request with a detailed description.


## Future Improvements
- Add user authentication (e.g., JWT or OAuth).
- Implement real-time updates with WebSockets.
- Enhance Cohere API prompts for more accurate medicine suggestions.
- Add data export functionality for reports.
- Improve accessibility in the frontend.

## License
This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

## Contact
For questions or support, open an issue on GitHub or contact [kushagra.singh0602@gmail.com].

---
**Built with ❤️ by [Kushagra Singh]**
