import math

MILLISECONDS_IN_DAY = 86400000.0


def calculate_mean_and_variance(values):
    if not values:
        return 0.0, 0.0
    values_in_days = [v / MILLISECONDS_IN_DAY for v in values]
    mean = sum(values_in_days) / len(values_in_days)
    variance = sum((x - mean) ** 2 for x in values_in_days) / len(values_in_days)
    std_dev = math.sqrt(variance)
    return mean, std_dev
