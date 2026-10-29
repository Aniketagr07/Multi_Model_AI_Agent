import asyncio
import time
import logging
from typing import Optional

from app.schemas.compare import (
    CompareRequest,
    CompareResponse,
    ModelComparisonResult,
)
from app.services.chat_service import ChatService, get_chat_service
from app.providers.base import (
    ProviderError,
    ProviderConfigError,
    ProviderAuthError,
    ProviderRateLimitError,
    ProviderTimeoutError,
)

logger = logging.getLogger(__name__)


class ComparisonService:
    """Orchestrates parallel execution and latency measurement for multi-model comparison."""

    def __init__(self, chat_service: Optional[ChatService] = None):
        self.chat_service = chat_service or get_chat_service()

    async def _execute_single_model(
        self,
        model_id: str,
        prompt: str,
        effort: str = "medium",
    ) -> ModelComparisonResult:
        """Execute query against one model, measuring latency and capturing failures safely."""
        model_info, provider = self.chat_service.resolve_model_and_provider(model_id)
        messages = [{"role": "user", "content": prompt}]

        # Independent monotonic timer
        start_time = time.perf_counter()

        try:
            response_text = await provider.generate_response(
                messages=messages,
                model_id=model_info.provider_model_id,
                effort=effort,
            )
            elapsed_ms = int((time.perf_counter() - start_time) * 1000)
            return ModelComparisonResult(
                model_id=model_info.id,
                name=model_info.name,
                provider=model_info.provider,
                success=True,
                response=response_text,
                latency_ms=elapsed_ms,
                effort=effort,
                error=None,
            )
        except ProviderConfigError as e:
            elapsed_ms = int((time.perf_counter() - start_time) * 1000)
            logger.warning("[%s Comparison] Configuration error: %s", model_info.name, e.message)
            return ModelComparisonResult(
                model_id=model_info.id,
                name=model_info.name,
                provider=model_info.provider,
                success=False,
                response=None,
                latency_ms=elapsed_ms,
                effort=effort,
                error=e.message,
            )
        except ProviderAuthError as e:
            elapsed_ms = int((time.perf_counter() - start_time) * 1000)
            logger.error("[%s Comparison] Auth error: %s", model_info.name, e.message)
            return ModelComparisonResult(
                model_id=model_info.id,
                name=model_info.name,
                provider=model_info.provider,
                success=False,
                response=None,
                latency_ms=elapsed_ms,
                effort=effort,
                error=e.message,
            )
        except ProviderRateLimitError as e:
            elapsed_ms = int((time.perf_counter() - start_time) * 1000)
            logger.warning("[%s Comparison] Rate limit error: %s", model_info.name, e.message)
            return ModelComparisonResult(
                model_id=model_info.id,
                name=model_info.name,
                provider=model_info.provider,
                success=False,
                response=None,
                latency_ms=elapsed_ms,
                effort=effort,
                error=e.message,
            )
        except ProviderTimeoutError as e:
            elapsed_ms = int((time.perf_counter() - start_time) * 1000)
            logger.warning("[%s Comparison] Timeout: %s", model_info.name, e.message)
            return ModelComparisonResult(
                model_id=model_info.id,
                name=model_info.name,
                provider=model_info.provider,
                success=False,
                response=None,
                latency_ms=elapsed_ms,
                effort=effort,
                error=e.message,
            )
        except ProviderError as e:
            elapsed_ms = int((time.perf_counter() - start_time) * 1000)
            logger.error("[%s Comparison] Provider error: %s", model_info.name, e.message)
            return ModelComparisonResult(
                model_id=model_info.id,
                name=model_info.name,
                provider=model_info.provider,
                success=False,
                response=None,
                latency_ms=elapsed_ms,
                effort=effort,
                error=e.message,
            )
        except Exception as e:
            elapsed_ms = int((time.perf_counter() - start_time) * 1000)
            logger.exception("[%s Comparison] Unexpected error: %s", model_info.name, str(e))
            return ModelComparisonResult(
                model_id=model_info.id,
                name=model_info.name,
                provider=model_info.provider,
                success=False,
                response=None,
                latency_ms=elapsed_ms,
                error=f"Unexpected error executing {model_info.name}.",
            )

    async def compare_models(self, request: CompareRequest) -> CompareResponse:
        """
        Broadcast the same user prompt concurrently to both models via asyncio.gather.
        Ensures partial failures are captured without aborting successful tasks.
        """
        effort = getattr(request, "effort", "medium") or "medium"
        task_a = self._execute_single_model(request.model_a_id, request.prompt, effort=effort)
        task_b = self._execute_single_model(request.model_b_id, request.prompt, effort=effort)

        # Parallel concurrent execution
        result_a, result_b = await asyncio.gather(task_a, task_b)

        return CompareResponse(
            prompt=request.prompt,
            effort=effort,
            model_a=result_a,
            model_b=result_b,
        )


_comparison_service: Optional[ComparisonService] = None


def get_comparison_service() -> ComparisonService:
    """Return singleton instance of ComparisonService."""
    global _comparison_service
    if _comparison_service is None:
        _comparison_service = ComparisonService()
    return _comparison_service

