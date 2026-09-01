import os
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

# Config credentials
SMTP_SERVER = "smtp.gmail.com"
SMTP_PORT = 465  # 🔒 Port 465 handles direct SSL
SENDER_EMAIL = os.getenv("SENDER_EMAIL")
SENDER_PASSWORD = os.getenv("SENDER_PASSWORD")

def send_login_notification(receiver_email: str, username: str):
    try:
        # Create message container
        msg = MIMEMultipart()
        msg['From'] = f"Rozgar Platform <{SENDER_EMAIL}>"
        msg['To'] = receiver_email
        msg['Subject'] = "🚀Welcome Back to Rozgar!"

        # Email body layout
        body = f"""
        <h3>Hello{username},</h3>
        <p>We are just letting you know that you have successfully logged in to your Rozgar dashboard.</p>
        <p><b>Time:</b> Just now</p>
        <p>Have a wonderful day hunting or posting jobs!</p>
        <br>
        <p>Best regards,<br>The Rozgar Team</p>
        """
        msg.attach(MIMEText(body, 'html'))

        # 🔒 FIX: Connect using SMTP_SSL for direct port 465 encryption
        server = smtplib.SMTP_SSL(SMTP_SERVER, SMTP_PORT)
        
        # Log in and send (starttls is no longer needed!)
        server.login(SENDER_EMAIL, SENDER_PASSWORD)
        server.sendmail(SENDER_EMAIL, receiver_email, msg.as_string())
        server.quit()
        
        print(f"Security email notification dispatched to {receiver_email}")
    except Exception as e:
        print(f"Failed to dispatch email notification: {str(e)}")

def send_password_reset_email(to_email: str, reset_link: str):
    try:
        msg = MIMEMultipart()
        msg['From'] = f"Rozgar Platform <{SENDER_EMAIL}>"
        msg['To'] = to_email
        msg['Subject'] = "Rozgar — Reset Your Password"

        body = f"""Hello,

You requested a password reset for your Rozgar account.

Click the link below to reset your password (expires in 30 minutes):

{reset_link}

If you did not request this, please ignore this email.

Best regards,
The Rozgar Team
"""
        msg.attach(MIMEText(body, 'plain'))

        server = smtplib.SMTP_SSL(SMTP_SERVER, SMTP_PORT)
        server.login(SENDER_EMAIL, SENDER_PASSWORD)
        server.sendmail(SENDER_EMAIL, to_email, msg.as_string())
        server.quit()

        print(f"Password reset email sent to {to_email}")
    except Exception as e:
        print(f"Failed to send password reset email: {str(e)}")