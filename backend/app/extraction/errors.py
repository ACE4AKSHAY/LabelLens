class ExtractionProviderError(Exception):
    def __init__(self, message: str, *, retryable: bool = True, quota: bool = False) -> None:
        super().__init__(message)
        self.retryable = retryable
        self.quota = quota


class UnreadableResponseError(ExtractionProviderError):
    def __init__(self) -> None:
        super().__init__(
            "The vision model returned data that did not match the extraction contract.",
            retryable=True,
        )
