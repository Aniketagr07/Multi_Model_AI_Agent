import re
import logging
from typing import Dict, List, Optional, Tuple
from pydantic import BaseModel, Field
from fastapi import HTTPException

from app.core.model_registry import ModelRegistry, ModelInfo

logger = logging.getLogger(__name__)


class RoutingDecision(BaseModel):
    """Structured result of an automatic routing decision."""
    chosen_model: ModelInfo
    category: str
    explanation: str
    confidence: str
    matched_patterns: List[str] = Field(default_factory=list)


class ModelRouter:
    """
    Deterministic, explainable rule-based router that selects an optimal
    configured AI model based on user query classification and model registry capabilities.
    
    Academic Note:
    Avoids expensive secondary LLM calls for meta-routing. Operates in <1ms with zero API token cost.
    """

    # Priority preference order per task category based on verified model capabilities
    CATEGORY_PREFERENCES: Dict[str, List[str]] = {
        "coding": [
            "llama-3.1-8b-instant",      # Groq LPU: ultra-fast token rate (500+ tok/s) ideal for code
            "llama-3.3-70b-versatile",
            "gemini-1.5-flash",
        ],
        "reasoning": [
            "gemini-1.5-pro",            # 1M token context and deep analytical synthesis
            "llama-3.3-70b-versatile",
            "gemini-1.5-flash",
            "llama-3.1-8b-instant",
        ],
        "writing": [
            "gemini-1.5-flash",          # High fluency and generous 15 RPM / 1M TPM quota
            "mixtral-8x7b-32768",
            "llama-3.1-8b-instant",
        ],
        "general": [
            "gemini-1.5-flash",          # Balanced general-purpose default
            "llama-3.1-8b-instant",
            "gemini-1.5-pro",
        ],
    }

    # Contextual regex patterns for deterministic classification
    PATTERNS: Dict[str, List[Tuple[str, re.Pattern, int]]] = {
        "coding": [
            ("code_block", re.compile(r"```[\s\S]*?```", re.IGNORECASE), 4),
            ("code_keywords", re.compile(r"\b(def\s+\w+|function\s+\w+|class\s+\w+|import\s+\w+|const\s+\w+|let\s+\w+|var\s+\w+)\b"), 3),
            ("debugging_keywords", re.compile(r"\b(debug|stack trace|traceback|syntax error|nullpointer|bug|fix this code|compiler error|exception)\b", re.IGNORECASE), 3),
            ("programming_concepts", re.compile(r"\b(python|javascript|typescript|c\+\+|java|rust|sql|html|css|algorithm|binary search|regex|json|api endpoint|unit test|git|docker)\b", re.IGNORECASE), 2),
            ("complexity_analysis", re.compile(r"\b(time complexity|space complexity|big o|o\(n\)|o\(log n\))\b", re.IGNORECASE), 3),
        ],
        "reasoning": [
            ("step_by_step", re.compile(r"\b(step[- ]by[- ]step|think step by step|walk through the logic|chain of thought)\b", re.IGNORECASE), 3),
            ("mathematical_derivation", re.compile(r"\b(calculate|derive|derivation|integral|derivative|formula|equation|proof|prove that|probability|bayes)\b", re.IGNORECASE), 3),
            ("logic_puzzles", re.compile(r"\b(logic puzzle|riddle|syllogism|premise|counterexample|truth table)\b", re.IGNORECASE), 3),
            ("tradeoff_comparison", re.compile(r"\b(trade[- ]offs?|pros and cons|architectural comparison|evaluate the differences|cost-benefit)\b", re.IGNORECASE), 2),
        ],
        "writing": [
            ("summarization", re.compile(r"\b(summarize|summarise|summary|tl;?dr|brief overview|bullet point summary)\b", re.IGNORECASE), 3),
            ("rewriting_editing", re.compile(r"\b(rewrite|paraphrase|rephrase|proofread|correct grammar|improve phrasing|make it concise)\b", re.IGNORECASE), 3),
            ("prose_generation", re.compile(r"\b(draft an email|write an essay|blog post|cover letter|speech|creative story|formal letter)\b", re.IGNORECASE), 3),
            ("tone_adjustment", re.compile(r"\b(formal tone|professional tone|casual tone|academic tone|persuasive)\b", re.IGNORECASE), 2),
        ],
    }

    def classify_request(self, message: str) -> Tuple[str, List[str]]:
        """
        Classifies the user query into a task category: 'coding', 'reasoning', 'writing', or 'general'.
        Returns the category name and a list of matched rule identifiers.
        """
        scores: Dict[str, int] = {cat: 0 for cat in self.PATTERNS}
        matched_rules: Dict[str, List[str]] = {cat: [] for cat in self.PATTERNS}

        for category, rules in self.PATTERNS.items():
            for rule_id, pattern, weight in rules:
                if pattern.search(message):
                    scores[category] += weight
                    matched_rules[category].append(rule_id)

        # Find the category with highest heuristic score
        best_category = max(scores, key=lambda c: scores[c])
        best_score = scores[best_category]

        # Minimum activation threshold to avoid spurious classifications
        if best_score >= 2:
            return best_category, matched_rules[best_category]

        return "general", ["default_heuristic"]

    def route_request(
        self,
        message: str,
        available_models: Optional[List[ModelInfo]] = None,
    ) -> RoutingDecision:
        """
        Evaluates the message prompt, selects an optimal available model,
        and provides an explainable routing rationalization.
        """
        if available_models is None:
            available_models = ModelRegistry.get_available_models()

        if not available_models:
            raise HTTPException(
                status_code=503,
                detail="No configured AI models are available. Please configure GEMINI_API_KEY or GROQ_API_KEY in backend/.env.",
            )

        category, matched_rules = self.classify_request(message)
        available_ids = {m.id: m for m in available_models}

        # Attempt to match preferred models for the identified category
        preferred_ids = self.CATEGORY_PREFERENCES.get(category, self.CATEGORY_PREFERENCES["general"])
        chosen_model: Optional[ModelInfo] = None
        for pid in preferred_ids:
            if pid in available_ids:
                chosen_model = available_ids[pid]
                break

        # Fallback to any available model if category preferences cannot be met
        if not chosen_model:
            chosen_model = available_models[0]
            confidence = "fallback"
            explanation = (
                f"Selected {chosen_model.name} ({chosen_model.tag}) via fallback policy. "
                f"The request was classified as '{category}', but primary preferred models were not configured."
            )
        else:
            if category == "coding":
                confidence = "rule_match"
                explanation = (
                    f"Selected {chosen_model.name} ({chosen_model.tag}) because this request was classified as a "
                    f"coding/debugging task (high token velocity and deterministic code synthesis)."
                )
            elif category == "reasoning":
                confidence = "rule_match"
                explanation = (
                    f"Selected {chosen_model.name} ({chosen_model.tag}) because this request was classified as an "
                    f"analytical/reasoning task (deep contextual reasoning and multi-step derivation)."
                )
            elif category == "writing":
                confidence = "rule_match"
                explanation = (
                    f"Selected {chosen_model.name} ({chosen_model.tag}) because this request was classified as a "
                    f"writing/summarization task (high verbal fluency and expansive context)."
                )
            else:
                confidence = "default_heuristic"
                explanation = (
                    f"Selected {chosen_model.name} ({chosen_model.tag}) using the general-purpose "
                    f"conversational routing policy."
                )

        return RoutingDecision(
            chosen_model=chosen_model,
            category=category,
            explanation=explanation,
            confidence=confidence,
            matched_patterns=matched_rules,
        )


_model_router: Optional[ModelRouter] = None


def get_model_router() -> ModelRouter:
    """Return singleton instance of ModelRouter."""
    global _model_router
    if _model_router is None:
        _model_router = ModelRouter()
    return _model_router

