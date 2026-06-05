import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_FILE = path.join(__dirname, 'data.json');

async function createServer() {
    const app = express();

    // Middleware to parse JSON bodies
    app.use(express.json({ limit: '50mb' }));

    // API Routes
    app.get('/api/schedules', (req, res) => {
        try {
            if (fs.existsSync(DATA_FILE)) {
                const data = fs.readFileSync(DATA_FILE, 'utf-8');
                res.json(JSON.parse(data));
            } else {
                res.json([]);
            }
        } catch (error) {
            console.error('Error reading data:', error);
            res.status(500).json({ error: 'Failed to read data' });
        }
    });

    app.post('/api/schedules', (req, res) => {
        try {
            const schedules = req.body;
            fs.writeFileSync(DATA_FILE, JSON.stringify(schedules, null, 2));
            res.json({ success: true });
        } catch (error) {
            console.error('Error saving data:', error);
            res.status(500).json({ error: 'Failed to save data' });
        }
    });

    const MATERIALS_FILE = path.join(__dirname, 'materials.json');

    app.get('/api/materials', (req, res) => {
        try {
            if (fs.existsSync(MATERIALS_FILE)) {
                // Read with higher limit if needed, but file read is sync here
                const data = fs.readFileSync(MATERIALS_FILE, 'utf-8');
                res.json(JSON.parse(data));
            } else {
                res.json([]);
            }
        } catch (error) {
            console.error('Error reading material data:', error);
            res.status(500).json({ error: 'Failed to read material data' });
        }
    });

    app.post('/api/materials', (req, res) => {
        try {
            const materials = req.body;
            // Ensure directory exists if needed, but __dirname is root usually
            fs.writeFileSync(MATERIALS_FILE, JSON.stringify(materials, null, 2));
            res.json({ success: true });
        } catch (error) {
            console.error('Error saving material data:', error);
            res.status(500).json({ error: 'Failed to save material data' });
        }
    });

    // AI Chat Endpoint
    app.post('/api/ai/chat', async (req, res) => {
        try {
            const { message, scheduleData, apiKey } = req.body;

            if (!apiKey) {
                console.error('AI Chat Error: API Key is missing in request body');
                return res.status(400).json({ error: 'API Key is required' });
            }

            console.log(`AI Chat Request received. Key length: ${apiKey.length}, Message length: ${message?.length}`);

            // Construct System Prompt
            const systemPrompt = `
あなたは優秀な製造工場の生産管理アシスタントです。
ユーザー（工場長や担当者）の質問に対し、提供されたスケジュールデータを元に的確に回答してください。

## スケジュールデータ（JSON）
\`\`\`json
${JSON.stringify(scheduleData)}
\`\`\`

## ルール
1. **事実に基いて回答する**: 提供されたデータにないことは「わかりません」と答えるか、推測であることを明示してください。
2. **簡潔に**: 工場の現場で使うため、長々とした挨拶は不要です。結論から述べてください。
3. **分析**: 遅延（isCompleted: false かつ 現在時刻を過ぎている 等）や、特定の機械の負荷状況などを聞かれたら分析して答えてください。
4. **トーン**: 丁寧ですが、プロフェッショナルな口調で（「〜です」「〜ます」）。
            `;

            const requestBody = {
                contents: [
                    {
                        parts: [
                            { text: systemPrompt + "\n\n## ユーザーの質問\n" + message }
                        ]
                    }
                ]
            };

            console.log('Sending request to Gemini REST API...');
            // Use gemini-flash-latest as exact version might vary by region/key
            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${apiKey}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(requestBody)
            });

            if (!response.ok) {
                const errorData = await response.json();
                console.error('Gemini REST API Error:', JSON.stringify(errorData, null, 2));
                throw new Error(`Gemini API Error: ${errorData.error?.message || response.statusText}`);
            }

            const data = await response.json();
            console.log('Gemini REST API response received successfully.');

            const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "申し訳ありません、回答を生成できませんでした。";

            res.json({ reply: text });

        } catch (error) {
            console.error('AI Chat Error Details:', error);
            res.status(500).json({ error: 'AI processing failed: ' + (error.message || error.toString()) });
        }
    });

    // Create Vite server in middleware mode and configure the app type as 'custom'
    // This disables Vite's own HTML serving logic so parent server can take control
    const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: 'custom'
    });

    // Use vite's connect instance as middleware. If you use your own
    // express router (express.Router()), you should use router.use
    app.use(vite.middlewares);

    app.use(/(.*)/, async (req, res, next) => {
        const url = req.originalUrl;

        try {
            // 1. Read index.html
            let template = fs.readFileSync(
                path.resolve(__dirname, 'index.html'),
                'utf-8'
            );

            // 2. Apply Vite HTML transforms. This injects the Vite HMR client, and
            //    also applies HTML transforms from Vite plugins, e.g. global preambles
            //    from @vitejs/plugin-react
            template = await vite.transformIndexHtml(url, template);

            // 3. Send the rendered HTML back.
            res.status(200).set({ 'Content-Type': 'text/html' }).end(template);
        } catch (e) {
            // If an error is caught, let Vite fix the stack trace so it maps back
            // to your actual source code.
            vite.ssrFixStacktrace(e);
            next(e);
        }
    });



    app.listen(5173, '0.0.0.0', () => {
        console.log('Server running at http://localhost:5173');
    });
}

createServer();
