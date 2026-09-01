import os
from typing import Any

import cloudinary
import cloudinary.uploader


class StorageConfigurationError(RuntimeError):
    pass


def _configure() -> None:
    cloud_name = os.environ.get("CLOUDINARY_CLOUD_NAME")
    api_key = os.environ.get("CLOUDINARY_API_KEY")
    api_secret = os.environ.get("CLOUDINARY_API_SECRET")
    if not all((cloud_name, api_key, api_secret)):
        raise StorageConfigurationError("Cloudinary storage is not configured")

    cloudinary.config(
        cloud_name=cloud_name,
        api_key=api_key,
        api_secret=api_secret,
        secure=True,
    )


def upload_bytes(
    content: bytes,
    *,
    folder: str,
    resource_type: str = "auto",
    public_id: str | None = None,
    filename: str | None = None,
) -> dict[str, Any]:
    _configure()
    options: dict[str, Any] = {
        "folder": folder,
        "resource_type": resource_type,
        "overwrite": True,
    }
    if public_id:
        options["public_id"] = public_id
        options["invalidate"] = True
    if filename:
        options["filename_override"] = filename
        options["use_filename"] = False

    result = cloudinary.uploader.upload(content, **options)
    return {
        "secure_url": result["secure_url"],
        "public_id": result["public_id"],
        "resource_type": result.get("resource_type", resource_type),
    }


def delete_asset(public_id: str, *, resource_type: str = "image") -> None:
    _configure()
    cloudinary.uploader.destroy(
        public_id,
        resource_type=resource_type,
        invalidate=True,
    )