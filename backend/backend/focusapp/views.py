# Essential for Ai studio to build frontend

import logging
import os
import random
from datetime import timedelta
from django.contrib.auth import get_user_model, login
from django.contrib.auth.hashers import check_password, make_password
from django.core.mail import send_mail
from django.db import IntegrityError
from django.db.models import Avg, Count, Sum, Q
from django.db.models.functions import ExtractHour, TruncDate
from django.conf import settings
from django.utils import timezone
from django.middleware.csrf import get_token
from django.views.decorators.csrf import ensure_csrf_cookie
from rest_framework_simplejwt.tokens import RefreshToken
from django.core.cache import cache
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.decorators import api_view, permission_classes, throttle_classes
from rest_framework.throttling import ScopedRateThrottle

from .models import MusicTrack, OTPVerification, Preset, Session, Playlist, PlaylistTrack, FavoriteTrack, DailyContribution
from .serializers import (
    AdminUserSerializer,
    ForgotPasswordSerializer,
    LoginSerializer,
    PresetCreateSerializer,
    ResetPasswordSerializer,
    SessionSerializer,
    SessionTransitionSerializer,
    SessionPauseResumeSerializer,
    SignupSerializer,
    StartSessionSerializer,
    StartSessionResponseSerializer,
    MusicTrackSerializer,
    PlaylistSerializer,
    PlaylistTrackSerializer,
    FavoriteTrackSerializer,
    DailyContributionSerializer,
)


logger = logging.getLogger(__name__)
User = get_user_model()


@ensure_csrf_cookie
@api_view(["GET"])
def csrf_cookie(request):
    token = get_token(request)
    response = success_response("CSRF cookie set", {"csrfToken": token})
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


def get_user_cache_version(user):
    try:
        return cache.get_or_set(f"user_cache_version:{user.id}", 1)
    except Exception as e:
        logger.warning("Cache server offline, bypassing cache: %s", e)
        return None


def invalidate_user_stats_cache(user):
    try:
        cache.get_or_set(f"user_cache_version:{user.id}", 1)
        cache.incr(f"user_cache_version:{user.id}")
        logger.info("Successfully invalidated cache for user %s", user.id)
    except Exception as e:
        logger.warning("Failed to invalidate cache for user %s: %s", user.id, e)


from rest_framework.throttling import SimpleRateThrottle

class LoginRateThrottle(SimpleRateThrottle):
    scope = 'login'

    def get_cache_key(self, request, view):
        if request.user and request.user.is_authenticated:
            ident = request.user.pk
        else:
            ident = self.get_ident(request)
        return self.cache_format % {
            'scope': self.scope,
            'ident': ident
        }


class OtpRateThrottle(SimpleRateThrottle):
    scope = 'otp'

    def get_cache_key(self, request, view):
        if request.user and request.user.is_authenticated:
            ident = request.user.pk
        else:
            ident = self.get_ident(request)
        return self.cache_format % {
            'scope': self.scope,
            'ident': ident
        }


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
        Session.objects.filter(
            user=user,
            timer_type="default",
        ).order_by("-created_at").values("completed", "work_duration")[:limit]
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


def build_recommendation(completion_rate, avg_session_length, total_sessions):
    if total_sessions == 0:
        return "Complete your first session to unlock insights"
    if completion_rate < 0.5:
        return "Try shorter focus sessions to build consistency"
    if completion_rate > 0.8 and avg_session_length < 25:
        return "Great completion rate! Try increasing focus duration"
    if completion_rate > 0.8:
        return "Maintain your current productive routine"
    return "Adjust break intervals to sustain energy"


def format_focus_hour(hour):
    if hour is None:
        return None

    start_label = timezone.datetime(2000, 1, 1, hour).strftime("%I %p").lstrip("0")
    end_hour = (hour + 1) % 24
    end_label = timezone.datetime(2000, 1, 1, end_hour).strftime("%I %p").lstrip("0")
    return f"{start_label} - {end_label}"


def get_completed_streak(user):
    streak = 0
    recent_completed = Session.objects.filter(user=user).exclude(status=Session.STATUS_RUNNING).order_by("-created_at").values_list("completed", flat=True)
    for is_completed in recent_completed:
        if not is_completed:
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


def calculate_user_level_and_xp(user):
    total_minutes = Session.objects.filter(user=user, completed=True).aggregate(sum=Sum("work_duration"))["sum"] or 0
    total_xp = total_minutes * 10
    level = (total_xp // 1000) + 1
    next_level_xp = level * 1000
    current_level_xp = total_xp % 1000
    progress_pct = min(100, int((current_level_xp / 1000) * 100))
    completed_count = Session.objects.filter(user=user, completed=True).count()
    sessions_needed = max(1, (1000 - current_level_xp + 24) // 25)
    return {
        "level": level,
        "total_xp": total_xp,
        "next_level_xp": next_level_xp,
        "current_level_xp": current_level_xp,
        "progress_pct": progress_pct,
        "completed_sessions": completed_count,
        "sessions_needed": sessions_needed,
    }


def get_session_or_404(session_id, user):
    try:
        return Session.objects.get(id=session_id, user=user)
    except Session.DoesNotExist:
        return None


def expire_orphaned_sessions(user=None):
    now = timezone.now()
    running_sessions = Session.objects.filter(status=Session.STATUS_RUNNING)
    if user:
        running_sessions = running_sessions.filter(user=user)

    expired_ids = []
    for session in running_sessions:
        allowed_seconds = (session.work_duration * 60) + (session.paused_seconds or 0)
        elapsed_seconds = (now - session.created_at).total_seconds()
        if elapsed_seconds >= allowed_seconds:
            expired_ids.append(session.id)

    if expired_ids:
        Session.objects.filter(id__in=expired_ids).update(
            status=Session.STATUS_CANCELLED,
            completed=False,
        )
        if user:
            invalidate_user_stats_cache(user)


def complete_running_sessions(user, timer_type="default"):
    expire_orphaned_sessions(user)
    return Session.objects.filter(user=user, status=Session.STATUS_RUNNING, timer_type=timer_type).update(
        status=Session.STATUS_CANCELLED,
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
@throttle_classes([LoginRateThrottle])
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
@throttle_classes([OtpRateThrottle])
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
@throttle_classes([OtpRateThrottle])
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
    days = parse_days_filter(request.query_params.get("days"))
    if isinstance(days, str):
        return error_response(days, status.HTTP_400_BAD_REQUEST)

    version = get_user_cache_version(request.user)
    if version is not None:
        cache_key = f"prod_score:{request.user.id}:{days}:v{version}"
        try:
            cached_data = cache.get(cache_key)
            if cached_data is not None:
                return success_response("Score fetched", cached_data)
        except Exception as e:
            logger.warning("Failed to get productivity score cache: %s", e)

    sessions_qs = Session.objects.filter(user=request.user)
    if days is not None:
        since = timezone.now() - timedelta(days=days)
        sessions_qs = sessions_qs.filter(created_at__gte=since)

    total_attempted = sessions_qs.exclude(status=Session.STATUS_RUNNING).count()
    level_data = calculate_user_level_and_xp(request.user)

    if total_attempted == 0:
        response_data = {
            "score": 0,
            "level": "No Data",
            "level_info": level_data,
        }
    else:
        completed_sessions = sessions_qs.filter(completed=True)
        completed_count = completed_sessions.count()
        completion_rate = completed_count / total_attempted if total_attempted else 0
        avg_session_length = completed_sessions.aggregate(avg=Avg("work_duration"))["avg"] or 0
        streak = get_completed_streak(request.user)
        score = calculate_productivity_score(completion_rate, avg_session_length, streak)

        if score < 40:
            level = "Low"
        elif score <= 70:
            level = "Moderate"
        else:
            level = "High"

        response_data = {
            "score": score,
            "level": level,
            "level_info": level_data,
        }

    if version is not None:
        try:
            cache_key = f"prod_score:{request.user.id}:{days}:v{version}"
            cache.set(cache_key, response_data, timeout=300)
        except Exception as e:
            logger.warning("Failed to set productivity score cache: %s", e)

    return success_response("Score fetched", response_data)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def get_heatmap(request):
    days = parse_days_filter(request.query_params.get("days"))
    if isinstance(days, str):
        return error_response(days, status.HTTP_400_BAD_REQUEST)

    tz_offset_min = int(request.query_params.get("tz_offset", 0))

    version = get_user_cache_version(request.user)
    if version is not None:
        cache_key = f"heatmap:{request.user.id}:{days}:{tz_offset_min}:v{version}"
        try:
            cached_data = cache.get(cache_key)
            if cached_data is not None:
                return success_response("Heatmap fetched", cached_data)
        except Exception as e:
            logger.warning("Failed to get heatmap cache: %s", e)

    user_today = (timezone.now() - timedelta(minutes=tz_offset_min)).date()

    num_days = days if days is not None else 7
    start_date = user_today - timedelta(days=num_days - 1)

    completed_timestamps = list(
        Session.objects.filter(
            user=request.user,
            completed=True,
            created_at__gte=timezone.now() - timedelta(days=num_days + 2)
        ).values_list("created_at", flat=True)
    )

    counts_by_date = {}
    for created_at in completed_timestamps:
        local_date = (created_at - timedelta(minutes=tz_offset_min)).date()
        counts_by_date[local_date] = counts_by_date.get(local_date, 0) + 1

    heatmap_list = []
    last_7_days = []
    for offset in range(num_days):
        dt = start_date + timedelta(days=offset)
        cnt = counts_by_date.get(dt, 0)
        day_name = dt.strftime("%a")
        heatmap_list.append({
            "day": day_name,
            "date": dt.isoformat(),
            "count": cnt,
        })
        if offset >= num_days - 7:
            last_7_days.append(cnt)

    response_data = {
        "last_7_days": last_7_days,
        "days": heatmap_list,
    }

    if version is not None:
        try:
            cache_key = f"heatmap:{request.user.id}:{days}:{tz_offset_min}:v{version}"
            cache.set(cache_key, response_data, timeout=300)
        except Exception as e:
            logger.warning("Failed to set heatmap cache: %s", e)

    return success_response("Heatmap fetched", response_data)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def get_insights(request):
    days = parse_days_filter(request.query_params.get("days"))
    if isinstance(days, str):
        return error_response(days, status.HTTP_400_BAD_REQUEST)

    tz_offset_min = int(request.query_params.get("tz_offset", 0))

    version = get_user_cache_version(request.user)
    if version is not None:
        cache_key = f"insights:{request.user.id}:{days}:{tz_offset_min}:v{version}"
        try:
            cached_data = cache.get(cache_key)
            if cached_data is not None:
                return success_response("Insights fetched", cached_data)
        except Exception as e:
            logger.warning("Failed to get insights cache: %s", e)

    sessions_qs = Session.objects.filter(user=request.user)
    if days is not None:
        since = timezone.now() - timedelta(days=days)
        sessions_qs = sessions_qs.filter(created_at__gte=since)

    completed_sessions = sessions_qs.filter(completed=True)
    all_attempted = sessions_qs.exclude(status=Session.STATUS_RUNNING)

    avg_session_length = completed_sessions.aggregate(avg=Avg("work_duration"))["avg"] or 0
    total_sessions = all_attempted.count()
    completed_count = completed_sessions.count()
    completion_rate = completed_count / total_sessions if total_sessions else 0

    tz_offset_min = int(request.query_params.get("tz_offset", 0))

    # Timezone-aware best focus time calculation
    completed_list = list(completed_sessions.values_list("created_at", flat=True))
    hour_counts = {}
    for created_at in completed_list:
        local_dt = created_at - timedelta(minutes=tz_offset_min)
        h = local_dt.hour
        hour_counts[h] = hour_counts.get(h, 0) + 1

    best_focus_time = None
    if hour_counts:
        best_hour = max(hour_counts.keys(), key=lambda h: (hour_counts[h], -h))
        best_focus_time = format_focus_hour(best_hour)

    # Real Rhythm Visualization data: last 7 days focus time distribution
    today = (timezone.now() - timedelta(minutes=tz_offset_min)).date()
    rhythm_data = []
    max_duration = 1
    for offset in range(6, -1, -1):
        target_date = today - timedelta(days=offset)
        daily_mins = sum(
            s.work_duration for s in completed_sessions
            if (s.created_at - timedelta(minutes=tz_offset_min)).date() == target_date
        )
        if daily_mins > max_duration:
            max_duration = daily_mins
        day_str = target_date.strftime("%a")
        rhythm_data.append({"day": day_str, "date": target_date.isoformat(), "minutes": daily_mins})

    for item in rhythm_data:
        item["pct"] = int((item["minutes"] / max_duration) * 100) if max_duration > 0 and item["minutes"] > 0 else 5

    response_data = {
        "avg_session_length": round(avg_session_length, 1),
        "completion_rate": round(completion_rate, 4),
        "best_focus_time": best_focus_time,
        "recommendation": build_recommendation(completion_rate, avg_session_length, total_sessions),
        "rhythm": rhythm_data,
    }

    if version is not None:
        try:
            cache_key = f"insights:{request.user.id}:{days}:{tz_offset_min}:v{version}"
            cache.set(cache_key, response_data, timeout=300)
        except Exception as e:
            logger.warning("Failed to set insights cache: %s", e)

    return success_response("Insights fetched", response_data)


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

    timer_type = serializer.validated_data.get("timer_type", "default")

    complete_running_sessions(request.user, timer_type)
    adaptive_break_factor = get_adaptive_break_factor(request.user)
    if timer_type in ("custom", "default"):
        adjusted_session = {
            "work_duration": serializer.validated_data["work_duration"],
            "break_duration": serializer.validated_data["break_duration"],
            "adjusted": False,
            "adjustment_reason": None,
        }
    else:
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
        timer_type=timer_type,
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

    invalidate_user_stats_cache(request.user)
    return success_response(
        "Session started",
        response_serializer.validated_data,
        status_code=status.HTTP_201_CREATED,
    )


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def pause_session(request):
    serializer = SessionPauseResumeSerializer(data=request.data)
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
    invalidate_user_stats_cache(request.user)
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
    serializer = SessionPauseResumeSerializer(data=request.data)
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

    invalidate_user_stats_cache(request.user)
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
    new_status = Session.STATUS_COMPLETED if completed else Session.STATUS_CANCELLED
    Session.objects.filter(id=session.id, user=request.user).update(
        status=new_status,
        completed=completed
    )
    invalidate_user_stats_cache(request.user)
    return success_response(
        "Session Completed" if completed else "Session Cancelled",
        {"session_id": session.id, "status": new_status},
    )


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def get_stats(request):
    days = parse_days_filter(request.query_params.get("days"))
    if isinstance(days, str):
        return error_response(days, status.HTTP_400_BAD_REQUEST)

    version = get_user_cache_version(request.user)
    if version is not None:
        cache_key = f"stats:{request.user.id}:{days}:v{version}"
        try:
            cached_data = cache.get(cache_key)
            if cached_data is not None:
                return success_response("Stats fetched successfully.", cached_data)
        except Exception as e:
            logger.warning("Failed to get stats cache: %s", e)

    sessions = Session.objects.filter(user=request.user, completed=True)
    if days is not None:
        since = timezone.now() - timedelta(days=days)
        sessions = sessions.filter(created_at__gte=since)

    stats = sessions.aggregate(
        total_focus_time=Sum("work_duration"),
        average_session_time=Avg("work_duration"),
    )
    total_sessions = sessions.count()

    response_data = {
        "total_focus_time": stats["total_focus_time"] or 0,
        "total_sessions": total_sessions,
        "average_session_time": round(stats["average_session_time"] or 0, 1),
    }

    if version is not None:
        try:
            cache_key = f"stats:{request.user.id}:{days}:v{version}"
            cache.set(cache_key, response_data, timeout=300)
        except Exception as e:
            logger.warning("Failed to set stats cache: %s", e)

    return success_response("Stats fetched successfully.", response_data)


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
def get_active_session(request):
    expire_orphaned_sessions(request.user)
    timer_type = request.query_params.get("timer_type")

    sessions = Session.objects.filter(
        user=request.user,
        status__in=[Session.STATUS_RUNNING, Session.STATUS_PAUSED],
    )
    if timer_type:
        sessions = sessions.filter(timer_type=timer_type)

    active_session = sessions.order_by("-created_at").first()
    if active_session:
        serializer = SessionSerializer(active_session)
        return success_response("Active session fetched successfully.", serializer.data)
    return success_response("No active session.", None)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def get_sessions(request):
    expire_orphaned_sessions(request.user)
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


def get_music_track(track_id, user):
    try:
        return MusicTrack.objects.get(id=track_id, user=user)
    except MusicTrack.DoesNotExist:
        return None


def get_user_queue_from_cache(user_id):
    key = f"music:queue:{user_id}"
    queue = cache.get(key)
    if queue is None:
        queue = []
    return queue


def set_user_queue_in_cache(user_id, queue):
    key = f"music:queue:{user_id}"
    cache.set(key, queue, timeout=None)


def get_user_playback_state_from_cache(user_id):
    key = f"music:state:{user_id}"
    state = cache.get(key)
    if state is None:
        state = {
            "current_index": 0,
            "shuffle": False,
            "repeat": "off",
            "is_playing": False,
            "progress_seconds": 0,
            "shuffled_order": [],
        }
    return state


def set_user_playback_state_in_cache(user_id, state):
    key = f"music:state:{user_id}"
    cache.set(key, state, timeout=None)


def resolve_current_track_id(user_id):
    queue = get_user_queue_from_cache(user_id)
    if not queue:
        return None
    state = get_user_playback_state_from_cache(user_id)
    current_index = state.get("current_index", 0)
    shuffle = state.get("shuffle", False)

    if shuffle:
        shuffled_order = state.get("shuffled_order", [])
        if len(shuffled_order) != len(queue):
            shuffled_order = list(range(len(queue)))
            random.shuffle(shuffled_order)
            state["shuffled_order"] = shuffled_order
            set_user_playback_state_in_cache(user_id, state)

        if 0 <= current_index < len(shuffled_order):
            actual_index = shuffled_order[current_index]
            if 0 <= actual_index < len(queue):
                return queue[actual_index]
    else:
        if 0 <= current_index < len(queue):
            return queue[current_index]
    return None


def advance_playback(user_id, direction=1):
    queue = get_user_queue_from_cache(user_id)
    if not queue:
        return None
    state = get_user_playback_state_from_cache(user_id)
    current_index = state.get("current_index", 0)
    repeat = state.get("repeat", "off")
    shuffle = state.get("shuffle", False)

    total_tracks = len(queue)

    if repeat == "track" and direction == 1:
        state["progress_seconds"] = 0
        set_user_playback_state_in_cache(user_id, state)
        return resolve_current_track_id(user_id)

    if shuffle:
        shuffled_order = state.get("shuffled_order", [])
        if len(shuffled_order) != total_tracks:
            shuffled_order = list(range(total_tracks))
            random.shuffle(shuffled_order)
            state["shuffled_order"] = shuffled_order
            set_user_playback_state_in_cache(user_id, state)
        order_len = len(shuffled_order)
    else:
        order_len = total_tracks

    if direction == 1:
        new_index = current_index + 1
        if new_index >= order_len:
            if repeat == "queue":
                new_index = 0
            else:
                new_index = order_len - 1
                state["is_playing"] = False
    else:
        new_index = current_index - 1
        if new_index < 0:
            if repeat == "queue":
                new_index = order_len - 1
            else:
                new_index = 0

    state["current_index"] = new_index
    state["progress_seconds"] = 0
    set_user_playback_state_in_cache(user_id, state)
    return resolve_current_track_id(user_id)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def upload_music(request):
    uploaded_files = request.FILES.getlist("file")
    if not uploaded_files:
        uploaded_file = request.FILES.get("file")
        if uploaded_file:
            uploaded_files = [uploaded_file]

    if not uploaded_files:
        return simple_error_response("No files provided.")

    duration = parse_optional_int(request.data.get("duration"), "duration")
    if isinstance(duration, str):
        return simple_error_response(duration)

    MAX_FILE_SIZE = 20 * 1024 * 1024  # 20MB

    for f in uploaded_files:
        _, ext = os.path.splitext(f.name)
        if ext.lower() not in ALLOWED_AUDIO_EXTENSIONS:
            return simple_error_response(
                f"Unsupported file type for {f.name}.",
                {"allowed_extensions": sorted(ALLOWED_AUDIO_EXTENSIONS)},
            )
        if f.size > MAX_FILE_SIZE:
            return simple_error_response(f"File {f.name} exceeds the 20MB limit.")

    created_tracks = []
    for f in uploaded_files:
        name = os.path.splitext(f.name)[0]
        track = MusicTrack.objects.create(
            user=request.user,
            name=name,
            file_path=f.name,
            audio_file=f,
            duration=duration or 0,
        )
        created_tracks.append(track)

    serializer = MusicTrackSerializer(created_tracks, many=True, context={"request": request})
    return success_response(
        "Tracks uploaded successfully",
        serializer.data,
        status_code=status.HTTP_201_CREATED,
    )


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def list_music_tracks(request):
    tracks = MusicTrack.objects.filter(user=request.user).order_by("-created_at")
    serializer = MusicTrackSerializer(tracks, many=True, context={"request": request})
    return success_response("Tracks fetched", serializer.data)


@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def playlists_collection(request):
    if request.method == "GET":
        playlists = Playlist.objects.filter(user=request.user).order_by("-created_at")
        serializer = PlaylistSerializer(playlists, many=True, context={"request": request})
        return success_response("Playlists fetched", serializer.data)

    name = request.data.get("name")
    if not name:
        return simple_error_response("Name is required.")

    try:
        playlist = Playlist.objects.create(user=request.user, name=name)
    except IntegrityError:
        return simple_error_response("Playlist with this name already exists.")

    track_ids = request.data.get("track_ids", [])
    if isinstance(track_ids, list):
        for idx, track_id in enumerate(track_ids):
            track = get_music_track(track_id, request.user)
            if track:
                PlaylistTrack.objects.create(playlist=playlist, track=track, position=idx)

    serializer = PlaylistSerializer(playlist, context={"request": request})
    return success_response("Playlist created", serializer.data, status_code=status.HTTP_201_CREATED)


@api_view(["GET", "PUT", "DELETE"])
@permission_classes([IsAuthenticated])
def playlist_detail(request, id):
    try:
        playlist = Playlist.objects.get(id=id, user=request.user)
    except Playlist.DoesNotExist:
        return error_response("Playlist not found", status.HTTP_404_NOT_FOUND)

    if request.method == "GET":
        serializer = PlaylistSerializer(playlist, context={"request": request})
        return success_response("Playlist fetched", serializer.data)

    elif request.method == "PUT":
        name = request.data.get("name")
        if name:
            playlist.name = name
            try:
                playlist.save()
            except IntegrityError:
                return simple_error_response("Playlist name already exists.")

        track_ids = request.data.get("track_ids")
        if track_ids is not None and isinstance(track_ids, list):
            PlaylistTrack.objects.filter(playlist=playlist).delete()
            for idx, track_id in enumerate(track_ids):
                track = get_music_track(track_id, request.user)
                if track:
                    PlaylistTrack.objects.create(playlist=playlist, track=track, position=idx)

        serializer = PlaylistSerializer(playlist, context={"request": request})
        return success_response("Playlist updated", serializer.data)

    elif request.method == "DELETE":
        playlist.delete()
        return success_response("Playlist deleted", None)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def favorites_collection(request):
    favorites = FavoriteTrack.objects.filter(user=request.user).order_by("-created_at")
    serializer = FavoriteTrackSerializer(favorites, many=True, context={"request": request})
    return success_response("Favorites fetched", serializer.data)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def add_favorite(request):
    track_id = request.data.get("track_id")
    track = get_music_track(track_id, request.user)
    if not track:
        return error_response("Track not found", status.HTTP_404_NOT_FOUND)

    FavoriteTrack.objects.get_or_create(user=request.user, track=track)
    return success_response("Added to favorites", {"track_id": track.id})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def remove_favorite(request):
    track_id = request.data.get("track_id")
    FavoriteTrack.objects.filter(user=request.user, track_id=track_id).delete()
    return success_response("Removed from favorites", {"track_id": track_id})


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def get_queue(request):
    queue = get_user_queue_from_cache(request.user.id)
    tracks = MusicTrack.objects.filter(id__in=queue)
    track_map = {t.id: t for t in tracks}
    ordered_tracks = [track_map[tid] for tid in queue if tid in track_map]
    serializer = MusicTrackSerializer(ordered_tracks, many=True, context={"request": request})
    return success_response("Queue fetched", serializer.data)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def add_to_queue(request):
    track_id = request.data.get("track_id")
    playlist_id = request.data.get("playlist_id")

    queue = get_user_queue_from_cache(request.user.id)
    added_ids = []

    if track_id:
        track = get_music_track(track_id, request.user)
        if track:
            queue.append(track.id)
            added_ids.append(track.id)
    elif playlist_id:
        try:
            playlist = Playlist.objects.get(id=playlist_id, user=request.user)
            playlist_tracks = PlaylistTrack.objects.filter(playlist=playlist).order_by("position")
            for pt in playlist_tracks:
                queue.append(pt.track.id)
                added_ids.append(pt.track.id)
        except Playlist.DoesNotExist:
            return error_response("Playlist not found", status.HTTP_404_NOT_FOUND)

    set_user_queue_in_cache(request.user.id, queue)

    state = get_user_playback_state_from_cache(request.user.id)
    state["shuffled_order"] = []
    set_user_playback_state_in_cache(request.user.id, state)

    return success_response("Tracks added to queue", {"added_track_ids": added_ids})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def remove_from_queue(request):
    position = request.data.get("position")
    if position is None:
        return simple_error_response("position parameter is required.")

    try:
        position = int(position)
    except (TypeError, ValueError):
        return simple_error_response("position must be an integer.")

    queue = get_user_queue_from_cache(request.user.id)
    if not (0 <= position < len(queue)):
        return simple_error_response("Invalid position.")

    removed_id = queue.pop(position)
    set_user_queue_in_cache(request.user.id, queue)

    state = get_user_playback_state_from_cache(request.user.id)
    state["shuffled_order"] = []
    if state["current_index"] >= len(queue) and len(queue) > 0:
        state["current_index"] = len(queue) - 1
    set_user_playback_state_in_cache(request.user.id, state)

    return success_response("Track removed from queue", {"removed_track_id": removed_id})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def reorder_queue(request):
    old_pos = request.data.get("old_position")
    new_pos = request.data.get("new_position")

    if old_pos is None or new_pos is None:
        return simple_error_response("old_position and new_position are required.")

    try:
        old_pos = int(old_pos)
        new_pos = int(new_pos)
    except (TypeError, ValueError):
        return simple_error_response("positions must be integers.")

    queue = get_user_queue_from_cache(request.user.id)
    if not (0 <= old_pos < len(queue)) or not (0 <= new_pos < len(queue)):
        return simple_error_response("Invalid positions.")

    track_id = queue.pop(old_pos)
    queue.insert(new_pos, track_id)
    set_user_queue_in_cache(request.user.id, queue)

    state = get_user_playback_state_from_cache(request.user.id)
    state["shuffled_order"] = []
    if state["current_index"] == old_pos:
        state["current_index"] = new_pos
    set_user_playback_state_in_cache(request.user.id, state)

    return success_response("Queue reordered", None)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def play_next(request):
    track_id = advance_playback(request.user.id, direction=1)
    if track_id is None:
        return success_response("Playback reached the end of queue", None)
    track = get_music_track(track_id, request.user)
    serializer = MusicTrackSerializer(track, context={"request": request})
    return success_response("Skipped to next track", serializer.data)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def play_previous(request):
    track_id = advance_playback(request.user.id, direction=-1)
    if track_id is None:
        return success_response("Queue is empty", None)
    track = get_music_track(track_id, request.user)
    serializer = MusicTrackSerializer(track, context={"request": request})
    return success_response("Skipped to previous track", serializer.data)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def toggle_shuffle(request):
    state = get_user_playback_state_from_cache(request.user.id)
    state["shuffle"] = not state.get("shuffle", False)
    state["shuffled_order"] = []
    set_user_playback_state_in_cache(request.user.id, state)
    return success_response("Shuffle mode toggled", {"shuffle": state["shuffle"]})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def set_repeat(request):
    mode = request.data.get("mode")
    if mode not in ("off", "track", "queue"):
        return simple_error_response("Invalid repeat mode. Use: 'off', 'track', or 'queue'.")
    state = get_user_playback_state_from_cache(request.user.id)
    state["repeat"] = mode
    set_user_playback_state_in_cache(request.user.id, state)
    return success_response("Repeat mode updated", {"repeat": mode})


@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def playback_state(request):
    state = get_user_playback_state_from_cache(request.user.id)

    if request.method == "POST":
        is_playing = request.data.get("is_playing")
        progress = request.data.get("progress_seconds")
        current_index = request.data.get("current_index")

        if is_playing is not None:
            state["is_playing"] = bool(is_playing)
        if progress is not None:
            try:
                state["progress_seconds"] = int(progress)
            except (TypeError, ValueError):
                return simple_error_response("progress_seconds must be an integer.")
        if current_index is not None:
            try:
                current_index = int(current_index)
                queue = get_user_queue_from_cache(request.user.id)
                if 0 <= current_index < len(queue):
                    state["current_index"] = current_index
            except (TypeError, ValueError):
                return simple_error_response("current_index must be an integer.")

        set_user_playback_state_in_cache(request.user.id, state)

    track_id = resolve_current_track_id(request.user.id)
    track_data = None
    if track_id:
        track = get_music_track(track_id, request.user)
        if track:
            track_data = MusicTrackSerializer(track, context={"request": request}).data

    payload = {
        "current_index": state.get("current_index", 0),
        "shuffle": state.get("shuffle", False),
        "repeat": state.get("repeat", "off"),
        "is_playing": state.get("is_playing", False),
        "progress_seconds": state.get("progress_seconds", 0),
        "current_track": track_data,
    }
    return success_response("Playback state", payload)


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


# -----------------------------------------------------------------------------
# Daily Contributions
# -----------------------------------------------------------------------------

def get_user_contrib_cache_key(user):
    # Fetch a version specific to the user, default to 1
    version = cache.get(f"user_{user.id}_contrib_cache_version", 1)
    return f"daily_contributions_{user.id}_v{version}"


def invalidate_user_contrib_cache(user):
    # Increment the version to invalidate old cache
    version = cache.get(f"user_{user.id}_contrib_cache_version", 1)
    cache.set(f"user_{user.id}_contrib_cache_version", version + 1, timeout=86400 * 30)


@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def contributions_collection(request):
    user = request.user
    if request.method == "GET":
        contributions = DailyContribution.objects.filter(user=user)
        serializer = DailyContributionSerializer(contributions, many=True)
        return success_response("Contributions fetched", serializer.data)

    elif request.method == "POST":
        serializer = DailyContributionSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save(user=user)
            invalidate_user_contrib_cache(user)
            return success_response("Contribution created", serializer.data, status.HTTP_201_CREATED)
        return error_response(serializer.errors, status.HTTP_400_BAD_REQUEST)


@api_view(["GET", "PUT", "PATCH", "DELETE"])
@permission_classes([IsAuthenticated])
def contribution_detail(request, pk):
    user = request.user
    try:
        contribution = DailyContribution.objects.get(pk=pk, user=user)
    except DailyContribution.DoesNotExist:
        return error_response("Contribution not found", status.HTTP_404_NOT_FOUND)

    if request.method == "GET":
        serializer = DailyContributionSerializer(contribution)
        return success_response("Contribution fetched", serializer.data)

    elif request.method in ["PUT", "PATCH"]:
        partial = request.method == "PATCH"
        serializer = DailyContributionSerializer(contribution, data=request.data, partial=partial)
        if serializer.is_valid():
            serializer.save()
            invalidate_user_contrib_cache(user)
            return success_response("Contribution updated", serializer.data)
        return error_response(serializer.errors, status.HTTP_400_BAD_REQUEST)

    elif request.method == "DELETE":
        contribution.delete()
        invalidate_user_contrib_cache(user)
        return success_response("Contribution deleted", None)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def mark_contribution_complete(request, pk):
    user = request.user
    try:
        contribution = DailyContribution.objects.get(pk=pk, user=user)
    except DailyContribution.DoesNotExist:
        return error_response("Contribution not found", status.HTTP_404_NOT_FOUND)

    contribution.mark_completed()
    invalidate_user_contrib_cache(user)
    serializer = DailyContributionSerializer(contribution)
    return success_response("Contribution marked complete", serializer.data)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def mark_contribution_uncomplete(request, pk):
    user = request.user
    try:
        contribution = DailyContribution.objects.get(pk=pk, user=user)
    except DailyContribution.DoesNotExist:
        return error_response("Contribution not found", status.HTTP_404_NOT_FOUND)

    contribution.mark_uncompleted()
    invalidate_user_contrib_cache(user)
    serializer = DailyContributionSerializer(contribution)
    return success_response("Contribution marked uncomplete", serializer.data)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def get_daily_contributions(request):
    user = request.user
    date_str = request.query_params.get("date")
    if date_str:
        try:
            target_date = timezone.datetime.strptime(date_str, "%Y-%m-%d").date()
        except ValueError:
            return error_response("Invalid date format, use YYYY-MM-DD", status.HTTP_400_BAD_REQUEST)
    else:
        target_date = timezone.localdate()

    contributions = DailyContribution.objects.filter(user=user, scheduled_date=target_date)
    serializer = DailyContributionSerializer(contributions, many=True)
    
    total = contributions.count()
    completed = contributions.filter(completed=True).count()
    completion_rate = round((completed / total * 100), 2) if total > 0 else 0

    return success_response(
        "Daily contributions fetched",
        {
            "date": target_date.strftime("%Y-%m-%d"),
            "total": total,
            "completed": completed,
            "completion_rate": completion_rate,
            "contributions": serializer.data,
        }
    )


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def get_monthly_contributions(request):
    user = request.user
    year = request.query_params.get("year")
    month = request.query_params.get("month")

    if not year or not month:
        now = timezone.localdate()
        year = now.year
        month = now.month

    try:
        year = int(year)
        month = int(month)
    except ValueError:
        return error_response("Invalid year or month", status.HTTP_400_BAD_REQUEST)

    contributions = DailyContribution.objects.filter(
        user=user,
        scheduled_date__year=year,
        scheduled_date__month=month
    )
    serializer = DailyContributionSerializer(contributions, many=True)
    return success_response("Monthly contributions fetched", serializer.data)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def get_contribution_heatmap(request):
    user = request.user
    days = int(request.query_params.get("days", 30))
    
    cache_key = f"{get_user_contrib_cache_key(user)}_heatmap_{days}"
    cached_data = cache.get(cache_key)
    if cached_data is not None:
        return success_response("Heatmap fetched (cached)", cached_data)

    end_date = timezone.localdate()
    start_date = end_date - timedelta(days=days - 1)

    contributions = DailyContribution.objects.filter(
        user=user,
        scheduled_date__gte=start_date,
        scheduled_date__lte=end_date,
        completed=True
    ).values("scheduled_date").annotate(
        count=Count("id")
    ).order_by("scheduled_date")

    heatmap_data = {
        item["scheduled_date"].strftime("%Y-%m-%d"): item["count"]
        for item in contributions
    }

    cache.set(cache_key, heatmap_data, timeout=3600)
    return success_response("Heatmap fetched", heatmap_data)


def calculate_contribution_streaks(user):
    contributions = DailyContribution.objects.filter(
        user=user, completed=True
    ).values_list("scheduled_date", flat=True).distinct().order_by("-scheduled_date")

    if not contributions:
        return {"current_streak": 0, "longest_streak": 0}

    dates = list(contributions)
    today = timezone.localdate()
    yesterday = today - timedelta(days=1)

    current_streak = 0
    longest_streak = 0
    temp_streak = 1

    # Calculate current streak
    if dates[0] == today or dates[0] == yesterday:
        current_streak = 1
        for i in range(1, len(dates)):
            if (dates[i-1] - dates[i]).days == 1:
                current_streak += 1
            else:
                break
    
    # Calculate longest streak
    if len(dates) > 0:
        longest_streak = 1
        temp_streak = 1
        for i in range(1, len(dates)):
            if (dates[i-1] - dates[i]).days == 1:
                temp_streak += 1
                longest_streak = max(longest_streak, temp_streak)
            else:
                temp_streak = 1

    return {
        "current_streak": current_streak,
        "longest_streak": max(longest_streak, current_streak)
    }


def calculate_best_weekday(user):
    contributions = DailyContribution.objects.filter(user=user, completed=True).values_list("scheduled_date", flat=True)
    if not contributions:
        return None
    counts = {}
    for d in contributions:
        wd = d.strftime("%A")
        counts[wd] = counts.get(wd, 0) + 1
    
    if not counts:
        return None
    return max(counts, key=counts.get)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def get_contribution_analytics(request):
    user = request.user
    cache_key = f"{get_user_contrib_cache_key(user)}_analytics"
    cached_data = cache.get(cache_key)
    if cached_data is not None:
        return success_response("Analytics fetched (cached)", cached_data)

    total_contributions = DailyContribution.objects.filter(user=user).count()
    completed_contributions = DailyContribution.objects.filter(user=user, completed=True)
    completed_count = completed_contributions.count()
    
    completion_rate = round((completed_count / total_contributions * 100), 2) if total_contributions > 0 else 0

    points = sum(c.points for c in completed_contributions)
    
    streaks = calculate_contribution_streaks(user)
    best_weekday = calculate_best_weekday(user)

    data = {
        "total": total_contributions,
        "completed": completed_count,
        "completion_rate": completion_rate,
        "total_points": points,
        "current_streak": streaks["current_streak"],
        "longest_streak": streaks["longest_streak"],
        "best_weekday": best_weekday,
    }

    cache.set(cache_key, data, timeout=3600)
    return success_response("Analytics fetched", data)
