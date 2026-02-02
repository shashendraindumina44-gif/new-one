const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());

// YouTube එකෙන් Video එකක් සොයාගැනීම
async function searchYouTube(query) {
    try {
        const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
        const { data } = await axios.get(searchUrl, {
            headers: { 'User-Agent': 'Mozilla/5.0' }
        });
        const videoId = data.match(/"videoId":"([^"]{11})"/)?.[1];
        return videoId || null;
    } catch (e) { return null; }
}

app.get('/api/song', async (req, res) => {
    const query = req.query.url;
    if (!query) return res.status(400).send("No query provided");

    try {
        let videoId = query.match(/(?:youtu\.be\/|youtube\.com\/(?:.*v=|\/shorts\/|embed\/))([^?&"'>]+)/)?.[1];
        if (!videoId) videoId = await searchYouTube(query);
        if (!videoId) return res.status(404).send("Song not found");

        const targetUrl = `https://www.youtube.com/watch?v=${videoId}`;

        // මෙහිදී අපි විශ්වාසවන්ත Convertor එකකින් සින්දුව බාගෙන කෙලින්ම යවනවා (Stream)
        // Redirect කරන්නේ නැතුව Data එකම දෙනවා
        const conversionRes = await axios.get(`https://api.vkrhost.com/api/ytdl?url=${encodeURIComponent(targetUrl)}`);
        const downloadUrl = conversionRes.data?.data?.mp3;

        if (!downloadUrl) return res.status(500).send("Conversion failed");

        // සින්දුවේ දත්ත බාගෙන response එක ලෙස යැවීම
        const audioStream = await axios({
            method: 'get',
            url: downloadUrl,
            responseType: 'arraybuffer'
        });

        res.set('Content-Type', 'audio/mpeg');
        res.send(audioStream.data);

    } catch (error) {
        res.status(500).send("Error fetching audio");
    }
});

app.listen(port, "0.0.0.0", () => console.log(`API is live on ${port}`));
