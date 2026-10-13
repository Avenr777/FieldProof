"""Seed the database with demo data for the dashboard and mobile workflows."""

import os
from datetime import datetime, timedelta

from app import models
from app.auth import hash_password
from app.database import Base, SessionLocal, ensure_sqlite_columns, engine
from app.generate_templates import generate_all_templates
from app.services.docx_extractor import extract_docx
from app.services.docx_writer import fill_docx

UPLOAD_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "uploads"))


def run(force_reset: bool = True):
    print("--- Generating Real .docx Templates ---")
    generated_files = generate_all_templates()

    db = SessionLocal()
    try:
        if force_reset:
            print("--- Clearing Existing Database Tables ---")
            Base.metadata.drop_all(bind=engine)
            Base.metadata.create_all(bind=engine)
            ensure_sqlite_columns()
        elif db.query(models.Business).first():
            print("Database already contains data and force_reset=False. Skipping seed.")
            return

        print("--- Creating Business & Users ---")
        business = models.Business(
            name="Meridian FieldWorks",
            primary_trade="Electrical",
            address="220 Harbor Road, Suite 4, Portland, OR 97201",
            plan="Growth",
            seats=15,
        )
        db.add(business)
        db.flush()

        owner = models.User(
            business_id=business.id,
            full_name="Priya Sharma",
            email="priya@meridianfieldworks.com",
            hashed_password=hash_password("demo-password-123"),
            role=models.Role.owner,
        )
        db.add(owner)

        db.add(models.Integration(business_id=business.id, name="CRM", enabled=True))
        db.add(models.Integration(business_id=business.id, name="QuickBooks", enabled=False))
        db.add(models.Integration(business_id=business.id, name="Google Calendar", enabled=True))

        print("--- Creating Technicians & Accounts ---")
        tech_data = [
            ("Marcus Vance", "marcus@meridianfieldworks.com", "Electrical", models.TechStatus.on_site, 98.0),
            ("Priya Nair", "priya.nair@meridianfieldworks.com", "HVAC", models.TechStatus.available, 95.0),
            ("Diego Alvarez", "diego@meridianfieldworks.com", "Plumbing", models.TechStatus.on_site, 92.0),
            ("Sarah Kim", "sarah@meridianfieldworks.com", "Solar", models.TechStatus.available, 99.0),
            ("Tom Whitfield", "tom@meridianfieldworks.com", "Fire Safety", models.TechStatus.off_duty, 89.0),
        ]
        tech_objs = []
        for name, email, trade, status, compliance_pct in tech_data:
            tech_user = models.User(
                business_id=business.id,
                full_name=name,
                email=email,
                hashed_password=hash_password("demo-password-123"),
                role=models.Role.technician,
            )
            db.add(tech_user)
            db.flush()

            tech = models.Technician(
                business_id=business.id,
                user_id=tech_user.id,
                name=name,
                trade=trade,
                status=status,
                compliance_pct=compliance_pct,
            )
            db.add(tech)
            tech_objs.append(tech)
        db.flush()

        print("--- Creating Compliance Rules ---")
        rules_data = [
            ("Electrical", ["Voltage reading", "Current reading", "Earth resistance", "PPE confirmation", "Technician signature", "Customer signature"]),
            ("Plumbing", ["Pressure test reading", "Leak check confirmation", "Material certification", "Customer signature"]),
            ("HVAC", ["Refrigerant level", "Filter status", "Thermostat calibration", "Safety interlock check", "Technician signature"]),
            ("Fire Safety", ["Smoke & Heat Detectors", "Control Panel Model", "Battery Voltage", "Inspector Signature"]),
        ]
        for trade, reqs in rules_data:
            db.add(models.ComplianceRule(business_id=business.id, trade=trade, required_fields=reqs))

        print("--- Extracting & Seeding Real .docx Templates ---")
        template_objs = {}
        for tpl_name, full_path in generated_files.items():
            trade_name = "Electrical" if "Electrical" in tpl_name else "HVAC" if "HVAC" in tpl_name else "Plumbing" if "Plumbing" in tpl_name else "Fire Safety"
            out_dir = os.path.join(UPLOAD_DIR, "extracted", os.path.splitext(os.path.basename(full_path))[0])
            extraction = extract_docx(full_path, output_dir=out_dir)
            fields = extraction.get("fields", [])
            summary_field_map = [
                {"field": f.get("label") or f.get("field_id"), "source": "Template upload", "confidence": 98.0}
                for f in fields[:5]
            ]
            rel_url = f"/uploads/templates/{os.path.basename(full_path)}"
            tpl = models.Template(
                business_id=business.id,
                name=tpl_name,
                trade=trade_name,
                field_map=summary_field_map,
                times_used=14,
                source_file_url=rel_url,
                extraction=extraction,
            )
            db.add(tpl)
            template_objs[tpl_name] = tpl
        db.flush()

        print("--- Creating Template Assignments ---")
        if "Electrical Inspection Certificate" in template_objs:
            db.add(models.TemplateAssignment(
                template_id=template_objs["Electrical Inspection Certificate"].id,
                technician_id=tech_objs[0].id,
                required_proof_types=["photo", "voice"],
                min_photos=2,
                require_voice=True,
                technician_instructions="Please capture a clear photo of the breaker panel label and record a voice note stating voltage reading and ground test results.",
            ))
            db.add(models.TemplateAssignment(
                template_id=template_objs["Electrical Inspection Certificate"].id,
                technician_id=tech_objs[3].id,
                required_proof_types=["photo", "form_fill"],
                min_photos=1,
                require_voice=False,
                technician_instructions="Fill in the electrical safety checklist form and attach a photo of completed wiring.",
            ))
        if "HVAC Maintenance Log" in template_objs:
            db.add(models.TemplateAssignment(
                template_id=template_objs["HVAC Maintenance Log"].id,
                technician_id=tech_objs[1].id,
                required_proof_types=["photo", "voice"],
                min_photos=1,
                require_voice=True,
                technician_instructions="Record a voice note describing filter replacement and refrigerant pressure level, plus a photo of thermostat calibration.",
            ))
        if "Plumbing Pressure Test & Signoff" in template_objs:
            db.add(models.TemplateAssignment(
                template_id=template_objs["Plumbing Pressure Test & Signoff"].id,
                technician_id=tech_objs[2].id,
                required_proof_types=["photo"],
                min_photos=1,
                require_voice=False,
                technician_instructions="Only send a clear photo of the completed pipe joint pressure gauge reading.",
            ))
        if "Fire Safety & Alarm Inspection" in template_objs:
            db.add(models.TemplateAssignment(
                template_id=template_objs["Fire Safety & Alarm Inspection"].id,
                technician_id=tech_objs[4].id,
                required_proof_types=["photo", "voice", "form_fill"],
                min_photos=2,
                require_voice=True,
                technician_instructions="Complete alarm inspection checklist, attach control panel photo, and record audio test confirmation.",
            ))
        db.flush()

        print("--- Creating Active Jobs ---")
        job1 = models.Job(
            business_id=business.id,
            customer="ABC Industrial Park",
            site_address="14 Industrial Parkway, Bldg 3",
            job_type="Electrical Inspection",
            technician_id=tech_objs[0].id,
            status=models.JobStatus.awaiting_review,
            notes="Completed main breaker inspection in Panel B. Voltage reads 230.4 V. All ground wires secure.",
            scheduled_at=datetime.utcnow() - timedelta(hours=3),
        )
        job2 = models.Job(
            business_id=business.id,
            customer="Lakeside Medical Complex",
            site_address="880 Hospital Way, North Wing",
            job_type="HVAC Maintenance",
            technician_id=tech_objs[1].id,
            status=models.JobStatus.in_progress,
            notes="Flushed condensate line and replaced MERV-13 air filters. Checking refrigerant pressures.",
            scheduled_at=datetime.utcnow() - timedelta(hours=1),
        )
        job3 = models.Job(
            business_id=business.id,
            customer="Downtown Office Plaza",
            site_address="400 Main Street, 5th Floor",
            job_type="Plumbing Repair",
            technician_id=tech_objs[2].id,
            status=models.JobStatus.scheduled,
            notes="Investigate low water pressure on 5th floor rest rooms. Main shut-off valve inspection.",
            scheduled_at=datetime.utcnow() + timedelta(hours=4),
        )
        job4 = models.Job(
            business_id=business.id,
            customer="Summit Tech Tower",
            site_address="100 Innovation Way",
            job_type="Fire Alarm Test",
            technician_id=tech_objs[4].id,
            status=models.JobStatus.compliance_flag,
            notes="Zone 4 smoke detector failed standby battery backup check during annual test.",
            scheduled_at=datetime.utcnow() - timedelta(days=1),
        )
        db.add_all([job1, job2, job3, job4])
        db.flush()

        print("--- Creating Compliance Alerts ---")
        evt = models.ComplianceEvent(
            job_id=job4.id,
            message="Standby Battery Voltage low on Zone 4 Smoke Detector panel (< 24.0V)",
            severity=models.Severity.high,
            resolved=False,
            created_at=datetime.utcnow() - timedelta(hours=18),
        )
        db.add(evt)

        print("--- Filling Sample Real Documents ---")
        output_dir = os.path.join(UPLOAD_DIR, "documents")
        os.makedirs(output_dir, exist_ok=True)

        elec_tpl = template_objs["Electrical Inspection Certificate"]
        elec_fields = elec_tpl.extraction["fields"]
        elec_vals = {
            elec_fields[0]["field_id"]: "ABC Industrial Park",
            elec_fields[1]["field_id"]: "14 Industrial Parkway, Bldg 3",
            elec_fields[2]["field_id"]: datetime.utcnow().strftime("%m/%d/%Y"),
            elec_fields[3]["field_id"]: "Marcus Vance",
        }
        for f in elec_fields[4:]:
            lbl = (f.get("label") or "").lower()
            if "voltage" in lbl:
                elec_vals[f["field_id"]] = "230.4 V"
            elif "resistance" in lbl:
                elec_vals[f["field_id"]] = "2.1 Ω"
            elif "breaker" in lbl:
                elec_vals[f["field_id"]] = "32A"

        elec_out_path = os.path.join(output_dir, f"{job1.id}_{elec_tpl.id}.docx")
        elec_in_path = os.path.join(UPLOAD_DIR, "templates", "Electrical_Inspection_Certificate.docx")
        fill_docx(elec_in_path, elec_out_path, elec_vals, elec_fields)

        doc1 = models.Document(
            job_id=job1.id,
            template_id=elec_tpl.id,
            name="Electrical Inspection Certificate",
            extracted_fields=[
                {"field": "Customer Name", "value": "ABC Industrial Park", "source": "Form fill", "confidence": 100.0},
                {"field": "Site Address", "value": "14 Industrial Parkway, Bldg 3", "source": "Form fill", "confidence": 100.0},
                {"field": "Main Supply Voltage", "value": "230.4 V", "source": "Meter OCR", "confidence": 98.0},
                {"field": "Earth Resistance", "value": "2.1 Ω", "source": "Sensor", "confidence": 96.0},
            ],
            overall_confidence=98.0,
            status=models.DocStatus.pending_review,
            file_url=f"/uploads/documents/{os.path.basename(elec_out_path)}",
        )
        db.add(doc1)

        hvac_tpl = template_objs["HVAC Maintenance Log"]
        hvac_fields = hvac_tpl.extraction["fields"]
        hvac_vals = {
            hvac_fields[0]["field_id"]: "Lakeside Medical Complex",
            hvac_fields[1]["field_id"]: "880 Hospital Way, North Wing",
            hvac_fields[2]["field_id"]: datetime.utcnow().strftime("%m/%d/%Y"),
            hvac_fields[3]["field_id"]: "Trane Voyager / SN-884920",
        }
        hvac_out_path = os.path.join(output_dir, f"{job2.id}_{hvac_tpl.id}.docx")
        hvac_in_path = os.path.join(UPLOAD_DIR, "templates", "HVAC_Maintenance_Log.docx")
        fill_docx(hvac_in_path, hvac_out_path, hvac_vals, hvac_fields)

        doc2 = models.Document(
            job_id=job2.id,
            template_id=hvac_tpl.id,
            name="HVAC Preventative Maintenance Log",
            extracted_fields=[
                {"field": "Client Name", "value": "Lakeside Medical Complex", "source": "Form fill", "confidence": 100.0},
                {"field": "Facility Address", "value": "880 Hospital Way, North Wing", "source": "Form fill", "confidence": 100.0},
                {"field": "Suction Pressure", "value": "70 PSI", "source": "Gauge sensor", "confidence": 97.0},
                {"field": "Discharge Pressure", "value": "235 PSI", "source": "Gauge sensor", "confidence": 97.0},
            ],
            overall_confidence=97.0,
            status=models.DocStatus.approved,
            file_url=f"/uploads/documents/{os.path.basename(hvac_out_path)}",
        )
        db.add(doc2)

        print("--- Creating Metric Snapshots (14 days) ---")
        for day_offset in range(13, -1, -1):
            snap_date = datetime.utcnow() - timedelta(days=day_offset)
            db.add(
                models.MetricSnapshot(
                    business_id=business.id,
                    snapshot_date=snap_date,
                    avg_documentation_time_mins=round(4.8 - (13 - day_offset) * 0.18, 1),
                    avg_accuracy_pct=round(91.5 + (13 - day_offset) * 0.45, 1),
                    compliance_rate_pct=round(94.5 + (13 - day_offset) * 0.35, 1),
                    total_jobs_completed=14 + (13 - day_offset),
                )
            )

        db.commit()
        print("\n=== DATABASE SUCCESSFULLY SEEDED WITH REAL DATA ===")
        print(f"Business: {business.name}")
        print("  Owner login: priya@meridianfieldworks.com / demo-password-123")
        print("  Technician login: marcus@meridianfieldworks.com / demo-password-123")
        print("  Real .docx templates seeded: 4")
        print("  Active jobs: 4")
        print("  Documents generated: 2")
    finally:
        db.close()


if __name__ == "__main__":
    run(force_reset=True)
