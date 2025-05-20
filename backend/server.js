const express = require("express");
const bodyParser = require("body-parser");
const admin = require("firebase-admin");
const cors = require("cors");
const { MercadoPagoConfig, Preference, Payment } = require("mercadopago");
require("dotenv").config();

const app = express();
app.use(cors());
app.use(bodyParser.json());

// 🔐 Firebase
let serviceAccount;
try {
  serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY_JSON);
} catch (err) {
  console.error("Erro ao carregar as credenciais Firebase:", err);
  process.exit(1);
}

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});
const db = admin.firestore();
const numerosRef = db.collection("rifa").doc("numeros");

// 🛒 Mercado Pago
const mp = new MercadoPagoConfig({
  accessToken: process.env.MP_ACCESS_TOKEN,
});

// 🧾 Criar pagamento com reserva
app.post("/create-payment", async (req, res) => {
  const { nome, telefone, numeros } = req.body;
  if (!nome || !telefone || !Array.isArray(numeros) || numeros.length === 0) {
    return res.status(400).json({ error: "Dados incompletos ou inválidos." });
  }

  try {
    const doc = await numerosRef.get();
    if (!doc.exists) {
      return res.status(500).json({ error: "Documento de números não encontrado." });
    }

    const data = doc.data();
    const agora = Date.now();
    const quinzeMin = 15 * 60 * 1000;
    const atual = data.lista;

    for (const n of numeros) {
      const entry = atual[n];
      if (!entry || entry.status === "disponivel") continue;

      if (entry.status === "reservado" && agora - entry.timestamp > quinzeMin) {
        atual[n] = { status: "disponivel" };
        continue;
      }

      return res.status(400).json({ error: `Número ${n} já está ${entry.status}` });
    }

    numeros.forEach((n) => {
      atual[n] = {
        status: "reservado",
        nome,
        telefone,
        timestamp: Date.now(),
      };
    });

    await numerosRef.update({ lista: atual });

    const total = numeros.length * 4.99;
    const preference = new Preference(mp);
    const preferenceResponse = await preference.create({
      body: {
        items: [
          {
            title: `Rifa: ${numeros.join(", ")}`,
            quantity: 1,
            unit_price: total,
          },
        ],
        payer: { name: nome },
        payment_methods: {
          excluded_payment_types: [{ id: "credit_card" }],
          default_payment_method_id: "pix",
        },
        notification_url: process.env.NOTIFICATION_URL,
        external_reference: numeros.join(","),
      },
    });

    res.json({ init_point: preferenceResponse.init_point });
  } catch (err) {
    console.error("Erro ao criar pagamento:", err);
    res.status(500).json({ error: "Erro ao criar pagamento" });
  }
});

// 📩 Webhook Mercado Pago
app.post("/webhook", async (req, res) => {
  try {
    const paymentId = req.body.data?.id;
    if (!paymentId) return res.sendStatus(400);

    const payment = new Payment(mp);
    const paymentResponse = await payment.get({ id: paymentId });

    if (paymentResponse.status === "approved") {
      const numeros = paymentResponse.external_reference.split(",").map((n) => n.trim());
      const doc = await numerosRef.get();
      const data = doc.data();
      const atual = data.lista;

      numeros.forEach((n) => {
        if (atual[n]) {
          atual[n].status = "pago";
          atual[n].pagamento_confirmado_em = Date.now();
        }
      });

      await numerosRef.update({ lista: atual });
      console.log("Pagamento confirmado para:", numeros.join(", "));
    }

    res.sendStatus(200);
  } catch (err) {
    console.error("Erro no webhook:", err);
    res.sendStatus(500);
  }
});

// 📄 Listar números (e liberar reservas expiradas)
app.get("/numeros", async (req, res) => {
  try {
    const doc = await numerosRef.get();
    const data = doc.data();
    const lista = data.lista;
    const agora = Date.now();
    const quinzeMin = 15 * 60 * 1000;
    let atualizado = false;

    const saida = Object.entries(lista).map(([n, v]) => {
      if (v.status === "reservado" && agora - v.timestamp > quinzeMin) {
        v.status = "disponivel";
        atualizado = true;
      }
      return { numero: n, status: v.status };
    });

    if (atualizado) {
      await numerosRef.update({ lista });
    }

    res.json(saida);
  } catch (err) {
    console.error("Erro ao listar números:", err);
    res.status(500).json({ error: "Erro ao listar números" });
  }
});

// 🔍 Buscar ganhador
app.get("/ganhador/:numero", async (req, res) => {
  try {
    const n = req.params.numero;
    const doc = await numerosRef.get();
    const data = doc.data();
    const info = data.lista[n];

    if (!info) return res.status(404).json({ error: "Número não encontrado" });
    if (info.status !== "pago") return res.status(400).json({ error: "Número ainda não pago" });

    res.json({
      numero: n,
      nome: info.nome,
      telefone: info.telefone,
      status: info.status,
    });
  } catch (err) {
    console.error("Erro ao buscar ganhador:", err);
    res.status(500).json({ error: "Erro interno" });
  }
});

// 🎯 Sortear um número pago
app.get("/sortear", async (req, res) => {
  try {
    const doc = await numerosRef.get();
    const lista = doc.data().lista;
    const pagos = Object.entries(lista)
      .filter(([_, v]) => v.status === "pago")
      .map(([n, v]) => ({ numero: n, ...v }));

    if (pagos.length === 0) {
      return res.status(400).json({ error: "Nenhum número pago para sortear." });
    }

    const sorteado = pagos[Math.floor(Math.random() * pagos.length)];
    res.json({
      mensagem: "Número sorteado com sucesso!",
      numero: sorteado.numero,
      nome: sorteado.nome,
      telefone: sorteado.telefone,
    });
  } catch (err) {
    console.error("Erro ao sortear:", err);
    res.status(500).json({ error: "Erro ao sortear número" });
  }
});

// 🏠 Rota padrão
app.get("/", (req, res) => {
  res.send("✅ API da Rifa com Firestore (único documento) e Mercado Pago 2.7");
});

// ▶️ Start
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));
