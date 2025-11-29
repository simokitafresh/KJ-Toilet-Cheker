from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import List
from app.api import deps
from app.models import Toilet, Staff
from app.schemas import Toilet as ToiletSchema, Staff as StaffSchema

router = APIRouter()

@router.get("/toilets", response_model=List[ToiletSchema])
def get_toilets(db: Session = Depends(deps.get_db)):
    return db.query(Toilet).filter(Toilet.is_active == True).all()

@router.get("/staff", response_model=List[StaffSchema])
def get_staff(db: Session = Depends(deps.get_db)):
    return db.query(Staff).filter(Staff.is_active == True).order_by(Staff.display_order).all()
