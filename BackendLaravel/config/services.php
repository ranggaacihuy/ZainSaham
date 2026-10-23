<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Third Party Services
    |--------------------------------------------------------------------------
    |
    | This file is for storing the credentials for third party services such
    | as Resend, Postmark, AWS, and more. This file provides the de facto
    | location for this type of information, allowing packages to have
    | a conventional file to locate the various service credentials.
    |
    */

    'postmark' => [
        'key' => env('POSTMARK_API_KEY'),
    ],

    'resend' => [
        'key' => env('RESEND_API_KEY'),
    ],

    'ses' => [
        'key' => env('AWS_ACCESS_KEY_ID'),
        'secret' => env('AWS_SECRET_ACCESS_KEY'),
        'region' => env('AWS_DEFAULT_REGION', 'us-east-1'),
    ],

    'slack' => [
        'notifications' => [
            'bot_user_oauth_token' => env('SLACK_BOT_USER_OAUTH_TOKEN'),
            'channel' => env('SLACK_BOT_USER_DEFAULT_CHANNEL'),
        ],
    ],

    'gemini' => [
        'api_key' => env('GEMINI_API_KEY'),
        'model' => env('GEMINI_MODEL', 'gemini-3.8-flash'),
        'fallback_models' => env('GEMINI_FALLBACK_MODELS', 'gemini-3.6-flash,gemini-3.5-flash-lite'),
        'ca_bundle' => env('GEMINI_CA_BUNDLE'),
        'timeout' => (int) env('GEMINI_TIMEOUT', 40),
        'total_timeout' => (int) env('GEMINI_TOTAL_TIMEOUT', 60),
        'max_output_tokens' => (int) env('GEMINI_MAX_OUTPUT_TOKENS', 8192),
        'temperature' => (float) env('GEMINI_TEMPERATURE', 0.7),
    ],

    'yahoo_finance' => [
        'base_url' => env('YAHOO_FINANCE_BASE_URL', 'https://query1.finance.yahoo.com'),
        'suffix' => env('YAHOO_FINANCE_SUFFIX', '.JK'),
        'timeout' => (int) env('YAHOO_FINANCE_TIMEOUT', 20),
        'delay_ms' => (int) env('YAHOO_FINANCE_DELAY_MS', 800),
        'quote_ttl' => (int) env('YAHOO_FINANCE_QUOTE_TTL', 15),
    ],

];
