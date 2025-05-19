const express = require("express");
const bodyParser = require("body-parser");
const admin = require("firebase-admin");
const cors = require("cors");
const mercadopago = require("mercadopago");
require("dotenv").config();

const app = express();
app.use(cors());
app.use(bodyParser.json());

// 🔐 Firebase setup via variável de ambiente
let serviceAccount;
try {
  serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY_JSON);
} catch (error) {
  console.error("Erro ao carregar as credenciais do Firebase:", error);
  process.exit(1);
}

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});
const db = admin.firestore();

// 🛒 Mercado Pago (SDK v2.7) - Configuração correta
mercadopago.configure({
  access_token: process.env.MP_ACCESS_TOKEN,
});

// 🧾 Criar pagamento com reserva de número
app.post("/create-payment", async (req, res) => {
  const { nome, telefone, numeros } = req.body;

  try {
    if (!nome || !telefone || !Array.isArray(numeros) || numeros.length === 0) {
      return res.status(400).json({ error: "Dados incompletos ou números inválidos." });
    }

    const numerosStr = numeros.map((n) => n.toString());
    const snapshot = await db.getAll(...numerosStr.map((n) => db.collection("numeros").doc(n)));

    const quinzeMinutos = 15 * 60 * 1000;
    const agora = Date.now();

    // 🔁 Verifica e expira reservas antigas
    for (let i = 0; i < snapshot.length; i++) {
      const doc = snapshot[i];
      const data = doc.data();

      if (!doc.exists) {
        return res.status(400).json({ error: `O número ${doc.id} não existe no banco.` });
      }

      const status = data.status;

      // Se status for inválido ou ausente, tratar como "disponivel"
      if (!status || status === "disponivel") continue;

      // Se estiver reservado e expirado, liberar
      if (
        status === "reservado" &&
        data.timestamp &&
        data.timestamp.toDate &&
        agora - data.timestamp.toDate().getTime() > quinzeMinutos
      ) {
        await db.collection("numeros").doc(doc.id).update({ status: "disponivel" });
        continue;
      }

      // Se estiver reservado (não expirado) ou pago, bloquear
      return res.status(400).json({ error: `O número ${doc.id} já está ${status}.` });
    }

    // 🧷 Reserva números
    const batch = db.batch();
    numerosStr.forEach((n) => {
      const ref = db.collection("numeros").doc(n);
      batch.set(ref, {
        nome,
        telefone,
        status: "reservado",
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });
    });
    await batch.commit();

    const total = numeros.length * 5;
    const title = `Rifa número(s): ${numerosStr.join(", ")}`;

    if (!process.env.MP_ACCESS_TOKEN || process.env.MP_ACCESS_TOKEN === "") {
      return res.json({
        init_point: "https://www.mercadopago.com.br/sandbox/checkout/simulado",
        simulacao: true,
      });
    }

    const preference = {
      items: [{ title, quantity: 1, unit_price: total }],
      payer: { name: nome },
      payment_methods: {
        excluded_payment_types: [{ id: "credit_card" }],
        default_payment_method_id: "pix",
      },
      notification_url: process.env.NOTIFICATION_URL,
      external_reference: numerosStr.join(","),
    };

    // Chamada correta para criar preferência
    const preferenceResponse = await mercadopago.preferences.create(preference);

    return res.json({ init_point: preferenceResponse.body.init_point });
  } catch (error) {
    console.error("Erro ao criar pagamento:", error.response?.body || error.message || error);
    return res.status(500).json({
      error: "Erro ao criar pagamento",
      details: error.response?.body || error.message || error.toString(),
    });
  }
});

// 📩 Webhook Mercado Pago: confirmar pagamento
app.post("/webhook", async (req, res) => {
  try {
    const paymentId = req.body.data?.id;

    if (!paymentId) {
      console.warn("Webhook chamado sem ID de pagamento.");
      return res.sendStatus(400);
    }

    const paymentResponse = await mercadopago.payment.findById(paymentId);

    if (paymentResponse.body.status === "approved") {
      const numeros = paymentResponse.body.external_reference.split(",").map(n => n.trim());
      const batch = db.batch();

      numeros.forEach((n) => {
        const ref = db.collection("numeros").doc(n);
        batch.update(ref, {
          status: "pago",
          pagamento_confirmado_em: admin.firestore.FieldValue.serverTimestamp(),
        });
      });

      await batch.commit();
      console.log(`Pagamento confirmado para os números: ${numeros.join(", ")}`);
    } else {
      console.log(`Pagamento não aprovado. Status: ${paymentResponse.body.status}`);
    }

    res.sendStatus(200);
  } catch (err) {
    console.error("Erro no webhook:", err.response?.body || err.message || err);
    res.sendStatus(500);
  }
});

// 📄 Listar números e seus status
app.get("/numeros", async (req, res) => {
  try {
    const snapshot = await db.collection("numeros").get();
    const numeros = snapshot.docs.map((doc) => ({
      numero: doc.id,
      status: doc.data().status,
    }));
    res.json(numeros);
  } catch (err) {
    console.error("Erro ao buscar números:", err);
    res.status(500).json({ error: "Erro ao buscar números" });
  }
});

// 🏠 Rota raiz
app.get("/", (req, res) => res.send("✅ API da Rifa Rodando com Mercado Pago 2.7 🚀"));

// ▶️ Iniciar servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));
