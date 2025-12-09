"""
Simple Locust Load Test

Simpler test file for baseline and progressive load testing
Focuses on individual endpoints without complex workflows
"""

import random
from locust import HttpUser, task, between


class SimpleLoadTest(HttpUser):
    """
    Simple load test focusing on key endpoints
    Useful for comparing with Autocannon results
    """

    wait_time = between(1, 2)

    @task(3)
    def get_tags(self):
        """GET /api/tags - Simplest endpoint"""
        self.client.get("/api/tags", name="GET /api/tags")

    @task(5)
    def get_articles(self):
        """GET /api/articles - List articles"""
        offset = random.randint(0, 5) * 20
        self.client.get(
            f"/api/articles?limit=20&offset={offset}",
            name="GET /api/articles"
        )

    @task(2)
    def get_article_detail(self):
        """GET /api/articles/:slug - Article detail"""
        # Use some common slugs that might exist after seeding
        slugs = [
            "how-to-train-your-dragon",
            "test-article",
            "sample-post",
            f"article-{random.randint(1, 10)}"
        ]
        slug = random.choice(slugs)
        self.client.get(
            f"/api/articles/{slug}",
            name="GET /api/articles/:slug"
        )

    @task(1)
    def register_user(self):
        """POST /api/users - User registration (CPU intensive)"""
        username = f"loadtest_{random.randint(100000, 999999)}"
        self.client.post(
            "/api/users",
            json={
                "user": {
                    "username": username,
                    "email": f"{username}@test.com",
                    "password": "password123"
                }
            },
            name="POST /api/users"
        )
