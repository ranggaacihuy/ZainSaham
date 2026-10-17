<?php
$ch = curl_init("https://generativelanguage.googleapis.com");
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_CAINFO, "C:/certs/cacert.pem");
curl_exec($ch);
echo "HTTP=" . curl_getinfo($ch, CURLINFO_HTTP_CODE) . PHP_EOL;
echo "SSL_ERROR=" . curl_error($ch) . PHP_EOL;
curl_close($ch);
