const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());

// YouTube එකෙන් Video ID එකක් සොයාගැනීම (Search)
async function searchYouTube(query) {
    try {
        const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
        const { data } = await axios.get(searchUrl, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36' }
        });
        const match = data.match(/"videoId":"([^"]{11})"/);
        return match ? match[1] : null;
    } catch (e) { return null; }
}

// ප්‍රධාන MP3 ලබාදෙන Endpoint එක
app.get('/api/song', async (req, res) => {
    const query = req.query.url;
    if (!query) return res.status(400).send("සින්දුවේ නම ඇතුළත් කරන්න.");

    try {
        // 1. YouTube ID එක ලබාගැනීම
        let videoId = query.match(/(?:youtu\.be\/|youtube\.com\/(?:.*v=|\/shorts\/|embed\/))([^?&"'>]+)/)?.[1];
        if (!videoId) videoId = await searchYouTube(query);
        
        if (!videoId) return res.status(404).send("සින්දුව හමු වූයේ නැත.");

        // 2. VKR API එක මගින් MP3 ලබාගැනීම (මෙය 403 වැදෙන්නේ නැති ස්ථාවර එකකි)
        const targetUrl = `https://www.youtube.com/watch?v=${videoId}`;
        const conversion = await axios.get(`https://api.vkrhost.com/api/ytdl?url=${encodeURIComponent(targetUrl)}`);
        
        const mp3Link = conversion.data?.data?.mp3;

        if (mp3Link) {
            return res.redirect(mp3Link); // කෙලින්ම MP3 එකට යොමු කරයි
        } else {
            return res.status(500).send("බාගත කිරීමේ සබැඳිය ලබාගත නොහැක.");
        }

    } catch (error) {
        console.error("API Error:", error.message);
        res.status(500).send("සර්වර් දෝෂයකි.");
    }
});

app.get('/', (req, res) => res.send("<h1>Antigravity API is Active 🚀</h1>"));

app.listen(port, "0.0.0.0", () => {
    console.log(`Server is live on port ${port}`);
});
