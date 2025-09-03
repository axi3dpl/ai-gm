import 'dotenv/config';
import express from 'express'; import cors from 'cors';
const app = express(); app.use(cors()); app.use(express.json());
const PORT = process.env.PORT || 8787;
app.get('/health', (_req, res) => res.json({ ok: true, service: 'ai-gm-server' }));
app.get('/api/roll', (req, res) => { const s=Number(req.query.sides??20); const r=Math.floor(Math.random()*s)+1; res.json({sides:s,result:r,at:new Date().toISOString()}); });
app.listen(PORT, () => console.log(`Server http://localhost:${PORT}`));
