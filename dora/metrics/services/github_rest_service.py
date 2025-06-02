import base64
import requests
from django.conf import settings


class GitHubRestService:
    BASE_URL = "https://api.github.com/"

    def __init__(self):
        auth_str = f"{settings.GITHUB_USERNAME}:{settings.GITHUB_PASSWORD}"
        token = base64.b64encode(auth_str.encode()).decode()
        self.headers = {
            "Authorization": f"Basic {token}",
            "Accept": "application/json"
        }

    def get_github_releases(self, owner, repo, page=1, per_page=100):
        url = f"{self.BASE_URL}repos/{owner}/{repo}/releases"
        params = {"page": page, "per_page": per_page}
        response = requests.get(url, headers=self.headers, params=params)
        response.raise_for_status()
        return response.json()

    def get_github_issues(self, query, page=1, per_page=100):
        url = f"{self.BASE_URL}search/issues"
        params = {"q": query, "page": page, "per_page": per_page}
        response = requests.get(url, headers=self.headers, params=params)
        response.raise_for_status()
        return response.json()

    def get_github_issue_events(self, owner, repo, issue_number):
        url = f"{self.BASE_URL}repos/{owner}/{repo}/issues/{issue_number}/events"
        response = requests.get(url, headers=self.headers)
        response.raise_for_status()
        return response.json()
