const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// --- YT Search Function (අලුතින් එකතු කළා) ---
async function searchYouTube(query) {
    try {
        const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
        const { data } = await axios.get(searchUrl, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' }
        });
        const match = data.match(/"videoId":"([^"]{11})"/);
        return match ? match[1] : null;
    } catch (e) { return null; }
}

const CONFIG = {
    YTMP3_AS: {
        BASE: 'https://app.ytmp3.as/',
        INIT: 'https://gamma.gammacloud.net/api/v1/init',
        HEADERS: {
            'Accept': '*/*',
            'Origin': 'https://app.ytmp3.as',
            'Referer': 'https://app.ytmp3.as/',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
    },
    CNV: {
        KEY_URL: 'https://cnv.cx/v2/sanity/key',
        CONV_URL: 'https://cnv.cx/v2/converter',
        HEADERS: {
            'origin': 'https://iframe.y2meta-uk.com',
            'referer': 'https://iframe.y2meta-uk.com/',
            'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
    },
    Y2MATE: {
        API_KEY: 'dfcb6d76f2f6a9894gjkege8a4ab232222',
        ENDPOINTS: ['p.lbserver.xyz', 'p.savenow.to'],
        HEADERS: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Referer': 'https://y2mate.yt/'
        }
    }
};

let activeSession = {
    auth: 'F1HY0PEK41OoQsZbEJsXSPVVuDBwkJV5',
    param: 'e',
    lastUpdate: 0
};

function extractVideoId(url) {
    if (!url) return null;
    const match = url.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/|youtube\.com\/shorts\/)([^"&?\/\s]{11})/);
    return match ? match[1] : null;
}

async function callY2MateApi(path, params) {
    let lastError;
    for (const domain of CONFIG.Y2MATE.ENDPOINTS) {
        try {
            const response = await axios.get(`https://${domain}${path}`, {
                params: { ...params, api: CONFIG.Y2MATE.API_KEY },
                headers: CONFIG.Y2MATE.HEADERS,
                timeout: 10000
            });
            return response.data;
        } catch (error) {
            lastError = error;
        }
    }
    throw lastError;
}

async function refreshYtmp3Session() {
    if (Date.now() - activeSession.lastUpdate < 3600000) return;
    try {
        const { data: html } = await axios.get(CONFIG.YTMP3_AS.BASE, { headers: CONFIG.YTMP3_AS.HEADERS, timeout: 5000 });
        const jsonMatch = html.match(/var json = JSON\.parse\('([^']+)'\);/);
        if (jsonMatch) {
            const json = JSON.parse(jsonMatch[1]);
            let e = "";
            for (let t = 0; t < json[0].length; t++) e += String.fromCharCode(json[0][t] - json[2][json[2].length - (t + 1)]);
            if (json[1]) e = e.split("").reverse().join("");
            activeSession.auth = e.length > 32 ? e.substring(0, 32) : e;
            activeSession.param = String.fromCharCode(json[6]);
            activeSession.lastUpdate = Date.now();
        }
    } catch (e) {
        console.error("Session Refresh Failed:", e.message);
    }
}

async function cnvConvert(videoId) {
    try {
        const url = `https://www.youtube.com/watch?v=${videoId}`;
        const { data: k } = await axios.get(CONFIG.CNV.KEY_URL, { headers: CONFIG.CNV.HEADERS, timeout: 5000 });
        const { data: c } = await axios.post(CONFIG.CNV.CONV_URL,
            new URLSearchParams({ link: url, format: 'mp3', audioBitrate: '320' }).toString(),
            { headers: { ...CONFIG.CNV.HEADERS, 'key': k.key, 'content-type': 'application/x-www-form-urlencoded' }, timeout: 12000 }
        );
        return c?.url || null;
    } catch (e) { return null; }
}

async function y2DownConvert(videoId, format = 'mp3') {
    try {
        const targetUrl = `https://www.youtube.com/watch?v=${videoId}`;
        const init = await callY2MateApi('/ajax/download.php', { copyright: 0, format: format, url: targetUrl });
        if (!init || !init.id) return null;
        for (let i = 0; i < 30; i++) {
            const prog = await callY2MateApi('/api/progress', { id: init.id });
            if ((prog.success == 1 || prog.text === 'Finished') && prog.download_url) return prog.download_url;
            if (prog.text === 'Error') return null;
            await new Promise(r => setTimeout(r, 2000));
        }
    } catch (e) { return null; }
    return null;
}

async function ytmp3asConvert(videoId) {
    try {
        await refreshYtmp3Session();
        const ts = Math.floor(Date.now() / 1000);
        const { data: init } = await axios.get(`${CONFIG.YTMP3_AS.INIT}?${activeSession.param}=${activeSession.auth}&t=${ts}`, { headers: CONFIG.YTMP3_AS.HEADERS, timeout: 6000 });
        if (!init || init.error) return null;
        const { data: conv } = await axios.get(`${init.convertURL}&v=${videoId}&f=mp3&t=${ts}`, { headers: CONFIG.YTMP3_AS.HEADERS, timeout: 8000 });
        if (!conv || conv.error) return null;
        if (conv.progressURL) {
            for (let i = 0; i < 20; i++) {
                const { data: st } = await axios.get(`${conv.progressURL}&t=${Math.floor(Date.now() / 1000)}`, { headers: CONFIG.YTMP3_AS.HEADERS, timeout: 5000 });
                if (st.progress >= 3) return conv.downloadURL;
                if (st.error) break;
                await new Promise(r => setTimeout(r, 2000));
            }
        }
        return conv.downloadURL || null;
    } catch (e) { return null; }
}

async function ytmp3ggConvert(videoId) {
    try {
        const { data: conv } = await axios.post('https://ytmp3.gg/api/converter',
            new URLSearchParams({ url: `https://www.youtube.com/watch?v=${videoId}`, format: 'mp3', quality: '320' }).toString(),
            { headers: { 'User-Agent': CONFIG.YTMP3_AS.HEADERS['User-Agent'], 'Referer': 'https://ytmp3.gg/' }, timeout: 10000 }
        );
        return conv?.status === 'success' ? conv.url : null;
    } catch (e) { return null; }
}

async function getHybridMp3(videoId) {
    return await cnvConvert(videoId) || await ytmp3ggConvert(videoId) || await ytmp3asConvert(videoId) || await y2DownConvert(videoId, 'mp3');
}

// --- Endpoints ---
app.get('/', (req, res) => {
    res.send(`<h1>Antigravity API is Running</h1>`);
});

// Bot එකේ ඉල්ලීම (Request) හසුරුවන කොටස
app.get('/api/song', async (req, res) => {
    let query = req.query.url;
    if (!query) return res.status(400).send("Input required.");

    let videoId = extractVideoId(query);
    
    // නමක් දුන්නොත් එය Search කරන්න
    if (!videoId) {
        videoId = await searchYouTube(query);
    }

    if (!videoId) return res.status(404).send("Song not found.");

    const link = await getHybridMp3(videoId);
    link ? res.redirect(link) : res.status(500).send("Conversion failed.");
});

app.listen(port, "0.0.0.0", () => {
    console.log(`Server is live on port ${port}`);
});
