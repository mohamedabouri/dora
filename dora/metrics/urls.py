from django.urls import path
from . import views

urlpatterns = [
    path("", views.store_metrics_view, name="metrics‐store"),
    path("all/", views.get_metrics_view, name="metrics‐list"),
    path("compare/", views.compare_metrics_view, name="compare-metrics"),
    path("projects/<int:project_id>/delete/", views.delete_project_view, name="project-delete"),
    path("delete/", views.delete_metrics_view, name="metrics-delete"),
    path("projects/<int:project_id>/export/", views.export_project_view, name="project-export"),
]
