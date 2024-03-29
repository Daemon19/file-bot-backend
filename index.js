import express from 'express';
import 'dotenv/config';
import { Client, Events, GatewayIntentBits } from 'discord.js';
import multer from 'multer';
import { body, param } from 'express-validator';

const PORT = process.env.PORT || 3000;

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});
await loginAndWait(client, process.env.TOKEN);
const channel = client.channels.cache.get(process.env.CHANNEL_ID);

const upload = multer({ dest: 'uploads/' });

const app = express();

app.use(express.json());

app.get('/files', async (req, res) => {
  const messages = await channel.messages.fetch({ cache: true });
  const data = messages
    .filter((m) => m.attachments.size !== 0)
    .map((m) => ({
      id: m.id,
      attributes: {
        createdAt: m.createdAt,
        name: m.attachments.first().name,
        url: m.attachments.first().url,
      },
    }));
  res.json({ data });
});

app.post('/files', upload.single('file'), async (req, res) => {
  const metadata = {
    name: req.file.originalname,
  };
  const message = await channel.send({
    content: JSON.stringify(metadata),
    files: [
      {
        attachment: req.file.path,
        name: req.file.originalname,
      },
    ],
  });
  const data = messageToReponseData(message);
  res.status(201).json({ data });
});

app.put(
  '/files/:id',
  param('id').notEmpty().custom(foundId),
  body('name').notEmpty().isString(),
  async (req, res) => {
    const message = await channel.messages.fetch(req.params.id);
    const metadata = JSON.parse(message.content)
    metadata.name = req.body.name;
    await message.edit(JSON.stringify(metadata));
    const data = messageToReponseData(message);
    res.send({ data });
  }
);

app.delete(
  '/files/:id',
  param('id').notEmpty().custom(foundId),
  async (req, res) => {
    const { id } = req.params;
    await channel.messages.delete(id);
    res.status(204).send();
  }
);

app.listen(PORT, () =>
  console.log(`Listening at port http://localhost:${PORT}`)
);

function loginAndWait(client, token) {
  return new Promise((res, rej) => {
    client.once(Events.ClientReady, () => {
      client.off(Events.Error, rej);
      res();
    });
    client.on(Events.Error, rej);
    client.login(token);
  });
}

async function foundId(id) {
  try {
    await channel.messages.fetch(id);
  } catch (error) {
    throw new Error(error);
  }
  return true;
}

function messageToReponseData(message) {
  const metadata = message.content;
  const data = {
    id: message.id,
    attributes: {
      createdAt: message.createdAt,
      name: metadata.name,
      url: message.attachments.first().url,
    },
  };
  return data;
}
