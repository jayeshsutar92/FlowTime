from django.urls import path
from . import views

urlpatterns = [
    path('signup/', views.signup),
    path('login/', views.login_user),
    path('forgot-password/', views.forgot_password),
    path('reset-password/', views.reset_password),
    path('start-session/', views.start_session),
    path('pause-session/', views.pause_session),
    path('end-session/', views.end_session),
    path('sessions/', views.get_sessions),
    path('stats/', views.get_stats),
    path('insights/', views.get_insights),
    path('productivity-score/', views.get_productivity_score),
    path('heatmap/', views.get_heatmap),
    path('save-preset/', views.save_preset),
    path('presets/', views.get_presets),
    path('delete-preset/<int:id>/', views.delete_preset),
]
