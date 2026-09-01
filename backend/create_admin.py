import sys
from sqlalchemy.orm import Session
from app.core.database import SessionLocal, Base, engine
from app.models.user import User
from app.core.security import hash_password

def create_admin(name: str, email: str, password: str):
    db = SessionLocal()
    try:
        # Check if email exists
        existing_user = db.query(User).filter(User.email == email).first()
        if existing_user:
            print(f"Error: User with email {email} already exists!")
            return False
        
        # Create user
        admin_user = User(
            name=name,
            email=email,
            password=hash_password(password),
            role="admin"
        )
        db.add(admin_user)
        db.commit()
        db.refresh(admin_user)
        print(f"Success: Admin user '{name}' created successfully with email: {email}!")
        return True
    except Exception as e:
        print(f"An error occurred: {e}")
        return False
    finally:
        db.close()

if __name__ == "__main__":
    # Ensure tables are created
    Base.metadata.create_all(bind=engine)
    
    # Check for arguments
    if len(sys.argv) == 4:
        name = sys.argv[1]
        email = sys.argv[2]
        password = sys.argv[3]
    else:
        print("Usage: python create_admin.py <name> <email> <password>")
        print("No arguments provided. Creating default: 'Admin User', admin@rozgar.com, admin123")
        name = "Admin User"
        email = "admin@rozgar.com"
        password = "admin123"
        
    create_admin(name, email, password)
