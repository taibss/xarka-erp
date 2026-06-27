import msal
import requests
import os
from sqlalchemy.orm import Session
from models.notification import Notification
from dotenv import load_dotenv

load_dotenv()


def get_access_token():
    tenant_id = os.getenv("AZURE_TENANT_ID")
    client_id = os.getenv("AZURE_CLIENT_ID")
    client_secret = os.getenv("AZURE_CLIENT_SECRET")

    authority = f"https://login.microsoftonline.com/{tenant_id}"

    app = msal.ConfidentialClientApplication(
        client_id,
        authority=authority,
        client_credential=client_secret
    )

    result = app.acquire_token_for_client(
        scopes=["https://graph.microsoft.com/.default"]
    )

    if "access_token" in result:
        return result["access_token"]
    else:
        print(f"Token error: {result.get('error_description')}")
        return None


def send_email(to: str, subject: str, body: str):
    try:
        token = get_access_token()
        if not token:
            print("Email failed: Could not get access token")
            return

        sender = os.getenv("SMTP_EMAIL")

        email_data = {
            "message": {
                "subject": subject,
                "body": {
                    "contentType": "Text",
                    "content": body
                },
                "toRecipients": [
                    {
                        "emailAddress": {
                            "address": to
                        }
                    }
                ]
            },
            "saveToSentItems": "true"
        }

        response = requests.post(
            f"https://graph.microsoft.com/v1.0/users/{sender}/sendMail",
            headers={
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json"
            },
            json=email_data
        )

        if response.status_code == 202:
            print(f"Email sent successfully to {to}")
        else:
            print(f"Email failed: {response.status_code} — {response.text}")

    except Exception as e:
        print(f"Email failed: {e}")


def create_notification(
    db: Session,
    employee_id: int,
    title: str,
    message: str,
    notif_type: str,
    link: str = None,
):
    notification = Notification(
        employee_id=employee_id,
        title=title,
        message=message,
        type=notif_type,
        link=link,
    )
    db.add(notification)
    db.commit()
    return notification
