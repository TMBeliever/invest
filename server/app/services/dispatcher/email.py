import os
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Dict, Any
from app.services.dispatcher.base import BaseChannelAdapter
from app.schemas.intelligence import IntelligencePayload, Severity

class EmailAdapter(BaseChannelAdapter):
    channel_name = "EMAIL"

    def _render_html(self, payload: IntelligencePayload) -> str:
        color = "#10b981" if payload.severity == Severity.OPPORTUNITY else ("#f43f5e" if payload.severity == Severity.CRITICAL else ("#f59e0b" if payload.severity == Severity.WARNING else "#3b82f6"))
        
        options_html = ""
        if payload.decision_options:
            options_html = '<div style="margin-top: 24px; padding: 16px; background-color: #1a1d24; border-radius: 12px; border: 1px solid #2d333f;">'
            options_html += '<h3 style="margin-top:0; margin-bottom: 12px; color: #60a5fa; font-size: 15px;">🎯 InvestScope 决策方案建议</h3>'
            for opt in payload.decision_options:
                options_html += f'<div style="margin-bottom: 12px; padding: 10px; background-color: #222631; border-radius: 8px; border-left: 3px solid #3b82f6;">'
                options_html += f'<div style="font-weight: bold; color: #f3f4f6; font-size: 13px;">{opt.name} <span style="background: rgba(59,130,246,0.2); color: #93c5fd; padding: 2px 6px; border-radius: 4px; font-size: 11px;">{opt.tag}</span></div>'
                options_html += f'<div style="color: #9ca3af; font-size: 12px; margin-top: 4px; line-height: 1.5;">{opt.analysis}</div>'
                options_html += '</div>'
            options_html += '</div>'

        # 将 Markdown 换行转为 HTML 段落
        paragraphs = payload.markdown_content.split("\n\n")
        body_html = "".join([f'<p style="margin-bottom: 12px; line-height: 1.6; color: #d1d5db; font-size: 14px;">{p.replace(chr(10), "<br/>")}</p>' for p in paragraphs if p.strip()])

        return f"""
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0f1117; color: #e5e7eb; margin: 0; padding: 20px; }}
            .container {{ max-width: 620px; margin: 0 auto; background-color: #161821; border: 1px solid #282c37; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.5); }}
            .header {{ background-color: #1e222d; padding: 20px 24px; border-bottom: 1px solid #282c37; border-top: 4px solid {color}; }}
            .badge {{ display: inline-block; padding: 3px 8px; border-radius: 6px; font-size: 11px; font-weight: 600; background-color: {color}22; color: {color}; }}
            .title {{ margin: 10px 0 4px 0; font-size: 18px; font-weight: 700; color: #ffffff; }}
            .content {{ padding: 24px; }}
            .summary {{ padding: 12px 16px; background-color: #1d212c; border-left: 3px solid {color}; border-radius: 6px; margin-bottom: 20px; font-size: 13px; color: #cbd5e1; font-weight: 500; }}
            .footer {{ padding: 16px 24px; background-color: #13141c; border-top: 1px solid #282c37; font-size: 11px; color: #6b7280; text-align: center; }}
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <span class="badge">{payload.severity.value}</span>
              <div class="title">{payload.title}</div>
            </div>
            <div class="content">
              {f'<div class="summary">💡 {payload.summary}</div>' if payload.summary else ''}
              {body_html}
              {options_html}
            </div>
            <div class="footer">
              InvestScope 高胜率投资决策智库 · {payload.created_at}
            </div>
          </div>
        </body>
        </html>
        """

    async def send(self, payload: IntelligencePayload, target_config: Dict[str, Any]) -> bool:
        to_email = target_config.get("email_address")
        if not to_email:
            return False

        smtp_host = os.environ.get("SMTP_HOST")
        smtp_port = int(os.environ.get("SMTP_PORT", 465))
        smtp_user = os.environ.get("SMTP_USER")
        smtp_pass = os.environ.get("SMTP_PASS")
        smtp_from = os.environ.get("SMTP_FROM", smtp_user or "investscope@system.local")

        if not (smtp_host and smtp_user and smtp_pass):
            # 若未配置 SMTP 环境变量，模拟打印并优雅降级
            print(f"[EmailAdapter] Simulated email delivery to {to_email} (SMTP credentials not configured in env)")
            return True

        try:
            msg = MIMEMultipart("alternative")
            msg["Subject"] = f"[{payload.severity.value}] {payload.title}"
            msg["From"] = smtp_from
            msg["To"] = to_email

            html_part = MIMEText(self._render_html(payload), "html")
            msg.attach(html_part)

            if smtp_port == 465:
                with smtplib.SMTP_SSL(smtp_host, smtp_port, timeout=10.0) as server:
                    server.login(smtp_user, smtp_pass)
                    server.sendmail(smtp_from, [to_email], msg.as_string())
            else:
                with smtplib.SMTP(smtp_host, smtp_port, timeout=10.0) as server:
                    server.starttls()
                    server.login(smtp_user, smtp_pass)
                    server.sendmail(smtp_from, [to_email], msg.as_string())
            return True
        except Exception as e:
            print(f"[EmailAdapter] Failed to send email: {e}")
            return False
