<?php
/* ============================================================
   KEBUTSEMALAM — api.php
   Bridge antara frontend (JS) dan Claude API (Anthropic)
   ============================================================ */

// ===== HEADER =====
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

// Handle preflight OPTIONS request
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// ===== HANYA TERIMA POST =====
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => ['message' => 'Method not allowed. Use POST.']]);
    exit();
}

// ===== BACA BODY =====
$raw  = file_get_contents('php://input');
$body = json_decode($raw, true);

if (!$body) {
    http_response_code(400);
    echo json_encode(['error' => ['message' => 'Invalid JSON body.']]);
    exit();
}

// ===== VALIDASI API KEY =====
$apiKey = isset($body['apiKey']) ? trim($body['apiKey']) : '';

if (empty($apiKey)) {
    http_response_code(401);
    echo json_encode(['error' => ['message' => 'API key tidak ditemukan.']]);
    exit();
}

if (!str_starts_with($apiKey, 'sk-ant')) {
    http_response_code(401);
    echo json_encode(['error' => ['message' => 'Format API key tidak valid.']]);
    exit();
}

// ===== VALIDASI MESSAGES =====
$messages = isset($body['messages']) ? $body['messages'] : [];

if (empty($messages) || !is_array($messages)) {
    http_response_code(400);
    echo json_encode(['error' => ['message' => 'Messages tidak boleh kosong.']]);
    exit();
}

// ===== BUAT PAYLOAD UNTUK CLAUDE API =====
$model     = isset($body['model'])      ? $body['model']      : 'claude-sonnet-4-20250514';
$maxTokens = isset($body['max_tokens']) ? (int)$body['max_tokens'] : 2000;
$system    = isset($body['system'])     ? $body['system']     : '';

// Batasi max_tokens agar tidak terlalu boros
$maxTokens = max(100, min($maxTokens, 8000));

// Susun payload
$payload = [
    'model'      => $model,
    'max_tokens' => $maxTokens,
    'messages'   => $messages,
];

// Tambahkan system prompt kalau ada
if (!empty($system)) {
    $payload['system'] = $system;
}

// ===== KIRIM KE CLAUDE API =====
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
        'x-api-key: '        . $apiKey,
        'anthropic-version: 2023-06-01',
    ],
    // SSL verification (aktifkan di production)
    CURLOPT_SSL_VERIFYPEER => true,
    CURLOPT_SSL_VERIFYHOST => 2,
]);

$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$curlErr  = curl_error($ch);
curl_close($ch);

// ===== HANDLE CURL ERROR =====
if ($curlErr) {
    http_response_code(502);
    echo json_encode([
        'error' => [
            'message' => 'Gagal konek ke Claude API: ' . $curlErr
        ]
    ]);
    exit();
}

// ===== HANDLE RESPONSE =====
$decoded = json_decode($response, true);

if (!$decoded) {
    http_response_code(502);
    echo json_encode([
        'error' => [
            'message' => 'Response dari Claude API tidak valid.'
        ]
    ]);
    exit();
}

// Kalau Claude API return error, teruskan ke frontend
if (isset($decoded['error'])) {
    http_response_code($httpCode ?: 500);
    echo json_encode(['error' => $decoded['error']]);
    exit();
}

// ===== SUKSES — Kembalikan response ke frontend =====
http_response_code(200);
echo json_encode($decoded);
exit();
