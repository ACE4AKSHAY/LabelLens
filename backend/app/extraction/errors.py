class ExtractionProviderError(Exception):
    def __init__(
        self,
        message: str,
        *,
        retryable: bool = True,
        quota: bool = False,
        fallback_eligible: bool = False,
    ) -> None:
        super().__init__(message)
        self.retryable = retryable
        self.quota = quota
        self.fallback_eligible = fallback_eligible


class UnreadableResponseError(ExtractionProviderError):
    def __init__(self) -> None:
        super().__init__(
            "The vision model returned data that did not match the extraction contract.",
            retryable=True,
            fallback_eligible=True,
        )
