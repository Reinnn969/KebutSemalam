<?php
/* ============================================================
   KEBUTSEMALAM — api.php
   API key disimpan di server (lebih aman)
   ============================================================ */

// ===== GANTI KEY DI SINI =====
$API_KEY = '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';
// ================================

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => ['message' => 'Method not allowed.']]);
    exit();
}

$raw  = file_get_contents('php://input');
$body = json_decode($raw, true);

if (!$body) {
    http_response_code(400);
    echo json_encode(['error' => ['message' => 'Invalid JSON body.']]);
    exit();
}

$messages  = isset($body['messages'])    ? $body['messages']    : [];
$model     = isset($body['model'])       ? $body['model']       : 'claude-sonnet-4-20250514';
$maxTokens = isset($body['max_tokens'])  ? (int)$body['max_tokens'] : 2000;
$system    = isset($body['system'])      ? $body['system']      : '';

if (empty($messages) || !is_array($messages)) {
    http_response_code(400);
    echo json_encode(['error' => ['message' => 'Messages tidak boleh kosong.']]);
    exit();
}

$maxTokens = max(100, min($maxTokens, 8000));

$payload = [
    'model'      => $model,
    'max_tokens' => $maxTokens,
    'messages'   => $messages,
];
if (!empty($system)) $payload['system'] = $system;

$ch = curl_init();
curl_setopt_array($ch, [
    CURLOPT_URL            => 'https://api.anthropic.com/v1/messages',
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_POST           => true,
    CURLOPT_POSTFIELDS     => json_encode($payload),
    CURLOPT_TIMEOUT        => 60,
    CURLOPT_CONNECTTIMEOUT => 15,
    CURLOPT_HTTPHEADER     => [
        'Content-Type: application/json',
        'x-api-key: '        . $API_KEY,
        'anthropic-version: 2023-06-01',
    ],
    CURLOPT_SSL_VERIFYPEER => true,
    CURLOPT_SSL_VERIFYHOST => 2,
]);

$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$curlErr  = curl_error($ch);
curl_close($ch);

if ($curlErr) {
    http_response_code(502);
    echo json_encode(['error' => ['message' => 'Gagal konek ke Claude API: ' . $curlErr]]);
    exit();
}

$decoded = json_decode($response, true);

if (!$decoded) {
    http_response_code(502);
    echo json_encode(['error' => ['message' => 'Response tidak valid.']]);
    exit();
}

if (isset($decoded['error'])) {
    http_response_code($httpCode ?: 500);
    echo json_encode(['error' => $decoded['error']]);
    exit();
}

http_response_code(200);
echo json_encode($decoded);
exit();
