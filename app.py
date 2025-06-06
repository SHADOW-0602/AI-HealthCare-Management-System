from flask import Flask, request, jsonify, send_from_directory, render_template, abort, redirect
from pymongo import MongoClient, ASCENDING
from pymongo.errors import DuplicateKeyError, OperationFailure
from dotenv import load_dotenv
from flask_cors import CORS
from datetime import datetime, UTC
from pydantic import BaseModel, EmailStr, ValidationError, Field
from typing import Dict, Any, List, Optional
import os
import logging
import json
from dateutil import parser
import cohere
from http import HTTPStatus

# Configure structured logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)
logging.getLogger('pymongo').setLevel(logging.WARNING)

class JsonFormatter(logging.Formatter):
    def format(self, record):
        log_record = {
            "timestamp": datetime.now(UTC).isoformat(),
            "level": record.levelname,
            "message": record.getMessage(),
            "module": record.module,
            "function": record.funcName,
            "line": record.lineno
        }
        return json.dumps(log_record)

handler = logging.StreamHandler()
handler.setFormatter(JsonFormatter())
logger.handlers = [handler]

# Load environment variables
load_dotenv()

# Custom exceptions
class DatabaseError(Exception):
    def __init__(self, message: str, status_code: int = 500):
        self.message = message
        self.status_code = status_code
        super().__init__(self.message)

class ValidationErrorCustom(Exception):
    def __init__(self, message: str, status_code: int = 400):
        self.message = message
        self.status_code = status_code
        super().__init__(self.message)

# Pydantic models for validation
class ContactInfo(BaseModel):
    phone: str = Field(..., min_length=10, max_length=15)
    email: EmailStr
    address: str = Field(..., min_length=1)

class PatientCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    age: int = Field(..., ge=0, le=150)
    gender: Optional[str] = Field(default=None, max_length=20)
    contact_info: ContactInfo
    allergies: List[str] = []
    blood_group: Optional[str] = Field(default=None, max_length=10)
    emergency_contact_number: str = Field(..., min_length=10, max_length=15)
    prescriptions: List[str] = []
    doctor_notes: List[str] = []
    department: Optional[str] = Field(default=None, min_length=1, max_length=100)
    user_id: str = "anonymous"

class PatientUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=100)
    age: Optional[int] = Field(default=None, ge=0, le=150)
    gender: Optional[str] = Field(default=None, max_length=20)
    contact_info: Optional[ContactInfo] = None
    allergies: Optional[List[str]] = None
    blood_group: Optional[str] = Field(default=None, max_length=10)
    emergency_contact_number: Optional[str] = Field(default=None, min_length=10, max_length=15)
    prescriptions: Optional[List[str]] = None
    doctor_notes: Optional[List[str]] = None
    department: Optional[str] = Field(default=None, min_length=1, max_length=100)
    user_id: str = "anonymous"

class AuditLog(BaseModel):
    action: str
    patient_id: Optional[int] = None
    user_id: str
    timestamp: datetime = Field(default_factory=lambda: datetime.now(UTC))
    details: Dict[str, Any] = {}

# Initialize Flask app
app = Flask(__name__,
            template_folder='templates',
            static_folder='static')
CORS(app)

# Custom rule for serving JavaScript files from the 'js' directory
app.add_url_rule(
    '/js/<path:filename>',
    endpoint='js_static',
    view_func=lambda filename: send_from_directory('js', filename)
)

# Initialize database and collections
def initialize_database():
    try:
        # Create database if it doesn't exist
        db = client[os.getenv("DB_NAME")]
        
        # Create collections if they don't exist
        if "patients" not in db.list_collection_names():
            db.create_collection("patients")
            logger.info({"message": "Created patients collection"})
        
        if "counters" not in db.list_collection_names():
            db.create_collection("counters")
            logger.info({"message": "Created counters collection"})
        
        if "audit_logs" not in db.list_collection_names():
            db.create_collection("audit_logs")
            logger.info({"message": "Created audit_logs collection"})
            
    except Exception as e:
        logger.error({"message": f"Failed to initialize database: {str(e)}"})
        raise DatabaseError(f"Database initialization failed: {str(e)}")

# MongoDB connection and initialization
try:
    client = MongoClient(os.getenv("MONGO_URI"), serverSelectionTimeoutMS=5000)
    client.server_info()  # This will test the connection
    
    # Initialize database structure
    db = client[os.getenv("DB_NAME")]
    
    # Create collections if they don't exist
    if "patients" not in db.list_collection_names():
        db.create_collection("patients")
        logger.info({"message": "Created patients collection"})
    
    if "counters" not in db.list_collection_names():
        db.create_collection("counters")
        logger.info({"message": "Created counters collection"})
    
    if "audit_logs" not in db.list_collection_names():
        db.create_collection("audit_logs")
        logger.info({"message": "Created audit_logs collection"})
    
    # Set references to collections
    patients_collection = db["patients"]
    counters_collection = db["counters"]
    audit_logs_collection = db["audit_logs"]
    
    logger.info({"message": "Connected to MongoDB successfully"})
except Exception as e:
    logger.error({"message": f"Failed to connect to MongoDB: {str(e)}"})
    raise DatabaseError(f"MongoDB connection failed: {str(e)}")

# Initialize Cohere client
try:
    co = cohere.Client(os.getenv("COHERE_API_KEY"))
    logger.info({"message": "Connected to Cohere API successfully"})
except Exception as e:
    logger.error({"message": f"Failed to connect to Cohere API: {str(e)}"})
    raise Exception(f"Cohere API connection failed: {str(e)}")

# Initialize counters
def initialize_counters():
    if counters_collection.count_documents({"_id": "patient_id"}) == 0:
        counters_collection.insert_one({"_id": "patient_id", "sequence": 0})
        logger.info({"message": "Initialized patient_id counter"})

# Setup database indexes
def setup_indexes():
    try:
        # Check existing indexes for patients_collection
        patient_indexes = patients_collection.index_information()

        # Create regular indexes
        if not any(idx['key'] == [('patient_id', 1)] for idx in patient_indexes.values()):
            patients_collection.create_index([("patient_id", ASCENDING)], unique=True)

        if not any(idx['key'] == [('contact_info.email', 1)] for idx in patient_indexes.values()):
            patients_collection.create_index([("contact_info.email", ASCENDING)], unique=True, sparse=True)

        if not any(idx['key'] == [('contact_info.phone', 1)] for idx in patient_indexes.values()):
            patients_collection.create_index([("contact_info.phone", ASCENDING)], unique=True, sparse=True)

        if not any(idx['key'] == [('emergency_contact_number', 1)] for idx in patient_indexes.values()):
            patients_collection.create_index([("emergency_contact_number", ASCENDING)], unique=True, sparse=True)

        # Create text index for name
        text_index_name = "patient_text_search"
        desired_weights = {"name": 1}

        if text_index_name in patient_indexes:
            existing_weights = patient_indexes[text_index_name].get("weights", {})
            if existing_weights != desired_weights:
                try:
                    logger.info(f"Dropping existing text index '{text_index_name}' with weights: {existing_weights}")
                    patients_collection.drop_index(text_index_name)
                    logger.info(f"Successfully dropped index '{text_index_name}'")
                except OperationFailure as e:
                    logger.error(f"Failed to drop text index: {str(e)}")
                    raise DatabaseError(f"Failed to drop text index: {str(e)}")

        if text_index_name not in patient_indexes:
            try:
                logger.info(f"Creating text index '{text_index_name}' with weights: {desired_weights}")
                patients_collection.create_index(
                    [("name", "text")],
                    name=text_index_name,
                    weights=desired_weights
                )
                logger.info(f"Successfully created text index '{text_index_name}'")
            except OperationFailure as e:
                logger.error(f"Failed to create text index: {str(e)}")
                raise DatabaseError(f"Failed to create text index: {str(e)}")

        # Handle audit logs index
        audit_indexes = audit_logs_collection.index_information()
        if not any(idx['key'] == [('timestamp', 1)] for idx in audit_indexes.values()):
            audit_logs_collection.create_index([("timestamp", ASCENDING)], name="timestamp_idx")

        logger.info("Database indexes created or verified successfully")

    except OperationFailure as e:
        logger.error(f"Failed to create indexes: {str(e)}")
        raise DatabaseError(f"Failed to create indexes: {str(e)}")

# Add schema validation for patients collection
try:
    db.command({
        "collMod": "patients",
        "validator": {
            "$jsonSchema": {
                "bsonType": "object",
                "required": ["patient_id", "name", "age", "contact_info", "emergency_contact_number", "created_at", "updated_at"],
                "properties": {
                    "patient_id": {
                        "bsonType": "int"
                    },
                    "name": {
                        "bsonType": "string",
                        "minLength": 1,
                        "maxLength": 100
                    },
                    "age": {
                        "bsonType": "int",
                        "minimum": 0,
                        "maximum": 150
                    },
                    "gender": {
                        "bsonType": ["string", "null"],
                        "maxLength": 20
                    },
                    "contact_info": {
                        "bsonType": "object",
                        "required": ["phone", "email", "address"],
                        "properties": {
                            "phone": {
                                "bsonType": "string",
                                "minLength": 10,
                                "maxLength": 15
                            },
                            "email": {
                                "bsonType": "string"
                            },
                            "address": {
                                "bsonType": "string",
                                "minLength": 1
                            }
                        }
                    },
                    "allergies": {
                        "bsonType": "array",
                        "items": {
                            "bsonType": "string"
                        }
                    },
                    "blood_group": {
                        "bsonType": ["string", "null"],
                        "maxLength": 10
                    },
                    "emergency_contact_number": {
                        "bsonType": "string",
                        "minLength": 10,
                        "maxLength": 15
                    },
                    "prescriptions": {
                        "bsonType": "array",
                        "items": {
                            "bsonType": "string",
                            "minLength": 1,
                            "maxLength": 100
                        }
                    },
                    "doctor_notes": {
                        "bsonType": "array",
                        "items": {
                            "bsonType": "string"
                        }
                    },
                    "department": {
                        "bsonType": ["string", "null"],
                        "minLength": 1,
                        "maxLength": 100
                    },
                    "user_id": {
                        "bsonType": "string"
                    },
                    "created_at": {
                        "bsonType": "string"
                    },
                    "updated_at": {
                        "bsonType": "string"
                    }
                }
            }
        }
    })
    logger.info({"message": "Schema validation added to patients collection"})
except OperationFailure as e:
    logger.error({"message": f"Failed to add schema validation: {str(e)}"})
    raise DatabaseError(f"Failed to add schema validation: {str(e)}")

# Get next sequence value
def get_next_sequence(name):
    try:
        counter = counters_collection.find_one_and_update(
            {"_id": name},
            {"$inc": {"sequence": 1}},
            return_document=True
        )
        if not counter:
            raise DatabaseError("Counter not found")
        return counter["sequence"]
    except Exception as e:
        logger.error({"message": f"Error getting sequence for {name}: {str(e)}"})
        raise DatabaseError(f"Error getting sequence: {str(e)}")

# Log audit actions
def log_audit_action(action: str, patient_id: Optional[int], user_id: str, details: Dict[str, Any]):
    try:
        audit_log = AuditLog(
            action=action,
            patient_id=patient_id,
            user_id=user_id,
            details=details
        ).model_dump()
        audit_logs_collection.insert_one(audit_log)
        logger.info({"message": f"Audit log created: {action}", "patient_id": patient_id, "user_id": user_id})
    except Exception as e:
        logger.error({"message": f"Failed to log audit action: {str(e)}"})

# Initialize database
initialize_counters()
setup_indexes()

# Routes for serving HTML pages
@app.route('/')
def serve_index():
    return render_template('index.html')

@app.route('/index.html')
def serve_index_html():
    return redirect('/', code=301)

@app.route('/patients.html')
def serve_patients():
    return render_template('patients.html')

@app.route('/insights.html')
def serve_insights():
    return render_template('insights.html')

@app.route('/add_patient.html')
def serve_add_patient():
    return render_template('add_patient.html')

@app.route('/settings.html')
def serve_settings():
    return render_template('settings.html')

@app.route('/patients', methods=['GET'])
def get_patients():
    try:
        user_id = request.args.get('user_id', 'anonymous')
        page = max(1, int(request.args.get('page', 1)))
        limit = max(1, min(int(request.args.get('limit', 10)), 100))
        name = request.args.get('name', '').strip()
        sort = request.args.get('sort', 'name').strip()
        department = request.args.get('department', '').strip()

        skip = (page - 1) * limit
        query = {}

        if name:
            query["$or"] = [
                {"name": {"$regex": name, "$options": "i"}},
                {"contact_info.email": {"$regex": name, "$options": "i"}},
                {"contact_info.phone": {"$regex": name, "$options": "i"}},
                {"emergency_contact_number": {"$regex": name, "$options": "i"}}
            ]

        if department:
            query["department"] = {"$regex": f"^{department}$", "$options": "i"}    

        sort_field = "name" if sort == "name" else "patient_id"
        sort_order = ASCENDING

        try:
            patients = list(patients_collection.find(
                query,
                {"_id": 0}
            ).sort(sort_field, sort_order).skip(skip).limit(limit))
        except OperationFailure as e:
            logger.error({"message": f"MongoDB query failed: {str(e)}"})
            return jsonify({"message": f"Database query failed: {str(e)}"}), 500

        total = patients_collection.count_documents(query)
        total_pages = (total + limit - 1) // limit

        log_audit_action("get_patients", None, user_id, {
            "page": page,
            "limit": limit,
            "name_filter": name,
            "sort": sort,
            "total": total
        })

        return jsonify({
            "patients": patients,
            "total": total,
            "pages": total_pages,
            "current_page": page
        }), 200

    except ValueError as e:
        return jsonify({"message": str(e)}), 400
    except Exception as e:
        logger.error({"message": f"Error fetching patients: {str(e)}"})
        return jsonify({"message": "Internal server error"}), 500

@app.route('/patients', methods=['POST'])
def add_patient():
    try:
        data = request.get_json()
        if not data:
            raise ValidationErrorCustom("No data provided")

        patient_data = PatientCreate(**data).model_dump(exclude_none=True)
        
        if len(patient_data.get("prescriptions", [])) > 20:
            raise ValidationErrorCustom("Maximum of 20 prescriptions", 400)

        patient_id = get_next_sequence("patient_id")
        patient_data["patient_id"] = patient_id
        patient_data["created_at"] = datetime.now(UTC).isoformat()
        patient_data["updated_at"] = patient_data["created_at"]

        result = patients_collection.insert_one(patient_data)
        if not result.inserted_id:
            raise DatabaseError("Failed to insert patient")

        log_audit_action("add_patient", patient_id, patient_data["user_id"], {
            "name": patient_data["name"],
            "patient_id": patient_id,
            "department": patient_data.get("department")
        })

        return jsonify({
            "message": "Patient added successfully",
            "patient_id": patient_id
        }), 201

    except ValidationError as e:
        return jsonify({"message": e.errors()}), 400
    except ValidationErrorCustom as e:
        return jsonify({"message": str(e)}), e.status_code
    except DuplicateKeyError as e:
        return jsonify({"message": "Phone or emergency contact number already exists"}), 409
    except DatabaseError as e:
        return jsonify({"message": str(e)}), e.status_code
    except Exception as e:
        logger.error({"message": f"Error adding patient: {str(e)}"})
        return jsonify({"message": "Internal server error"}), 500

@app.route('/patients/<int:patient_id>', methods=['GET'])
def get_patient(patient_id):
    try:
        user_id = request.args.get('user_id', 'anonymous')
        patient = patients_collection.find_one(
            {"patient_id": patient_id},
            {"_id": 0}
        )
        if not patient:
            raise ValidationErrorCustom("Patient not found", 404)

        log_audit_action("get_patient", patient_id, user_id, {
            "name": patient["name"],
            "department": patient.get("department")
        })

        return jsonify(patient), 200

    except ValidationErrorCustom as e:
        return jsonify({"message": str(e)}), e.status_code
    except Exception as e:
        logger.error({"message": f"Error fetching patient {patient_id}: {str(e)}"})
        return jsonify({"message": "Internal server error"}), 500

@app.route('/patients/<int:patient_id>', methods=['PUT'])
def update_patient(patient_id):
    try:
        user_id = request.args.get('user_id', 'anonymous')
        data = request.get_json()
        if not data:
            raise ValidationErrorCustom("No data provided")

        patient = patients_collection.find_one({"patient_id": patient_id})
        if not patient:
            raise ValidationErrorCustom("Patient not found", 404)

        update_data = PatientUpdate(**data).model_dump(exclude_none=True, exclude_unset=True)
        update_ops = {"$set": {}}
        for field, value in update_data.items():
            if field != "user_id":
                update_ops["$set"][field] = value

        if "prescriptions" in update_data and len(update_data["prescriptions"]) > 20:
            raise ValidationErrorCustom("Maximum of 20 prescriptions", 400)

        if not update_ops["$set"]:
            return jsonify({"message": "No updates provided"}), 200

        update_ops["$set"]["updated_at"] = datetime.now(UTC).isoformat()
        result = patients_collection.update_one(
            {"patient_id": patient_id},
            update_ops
        )
        if result.modified_count == 0:
            raise DatabaseError("Failed to update patient")

        log_audit_action("update_patient", patient_id, user_id, {
            "name": update_data.get("name", patient["name"]),
            "updated_fields": list(update_ops["$set"].keys()),
            "department": update_data.get("department", patient.get("department"))
        })

        return jsonify({"message": "Patient updated successfully"}), 200
    except ValidationError as e:
        return jsonify({"message": str(e)}), 400
    except ValidationErrorCustom as e:
        return jsonify({"message": str(e)}), e.status_code
    except DatabaseError as e:
        return jsonify({"message": str(e)}), e.status_code
    except Exception as e:
        logger.error(f"Error updating patient: {str(e)}")
        return jsonify({"message": "Internal server error"}), 500

@app.route('/patients/<int:patient_id>', methods=['DELETE'])
def delete_patient(patient_id):
    try:
        user_id = request.args.get('user_id', 'anonymous')
        patient = patients_collection.find_one({"patient_id": patient_id})
        if not patient:
            raise ValidationErrorCustom("Patient not found", 404)

        result = patients_collection.delete_one({"patient_id": patient_id})
        if result.deleted_count == 0:
            raise DatabaseError("Failed to delete patient")

        log_audit_action("delete_patient", patient_id, user_id, {
            "name": patient["name"],
            "department": patient.get("department")
        })

        return jsonify({"message": "Patient deleted successfully"}), 200

    except ValidationErrorCustom as e:
        return jsonify({"message": str(e)}), e.status_code
    except DatabaseError as e:
        return jsonify({"message": str(e)}), e.status_code
    except Exception as e:
        logger.error({"message": f"Error deleting patient {patient_id}: {str(e)}"})
        return jsonify({"message": "Internal server error"}), 500

@app.route('/audit', methods=['POST'])
def log_audit():
    try:
        data = request.get_json()
        if not data:
            raise ValidationErrorCustom("No data provided")

        audit_log = AuditLog(**data).model_dump()
        audit_logs_collection.insert_one(audit_log)
        return jsonify({"message": "Audit log recorded"}), 201

    except ValidationError as e:
        return jsonify({"message": e.errors()}), 400
    except ValidationErrorCustom as e:
        return jsonify({"message": str(e)}), e.status_code
    except Exception as e:
        logger.error({"message": f"Error logging audit: {str(e)}"})
        return jsonify({"message": "Internal server error"}), 500

@app.route('/insights', methods=['GET'])
def get_insights():
    try:
        user_id = request.args.get('user_id', 'anonymous')
        patients = list(patients_collection.find({}, {"_id": 0}))

        # Gender Distribution
        gender_dist = {"Male": 0, "Female": 0, "Other": 0, "Unknown": 0}
        for p in patients:
            gender = str(p.get("gender", "")).capitalize()
            if gender in gender_dist:
                gender_dist[gender] += 1
            else:
                gender_dist["Unknown"] += 1

        # Top Allergies
        allergies_count = {}
        for p in patients:
            allergies = p.get("allergies") or []
            if not isinstance(allergies, list):
                logger.warning(f"Invalid allergies format for patient {p.get('patient_id')}: {allergies}")
                continue
            for allergy in allergies:
                if isinstance(allergy, str) and allergy.strip():
                    allergies_count[allergy] = allergies_count.get(allergy, 0) + 1
        top_allergies = sorted(
            [{"name": k, "count": v} for k, v in allergies_count.items()],
            key=lambda x: x["count"],
            reverse=True
        )[:5]

        # Age Distribution
        age_dist = {
            "0-30": 0,
            "31-60": 0,
            "61-90": 0,
            "91-150": 0
        }
        for p in patients:
            age = p.get("age")
            if not isinstance(age, int):
                logger.warning(f"Invalid age format for patient {p.get('patient_id')}: {age}")
                continue
            if 0 <= age <= 30:
                age_dist["0-30"] += 1
            elif 31 <= age <= 60:
                age_dist["31-60"] += 1
            elif 61 <= age <= 90:
                age_dist["61-90"] += 1
            elif 91 <= age <= 150:
                age_dist["91-150"] += 1
        age_distribution = [
            {"range": k, "count": v} for k, v in age_dist.items()
        ]

        # Blood Group Distribution
        blood_group_dist = {}
        for p in patients:
            bg = str(p.get("blood_group", "Unknown"))
            blood_group_dist[bg] = blood_group_dist.get(bg, 0) + 1
        blood_groups = sorted(
            [{"name": k, "count": v} for k, v in blood_group_dist.items()],
            key=lambda x: x["count"],
            reverse=True
        )

        # Frequency of Visits per Month
        visit_frequency = {}
        for p in patients:
            updated_at = p.get("updated_at")
            if not updated_at:
                logger.warning(f"Missing updated_at for patient {p.get('patient_id')}")
                continue
            try:
                update_time = parser.parse(updated_at)
                year_month = update_time.strftime("%Y-%m")
                visit_frequency[year_month] = visit_frequency.get(year_month, 0) + 1
            except (ValueError, TypeError) as e:
                logger.warning(f"Invalid updated_at format for patient {p.get('patient_id')}: {updated_at}")
                continue
        visit_frequency_per_month = sorted(
            [{"month": k, "count": v} for k, v in visit_frequency.items()],
            key=lambda x: x["month"]
        )

        # Average Patient Age per Department
        dept_age_sums = {}
        dept_counts = {}
        for p in patients:
            dept = str(p.get("department", "Unknown"))
            age = p.get("age")
            if not isinstance(age, int):
                logger.warning(f"Invalid age format for patient {p.get('patient_id')}: {age}")
                continue
            dept_age_sums[dept] = dept_age_sums.get(dept, 0) + age
            dept_counts[dept] = dept_counts.get(dept, 0) + 1
        avg_age_per_department = [
            {
                "department": dept,
                "average_age": round(dept_age_sums[dept] / dept_counts[dept], 1) if dept_counts[dept] > 0 else 0
            }
            for dept in sorted(dept_age_sums.keys())
        ]

        log_audit_action("get_insights", None, user_id, {
            "total_patients": len(patients)
        })

        return jsonify({
            "gender_distribution": gender_dist,
            "top_allergies": top_allergies,
            "age_distribution": age_distribution,
            "blood_group_distribution": blood_groups,
            "visit_frequency_per_month": visit_frequency_per_month,
            "avg_age_per_department": avg_age_per_department
        }), 200

    except Exception as e:
        logger.error({"message": f"Error getting insights: {str(e)}", "stack": str(e.__traceback__)})
        return jsonify({"message": f"Internal server error: {str(e)}"}), 500
    
# Catch-all route for client-side routing
@app.route('/<path:path>')
def catch_all(path):
    if path in ['patients', 'insights', 'add_patient', 'settings']:
        return render_template(f'{path}.html')
    if path == 'index.html':
        return redirect('/', code=301)
    abort(404)

@app.after_request
def after_request(response):
    """Ensure all API responses are JSON"""
    if request.path.startswith('/api/'):
        if response.content_type != 'application/json':
            try:
                data = response.get_data(as_text=True)
                return jsonify({'error': 'Unexpected response', 'content': data}), 500
            except:
                return jsonify({'error': 'Unexpected non-JSON response'}), 500
    return response    

@app.route('/patients/<int:patient_id>/suggest_medicines', methods=['GET'])
def suggest_medicines(patient_id):
    try:
        user_id = request.args.get('user_id', 'anonymous')
        # Retrieve patient data
        patient = patients_collection.find_one(
            {"patient_id": patient_id},
            {"_id": 0, "name": 1, "allergies": 1, "prescriptions": 1, "doctor_notes": 1, "department": 1}
        )
        if not patient:
            raise ValidationErrorCustom("Patient not found", 404)

        # Prepare prompt for Cohere API
        allergies = patient.get("allergies", []) or []
        prescriptions = patient.get("prescriptions", []) or []
        doctor_notes = patient.get("doctor_notes", []) or []
        department = patient.get("department", "Unknown")

        # Ensure inputs are strings and not empty
        allergies_str = ", ".join([str(a) for a in allergies if a]) if allergies else "None"
        prescriptions_str = ", ".join([str(p) for p in prescriptions if p]) if prescriptions else "None"
        doctor_notes_str = ", ".join([str(n) for n in doctor_notes if n]) if doctor_notes else "None"

        prompt = (
            f"Patient Profile:\n"
            f"- Department: {department}\n"
            f"- Allergies: {allergies_str}\n"
            f"- Current Prescriptions: {prescriptions_str}\n"
            f"- Doctor Notes: {doctor_notes_str}\n\n"
            f"Task: Suggest up to 3 safe and appropriate medicines for the patient based on their department, current prescriptions, and doctor notes. "
            f"Ensure the suggested medicines do not trigger the patient's allergies. "
            f"Provide a brief explanation for each suggestion. "
            f"Return the response in the following JSON format:\n"
            f'{{"suggestions": [{{"medicine": "name", "explanation": "reason"}}]}}'
        )

        # Call Cohere API to generate suggestions
        try:
            response = co.generate(
                model='command-r-plus-08-2024',
                prompt=prompt,
                max_tokens=500,
                temperature=0.7,
                k=0,
                p=0.75,
                stop_sequences=["```"]
            )
            generated_text = response.generations[0].text.strip()
        except Exception as e:
            logger.error({"message": f"Cohere API error: {str(e)}", "patient_id": patient_id})
            return jsonify({"message": f"Cohere API error: {str(e)}"}), 500

        # Parse the response to ensure it's in the expected JSON format
        try:
            suggestions = json.loads(generated_text)
            if not isinstance(suggestions, dict) or "suggestions" not in suggestions:
                raise ValueError("Invalid response format from Cohere API")
        except json.JSONDecodeError as e:
            logger.error({"message": f"Failed to parse Cohere response: {str(e)}", "response": generated_text})
            return jsonify({"message": "Invalid response format from Cohere API"}), 500

        # Log the action
        log_audit_action(
            "suggest_medicines",
            patient_id,
            user_id,
            {
                "name": patient["name"],
                "department": department,
                "suggestions": [s["medicine"] for s in suggestions.get("suggestions", [])]
            }
        )

        return jsonify({
            "message": "Medicine suggestions generated successfully",
            "patient_id": patient_id,
            "suggestions": suggestions["suggestions"]
        }), 200

    except ValidationErrorCustom as e:
        return jsonify({"message": str(e)}), e.status_code
    except Exception as e:
        logger.error({"message": f"Error suggesting medicines for patient {patient_id}: {str(e)}"})
        return jsonify({"message": "Internal server error"}), 500

if __name__ == '__main__':
    port = int(os.getenv("PORT", 5000))
    try:
        app.run(host='0.0.0.0', port=port, debug=False)
    except KeyboardInterrupt:
        logger.info({"message": "Shutting down server gracefully"})
        client.close()
    except Exception as e:
        logger.error({"message": f"Server error: {str(e)}"})
        client.close()