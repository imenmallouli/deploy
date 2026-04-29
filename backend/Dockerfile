FROM python:3.11-slim

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

RUN pip install --no-cache-dir \
    fastapi \
    uvicorn[standard] \
    sqlalchemy \
    psycopg2-binary \
    python-dotenv \
    motor \
    pymongo \
    PyJWT \
    pydantic \
    email-validator \
    python-jose \
    passlib[bcrypt] \
    bcrypt==4.0.1 \
    numpy \
    pandas \
    scikit-learn \
    joblib \
    requests

COPY ./app ./app

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
