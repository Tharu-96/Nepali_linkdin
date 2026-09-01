from sqlalchemy import create_engine, text
import os
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.environ.get("DATABASE_URL")
engine = create_engine(DATABASE_URL)

statements = [
    "ALTER TABLE worker_profiles ADD COLUMN headline VARCHAR;",
    "ALTER TABLE worker_profiles ADD COLUMN experience TEXT;",
    "ALTER TABLE worker_profiles ADD COLUMN education TEXT;",
    "ALTER TABLE worker_profiles ADD COLUMN certifications TEXT;",
    "ALTER TABLE worker_profiles ADD COLUMN projects TEXT;",
    "ALTER TABLE worker_profiles ADD COLUMN resume_url VARCHAR;",
    "ALTER TABLE worker_profiles ADD COLUMN profile_picture_url VARCHAR;",
    "ALTER TABLE employer_profiles ADD COLUMN profile_picture_url VARCHAR;",
    "ALTER TABLE messages ADD COLUMN file_url VARCHAR;",
    "ALTER TABLE messages ADD COLUMN file_type VARCHAR;",
    "ALTER TABLE messages ADD COLUMN metadata_json TEXT;",
    "ALTER TABLE worker_profiles ADD COLUMN esewa_number VARCHAR;",
    "ALTER TABLE worker_profiles ADD COLUMN khalti_number VARCHAR;",
    """
    CREATE TABLE IF NOT EXISTS transactions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        job_id INTEGER REFERENCES jobs(id) ON DELETE CASCADE,
        employer_id INTEGER REFERENCES employer_profiles(id) ON DELETE CASCADE,
        worker_id INTEGER REFERENCES worker_profiles(id) ON DELETE CASCADE,
        gross_amount_npr NUMERIC NOT NULL,
        commission_rate NUMERIC DEFAULT 0.08,
        commission_amount_npr NUMERIC NOT NULL,
        net_amount_npr NUMERIC NOT NULL,
        gateway VARCHAR NOT NULL,
        gateway_transaction_id VARCHAR,
        status VARCHAR DEFAULT 'pending',
        worker_payment_number VARCHAR NOT NULL,
        initiated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        completed_at TIMESTAMP WITH TIME ZONE,
        raw_response JSONB,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
    """,
    """
    CREATE TABLE IF NOT EXISTS payment_disputes (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        transaction_id UUID REFERENCES transactions(id) ON DELETE CASCADE,
        raised_by INTEGER REFERENCES users(id) ON DELETE CASCADE,
        reason TEXT NOT NULL,
        status VARCHAR DEFAULT 'open',
        admin_note TEXT,
        resolved_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        resolved_at TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
    """
    # Module 3: Maps/location columns
    "ALTER TABLE jobs ADD COLUMN IF NOT EXISTS map_address VARCHAR;",
    # Ensure jobs table has status and lat/lng columns expected by models
    "ALTER TABLE jobs ADD COLUMN IF NOT EXISTS status VARCHAR DEFAULT 'pending_approval';",
    "ALTER TABLE jobs ADD COLUMN IF NOT EXISTS latitude FLOAT;",
    "ALTER TABLE jobs ADD COLUMN IF NOT EXISTS longitude FLOAT;",
    "ALTER TABLE jobs ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();",
    "ALTER TABLE jobs ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();",
    "ALTER TABLE worker_profiles ADD COLUMN IF NOT EXISTS location_sharing_consent BOOLEAN DEFAULT false;",
    "ALTER TABLE employer_profiles ADD COLUMN IF NOT EXISTS latitude FLOAT;",
    "ALTER TABLE employer_profiles ADD COLUMN IF NOT EXISTS longitude FLOAT;",
    "ALTER TABLE employer_profiles ADD COLUMN IF NOT EXISTS office_address VARCHAR;",
    # Ensure users table has flags used by the app models
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT false;",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS phone_number VARCHAR;",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();",
]

for stmt in statements:
    try:
        with engine.begin() as conn:
            conn.execute(text(stmt))
        print(f"Applied: {stmt}")
    except Exception as e:
        print(f"Skipping / failed: {stmt}\n  {e}")

print("Migration complete")
