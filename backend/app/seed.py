"""
Seeds the database with data shaped like the mock data already in the
React dashboard (technicians, jobs, templates, compliance rules) so the
frontend has something realistic to render as soon as it's pointed at
this API. Run with: python -m app.seed
"""
from datetime import datetime, timedelta

from app.database import Base, engine, SessionLocal, ensure_sqlite_columns
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

# Templates pre-assigned to the demo technician (Marcus) so the mobile app
# has an operator-assigned home screen out of the box.
MARCUS_TEMPLATE_NAMES = ["Electrical Inspection Report", "Standard Invoice"]


def run():
    Base.metadata.create_all(bind=engine)
    ensure_sqlite_columns()
    db = SessionLocal()
    try:
        existing_biz = db.query(models.Business).first()
        if existing_biz:
            # Check if technician user exists
            tech_user = db.query(models.User).filter(models.User.email == "marcus@meridianfieldworks.com").first()
            if not tech_user:
                tech_user = models.User(
                    business_id=existing_biz.id,
                    full_name="Marcus Vance",
                    email="marcus@meridianfieldworks.com",
                    hashed_password=hash_password("demo-password-123"),
                    role=models.Role.technician,
                )
                db.add(tech_user)
                db.flush()
                print("Added demo technician user: marcus@meridianfieldworks.com / demo-password-123")

            # Bind the technician profile to the login account (one company,
            # one profile) and assign two templates so the mobile app's new
            # templates-first home screen has data on existing databases.
            tech = (
                db.query(models.Technician)
                .filter(models.Technician.name == "Marcus Reed", models.Technician.business_id == existing_biz.id)
                .first()
            )
            if tech:
                if tech.user_id != tech_user.id:
                    tech.user_id = tech_user.id
                assigned = (
                    db.query(models.Template)
                    .filter(
                        models.Template.business_id == existing_biz.id,
                        models.Template.technician_id == tech.id,
                    )
                    .count()
                )
                if assigned == 0:
                    for name in MARCUS_TEMPLATE_NAMES:
                        tpl = (
                            db.query(models.Template)
                            .filter(models.Template.business_id == existing_biz.id, models.Template.name == name)
                            .first()
                        )
                        if tpl and not tpl.technician_id:
                            tpl.technician_id = tech.id
                            tpl.assigned_at = datetime.utcnow()
                    print("Assigned demo templates to Marcus Reed.")

            # Check if snapshots exist
            if not db.query(models.MetricSnapshot).filter(models.MetricSnapshot.business_id == existing_biz.id).first():
                for day_offset in range(13, -1, -1):
                    snap_date = datetime.utcnow() - timedelta(days=day_offset)
                    db.add(models.MetricSnapshot(
                        business_id=existing_biz.id,
                        snapshot_date=snap_date,
                        avg_documentation_time_mins=round(4.6 - (13 - day_offset) * 0.16, 1),
                        avg_accuracy_pct=round(91.2 + (13 - day_offset) * 0.45, 1),
                        compliance_rate_pct=round(94.0 + (13 - day_offset) * 0.35, 1),
                        total_jobs_completed=12 + (13 - day_offset),
                    ))
                print("Seeded 14 historical metric snapshots.")
            db.commit()
            print("Database ready.")
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
            assigned_to = techs[0].id if name in MARCUS_TEMPLATE_NAMES else None
            db.add(models.Template(
                business_id=business.id,
                name=name,
                trade=trade,
                field_map=[{"field": f"Field {i+1}", "source": "Job record", "confidence": 95.0} for i in range(min(field_count, 3))],
                times_used=used,
                technician_id=assigned_to,
                assigned_at=datetime.utcnow() if assigned_to else None,
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

        # Technician user login for testing technician role
        tech_user = models.User(
            business_id=business.id,
            full_name="Marcus Vance",
            email="marcus@meridianfieldworks.com",
            hashed_password=auth.hash_password("demo-password-123"),
            role=models.Role.technician,
        )
        db.add(tech_user)
        db.flush()

        # Bind the technician profile to the login account (one company, one
        # profile) so /templates/my and /capture/start resolve for Marcus.
        techs[0].user_id = tech_user.id

        # Seed 14 days of metric snapshots for smooth trend charts
        for day_offset in range(13, -1, -1):
            snap_date = datetime.utcnow() - timedelta(days=day_offset)
            db.add(models.MetricSnapshot(
                business_id=business.id,
                snapshot_date=snap_date,
                avg_documentation_time_mins=round(4.6 - (13 - day_offset) * 0.16, 1),
                avg_accuracy_pct=round(91.2 + (13 - day_offset) * 0.45, 1),
                compliance_rate_pct=round(94.0 + (13 - day_offset) * 0.35, 1),
                total_jobs_completed=12 + (13 - day_offset),
            ))

        db.commit()
        print(f"Seeded business '{business.name}'.")
        print("  Owner login: priya@meridianfieldworks.com / demo-password-123")
        print("  Technician login: marcus@meridianfieldworks.com / demo-password-123")
    finally:
        db.close()


if __name__ == "__main__":
    run()
