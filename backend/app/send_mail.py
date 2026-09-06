import smtplib
import socket
from email.mime.text import MIMEText
from langchain.tools import tool
from dotenv import load_dotenv
load_dotenv()
import os

# Force IPv4 - some hosts (like Railway) have unreliable/no IPv6 routing,
# which causes smtplib to fail with "Network is unreachable" when DNS
# returns an IPv6 address for smtp.gmail.com
_orig_getaddrinfo = socket.getaddrinfo
def _ipv4_only_getaddrinfo(*args, **kwargs):
    return [r for r in _orig_getaddrinfo(*args, **kwargs) if r[0] == socket.AF_INET]
socket.getaddrinfo = _ipv4_only_getaddrinfo

@tool
def send_email(to: str, subject: str, body: str):
    """Send an email. Parameters 'recipient', 'subject', and 'body' must be valid medium strings without raw linebreaks. and no long body"""

    sender = os.getenv("SENDER")
    app_password = os.getenv("PASSWORD")

    msg = MIMEText(body)
    msg["Subject"] = subject
    msg["From"] = sender
    msg["To"] = to

    try:
        with smtplib.SMTP_SSL("smtp.gmail.com", 465) as server:
            server.login(sender, app_password)
            server.send_message(msg)
        return "Email sent successfully"
    except Exception as e:
        return f"Failed to send email: {e}"


if __name__ == "__main__":
    result = send_email.invoke({
        "to": "thakur273003@gmail.com",
        "subject": "Veronica Test",
        "body": "This is a test email from Veronica."
    })

    print(result)

    print(result)
