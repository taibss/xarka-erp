"""
Seed script: Import real eSSL employees and create biometric mappings.

Usage:
    python seed_employees.py                  # uses DATABASE_URL env var
    DATABASE_URL=... python seed_employees.py # explicit URL

Idempotent — safe to run multiple times.
"""

import os
import sys
import psycopg2
from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Default password for all new employees (admin can reset later)
DEFAULT_PASSWORD = "xarka@123"

# eSSL employees: (name, biometric_id)
ESSL_EMPLOYEES = [
    ("Nayan", 2527),
    ("Jaywant", 2528),
    ("Farhan", 2529),
    ("Sandeep", 2530),
    ("Pankaj", 2531),
    ("Kiran", 2532),
    ("Om", 2533),
    ("Harshal", 2534),
    ("Naman", 2535),
    ("Chandan", 2536),
    ("Dev", 2537),
    ("Ujwal", 2538),
    ("Sahil", 2539),
    ("Taiba", 2540),
    ("Dipika", 2541),
]

DEFAULT_PASSWORD_HASH = pwd_context.hash(DEFAULT_PASSWORD)


def email_from_name(name: str) -> str:
    return f"{name.lower().replace(' ', '')}@xarka.in"


def seed(cur):
    employees_created = 0
    employees_skipped = 0
    mappings_created = 0
    mappings_skipped = 0
    mappings_updated = 0

    for name, bio_id in ESSL_EMPLOYEES:
        email = email_from_name(name)
        bio_id_str = str(bio_id)

        # Check if employee exists (by name or email)
        cur.execute(
            "SELECT id FROM employees WHERE LOWER(name) = LOWER(%s) OR LOWER(email) = LOWER(%s)",
            (name, email),
        )
        row = cur.fetchone()

        if row:
            emp_id = row[0]
            employees_skipped += 1
        else:
            cur.execute(
                "INSERT INTO employees (name, email, password_hash, role, is_active) "
                "VALUES (%s, %s, %s, 'employee', true) RETURNING id",
                (name, email, DEFAULT_PASSWORD_HASH),
            )
            emp_id = cur.fetchone()[0]
            employees_created += 1

        # Check existing biometric mapping for this employee
        cur.execute(
            "SELECT id, external_employee_id FROM employee_biometric_mapping WHERE employee_id = %s",
            (emp_id,),
        )
        bio_row = cur.fetchone()

        if bio_row:
            if bio_row[1] != bio_id_str:
                # Update if biometric ID changed (e.g. Om 2528 -> 2533)
                cur.execute(
                    "UPDATE employee_biometric_mapping SET external_employee_id = %s, "
                    "external_employee_code = %s, updated_at = NOW() WHERE id = %s",
                    (bio_id_str, bio_id_str, bio_row[0]),
                )
                mappings_updated += 1
            else:
                mappings_skipped += 1
        else:
            cur.execute(
                "INSERT INTO employee_biometric_mapping "
                "(employee_id, provider, external_employee_id, external_employee_code, is_active, created_at, updated_at) "
                "VALUES (%s, 'essl', %s, %s, true, NOW(), NOW())",
                (emp_id, bio_id_str, bio_id_str),
            )
            mappings_created += 1

    return {
        "employees_created": employees_created,
        "employees_skipped": employees_skipped,
        "mappings_created": mappings_created,
        "mappings_updated": mappings_updated,
        "mappings_skipped": mappings_skipped,
    }


def verify(cur):
    cur.execute(
        "SELECT e.name, e.id, m.external_employee_id "
        "FROM employees e "
        "LEFT JOIN employee_biometric_mapping m ON e.id = m.employee_id "
        "ORDER BY e.id"
    )
    rows = cur.fetchall()
    print("\n{'='*60}")
    print(f"{'Employee Name':<20} {'ERP ID':<10} {'Biometric ID':<15}")
    print(f"{'-'*20} {'-'*10} {'-'*15}")
    for name, emp_id, bio_id in rows:
        print(f"{name:<20} {emp_id:<10} {bio_id or 'N/A':<15}")
    print(f"{'='*60}")

    cur.execute("SELECT COUNT(*) FROM employees")
    emp_count = cur.fetchone()[0]
    cur.execute("SELECT COUNT(*) FROM employee_biometric_mapping")
    map_count = cur.fetchone()[0]
    print(f"\nTotal employees: {emp_count}")
    print(f"Total biometric mappings: {map_count}")


def main():
    db_url = os.environ.get("DATABASE_URL")
    if not db_url:
        print("ERROR: DATABASE_URL environment variable is not set.")
        sys.exit(1)

    conn = psycopg2.connect(db_url)
    conn.autocommit = False
    cur = conn.cursor()

    try:
        print("Seeding employees and biometric mappings...")
        stats = seed(cur)
        conn.commit()

        print(f"\nEmployees created: {stats['employees_created']}")
        print(f"Employees skipped (already exist): {stats['employees_skipped']}")
        print(f"Mappings created: {stats['mappings_created']}")
        print(f"Mappings updated: {stats['mappings_updated']}")
        print(f"Mappings skipped (already exist): {stats['mappings_skipped']}")

        verify(cur)
    except Exception as e:
        conn.rollback()
        print(f"\nERROR: {e}")
        sys.exit(1)
    finally:
        cur.close()
        conn.close()


if __name__ == "__main__":
    main()
