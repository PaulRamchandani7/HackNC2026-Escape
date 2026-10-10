"""HTTPS requests for LeetCode and Piston."""

import os
import ssl
import urllib.request
from pathlib import Path


def _cafile():
    configured = os.environ.get("SSL_CERT_FILE")
    if configured and Path(configured).is_file():
        return configured
    try:
        import certifi
    except ImportError:
        certifi = None
    if certifi is not None:
        return certifi.where()
    system = Path("/etc/ssl/cert.pem")
    if system.is_file():
        return str(system)
    return None


def urlopen(request, timeout):
    cafile = _cafile()
    context = ssl.create_default_context(cafile=cafile) if cafile else ssl.create_default_context()
    return urllib.request.urlopen(request, timeout=timeout, context=context)
