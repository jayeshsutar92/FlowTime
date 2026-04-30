import logging
import random
from datetime import timedelta
from django.contrib.auth import get_user_model, login
from django.contrib.auth.hashers import check_password, make_password
from django.core.mail import send_mail
from django.db.models import Avg, Count, Sum
from django.db.models.functions import ExtractHour, TruncDate
from django.conf import settings
from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import api_view
from rest_framework.response import Response

from .models import OTPVerification, Preset, Session
from .serializers import (
    ForgotPasswordSerializer,
    LoginSerializer,
    PresetSerializer,
    ResetPasswordSerializer,
    SessionSerializer,
    SessionTransitionSerializer,
    SignupSerializer,
    StartSessionSerializer,
)

logger = logging.getLogger(__name__)
User = get_user_model()


def success_response(message, data=None, status_code=status.HTTP_200_OK, **extra):
    payload = {"message": message, "data": data}
    payload.update(extra)
    return Response(payload, status=status_code)


def error_response(message, status_code, details=None):
    return Response({"error": message, "details": details}, status=status_code)


def auth_error_response(message, details=None, status_code=status.HTTP_400_BAD_REQUEST):
    return Response({"message": message, "data": details}, status=status_code)


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


def get_recent_completion_rate(limit=10):
    recent_sessions = list(
        Session.objects.order_by("-created_at").values_list("status", flat=True)[:limit]
    )
    if not recent_sessions:
        return None

    completed_sessions = sum(1 for status in recent_sessions if status == Session.STATUS_COMPLETED)
    return completed_sessions / len(recent_sessions)


def get_adaptive_break_factor():
    completion_rate = get_recent_completion_rate()
    if completion_rate is None:
        return 0.2
    if completion_rate < 0.5:
        return 0.3
    if completion_rate > 0.8:
        return 0.15
    return 0.2


def calculate_short_break(work_duration, k=0.2):
    return int(5 + k * (work_duration - 25))


def calculate_long_break(pomodoros_completed):
    return int(15 + 5 * (pomodoros_completed - 4))


def get_recent_session_metrics(limit=5):
    recent_sessions = list(
        Session.objects.order_by("-created_at").values("status", "work_duration")[:limit]
    )
    if not recent_sessions:
        return None

    completed_count = sum(
        1 for session in recent_sessions if session["status"] == Session.STATUS_COMPLETED
    )
    completion_rate = completed_count / len(recent_sessions)
    avg_session_length = sum(session["work_duration"] for session in recent_sessions) / len(
        recent_sessions
    )
    return {
        "completion_rate": completion_rate,
        "avg_session_length": avg_session_length,
    }


def adjust_session_durations(work_duration, break_duration):
    original_work_duration = work_duration
    original_break_duration = break_duration
    metrics = get_recent_session_metrics()
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


def get_completed_streak():
    streak = 0
    recent_statuses = Session.objects.order_by("-created_at").values_list("status", flat=True)
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


def get_session_or_404(session_id):
    try:
        return Session.objects.get(id=session_id)
    except Session.DoesNotExist:
        return None


def complete_running_sessions():
    return Session.objects.filter(status=Session.STATUS_RUNNING).update(
        status=Session.STATUS_COMPLETED,
        completed=True,
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
    return otp_record


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

    login(request, user)
    if not request.session.session_key:
        request.session.save()

    return success_response(
        "Login successful",
        {"token": request.session.session_key},
    )


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
    if user is not None:
        create_reset_otp(user)

    return success_response("If account exists, OTP sent", None)


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
def get_productivity_score(request):
    total_sessions = Session.objects.count()
    if total_sessions == 0:
        return success_response(
            "Score fetched",
            {"score": 0, "level": "No data"},
        )

    completed_sessions = Session.objects.filter(status=Session.STATUS_COMPLETED)
    completed_count = completed_sessions.count()
    completion_rate = completed_count / total_sessions if total_sessions else 0
    avg_session_length = completed_sessions.aggregate(avg=Avg("work_duration"))["avg"] or 0
    streak = get_completed_streak()
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
def get_heatmap(request):
    today = timezone.localdate()
    start_date = today - timedelta(days=6)

    session_counts = (
        Session.objects.filter(created_at__date__gte=start_date, created_at__date__lte=today)
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
def get_insights(request):
    completed_sessions = Session.objects.filter(status=Session.STATUS_COMPLETED)
    all_sessions = Session.objects.all()

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
def start_session(request):
    serializer = StartSessionSerializer(data=request.data)
    if not serializer.is_valid():
        return error_response(
            "Invalid start session payload.",
            status.HTTP_400_BAD_REQUEST,
            serializer.errors,
        )

    complete_running_sessions()
    adaptive_break_factor = get_adaptive_break_factor()
    adjusted_session = adjust_session_durations(
        serializer.validated_data["work_duration"],
        serializer.validated_data["break_duration"],
    )

    session = Session.objects.create(
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
        if session.current_session % 4 == 0
        else None
    )
    break_type = "long" if long_break is not None else "short"
    break_duration = long_break if long_break is not None else short_break

    data = {
        "session_id": session.id,
        "total_sessions": session.total_sessions,
        "current_session": session.current_session,
        "status": session.status,
        "short_break": short_break,
        "break_type": break_type,
        "break_duration": break_duration,
        "adjusted": adjusted_session["adjusted"],
        "adjustment_reason": adjusted_session["adjustment_reason"],
    }
    if long_break is not None:
        data["long_break"] = long_break

    return success_response(
        "Session started",
        data,
        status_code=status.HTTP_201_CREATED,
    )


@api_view(["POST"])
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

    session = get_session_or_404(serializer.validated_data["session_id"])
    if session is None:
        return error_response("Session not Found", status.HTTP_404_NOT_FOUND)
    if session.status != Session.STATUS_RUNNING:
        return error_response(
            "Only running sessions can be paused.",
            status.HTTP_400_BAD_REQUEST,
        )

    session.transition_to(Session.STATUS_PAUSED)
    return success_response(
        "Session paused",
        {"session_id": session.id, "status": session.status},
    )


@api_view(["POST"])
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

    session = get_session_or_404(serializer.validated_data["session_id"])
    if session is None:
        return error_response("Session not Found", status.HTTP_404_NOT_FOUND)
    if session.status != Session.STATUS_RUNNING:
        return error_response(
            "Only running sessions can be completed.",
            status.HTTP_400_BAD_REQUEST,
        )

    session.status = Session.STATUS_COMPLETED
    session.completed = True
    session.save(update_fields=["status", "completed"])
    return success_response(
        "Session Completed",
        {"session_id": session.id, "status": session.status},
    )


@api_view(["GET"])
def get_stats(request):
    sessions = Session.objects.filter(status=Session.STATUS_COMPLETED)
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
def save_preset(request):
    serializer = PresetSerializer(data=request.data)
    if not serializer.is_valid():
        return error_response(
            "Invalid preset payload.",
            status.HTTP_400_BAD_REQUEST,
            serializer.errors,
        )

    preset = serializer.save()
    return success_response(
        "Preset saved",
        {"id": preset.id},
        status_code=status.HTTP_201_CREATED,
    )


@api_view(["GET"])
def get_presets(request):
    presets = Preset.objects.all().order_by("-id")
    serializer = PresetSerializer(presets, many=True)
    return success_response("Presets fetched", serializer.data)


@api_view(["GET"])
def get_sessions(request):
    serializer = SessionSerializer(Session.objects.all(), many=True)
    return success_response("Sessions fetched successfully.", serializer.data)


@api_view(["DELETE"])
def delete_preset(request, id):
    try:
        preset = Preset.objects.get(id=id)
    except Preset.DoesNotExist:
        return error_response("Preset not found", status.HTTP_404_NOT_FOUND)

    preset.delete()
    return success_response("Preset deleted", None)
