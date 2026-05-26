"""
Celery application — async task queue for voice processing and scheduled jobs.

# CORE_CANDIDATE — reusable Celery configuration for any product needing async tasks.

Why Celery:
- Voice processing (Whisper + Claude) takes 5-15 seconds
- Synchronous processing blocks the farmer's HTTP request the whole time
- Celery offloads the work to a background worker so the API responds instantly
- The farmer polls /voice/{id}/status until processing completes

Usage:
    celery -A workers.celery_app worker --loglevel=info
    celery -A workers.celery_app beat --loglevel=info  # for scheduled tasks
"""

from celery import Celery
from celery.schedules import crontab

from app.config import settings

# Redis as both broker (task queue) and result backend
celery_app = Celery(
    "binjo",
    broker=settings.redis_url if settings.redis_url else "redis://localhost:6379/0",
    backend=settings.redis_url if settings.redis_url else "redis://localhost:6379/0",
)

celery_app.conf.update(
    # Serialize tasks as JSON for debuggability
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    # UTC timezone for consistency
    timezone="UTC",
    enable_utc=True,
    # Task result expires after 1 hour (we save results in DB anyway)
    result_expires=3600,
    # Prefetch 1 task at a time — voice processing is heavy, don't hog tasks
    worker_prefetch_multiplier=1,
    # Acknowledge task after it completes, not when received
    # Prevents lost tasks if the worker crashes mid-processing
    task_acks_late=True,
    # Don't retry tasks on worker shutdown
    task_reject_on_worker_lost=True,
)

# Scheduled tasks (Celery Beat)
celery_app.conf.beat_schedule = {
    # Clean up expired audio files every day at 3 AM UTC (12 PM KST)
    "cleanup-expired-audio": {
        "task": "workers.tasks.cleanup_audio.cleanup_expired_recordings",
        "schedule": crontab(hour=3, minute=0),
    },
    # Generate monthly P&L reports on 1st of each month at 6 AM UTC (3 PM KST)
    "generate-monthly-reports": {
        "task": "workers.tasks.generate_monthly_report.generate_all_monthly_reports",
        "schedule": crontab(day_of_month=1, hour=6, minute=0),
    },
    # Nightly analytics aggregation at midnight UTC (9 AM KST)
    "nightly-analytics": {
        "task": "nightly_analytics",
        "schedule": crontab(hour=0, minute=0),
    },
}

# Auto-discover tasks in workers/tasks/
celery_app.autodiscover_tasks(["workers.tasks"])
