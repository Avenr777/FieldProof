"""
Seeds the database with data shaped like the mock data already in the
React dashboard (technicians, jobs, templates, compliance rules) so the
frontend has something realistic to render as soon as it's pointed at
this API. Run with: python -m app.seed
"""
from datetime import datetime, timedelta

from app.database import Base, engine, SessionLocal
from app import models
from app.auth import hash_password


TECHNICIANS = [
    ("Marcus Reed", "Electrical", models.TechStatus.on_site, 98.0),
    ("Priya Nair", "HVAC", models.TechStatus.available, 95.0),
    ("Diego Alvarez", "Plumbing", models.TechStatus.on_site, 91.0),
    ("Sarah Kim", "Solar", models.TechStatus.off_duty, 99.0),
    ("Tom Whitfield", "Fire Safety", models.TechStatus.on_site, 88.0),
    ("Aisha Bello", "Electrical", models.TechStatus.available, 96.0),
]

COMPLIANCE_RULES = [
    ("Electrical", ["Voltage reading", "Current reading", "Earth resistance", "PPE confirmation", "Technician signature", "Customer signature"]),
    ("Plumbing", ["Pressure test reading", "Leak check confirmation", "Material certification", "Customer signature"]),
    ("HVAC", ["Refrigerant level", "Filter status", "Thermostat calibration", "Safety interlock check", "Technician signature"]),
]

TEMPLATES = [
    ("Electrical Inspection Report", "Electrical", 18, 142),
    ("HVAC Service Report", "HVAC", 14, 98),
    ("Plumbing Job Sheet", "Plumbing", 12, 76),
    ("Fire Safety Certificate", "Fire Safety", 22, 41),
    ("Standard Invoice", "General", 9, 210),
    ("Warranty Registration", "General", 7, 33),
]


def run():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        if db.query(models.Business).first():
            print("Database already seeded, skipping.")
            return

        business = models.Business(
            name="Meridian Field Works",
            primary_trade="Electrical",
            address="220 Harbor Road, Suite 4, Portland, OR",
            plan="Growth",
            seats=15,
        )
        db.add(business)
        db.flush()

        owner = models.User(
            business_id=business.id,
            full_name="Priya Nair",
            email="priya@meridianfieldworks.com",
            hashed_password=hash_password("demo-password-123"),
            role=models.Role.owner,
        )
        db.add(owner)

        techs = []
        for name, trade, status, compliance in TECHNICIANS:
            t = models.Technician(business_id=business.id, name=name, trade=trade, status=status, compliance_pct=compliance)
            db.add(t)
            techs.append(t)
        db.flush()

        for trade, fields in COMPLIANCE_RULES:
            db.add(models.ComplianceRule(business_id=business.id, trade=trade, required_fields=fields))

        for name, trade, field_count, used in TEMPLATES:
            db.add(models.Template(
                business_id=business.id,
                name=name,
                trade=trade,
                field_map=[{"field": f"Field {i+1}", "source": "Job record", "confidence": 95.0} for i in range(min(field_count, 3))],
                times_used=used,
            ))

        job = models.Job(
            business_id=business.id,
            customer="ABC Industries",
            site_address="14 Industrial Way",
            job_type="Electrical",
            technician_id=techs[0].id,
            status=models.JobStatus.awaiting_review,
            scheduled_at=datetime.utcnow() - timedelta(hours=2),
        )
        db.add(job)
        db.flush()

        db.add(models.Document(
            job_id=job.id,
            name="Electrical Inspection Report",
            extracted_fields=[
                {"field": "Customer Name", "value": "ABC Industries", "source": "Job record", "confidence": 99.0},
                {"field": "Equipment", "value": "Circuit Breaker", "source": "Image", "confidence": 96.0},
                {"field": "Voltage Reading", "value": "230.4 V", "source": "OCR (meter)", "confidence": 98.0},
                {"field": "Serial Number", "value": "ABB-MCB-16A", "source": "OCR (label)", "confidence": 65.0},
            ],
            overall_confidence=94.0,
            status=models.DocStatus.pending_review,
        ))

        db.commit()
        print(f"Seeded business '{business.name}'. Login with priya@meridianfieldworks.com / demo-password-123")
    finally:
        db.close()


if __name__ == "__main__":
    run()
