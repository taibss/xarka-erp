from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from datetime import date, datetime, timezone
from database import get_db
from models.leave import Leave, LeaveBalance
from models.employee import Employee
from utils.auth_utils import get_current_employee
from services.notify import create_notification, send_email

router = APIRouter()

VALID_TYPES = {"sick", "casual", "annual"}


class LeaveApply(BaseModel):
    leave_type: str
    from_date: date
    to_date: date
    reason: Optional[str] = None


class LeaveReview(BaseModel):
    status: str  # approved | rejected
    rejection_reason: Optional[str] = None


def _get_or_create_balance(employee_id: int, db: Session) -> LeaveBalance:
    balance = db.query(LeaveBalance).filter(LeaveBalance.employee_id == employee_id).first()
    if not balance:
        balance = LeaveBalance(employee_id=employee_id)
        db.add(balance)
        db.commit()
        db.refresh(balance)
    return balance


def _serialize_leave(leave: Leave, db: Session) -> dict:
    employee = db.query(Employee).filter(Employee.id == leave.employee_id).first()
    reviewer = db.query(Employee).filter(Employee.id == leave.reviewed_by).first() if leave.reviewed_by else None
    return {
        "id": leave.id,
        "employee_id": leave.employee_id,
        "employee_name": employee.name if employee else None,
        "leave_type": leave.leave_type,
        "from_date": leave.from_date,
        "to_date": leave.to_date,
        "days": leave.days,
        "reason": leave.reason,
        "status": leave.status,
        "reviewed_by": reviewer.name if reviewer else None,
        "reviewed_at": leave.reviewed_at,
        "rejection_reason": leave.rejection_reason,
        "created_at": leave.created_at,
    }


# POST /leave/apply
@router.post("/leave/apply")
def apply_leave(
    data: LeaveApply,
    db: Session = Depends(get_db),
    current_employee: Employee = Depends(get_current_employee),
):
    if data.leave_type not in VALID_TYPES:
        raise HTTPException(status_code=400, detail="Invalid leave type. Use: sick, casual, annual")
    if data.to_date < data.from_date:
        raise HTTPException(status_code=400, detail="to_date must be after from_date")

    days = (data.to_date - data.from_date).days + 1

    balance = _get_or_create_balance(current_employee.id, db)
    available = getattr(balance, data.leave_type)
    if available < days:
        raise HTTPException(status_code=400, detail=f"Insufficient {data.leave_type} leave balance. Available: {available} days")

    overlap = db.query(Leave).filter(
        Leave.employee_id == current_employee.id,
        Leave.status != "rejected",
        Leave.from_date <= data.to_date,
        Leave.to_date >= data.from_date,
    ).first()
    if overlap:
        raise HTTPException(status_code=400, detail="You already have a leave request overlapping these dates")

    leave = Leave(
        employee_id=current_employee.id,
        leave_type=data.leave_type,
        from_date=data.from_date,
        to_date=data.to_date,
        days=days,
        reason=data.reason,
    )
    db.add(leave)
    db.commit()
    db.refresh(leave)

    admins = db.query(Employee).filter(Employee.role == "admin", Employee.is_active == True).all()
    for admin in admins:
        create_notification(
            db=db,
            employee_id=admin.id,
            title="New Leave Request",
            message=f"{current_employee.name} requested {leave.leave_type} leave ({leave.days}d) from {leave.from_date} to {leave.to_date}",
            notif_type="leave_request",
            link="/leave",
        )

    return _serialize_leave(leave, db)


# GET /leave/my
@router.get("/leave/my")
def get_my_leaves(
    db: Session = Depends(get_db),
    current_employee: Employee = Depends(get_current_employee),
):
    leaves = db.query(Leave).filter(
        Leave.employee_id == current_employee.id
    ).order_by(Leave.created_at.desc()).all()
    return [_serialize_leave(l, db) for l in leaves]


# GET /leave/balance
@router.get("/leave/balance")
def get_my_balance(
    db: Session = Depends(get_db),
    current_employee: Employee = Depends(get_current_employee),
):
    balance = _get_or_create_balance(current_employee.id, db)
    return {
        "sick": balance.sick,
        "casual": balance.casual,
        "annual": balance.annual,
    }


# GET /leave/admin — all pending + recent
@router.get("/leave/admin")
def get_all_leaves(
    db: Session = Depends(get_db),
    current_employee: Employee = Depends(get_current_employee),
):
    if current_employee.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    leaves = db.query(Leave).order_by(Leave.created_at.desc()).all()
    return [_serialize_leave(l, db) for l in leaves]


# PATCH /leave/{id}/review — admin approves or rejects
@router.patch("/leave/{leave_id}/review")
def review_leave(
    leave_id: int,
    data: LeaveReview,
    db: Session = Depends(get_db),
    current_employee: Employee = Depends(get_current_employee),
):
    if current_employee.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    if data.status not in {"approved", "rejected"}:
        raise HTTPException(status_code=400, detail="status must be approved or rejected")

    leave = db.query(Leave).filter(Leave.id == leave_id).first()
    if not leave:
        raise HTTPException(status_code=404, detail="Leave not found")
    if leave.status != "pending":
        raise HTTPException(status_code=400, detail="Leave already reviewed")

    if data.status == "approved":
        balance = _get_or_create_balance(leave.employee_id, db)
        available = getattr(balance, leave.leave_type)
        if available < leave.days:
            raise HTTPException(status_code=400, detail="Employee has insufficient balance")
        setattr(balance, leave.leave_type, available - leave.days)

    leave.status = data.status
    leave.reviewed_by = current_employee.id
    leave.reviewed_at = datetime.now(timezone.utc).replace(tzinfo=None)
    leave.rejection_reason = data.rejection_reason if data.status == "rejected" else None
    db.commit()
    db.refresh(leave)

    employee = db.query(Employee).filter(Employee.id == leave.employee_id).first()

    if data.status == "approved":
        create_notification(
            db=db,
            employee_id=leave.employee_id,
            title="Leave Approved",
            message=f"Your {leave.leave_type} leave ({leave.days}d) has been approved",
            notif_type="leave_approved",
            link="/leave",
        )
        if employee:
            send_email(
                to=employee.email,
                subject=f"Leave request approved",
                body=f"Hi {employee.name},\n\nYour leave request from {leave.from_date} to {leave.to_date} has been approved.\n\nXarka ERP",
            )
    elif data.status == "rejected":
        create_notification(
            db=db,
            employee_id=leave.employee_id,
            title="Leave Rejected",
            message=f"Your {leave.leave_type} leave has been rejected" + (f": {data.rejection_reason}" if data.rejection_reason else ""),
            notif_type="leave_rejected",
            link="/leave",
        )
        if employee:
            send_email(
                to=employee.email,
                subject=f"Leave request rejected",
                body=f"Hi {employee.name},\n\nYour leave request from {leave.from_date} to {leave.to_date} has been rejected.\n\nXarka ERP",
            )

    return _serialize_leave(leave, db)


# DELETE /leave/{id} — employee cancels their own pending leave
@router.delete("/leave/{leave_id}")
def cancel_leave(
    leave_id: int,
    db: Session = Depends(get_db),
    current_employee: Employee = Depends(get_current_employee),
):
    leave = db.query(Leave).filter(Leave.id == leave_id).first()
    if not leave:
        raise HTTPException(status_code=404, detail="Leave not found")
    if leave.employee_id != current_employee.id:
        raise HTTPException(status_code=403, detail="Not your leave request")
    if leave.status != "pending":
        raise HTTPException(status_code=400, detail="Can only cancel pending requests")
    db.delete(leave)
    db.commit()
    return {"message": "Leave cancelled"}
