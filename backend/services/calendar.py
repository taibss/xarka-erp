import requests
from services.notify import get_access_token


def create_calendar_event(
    organizer_email: str,
    title: str,
    agenda: str,
    meeting_time: str,
    duration_minutes: int,
    attendee_emails: list
):
    token = get_access_token()
    if not token:
        print("Calendar: Could not get access token")
        return None

    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }

    from datetime import datetime, timedelta
    start = datetime.fromisoformat(meeting_time.replace("Z", "+00:00"))
    end = start + timedelta(minutes=duration_minutes)

    attendees = [
        {
            "emailAddress": {"address": email},
            "type": "required"
        }
        for email in attendee_emails
    ]

    event_data = {
        "subject": title,
        "body": {
            "contentType": "Text",
            "content": agenda
        },
        "start": {
            "dateTime": start.isoformat(),
            "timeZone": "Asia/Calcutta"
        },
        "end": {
            "dateTime": end.isoformat(),
            "timeZone": "Asia/Calcutta"
        },
        "attendees": attendees,
        "isOnlineMeeting": True,
        "onlineMeetingProvider": "teamsForBusiness"
    }

    response = requests.post(
        f"https://graph.microsoft.com/v1.0/users/{organizer_email}/events",
        headers=headers,
        json=event_data
    )

    if response.status_code == 201:
        event = response.json()
        print(f"Calendar event created: {event.get('id')}")
        return event.get("id")
    else:
        print(f"Calendar failed: {response.status_code} — {response.text}")
        return None


def delete_calendar_event(organizer_email: str, event_id: str):
    token = get_access_token()
    if not token:
        return

    headers = {"Authorization": f"Bearer {token}"}

    response = requests.delete(
        f"https://graph.microsoft.com/v1.0/users/{organizer_email}/events/{event_id}",
        headers=headers
    )

    if response.status_code == 204:
        print(f"Calendar event deleted: {event_id}")
    else:
        print(f"Calendar delete failed: {response.status_code}")
