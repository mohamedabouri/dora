from django.urls import path
from . import views

urlpatterns = [
    path("", views.store_metrics_view, name="metrics‐store"),
    path("all/", views.get_metrics_view, name="metrics‐list"),
]
