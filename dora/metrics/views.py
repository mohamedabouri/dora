from django.http import JsonResponse
from django.views.decorators.http import require_POST, require_GET
from .services.github_service import GitHubService
from .services.metric_service import calculate_mean_and_variance
from .models import Project, Metric
import json
from django.views.decorators.csrf import ensure_csrf_cookie
from django.db.models import Q
from datetime import timezone
from dateutil import parser
from django.views.decorators.http import require_http_methods
from django.utils.dateparse import parse_datetime
from django.shortcuts import get_object_or_404
import csv
from django.http import HttpResponse


@require_POST
def store_metrics_view(request):
    try:
        payload = json.loads(request.body)
        owner = payload["owner"]
        repo = payload["repository"]
        since_day = payload["since_day"]
        until_day = payload["until_day"]
        bug_label = payload["bug_label"]
    except (KeyError, json.JSONDecodeError):
        return JsonResponse({"error": "Invalid JSON or missing required fields."}, status=400)

    svc = GitHubService()

    df_list = svc.get_github_deployment_frequency(owner, repo, since_day, until_day)
    df_mean, df_std = calculate_mean_and_variance(df_list)

    lt_list = svc.get_github_lead_time_for_changes(owner, repo, since_day, until_day, bug_label)
    lt_mean, lt_std = calculate_mean_and_variance(lt_list)

    tr_list = svc.get_github_time_to_restore_service(owner, repo, since_day, until_day, bug_label)
    tr_mean, tr_std = calculate_mean_and_variance(tr_list)

    cf_ratio = svc.get_github_change_failure_rate(owner, repo, since_day, until_day, bug_label)
    cf_pct = cf_ratio * 100

    project, created = Project.objects.get_or_create(
        owner=owner,
        repository=repo,
        defaults={"name": f"{owner}/{repo}"}
    )

    since_dt = svc._parse_date(since_day)
    until_dt = svc._parse_date(until_day)

    Metric.objects.create(
        project=project,
        metric_type="release_frequency",
        value=df_mean,
        variance=df_std,
        since=since_dt,
        until=until_dt
    )
    Metric.objects.create(
        project=project,
        metric_type="lead_time_for_released_changes",
        value=lt_mean,
        variance=lt_std,
        since=since_dt,
        until=until_dt
    )
    Metric.objects.create(
        project=project,
        metric_type="time_to_repair_code",
        value=tr_mean,
        variance=tr_std,
        since=since_dt,
        until=until_dt
    )
    Metric.objects.create(
        project=project,
        metric_type="bug_issues_rate",
        value=cf_pct,
        variance=None,
        since=since_dt,
        until=until_dt
    )

    return JsonResponse({
        "release_frecuency": {"mean_days": df_mean, "std_dev_days": df_std},
        "lead_time_for_released_changes": {"mean_days": lt_mean, "std_dev_days": lt_std},
        "time_to_repair_code": {"mean_days": tr_mean, "std_dev_days": tr_std},
        "bug_issues_rate": cf_pct,
    })


@ensure_csrf_cookie
@require_GET
def get_metrics_view(request):
    # 1. Filter Projects by "projects" parameter if provided
    proj_list = request.GET.get("projects", "")
    if proj_list:
        identifiers = [p.strip() for p in proj_list.split(",") if p.strip()]
        queries = Q()
        for ident in identifiers:
            try:
                owner, repo = ident.split("/", 1)
            except ValueError:
                return JsonResponse(
                    {"error": f"Invalid format for project '{ident}'. Use owner/repo."},
                    status=400
                )
            queries |= Q(owner=owner, repository=repo)
        projects_qs = Project.objects.filter(queries)
    else:
        projects_qs = Project.objects.all()

    # 2. Parse metric_types filter
    metric_types_param = request.GET.get("metric_types", "")
    metric_types = [mt.strip() for mt in metric_types_param.split(",") if mt.strip()] if metric_types_param else []

    # 3. Parse date-range filters
    since_str = request.GET.get("since", "")
    until_str = request.GET.get("until", "")
    since_dt = None
    until_dt = None

    if since_str:
        try:
            since_dt = parser.isoparse(since_str).astimezone(timezone.utc)
        except ValueError:
            return JsonResponse({"error": "Invalid 'since' datetime format. Use YYYY-MM-DDThh:mm:ss+00:00 or YYYY-MM-DDThh:mm:ss.SSS+00:00."}, status=400)

    if until_str:
        try:
            until_dt = parser.isoparse(until_str).astimezone(timezone.utc)
        except ValueError:
            return JsonResponse({"error": "Invalid 'until' datetime format. Use YYYY-MM-DDThh:mm:ss+00:00 or YYYY-MM-DDThh:mm:ss.SSS+00:00."}, status=400)

    response_projects = []

    for project in projects_qs:
        qs = Metric.objects.filter(project=project)

        if metric_types:
            qs = qs.filter(metric_type__in=metric_types)

        if since_dt:
            qs = qs.filter(since__gte=since_dt)

        if until_dt:
            qs = qs.filter(until__lte=until_dt)

        qs = qs.order_by("-since", "-metric_type")

        metrics_list = []
        for m in qs:
            metrics_list.append({
                "id": m.id,
                "metric_type": m.metric_type,
                "value": m.value,
                "variance": m.variance,
                "since": m.since.isoformat() if m.since else None,
                "until": m.until.isoformat() if m.until else None,
            })

        response_projects.append({
            "id": project.id,
            "owner": project.owner,
            "repository": project.repository,
            "metrics": metrics_list,
        })

    return JsonResponse({"projects": response_projects})


@require_GET
def compare_metrics_view(request):
    proj_list = request.GET.get("projects", "")
    if not proj_list:
        return JsonResponse({"error": "Missing 'projects' query parameter."}, status=400)

    identifiers = [p.strip() for p in proj_list.split(",") if p.strip()]
    if not identifiers:
        return JsonResponse({"error": "No valid project identifiers found."}, status=400)

    queries = Q()
    for ident in identifiers:
        try:
            owner, repo = ident.split("/", 1)
        except ValueError:
            return JsonResponse({"error": f"Invalid format for project '{ident}'. Use owner/repo."}, status=400)
        queries |= Q(owner=owner, repository=repo)

    projects = Project.objects.filter(queries)
    if not projects.exists():
        return JsonResponse({"error": "No matching projects in database."}, status=404)

    response = []
    
    since_str = request.GET.get("since", "")
    until_str = request.GET.get("until", "")
    since_dt = None
    until_dt = None

    if since_str:
        try:
            since_dt = parser.isoparse(since_str).astimezone(timezone.utc)
        except ValueError:
            return JsonResponse({"error": "Invalid 'since' datetime format. Use YYYY-MM-DDThh:mm:ss+00:00 or YYYY-MM-DDThh:mm:ss.SSS+00:00."}, status=400)

    if until_str:
        try:
            until_dt = parser.isoparse(until_str).astimezone(timezone.utc)
        except ValueError:
            return JsonResponse({"error": "Invalid 'until' datetime format. Use YYYY-MM-DDThh:mm:ss+00:00 or YYYY-MM-DDThh:mm:ss.SSS+00:00."}, status=400)

    for project in projects:
        qs = Metric.objects.filter(project=project)
        
        if since_dt:
            qs = qs.filter(since__gte=since_dt)
        
        if until_dt:
            qs = qs.filter(until__lte=until_dt)
            
        qs = qs.order_by("since", "metric_type")
        metrics_by_type = {}
        for m in qs:
            metrics_by_type.setdefault(m.metric_type, []).append({
                "since": m.since.isoformat() if m.since else None,
                "until": m.until.isoformat() if m.until else None,
                "value": m.value,
                "variance": m.variance,
            })
        response.append({
            "owner": project.owner,
            "repository": project.repository,
            "metrics": metrics_by_type
        })

    return JsonResponse({"projects": response})


@ensure_csrf_cookie
@require_http_methods(["DELETE"])
def delete_project_view(request, project_id):
    """
    DELETE /projects/<project_id>/delete/
    Removes the project and all its metrics.
    """
    project = get_object_or_404(Project, pk=project_id)
    project.delete()
    return JsonResponse(
        {"message": f"Project {project.owner}/{project.repository} deleted."},
        status=204
    )


@ensure_csrf_cookie
@require_http_methods(["DELETE"])
def delete_metrics_view(request):
    """
    DELETE /metrics/delete/?projects=owner1/repo1,owner2/repo2
                             &since=YYYY-MM-DDThh:mm:ssZ
                             &until=YYYY-MM-DDThh:mm:ssZ

    Deletes Metric rows matching the filters.
    """
    proj_list = request.GET.get("projects", "")
    if proj_list:
        identifiers = [p.strip() for p in proj_list.split(",") if p.strip()]
        queries = Q()
        for ident in identifiers:
            try:
                owner, repo = ident.split("/", 1)
            except ValueError:
                return JsonResponse(
                    {"error": f"Invalid project format '{ident}'. Use owner/repo."},
                    status=400,
                )
            queries |= Q(project__owner=owner, project__repository=repo)
        metrics_qs = Metric.objects.filter(queries)
    else:
        metrics_qs = Metric.objects.all()

    since_str = request.GET.get("since")
    until_str = request.GET.get("until")

    if since_str:
        since_dt = parse_datetime(since_str)
        if not since_dt:
            return JsonResponse(
                {"error": "Invalid 'since' format. Use ISO 8601 datetime."},
                status=400,
            )
        metrics_qs = metrics_qs.filter(since__gte=since_dt)

    if until_str:
        until_dt = parse_datetime(until_str)
        if not until_dt:
            return JsonResponse(
                {"error": "Invalid 'until' format. Use ISO 8601 datetime."},
                status=400,
            )
        metrics_qs = metrics_qs.filter(until__lte=until_dt)

    deleted_count, _ = metrics_qs.delete()

    return JsonResponse(
        {"message": f"Deleted {deleted_count} metric(s)."},
        status=200
    )


@require_GET
def export_project_view(request, project_id):
    """
    GET /projects/<project_id>/export/
    Returns a CSV of all metrics for that project.
    """
    project = get_object_or_404(Project, pk=project_id)
    metrics = Metric.objects.filter(project=project).order_by("since", "metric_type")

    filename = f"{project.owner}-{project.repository}-metrics.csv"
    response = HttpResponse(content_type="text/csv")
    response["Content-Disposition"] = f'attachment; filename="{filename}"'

    writer = csv.writer(response)
    writer.writerow([
        "metric_id",
        "metric_type",
        "value",
        "variance",
        "since",
        "until",
    ])
    for m in metrics:
        writer.writerow([
            m.id,
            m.metric_type,
            m.value,
            m.variance if m.variance is not None else "",
            m.since.isoformat() if m.since else "",
            m.until.isoformat() if m.until else "",
        ])

    return response
