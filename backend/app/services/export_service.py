import json
import re
from typing import Dict, List, Any


def sanitize_filename(title: str, max_length: int = 50) -> str:
    """Sanitize conversation title to create a safe download filename."""
    if not title:
        return "conversation"
    # Replace unsafe characters with hyphen
    clean = re.sub(r'[\s/\\:*?"<>|]+', "-", title.strip())
    clean = re.sub(r"-+", "-", clean).strip("-")
    if not clean:
        return "conversation"
    return clean[:max_length]


def export_to_markdown(conversation: Dict[str, Any], messages: List[Dict[str, Any]]) -> str:
    """
    Format conversation into clean, readable GitHub-style Markdown.
    Omits internal IDs, DB keys, or secrets.
    """
    title = conversation.get("title", "Conversation")
    created_at = conversation.get("created_at", "Unknown")
    updated_at = conversation.get("updated_at", "Unknown")

    lines = [
        f"# {title}",
        "",
        f"- **Created:** {created_at}",
        f"- **Last Updated:** {updated_at}",
        f"- **Total Messages:** {len(messages)}",
        "",
        "---",
        "",
    ]

    for msg in messages:
        role = msg.get("role", "unknown")
        content = msg.get("content", "").strip()
        timestamp = msg.get("created_at", "")
        model_id = msg.get("model_id")

        if role == "user":
            header = "### 👤 User"
            if timestamp:
                header += f" `({timestamp})`"
            lines.append(header)
            lines.append("")
            lines.append(content)
            lines.append("")
        elif role == "assistant":
            model_info = f" • Model: `{model_id}`" if model_id else ""
            header = f"### 🤖 Assistant{model_info}"
            if timestamp:
                header += f" `({timestamp})`"
            lines.append(header)
            lines.append("")
            lines.append(content)
            lines.append("")
        lines.append("---")
        lines.append("")

    return "\n".join(lines)


def export_to_text(conversation: Dict[str, Any], messages: List[Dict[str, Any]]) -> str:
    """
    Format conversation into clean, readable plain text.
    """
    title = conversation.get("title", "Conversation")
    created_at = conversation.get("created_at", "Unknown")
    updated_at = conversation.get("updated_at", "Unknown")

    divider = "=" * 64
    subdivider = "-" * 64

    lines = [
        divider,
        f"OMNIAI CHAT TRANSCRIPT: {title}",
        f"Created: {created_at}",
        f"Updated: {updated_at}",
        f"Total Messages: {len(messages)}",
        divider,
        "",
    ]

    for msg in messages:
        role = msg.get("role", "unknown").upper()
        content = msg.get("content", "").strip()
        timestamp = msg.get("created_at", "")
        model_id = msg.get("model_id")

        meta = f"[{role}]"
        if model_id and role == "ASSISTANT":
            meta += f" ({model_id})"
        if timestamp:
            meta += f" [{timestamp}]"

        lines.append(meta)
        lines.append(content)
        lines.append("")
        lines.append(subdivider)
        lines.append("")

    return "\n".join(lines)


def export_to_json(conversation: Dict[str, Any], messages: List[Dict[str, Any]]) -> str:
    """
    Format conversation into a sanitized JSON document.
    Strictly removes all database primary keys, connection strings, or system paths.
    """
    clean_messages = []
    for msg in messages:
        item = {
            "role": msg.get("role"),
            "content": msg.get("content"),
            "timestamp": msg.get("created_at"),
        }
        if msg.get("model_id"):
            item["model"] = msg.get("model_id")
        if msg.get("provider"):
            item["provider"] = msg.get("provider")
        if msg.get("effort"):
            item["effort"] = msg.get("effort")
        if msg.get("document_name"):
            item["referenced_document"] = msg.get("document_name")
        clean_messages.append(item)

    data = {
        "title": conversation.get("title", "Conversation"),
        "created_at": conversation.get("created_at"),
        "updated_at": conversation.get("updated_at"),
        "message_count": len(clean_messages),
        "messages": clean_messages,
    }

    return json.dumps(data, indent=2, ensure_ascii=False)
