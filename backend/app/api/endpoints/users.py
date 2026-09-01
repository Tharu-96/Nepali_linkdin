from fastapi import APIRouter, Depends
from app.api.deps import get_current_user, RoleChecker
from app.models.user import User
from app.schemas.user import UserResponse

router = APIRouter()

# Role checker dependencies
admin_required = RoleChecker(["admin"])
worker_required = RoleChecker(["worker"])
employer_required = RoleChecker(["employer"])

@router.get("/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user)):
    return current_user

@router.get("/admin-only")
def test_admin_route(current_user: User = Depends(admin_required)):
    return {
        "message": "Access granted: Welcome, Admin!",
        "user_email": current_user.email
    }

@router.get("/worker-only")
def test_worker_route(current_user: User = Depends(worker_required)):
    return {
        "message": "Access granted: Welcome, Worker!",
        "user_email": current_user.email
    }

@router.get("/employer-only")
def test_employer_route(current_user: User = Depends(employer_required)):
    return {
        "message": "Access granted: Welcome, Employer!",
        "user_email": current_user.email
    }
