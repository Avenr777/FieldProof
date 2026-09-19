from celery import Celery

from app.config import settings

celery_app = Celery(
    "fieldproof",
    broker=settings.celery_broker_url,
    backend=settings.celery_result_backend,
    include=["app.tasks"],
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    # Fail fast when Redis is offline instead of blocking the request thread.
    # Without these, a dead broker can leave connect() hanging (SYN_SENT) and
    # stall API responses that try to enqueue tasks.
    broker_connection_retry=False,
    # NOTE: 0/None means retry FOREVER in Celery; 1 = fail after one attempt.
    broker_connection_max_retries=1,
    broker_connection_timeout=2,
    broker_transport_options={
        "socket_connect_timeout": 2,
        "socket_timeout": 2,
        "retry_on_timeout": False,
    },
    task_publish_retry=False,
)
