import smtplib
from email.mime.text import MIMEText
from langchain.tools import tool
from dotenv import load_dotenv
load_dotenv()
import os

@tool
def send_email(to: str, subject: str, body: str):
    """Send an email to a recipient."""

    sender = os.getenv("SENDER")
    app_password = os.getenv("PASSWORD")

    msg = MIMEText(body)
    msg["Subject"] = subject
    msg["From"] = sender
    msg["To"] = to

    with smtplib.SMTP_SSL("smtp.gmail.com", 465) as server:
        server.login(sender, app_password)
        server.send_message(msg)

    return "Email sent successfully"


if __name__ == "__main__":
    result = send_email.invoke({
        "to": "thakur273003@gmail.com",
        "subject": "Veronica Test",
        "body": "This is a test email from Veronica."
    })

    print(result)