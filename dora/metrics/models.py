from django.db import models


class Project(models.Model):
    name = models.CharField(max_length=100)
    owner = models.CharField(max_length=100)
    repository = models.CharField(max_length=100)

    def __str__(self):
        return f"{self.owner}/{self.repository}"


class Metric(models.Model):
    METRIC_TYPES = [
        ('release_frequency', 'Release Frequency'),
        ('lead_time_for_released_changes', 'Lead Time for Released Changes'),
        ('time_to_repair_code', 'Time to Repair Code'),
        ('bug_issues_rate', 'Bug Issues Rate'),
    ]
    project = models.ForeignKey(Project, on_delete=models.CASCADE)
    metric_type = models.CharField(max_length=50, choices=METRIC_TYPES)
    value = models.FloatField()
    variance = models.FloatField(null=True, blank=True)
    since = models.DateTimeField(null=True)
    until = models.DateTimeField(null=True)

    def __str__(self):
        return (f"{self.project} – {self.metric_type} "
                f"from {self.since.isoformat()} to {self.until.isoformat()}")
