<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

Schedule::command('market:sync --range=5d')
    ->weekdays()
    ->everyFifteenMinutes()
    ->between('09:00', '16:30')
    ->timezone('Asia/Jakarta')
    ->withoutOverlapping();

Schedule::command('market:sync --range=1mo')
    ->weekdays()
    ->at('17:00')
    ->timezone('Asia/Jakarta')
    ->withoutOverlapping();
