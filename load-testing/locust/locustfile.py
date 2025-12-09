"""
Locust Load Testing - Realistic User Workflows

This file defines realistic user behaviors for the Conduit application.
Users follow typical workflows: browsing, reading, creating content, etc.
"""

import json
import random
import time
from locust import HttpUser, task, between, SequentialTaskSet, TaskSet


class AnonymousReaderBehavior(TaskSet):
    """
    Anonymous users browsing articles without authentication
    Typical behavior: view popular tags, browse articles, read specific articles
    """

    @task(3)
    def view_tags(self):
        """View popular tags - lightweight operation"""
        with self.client.get(
            "/api/tags",
            name="GET /api/tags [Anonymous]",
            catch_response=True
        ) as response:
            if response.status_code == 200:
                response.success()
            else:
                response.failure(f"Got status code {response.status_code}")

    @task(6)
    def browse_articles(self):
        """Browse article list - most common action"""
        params = {
            "limit": 20,
            "offset": random.randint(0, 5) * 20  # Simulate pagination
        }
        with self.client.get(
            "/api/articles",
            params=params,
            name="GET /api/articles [Anonymous]",
            catch_response=True
        ) as response:
            if response.status_code == 200:
                try:
                    data = response.json()
                    articles = data.get('articles', [])
                    if articles:
                        # Store random article slug for reading
                        self.user.article_slug = random.choice(articles).get('slug')
                    response.success()
                except Exception as e:
                    response.failure(f"Failed to parse response: {e}")
            else:
                response.failure(f"Got status code {response.status_code}")

    @task(2)
    def read_article(self):
        """Read a specific article"""
        if hasattr(self.user, 'article_slug'):
            slug = self.user.article_slug
        else:
            slug = "sample-article"  # Fallback

        with self.client.get(
            f"/api/articles/{slug}",
            name="GET /api/articles/:slug [Anonymous]",
            catch_response=True
        ) as response:
            if response.status_code == 200:
                response.success()
            elif response.status_code == 404:
                response.success()  # Expected for some cases
            else:
                response.failure(f"Got status code {response.status_code}")

    def on_start(self):
        """Initialize user session"""
        self.user.article_slug = None


class AuthenticatedReaderBehavior(TaskSet):
    """
    Logged-in users who read content but don't create
    Typical behavior: check feed, read articles, view profiles
    """

    def on_start(self):
        """Login before starting tasks"""
        self.login()

    def login(self):
        """Authenticate user"""
        username = f"reader_{random.randint(1000, 9999)}"
        email = f"{username}@loadtest.com"
        password = "password123"

        # Try to register first
        register_response = self.client.post(
            "/api/users",
            json={
                "user": {
                    "username": username,
                    "email": email,
                    "password": password
                }
            },
            name="POST /api/users [Register]",
            catch_response=True
        )

        if register_response.status_code in [200, 201]:
            try:
                data = register_response.json()
                self.token = data['user']['token']
                self.username = username
                register_response.success()
                return
            except:
                pass

        # If registration fails, try login
        login_response = self.client.post(
            "/api/users/login",
            json={
                "user": {
                    "email": email,
                    "password": password
                }
            },
            name="POST /api/users/login",
            catch_response=True
        )

        if login_response.status_code == 200:
            try:
                data = login_response.json()
                self.token = data['user']['token']
                self.username = username
                login_response.success()
            except:
                self.token = None
        else:
            self.token = None

    @task(5)
    def view_feed(self):
        """View personalized article feed"""
        if not self.token:
            return

        params = {"limit": 20}
        headers = {"Authorization": f"Token {self.token}"}

        with self.client.get(
            "/api/articles/feed",
            params=params,
            headers=headers,
            name="GET /api/articles/feed [Auth]",
            catch_response=True
        ) as response:
            if response.status_code == 200:
                try:
                    data = response.json()
                    articles = data.get('articles', [])
                    if articles:
                        self.user.article_slug = random.choice(articles).get('slug')
                    response.success()
                except:
                    response.failure("Failed to parse feed")
            else:
                response.failure(f"Got status code {response.status_code}")

    @task(4)
    def read_article(self):
        """Read a specific article"""
        if not self.token:
            return

        slug = getattr(self.user, 'article_slug', 'sample-article')
        headers = {"Authorization": f"Token {self.token}"}

        with self.client.get(
            f"/api/articles/{slug}",
            headers=headers,
            name="GET /api/articles/:slug [Auth]",
            catch_response=True
        ) as response:
            if response.status_code in [200, 404]:
                response.success()
            else:
                response.failure(f"Got status code {response.status_code}")

    @task(2)
    def browse_all_articles(self):
        """Browse global article list"""
        if not self.token:
            return

        params = {"limit": 20}
        headers = {"Authorization": f"Token {self.token}"}

        with self.client.get(
            "/api/articles",
            params=params,
            headers=headers,
            name="GET /api/articles [Auth]",
            catch_response=True
        ) as response:
            if response.status_code == 200:
                response.success()
            else:
                response.failure(f"Got status code {response.status_code}")

    @task(1)
    def view_profile(self):
        """View a user profile"""
        if not self.token or not hasattr(self, 'username'):
            return

        headers = {"Authorization": f"Token {self.token}"}

        with self.client.get(
            f"/api/profiles/{self.username}",
            headers=headers,
            name="GET /api/profiles/:username",
            catch_response=True
        ) as response:
            if response.status_code == 200:
                response.success()
            else:
                response.failure(f"Got status code {response.status_code}")


class ContentCreatorBehavior(SequentialTaskSet):
    """
    Active users who create content
    Follows realistic workflow: login -> browse -> read -> create -> comment
    """

    def on_start(self):
        """Login before starting tasks"""
        self.login()

    def login(self):
        """Authenticate user"""
        username = f"creator_{random.randint(1000, 9999)}"
        email = f"{username}@loadtest.com"
        password = "password123"

        # Register user
        register_response = self.client.post(
            "/api/users",
            json={
                "user": {
                    "username": username,
                    "email": email,
                    "password": password
                }
            },
            name="POST /api/users [Register]",
            catch_response=True
        )

        if register_response.status_code in [200, 201]:
            try:
                data = register_response.json()
                self.token = data['user']['token']
                self.username = username
                register_response.success()
                return
            except:
                pass

        self.token = None

    @task
    def browse_feed(self):
        """Step 1: Check personal feed"""
        if not self.token:
            return

        headers = {"Authorization": f"Token {self.token}"}
        with self.client.get(
            "/api/articles/feed",
            headers=headers,
            name="GET /api/articles/feed [Creator]",
            catch_response=True
        ) as response:
            if response.status_code == 200:
                try:
                    data = response.json()
                    articles = data.get('articles', [])
                    if articles:
                        self.article_slug = random.choice(articles).get('slug')
                    response.success()
                except:
                    response.failure("Failed to parse feed")
            else:
                response.failure(f"Got status code {response.status_code}")

        time.sleep(random.uniform(0.5, 2))  # Simulate reading time

    @task
    def create_article(self):
        """Step 2: Create new article"""
        if not self.token:
            return

        headers = {
            "Authorization": f"Token {self.token}",
            "Content-Type": "application/json"
        }

        article_data = {
            "article": {
                "title": f"Load Test Article {random.randint(10000, 99999)}",
                "description": "An article created during load testing",
                "body": "This is the body of a test article created to simulate realistic user behavior during load testing.",
                "tagList": ["testing", "loadtest"]
            }
        }

        with self.client.post(
            "/api/articles",
            json=article_data,
            headers=headers,
            name="POST /api/articles [Create]",
            catch_response=True
        ) as response:
            if response.status_code in [200, 201]:
                try:
                    data = response.json()
                    self.created_slug = data['article']['slug']
                    response.success()
                except:
                    response.failure("Failed to parse created article")
            else:
                response.failure(f"Got status code {response.status_code}")

        time.sleep(random.uniform(1, 3))  # Simulate thinking time

    @task
    def read_own_article(self):
        """Step 3: Read the article just created"""
        if not self.token or not hasattr(self, 'created_slug'):
            return

        headers = {"Authorization": f"Token {self.token}"}

        with self.client.get(
            f"/api/articles/{self.created_slug}",
            headers=headers,
            name="GET /api/articles/:slug [Own]",
            catch_response=True
        ) as response:
            if response.status_code == 200:
                response.success()
            else:
                response.failure(f"Got status code {response.status_code}")

        time.sleep(random.uniform(0.5, 1.5))

    @task
    def add_comment(self):
        """Step 4: Add comment to an article"""
        if not self.token:
            return

        slug = getattr(self, 'article_slug', getattr(self, 'created_slug', 'sample-article'))
        headers = {
            "Authorization": f"Token {self.token}",
            "Content-Type": "application/json"
        }

        comment_data = {
            "comment": {
                "body": f"Great article! Comment from load test {random.randint(1000, 9999)}"
            }
        }

        with self.client.post(
            f"/api/articles/{slug}/comments",
            json=comment_data,
            headers=headers,
            name="POST /api/articles/:slug/comments",
            catch_response=True
        ) as response:
            if response.status_code in [200, 201]:
                response.success()
            elif response.status_code == 404:
                response.success()  # Article might not exist
            else:
                response.failure(f"Got status code {response.status_code}")


# User classes with different behaviors
class AnonymousUser(HttpUser):
    """Anonymous visitors browsing the site"""
    tasks = [AnonymousReaderBehavior]
    wait_time = between(1, 3)  # Wait 1-3 seconds between tasks
    weight = 3  # 30% of users


class AuthenticatedUser(HttpUser):
    """Logged-in users reading content"""
    tasks = [AuthenticatedReaderBehavior]
    wait_time = between(2, 5)  # Wait 2-5 seconds between tasks
    weight = 5  # 50% of users


class ContentCreator(HttpUser):
    """Active users creating content"""
    tasks = [ContentCreatorBehavior]
    wait_time = between(3, 8)  # Wait 3-8 seconds between tasks
    weight = 2  # 20% of users
