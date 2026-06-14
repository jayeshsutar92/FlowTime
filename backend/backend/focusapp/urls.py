from django.urls import path
from . import views

urlpatterns = [
    path('csrf/', views.csrf_cookie),
    path('signup/', views.signup),
    path('login/', views.login_user),
    path('forgot-password/', views.forgot_password),
    path('reset-password/', views.reset_password),
    path('start-session/', views.start_session),
    path('pause-session/', views.pause_session),
    path('resume-session/', views.resume_session),
    path('end-session/', views.end_session),
    path('sessions/', views.get_sessions),
    path('stats/', views.get_stats),
    path('insights/', views.get_insights),
    path('productivity-score/', views.get_productivity_score),
    path('heatmap/', views.get_heatmap),
    path('save-preset/', views.save_preset),
    path('presets/', views.presets_collection),
    path('presets/<int:id>/', views.delete_preset_by_id),
    path('delete-preset/<int:id>/', views.delete_preset),
    path('music/upload/', views.upload_music),
    path('music/tracks/', views.list_music_tracks),
    path('music/queue/', views.music_queue),
    path('music/queue/<int:id>/', views.delete_music_queue_item),
    # Admin management
    path('admin/users/', views.admin_list_users),
    path('admin/users/count/', views.admin_user_count),
    path('admin/users/<int:user_id>/', views.admin_delete_user),
]
