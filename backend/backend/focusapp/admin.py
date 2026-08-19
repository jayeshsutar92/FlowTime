from django.contrib import admin
from django.contrib.auth import get_user_model
from .models import Session, Preset, DailyContribution
from .views import invalidate_user_stats_cache

admin.site.register(Session)
admin.site.register(Preset)

@admin.register(DailyContribution)
class DailyContributionAdmin(admin.ModelAdmin):
    list_display = ("title", "user", "scheduled_date", "weight", "completed")
    list_filter = ("completed", "weight", "scheduled_date")
    search_fields = ("title", "user__username", "user__email", "notes")
    
    def save_model(self, request, obj, form, change):
        super().save_model(request, obj, form, change)
        invalidate_user_stats_cache(obj.user)

    def delete_model(self, request, obj):
        user = obj.user
        super().delete_model(request, obj)
        invalidate_user_stats_cache(user)

    def delete_queryset(self, request, queryset):
        users = set(queryset.values_list("user", flat=True))
        super().delete_queryset(request, queryset)
        User = get_user_model()
        for user in User.objects.filter(id__in=users):
            invalidate_user_stats_cache(user)