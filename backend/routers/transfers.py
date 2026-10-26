from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

import models
import schemas
from auth import get_current_user
from database import get_db
from deps import require_profile
from services import timeutil

router = APIRouter(prefix="/api")


def _serialize(t: models.Transfer) -> dict:
    return {
        "id": t.id,
        "direction": t.direction,
        "amount": t.amount,
        "transfer_date": str(t.transfer_date),
        "notes": t.notes,
    }


@router.get("/transfers")
def list_transfers(
    profile_id: int = Query(...),
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    profile = require_profile(profile_id, user, db)
    rows = (
        db.query(models.Transfer)
        .filter(models.Transfer.profile_id == profile.id)
        .order_by(models.Transfer.transfer_date.desc(), models.Transfer.id.desc())
        .all()
    )
    return [_serialize(t) for t in rows]


@router.post("/transfers")
def create_transfer(
    data: schemas.TransferCreate,
    profile_id: int = Query(...),
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    profile = require_profile(profile_id, user, db)
    if data.transfer_date > timeutil.today():
        raise HTTPException(status_code=400, detail="Transfer date can't be in the future")
    transfer = models.Transfer(profile_id=profile.id, **data.model_dump())
    db.add(transfer)
    db.commit()
    db.refresh(transfer)
    return _serialize(transfer)


@router.delete("/transfers/{transfer_id}")
def delete_transfer(
    transfer_id: int,
    profile_id: int = Query(...),
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    profile = require_profile(profile_id, user, db)
    transfer = (
        db.query(models.Transfer)
        .filter(models.Transfer.id == transfer_id, models.Transfer.profile_id == profile.id)
        .first()
    )
    if not transfer:
        raise HTTPException(status_code=404, detail="Transfer not found")
    db.delete(transfer)
    db.commit()
    return {"message": "Transfer deleted"}
