from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql://postgres:postgres@localhost:5432/emergencias_vehiculares"
    SECRET_KEY: str = "dev-secret-key-cambiar-en-produccion"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440
    OPENAI_API_KEY: str = ""
    GOOGLE_CLOUD_PROJECT: str = "asistecar"
    GOOGLE_CLOUD_LOCATION: str = "us-central1"
    GEMINI_MODEL: str = "gemini-2.5-flash"
    UPLOAD_DIR: str = "./uploads"
    FIREBASE_CREDENTIALS_PATH: str = ""

    class Config:
        env_file = ".env"


settings = Settings()
