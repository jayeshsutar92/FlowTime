from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db.models import Q
from rest_framework import serializers

from .models import MusicTrack, Preset, Session

User = get_user_model()


class SignupSerializer(serializers.Serializer):
    identifier = serializers.CharField(required=True, allow_blank=False, trim_whitespace=True)
    password = serializers.CharField(required=True, write_only=True, trim_whitespace=False)

    def validate_identifier(self, value):
        if "@" in value:
            if User.objects.filter(Q(username=value) | Q(email__iexact=value)).exists():
                raise serializers.ValidationError("A user with this identifier already exists.")
        elif User.objects.filter(username=value).exists():
            raise serializers.ValidationError("A user with this identifier already exists.")
        return value

    def validate_password(self, value):
        try:
            validate_password(value)
        except DjangoValidationError as exc:
            raise serializers.ValidationError(list(exc.messages))
        return value

    def create(self, validated_data):
        identifier = validated_data["identifier"]
        password = validated_data["password"]
        if "@" in identifier:
            username = identifier
            email = identifier
        else:
            username = identifier
            email = ""
        return User.objects.create_user(
            username=username,
            email=email,
            password=password,
        )


class LoginSerializer(serializers.Serializer):
    identifier = serializers.CharField(required=True, allow_blank=False, trim_whitespace=True)
    password = serializers.CharField(
        required=False,
        write_only=True,
        trim_whitespace=False,
        allow_blank=False,
    )
    otp = serializers.CharField(
        required=False,
        write_only=True,
        trim_whitespace=True,
        allow_blank=False,
    )

    def validate(self, attrs):
        password = attrs.get("password")
        otp = attrs.get("otp")
        if password and otp:
            raise serializers.ValidationError(
                {"non_field_errors": ["Provide either password or otp, not both."]}
            )
        if not password and not otp:
            raise serializers.ValidationError(
                {"non_field_errors": ["Either password or otp is required."]}
            )
        return attrs


class ForgotPasswordSerializer(serializers.Serializer):
    identifier = serializers.CharField(required=True, allow_blank=False, trim_whitespace=True)


class ResetPasswordSerializer(serializers.Serializer):
    identifier = serializers.CharField(required=True, allow_blank=False, trim_whitespace=True)
    otp = serializers.CharField(required=True, allow_blank=False, trim_whitespace=True)
    new_password = serializers.CharField(required=True, write_only=True, trim_whitespace=False)

    def validate_new_password(self, value):
        try:
            validate_password(value)
        except DjangoValidationError as exc:
            raise serializers.ValidationError(list(exc.messages))
        return value


class StartSessionSerializer(serializers.Serializer):
    work_duration = serializers.IntegerField(min_value=1)
    break_duration = serializers.IntegerField(min_value=1)
    total_sessions = serializers.IntegerField(min_value=1)
    current_session = serializers.IntegerField(min_value=1, default=1)

    def validate(self, attrs):
        if attrs["current_session"] > attrs["total_sessions"]:
            raise serializers.ValidationError(
                {"current_session": "current_session cannot be greater than total_sessions."}
            )
        return attrs


class StartSessionResponseSerializer(serializers.Serializer):
    session_id = serializers.IntegerField(min_value=1)
    total_sessions = serializers.IntegerField(min_value=1)
    current_session = serializers.IntegerField(min_value=1)
    status = serializers.ChoiceField(choices=[Session.STATUS_RUNNING])
    work_duration = serializers.IntegerField(min_value=1)
    started_at = serializers.DateTimeField()
    paused_seconds = serializers.IntegerField(min_value=0)
    short_break = serializers.IntegerField(min_value=0)
    break_type = serializers.ChoiceField(choices=["short", "long"])
    break_duration = serializers.IntegerField(min_value=0)
    adjusted = serializers.BooleanField()
    adjustment_reason = serializers.CharField(required=False, allow_null=True)
    long_break = serializers.IntegerField(min_value=0, required=False)


class SessionTransitionSerializer(serializers.Serializer):
    session_id = serializers.IntegerField(min_value=1)


class SessionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Session
        fields = [
            "id",
            "work_duration",
            "break_duration",
            "completed",
            "total_sessions",
            "current_session",
            "paused_seconds",
            "paused_at",
            "status",
            "created_at",
        ]
        read_only_fields = fields


class PresetSerializer(serializers.ModelSerializer):
    work_duration = serializers.IntegerField(min_value=1)
    short_break = serializers.IntegerField(min_value=1)
    long_break = serializers.IntegerField(min_value=1)

    class Meta:
        model = Preset
        fields = ["id", "name", "work_duration", "short_break", "long_break"]
        read_only_fields = ["id"]


class PresetCreateSerializer(serializers.Serializer):
    name = serializers.CharField(required=True, allow_blank=False, trim_whitespace=True)
    work_duration = serializers.IntegerField(min_value=1)
    break_duration = serializers.IntegerField(min_value=1)
    long_break_duration = serializers.IntegerField(
        min_value=1,
        required=False,
        allow_null=True,
    )
    sessions_before_long_break = serializers.IntegerField(
        min_value=1,
        required=False,
        allow_null=True,
    )


class MusicTrackSerializer(serializers.ModelSerializer):
    class Meta:
        model = MusicTrack
        fields = ["id", "name", "file_path", "duration", "created_at"]
        read_only_fields = fields


class AdminUserSerializer(serializers.Serializer):
    id = serializers.IntegerField(read_only=True)
    username = serializers.CharField(read_only=True)
    email = serializers.EmailField(read_only=True)
    date_joined = serializers.DateTimeField(read_only=True)
    is_staff = serializers.BooleanField(read_only=True)

