const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());

// YouTube Search - වඩාත් ස්ථාවර ක්‍රමය
async function searchYouTube(query) {
    try {
        const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
        const { data } = await axios.get(url, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36' }
        });
        const match = data.match(/"videoId":"([^"]{11})"/);
        return match ? match[1] : null;
    } catch (e) {
        console.error("YouTube Search Error:", e.message);
        return null;
    }
}

app.get('/api/song', async (req, res) => {
    const query = req.query.url;
    if (!query) return res.status(400).send("සින්දුවක නමක් අවශ්‍යයි.");

    try {
        let videoId = query.match(/(?:youtu\.be\/|youtube\.com\/(?:.*v=|\/shorts\/|embed\/))([^?&"'>]+)/)?.[1];
        
        if (!videoId) {
            videoId = await searchYouTube(query);
        }
        
        if (!videoId) return res.status(404).send("සින්දුව හමු වූයේ නැත.");

        const targetUrl = `https://www.youtube.com/watch?v=${videoId}`;
        
        // VKR API එක හරහා සින්දුව ලබා ගැනීම
        const response = await axios.get(`https://api.vkrhost.com/api/ytdl?url=${encodeURIComponent(targetUrl)}`);
        const mp3Link = response.data?.data?.mp3;

        if (mp3Link) {
            console.log("Redirecting to:", mp3Link);
            return res.redirect(mp3Link);
        } else {
            return res.status(500).send("බාගත කිරීමේ සබැඳිය සකසා ගැනීමට නොහැකි විය.");
        }

    } catch (error) {
        console.error("API Main Error:", error.message);
        res.status(500).send("සර්වර් දෝෂයකි.");
    }
});

app.get('/', (req, res) => res.send("Antigravity API is Online 🚀"));
app.listen(port, "0.0.0.0", () => console.log(`Server live on ${port}`));
