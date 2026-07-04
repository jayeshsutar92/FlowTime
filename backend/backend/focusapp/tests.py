from rest_framework_simplejwt.tokens import RefreshToken
from datetime import timedelta

from django.contrib.auth import get_user_model
from django.contrib.auth.hashers import make_password
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from .models import OTPVerification, Preset, Session

User = get_user_model()


class AuthApiTests(APITestCase):
    def test_signup_creates_user_with_hashed_password_from_email_identifier(self):
        response = self.client.post(
            "/api/signup/",
            {"identifier": "user@example.com", "password": "StrongPass123!"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        user = User.objects.get(username="user@example.com")
        self.assertEqual(user.email, "user@example.com")
        self.assertTrue(user.check_password("StrongPass123!"))

    def test_signup_rejects_duplicate_identifier(self):
        User.objects.create_user(
            username="user@example.com",
            email="user@example.com",
            password="StrongPass123!",
        )

        response = self.client.post(
            "/api/signup/",
            {"identifier": "user@example.com", "password": "StrongPass123!"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data["message"], "Signup failed")
        self.assertIn("identifier", response.data["data"])

    def test_login_accepts_username_and_returns_session_token(self):
        User.objects.create_user(
            username="mostlyjay",
            email="",
            password="StrongPass123!",
        )

        response = self.client.post(
            "/api/login/",
            {"identifier": "mostlyjay", "password": "StrongPass123!"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["message"], "Login successful")
        self.assertTrue(response.data["data"]["token"])

    def test_login_accepts_email_and_returns_session_token(self):
        User.objects.create_user(
            username="user@example.com",
            email="user@example.com",
            password="StrongPass123!",
        )

        response = self.client.post(
            "/api/login/",
            {"identifier": "user@example.com", "password": "StrongPass123!"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data["data"]["token"])

    def test_login_accepts_otp_and_marks_it_used(self):
        user = User.objects.create_user(
            username="user@example.com",
            email="user@example.com",
            password="StrongPass123!",
        )
        otp_record = OTPVerification.objects.create(
            user=user,
            purpose=OTPVerification.PURPOSE_RESET,
            code=make_password("123456"),
            expires_at=timezone.now() + timedelta(minutes=5),
        )

        response = self.client.post(
            "/api/login/",
            {"identifier": "user@example.com", "otp": "123456"},
            format="json",
        )

        otp_record.refresh_from_db()
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data["data"]["token"])
        self.assertTrue(otp_record.is_used)

    def test_login_rejects_both_password_and_otp(self):
        response = self.client.post(
            "/api/login/",
            {
                "identifier": "user@example.com",
                "password": "StrongPass123!",
                "otp": "123456",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data["message"], "Login failed")
        self.assertIn("non_field_errors", response.data["data"])

    def test_login_returns_invalid_credentials_for_bad_otp(self):
        user = User.objects.create_user(
            username="user@example.com",
            email="user@example.com",
            password="StrongPass123!",
        )
        OTPVerification.objects.create(
            user=user,
            purpose=OTPVerification.PURPOSE_RESET,
            code=make_password("123456"),
            expires_at=timezone.now() + timedelta(minutes=5),
        )

        response = self.client.post(
            "/api/login/",
            {"identifier": "user@example.com", "otp": "999999"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data["error"], "Invalid credentials.")

    def test_forgot_password_always_returns_success_and_creates_reset_otp_for_user(self):
        user = User.objects.create_user(
            username="user@example.com",
            email="user@example.com",
            password="StrongPass123!",
        )

        response = self.client.post(
            "/api/forgot-password/",
            {"identifier": "user@example.com"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["message"], "If account exists, OTP sent")
        otp_record = OTPVerification.objects.get(user=user)
        self.assertEqual(otp_record.purpose, OTPVerification.PURPOSE_RESET)
        self.assertFalse(otp_record.is_used)
        self.assertNotEqual(otp_record.code, "123456")

    def test_forgot_password_returns_success_for_unknown_user(self):
        response = self.client.post(
            "/api/forgot-password/",
            {"identifier": "missing@example.com"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["message"], "If account exists, OTP sent")
        self.assertEqual(OTPVerification.objects.count(), 0)

    def test_reset_password_updates_password_and_invalidates_otp(self):
        user = User.objects.create_user(
            username="user@example.com",
            email="user@example.com",
            password="OldPass123!",
        )
        otp_record = OTPVerification.objects.create(
            user=user,
            purpose=OTPVerification.PURPOSE_RESET,
            code=make_password("123456"),
            expires_at=timezone.now() + timedelta(minutes=5),
        )

        response = self.client.post(
            "/api/reset-password/",
            {
                "identifier": "user@example.com",
                "otp": "123456",
                "new_password": "NewPass123!",
            },
            format="json",
        )

        user.refresh_from_db()
        otp_record.refresh_from_db()
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["message"], "Password reset successful")
        self.assertTrue(user.check_password("NewPass123!"))
        self.assertTrue(otp_record.is_used)

    def test_reset_password_rejects_expired_otp(self):
        user = User.objects.create_user(
            username="user@example.com",
            email="user@example.com",
            password="OldPass123!",
        )
        OTPVerification.objects.create(
            user=user,
            purpose=OTPVerification.PURPOSE_RESET,
            code=make_password("123456"),
            expires_at=timezone.now() - timedelta(minutes=1),
        )

        response = self.client.post(
            "/api/reset-password/",
            {
                "identifier": "user@example.com",
                "otp": "123456",
                "new_password": "NewPass123!",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data["message"], "Invalid or expired OTP")


class SessionApiTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="sessiontestuser",
            email="sessiontest@example.com",
            password="Password123!"
        )
        refresh = RefreshToken.for_user(self.user)
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {refresh.access_token}")

    def test_start_session_creates_running_session(self):
        response = self.client.post(
            "/api/start-session/",
            {
                "work_duration": 25,
                "break_duration": 5,
                "total_sessions": 4,
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        session = Session.objects.get()
        self.assertEqual(session.status, Session.STATUS_RUNNING)
        self.assertEqual(session.total_sessions, 4)
        self.assertEqual(session.current_session, 1)
        self.assertNotIn("session_id", response.data)
        self.assertNotIn("total_sessions", response.data)
        self.assertNotIn("current_session", response.data)
        self.assertNotIn("short_break", response.data)
        self.assertNotIn("long_break", response.data)
        self.assertNotIn("break_type", response.data)
        self.assertNotIn("break_duration", response.data)
        self.assertEqual(response.data["data"]["short_break"], 5)
        self.assertNotIn("long_break", response.data["data"])
        self.assertEqual(response.data["data"]["break_type"], "short")
        self.assertEqual(response.data["data"]["break_duration"], 5)
        self.assertEqual(response.data["data"]["session_id"], session.id)
        self.assertEqual(response.data["data"]["total_sessions"], 4)
        self.assertEqual(response.data["data"]["current_session"], 1)
        self.assertFalse(response.data["data"]["adjusted"])
        self.assertEqual(response.data["data"]["status"], Session.STATUS_RUNNING)
        self.assertIsInstance(response.data["data"]["session_id"], int)
        self.assertIsInstance(response.data["data"]["total_sessions"], int)
        self.assertIsInstance(response.data["data"]["current_session"], int)
        self.assertIsInstance(response.data["data"]["status"], str)
        self.assertIsInstance(response.data["data"]["break_type"], str)
        self.assertIsInstance(response.data["data"]["break_duration"], int)

    def test_start_session_response_contains_required_non_null_fields(self):
        response = self.client.post(
            "/api/start-session/",
            {
                "work_duration": 25,
                "break_duration": 5,
                "total_sessions": 4,
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        data = response.data["data"]
        self.assertIsNotNone(data["session_id"])
        self.assertIsNotNone(data["total_sessions"])
        self.assertIsNotNone(data["current_session"])
        self.assertIsNotNone(data["status"])
        self.assertIsNotNone(data["break_type"])
        self.assertIsNotNone(data["break_duration"])
        self.assertGreater(data["total_sessions"], 0)
        self.assertGreaterEqual(data["current_session"], 1)
        self.assertGreaterEqual(data["break_duration"], 0)
        self.assertEqual(data["status"], Session.STATUS_RUNNING)

    def test_start_session_returns_long_break_on_fourth_cycle(self):
        response = self.client.post(
            "/api/start-session/",
            {
                "work_duration": 50,
                "break_duration": 10,
                "total_sessions": 8,
                "current_session": 4,
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["data"]["short_break"], 10)
        self.assertEqual(response.data["data"]["long_break"], 15)
        self.assertEqual(response.data["data"]["break_type"], "long")
        self.assertEqual(response.data["data"]["break_duration"], 15)

    def test_start_session_does_not_return_long_break_when_total_sessions_is_less_than_five(self):
        response = self.client.post(
            "/api/start-session/",
            {
                "work_duration": 50,
                "break_duration": 10,
                "total_sessions": 4,
                "current_session": 4,
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["data"]["break_type"], "short")
        self.assertNotIn("long_break", response.data["data"])

    def test_start_session_does_not_return_long_break_for_last_session(self):
        response = self.client.post(
            "/api/start-session/",
            {
                "work_duration": 50,
                "break_duration": 10,
                "total_sessions": 8,
                "current_session": 8,
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["data"]["break_type"], "short")
        self.assertNotIn("long_break", response.data["data"])

    def test_start_session_uses_higher_adaptive_short_break_for_low_completion_rate(self):
        for _ in range(6):
            Session.objects.create(user=self.user, 
                work_duration=25,
                break_duration=5,
                total_sessions=4,
                current_session=1,
                status=Session.STATUS_PAUSED,
            )
        for _ in range(4):
            Session.objects.create(user=self.user, 
                work_duration=25,
                break_duration=5,
                total_sessions=4,
                current_session=1,
                status=Session.STATUS_COMPLETED,
            )

        response = self.client.post(
            "/api/start-session/",
            {
                "work_duration": 45,
                "break_duration": 5,
                "total_sessions": 4,
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["data"]["short_break"], 11)
        self.assertEqual(response.data["data"]["break_duration"], 11)

    def test_start_session_clamps_break_duration_to_non_negative_value(self):
        response = self.client.post(
            "/api/start-session/",
            {
                "work_duration": 1,
                "break_duration": 1,
                "total_sessions": 4,
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertGreaterEqual(response.data["data"]["break_duration"], 0)
        self.assertGreaterEqual(response.data["data"]["short_break"], 0)

    def test_start_session_reduces_workload_when_recent_completion_rate_is_low(self):
        for _ in range(4):
            Session.objects.create(user=self.user, 
                work_duration=30,
                break_duration=5,
                total_sessions=4,
                current_session=1,
                status=Session.STATUS_PAUSED,
            )
        Session.objects.create(user=self.user, 
            work_duration=30,
            break_duration=5,
            total_sessions=4,
            current_session=1,
            status=Session.STATUS_COMPLETED,
        )

        response = self.client.post(
            "/api/start-session/",
            {
                "work_duration": 50,
                "break_duration": 10,
                "total_sessions": 4,
            },
            format="json",
        )

        session = Session.objects.latest("id")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(session.work_duration, 40)
        self.assertEqual(session.break_duration, 12)
        self.assertTrue(response.data["data"]["adjusted"])
        self.assertIn("focus time was reduced", response.data["data"]["adjustment_reason"])

    def test_start_session_increases_workload_slightly_when_recent_completion_rate_is_high(self):
        for _ in range(5):
            Session.objects.create(user=self.user, 
                work_duration=30,
                break_duration=10,
                total_sessions=4,
                current_session=1,
                status=Session.STATUS_COMPLETED,
            )

        response = self.client.post(
            "/api/start-session/",
            {
                "work_duration": 50,
                "break_duration": 10,
                "total_sessions": 4,
            },
            format="json",
        )

        session = Session.objects.latest("id")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(session.work_duration, 55)
        self.assertEqual(session.break_duration, 9)
        self.assertTrue(response.data["data"]["adjusted"])
        self.assertIn("focus time was increased", response.data["data"]["adjustment_reason"])

    def test_start_session_keeps_original_values_when_recent_completion_rate_is_balanced(self):
        for _ in range(2):
            Session.objects.create(user=self.user, 
                work_duration=35,
                break_duration=7,
                total_sessions=4,
                current_session=1,
                status=Session.STATUS_COMPLETED,
            )
        for _ in range(2):
            Session.objects.create(user=self.user, 
                work_duration=35,
                break_duration=7,
                total_sessions=4,
                current_session=1,
                status=Session.STATUS_PAUSED,
            )

        response = self.client.post(
            "/api/start-session/",
            {
                "work_duration": 45,
                "break_duration": 8,
                "total_sessions": 4,
            },
            format="json",
        )

        session = Session.objects.latest("id")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(session.work_duration, 45)
        self.assertEqual(session.break_duration, 8)
        self.assertFalse(response.data["data"]["adjusted"])
        self.assertIsNone(response.data["data"]["adjustment_reason"])

    def test_start_session_does_not_mark_adjusted_when_values_round_back_to_original(self):
        for _ in range(5):
            Session.objects.create(user=self.user, 
                work_duration=25,
                break_duration=1,
                total_sessions=4,
                current_session=1,
                status=Session.STATUS_COMPLETED,
            )

        response = self.client.post(
            "/api/start-session/",
            {
                "work_duration": 1,
                "break_duration": 1,
                "total_sessions": 4,
            },
            format="json",
        )

        session = Session.objects.latest("id")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(session.work_duration, 1)
        self.assertEqual(session.break_duration, 1)
        self.assertFalse(response.data["data"]["adjusted"])
        self.assertIsNone(response.data["data"]["adjustment_reason"])

    def test_start_session_auto_completes_existing_running_session(self):
        stale_session = Session.objects.create(user=self.user, 
            work_duration=25,
            break_duration=5,
            total_sessions=4,
            current_session=1,
            status=Session.STATUS_RUNNING,
        )

        response = self.client.post(
            "/api/start-session/",
            {
                "work_duration": 50,
                "break_duration": 10,
                "total_sessions": 4,
            },
            format="json",
        )

        stale_session.refresh_from_db()
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(stale_session.status, Session.STATUS_COMPLETED)
        self.assertEqual(Session.objects.count(), 2)
        self.assertEqual(Session.objects.filter(status=Session.STATUS_RUNNING).count(), 1)

    def test_start_session_allows_new_session_after_completed_session(self):
        Session.objects.create(user=self.user, 
            work_duration=25,
            break_duration=5,
            total_sessions=4,
            current_session=1,
            status=Session.STATUS_COMPLETED,
        )

        response = self.client.post(
            "/api/start-session/",
            {
                "work_duration": 50,
                "break_duration": 10,
                "total_sessions": 4,
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Session.objects.filter(status=Session.STATUS_RUNNING).count(), 1)

    def test_pause_session_changes_running_session_to_paused(self):
        session = Session.objects.create(user=self.user, 
            work_duration=25,
            break_duration=5,
            total_sessions=4,
            current_session=1,
            status=Session.STATUS_RUNNING,
        )

        response = self.client.post(
            "/api/pause-session/",
            {"session_id": session.id},
            format="json",
        )

        session.refresh_from_db()
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(session.status, Session.STATUS_PAUSED)

    def test_start_session_requires_total_sessions(self):
        response = self.client.post(
            "/api/start-session/",
            {"work_duration": 25, "break_duration": 5},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data["error"], "Invalid start session payload.")
        self.assertIn("total_sessions", response.data["details"])

    def test_end_session_requires_running_session(self):
        session = Session.objects.create(user=self.user, 
            work_duration=25,
            break_duration=5,
            total_sessions=4,
            current_session=1,
            status=Session.STATUS_PAUSED,
        )

        response = self.client.post(
            "/api/end-session/",
            {"session_id": session.id},
            format="json",
        )

        session.refresh_from_db()
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(session.status, Session.STATUS_PAUSED)
        self.assertEqual(response.data["error"], "Only running sessions can be completed.")

    def test_end_session_marks_running_session_completed(self):
        session = Session.objects.create(user=self.user, 
            work_duration=25,
            break_duration=5,
            total_sessions=4,
            current_session=1,
            status=Session.STATUS_RUNNING,
        )

        response = self.client.post(
            "/api/end-session/",
            {"session_id": session.id},
            format="json",
        )

        session.refresh_from_db()
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(session.status, Session.STATUS_COMPLETED)
        self.assertEqual(response.data["data"]["status"], Session.STATUS_COMPLETED)

    def test_get_sessions_returns_latest_first(self):
        older = Session.objects.create(user=self.user, 
            work_duration=25,
            break_duration=5,
            total_sessions=4,
            current_session=1,
            status=Session.STATUS_RUNNING,
        )
        newer = Session.objects.create(user=self.user, 
            work_duration=50,
            break_duration=10,
            total_sessions=4,
            current_session=2,
            status=Session.STATUS_COMPLETED,
        )
        Session.objects.filter(id=older.id).update(created_at=timezone.now() - timedelta(days=2))
        Session.objects.filter(id=newer.id).update(created_at=timezone.now())

        response = self.client.get("/api/sessions/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["data"][0]["id"], newer.id)
        self.assertEqual(response.data["data"][0]["status"], Session.STATUS_COMPLETED)

    def test_stats_only_counts_completed_sessions(self):
        Session.objects.create(user=self.user, 
            work_duration=25,
            break_duration=5,
            total_sessions=4,
            current_session=1,
            status=Session.STATUS_COMPLETED,
        )
        Session.objects.create(user=self.user, 
            work_duration=50,
            break_duration=10,
            total_sessions=4,
            current_session=2,
            status=Session.STATUS_COMPLETED,
        )
        Session.objects.create(user=self.user, 
            work_duration=15,
            break_duration=3,
            total_sessions=4,
            current_session=1,
            status=Session.STATUS_PAUSED,
        )

        response = self.client.get("/api/stats/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["data"]["total_focus_time"], 75)
        self.assertEqual(response.data["data"]["total_sessions"], 2)
        self.assertEqual(response.data["data"]["average_session_time"], 37.5)

    def test_get_insights_returns_aggregated_focus_metrics(self):
        morning = Session.objects.create(user=self.user, 
            work_duration=20,
            break_duration=5,
            total_sessions=4,
            current_session=1,
            status=Session.STATUS_COMPLETED,
        )
        afternoon = Session.objects.create(user=self.user, 
            work_duration=40,
            break_duration=5,
            total_sessions=4,
            current_session=2,
            status=Session.STATUS_COMPLETED,
        )
        Session.objects.create(user=self.user, 
            work_duration=15,
            break_duration=5,
            total_sessions=4,
            current_session=3,
            status=Session.STATUS_PAUSED,
        )
        Session.objects.filter(id=morning.id).update(created_at=timezone.now().replace(hour=9))
        Session.objects.filter(id=afternoon.id).update(created_at=timezone.now().replace(hour=9))

        response = self.client.get("/api/insights/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["message"], "Insights fetched")
        self.assertEqual(response.data["data"]["avg_session_length"], 30)
        self.assertAlmostEqual(response.data["data"]["completion_rate"], 2 / 3)
        self.assertEqual(response.data["data"]["best_focus_time"], "9 AM - 10 AM")
        self.assertEqual(response.data["data"]["recommendation"], "Maintain current routine")

    def test_get_productivity_score_returns_safe_score_and_level(self):
        Session.objects.create(user=self.user, 
            work_duration=60,
            break_duration=5,
            total_sessions=4,
            current_session=1,
            status=Session.STATUS_PAUSED,
        )
        first = Session.objects.create(user=self.user, 
            work_duration=50,
            break_duration=5,
            total_sessions=4,
            current_session=2,
            status=Session.STATUS_COMPLETED,
        )
        second = Session.objects.create(user=self.user, 
            work_duration=40,
            break_duration=5,
            total_sessions=4,
            current_session=3,
            status=Session.STATUS_COMPLETED,
        )
        Session.objects.filter(id=first.id).update(created_at=timezone.now() - timedelta(days=1))
        Session.objects.filter(id=second.id).update(created_at=timezone.now())

        response = self.client.get("/api/productivity-score/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["message"], "Score fetched")
        self.assertEqual(response.data["data"]["score"], 57)
        self.assertEqual(response.data["data"]["level"], "Moderate")

    def test_get_productivity_score_returns_no_data_when_empty(self):
        response = self.client.get("/api/productivity-score/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["data"]["score"], 0)
        self.assertEqual(response.data["data"]["level"], "No data")

    def test_get_heatmap_returns_last_seven_days_oldest_to_newest(self):
        five_days_ago = Session.objects.create(user=self.user, 
            work_duration=25,
            break_duration=5,
            total_sessions=4,
            current_session=1,
            status=Session.STATUS_COMPLETED,
        )
        today_one = Session.objects.create(user=self.user, 
            work_duration=30,
            break_duration=5,
            total_sessions=4,
            current_session=2,
            status=Session.STATUS_COMPLETED,
        )
        today_two = Session.objects.create(user=self.user, 
            work_duration=35,
            break_duration=5,
            total_sessions=4,
            current_session=3,
            status=Session.STATUS_PAUSED,
        )
        Session.objects.filter(id=five_days_ago.id).update(
            created_at=timezone.now() - timedelta(days=5)
        )
        Session.objects.filter(id=today_one.id).update(created_at=timezone.now())
        Session.objects.filter(id=today_two.id).update(created_at=timezone.now())

        response = self.client.get("/api/heatmap/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["message"], "Heatmap fetched")
        self.assertEqual(response.data["data"]["last_7_days"], [0, 1, 0, 0, 0, 0, 2])

    def test_get_heatmap_returns_zeros_when_empty(self):
        response = self.client.get("/api/heatmap/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["data"]["last_7_days"], [0, 0, 0, 0, 0, 0, 0])


class PresetApiTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="presettestuser",
            email="presettest@example.com",
            password="Password123!"
        )
        refresh = RefreshToken.for_user(self.user)
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {refresh.access_token}")

    def test_save_preset_creates_preset(self):
        response = self.client.post(
            "/api/save-preset/",
            {
                "name": "Deep Work",
                "work_duration": 50,
                "short_break": 10,
                "long_break": 20,
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Preset.objects.count(), 1)

    def test_get_presets_returns_all_saved_presets_latest_first(self):
        older = Preset.objects.create(user=self.user, 
            name="Study Session",
            work_duration=45,
            short_break=10,
            long_break=20,
        )
        newer = Preset.objects.create(user=self.user, 
            name="Quick Focus",
            work_duration=25,
            short_break=5,
            long_break=15,
        )

        response = self.client.get("/api/presets/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["message"], "Presets fetched")
        self.assertEqual(len(response.data["data"]), 2)
        self.assertEqual(response.data["data"][0]["id"], newer.id)
        self.assertEqual(response.data["data"][1]["id"], older.id)
        self.assertEqual(response.data["data"][0]["name"], "Quick Focus")

    def test_delete_preset_returns_404_for_missing_preset(self):
        response = self.client.delete("/api/delete-preset/999/")

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        self.assertEqual(response.data["error"], "Preset not found")


class DataIsolationAndJwtTests(APITestCase):
    def setUp(self):
        self.user_a = User.objects.create_user(
            username="usera",
            email="usera@example.com",
            password="Password123!"
        )
        self.user_b = User.objects.create_user(
            username="userb",
            email="userb@example.com",
            password="Password123!"
        )

    def test_protected_endpoints_require_authentication(self):
        # Accessing session list without login
        response = self.client.get("/api/sessions/")
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_data_isolation_between_users(self):
        # Create session and preset for User A
        Session.objects.create(
            user=self.user_a,
            work_duration=25,
            break_duration=5,
            total_sessions=4,
            current_session=1
        )
        Preset.objects.create(
            user=self.user_a,
            name="UserA Preset",
            work_duration=25,
            short_break=5,
            long_break=15
        )

        # Authenticate as User B
        refresh = RefreshToken.for_user(self.user_b)
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {refresh.access_token}")

        # User B should not see User A's session
        response = self.client.get("/api/sessions/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data["data"]), 0)

        # User B should not see User A's preset
        response = self.client.get("/api/presets/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data["data"]), 0)

