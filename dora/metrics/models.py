from django.db import models


class Project(models.Model):
    name = models.CharField(max_length=100)
    owner = models.CharField(max_length=100)
    repository = models.CharField(max_length=100)

    def __str__(self):
        return f"{self.owner}/{self.repository}"


class Metric(models.Model):
    METRIC_TYPES = [
        ('deployment_frequency', 'Deployment Frequency'),
        ('change_delivery_time', 'Change Delivery Time'),
        ('service_recovery_time', 'Service Recovery Time'),
        ('change_failure_rate', 'Change Failure Rate'),
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
