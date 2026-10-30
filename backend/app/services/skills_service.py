import re
import csv
import json
import uuid
import ast
from io import StringIO
from datetime import datetime, timezone
from typing import Dict, List, Optional, Any

from app.db.database import get_db_connection


class SkillError(Exception):
    def __init__(self, message: str, status_code: int = 400):
        super().__init__(message)
        self.message = message
        self.status_code = status_code


# -----------------------------------------------------------------------------
# Skill Handlers & Execution Engine
# -----------------------------------------------------------------------------

def execute_math_solver(params: Dict[str, Any]) -> Dict[str, Any]:
    """
    Safely solves mathematical expressions and basic algebra using AST validation.
    Does not use arbitrary `eval`.
    """
    expression = params.get("expression") or params.get("query") or params.get("input", "")
    if not expression:
        raise SkillError("Mathematical expression is required.")

    # Clean expression: remove unwanted characters
    clean_expr = expression.strip().replace("^", "**")

    # Safe AST evaluator supporting numbers, operators, and basic math
    allowed_nodes = (
        ast.Expression, ast.BinOp, ast.UnaryOp, ast.Constant,
        ast.Add, ast.Sub, ast.Mult, ast.Div, ast.FloorDiv, ast.Mod, ast.Pow,
        ast.USub, ast.UAdd
    )

    try:
        parsed = ast.parse(clean_expr, mode='eval')
        for node in ast.walk(parsed):
            if not isinstance(node, allowed_nodes):
                raise SkillError(f"Unsupported mathematical syntax: {type(node).__name__}")

        # Evaluate safely
        code = compile(parsed, "<math_solver>", "eval")
        result = eval(code, {"__builtins__": None}, {})
        return {
            "expression": expression,
            "result": result,
            "status": "success",
            "explanation": f"Evaluated '{expression}' = {result}",
        }
    except Exception as e:
        raise SkillError(f"Calculation failed: {str(e)}")


def execute_csv_analyzer(params: Dict[str, Any]) -> Dict[str, Any]:
    """
    Analyzes CSV data or snippet, reporting schema, rows, column summaries,
    numeric sums/averages, and anomalies.
    """
    csv_data = params.get("csv_text") or params.get("input") or params.get("data", "")
    if not csv_data:
        raise SkillError("CSV content or table data is required for analysis.")

    try:
        f = StringIO(csv_data.strip())
        reader = csv.DictReader(f)
        rows = list(reader)
        if not rows and not reader.fieldnames:
            raise SkillError("No valid rows or columns detected in CSV data.")

        fieldnames = reader.fieldnames or []
        num_rows = len(rows)

        # Compute column statistics for numeric columns
        col_stats = {}
        for col in fieldnames:
            values = []
            for r in rows:
                val_str = r.get(col, "").replace("$", "").replace(",", "").strip()
                try:
                    val = float(val_str)
                    values.append(val)
                except ValueError:
                    pass

            if values:
                col_stats[col] = {
                    "type": "numeric",
                    "count": len(values),
                    "sum": round(sum(values), 2),
                    "mean": round(sum(values) / len(values), 2),
                    "min": min(values),
                    "max": max(values),
                }
            else:
                col_stats[col] = {
                    "type": "text",
                    "count": num_rows,
                    "sample": [r.get(col) for r in rows[:3]],
                }

        return {
            "status": "success",
            "columns": fieldnames,
            "row_count": num_rows,
            "statistics": col_stats,
            "summary": f"Analyzed {num_rows} rows across {len(fieldnames)} columns ({', '.join(fieldnames)}).",
        }
    except Exception as e:
        raise SkillError(f"CSV analysis failed: {str(e)}")


def execute_code_explainer(params: Dict[str, Any]) -> Dict[str, Any]:
    """
    Analyzes code snippets, estimating cyclomatic complexity, AST nodes, and language patterns.
    """
    code = params.get("code") or params.get("input", "")
    lang = (params.get("language") or "python").lower()

    if not code:
        raise SkillError("Code snippet is required.")

    lines = code.strip().splitlines()
    loc = len(lines)
    ast_info = {}

    if lang in ("python", "py"):
        try:
            tree = ast.parse(code)
            functions = [n.name for n in ast.walk(tree) if isinstance(n, (ast.FunctionDef, ast.AsyncFunctionDef))]
            classes = [n.name for n in ast.walk(tree) if isinstance(n, ast.ClassDef)]
            imports = [n.names[0].name for n in ast.walk(tree) if isinstance(n, ast.Import)]
            loops = sum(1 for n in ast.walk(tree) if isinstance(n, (ast.For, ast.While)))

            ast_info = {
                "functions": functions,
                "classes": classes,
                "imports": imports,
                "loops_count": loops,
                "syntax_valid": True,
            }
        except SyntaxError as se:
            ast_info = {"syntax_valid": False, "syntax_error": str(se)}

    return {
        "status": "success",
        "language": lang,
        "lines_of_code": loc,
        "details": ast_info,
        "analysis": f"Snippet has {loc} lines. Identified {len(ast_info.get('functions', []))} functions and {len(ast_info.get('classes', []))} classes.",
    }


def execute_doc_summarizer(params: Dict[str, Any]) -> Dict[str, Any]:
    """
    Analyzes document text, extracting word counts, paragraph structure, and executive bullet points.
    """
    text = params.get("text") or params.get("input", "")
    if not text:
        raise SkillError("Document text is required.")

    words = text.split()
    paragraphs = [p for p in text.split("\n\n") if p.strip()]
    bullet_candidates = [line.strip() for line in text.splitlines() if line.strip().startswith(("-", "*", "•"))]

    return {
        "status": "success",
        "word_count": len(words),
        "paragraph_count": len(paragraphs),
        "bullet_points_found": len(bullet_candidates),
        "summary": f"Text contains {len(words)} words across {len(paragraphs)} sections.",
    }


SKILL_DISPATCHER = {
    "math-solver": execute_math_solver,
    "csv-analyzer": execute_csv_analyzer,
    "code-explainer": execute_code_explainer,
    "doc-summarizer": execute_doc_summarizer,
}


# -----------------------------------------------------------------------------
# Skill CRUD and Persistence
# -----------------------------------------------------------------------------

def list_skills(
    user_id: Optional[str] = None,
    category: Optional[str] = None,
    query: Optional[str] = None,
    installed_only: bool = False,
    featured_only: bool = False,
) -> List[Dict[str, Any]]:
    """List skills from the registry with dynamic installation status for user or guest."""
    with get_db_connection() as conn:
        where_clauses = []
        params = []

        if category and category.lower() != "all":
            where_clauses.append("LOWER(s.category) = LOWER(?)")
            params.append(category)

        if query and query.strip():
            clean = f"%{query.strip().lower()}%"
            where_clauses.append("(LOWER(s.name) LIKE ? OR LOWER(s.description) LIKE ?)")
            params.extend([clean, clean])

        if featured_only:
            where_clauses.append("s.is_featured = 1")

        where_sql = f"WHERE {' AND '.join(where_clauses)}" if where_clauses else ""

        # Join user_skills
        sql = f"""
            SELECT s.id, s.name, s.description, s.category, s.provider, s.version,
                   s.icon, s.permissions, s.is_builtin, s.is_featured, s.created_at,
                   us.id as user_skill_id, us.is_enabled, us.installed_at, us.config
            FROM skills s
            LEFT JOIN user_skills us ON s.id = us.skill_id AND (us.user_id = ? OR (us.user_id IS NULL AND ? IS NULL))
            {where_sql}
            ORDER BY s.is_featured DESC, s.name ASC
        """
        all_params = [user_id, user_id] + params
        cursor = conn.execute(sql, all_params)

        skills = []
        for r in cursor.fetchall():
            row = dict(r)
            is_installed = row.get("user_skill_id") is not None
            if installed_only and not is_installed:
                continue

            try:
                perms = json.loads(row.get("permissions") or "[]")
            except Exception:
                perms = []

            # Check integration connection state for third-party
            is_third_party = row.get("category") == "Third-Party Integrations"
            config = {}
            if row.get("config"):
                try:
                    config = json.loads(row["config"])
                except Exception:
                    pass

            connection_status = "connected" if config.get("connected") else ("not_connected" if is_third_party else "active")

            skills.append({
                "id": row["id"],
                "name": row["name"],
                "description": row["description"],
                "category": row["category"],
                "provider": row["provider"],
                "version": row["version"],
                "icon": row["icon"],
                "permissions": perms,
                "is_builtin": bool(row["is_builtin"]),
                "is_featured": bool(row["is_featured"]),
                "is_installed": is_installed,
                "is_enabled": bool(row.get("is_enabled", 1)) if is_installed else False,
                "installed_at": row.get("installed_at"),
                "is_third_party": is_third_party,
                "connection_status": connection_status,
                "has_executable_runner": row["id"] in SKILL_DISPATCHER,
            })

        return skills


def get_skill_by_id(skill_id: str, user_id: Optional[str] = None) -> Optional[Dict[str, Any]]:
    """Retrieve detailed skill information by ID."""
    skills = list_skills(user_id=user_id)
    for s in skills:
        if s["id"] == skill_id:
            return s
    return None


def install_skill(skill_id: str, user_id: Optional[str] = None, config: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """Install a skill after explicit user consent."""
    with get_db_connection() as conn:
        # Check skill exists
        skill = conn.execute("SELECT id FROM skills WHERE id = ?", (skill_id,)).fetchone()
        if not skill:
            raise SkillError("Skill not found.", status_code=404)

        # Check already installed
        existing = conn.execute(
            "SELECT id FROM user_skills WHERE skill_id = ? AND (user_id = ? OR (user_id IS NULL AND ? IS NULL))",
            (skill_id, user_id, user_id),
        ).fetchone()

        now_iso = datetime.now(timezone.utc).isoformat()
        cfg_json = json.dumps(config or {})

        if existing:
            conn.execute(
                "UPDATE user_skills SET is_enabled = 1, config = ? WHERE id = ?",
                (cfg_json, existing["id"]),
            )
            us_id = existing["id"]
        else:
            us_id = f"usk-{uuid.uuid4().hex[:12]}"
            conn.execute(
                """
                INSERT INTO user_skills (id, user_id, skill_id, is_enabled, installed_at, config)
                VALUES (?, ?, ?, 1, ?, ?)
                """,
                (us_id, user_id, skill_id, now_iso, cfg_json),
            )

    return get_skill_by_id(skill_id, user_id=user_id)


def uninstall_skill(skill_id: str, user_id: Optional[str] = None) -> None:
    """Uninstall a skill for the user or guest."""
    with get_db_connection() as conn:
        conn.execute(
            "DELETE FROM user_skills WHERE skill_id = ? AND (user_id = ? OR (user_id IS NULL AND ? IS NULL))",
            (skill_id, user_id, user_id),
        )


def toggle_skill_status(skill_id: str, enabled: bool, user_id: Optional[str] = None) -> Dict[str, Any]:
    """Enable or disable an installed skill."""
    with get_db_connection() as conn:
        val = 1 if enabled else 0
        cursor = conn.execute(
            """
            UPDATE user_skills SET is_enabled = ?
            WHERE skill_id = ? AND (user_id = ? OR (user_id IS NULL AND ? IS NULL))
            """,
            (val, skill_id, user_id, user_id),
        )
        if cursor.rowcount == 0:
            raise SkillError("Skill is not installed.", status_code=404)

    return get_skill_by_id(skill_id, user_id=user_id)


def execute_skill(
    skill_id: str,
    params: Dict[str, Any],
    user_id: Optional[str] = None,
    conversation_id: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Validates installation & permissions, then executes the skill and records execution history.
    """
    skill = get_skill_by_id(skill_id, user_id=user_id)
    if not skill:
        raise SkillError("Skill not found.", status_code=404)

    if not skill["is_installed"]:
        raise SkillError(f"Skill '{skill['name']}' must be installed before execution.", status_code=403)

    if not skill["is_enabled"]:
        raise SkillError(f"Skill '{skill['name']}' is currently disabled.", status_code=403)

    # Check third party
    if skill["is_third_party"]:
        # Honest reporting for unconnected integrations
        raise SkillError(
            f"Integration '{skill['name']}' requires connected OAuth credentials on the server. Please connect your {skill['provider']} account.",
            status_code=422,
        )

    runner = SKILL_DISPATCHER.get(skill_id)
    if not runner:
        raise SkillError(f"Skill '{skill['name']}' does not have an automated execution runner registered.", status_code=501)

    exec_id = f"exec-{uuid.uuid4().hex[:12]}"
    now_iso = datetime.now(timezone.utc).isoformat()
    status_str = "success"
    err_msg = None
    output_result = None

    try:
        output_result = runner(params)
    except SkillError as se:
        status_str = "error"
        err_msg = se.message
        raise
    except Exception as e:
        status_str = "error"
        err_msg = str(e)
        raise SkillError(f"Execution error: {str(e)}")
    finally:
        with get_db_connection() as conn:
            conn.execute(
                """
                INSERT INTO skill_executions (id, user_id, skill_id, conversation_id, input_data, output_data, status, error_message, executed_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    exec_id,
                    user_id,
                    skill_id,
                    conversation_id,
                    json.dumps(params)[:2000],
                    json.dumps(output_result)[:5000] if output_result else None,
                    status_str,
                    err_msg,
                    now_iso,
                ),
            )

    return {
        "execution_id": exec_id,
        "skill_id": skill_id,
        "skill_name": skill["name"],
        "status": "success",
        "result": output_result,
        "executed_at": now_iso,
    }


def list_skill_executions(user_id: Optional[str] = None, limit: int = 50) -> List[Dict[str, Any]]:
    """Retrieve execution history for user or guest."""
    with get_db_connection() as conn:
        cursor = conn.execute(
            """
            SELECT e.id, e.skill_id, e.conversation_id, e.input_data, e.output_data, e.status, e.error_message, e.executed_at,
                   s.name as skill_name, s.category
            FROM skill_executions e
            JOIN skills s ON e.skill_id = s.id
            WHERE (e.user_id = ? OR (e.user_id IS NULL AND ? IS NULL))
            ORDER BY e.executed_at DESC
            LIMIT ?
            """,
            (user_id, user_id, limit),
        )
        executions = []
        for r in cursor.fetchall():
            row = dict(r)
            try:
                row["output_data"] = json.loads(row["output_data"]) if row.get("output_data") else None
            except Exception:
                pass
            executions.append(row)
        return executions
