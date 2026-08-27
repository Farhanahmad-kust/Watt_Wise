from fastapi.testclient import TestClient

from backend.main import app


client = TestClient(app)


def test_root_exposes_api_links() -> None:
    response = client.get("/")
    assert response.status_code == 200
    assert response.json()["health"] == "/health"


def test_manual_schema_rejects_negative_appliance_use() -> None:
    response = client.post(
        "/api/v1/predict/manual",
        json={
            "date": "2016-05-27T17:50:00",
            "Appliances": -1,
            "T1": 21,
            "RH_1": 40,
            "T2": 20,
            "RH_2": 40,
            "T_out": 15,
            "RH_out": 60,
        },
    )
    assert response.status_code == 422


def test_batch_example_is_downloadable_and_model_compatible() -> None:
    response = client.get("/api/v1/batch/example?variant=typical")
    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/csv")
    assert len(response.text.splitlines()) == 146
    assert "Tdewpoint" in response.text.splitlines()[0]
