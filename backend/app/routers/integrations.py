from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from app.database import get_db
from app import models, schemas, auth

router = APIRouter(prefix="/integrations", tags=["integrations"])

DEFAULT_INTEGRATIONS = ["CRM", "QuickBooks", "Google Calendar"]

@router.get("", response_model=List[schemas.IntegrationOut])
def get_integrations(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    items = db.query(models.Integration).filter(models.Integration.business_id == current_user.business_id).all()
    existing_names = {i.name for i in items}
    
    created_any = False
    for name in DEFAULT_INTEGRATIONS:
        if name not in existing_names:
            default_enabled = (name in ["CRM", "Google Calendar"])
            new_item = models.Integration(
                business_id=current_user.business_id,
                name=name,
                enabled=default_enabled,
            )
            db.add(new_item)
            items.append(new_item)
            created_any = True
            
    if created_any:
        db.commit()
        for i in items:
            db.refresh(i)

    return items


@router.patch("/{name}", response_model=schemas.IntegrationOut)
def update_integration(
    name: str,
    payload: schemas.IntegrationUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    item = (
        db.query(models.Integration)
        .filter(
            models.Integration.business_id == current_user.business_id,
            models.Integration.name == name,
        )
        .first()
    )
    if not item:
        item = models.Integration(
            business_id=current_user.business_id,
            name=name,
            enabled=payload.enabled,
            config=payload.config,
        )
        db.add(item)
    else:
        item.enabled = payload.enabled
        if payload.config is not None:
            item.config = payload.config

    db.commit()
    db.refresh(item)
    return item
