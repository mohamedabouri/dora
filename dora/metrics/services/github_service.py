import time
from datetime import datetime, timezone
from dateutil import parser
from .github_rest_service import GitHubRestService


class GitHubService:
    DATE_FORMAT = "%Y-%m-%dT%H:%M:%S+00:00"

    def __init__(self):
        self.github_rest = GitHubRestService()

    def _parse_date(self, date_val):
        if isinstance(date_val, datetime):
            dt = date_val
        else:
            dt = parser.isoparse(date_val)
        return dt.astimezone(timezone.utc)

    def _format_date(self, date_obj):
        return date_obj.strftime(self.DATE_FORMAT)

    def _get_divider(self, owner, repo, since_day, until_day, bug_label):
        since_str = self._format_date(self._parse_date(since_day))
        until_str = self._format_date(self._parse_date(until_day))

        page, per_page = 1, 100

        # count incidents (bug-label issues)
        q_inc = (
            f"label:{bug_label} repo:{owner}/{repo} is:issue "
            f"created:{since_str}..{until_str} sort:created-asc"
        )
        inc_res = self.github_rest.get_github_issues(q_inc, page, per_page)
        num_inc = inc_res.get("total_count", 0)

        # count all issues
        q_all = (
            f"repo:{owner}/{repo} is:issue "
            f"created:{since_str}..{until_str} sort:created-asc"
        )
        all_res = self.github_rest.get_github_issues(q_all, page, per_page)
        num_all = all_res.get("total_count", 0)

        total = int(num_inc) + int(num_all)
        approx = total + (total // 100)
        if approx > 5000:
            approx = approx // 5000
            return int(approx) + 1
        return 1

    def get_github_releases(self, owner, repo, since_day, until_day):
        """
        Returns a list of releases published within the specified [since_day, until_day] window
        for the given owner/repo, excluding prereleases.
        """
        per_page = 100
        releases_in_period = []
        since = self._parse_date(since_day)
        until = self._parse_date(until_day)

        page = 1
        while True:
            releases = self.github_rest.get_github_releases(owner, repo, page, per_page)
            if not releases:
                break

            filtered = [
                r for r in releases
                if (dt := self._parse_date(r["published_at"])) > since
                   and dt < until
                   and not r.get("prerelease", False)
            ]
            releases_in_period.extend(filtered)

            # if the API-returned batch has at least one item older than `since`, we can stop
            if any(self._parse_date(r["published_at"]) < since for r in releases):
                break

            page += 1
            time.sleep(0.1)

        return releases_in_period

    def get_github_releases_created(self, owner, repo, since_release, until_release):
        """
        Returns all releases whose `created_at` timestamp lies between since_release and until_release.
        """
        per_page = 100
        releases_created = []
        since = self._parse_date(since_release)
        until = self._parse_date(until_release)

        page = 1
        while True:
            releases = self.github_rest.get_github_releases(owner, repo, page, per_page)
            if not releases:
                break

            filtered = [
                r for r in releases
                if (dt := self._parse_date(r["created_at"])) > since
                   and dt < until
                   and not r.get("prerelease", False)
            ]
            releases_created.extend(filtered)

            # if the batch has any item older than `since`, we can stop
            if any(self._parse_date(r["created_at"]) < since for r in releases):
                break

            page += 1
            time.sleep(0.1)

        return releases_created

    def get_github_deployment_frequency(self, owner, repo, since_day, until_day):
        """
        Returns a list of time differences (in milliseconds) between consecutive releases'
        published_at timestamps within the given window.
        """
        releases = self.get_github_releases(owner, repo, since_day, until_day)
        releases_sorted = sorted(releases, key=lambda r: self._parse_date(r["published_at"]))

        diffs = []
        for i in range(1, len(releases_sorted)):
            t1 = self._parse_date(releases_sorted[i - 1]["published_at"])
            t2 = self._parse_date(releases_sorted[i]["published_at"])
            diffs.append((t2 - t1).total_seconds() * 1000)

        return diffs

    def get_github_issues_committed_in_period(self, owner, repo, since_release, until_release, bug_label):
        """
        Retrieves GitHub issues that have commit events (filtered by a 'referenced' event)
        between since_release and until_release for the given owner/repo and bug_label.
        Caps at page=10 to avoid exceeding 1 000 results.
        """
        since_dt = self._parse_date(since_release)
        until_dt = self._parse_date(until_release)
        since_str = self._format_date(since_dt)
        until_str = self._format_date(until_dt)

        divider = self._get_divider(owner, repo, since_release, until_release, bug_label)
        per_page = 100
        issues = []

        page = 1
        query = f"repo:{owner}/{repo} is:issue created:{since_str}..{until_str} sort:created-asc"
        while True:
            if page > 10:
                break

            result = self.github_rest.get_github_issues(query, page, per_page)
            items = result.get("items", [])
            if not items:
                break

            if divider > 1:
                items = [it for idx, it in enumerate(items) if idx % divider == 0]

            for issue in items:
                events = self.github_rest.get_github_issue_events(owner, repo, issue["number"])
                valid = [
                    e for e in events
                    if e.get("event") == "referenced"
                       and since_dt < self._parse_date(e["created_at"]) < until_dt
                ]
                if valid:
                    valid.sort(key=lambda e: self._parse_date(e["created_at"]))
                    issue["last_commit_date"] = valid[-1]["created_at"]
                    issues.append(issue)

            page += 1
            time.sleep(0.1)

        return issues

    def get_github_lead_time_for_changes(self, owner, repo, since_day, until_day, bug_label):
        """
        Returns a list of “lead times” (in milliseconds) for all issues with commits
        between the first and last release created in the window [since_day, until_day].
        Requires bug_label only for the divider logic (inside get_github_issues_committed_in_period).
        """
        # 1) Get all releases in the window, sorted by published_at ascending
        releases = self.get_github_releases(owner, repo, since_day, until_day)
        if not releases:
            return []

        releases_sorted = sorted(releases, key=lambda r: self._parse_date(r["published_at"]))

        # 2) Get all releases created in [first_release.created_at, last_release.created_at]
        first_created = releases_sorted[0]["created_at"]
        last_created = releases_sorted[-1]["created_at"]

        created_rels = sorted(
            self.get_github_releases_created(owner, repo, first_created, last_created),
            key=lambda r: self._parse_date(r["created_at"])
        )

        # 3) Find a “pre‐period” release for anchoring
        all_rels = self.github_rest.get_github_releases(owner, repo, 1, 100)
        pre = next(
            (
                r for r in all_rels
                if self._parse_date(r["created_at"]) < self._parse_date(first_created)
                   and not r.get("prerelease", False)
            ),
            None
        )
        if pre:
            created_rels.insert(0, pre)

        if len(created_rels) < 2:
            return []

        # 4) Get all issues with “referenced” commits in that created_rels window
        issues = sorted(
            self.get_github_issues_committed_in_period(
                owner, repo,
                created_rels[0]["created_at"],
                created_rels[-1]["created_at"],
                bug_label
            ),
            key=lambda i: self._parse_date(i.get("last_commit_date", datetime.min))
        )

        # 5) For each issue, calculate (publish_time_of_next_release − commit_time)
        lead_times = []
        idx = 1
        for issue in issues:
            commit_dt = self._parse_date(issue["last_commit_date"])
            while (
                idx < len(created_rels)
                and commit_dt > self._parse_date(created_rels[idx]["created_at"])
            ):
                idx += 1
            pub_dt = self._parse_date(created_rels[idx]["published_at"])
            lead_times.append((pub_dt - commit_dt).total_seconds() * 1000)

        return lead_times

    def get_github_incidents_committed_in_period(self, owner, repo, since_release, until_release, bug_label):
        """
        Similar to get_github_issues_committed_in_period but filters issues by bug_label.
        """
        since_dt = self._parse_date(since_release)
        until_dt = self._parse_date(until_release)
        since_str = self._format_date(since_dt)
        until_str = self._format_date(until_dt)

        divider = self._get_divider(owner, repo, since_release, until_release, bug_label)
        per_page = 100
        incidents = []

        page = 1
        query = f"label:{bug_label} repo:{owner}/{repo} is:issue created:{since_str}..{until_str} sort:created-asc"
        while True:
            if page > 10:
                break

            result = self.github_rest.get_github_issues(query, page, per_page)
            items = result.get("items", [])
            if not items:
                break

            if divider > 1:
                items = [it for idx, it in enumerate(items) if idx % divider == 0]

            for issue in items:
                events = self.github_rest.get_github_issue_events(owner, repo, issue["number"])
                valid = [
                    e for e in events
                    if e.get("event") == "referenced"
                       and since_dt < self._parse_date(e["created_at"]) < until_dt
                ]
                if valid:
                    valid.sort(key=lambda e: self._parse_date(e["created_at"]))
                    issue["last_commit_date"] = valid[-1]["created_at"]
                    incidents.append(issue)

            page += 1
            time.sleep(0.1)

        return incidents

    def get_github_time_to_restore_service(self, owner, repo, since_day, until_day, bug_label):
        """
        Returns a list of “recovery times” (in milliseconds) for all incidents
        (issues labeled bug_label) in the window [since_day, until_day].
        """
        # 1) Get releases in the window, sorted by published_at
        releases = self.get_github_releases(owner, repo, since_day, until_day)
        if not releases:
            return []

        releases_sorted = sorted(releases, key=lambda r: self._parse_date(r["published_at"]))

        # 2) Get releases created between first and last
        first_created = releases_sorted[0]["created_at"]
        last_created = releases_sorted[-1]["created_at"]
        created_rels = sorted(
            self.get_github_releases_created(owner, repo, first_created, last_created),
            key=lambda r: self._parse_date(r["created_at"])
        )

        # 3) Find “pre‐period” release
        all_rels = self.github_rest.get_github_releases(owner, repo, 1, 100)
        pre = next(
            (
                r for r in all_rels
                if self._parse_date(r["created_at"]) < self._parse_date(first_created)
                   and not r.get("prerelease", False)
            ),
            None
        )
        if pre:
            created_rels.insert(0, pre)

        if len(created_rels) < 2:
            return []

        # 4) Get incidents committed in that window
        incidents = sorted(
            self.get_github_incidents_committed_in_period(
                owner, repo,
                created_rels[0]["created_at"],
                created_rels[-1]["created_at"],
                bug_label
            ),
            key=lambda i: self._parse_date(i.get("last_commit_date", datetime.min))
        )

        # 5) For each incident, compute (publish_of_next_release − incident_created_time)
        recovery_times = []
        idx = 1
        for inc in incidents:
            incident_dt = self._parse_date(inc.get("created_at"))
            while (
                idx < len(created_rels)
                and incident_dt > self._parse_date(created_rels[idx]["created_at"])
            ):
                idx += 1
            pub_dt = self._parse_date(created_rels[idx]["published_at"])
            recovery_times.append((pub_dt - incident_dt).total_seconds() * 1000)

        return recovery_times

    def get_github_change_failure_rate(self, owner, repo, since_day, until_day, bug_label):
        """
        Computes ratio (incidents/all) for issues in [since_day, until_day].
        Returns a float in [0.0, 1.0].
        """
        since = self._parse_date(since_day)
        until = self._parse_date(until_day)
        since_str = self._format_date(since)
        until_str = self._format_date(until)

        # count incidents
        q_inc = (
            f"label:{bug_label} repo:{owner}/{repo} is:issue "
            f"created:{since_str}..{until_str} sort:created-asc"
        )
        inc_res = self.github_rest.get_github_issues(q_inc, 1, 1)
        num_inc = inc_res.get("total_count", 0)

        # count all issues
        q_all = (
            f"repo:{owner}/{repo} is:issue "
            f"created:{since_str}..{until_str} sort:created-asc"
        )
        all_res = self.github_rest.get_github_issues(q_all, 1, 1)
        num_all = all_res.get("total_count", 0)

        if num_all == 0:
            return 0.0
        return num_inc / num_all
