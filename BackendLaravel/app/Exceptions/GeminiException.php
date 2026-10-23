<?php

namespace App\Exceptions;

use RuntimeException;
use Throwable;

class GeminiException extends RuntimeException
{
    public function __construct(
        string $message,
        public readonly string $userMessage = 'AI belum dapat membalas. Silakan coba lagi.',
        public readonly int $httpStatus = 0,
        ?Throwable $previous = null,
        public readonly bool $retryable = false
    ) {
        parent::__construct($message, 0, $previous);
    }
}
