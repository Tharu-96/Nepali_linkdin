from pydantic import BaseSettings

class Settings(BaseSettings):
    DATABASE_URL: str
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60

    # 2. GOOGLE AUTH (New)
    GOOGLE_CLIENT_ID: str = ""

    ESEWA_MERCHANT_CODE: str = "EPAYTEST"
    ESEWA_SECRET_KEY: str = ""
    ESEWA_PAYMENT_URL: str = "https://rc-epay.esewa.com.np/api/epay/main/v2/form"
    ESEWA_VERIFY_URL: str = "https://rc.esewa.com.np/api/epay/transaction/status/"
    KHALTI_SECRET_KEY: str = ""
    KHALTI_PUBLIC_KEY: str = ""
    KHALTI_BASE_URL: str = "https://dev.khalti.com/api/v2"
    KHALTI_INITIATE_URL: str = ""
    KHALTI_LOOKUP_URL: str = ""
    PLATFORM_COMMISSION_RATE: float = 0.08
    PAYMENT_SUCCESS_URL: str = "http://localhost:5173/payment/success"
    PAYMENT_FAILURE_URL: str = "http://localhost:5173/payment/failed"
    FRONTEND_BASE_URL: str = "http://localhost:5173"
    # Google Maps / Geocoding / Distance Matrix
    GOOGLE_MAPS_API_KEY: str = ""
    GOOGLE_GEOCODING_API_KEY: str = ""
    GOOGLE_DISTANCE_MATRIX_API_KEY: str = ""

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        extra = "ignore"

settings = Settings()
