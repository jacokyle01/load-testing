from locust import HttpUser, task, between

class ConduitUser(HttpUser):
    host = "http://localhost:3001"
    wait_time = between(1, 3)

    def on_start(self):
        # login using RealWorld API spec
        response = self.client.post("/api/users/login", json={
            "user": {
                "email": "jacokyle01@gmail.com",
                "password": "password"
            }
        })
        print("response", response.json())
        token = response.json()["user"]["token"]

        # add Authorization header to all requests
        self.client.headers.update({
            "Authorization": f"Token {token}"
        })

    @task
    def list_articles(self):
        self.client.get("/api/articles")
