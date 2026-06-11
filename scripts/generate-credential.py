"""Generate a Daraja B2C security credential from a certificate file.

Usage:
    python3 scripts/generate-credential.py cert_sandbox.cer Safaricom999!*!
"""
import sys
import base64
from cryptography import x509
from cryptography.hazmat.primitives.asymmetric import padding

def generate(cert_path: str, password: str) -> str:
    with open(cert_path, "rb") as f:
        cert = x509.load_pem_x509_certificate(f.read())
    public_key = cert.public_key()
    encrypted = public_key.encrypt(
        password.encode("utf-8"),
        padding.PKCS1v15(),
    )
    return base64.b64encode(encrypted).decode("utf-8")

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python3 scripts/generate-credential.py <certificate.cer> <initiator_password>")
        print("Example: python3 scripts/generate-credential.py cert_sandbox.cer Safaricom999!*!")
        sys.exit(1)

    cred = generate(sys.argv[1], sys.argv[2])
    print(cred)
