import logging
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from ..crud import audit as crud_audit
from ..database import get_session
from ..models import AuditLog, Role, User
from ..schemas import RoleRead, UserActivity, UserCreate, UserRead
from ..security import get_current_admin, get_password_hash

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/users", tags=["users"])

ROLE_PERMISSIONS = {
    "admin": [
        "Full system access",
        "Manage users and roles",
        "Run payroll and process payments",
        "Configure M-Pesa settings",
        "View audit logs and analytics",
        "Deactivate workers and products",
    ],
    "supervisor": [
        "Manage workers and products",
        "Log and approve production",
        "Create and approve advances",
        "View analytics and reports",
    ],
    "clerk": [
        "View workers and products",
        "Log production entries",
        "Request advances",
        "View payroll records (read-only)",
    ],
}


@router.get("/", response_model=List[UserRead])
async def read_users(
    session: AsyncSession = Depends(get_session),
    current_user=Depends(get_current_admin),
):
    result = await session.execute(select(User).order_by(User.created_at))
    return result.scalars().all()


@router.get("/roles", response_model=List[RoleRead])
async def read_roles(
    session: AsyncSession = Depends(get_session),
    current_user=Depends(get_current_admin),
):
    result = await session.execute(select(Role))
    return result.scalars().all()


@router.get("/permissions")
async def read_permissions(
    current_user=Depends(get_current_admin),
):
    return ROLE_PERMISSIONS


@router.get("/activity", response_model=List[UserActivity])
async def read_user_activity(
    session: AsyncSession = Depends(get_session),
    current_user=Depends(get_current_admin),
):
    users_result = await session.execute(select(User).order_by(User.created_at))
    users = users_result.scalars().all()

    role_map = {}
    roles_result = await session.execute(select(Role))
    for r in roles_result.scalars().all():
        role_map[r.id] = r.name

    if not users:
        return []

    user_ids = [u.id for u in users]

    # Batch-fetch audit counts for all users
    count_result = await session.execute(
        select(AuditLog.user_id, func.count(AuditLog.id).label("cnt"))
        .where(AuditLog.user_id.in_(user_ids))
        .group_by(AuditLog.user_id)
    )
    counts_by_user = {row.user_id: row.cnt for row in count_result.all()}

    # Batch-fetch recent actions for all users using a lateral join or subquery
    # Use a correlated subquery to get the 5 most recent actions per user
    recent_actions_by_user: dict[int, list[str]] = {uid: [] for uid in user_ids}
    recent_result = await session.execute(
        select(AuditLog.user_id, AuditLog.action)
        .where(AuditLog.user_id.in_(user_ids))
        .order_by(AuditLog.user_id, AuditLog.event_time.desc())
    )
    for row in recent_result.all():
        uid = row.user_id
        if len(recent_actions_by_user.setdefault(uid, [])) < 5:
            recent_actions_by_user[uid].append(row.action)

    activities = []
    for u in users:
        activities.append(
            UserActivity(
                user_id=u.id,
                username=u.username,
                role=role_map.get(u.role_id, "unknown"),
                active=u.active,
                created_at=u.created_at,
                last_login=u.last_login,
                total_actions=counts_by_user.get(u.id, 0),
                recent_actions=recent_actions_by_user.get(u.id, []),
            )
        )

    return activities


@router.post("/", response_model=UserRead)
async def create_user(
    user: UserCreate,
    session: AsyncSession = Depends(get_session),
    current_user=Depends(get_current_admin),
):
    result = await session.execute(
        select(User).where(User.username == user.username)
    )
    if result.scalars().first():
        logger.warning("User creation failed: duplicate username", extra={"username": user.username})
        raise HTTPException(status_code=400, detail="Username already taken")

    if len(user.password) < 6:
        logger.warning("User creation failed: short password", extra={"username": user.username})
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")

    role = await session.get(Role, user.role_id)
    if not role:
        logger.warning("User creation failed: invalid role_id", extra={"role_id": user.role_id})
        raise HTTPException(status_code=400, detail="Invalid role ID")

    db_user = User(
        username=user.username,
        hashed_password=get_password_hash(user.password),
        role_id=user.role_id,
    )
    session.add(db_user)
    await session.flush()

    await crud_audit.log_action(
        session, current_user.id, "user_created",
        f"{user.username} — {role.name}"
    )
    await session.commit()
    await session.refresh(db_user)
    return db_user


@router.put("/{user_id}")
async def toggle_user_active(
    user_id: int,
    session: AsyncSession = Depends(get_session),
    current_user=Depends(get_current_admin),
):
    result = await session.execute(select(User).where(User.id == user_id))
    db_user = result.scalars().first()
    if not db_user:
        logger.warning("User not found for toggle", extra={"user_id": user_id})
        raise HTTPException(status_code=404, detail="User not found")
    if db_user.id == current_user.id:
        logger.warning("User attempted to deactivate themselves", extra={"user_id": user_id})
        raise HTTPException(status_code=400, detail="Cannot deactivate yourself")
    db_user.active = not db_user.active
    action = "user_deactivated" if not db_user.active else "user_reactivated"
    await crud_audit.log_action(
        session, current_user.id, action,
        f"{'Deactivated' if not db_user.active else 'Reactivated'} user {db_user.username}"
    )
    await session.commit()
    return {"message": f"User {'deactivated' if not db_user.active else 'reactivated'}"}


@router.put("/{user_id}/reset-password")
async def reset_user_password(
    user_id: int,
    body: dict,
    session: AsyncSession = Depends(get_session),
    current_user=Depends(get_current_admin),
):
    password = body.get("password", "")
    if len(password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")
    result = await session.execute(select(User).where(User.id == user_id))
    db_user = result.scalars().first()
    if not db_user:
        logger.warning("User not found for password reset", extra={"user_id": user_id})
        raise HTTPException(status_code=404, detail="User not found")
    logger.info("Password reset", extra={"user_id": user_id, "username": db_user.username})
    db_user.hashed_password = get_password_hash(password)
    await crud_audit.log_action(
        session, current_user.id, "user_password_reset",
        f"Password reset for {db_user.username}"
    )
    await session.commit()
    return {"message": f"Password reset for {db_user.username}"}
