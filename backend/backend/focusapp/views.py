# Essential for Ai studio to build frontend

import logging
import os
import random
from datetime import timedelta
from django.contrib.auth import get_user_model, login
from django.contrib.auth.hashers import check_password, make_password
from django.core.mail import send_mail
from django.db import IntegrityError
from django.db.models import Avg, Count, Sum
from django.db.models.functions import ExtractHour, TruncDate
from django.conf import settings
from django.utils import timezone
from django.middleware.csrf import get_token
from django.views.decorators.csrf import ensure_csrf_cookie
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken

from .models import MusicTrack, OTPVerification, Preset, Session
from .serializers import (
    AdminUserSerializer,
    ForgotPasswordSerializer,
    LoginSerializer,
    PresetCreateSerializer,
    ResetPasswordSerializer,
    SessionSerializer,
    SessionTransitionSerializer,
    SignupSerializer,
    StartSessionSerializer,
    StartSessionResponseSerializer,
    MusicTrackSerializer,
)

logger = logging.getLogger(__name__)
User = get_user_model()


@ensure_csrf_cookie
@api_view(["GET"])
def csrf_cookie(request):
    token = get_token(request)
    response = success_response("CSRF cookie set", None)
    response.set_cookie(
        "csrftoken",
        token,
        secure=settings.CSRF_COOKIE_SECURE,
        samesite=settings.CSRF_COOKIE_SAMESITE,
        httponly=False,
        path="/",
    )
    return response


def success_response(message, data=None, status_code=status.HTTP_200_OK, **extra):
    payload = {"message": message, "data": data}
    payload.update(extra)
    return Response(payload, status=status_code)


def error_response(message, status_code, details=None):
    return Response({"error": message, "details": details}, status=status_code)


def auth_error_response(message, details=None, status_code=status.HTTP_400_BAD_REQUEST):
    return Response({"message": message, "data": details}, status=status_code)


def simple_error_response(message, details=None, status_code=status.HTTP_400_BAD_REQUEST):
    return Response({"message": message, "data": details}, status=status_code)


ALLOWED_AUDIO_EXTENSIONS = {".mp3", ".wav", ".ogg", ".aac", ".flac", ".m4a"}
MUSIC_QUEUE = []


def parse_days_filter(days_value):
    if days_value in (None, ""):
        return None

    try:
        days = int(days_value)
    except (TypeError, ValueError):
        return "The 'days' query parameter must be a positive integer."

    if days <= 0:
        return "The 'days' query parameter must be a positive integer."

    return days


def get_recent_completion_rate(user, limit=10):
    recent_sessions = list(
        Session.objects.filter(user=user).order_by("-created_at").values_list("status", flat=True)[:limit]
    )
    if not recent_sessions:
        return None

    completed_sessions = sum(1 for status in recent_sessions if status == Session.STATUS_COMPLETED)
    return completed_sessions / len(recent_sessions)


def get_adaptive_break_factor(user):
    completion_rate = get_recent_completion_rate(user)
    if completion_rate is None:
        return 0.2
    if completion_rate < 0.5:
        return 0.3
    if completion_rate > 0.8:
        return 0.15
    return 0.2


def calculate_short_break(work_duration, k=0.2):
    return max(0, int(5 + k * (work_duration - 25)))


def calculate_long_break(pomodoros_completed):
    return int(15 + 5 * (pomodoros_completed - 4))


def should_use_long_break(current_session, total_sessions):
    return (
        total_sessions >= 5
        and current_session % 4 == 0
        and current_session < total_sessions
    )


def get_recent_session_metrics(user, limit=5):
    recent_sessions = list(
        Session.objects.filter(user=user).order_by("-created_at").values("completed", "work_duration")[:limit]
    )
    if not recent_sessions:
        return None

    completed_count = sum(
        1 for session in recent_sessions if session["completed"]
    )
    completion_rate = completed_count / len(recent_sessions)
    avg_session_length = sum(session["work_duration"] for session in recent_sessions) / len(
        recent_sessions
    )
    return {
        "completion_rate": completion_rate,
        "avg_session_length": avg_session_length,
    }


def adjust_session_durations(user, work_duration, break_duration):
    original_work_duration = work_duration
    original_break_duration = break_duration
    metrics = get_recent_session_metrics(user)
    if metrics is None:
        return {
            "work_duration": work_duration,
            "break_duration": break_duration,
            "adjusted": False,
            "adjustment_reason": None,
        }

    completion_rate = metrics["completion_rate"]
    avg_session_length = metrics["avg_session_length"]
    if completion_rate < 0.5:
        adjusted_work_duration = max(15, int(round(work_duration * 0.8)))
        adjusted_break_duration = max(1, int(round(break_duration * 1.2)))
        return {
            "work_duration": adjusted_work_duration,
            "break_duration": adjusted_break_duration,
            "adjusted": True,
            "adjustment_reason": (
                f"Recent completion rate was {completion_rate:.0%} across "
                f"{avg_session_length:.1f}-minute sessions, so focus time was reduced and break time increased."
            ),
        }
    elif completion_rate > 0.8:
        adjusted_work_duration = min(90, int(round(work_duration * 1.1)))
        adjusted_break_duration = max(1, int(round(break_duration * 0.9)))
        result = {
            "work_duration": adjusted_work_duration,
            "break_duration": adjusted_break_duration,
            "adjusted": True,
            "adjustment_reason": (
                f"Recent completion rate was {completion_rate:.0%} across "
                f"{avg_session_length:.1f}-minute sessions, so focus time was increased slightly."
            ),
        }
    else:
        result = {
            "work_duration": work_duration,
            "break_duration": break_duration,
            "adjusted": False,
            "adjustment_reason": None,
        }

    if (
        result["work_duration"] == original_work_duration
        and result["break_duration"] == original_break_duration
    ):
        result["adjusted"] = False
        result["adjustment_reason"] = None

    return result


def build_recommendation(completion_rate, avg_session_length):
    if completion_rate < 0.5:
        return "Increase break duration"
    if completion_rate > 0.8:
        return "Reduce break slightly"
    if avg_session_length and avg_session_length < 25:
        return "Increase focus duration"
    return "Maintain current routine"


def format_focus_hour(hour):
    if hour is None:
        return None

    start_label = timezone.datetime(2000, 1, 1, hour).strftime("%I %p").lstrip("0")
    end_hour = (hour + 1) % 24
    end_label = timezone.datetime(2000, 1, 1, end_hour).strftime("%I %p").lstrip("0")
    return f"{start_label} - {end_label}"


def get_completed_streak(user):
    streak = 0
    recent_statuses = Session.objects.filter(user=user).order_by("-created_at").values_list("status", flat=True)
    for session_status in recent_statuses:
        if session_status != Session.STATUS_COMPLETED:
            break
        streak += 1
    return streak


def calculate_productivity_score(completion_rate, avg_session_length, streak):
    score = (
        (completion_rate * 50)
        + (min(avg_session_length, 60) / 60 * 30)
        + (min(streak, 10) / 10 * 20)
    )
    return int(score)


def get_session_or_404(session_id, user):
    try:
        return Session.objects.get(id=session_id, user=user)
    except Session.DoesNotExist:
        return None


def complete_running_sessions(user):
    return Session.objects.filter(user=user, status=Session.STATUS_RUNNING).update(
        status=Session.STATUS_COMPLETED,
        completed=False,
    )


def get_user_by_identifier(identifier):
    if "@" in identifier:
        return User.objects.filter(email__iexact=identifier).first()
    return User.objects.filter(username=identifier).first()


def generate_otp(length=6):
    return "".join(str(random.SystemRandom().randint(0, 9)) for _ in range(length))


def create_reset_otp(user):
    otp = generate_otp()
    expires_at = timezone.now() + timedelta(minutes=5)
    OTPVerification.objects.filter(
        user=user,
        purpose=OTPVerification.PURPOSE_RESET,
        is_used=False,
    ).update(is_used=True)
    otp_record = OTPVerification.objects.create(
        user=user,
        purpose=OTPVerification.PURPOSE_RESET,
        code=make_password(otp),
        expires_at=expires_at,
        is_used=False,
    )
    logger.info("Generated reset OTP for user_id=%s", user.id)
    if user.email:
        send_mail(
            "FocusFlow password reset OTP",
            f"Your OTP is {otp}. It expires in 5 minutes.",
            settings.DEFAULT_FROM_EMAIL,
            [user.email],
            fail_silently=False,
        )
        logger.info("Sent reset OTP email to user_id=%s", user.id)
    else:
        logger.info("Reset OTP for user_id=%s is %s", user.id, otp)
    return otp


@api_view(["POST"])
def signup(request):
    serializer = SignupSerializer(data=request.data)
    if not serializer.is_valid():
        return auth_error_response(
            "Signup failed",
            serializer.errors,
            status.HTTP_400_BAD_REQUEST,
        )

    user = serializer.save()
    return success_response(
        "Signup successful",
        {"id": user.id, "identifier": serializer.validated_data["identifier"]},
        status_code=status.HTTP_201_CREATED,
    )


@api_view(["POST"])
def login_user(request):
    serializer = LoginSerializer(data=request.data)
    if not serializer.is_valid():
        return auth_error_response(
            "Login failed",
            serializer.errors,
            status.HTTP_400_BAD_REQUEST,
        )

    identifier = serializer.validated_data["identifier"]
    password = serializer.validated_data.get("password")
    otp = serializer.validated_data.get("otp")
    user = get_user_by_identifier(identifier)
    if user is None:
        return Response({"error": "Invalid credentials."}, status=status.HTTP_400_BAD_REQUEST)

    if password:
        if not user.check_password(password):
            return Response({"error": "Invalid credentials."}, status=status.HTTP_400_BAD_REQUEST)
    else:
        otp_record = OTPVerification.objects.filter(
            user=user,
            is_used=False,
        ).first()
        if otp_record is None or otp_record.expires_at <= timezone.now():
            return Response({"error": "Invalid credentials."}, status=status.HTTP_400_BAD_REQUEST)
        if not check_password(otp, otp_record.code):
            return Response({"error": "Invalid credentials."}, status=status.HTTP_400_BAD_REQUEST)
        otp_record.is_used = True
        otp_record.save(update_fields=["is_used"])

    refresh = RefreshToken.for_user(user)
    access_token = str(refresh.access_token)

    return success_response(
        "Login successful",
        {
            "token": access_token,
            "access": access_token,
            "refresh": str(refresh),
            "is_admin": user.is_staff,
        },
    )


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def logout_user(request):
    try:
        refresh_token = request.data.get("refresh")
        if not refresh_token:
            return Response({"error": "Refresh token required."}, status=status.HTTP_400_BAD_REQUEST)
        token = RefreshToken(refresh_token)
        token.blacklist()
        return success_response("Logout successful")
    except Exception as e:
        return Response({"error": "Invalid token or logout failed."}, status=status.HTTP_400_BAD_REQUEST)


@api_view(["POST"])
def custom_token_refresh(request):
    from rest_framework_simplejwt.serializers import TokenRefreshSerializer
    serializer = TokenRefreshSerializer(data=request.data)
    try:
        serializer.is_valid(raise_exception=True)
        return success_response("Token refreshed", serializer.validated_data)
    except Exception as e:
        return Response({"error": "Invalid refresh token."}, status=status.HTTP_401_UNAUTHORIZED)



@api_view(["POST"])
def forgot_password(request):
    serializer = ForgotPasswordSerializer(data=request.data)
    if not serializer.is_valid():
        return auth_error_response(
            "Forgot password failed",
            serializer.errors,
            status.HTTP_400_BAD_REQUEST,
        )

    user = get_user_by_identifier(serializer.validated_data["identifier"])
    otp_value = None
    if user is not None:
        otp_value = create_reset_otp(user)

    extra = {}
    if settings.DEBUG and otp_value:
        extra["otp"] = otp_value

    return success_response("If account exists, OTP sent", None, **extra)


@api_view(["POST"])
def reset_password(request):
    serializer = ResetPasswordSerializer(data=request.data)
    if not serializer.is_valid():
        return auth_error_response(
            "Reset password failed",
            serializer.errors,
            status.HTTP_400_BAD_REQUEST,
        )

    identifier = serializer.validated_data["identifier"]
    otp = serializer.validated_data["otp"]
    new_password = serializer.validated_data["new_password"]
    user = get_user_by_identifier(identifier)
    if user is None:
        return auth_error_response(
            "Invalid or expired OTP",
            None,
            status.HTTP_400_BAD_REQUEST,
        )

    otp_record = OTPVerification.objects.filter(
        user=user,
        purpose=OTPVerification.PURPOSE_RESET,
        is_used=False,
    ).first()
    if otp_record is None or otp_record.expires_at <= timezone.now():
        return auth_error_response(
            "Invalid or expired OTP",
            None,
            status.HTTP_400_BAD_REQUEST,
        )
    if not check_password(otp, otp_record.code):
        return auth_error_response(
            "Invalid or expired OTP",
            None,
            status.HTTP_400_BAD_REQUEST,
        )

    user.set_password(new_password)
    user.save(update_fields=["password"])
    otp_record.is_used = True
    otp_record.save(update_fields=["is_used"])

    return success_response("Password reset successful", None)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def get_productivity_score(request):
    total_sessions = Session.objects.filter(user=request.user).count()
    if total_sessions == 0:
        return success_response(
            "Score fetched",
            {"score": 0, "level": "No data"},
        )

    completed_sessions = Session.objects.filter(user=request.user, status=Session.STATUS_COMPLETED)
    completed_count = completed_sessions.count()
    completion_rate = completed_count / total_sessions if total_sessions else 0
    avg_session_length = completed_sessions.aggregate(avg=Avg("work_duration"))["avg"] or 0
    streak = get_completed_streak(request.user)
    score = calculate_productivity_score(completion_rate, avg_session_length, streak)

    if score < 40:
        level = "Low"
    elif score <= 70:
        level = "Moderate"
    else:
        level = "High"

    return success_response(
        "Score fetched",
        {"score": score, "level": level},
    )


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def get_heatmap(request):
    today = timezone.localdate()
    start_date = today - timedelta(days=6)

    session_counts = (
        Session.objects.filter(user=request.user, created_at__date__gte=start_date, created_at__date__lte=today)
        .annotate(day=TruncDate("created_at"))
        .values("day")
        .annotate(total=Count("id"))
        .order_by("day")
    )
    counts_by_day = {row["day"]: row["total"] for row in session_counts}

    last_7_days = [
        counts_by_day.get(start_date + timedelta(days=offset), 0)
        for offset in range(7)
    ]

    return success_response(
        "Heatmap fetched",
        {"last_7_days": last_7_days},
    )


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def get_insights(request):
    completed_sessions = Session.objects.filter(user=request.user, status=Session.STATUS_COMPLETED)
    all_sessions = Session.objects.filter(user=request.user)

    avg_session_length = completed_sessions.aggregate(avg=Avg("work_duration"))["avg"] or 0
    total_sessions = all_sessions.count()
    completed_count = completed_sessions.count()
    completion_rate = completed_count / total_sessions if total_sessions else 0

    best_focus_row = (
        completed_sessions.annotate(focus_hour=ExtractHour("created_at"))
        .values("focus_hour")
        .annotate(total=Count("id"))
        .order_by("-total", "focus_hour")
        .first()
    )
    best_focus_time = best_focus_row["focus_hour"] if best_focus_row else None

    return success_response(
        "Insights fetched",
        {
            "avg_session_length": avg_session_length,
            "completion_rate": completion_rate,
            "best_focus_time": format_focus_hour(best_focus_time),
            "recommendation": build_recommendation(completion_rate, avg_session_length),
        },
    )


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def start_session(request):
    logger.info("start_session request data=%s", request.data)
    serializer = StartSessionSerializer(data=request.data)
    if not serializer.is_valid():
        return error_response(
            "Invalid start session payload.",
            status.HTTP_400_BAD_REQUEST,
            serializer.errors,
        )

    complete_running_sessions(request.user)
    adaptive_break_factor = get_adaptive_break_factor(request.user)
    adjusted_session = adjust_session_durations(
        request.user,
        serializer.validated_data["work_duration"],
        serializer.validated_data["break_duration"],
    )

    session = Session.objects.create(
        user=request.user,
        work_duration=adjusted_session["work_duration"],
        break_duration=adjusted_session["break_duration"],
        completed=False,
        total_sessions=serializer.validated_data["total_sessions"],
        current_session=serializer.validated_data["current_session"],
        status=Session.STATUS_RUNNING,
    )

    short_break = calculate_short_break(
        session.work_duration,
        k=adaptive_break_factor,
    )
    long_break = (
        calculate_long_break(session.current_session)
        if should_use_long_break(session.current_session, session.total_sessions)
        else None
    )
    break_type = "long" if long_break is not None else "short"
    break_duration = long_break if long_break is not None else short_break
    logger.info(
        "start_session break decision current_session=%s total_sessions=%s break_type=%s",
        session.current_session,
        session.total_sessions,
        break_type,
    )

    data = {
        "session_id": session.id,
        "total_sessions": session.total_sessions,
        "current_session": session.current_session,
        "status": session.status,
        "work_duration": session.work_duration,
        "started_at": session.created_at.isoformat(),
        "paused_seconds": session.paused_seconds,
        "short_break": short_break,
        "break_type": break_type,
        "break_duration": break_duration,
        "adjusted": adjusted_session["adjusted"],
        "adjustment_reason": adjusted_session["adjustment_reason"],
    }
    if long_break is not None:
        data["long_break"] = long_break

    response_serializer = StartSessionResponseSerializer(data=data)
    if not response_serializer.is_valid():
        logger.error(
            "start_session invalid response payload request=%s response=%s errors=%s",
            request.data,
            data,
            response_serializer.errors,
        )
        return error_response(
            "Invalid start session payload.",
            status.HTTP_400_BAD_REQUEST,
            response_serializer.errors,
        )

    logger.info("start_session response data=%s", response_serializer.validated_data)

    return success_response(
        "Session started",
        response_serializer.validated_data,
        status_code=status.HTTP_201_CREATED,
    )


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def pause_session(request):
    serializer = SessionTransitionSerializer(data=request.data)
    if not serializer.is_valid():
        if "session_id" in serializer.errors:
            return error_response("session_id is required.", status.HTTP_400_BAD_REQUEST)
        return error_response(
            "Invalid pause session payload.",
            status.HTTP_400_BAD_REQUEST,
            serializer.errors,
        )

    session = get_session_or_404(serializer.validated_data["session_id"], request.user)
    if session is None:
        return error_response("Session not Found", status.HTTP_404_NOT_FOUND)
    if session.status != Session.STATUS_RUNNING:
        return error_response(
            "Only running sessions can be paused.",
            status.HTTP_400_BAD_REQUEST,
        )

    session.status = Session.STATUS_PAUSED
    session.paused_at = timezone.now()
    session.save(update_fields=["status", "paused_at", "completed"])
    return success_response(
        "Session paused",
        {
            "session_id": session.id,
            "status": session.status,
            "paused_at": session.paused_at.isoformat() if session.paused_at else None,
            "paused_seconds": session.paused_seconds,
        },
    )


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def resume_session(request):
    serializer = SessionTransitionSerializer(data=request.data)
    if not serializer.is_valid():
        if "session_id" in serializer.errors:
            return error_response("session_id is required.", status.HTTP_400_BAD_REQUEST)
        return error_response(
            "Invalid resume session payload.",
            status.HTTP_400_BAD_REQUEST,
            serializer.errors,
        )

    session = get_session_or_404(serializer.validated_data["session_id"], request.user)
    if session is None:
        return error_response("Session not Found", status.HTTP_404_NOT_FOUND)
    if session.status != Session.STATUS_PAUSED:
        return error_response(
            "Only paused sessions can be resumed.",
            status.HTTP_400_BAD_REQUEST,
        )

    paused_at = session.paused_at or timezone.now()
    paused_delta = int((timezone.now() - paused_at).total_seconds())
    session.paused_seconds += max(0, paused_delta)
    session.paused_at = None
    session.status = Session.STATUS_RUNNING
    session.save(update_fields=["status", "paused_at", "paused_seconds", "completed"])

    return success_response(
        "Session resumed",
        {
            "session_id": session.id,
            "status": session.status,
            "paused_seconds": session.paused_seconds,
        },
    )


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def end_session(request):
    serializer = SessionTransitionSerializer(data=request.data)
    if not serializer.is_valid():
        if "session_id" in serializer.errors:
            return error_response("session_id is required.", status.HTTP_400_BAD_REQUEST)
        return error_response(
            "Invalid end session payload.",
            status.HTTP_400_BAD_REQUEST,
            serializer.errors,
        )

    session = get_session_or_404(serializer.validated_data["session_id"], request.user)
    if session is None:
        return error_response("Session not Found", status.HTTP_404_NOT_FOUND)
    if session.status != Session.STATUS_RUNNING:
        return error_response(
            "Only running sessions can be completed.",
            status.HTTP_400_BAD_REQUEST,
        )

    completed = serializer.validated_data["completed"]
    Session.objects.filter(id=session.id, user=request.user).update(
        status=Session.STATUS_COMPLETED,
        completed=completed
    )
    return success_response(
        "Session Completed",
        {"session_id": session.id, "status": Session.STATUS_COMPLETED},
    )


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def get_stats(request):
    sessions = Session.objects.filter(user=request.user, status=Session.STATUS_COMPLETED)
    days = parse_days_filter(request.query_params.get("days"))
    if isinstance(days, str):
        return error_response(days, status.HTTP_400_BAD_REQUEST)

    if days is not None:
        since = timezone.now() - timedelta(days=days)
        sessions = sessions.filter(created_at__gte=since)

    stats = sessions.aggregate(
        total_focus_time=Sum("work_duration"),
        average_session_time=Avg("work_duration"),
    )
    total_sessions = sessions.count()

    return success_response(
        "Stats fetched successfully.",
        {
            "total_focus_time": stats["total_focus_time"] or 0,
            "total_sessions": total_sessions,
            "average_session_time": stats["average_session_time"] or 0,
        },
    )


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def save_preset(request):
    payload = normalize_preset_request_payload(request.data)
    serializer = PresetCreateSerializer(data=payload)
    if not serializer.is_valid():
        return simple_error_response(
            "Invalid preset payload.",
            serializer.errors,
            status_code=status.HTTP_400_BAD_REQUEST,
        )

    validated = serializer.validated_data
    long_break_duration = validated.get("long_break_duration") or 15
    sessions_before_long_break = validated.get("sessions_before_long_break")

    try:
        preset = Preset.objects.create(
            user=request.user,
            name=validated["name"],
            work_duration=validated["work_duration"],
            short_break=validated["break_duration"],
            long_break=long_break_duration,
        )
    except IntegrityError:
        return simple_error_response(
            "Preset name already exists.",
            status_code=status.HTTP_400_BAD_REQUEST,
        )

    return success_response(
        "Preset saved",
        build_preset_payload(preset, sessions_before_long_break),
        status_code=status.HTTP_201_CREATED,
    )


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def get_presets(request):
    presets = Preset.objects.filter(user=request.user).order_by("-id")
    return success_response(
        "Presets fetched",
        [build_preset_payload(preset) for preset in presets],
    )


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def get_sessions(request):
    serializer = SessionSerializer(Session.objects.filter(user=request.user), many=True)
    return success_response("Sessions fetched successfully.", serializer.data)


def build_preset_payload(preset, sessions_before_long_break=None):
    created_at = getattr(preset, "created_at", None)
    created_at_value = created_at.isoformat() if created_at else None
    payload = {
        "id": preset.id,
        "name": preset.name,
        "work_duration": preset.work_duration,
        "break_duration": preset.short_break,
        "long_break_duration": preset.long_break,
        "sessions_before_long_break": sessions_before_long_break,
        "created_at": created_at_value,
    }
    payload["short_break"] = preset.short_break
    payload["long_break"] = preset.long_break
    return payload


def normalize_preset_request_payload(raw_payload):
    return {
        "name": raw_payload.get("name"),
        "work_duration": raw_payload.get("work_duration"),
        "break_duration": raw_payload.get("break_duration", raw_payload.get("short_break")),
        "long_break_duration": raw_payload.get(
            "long_break_duration",
            raw_payload.get("long_break"),
        ),
        "sessions_before_long_break": raw_payload.get("sessions_before_long_break"),
    }


@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def presets_collection(request):
    if request.method == "GET":
        presets = Preset.objects.filter(user=request.user).order_by("-id")
        return success_response(
            "Presets fetched",
            [build_preset_payload(preset) for preset in presets],
        )

    payload = normalize_preset_request_payload(request.data)
    serializer = PresetCreateSerializer(data=payload)
    if not serializer.is_valid():
        return simple_error_response(
            "Invalid preset payload.",
            serializer.errors,
            status_code=status.HTTP_400_BAD_REQUEST,
        )

    validated = serializer.validated_data
    long_break_duration = validated.get("long_break_duration") or 15
    sessions_before_long_break = validated.get("sessions_before_long_break")

    try:
        preset = Preset.objects.create(
            user=request.user,
            name=validated["name"],
            work_duration=validated["work_duration"],
            short_break=validated["break_duration"],
            long_break=long_break_duration,
        )
    except IntegrityError:
        return simple_error_response(
            "Preset name already exists.",
            status_code=status.HTTP_400_BAD_REQUEST,
        )

    return success_response(
        "Preset created",
        build_preset_payload(preset, sessions_before_long_break),
        status_code=status.HTTP_201_CREATED,
    )


def delete_preset_record(user, preset_id):
    try:
        preset = Preset.objects.get(id=preset_id, user=user)
    except Preset.DoesNotExist:
        return error_response(
            "Preset not found",
            status_code=status.HTTP_404_NOT_FOUND,
        )

    preset.delete()
    return success_response("Preset deleted", None)


@api_view(["DELETE"])
@permission_classes([IsAuthenticated])
def delete_preset(request, id):
    return delete_preset_record(request.user, id)


@api_view(["DELETE"])
@permission_classes([IsAuthenticated])
def delete_preset_by_id(request, id):
    return delete_preset_record(request.user, id)


def parse_optional_int(value, field_name):
    if value in (None, ""):
        return None
    try:
        parsed = int(value)
    except (TypeError, ValueError):
        return f"{field_name} must be an integer."
    if parsed <= 0:
        return f"{field_name} must be a positive integer."
    return parsed


def get_music_track(track_id):
    try:
        return MusicTrack.objects.get(id=track_id)
    except MusicTrack.DoesNotExist:
        return None


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def upload_music(request):
    uploaded_file = request.FILES.get("file")
    name = request.data.get("name")

    if uploaded_file is not None:
        _, ext = os.path.splitext(uploaded_file.name)
        if ext.lower() not in ALLOWED_AUDIO_EXTENSIONS:
            return simple_error_response(
                "Unsupported file type.",
                {"allowed_extensions": sorted(ALLOWED_AUDIO_EXTENSIONS)},
                status.HTTP_400_BAD_REQUEST,
            )
        if not name:
            name = uploaded_file.name

    if not name:
        return simple_error_response("Name is required when no file is provided.")

    duration = parse_optional_int(request.data.get("duration"), "duration")
    if isinstance(duration, str):
        return simple_error_response(duration)

    file_path = uploaded_file.name if uploaded_file is not None else None
    track = MusicTrack.objects.create(
        name=name,
        file_path=file_path,
        duration=duration,
    )

    return success_response(
        "Track metadata stored",
        {"track_id": track.id, "name": track.name},
        status_code=status.HTTP_201_CREATED,
    )


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def list_music_tracks(request):
    tracks = MusicTrack.objects.all()
    serializer = MusicTrackSerializer(tracks, many=True)
    return success_response("Tracks fetched", serializer.data)


@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def music_queue(request):
    if request.method == "GET":
        if not MUSIC_QUEUE:
            return success_response("Queue fetched", [])

        unique_ids = list(dict.fromkeys(MUSIC_QUEUE))
        tracks = MusicTrack.objects.filter(id__in=unique_ids)
        track_map = {track.id: track for track in tracks}
        ordered_tracks = [track_map[item_id] for item_id in MUSIC_QUEUE if item_id in track_map]
        serializer = MusicTrackSerializer(ordered_tracks, many=True)
        return success_response("Queue fetched", serializer.data)

    track_id = request.data.get("track_id")
    track_id = parse_optional_int(track_id, "track_id")
    if isinstance(track_id, str) or track_id is None:
        return simple_error_response("track_id is required and must be an integer.")

    track = get_music_track(track_id)
    if track is None:
        return simple_error_response("Invalid track_id.", status_code=status.HTTP_404_NOT_FOUND)

    MUSIC_QUEUE.append(track.id)
    return success_response("Track queued", {"track_id": track.id})


@api_view(["DELETE"])
@permission_classes([IsAuthenticated])
def delete_music_queue_item(request, id):
    if id not in MUSIC_QUEUE:
        return simple_error_response("Track not in queue.", status_code=status.HTTP_404_NOT_FOUND)

    MUSIC_QUEUE.remove(id)
    return success_response("Track removed", {"track_id": id})


# ---------------------------------------------------------------------------
# Admin Management Views
# ---------------------------------------------------------------------------


def is_admin_user(view_func):
    """Decorator that restricts access to authenticated staff users."""
    from functools import wraps

    @wraps(view_func)
    def wrapper(request, *args, **kwargs):
        if not request.user or not request.user.is_authenticated:
            return error_response(
                "Authentication required.",
                status.HTTP_401_UNAUTHORIZED,
            )
        if not request.user.is_staff:
            return error_response(
                "Admin access required.",
                status.HTTP_403_FORBIDDEN,
            )
        return view_func(request, *args, **kwargs)

    return wrapper


@api_view(["GET"])
@is_admin_user
def admin_list_users(request):
    users = User.objects.all().order_by("-date_joined")
    serializer = AdminUserSerializer(users, many=True)
    return success_response("Users fetched", serializer.data)


@api_view(["GET"])
@is_admin_user
def admin_user_count(request):
    count = User.objects.count()
    return success_response("User count fetched", {"count": count})


@api_view(["DELETE"])
@is_admin_user
def admin_delete_user(request, user_id):
    if request.user.id == user_id:
        return error_response(
            "Cannot delete your own account.",
            status.HTTP_400_BAD_REQUEST,
        )
    try:
        target_user = User.objects.get(id=user_id)
    except User.DoesNotExist:
        return error_response("User not found.", status.HTTP_404_NOT_FOUND)

    username = target_user.username
    target_user.delete()
    logger.info("Admin %s deleted user %s (id=%s)", request.user.username, username, user_id)
    return success_response("User deleted", {"id": user_id, "username": username})
