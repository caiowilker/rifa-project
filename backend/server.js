const express = require("express");
const bodyParser = require("body-parser");
const admin = require("firebase-admin");
const cors = require("cors");
const { MercadoPagoConfig, Preference, Payment } = require("mercadopago");
require("dotenv").config();

const app = express();
app.use(cors());
app.use(bodyParser.json());

// 🔐 Firebase setup
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

// 🛒 Mercado Pago (SDK 2.7+)
const mp = new MercadoPagoConfig({
  accessToken: process.env.MP_ACCESS_TOKEN,
});

// 🧾 Criar pagamento com reserva
app.post("/create-payment", async (req, res) => {
  const { nome, telefone, numeros } = req.body;

  if (!nome || !telefone || !Array.isArray(numeros) || numeros.length === 0) {
    return res.status(400).json({ error: "Dados incompletos ou números inválidos." });
  }

  try {
    const numerosStr = numeros.map((n) => n.toString());
    const snapshot = await db.getAll(...numerosStr.map((n) => db.collection("numeros").doc(n)));

    const quinzeMinutos = 15 * 60 * 1000;
    const agora = Date.now();

    for (const doc of snapshot) {
      if (!doc.exists) {
        return res.status(400).json({ error: `O número ${doc.id} não existe no banco.` });
      }

      const data = doc.data();
      const status = data.status;

      if (!status || status === "disponivel") continue;

      if (
        status === "reservado" &&
        data.timestamp?.toDate &&
        agora - data.timestamp.toDate().getTime() > quinzeMinutos
      ) {
        await db.collection("numeros").doc(doc.id).update({ status: "disponivel" });
        continue;
      }

      return res.status(400).json({ error: `O número ${doc.id} já está ${status}.` });
    }

    const batch = db.batch();
    numerosStr.forEach((n) => {
      const ref = db.collection("numeros").doc(n);
      batch.set(
        ref,
        {
          nome,
          telefone,
          status: "reservado",
          timestamp: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    });
    await batch.commit();

    const total = numeros.length * 5;
    const title = `Rifa número(s): ${numerosStr.join(", ")}`;

    const preference = new Preference(mp);

    const preferenceResponse = await preference.create({
      body: {
        items: [
          {
            title,
            quantity: 1,
            unit_price: total,
          },
        ],
        payer: {
          name: nome,
        },
        payment_methods: {
          excluded_payment_types: [{ id: "credit_card" }],
          default_payment_method_id: "pix",
        },
        notification_url: process.env.NOTIFICATION_URL,
        external_reference: numerosStr.join(","),
      },
    });

    return res.json({ init_point: preferenceResponse.init_point });
  } catch (error) {
    console.error("Erro ao criar pagamento:", error);
    return res.status(500).json({
      error: "Erro ao criar pagamento",
      details: error.message || error.toString(),
    });
  }
});

// 📩 Webhook Mercado Pago
app.post("/webhook", async (req, res) => {
  try {
    const paymentId = req.body.data?.id;

    if (!paymentId) {
      console.warn("Webhook chamado sem ID de pagamento.");
      return res.sendStatus(400);
    }

    const payment = new Payment(mp);
    const paymentResponse = await payment.get({ id: paymentId });

    if (paymentResponse.status === "approved") {
      const numeros = paymentResponse.external_reference.split(",").map((n) => n.trim());
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
      console.log(`Pagamento não aprovado. Status: ${paymentResponse.status}`);
    }

    res.sendStatus(200);
  } catch (err) {
    console.error("Erro no webhook:", err);
    res.sendStatus(500);
  }
});

// 📄 Listar números (libera reservas expiradas automaticamente)
app.get("/numeros", async (req, res) => {
  try {
    const snapshot = await db.collection("numeros").get();
    const quinzeMinutos = 15 * 60 * 1000;
    const agora = Date.now();
    const batch = db.batch();

    const numeros = [];

    snapshot.forEach((doc) => {
      const data = doc.data();
      const status = data.status;

      if (status === "reservado" && data.timestamp?.toDate) {
        const expirado = agora - data.timestamp.toDate().getTime() > quinzeMinutos;
        if (expirado) {
          batch.update(doc.ref, { status: "disponivel" });
          numeros.push({ numero: doc.id, status: "disponivel" });
          return;
        }
      }

      numeros.push({ numero: doc.id, status });
    });

    if (!batch._ops.length) {
      return res.json(numeros);
    }

    await batch.commit();
    res.json(numeros);
  } catch (err) {
    console.error("Erro ao buscar números:", err);
    res.status(500).json({ error: "Erro ao buscar números" });
  }
});

// 🔍 Buscar ganhador por número
app.get("/ganhador/:numero", async (req, res) => {
  const numero = req.params.numero;

  try {
    const doc = await db.collection("numeros").doc(numero).get();

    if (!doc.exists) {
      return res.status(404).json({ error: "Número não encontrado." });
    }

    const data = doc.data();

    if (data.status !== "pago") {
      return res.status(400).json({ error: "Número não foi pago ainda." });
    }

    return res.json({
      numero,
      nome: data.nome,
      telefone: data.telefone,
      status: data.status,
    });
  } catch (err) {
    console.error("Erro ao buscar ganhador:", err);
    res.status(500).json({ error: "Erro interno ao buscar ganhador." });
  }
});

// 🎯 Sortear um número pago aleatoriamente
app.get("/sortear", async (req, res) => {
  try {
    const snapshot = await db.collection("numeros").where("status", "==", "pago").get();

    if (snapshot.empty) {
      return res.status(400).json({ error: "Nenhum número pago encontrado para o sorteio." });
    }

    const pagos = snapshot.docs.map((doc) => ({
      numero: doc.id,
      ...doc.data(),
    }));

    const sorteado = pagos[Math.floor(Math.random() * pagos.length)];

    return res.json({
      mensagem: "Número sorteado com sucesso!",
      numero: sorteado.numero,
      nome: sorteado.nome,
      telefone: sorteado.telefone,
    });
  } catch (err) {
    console.error("Erro ao sortear número:", err);
    res.status(500).json({ error: "Erro ao realizar sorteio." });
  }
});

// 🏠 Rota raiz
app.get("/", (req, res) => res.send("✅ API da Rifa Rodando com Mercado Pago 2.7 🚀"));

// ▶️ Iniciar servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));
